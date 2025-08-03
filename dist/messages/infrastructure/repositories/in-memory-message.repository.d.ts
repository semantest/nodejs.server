/**
 * In-memory implementation of message repository
 * Stores messages with automatic cleanup of old entries
 */
import { MessageRepository, StoredMessage, MessageQuery } from './message.repository';
export declare class InMemoryMessageRepository implements MessageRepository {
    private messages;
    private messagesByTime;
    private maxMessages;
    save(message: StoredMessage): Promise<StoredMessage>;
    findByQuery(query: MessageQuery): Promise<StoredMessage[]>;
    findById(id: string): Promise<StoredMessage | null>;
    getRecent(limit: number): Promise<StoredMessage[]>;
    clearOlderThan(date: Date): Promise<number>;
    count(query?: MessageQuery): Promise<number>;
    /**
     * Clear all messages (useful for testing)
     */
    clear(): void;
    /**
     * Set maximum message limit
     */
    setMaxMessages(limit: number): void;
}
//# sourceMappingURL=in-memory-message.repository.d.ts.map