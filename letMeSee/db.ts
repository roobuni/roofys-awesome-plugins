const DB_NAME = "LetMeSee_DB";
const DB_VERSION = 2;
const STORE_NAME = "messages";

export interface CachedMessage {
    id: string;
    channel_id: string;
    timestamp: string;
    cached_at: number;
    edited_timestamp?: string | null;
    content?: string;
    author?: {
        id: string;
        username: string;
        avatar?: string;
        discriminator?: string;
        global_name?: string;
    };
    attachments?: any[];
    embeds?: any[];
    [key: string]: any;
}

export interface MessageStats {
    count: number;
    oldestTimestamp: string | null;
    newestTimestamp: string | null;
}

interface BatchQueueItem {
    message: CachedMessage;
    resolve: () => void;
    reject: (error: any) => void;
}

export class Database {
    private db: IDBDatabase | null = null;
    private batchQueue: BatchQueueItem[] = [];
    private batchTimeout: ReturnType<typeof setTimeout> | null = null;
    private readonly BATCH_DELAY_MS = 1000;
    private readonly BATCH_MAX_SIZE = 50;

    async open(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                let store: IDBObjectStore;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
                } else {
                    store = (event.target as IDBOpenDBRequest).transaction!.objectStore(STORE_NAME);
                }
                if (!store.indexNames.contains("channel_id")) {
                    store.createIndex("channel_id", "channel_id", { unique: false });
                }
                if (!store.indexNames.contains("timestamp")) {
                    store.createIndex("timestamp", "timestamp", { unique: false });
                }
                if (!store.indexNames.contains("cached_at")) {
                    store.createIndex("cached_at", "cached_at", { unique: false });
                }
                if (!store.indexNames.contains("channel_timestamp")) {
                    store.createIndex("channel_timestamp", ["channel_id", "timestamp"], { unique: false });
                }
            };
        });
    }

    async saveMessage(message: CachedMessage): Promise<void> {
        if (!message.cached_at) {
            message.cached_at = Date.now();
        }
        return new Promise((resolve, reject) => {
            this.batchQueue.push({ message, resolve, reject });
            if (this.batchQueue.length >= this.BATCH_MAX_SIZE) {
                this.flushBatchQueue();
            } else if (!this.batchTimeout) {
                this.batchTimeout = setTimeout(() => this.flushBatchQueue(), this.BATCH_DELAY_MS);
            }
        });
    }

    private async flushBatchQueue(): Promise<void> {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
        if (this.batchQueue.length === 0) return;
        const items = [...this.batchQueue];
        this.batchQueue = [];
        if (!this.db) await this.open();
        try {
            const transaction = this.db!.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            for (const item of items) {
                try {
                    store.put(item.message);
                    item.resolve();
                } catch (e) {
                    item.reject(e);
                }
            }
            transaction.onerror = () => {
                items.forEach(item => item.reject(transaction.error));
            };
        } catch (e) {
            items.forEach(item => item.reject(e));
        }
    }

    async saveMessageImmediate(message: CachedMessage): Promise<void> {
        if (!message.cached_at) {
            message.cached_at = Date.now();
        }
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(message);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async getMessages(channelId: string): Promise<CachedMessage[]> {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index("channel_id");
            const request = index.getAll(IDBKeyRange.only(channelId));
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const messages = request.result as CachedMessage[];
                messages.sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
                resolve(messages);
            };
        });
    }

    async getMessageCount(channelId: string): Promise<number> {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index("channel_id");
            const request = index.count(IDBKeyRange.only(channelId));
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async getChannelStats(channelId: string): Promise<MessageStats> {
        const messages = await this.getMessages(channelId);
        if (messages.length === 0) {
            return { count: 0, oldestTimestamp: null, newestTimestamp: null };
        }
        return {
            count: messages.length,
            oldestTimestamp: messages[0].timestamp,
            newestTimestamp: messages[messages.length - 1].timestamp
        };
    }

    async deleteOldMessages(maxAgeDays: number): Promise<number> {
        if (!this.db) await this.open();
        const cutoffTime = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
        let deletedCount = 0;
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index("cached_at");
            const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));
            request.onerror = () => reject(request.error);
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    resolve(deletedCount);
                }
            };
        });
    }

    async enforceChannelLimit(channelId: string, maxMessages: number): Promise<number> {
        const messages = await this.getMessages(channelId);
        if (messages.length <= maxMessages) {
            return 0;
        }
        const toDelete = messages.slice(0, messages.length - maxMessages);
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            let deleted = 0;
            for (const msg of toDelete) {
                const req = store.delete(msg.id);
                req.onsuccess = () => {
                    deleted++;
                    if (deleted === toDelete.length) resolve(deleted);
                };
                req.onerror = () => reject(req.error);
            }
            if (toDelete.length === 0) resolve(0);
        });
    }

    async getDatabaseSize(): Promise<number> {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const messages = request.result;
                const totalSize = messages.reduce((acc, msg) => {
                    return acc + JSON.stringify(msg).length * 2;
                }, 0);
                resolve(totalSize);
            };
        });
    }

    async searchMessages(query: string, channelId?: string): Promise<CachedMessage[]> {
        if (!this.db) await this.open();
        const lowerQuery = query.toLowerCase();
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            let request: IDBRequest<CachedMessage[]>;
            if (channelId) {
                const index = store.index("channel_id");
                request = index.getAll(IDBKeyRange.only(channelId));
            } else {
                request = store.getAll();
            }
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const messages = request.result.filter(msg => {
                    const content = msg.content?.toLowerCase() || "";
                    const author = msg.author?.username?.toLowerCase() || "";
                    return content.includes(lowerQuery) || author.includes(lowerQuery);
                });
                messages.sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
                resolve(messages);
            };
        });
    }

    async getMessagesByDateRange(channelId: string, startDate: Date, endDate: Date): Promise<CachedMessage[]> {
        const messages = await this.getMessages(channelId);
        return messages.filter(msg => {
            const msgDate = new Date(msg.timestamp);
            return msgDate >= startDate && msgDate <= endDate;
        });
    }

    async getTrackedChannels(): Promise<string[]> {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const messages = request.result as CachedMessage[];
                const channelIds = new Set<string>();
                for (const msg of messages) {
                    if (msg.channel_id) {
                        channelIds.add(msg.channel_id);
                    }
                }
                resolve(Array.from(channelIds));
            };
        });
    }

    async deleteChannel(channelId: string): Promise<void> {
        if (!this.db) await this.open();
        const msgs = await this.getMessages(channelId);
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            if (msgs.length === 0) {
                resolve();
                return;
            }
            let count = 0;
            for (const msg of msgs) {
                const req = store.delete(msg.id);
                req.onsuccess = () => {
                    count++;
                    if (count === msgs.length) resolve();
                };
                req.onerror = () => reject(req.error);
            }
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async deleteMessage(messageId: string): Promise<void> {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(messageId);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async clearAll(): Promise<void> {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async getMessage(messageId: string): Promise<CachedMessage | null> {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(messageId);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || null);
        });
    }

    async updateMessage(messageId: string, updates: Partial<CachedMessage>): Promise<void> {
        const existing = await this.getMessage(messageId);
        if (!existing) return;
        const updated = { ...existing, ...updates };
        await this.saveMessageImmediate(updated);
    }

    async getTotalMessageCount(): Promise<number> {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.count();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }
}

export const DB = new Database();
