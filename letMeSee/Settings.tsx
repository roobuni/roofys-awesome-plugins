import { Alerts, Button, ChannelStore, Forms, GuildStore, Toasts, useEffect, useState } from "@webpack/common";

import { DB, MessageStats } from "./db";

const getPluginSettings = () => Vencord.Settings.plugins.LetMeSee;

const VISIBLE_CHANNELS = 5;

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
}

interface ChannelInfo {
    id: string;
    name: string;
    guildId?: string;
    stats: MessageStats;
}

export function Settings() {
    const [trackedChannels, setTrackedChannels] = useState<ChannelInfo[]>([]);
    const [ignoredGuilds, setIgnoredGuilds] = useState<string>(getPluginSettings()?.ignoredGuilds || "");
    const [showAll, setShowAll] = useState(false);
    const [dbSize, setDbSize] = useState<number>(0);
    const [totalMessages, setTotalMessages] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [ids, size, total] = await Promise.all([
                DB.getTrackedChannels(),
                DB.getDatabaseSize(),
                DB.getTotalMessageCount()
            ]);
            setDbSize(size);
            setTotalMessages(total);

            const detailsPromises = ids.map(async id => {
                const channel = ChannelStore.getChannel(id);
                const guild = channel ? GuildStore.getGuild(channel.guild_id) : null;
                const stats = await DB.getChannelStats(id);
                return {
                    id,
                    name: guild && channel ? `${guild.name} > #${channel.name}` : channel ? `#${channel.name}` : null,
                    guildId: channel?.guild_id,
                    stats
                };
            });
            const details = await Promise.all(detailsPromises);
            const validDetails = details.filter(d => d.name !== null) as ChannelInfo[];
            setTrackedChannels(validDetails);
        } catch (e) {
            console.error("Failed to load data", e);
        } finally {
            setLoading(false);
        }
    };

    const clearChannel = async (id: string) => {
        try {
            await DB.deleteChannel(id);
            Toasts.show({ message: "Cleared", type: Toasts.Type.SUCCESS, id: Toasts.genId() });
            loadData();
        } catch (e) {
            Toasts.show({ message: "Failed", type: Toasts.Type.FAILURE, id: Toasts.genId() });
        }
    };

    const clearAllData = async () => {
        Alerts.show({
            title: "Clear All?",
            body: `Delete ${totalMessages} messages from ${trackedChannels.length} channels?`,
            confirmText: "Clear",
            confirmColor: "red" as any,
            cancelText: "Cancel",
            onConfirm: async () => {
                try {
                    await DB.clearAll();
                    Toasts.show({ message: "Cleared all", type: Toasts.Type.SUCCESS, id: Toasts.genId() });
                    loadData();
                } catch (e) {
                    Toasts.show({ message: "Failed", type: Toasts.Type.FAILURE, id: Toasts.genId() });
                }
            }
        });
    };

    const excludeGuild = (guildId?: string) => {
        if (!guildId) return;
        const settings = getPluginSettings();
        const current = settings.ignoredGuilds ? settings.ignoredGuilds.split(",").filter(Boolean) : [];
        if (!current.includes(guildId)) {
            current.push(guildId);
            settings.ignoredGuilds = current.join(",");
            setIgnoredGuilds(settings.ignoredGuilds);
            Toasts.show({ message: "Excluded", type: Toasts.Type.SUCCESS, id: Toasts.genId() });
        }
    };

    const removeExclusion = (guildId: string) => {
        const settings = getPluginSettings();
        const current = settings.ignoredGuilds ? settings.ignoredGuilds.split(",").filter(Boolean) : [];
        const newIds = current.filter(id => id !== guildId);
        settings.ignoredGuilds = newIds.join(",");
        setIgnoredGuilds(settings.ignoredGuilds);
        Toasts.show({ message: "Removed", type: Toasts.Type.SUCCESS, id: Toasts.genId() });
    };

    const excludedList = ignoredGuilds.split(",").filter(Boolean);
    const displayedChannels = showAll ? trackedChannels : trackedChannels.slice(0, VISIBLE_CHANNELS);
    const hasMore = trackedChannels.length > VISIBLE_CHANNELS;

    const rowStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        marginBottom: "8px",
        borderRadius: "8px",
        backgroundColor: "#2b2d31"
    };

    const statsBoxStyle: React.CSSProperties = {
        display: "flex",
        gap: "24px",
        padding: "16px",
        marginBottom: "20px",
        borderRadius: "8px",
        backgroundColor: "#2b2d31",
        flexWrap: "wrap"
    };

    return (
        <div style={{ color: "#ffffff" }}>
            <Forms.FormTitle tag="h3" style={{ color: "#ffffff" }}>Stats</Forms.FormTitle>
            <div style={statsBoxStyle}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.75rem", color: "#b5bac1" }}>Messages</span>
                    <span style={{ fontSize: "1.25rem", fontWeight: 600, color: "#dcddde" }}>
                        {loading ? "..." : totalMessages.toLocaleString()}
                    </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.75rem", color: "#b5bac1" }}>Channels</span>
                    <span style={{ fontSize: "1.25rem", fontWeight: 600, color: "#dcddde" }}>
                        {loading ? "..." : trackedChannels.length}
                    </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.75rem", color: "#b5bac1" }}>Size</span>
                    <span style={{ fontSize: "1.25rem", fontWeight: 600, color: "#dcddde" }}>
                        {loading ? "..." : formatBytes(dbSize)}
                    </span>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
                    <Button color={Button.Colors.RED} size={Button.Sizes.SMALL} onClick={clearAllData} disabled={totalMessages === 0}>
                        Clear All
                    </Button>
                </div>
            </div>

            <Forms.FormTitle tag="h3" style={{ color: "#ffffff" }}>Channels ({trackedChannels.length})</Forms.FormTitle>
            <Forms.FormText style={{ color: "#b5bac1" }}>Tracked channels. DMs excluded.</Forms.FormText>

            <div style={{ marginTop: 12, marginBottom: 20 }}>
                {loading ? (
                    <div style={{ color: "#b5bac1", padding: "8px 0" }}>Loading...</div>
                ) : trackedChannels.length === 0 ? (
                    <div style={{ color: "#b5bac1", padding: "8px 0" }}>None</div>
                ) : (
                    displayedChannels.map(c => (
                        <div key={c.id} style={rowStyle}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, color: "#dcddde" }}>{c.name}</div>
                                <div style={{ fontSize: "0.75em", color: "#b5bac1", marginTop: "2px" }}>
                                    {c.stats.count} msgs
                                    {c.stats.oldestTimestamp && ` | ${formatRelativeTime(c.stats.oldestTimestamp)}`}
                                    {c.stats.newestTimestamp && ` - ${formatRelativeTime(c.stats.newestTimestamp)}`}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <Button color={Button.Colors.RED} size={Button.Sizes.SMALL} onClick={() => clearChannel(c.id)}>
                                    Clear
                                </Button>
                                <Button color={Button.Colors.PRIMARY} size={Button.Sizes.SMALL} onClick={() => excludeGuild(c.guildId)}>
                                    Exclude
                                </Button>
                            </div>
                        </div>
                    ))
                )}
                {hasMore && (
                    <Button color={Button.Colors.PRIMARY} size={Button.Sizes.SMALL} look={Button.Looks.LINK} onClick={() => setShowAll(!showAll)} style={{ marginTop: 8 }}>
                        {showAll ? "Less" : `+${trackedChannels.length - VISIBLE_CHANNELS} more`}
                    </Button>
                )}
            </div>

            <Forms.FormTitle tag="h3" style={{ color: "#ffffff" }}>Excluded ({excludedList.length})</Forms.FormTitle>
            <Forms.FormText style={{ color: "#b5bac1" }}>These servers won't be cached.</Forms.FormText>
            <div style={{ marginTop: 12 }}>
                {excludedList.length === 0 ? (
                    <div style={{ color: "#b5bac1", padding: "8px 0" }}>None</div>
                ) : (
                    excludedList.map(gid => {
                        const guild = GuildStore.getGuild(gid);
                        return (
                            <div key={gid} style={rowStyle}>
                                <span style={{ color: "#dcddde" }}>{guild ? guild.name : gid}</span>
                                <Button color={Button.Colors.RED} size={Button.Sizes.SMALL} onClick={() => removeExclusion(gid)}>
                                    Remove
                                </Button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
