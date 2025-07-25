/**
 * Message repository for popup viewer
 * Stores WebSocket messages with metadata
 */

export interface StoredMessage {
  id: string;
  timestamp: Date;
  type: string;
  namespace?: string;
  addon_id?: string;
  direction: 'incoming' | 'outgoing';
  payload: any;
  metadata?: {
    clientId?: string;
    sessionId?: string;
    tags?: string[];
  };
}

export interface MessageQuery {
  since?: Date;
  until?: Date;
  type?: string;
  namespace?: string;
  addon_id?: string;
  limit?: number;
  offset?: number;
}

export interface MessageRepository {
  /**
   * Store a message
   */
  save(message: StoredMessage): Promise<StoredMessage>;

  /**
   * Get messages by query
   */
  findByQuery(query: MessageQuery): Promise<StoredMessage[]>;

  /**
   * Get message by ID
   */
  findById(id: string): Promise<StoredMessage | null>;

  /**
   * Get recent messages
   */
  getRecent(limit: number): Promise<StoredMessage[]>;

  /**
   * Clear old messages
   */
  clearOlderThan(date: Date): Promise<number>;

  /**
   * Get message count
   */
  count(query?: MessageQuery): Promise<number>;
}