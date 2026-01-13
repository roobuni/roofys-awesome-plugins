import "./styles.css";

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Logger } from "@utils/Logger";
import { openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, FluxDispatcher, Menu, MessageStore, Toasts } from "@webpack/common";

import { CachedMessageViewer } from "./CachedMessageViewer";
import { CachedMessage, DB } from "./db";
import { Settings } from "./Settings";
import { canSeeHistory } from "./utils";

const logger = new Logger("LetMeSee");

const getSettings = () => Vencord.Settings.plugins.LetMeSee;

const injectedChannels = new Set<string>();

function isDMChannel(channel: any): boolean {
    if (!channel) return false;
    return channel.type === 1 || channel.type === 3;
}

function shouldIgnoreChannel(channel: any): boolean {
    if (!channel) return true;
    if (isDMChannel(channel)) return true;
    const settings = getSettings();
    if (channel.guild_id && settings?.ignoredGuilds) {
        const ignored = settings.ignoredGuilds.split(",").filter(Boolean);
        if (ignored.includes(channel.guild_id)) return true;
    }
    return false;
}

async function enforceChannelLimits(channelId: string) {
    const settings = getSettings();
    const maxMessages = settings?.maxMessagesPerChannel ?? 500;
    try {
        await DB.enforceChannelLimit(channelId, maxMessages);
    } catch (e) {
        logger.error("Failed to enforce channel limit", e);
    }
}

async function runAutoCleanup() {
    const settings = getSettings();
    if (!settings?.enableAutoCleanup) return;
    const maxAgeDays = settings?.autoCleanupDays ?? 30;
    try {
        const deleted = await DB.deleteOldMessages(maxAgeDays);
        if (deleted > 0) {
            logger.info(`Cleanup: removed ${deleted} old messages`);
        }
    } catch (e) {
        logger.error("Auto-cleanup failed", e);
    }
}

const channelContextMenuPatch: NavContextMenuPatchCallback = (children, { channel }) => {
    if (!channel?.id) return;
    DB.getMessageCount(channel.id).then(count => {
        if (count === 0) return;
        const group = findGroupChildrenByChildId("channel-copy-link", children) ?? children;
        group.push(
            <Menu.MenuItem
                id="vc-letmesee-view-cached"
                label={`View Cached (${count})`}
                action={() => {
                    openModal(props => (
                        <CachedMessageViewer
                            channelId={channel.id}
                            channelName={channel.name || "Unknown"}
                            {...props}
                        />
                    ));
                }}
            />
        );
    }).catch(() => { });
};

export default definePlugin({
    name: "LetMeSee",
    description: "Caches messages for channels without history permission. Excludes DMs.",
    authors: [{ name: "RoofusPoof", id: 1352342643853492246n }],
    settingsAboutComponent: Settings,

    contextMenus: {
        "channel-context": channelContextMenuPatch,
        "thread-context": channelContextMenuPatch
    },

    options: {
        ignoredGuilds: {
            type: OptionType.STRING,
            default: "",
            hidden: true,
            description: "Ignored guild IDs"
        },
        maxMessagesPerChannel: {
            type: OptionType.SLIDER,
            default: 500,
            markers: [100, 250, 500, 1000, 2000],
            stickToMarkers: false,
            description: "Max messages per channel"
        },
        autoCleanupDays: {
            type: OptionType.SLIDER,
            default: 30,
            markers: [7, 14, 30, 60, 90],
            stickToMarkers: false,
            description: "Delete messages older than (days)"
        },
        enableAutoCleanup: {
            type: OptionType.BOOLEAN,
            default: true,
            description: "Enable auto cleanup"
        }
    },

    async start() {
        try {
            await DB.open();
            logger.info("Database initialized");
            await runAutoCleanup();
        } catch (e) {
            logger.error("Failed to initialize database", e);
        }
        injectedChannels.clear();
    },

    stop() {
        injectedChannels.clear();
    },

    flux: {
        async MESSAGE_CREATE({ message }: { message: any }) {
            const channel = ChannelStore.getChannel(message.channel_id);
            if (shouldIgnoreChannel(channel)) return;
            if (!canSeeHistory(message.channel_id)) {
                const cachedMessage: CachedMessage = {
                    ...message,
                    cached_at: Date.now()
                };
                try {
                    await DB.saveMessage(cachedMessage);
                    await enforceChannelLimits(message.channel_id);
                } catch (e) {
                    logger.error("Failed to save message", e);
                }
            }
        },

        async MESSAGE_UPDATE({ message }: { message: any }) {
            if (!message?.id || !message?.channel_id) return;
            const channel = ChannelStore.getChannel(message.channel_id);
            if (shouldIgnoreChannel(channel)) return;
            try {
                const existing = await DB.getMessage(message.id);
                if (existing) {
                    await DB.updateMessage(message.id, {
                        content: message.content,
                        edited_timestamp: message.edited_timestamp,
                        embeds: message.embeds,
                        attachments: message.attachments
                    });
                }
            } catch (e) {
                logger.error("Failed to update message", e);
            }
        },

        MESSAGE_DELETE({ id }: { id: string }) {
            DB.deleteMessage(id).catch(() => { });
        },

        MESSAGE_DELETE_BULK({ ids }: { ids: string[] }) {
            for (const id of ids) {
                DB.deleteMessage(id).catch(() => { });
            }
        },

        CHANNEL_DELETE({ channel }: { channel: { id: string; type?: number } }) {
            if (channel?.id) {
                DB.deleteChannel(channel.id).catch(() => { });
                injectedChannels.delete(channel.id);
            }
        },

        async CHANNEL_SELECT({ channelId }: { channelId: string }) {
            if (!channelId) return;
            const channel = ChannelStore.getChannel(channelId);

            if (isDMChannel(channel)) {
                DB.deleteChannel(channelId).catch(() => { });
                return;
            }

            if (channel?.type === 1 || channel?.type === 3) return;

            if (injectedChannels.has(channelId)) return;

            try {
                const messages = await DB.getMessages(channelId);
                if (messages.length === 0) return;
                if (canSeeHistory(channelId)) return;

                injectedChannels.add(channelId);

                const existingMessages = MessageStore.getMessages(channelId);
                const existingIds = new Set(existingMessages?._array?.map((m: any) => m.id) || []);
                const newMessages = messages.filter(msg => !existingIds.has(msg.id));

                if (newMessages.length === 0) return;

                for (const msg of newMessages) {
                    FluxDispatcher.dispatch({
                        type: "MESSAGE_CREATE",
                        channelId: channelId,
                        message: { ...msg, __letmesee_cached: true },
                        optimistic: false,
                        isPushNotification: false
                    });
                }

                Toasts.show({
                    message: `${newMessages.length} cached messages loaded`,
                    type: Toasts.Type.MESSAGE,
                    id: Toasts.genId(),
                    options: { duration: 3000 }
                });
            } catch (e) {
                logger.error("Failed to inject messages", e);
            }
        }
    }
});
