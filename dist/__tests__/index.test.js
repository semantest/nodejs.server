/**
 * Tests for main index exports
 * Created to improve coverage from 0%
 */
describe('Main index exports', () => {
    let indexExports;
    beforeAll(() => {
        // Import the index file
        indexExports = require('../index');
    });
    describe('Core exports', () => {
        it('should export ServerApplication', () => {
            expect(indexExports.ServerApplication).toBeDefined();
            expect(typeof indexExports.ServerApplication).toBe('function');
        });
    });
    describe('Adapter exports', () => {
        it('should export WebSocketServerAdapter', () => {
            expect(indexExports.WebSocketServerAdapter).toBeDefined();
            expect(typeof indexExports.WebSocketServerAdapter).toBe('function');
        });
        it('should export ExtensionManagerAdapter', () => {
            expect(indexExports.ExtensionManagerAdapter).toBeDefined();
            expect(typeof indexExports.ExtensionManagerAdapter).toBe('function');
        });
        it('should export SessionManagerAdapter', () => {
            expect(indexExports.SessionManagerAdapter).toBeDefined();
            expect(typeof indexExports.SessionManagerAdapter).toBe('function');
        });
    });
    describe('Event exports', () => {
        it('should export server events', () => {
            // Check for some expected server events
            expect(indexExports.ServerStartedEvent).toBeDefined();
            expect(indexExports.ServerStoppedEvent).toBeDefined();
            expect(indexExports.ServerErrorEvent).toBeDefined();
        });
        it('should export coordination events', () => {
            // Check for some expected coordination events
            expect(indexExports.ExtensionConnectedEvent).toBeDefined();
            expect(indexExports.ExtensionDisconnectedEvent).toBeDefined();
        });
    });
    describe('Server infrastructure exports', () => {
        it('should export HttpServerAdapter', () => {
            expect(indexExports.HttpServerAdapter).toBeDefined();
            expect(typeof indexExports.HttpServerAdapter).toBe('function');
        });
        it('should export LoggingAdapter', () => {
            expect(indexExports.LoggingAdapter).toBeDefined();
            expect(typeof indexExports.LoggingAdapter).toBe('function');
        });
        it('should export CacheAdapter', () => {
            expect(indexExports.CacheAdapter).toBeDefined();
            expect(typeof indexExports.CacheAdapter).toBe('function');
        });
    });
});
//# sourceMappingURL=index.test.js.map