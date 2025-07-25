/**
 * In-memory implementation of message repository
 * Stores messages with automatic cleanup of old entries
 */

import { v4 as uuidv4 } from 'uuid';
import { MessageRepository, StoredMessage, MessageQuery } from './message.repository';

export class InMemoryMessageRepository implements MessageRepository {
  private messages: Map<string, StoredMessage> = new Map();
  private messagesByTime: StoredMessage[] = [];
  private maxMessages = 1000; // Keep last 1000 messages

  async save(message: StoredMessage): Promise<StoredMessage> {
    const savedMessage = {
      ...message,
      id: message.id || uuidv4(),
      timestamp: message.timestamp || new Date()
    };

    this.messages.set(savedMessage.id, savedMessage);
    this.messagesByTime.push(savedMessage);

    // Cleanup old messages if exceeding limit
    if (this.messagesByTime.length > this.maxMessages) {
      const removed = this.messagesByTime.shift();
      if (removed) {
        this.messages.delete(removed.id);
      }
    }

    return savedMessage;
  }

  async findByQuery(query: MessageQuery): Promise<StoredMessage[]> {
    let results = [...this.messagesByTime];

    // Filter by date range
    if (query.since) {
      results = results.filter(m => m.timestamp >= query.since!);
    }
    if (query.until) {
      results = results.filter(m => m.timestamp <= query.until!);
    }

    // Filter by type
    if (query.type) {
      results = results.filter(m => m.type === query.type);
    }

    // Filter by namespace
    if (query.namespace) {
      results = results.filter(m => m.namespace === query.namespace);
    }

    // Filter by addon_id
    if (query.addon_id) {
      results = results.filter(m => m.addon_id === query.addon_id);
    }

    // Sort by timestamp descending (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    
    return results.slice(offset, offset + limit);
  }

  async findById(id: string): Promise<StoredMessage | null> {
    return this.messages.get(id) || null;
  }

  async getRecent(limit: number): Promise<StoredMessage[]> {
    const startIndex = Math.max(0, this.messagesByTime.length - limit);
    return this.messagesByTime
      .slice(startIndex)
      .reverse(); // Newest first
  }

  async clearOlderThan(date: Date): Promise<number> {
    const before = this.messagesByTime.length;
    
    this.messagesByTime = this.messagesByTime.filter(m => m.timestamp > date);
    
    // Rebuild the map
    const newMap = new Map<string, StoredMessage>();
    this.messagesByTime.forEach(m => newMap.set(m.id, m));
    this.messages = newMap;

    return before - this.messagesByTime.length;
  }

  async count(query?: MessageQuery): Promise<number> {
    if (!query) {
      return this.messages.size;
    }

    const results = await this.findByQuery({ ...query, limit: Number.MAX_SAFE_INTEGER });
    return results.length;
  }

  /**
   * Clear all messages (useful for testing)
   */
  clear(): void {
    this.messages.clear();
    this.messagesByTime = [];
  }

  /**
   * Set maximum message limit
   */
  setMaxMessages(limit: number): void {
    this.maxMessages = limit;
  }
}