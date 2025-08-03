"use strict";
/**
 * 🧪 Tests for coordination events with Chrome API mocking
 * Implementing Chrome extension API mocks to reach 60% coverage
 */
Object.defineProperty(exports, "__esModule", { value: true });
const coordination_events_1 = require("../coordination-events");
// Chrome API Mocks
const mockChromeAPI = {
    runtime: {
        id: 'test-extension-id',
        getManifest: jest.fn(() => ({
            name: 'Test Extension',
            version: '1.0.0',
            permissions: ['tabs', 'storage', 'webNavigation']
        })),
        connect: jest.fn(() => ({
            name: 'coordination-port',
            onMessage: { addListener: jest.fn() },
            onDisconnect: { addListener: jest.fn() },
            postMessage: jest.fn()
        })),
        sendMessage: jest.fn((message, callback) => {
            if (callback)
                callback({ success: true });
        }),
        lastError: null,
        onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
        onConnect: { addListener: jest.fn(), removeListener: jest.fn() },
        onInstalled: { addListener: jest.fn() },
        onStartup: { addListener: jest.fn() }
    },
    tabs: {
        query: jest.fn((query, callback) => {
            callback([
                { id: 1, url: 'https://example.com', title: 'Test Tab', active: true },
                { id: 2, url: 'https://test.com', title: 'Another Tab', active: false }
            ]);
        }),
        create: jest.fn((createProperties, callback) => {
            callback({ id: 3, url: createProperties.url, active: true });
        }),
        update: jest.fn((tabId, updateProperties, callback) => {
            callback({ id: tabId, ...updateProperties });
        }),
        get: jest.fn((tabId, callback) => {
            callback({ id: tabId, url: 'https://example.com', title: 'Test Tab' });
        }),
        sendMessage: jest.fn((tabId, message, callback) => {
            if (callback)
                callback({ success: true });
        })
    },
    storage: {
        local: {
            get: jest.fn((keys, callback) => {
                callback({ extensionData: { connected: true } });
            }),
            set: jest.fn((items, callback) => {
                if (callback)
                    callback();
            })
        },
        sync: {
            get: jest.fn((keys, callback) => {
                callback({ preferences: { theme: 'dark' } });
            })
        }
    },
    webNavigation: {
        onCompleted: { addListener: jest.fn() },
        onErrorOccurred: { addListener: jest.fn() }
    }
};
// Browser API Mock (for Firefox/Edge compatibility)
const mockBrowserAPI = {
    ...mockChromeAPI,
    browserAction: {
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn()
    }
};
// Mock window.chrome and window.browser
global.chrome = mockChromeAPI;
global.browser = mockBrowserAPI;
describe('Coordination Events with Chrome API Mocking', () => {
    // Test data factories
    const createExtensionMetadata = () => ({
        version: '1.0.0',
        name: 'Test Extension',
        capabilities: ['automation', 'screenshot', 'pattern-recording'],
        browserInfo: {
            name: 'Chrome',
            version: '120.0.0',
            userAgent: 'Mozilla/5.0 Chrome/120.0.0',
            platform: 'Windows'
        },
        permissions: ['tabs', 'storage', 'webNavigation'],
        lastSeen: new Date()
    });
    const createConnectionInfo = () => ({
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Chrome/120.0.0',
        timestamp: new Date(),
        protocol: 'websocket',
        secure: true
    });
    const createAutomationPayload = () => ({
        action: 'click',
        target: {
            selector: '#submit-button',
            xpath: '//button[@type="submit"]',
            semanticDescription: 'Submit form button',
            elementId: 'elem-123',
            frameId: 0
        },
        parameters: {
            button: 'left',
            clickCount: 1,
            modifiers: []
        },
        options: {
            timeout: 5000,
            retries: 3,
            waitForElement: true,
            scrollIntoView: true,
            highlightElement: true
        }
    });
    describe('ExtensionConnectedEvent', () => {
        it('should create event with Chrome runtime data', () => {
            const extensionId = mockChromeAPI.runtime.id;
            const metadata = createExtensionMetadata();
            const connectionInfo = createConnectionInfo();
            const event = new coordination_events_1.ExtensionConnectedEvent(extensionId, metadata, connectionInfo);
            expect(event.type).toBe('ExtensionConnected');
            expect(event.extensionId).toBe('test-extension-id');
            expect(event.metadata.name).toBe('Test Extension');
            expect(event.metadata.capabilities).toContain('automation');
            expect(event.connectionInfo.protocol).toBe('websocket');
        });
        it('should handle Chrome manifest data', () => {
            const manifest = mockChromeAPI.runtime.getManifest();
            const metadata = {
                ...createExtensionMetadata(),
                version: manifest.version,
                name: manifest.name,
                permissions: manifest.permissions
            };
            const event = new coordination_events_1.ExtensionConnectedEvent('ext-123', metadata, createConnectionInfo());
            expect(event.metadata.permissions).toEqual(['tabs', 'storage', 'webNavigation']);
            expect(mockChromeAPI.runtime.getManifest).toHaveBeenCalled();
        });
    });
    describe('ExtensionDisconnectedEvent', () => {
        it('should create disconnection event with proper reason', () => {
            const event = new coordination_events_1.ExtensionDisconnectedEvent('ext-123', 'connection_timeout', 3600000 // 1 hour
            );
            expect(event.type).toBe('ExtensionDisconnected');
            expect(event.extensionId).toBe('ext-123');
            expect(event.reason).toBe('connection_timeout');
            expect(event.sessionDuration).toBe(3600000);
        });
        it('should support all disconnection reasons', () => {
            const reasons = [
                'client_initiated',
                'server_shutdown',
                'connection_timeout',
                'authentication_failed',
                'protocol_error',
                'rate_limit_exceeded'
            ];
            reasons.forEach(reason => {
                const event = new coordination_events_1.ExtensionDisconnectedEvent('ext-123', reason, 1000);
                expect(event.reason).toBe(reason);
            });
        });
    });
    describe('AutomationRequestReceivedEvent', () => {
        it('should create automation request with Chrome tab info', async () => {
            const tabId = 1;
            const payload = createAutomationPayload();
            const event = new coordination_events_1.AutomationRequestReceivedEvent('req-123', 'client-456', 'ext-789', tabId, payload);
            expect(event.type).toBe('AutomationRequestReceived');
            expect(event.targetTabId).toBe(1);
            expect(event.automationPayload.action).toBe('click');
            expect(event.automationPayload.target.selector).toBe('#submit-button');
            // Verify Chrome tab API can be used with this data
            mockChromeAPI.tabs.get(tabId, (tab) => {
                expect(tab.id).toBe(tabId);
            });
            expect(mockChromeAPI.tabs.get).toHaveBeenCalledWith(tabId, expect.any(Function));
        });
        it('should handle complex automation targets', () => {
            const payload = {
                action: 'fill',
                target: {
                    selector: 'input[name="email"]',
                    xpath: '//input[@type="email"]',
                    semanticDescription: 'Email input field',
                    elementId: 'email-input',
                    frameId: 2
                },
                parameters: {
                    value: 'test@example.com',
                    clearFirst: true
                },
                options: {
                    timeout: 10000,
                    retries: 5,
                    waitForElement: true,
                    scrollIntoView: false,
                    highlightElement: true
                }
            };
            const event = new coordination_events_1.AutomationRequestReceivedEvent('req-456', 'client-789', 'ext-123', 3, payload);
            expect(event.automationPayload.target.frameId).toBe(2);
            expect(event.automationPayload.parameters.value).toBe('test@example.com');
            expect(event.automationPayload.options.timeout).toBe(10000);
        });
    });
    describe('AutomationRequestRoutedEvent', () => {
        it('should create routing event with decision data', () => {
            const routingDecision = {
                selectedExtension: 'ext-primary',
                reason: 'best_capability',
                alternatives: ['ext-backup-1', 'ext-backup-2'],
                confidence: 0.95
            };
            const event = new coordination_events_1.AutomationRequestRoutedEvent('req-123', 'ext-primary', routingDecision);
            expect(event.type).toBe('AutomationRequestRouted');
            expect(event.routingDecision.confidence).toBe(0.95);
            expect(event.routingDecision.alternatives).toHaveLength(2);
        });
        it('should support all routing reasons', () => {
            const reasons = [
                'exact_match',
                'best_capability',
                'load_balancing',
                'fallback',
                'user_preference'
            ];
            reasons.forEach(reason => {
                const decision = {
                    selectedExtension: 'ext-123',
                    reason,
                    alternatives: [],
                    confidence: 1.0
                };
                const event = new coordination_events_1.AutomationRequestRoutedEvent('req-123', 'ext-123', decision);
                expect(event.routingDecision.reason).toBe(reason);
            });
        });
    });
    describe('AutomationResponseReceivedEvent', () => {
        it('should create response event with Chrome tab metadata', () => {
            const responseMetadata = {
                tabId: 1,
                url: 'https://example.com/success',
                title: 'Success Page',
                timestamp: new Date(),
                screenshotPath: '/screenshots/success-123.png',
                elementsFound: 5
            };
            const response = {
                success: true,
                result: { buttonClicked: true },
                executionTime: 1250,
                metadata: responseMetadata
            };
            const event = new coordination_events_1.AutomationResponseReceivedEvent('req-123', 'ext-456', response, 1300);
            expect(event.type).toBe('AutomationResponseReceived');
            expect(event.response.success).toBe(true);
            expect(event.response.metadata.tabId).toBe(1);
            expect(event.response.metadata.screenshotPath).toBeDefined();
            expect(event.executionTime).toBe(1300);
        });
        it('should handle error responses', () => {
            const response = {
                success: false,
                error: 'Element not found',
                executionTime: 5000,
                metadata: {
                    tabId: 2,
                    url: 'https://example.com',
                    title: 'Test Page',
                    timestamp: new Date(),
                    elementsFound: 0
                }
            };
            const event = new coordination_events_1.AutomationResponseReceivedEvent('req-456', 'ext-789', response, 5100);
            expect(event.response.success).toBe(false);
            expect(event.response.error).toBe('Element not found');
            expect(event.response.metadata.elementsFound).toBe(0);
        });
    });
    describe('AutomationRequestFailedEvent', () => {
        it('should create failure event with error details', () => {
            const error = {
                code: 'ELEMENT_NOT_FOUND',
                message: 'Could not find element with selector #missing',
                details: {
                    selector: '#missing',
                    attempts: 3,
                    lastError: 'Timeout after 5000ms'
                },
                recoverable: true,
                suggestions: [
                    'Check if the element exists',
                    'Try a different selector',
                    'Increase timeout'
                ]
            };
            const event = new coordination_events_1.AutomationRequestFailedEvent('req-123', 'ext-456', error, 2);
            expect(event.type).toBe('AutomationRequestFailed');
            expect(event.error.code).toBe('ELEMENT_NOT_FOUND');
            expect(event.error.recoverable).toBe(true);
            expect(event.error.suggestions).toHaveLength(3);
            expect(event.retryAttempt).toBe(2);
        });
    });
    describe('CoordinationSessionStartedEvent', () => {
        it('should create session start event with configuration', () => {
            const config = {
                timeout: 1800000, // 30 minutes
                maxRequests: 1000,
                enableLogging: true,
                enableMetrics: true,
                securityLevel: 'high'
            };
            const event = new coordination_events_1.CoordinationSessionStartedEvent('session-123', 'client-456', 'automation', config);
            expect(event.type).toBe('CoordinationSessionStarted');
            expect(event.sessionType).toBe('automation');
            expect(event.configuration.securityLevel).toBe('high');
            expect(event.configuration.timeout).toBe(1800000);
        });
        it('should support all session types', () => {
            const types = [
                'automation',
                'training',
                'monitoring',
                'debugging',
                'pattern_sharing'
            ];
            types.forEach(sessionType => {
                const event = new coordination_events_1.CoordinationSessionStartedEvent('session-123', 'client-456', sessionType, {
                    timeout: 60000,
                    maxRequests: 100,
                    enableLogging: false,
                    enableMetrics: false,
                    securityLevel: 'low'
                });
                expect(event.sessionType).toBe(sessionType);
            });
        });
    });
    describe('CoordinationSessionEndedEvent', () => {
        it('should create session end event with statistics', () => {
            const errorSummary = {
                code: 'TIMEOUT',
                count: 5,
                lastOccurrence: new Date()
            };
            const stats = {
                requestsProcessed: 150,
                successfulRequests: 145,
                failedRequests: 5,
                averageResponseTime: 250,
                totalDataTransferred: 1048576, // 1MB
                errorsEncountered: [errorSummary]
            };
            const event = new coordination_events_1.CoordinationSessionEndedEvent('session-123', 3600000, // 1 hour
            stats, 'completed');
            expect(event.type).toBe('CoordinationSessionEnded');
            expect(event.duration).toBe(3600000);
            expect(event.statistics.successfulRequests).toBe(145);
            expect(event.statistics.errorsEncountered).toHaveLength(1);
            expect(event.reason).toBe('completed');
        });
        it('should support all session end reasons', () => {
            const reasons = [
                'completed',
                'timeout',
                'client_disconnect',
                'server_shutdown',
                'error',
                'user_terminated'
            ];
            reasons.forEach(reason => {
                const event = new coordination_events_1.CoordinationSessionEndedEvent('session-123', 1000, {
                    requestsProcessed: 10,
                    successfulRequests: 10,
                    failedRequests: 0,
                    averageResponseTime: 100,
                    totalDataTransferred: 1024,
                    errorsEncountered: []
                }, reason);
                expect(event.reason).toBe(reason);
            });
        });
    });
    describe('ExtensionHeartbeatReceivedEvent', () => {
        it('should create heartbeat event with extension status', () => {
            const resourceUsage = {
                cpuPercent: 15.5,
                memoryMB: 256,
                networkKBps: 10.5,
                activeTabs: 5
            };
            const status = {
                isHealthy: true,
                activeConnections: 3,
                lastActivity: new Date(),
                resourceUsage,
                activePatterns: 10
            };
            const metrics = {
                requestsProcessed: 1000,
                averageResponseTime: 150,
                errorRate: 0.02,
                uptimeMinutes: 60,
                patternExecutions: 500
            };
            const event = new coordination_events_1.ExtensionHeartbeatReceivedEvent('ext-123', status, metrics);
            expect(event.type).toBe('ExtensionHeartbeatReceived');
            expect(event.status.isHealthy).toBe(true);
            expect(event.status.resourceUsage.cpuPercent).toBe(15.5);
            expect(event.metrics.errorRate).toBe(0.02);
        });
    });
    describe('ExtensionHeartbeatMissedEvent', () => {
        it('should create missed heartbeat event', () => {
            const lastSeen = new Date(Date.now() - 300000); // 5 minutes ago
            const event = new coordination_events_1.ExtensionHeartbeatMissedEvent('ext-123', 3, lastSeen);
            expect(event.type).toBe('ExtensionHeartbeatMissed');
            expect(event.extensionId).toBe('ext-123');
            expect(event.missedCount).toBe(3);
            expect(event.lastSeen).toEqual(lastSeen);
        });
    });
    describe('CoordinationErrorEvent', () => {
        it('should create error event with recovery action', () => {
            const error = new Error('WebSocket connection failed');
            const context = {
                extensionId: 'ext-123',
                sessionId: 'session-456',
                requestId: 'req-789',
                operation: 'automation_request',
                timestamp: new Date()
            };
            const recovery = {
                type: 'retry',
                description: 'Retry connection with exponential backoff',
                automatic: true,
                parameters: {
                    maxAttempts: 5,
                    backoffMs: 1000
                }
            };
            const event = new coordination_events_1.CoordinationErrorEvent(error, context, recovery);
            expect(event.type).toBe('CoordinationError');
            expect(event.error.message).toBe('WebSocket connection failed');
            expect(event.context.operation).toBe('automation_request');
            expect(event.recovery?.type).toBe('retry');
            expect(event.recovery?.automatic).toBe(true);
        });
        it('should support all recovery types', () => {
            const recoveryTypes = [
                'retry',
                'fallback',
                'circuit_breaker',
                'graceful_degradation',
                'user_intervention'
            ];
            recoveryTypes.forEach(type => {
                const recovery = {
                    type,
                    description: `Recovery: ${type}`,
                    automatic: type !== 'user_intervention'
                };
                const event = new coordination_events_1.CoordinationErrorEvent(new Error('Test'), {
                    operation: 'test',
                    timestamp: new Date()
                }, recovery);
                expect(event.recovery?.type).toBe(type);
            });
        });
    });
    describe('CoordinationMetricsUpdatedEvent', () => {
        it('should create metrics update event', () => {
            const metrics = {
                activeExtensions: 5,
                activeSessions: 25,
                requestsPerSecond: 50,
                averageResponseTime: 200,
                errorRate: 0.01,
                throughput: 1024000, // 1MB/s
                timestamp: new Date()
            };
            const event = new coordination_events_1.CoordinationMetricsUpdatedEvent(metrics, 'periodic');
            expect(event.type).toBe('CoordinationMetricsUpdated');
            expect(event.metrics.activeExtensions).toBe(5);
            expect(event.metrics.requestsPerSecond).toBe(50);
            expect(event.updateType).toBe('periodic');
        });
        it('should support all update types', () => {
            const updateTypes = [
                'realtime',
                'periodic',
                'on_demand',
                'threshold_triggered'
            ];
            updateTypes.forEach(updateType => {
                const event = new coordination_events_1.CoordinationMetricsUpdatedEvent({
                    activeExtensions: 1,
                    activeSessions: 1,
                    requestsPerSecond: 1,
                    averageResponseTime: 100,
                    errorRate: 0,
                    throughput: 1000,
                    timestamp: new Date()
                }, updateType);
                expect(event.updateType).toBe(updateType);
            });
        });
    });
    describe('Chrome API Integration Tests', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });
        it('should use Chrome runtime API for extension connection', async () => {
            // Simulate extension connecting via Chrome runtime
            const port = mockChromeAPI.runtime.connect();
            const metadata = createExtensionMetadata();
            const connectionInfo = createConnectionInfo();
            const event = new coordination_events_1.ExtensionConnectedEvent(mockChromeAPI.runtime.id, metadata, connectionInfo);
            expect(mockChromeAPI.runtime.connect).toHaveBeenCalled();
            expect(port.name).toBe('coordination-port');
            expect(event.extensionId).toBe('test-extension-id');
        });
        it('should query Chrome tabs for automation', (done) => {
            mockChromeAPI.tabs.query({ active: true }, (tabs) => {
                expect(tabs).toHaveLength(2);
                expect(tabs[0].active).toBe(true);
                const event = new coordination_events_1.AutomationRequestReceivedEvent('req-123', 'client-456', 'ext-789', tabs[0].id, createAutomationPayload());
                expect(event.targetTabId).toBe(1);
                done();
            });
        });
        it('should send messages to Chrome tabs', () => {
            const tabId = 1;
            const message = {
                type: 'automation',
                action: 'click',
                selector: '#button'
            };
            mockChromeAPI.tabs.sendMessage(tabId, message, (response) => {
                expect(response.success).toBe(true);
            });
            expect(mockChromeAPI.tabs.sendMessage).toHaveBeenCalledWith(tabId, message, expect.any(Function));
        });
        it('should use Chrome storage for extension data', (done) => {
            // Store extension connection data
            const extensionData = {
                connected: true,
                timestamp: new Date().toISOString(),
                sessionId: 'session-123'
            };
            mockChromeAPI.storage.local.set({ extensionData }, () => {
                // Retrieve stored data
                mockChromeAPI.storage.local.get(['extensionData'], (result) => {
                    expect(result.extensionData.connected).toBe(true);
                    done();
                });
            });
        });
        it('should handle Chrome runtime errors', () => {
            // Simulate Chrome runtime error
            mockChromeAPI.runtime.lastError = { message: 'Extension not found' };
            const context = {
                extensionId: 'missing-ext',
                operation: 'connection_attempt',
                timestamp: new Date()
            };
            const event = new coordination_events_1.CoordinationErrorEvent(new Error(mockChromeAPI.runtime.lastError.message), context);
            expect(event.error.message).toBe('Extension not found');
            // Clean up
            mockChromeAPI.runtime.lastError = null;
        });
    });
    describe('Browser Compatibility Tests', () => {
        it('should work with browser API (Firefox/Edge)', () => {
            const browserRuntime = mockBrowserAPI.runtime;
            expect(browserRuntime.id).toBe('test-extension-id');
            // Browser-specific APIs
            mockBrowserAPI.browserAction.setBadgeText({ text: '5' });
            expect(mockBrowserAPI.browserAction.setBadgeText).toHaveBeenCalledWith({ text: '5' });
        });
    });
});
//# sourceMappingURL=coordination-events.test.js.map