"use strict";
/**
 * 🧪 Tests for Performance Metrics Collection System
 * Testing metrics collection, aggregation, and reporting functionality
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const performance_metrics_1 = require("../performance-metrics");
const os = __importStar(require("os"));
const perf_hooks_1 = require("perf_hooks");
// Mock dependencies
jest.mock('os');
jest.mock('perf_hooks');
jest.mock('../structured-logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        performance: jest.fn()
    }
}));
describe('PerformanceMetrics', () => {
    let metrics;
    let mockPerformanceObserver;
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        // Mock PerformanceObserver
        mockPerformanceObserver = jest.fn();
        perf_hooks_1.PerformanceObserver = mockPerformanceObserver;
        mockPerformanceObserver.mockImplementation(() => ({
            observe: jest.fn(),
            disconnect: jest.fn()
        }));
        // Mock os module
        os.cpus.mockReturnValue([
            { times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 } },
            { times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 } }
        ]);
        os.loadavg.mockReturnValue([1.5, 1.2, 1.0]);
        os.totalmem.mockReturnValue(8 * 1024 * 1024 * 1024);
        os.freemem.mockReturnValue(4 * 1024 * 1024 * 1024);
        metrics = new performance_metrics_1.PerformanceMetrics(1000); // 1 second interval for testing
    });
    afterEach(() => {
        metrics.stop();
        jest.useRealTimers();
    });
    describe('Lifecycle', () => {
        it('should start metrics collection', () => {
            metrics.start();
            expect(metrics['isCollecting']).toBe(true);
            expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
        });
        it('should not start if already collecting', () => {
            metrics.start();
            const intervalCount = setInterval.mock.calls.length;
            metrics.start();
            expect(setInterval.mock.calls.length).toBe(intervalCount);
        });
        it('should stop metrics collection', () => {
            metrics.start();
            metrics.stop();
            expect(metrics['isCollecting']).toBe(false);
            expect(clearInterval).toHaveBeenCalled();
        });
        it('should clear all metrics', () => {
            metrics.increment('test.counter', 5);
            metrics.gauge('test.gauge', 42);
            metrics.timing('test.timing', 100);
            metrics.clear();
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.counters).toEqual({});
            expect(allMetrics.gauges).toEqual({});
            expect(allMetrics.timers).toEqual({});
        });
    });
    describe('Counter Metrics', () => {
        it('should increment counter', () => {
            metrics.increment('test.counter');
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.counters['test.counter']).toBe(1);
        });
        it('should increment counter by value', () => {
            metrics.increment('test.counter', 5);
            metrics.increment('test.counter', 3);
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.counters['test.counter']).toBe(8);
        });
        it('should increment counter with tags', () => {
            metrics.increment('api.requests', 1, { endpoint: '/users', method: 'GET' });
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.counters['api.requests']).toBe(1);
        });
        it('should decrement counter', () => {
            metrics.increment('test.counter', 10);
            metrics.decrement('test.counter', 3);
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.counters['test.counter']).toBe(7);
        });
    });
    describe('Gauge Metrics', () => {
        it('should set gauge value', () => {
            metrics.gauge('memory.usage', 75.5);
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.gauges['memory.usage']).toBe(75.5);
        });
        it('should update gauge value', () => {
            metrics.gauge('cpu.usage', 50);
            metrics.gauge('cpu.usage', 60);
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.gauges['cpu.usage']).toBe(60);
        });
        it('should set gauge with tags', () => {
            metrics.gauge('queue.size', 100, { queue: 'processing' });
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.gauges['queue.size']).toBe(100);
        });
    });
    describe('Timing Metrics', () => {
        it('should record timing', () => {
            metrics.timing('api.response', 150);
            const summary = metrics.getMetricSummary('api.response');
            expect(summary).toBeDefined();
            expect(summary.count).toBe(1);
            expect(summary.avg).toBe(150);
            expect(summary.min).toBe(150);
            expect(summary.max).toBe(150);
        });
        it('should aggregate multiple timings', () => {
            metrics.timing('api.response', 100);
            metrics.timing('api.response', 200);
            metrics.timing('api.response', 300);
            const summary = metrics.getMetricSummary('api.response');
            expect(summary.count).toBe(3);
            expect(summary.avg).toBe(200);
            expect(summary.min).toBe(100);
            expect(summary.max).toBe(300);
        });
        it('should calculate percentiles', () => {
            // Add 100 timing values
            for (let i = 1; i <= 100; i++) {
                metrics.timing('api.response', i);
            }
            const summary = metrics.getMetricSummary('api.response');
            expect(summary.p50).toBe(50);
            expect(summary.p90).toBe(90);
            expect(summary.p95).toBe(95);
            expect(summary.p99).toBe(99);
        });
        it('should start and stop timer', () => {
            const stop = metrics.startTimer('operation');
            // Simulate some delay
            jest.advanceTimersByTime(150);
            stop();
            const summary = metrics.getMetricSummary('operation');
            expect(summary).toBeDefined();
            expect(summary.count).toBe(1);
        });
    });
    describe('Histogram Metrics', () => {
        it('should record histogram values', () => {
            metrics.histogram('response.size', 1024);
            metrics.histogram('response.size', 2048);
            metrics.histogram('response.size', 512);
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.histograms['response.size']).toHaveLength(3);
        });
    });
    describe('HTTP Metrics', () => {
        it('should record HTTP request metrics', () => {
            metrics.recordHttpRequest('GET', '/api/users', 200, 150, 1024);
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.counters['http.request.count']).toBe(1);
            expect(allMetrics.counters['http.request.success']).toBe(1);
            expect(allMetrics.gauges['http.request.size.bytes']).toBe(1024);
            const timingSummary = metrics.getMetricSummary('http.request.duration');
            expect(timingSummary.count).toBe(1);
            expect(timingSummary.avg).toBe(150);
        });
        it('should record HTTP error metrics', () => {
            metrics.recordHttpRequest('POST', '/api/users', 500, 50, 512);
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.counters['http.request.error']).toBe(1);
        });
        it('should record client errors separately', () => {
            metrics.recordHttpRequest('GET', '/api/invalid', 404, 10, 128);
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.counters['http.request.client_error']).toBe(1);
        });
    });
    describe('WebSocket Metrics', () => {
        it('should record WebSocket connection', () => {
            metrics.recordWebSocketConnection('connect');
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.counters['websocket.connect']).toBe(1);
            expect(allMetrics.gauges['websocket.active']).toBe(1);
        });
        it('should record WebSocket disconnection', () => {
            metrics.recordWebSocketConnection('connect');
            metrics.recordWebSocketConnection('disconnect');
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.counters['websocket.disconnect']).toBe(1);
            expect(allMetrics.gauges['websocket.active']).toBe(0);
        });
        it('should record WebSocket message', () => {
            metrics.recordWebSocketMessage('send', 256);
            metrics.recordWebSocketMessage('receive', 512);
            const allMetrics = metrics.getAllMetrics();
            expect(allMetrics.counters['websocket.message.send']).toBe(1);
            expect(allMetrics.counters['websocket.message.receive']).toBe(1);
            expect(allMetrics.counters['websocket.bytes.sent']).toBe(256);
            expect(allMetrics.counters['websocket.bytes.received']).toBe(512);
        });
    });
    describe('System Metrics', () => {
        it('should get system metrics', () => {
            const systemMetrics = metrics.getSystemMetrics();
            expect(systemMetrics.cpu.usage).toBeGreaterThanOrEqual(0);
            expect(systemMetrics.cpu.loadAverage).toHaveLength(3);
            expect(systemMetrics.memory.total).toBe(8 * 1024 * 1024 * 1024);
            expect(systemMetrics.memory.free).toBe(4 * 1024 * 1024 * 1024);
            expect(systemMetrics.memory.used).toBe(4 * 1024 * 1024 * 1024);
            expect(systemMetrics.uptime).toBeGreaterThanOrEqual(0);
        });
    });
    describe('Business Metrics', () => {
        it('should get business metrics summary', () => {
            // Set up some business metrics
            metrics.recordHttpRequest('GET', '/api/users', 200, 100, 1024);
            metrics.recordHttpRequest('POST', '/api/users', 201, 150, 2048);
            metrics.recordHttpRequest('GET', '/api/users/1', 404, 50, 128);
            metrics.recordWebSocketConnection('connect');
            metrics.recordWebSocketMessage('send', 256);
            metrics.increment('auth.attempt');
            metrics.increment('auth.success');
            const businessMetrics = metrics.getBusinessMetrics();
            expect(businessMetrics.apiRequests.total).toBe(3);
            expect(businessMetrics.apiRequests.errors).toBe(1);
            expect(businessMetrics.websocketConnections.active).toBe(1);
            expect(businessMetrics.authentication.attempts).toBe(1);
            expect(businessMetrics.authentication.successes).toBe(1);
        });
    });
    describe('Prometheus Export', () => {
        it('should export metrics in Prometheus format', () => {
            metrics.increment('test_counter', 5);
            metrics.gauge('test_gauge', 42.5);
            metrics.timing('test_timing', 100);
            metrics.timing('test_timing', 200);
            const prometheusOutput = metrics.exportPrometheusMetrics();
            expect(prometheusOutput).toContain('# TYPE test_counter counter');
            expect(prometheusOutput).toContain('test_counter 5');
            expect(prometheusOutput).toContain('# TYPE test_gauge gauge');
            expect(prometheusOutput).toContain('test_gauge 42.5');
            expect(prometheusOutput).toContain('# TYPE test_timing summary');
            expect(prometheusOutput).toContain('test_timing_count 2');
            expect(prometheusOutput).toContain('test_timing_sum 300');
        });
    });
    describe('Metrics Emission', () => {
        it('should emit metrics event periodically', () => {
            const metricsHandler = jest.fn();
            metrics.on('metrics', metricsHandler);
            metrics.start();
            // Advance timer to trigger emission
            jest.advanceTimersByTime(1000);
            expect(metricsHandler).toHaveBeenCalledWith(expect.objectContaining({
                timestamp: expect.any(Number),
                system: expect.any(Object),
                business: expect.any(Object),
                counters: expect.any(Object),
                gauges: expect.any(Object),
                timers: expect.any(Object)
            }));
        });
    });
});
describe('Express Middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    beforeEach(() => {
        jest.clearAllMocks();
        mockReq = {
            method: 'GET',
            url: '/api/test',
            get: jest.fn((header) => {
                if (header === 'content-length')
                    return '1024';
                return undefined;
            })
        };
        mockRes = {
            statusCode: 200,
            on: jest.fn((event, handler) => {
                if (event === 'finish') {
                    // Simulate response finish after some time
                    setTimeout(handler, 100);
                }
            }),
            get: jest.fn((header) => {
                if (header === 'content-length')
                    return '2048';
                return undefined;
            })
        };
        mockNext = jest.fn();
    });
    describe('metricsMiddleware', () => {
        it('should track HTTP request metrics', (done) => {
            (0, performance_metrics_1.metricsMiddleware)(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalled();
            // Wait for response to finish
            setTimeout(() => {
                expect(performance_metrics_1.performanceMetrics.recordHttpRequest).toHaveBeenCalledWith('GET', '/api/test', 200, expect.any(Number), 2048);
                done();
            }, 150);
        });
        it('should handle missing content-length', (done) => {
            mockRes.get = jest.fn(() => undefined);
            (0, performance_metrics_1.metricsMiddleware)(mockReq, mockRes, mockNext);
            setTimeout(() => {
                expect(performance_metrics_1.performanceMetrics.recordHttpRequest).toHaveBeenCalledWith('GET', '/api/test', 200, expect.any(Number), 0);
                done();
            }, 150);
        });
    });
    describe('websocketMetricsMiddleware', () => {
        it('should track WebSocket connection', () => {
            const mockSocket = {
                on: jest.fn()
            };
            const wsNext = jest.fn();
            (0, performance_metrics_1.websocketMetricsMiddleware)(mockSocket, wsNext);
            expect(performance_metrics_1.performanceMetrics.recordWebSocketConnection).toHaveBeenCalledWith('connect');
            expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
            expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
            expect(wsNext).toHaveBeenCalled();
        });
        it('should track WebSocket messages', () => {
            const mockSocket = {
                on: jest.fn()
            };
            const wsNext = jest.fn();
            (0, performance_metrics_1.websocketMetricsMiddleware)(mockSocket, wsNext);
            // Get the message handler
            const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message')[1];
            // Simulate incoming message
            const testData = Buffer.from('test message');
            messageHandler(testData);
            expect(performance_metrics_1.performanceMetrics.recordWebSocketMessage).toHaveBeenCalledWith('receive', 12);
        });
        it('should track WebSocket disconnection', () => {
            const mockSocket = {
                on: jest.fn()
            };
            const wsNext = jest.fn();
            (0, performance_metrics_1.websocketMetricsMiddleware)(mockSocket, wsNext);
            // Get the close handler
            const closeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'close')[1];
            // Simulate close
            closeHandler();
            expect(performance_metrics_1.performanceMetrics.recordWebSocketConnection).toHaveBeenCalledWith('disconnect');
        });
    });
});
describe('Default Instance', () => {
    it('should export default performanceMetrics instance', () => {
        expect(performance_metrics_1.performanceMetrics).toBeDefined();
        expect(performance_metrics_1.performanceMetrics).toBeInstanceOf(performance_metrics_1.PerformanceMetrics);
    });
});
//# sourceMappingURL=performance-metrics.test.js.map