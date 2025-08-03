/**
 * Message API routes for popup viewer
 * Provides REST endpoints to query WebSocket message history
 */
import { InMemoryMessageRepository } from '../repositories/in-memory-message.repository';
import { StoredMessage } from '../repositories/message.repository';
declare const messageRepository: InMemoryMessageRepository;
export declare const messageRouter: import("express-serve-static-core").Router;
/**
 * Middleware to capture WebSocket messages
 * This should be called by the WebSocket server when messages are sent/received
 */
export declare function captureMessage(message: Omit<StoredMessage, 'id' | 'timestamp'>): void;
export { messageRepository };
//# sourceMappingURL=message.routes.d.ts.map