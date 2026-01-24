import "./styles.css";

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import definePlugin from "@utils/types";
import { ChannelStore, FluxDispatcher, GuildStore, Menu, MessageStore } from "@webpack/common";
import { Logger } from "@utils/Logger";

const logger = new Logger("ChannelLogger");
const channelCache = new Map<string, any>();
const messageCache = new Map<string, any[]>();
const deletedChannels = new Map<string, any>();
const realDeletes = new Set<string>();
const MAX_MESSAGES = 50;

function cacheChannel(channel: any) {
    if (!channel?.id) return;
    channelCache.set(channel.id, channel);
}

function cacheMessages(channelId: string) {
    if (deletedChannels.has(channelId)) return;
    
    const messages = MessageStore.getMessages(channelId);
    const messageArray: any[] = [];
    if (messages?._array) {
        const arr = messages._array;
        const start = Math.max(0, arr.length - MAX_MESSAGES);
        for (let i = start; i < arr.length; i++) {
            messageArray.push(arr[i]);
        }
    }
    if (messageArray.length > 0) {
        messageCache.set(channelId, messageArray);
    }
}

function cacheAllChannels() {
    const guilds = GuildStore.getGuilds();
    for (const guildId of Object.keys(guilds)) {
        const guildChannels = ChannelStore.getMutableGuildChannelsForGuild(guildId);
        if (guildChannels) {
            for (const channel of Object.values(guildChannels)) {
                cacheChannel(channel);
            }
        }
    }
    logger.info(`Cached ${channelCache.size} channels`);
}

function deletePreservation(channelId: string) {
    if (deletedChannels.has(channelId)) {
        const channel = deletedChannels.get(channelId);
        deletedChannels.delete(channelId);
        channelCache.delete(channelId);
        messageCache.delete(channelId);
        realDeletes.add(channelId);
        
        FluxDispatcher.dispatch({
            type: "CHANNEL_DELETE",
            channel: { id: channelId, guild_id: channel.guild_id }
        });
    }
}

function applyDeletedStyle(channelId: string) {
    const tryApply = (attempts = 0) => {
        const element = document.querySelector(`[data-list-item-id="channels___${channelId}"]`);
        if (element) {
            element.classList.add("vc-channel-logger-deleted");
        } else if (attempts < 10) {
            setTimeout(() => tryApply(attempts + 1), 100);
        }
    };
    tryApply();
}

const channelContextMenuPatch: NavContextMenuPatchCallback = (children, { channel }) => {
    if (!channel || !deletedChannels.has(channel.id)) return;

    const group = findGroupChildrenByChildId("mark-channel-read", children) ?? children;
    group.push(
        <Menu.MenuItem
            id="vc-channel-logger-delete"
            label="Delete Preservation"
            color="danger"
            action={() => deletePreservation(channel.id)}
        />
    );
};

export default definePlugin({
    name: "ChannelLogger",
    description: "Preserves deleted channels so you can view their cached messages before they disappear.",
    authors: [{ name: "RoofusPoof", id: 1352342643853492246n }],

    contextMenus: {
        "channel-context": channelContextMenuPatch,
        "thread-context": channelContextMenuPatch
    },

    start() {
        logger.info("ChannelLogger started");
        setTimeout(cacheAllChannels, 3000);
    },

    flux: {
        MESSAGE_CREATE({ channelId, message }: { channelId: string; message: any }) {
            if (!channelId || !message?.id || deletedChannels.has(channelId)) return;
            
            let cached = messageCache.get(channelId) || [];
            if (!cached.some(m => m.id === message.id)) {
                cached.push(message);
                if (cached.length > MAX_MESSAGES) {
                    cached = cached.slice(-MAX_MESSAGES);
                }
                messageCache.set(channelId, cached);
            }
        },

        CHANNEL_CREATE({ channel }: { channel: any }) {
            cacheChannel(channel);
        },

        CHANNEL_UPDATE({ channel }: { channel: any }) {
            if (!deletedChannels.has(channel?.id)) {
                cacheChannel(channel);
            }
        },

        LOAD_MESSAGES_FAILURE({ channelId }: { channelId: string }) {
            if (deletedChannels.has(channelId)) {
                const cachedMessages = messageCache.get(channelId) || [];
                const sortedMessages = [...cachedMessages].sort((a, b) => {
                    return BigInt(b.id) > BigInt(a.id) ? 1 : -1;
                });
                logger.info(`Intercepting load failure for deleted channel, injecting ${sortedMessages.length} messages`);
                setTimeout(() => {
                    FluxDispatcher.dispatch({
                        type: "LOAD_MESSAGES_SUCCESS",
                        channelId: channelId,
                        messages: sortedMessages,
                        isBefore: false,
                        isAfter: false,
                        hasMoreBefore: false,
                        hasMoreAfter: false,
                        truncate: true,
                        jump: undefined
                    });
                }, 100);
            }
        },

        CHANNEL_SELECT({ channelId }: { channelId: string }) {
            if (!channelId) return;

            if (!deletedChannels.has(channelId)) {
                setTimeout(() => {
                    cacheMessages(channelId);
                    logger.info(`Cached messages for channel ${channelId}, total: ${messageCache.get(channelId)?.length || 0}`);
                }, 500);
            }
        },

        CHANNEL_DELETE({ channel }: { channel: any }) {
            if (!channel?.id) return;

            if (realDeletes.has(channel.id)) {
                realDeletes.delete(channel.id);
                return;
            }

            const cached = channelCache.get(channel.id);
            if (!cached) {
                logger.warn(`No cached data for channel ${channel.id}`);
                return;
            }

            const originalName = cached.name;
            logger.info(`Preserving deleted channel: ${originalName}`);

            const cachedMessages = messageCache.get(channel.id) || [];
            const sortedMessages = [...cachedMessages].sort((a, b) => {
                return BigInt(b.id) > BigInt(a.id) ? 1 : -1;
            });
            logger.info(`Found ${sortedMessages.length} cached messages for channel`);

            cached.name = `deleted-${originalName}`;
            cached._deleted = true;
            cached._originalName = originalName;
            deletedChannels.set(channel.id, cached);
            messageCache.set(channel.id, sortedMessages);

            setTimeout(() => {
                FluxDispatcher.dispatch({
                    type: "CHANNEL_CREATE",
                    channel: cached
                });

                if (sortedMessages.length > 0) {
                    setTimeout(() => {
                        FluxDispatcher.dispatch({
                            type: "LOAD_MESSAGES_SUCCESS",
                            channelId: channel.id,
                            messages: sortedMessages,
                            isBefore: false,
                            isAfter: false,
                            hasMoreBefore: false,
                            hasMoreAfter: false,
                            truncate: true,
                            jump: undefined
                        });
                    }, 200);
                }

                applyDeletedStyle(channel.id);
            }, 100);
        }
    },

    isDeleted(channelId: string) {
        return deletedChannels.has(channelId);
    },

    getDeletedChannels() {
        return deletedChannels;
    }
});
