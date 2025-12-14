import { copyToClipboard } from "@utils/clipboard";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import { Button, Text, Toasts, useEffect, useMemo, useRef, useState } from "@webpack/common";

import { CachedMessage, DB, MessageStats } from "./db";

interface CachedMessageViewerProps extends ModalProps {
    channelId: string;
    channelName: string;
}

function formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleString();
}

function formatRelativeTime(timestamp: string): string {
    const diffDays = Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
}

function MessageItem({ message, onCopy }: { message: CachedMessage; onCopy: (text: string) => void }) {
    const authorName = message.author?.global_name || message.author?.username || "Unknown";
    const avatarUrl = message.author?.avatar
        ? `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png?size=40`
        : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(message.author?.id || "0") % 5n)}.png`;

    return (
        <div className="vc-letmesee-message">
            <img
                className="vc-letmesee-message-avatar"
                src={avatarUrl}
                alt=""
                onError={e => { (e.target as HTMLImageElement).src = "https://cdn.discordapp.com/embed/avatars/0.png"; }}
            />
            <div className="vc-letmesee-message-body">
                <div className="vc-letmesee-message-header">
                    <span className="vc-letmesee-message-author">{authorName}</span>
                    <span className="vc-letmesee-message-timestamp">{formatTimestamp(message.timestamp)}</span>
                    {message.edited_timestamp && <span className="vc-letmesee-message-edited">(edited)</span>}
                </div>
                <div className="vc-letmesee-message-content">
                    {message.content || <em style={{ color: "#b5bac1" }}>No content</em>}
                </div>
                {message.attachments && message.attachments.length > 0 && (
                    <div className="vc-letmesee-message-attachments">
                        {message.attachments.map((att: any, i: number) => (
                            <a key={i} className="vc-letmesee-message-attachment" href={att.url} target="_blank" rel="noopener noreferrer">
                                {att.filename}
                            </a>
                        ))}
                    </div>
                )}
                {message.embeds && message.embeds.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: "0.875rem", color: "#b5bac1" }}>
                        {message.embeds.length} embed(s)
                    </div>
                )}
            </div>
            <div className="vc-letmesee-message-actions">
                <Button size={Button.Sizes.TINY} onClick={() => onCopy(message.content || "")}>Copy</Button>
            </div>
        </div>
    );
}

export function CachedMessageViewer({ channelId, channelName, ...modalProps }: CachedMessageViewerProps) {
    const [messages, setMessages] = useState<CachedMessage[]>([]);
    const [filteredMessages, setFilteredMessages] = useState<CachedMessage[]>([]);
    const [stats, setStats] = useState<MessageStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [visibleCount, setVisibleCount] = useState(50);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function load() {
            try {
                const [msgs, channelStats] = await Promise.all([
                    DB.getMessages(channelId),
                    DB.getChannelStats(channelId)
                ]);
                setMessages(msgs);
                setFilteredMessages(msgs);
                setStats(channelStats);
            } catch (e) {
                console.error("Failed to load messages", e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [channelId]);

    useEffect(() => {
        let filtered = [...messages];
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(msg => {
                const content = msg.content?.toLowerCase() || "";
                const author = msg.author?.username?.toLowerCase() || "";
                return content.includes(query) || author.includes(query);
            });
        }
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            filtered = filtered.filter(msg => new Date(msg.timestamp) >= start);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(msg => new Date(msg.timestamp) <= end);
        }
        setFilteredMessages(filtered);
        setVisibleCount(50);
    }, [messages, searchQuery, startDate, endDate]);

    const handleScroll = () => {
        if (!contentRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            setVisibleCount(prev => Math.min(prev + 50, filteredMessages.length));
        }
    };

    const visibleMessages = useMemo(() => filteredMessages.slice(0, visibleCount), [filteredMessages, visibleCount]);

    const handleCopy = (text: string) => {
        copyToClipboard(text);
        Toasts.show({ message: "Copied", type: Toasts.Type.SUCCESS, id: Toasts.genId() });
    };

    const clearFilters = () => {
        setSearchQuery("");
        setStartDate("");
        setEndDate("");
    };

    return (
        <ModalRoot {...modalProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Text variant="heading-lg/semibold">#{channelName}</Text>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent className="vc-letmesee-viewer">
                <div className="vc-letmesee-viewer-header">
                    {stats && (
                        <div className="vc-letmesee-stats">
                            <div className="vc-letmesee-stat">
                                <span className="vc-letmesee-stat-label">Total</span>
                                <span className="vc-letmesee-stat-value">{stats.count}</span>
                            </div>
                            {stats.oldestTimestamp && (
                                <div className="vc-letmesee-stat">
                                    <span className="vc-letmesee-stat-label">Oldest</span>
                                    <span className="vc-letmesee-stat-value">{formatRelativeTime(stats.oldestTimestamp)}</span>
                                </div>
                            )}
                            {stats.newestTimestamp && (
                                <div className="vc-letmesee-stat">
                                    <span className="vc-letmesee-stat-label">Newest</span>
                                    <span className="vc-letmesee-stat-value">{formatRelativeTime(stats.newestTimestamp)}</span>
                                </div>
                            )}
                            <div className="vc-letmesee-stat">
                                <span className="vc-letmesee-stat-label">Showing</span>
                                <span className="vc-letmesee-stat-value">{filteredMessages.length}/{messages.length}</span>
                            </div>
                        </div>
                    )}
                    <div className="vc-letmesee-viewer-search">
                        <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        <div className="vc-letmesee-date-filter">
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            <span style={{ color: "#b5bac1" }}>to</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                        {(searchQuery || startDate || endDate) && (
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} look={Button.Looks.LINK} onClick={clearFilters}>
                                Clear
                            </Button>
                        )}
                    </div>
                </div>
                <div className="vc-letmesee-viewer-content" ref={contentRef} onScroll={handleScroll}>
                    {loading ? (
                        <div className="vc-letmesee-loading">Loading...</div>
                    ) : filteredMessages.length === 0 ? (
                        <div className="vc-letmesee-empty">{messages.length === 0 ? "No messages" : "No matches"}</div>
                    ) : (
                        <>
                            {visibleMessages.map(msg => (
                                <MessageItem key={msg.id} message={msg} onCopy={handleCopy} />
                            ))}
                            {visibleCount < filteredMessages.length && (
                                <div style={{ textAlign: "center", padding: 16, color: "#b5bac1" }}>
                                    Scroll for more ({filteredMessages.length - visibleCount} left)
                                </div>
                            )}
                        </>
                    )}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}
