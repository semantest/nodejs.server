"use strict";
/**
 * Tests for security middleware
 */
Object.defineProperty(exports, "__esModule", { value: true });
const security_middleware_1 = require("../infrastructure/middleware/security.middleware");
// Mock Express objects
const mockRequest = (overrides = {}) => ({
    body: {},
    params: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides
});
const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    return res;
};
const mockNext = jest.fn();
describe('Security Middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('Input Validation', () => {
        describe('URL validation', () => {
            it('should pass valid URLs', () => {
                const req = mockRequest({
                    body: { url: 'https://example.com/image.jpg' }
                });
                const res = mockResponse();
                security_middleware_1.validateInput.url(req, res, mockNext);
                expect(mockNext).toHaveBeenCalled();
                expect(res.status).not.toHaveBeenCalled();
            });
            it('should reject missing URLs', () => {
                const req = mockRequest({ body: {} });
                const res = mockResponse();
                security_middleware_1.validateInput.url(req, res, mockNext);
                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                    error: 'Validation Error',
                    message: 'URL is required and must be a string'
                }));
                expect(mockNext).not.toHaveBeenCalled();
            });
            it('should reject invalid URLs', () => {
                const req = mockRequest({
                    body: { url: 'not-a-url' }
                });
                const res = mockResponse();
                security_middleware_1.validateInput.url(req, res, mockNext);
                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                    error: 'Validation Error',
                    message: 'Invalid URL format'
                }));
            });
            it('should reject URLs that are too long', () => {
                const longUrl = 'https://example.com/' + 'a'.repeat(2048);
                const req = mockRequest({
                    body: { url: longUrl }
                });
                const res = mockResponse();
                security_middleware_1.validateInput.url(req, res, mockNext);
                expect(res.status).toHaveBeenCalledWith(400);
            });
        });
        describe('Priority validation', () => {
            it('should accept valid priorities', () => {
                const validPriorities = ['high', 'normal', 'low'];
                validPriorities.forEach(priority => {
                    const req = mockRequest({ body: { priority } });
                    const res = mockResponse();
                    jest.clearAllMocks();
                    security_middleware_1.validateInput.priority(req, res, mockNext);
                    expect(mockNext).toHaveBeenCalled();
                    expect(res.status).not.toHaveBeenCalled();
                });
            });
            it('should reject invalid priorities', () => {
                const req = mockRequest({
                    body: { priority: 'urgent' }
                });
                const res = mockResponse();
                security_middleware_1.validateInput.priority(req, res, mockNext);
                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                    error: 'Validation Error',
                    message: 'Priority must be high, normal, or low'
                }));
            });
            it('should pass when priority is omitted', () => {
                const req = mockRequest({ body: {} });
                const res = mockResponse();
                security_middleware_1.validateInput.priority(req, res, mockNext);
                expect(mockNext).toHaveBeenCalled();
                expect(res.status).not.toHaveBeenCalled();
            });
        });
        describe('ID validation', () => {
            it('should accept valid UUIDs', () => {
                const req = mockRequest({
                    params: { id: '550e8400-e29b-41d4-a716-446655440000' }
                });
                const res = mockResponse();
                security_middleware_1.validateInput.id(req, res, mockNext);
                expect(mockNext).toHaveBeenCalled();
                expect(res.status).not.toHaveBeenCalled();
            });
            it('should reject invalid IDs', () => {
                const req = mockRequest({
                    params: { id: 'not-a-uuid' }
                });
                const res = mockResponse();
                security_middleware_1.validateInput.id(req, res, mockNext);
                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                    error: 'Validation Error',
                    message: 'Invalid ID format'
                }));
            });
        });
        describe('AI Tool validation', () => {
            it('should accept valid AI tool config', () => {
                const req = mockRequest({
                    body: {
                        ai_tool: {
                            toolId: 'dall-e',
                            activationRequired: true
                        }
                    }
                });
                const res = mockResponse();
                security_middleware_1.validateInput.aiTool(req, res, mockNext);
                expect(mockNext).toHaveBeenCalled();
                expect(res.status).not.toHaveBeenCalled();
            });
            it('should reject invalid AI tool config', () => {
                const req = mockRequest({
                    body: {
                        ai_tool: {
                            toolId: 123, // Should be string
                            activationRequired: 'yes' // Should be boolean
                        }
                    }
                });
                const res = mockResponse();
                security_middleware_1.validateInput.aiTool(req, res, mockNext);
                expect(res.status).toHaveBeenCalledWith(400);
            });
        });
    });
    describe('Input Sanitization', () => {
        it('should remove null bytes and control characters', () => {
            const req = mockRequest({
                body: {
                    text: 'Hello\x00World\x01Test',
                    nested: {
                        value: 'Data\x1fEnd'
                    }
                }
            });
            const res = mockResponse();
            (0, security_middleware_1.sanitizeInput)(req, res, mockNext);
            expect(req.body.text).toBe('HelloWorldTest');
            expect(req.body.nested.value).toBe('DataEnd');
            expect(mockNext).toHaveBeenCalled();
        });
        it('should limit key length', () => {
            const longKey = 'a'.repeat(200);
            const req = mockRequest({
                body: {
                    [longKey]: 'value'
                }
            });
            const res = mockResponse();
            (0, security_middleware_1.sanitizeInput)(req, res, mockNext);
            const keys = Object.keys(req.body);
            expect(keys[0].length).toBe(128);
            expect(mockNext).toHaveBeenCalled();
        });
    });
    describe('Security Headers', () => {
        it('should set all security headers', () => {
            const req = mockRequest();
            const res = mockResponse();
            (0, security_middleware_1.securityHeaders)(req, res, mockNext);
            expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
            expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
            expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
            expect(res.setHeader).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
            expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
            expect(res.setHeader).toHaveBeenCalledWith('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
            expect(mockNext).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=security-middleware.test.js.map