/**
 * @fileoverview Main entry point for Web-Buddy Node.js Server Framework
 * @description Event-driven server for coordinating browser extension automation
 * @author Web-Buddy Team
 */
export { ServerApplication } from './server/server-application';
export * from './core/events/server-events';
export * from './core/events/coordination-events';
export { WebSocketServerAdapter } from './coordination/adapters/websocket-server-adapter';
export { ExtensionManagerAdapter } from './coordination/adapters/extension-manager-adapter';
export { SessionManagerAdapter } from './coordination/adapters/session-manager-adapter';
export * from './server/adapters/http-server-adapter';
export * from './server/adapters/logging-adapter';
export * from './server/adapters/cache-adapter';
//# sourceMappingURL=index.d.ts.map