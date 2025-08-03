"use strict";
/**
 * Tests for Developer Portal Events
 * Testing all developer portal event classes
 */
Object.defineProperty(exports, "__esModule", { value: true });
const developer_portal_events_1 = require("../developer-portal-events");
describe('Developer Portal Events', () => {
    describe('DeveloperPortalRequestedEvent', () => {
        it('should create event with all actions', () => {
            const actions = [
                'get_documentation',
                'explore_api',
                'generate_sdk',
                'onboard_developer',
                'manage_api_keys'
            ];
            actions.forEach(action => {
                const event = new developer_portal_events_1.DeveloperPortalRequestedEvent(action, { test: 'params' }, {
                    userId: 'user-123',
                    requestId: 'req-123',
                    timestamp: new Date('2024-01-01')
                });
                expect(event.action).toBe(action);
                expect(event.parameters).toEqual({ test: 'params' });
                expect(event.metadata).toEqual({
                    userId: 'user-123',
                    requestId: 'req-123',
                    timestamp: new Date('2024-01-01')
                });
            });
        });
        it('should create event without metadata', () => {
            const event = new developer_portal_events_1.DeveloperPortalRequestedEvent('get_documentation', { endpoint: '/api/users' });
            expect(event.action).toBe('get_documentation');
            expect(event.parameters).toEqual({ endpoint: '/api/users' });
            expect(event.metadata).toBeUndefined();
        });
    });
    describe('ApiDocumentationRequestedEvent', () => {
        it('should create event with all formats', () => {
            const formats = [
                'openapi',
                'postman',
                'insomnia',
                'curl'
            ];
            formats.forEach(format => {
                const event = new developer_portal_events_1.ApiDocumentationRequestedEvent(format, ['/api/users', '/api/items'], {
                    includeExamples: true,
                    includeSchemas: true,
                    includeAuth: true,
                    version: '1.0.0'
                }, {
                    userId: 'user-123',
                    requestId: 'req-123',
                    timestamp: new Date('2024-01-01')
                });
                expect(event.format).toBe(format);
                expect(event.endpoints).toEqual(['/api/users', '/api/items']);
                expect(event.options?.includeExamples).toBe(true);
            });
        });
        it('should create event without optional fields', () => {
            const event = new developer_portal_events_1.ApiDocumentationRequestedEvent('openapi', ['/api/users']);
            expect(event.format).toBe('openapi');
            expect(event.endpoints).toEqual(['/api/users']);
            expect(event.options).toBeUndefined();
            expect(event.metadata).toBeUndefined();
        });
    });
    describe('SdkGenerationRequestedEvent', () => {
        it('should create event with full configuration', () => {
            const event = new developer_portal_events_1.SdkGenerationRequestedEvent('javascript', '1.0.0', {
                packageName: 'api-sdk',
                namespace: 'ApiClient',
                baseUrl: 'https://api.example.com',
                authentication: 'bearer',
                features: ['retry', 'caching']
            }, {
                userId: 'user-123',
                requestId: 'req-123',
                timestamp: new Date('2024-01-01')
            });
            expect(event.language).toBe('javascript');
            expect(event.version).toBe('1.0.0');
            expect(event.configuration.packageName).toBe('api-sdk');
            expect(event.configuration.features).toEqual(['retry', 'caching']);
        });
        it('should create event with minimal configuration', () => {
            const event = new developer_portal_events_1.SdkGenerationRequestedEvent('python', '2.0.0', {});
            expect(event.language).toBe('python');
            expect(event.version).toBe('2.0.0');
            expect(event.configuration).toEqual({});
            expect(event.metadata).toBeUndefined();
        });
    });
    describe('ApiExplorerSessionStartedEvent', () => {
        it('should create event with all fields', () => {
            const event = new developer_portal_events_1.ApiExplorerSessionStartedEvent('session-123', 'user-123', '/api/users', {
                apiKey: 'test-key',
                environment: 'sandbox',
                features: ['auto-complete', 'request-history']
            }, {
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                timestamp: new Date('2024-01-01')
            });
            expect(event.sessionId).toBe('session-123');
            expect(event.userId).toBe('user-123');
            expect(event.endpoint).toBe('/api/users');
            expect(event.configuration.apiKey).toBe('test-key');
            expect(event.metadata.ipAddress).toBe('192.168.1.1');
        });
    });
    describe('ApiTestExecutedEvent', () => {
        it('should create successful test event', () => {
            const event = new developer_portal_events_1.ApiTestExecutedEvent('session-123', '/api/users', 'GET', { page: 1, limit: 10 }, {
                success: true,
                statusCode: 200,
                responseTime: 150,
            }, {
                userId: 'user-123',
                timestamp: new Date('2024-01-01')
            });
            expect(event.sessionId).toBe('session-123');
            expect(event.method).toBe('GET');
            expect(event.result.success).toBe(true);
            expect(event.result.statusCode).toBe(200);
            expect(event.result.error).toBeUndefined();
        });
        it('should create failed test event', () => {
            const event = new developer_portal_events_1.ApiTestExecutedEvent('session-123', '/api/users', 'POST', { name: 'Test User' }, {
                success: false,
                statusCode: 400,
                responseTime: 50,
                error: 'Invalid request body'
            }, {
                timestamp: new Date('2024-01-01')
            });
            expect(event.result.success).toBe(false);
            expect(event.result.error).toBe('Invalid request body');
            expect(event.metadata.userId).toBeUndefined();
        });
    });
    describe('DeveloperOnboardingStartedEvent', () => {
        it('should create event with flow details', () => {
            const event = new developer_portal_events_1.DeveloperOnboardingStartedEvent('user-123', {
                experience: 'beginner',
                goals: ['learn-api', 'build-app'],
                steps: ['register', 'create-api-key', 'first-call', 'explore-docs'],
                estimatedDuration: 1800
            }, {
                referralSource: 'google',
                timestamp: new Date('2024-01-01')
            });
            expect(event.userId).toBe('user-123');
            expect(event.flow.experience).toBe('beginner');
            expect(event.flow.goals).toContain('learn-api');
            expect(event.flow.estimatedDuration).toBe(1800);
            expect(event.metadata.referralSource).toBe('google');
        });
    });
    describe('OnboardingStepCompletedEvent', () => {
        it('should create event with next step', () => {
            const event = new developer_portal_events_1.OnboardingStepCompletedEvent('user-123', 'step-1', 'Create API Key', 120, 'step-2', {
                feedback: 'Easy to follow',
                difficulty: 'easy',
                timestamp: new Date('2024-01-01')
            });
            expect(event.stepId).toBe('step-1');
            expect(event.stepName).toBe('Create API Key');
            expect(event.completionTime).toBe(120);
            expect(event.nextStep).toBe('step-2');
            expect(event.metadata?.feedback).toBe('Easy to follow');
        });
        it('should create event without next step', () => {
            const event = new developer_portal_events_1.OnboardingStepCompletedEvent('user-123', 'final-step', 'Complete Onboarding', 60);
            expect(event.stepId).toBe('final-step');
            expect(event.nextStep).toBeUndefined();
            expect(event.metadata).toBeUndefined();
        });
    });
    describe('ApiKeyDashboardAccessedEvent', () => {
        it('should create event with features', () => {
            const event = new developer_portal_events_1.ApiKeyDashboardAccessedEvent('user-123', ['create', 'view', 'rotate', 'delete'], {
                ipAddress: '192.168.1.1',
                userAgent: 'Chrome/120',
                timestamp: new Date('2024-01-01')
            });
            expect(event.userId).toBe('user-123');
            expect(event.features).toHaveLength(4);
            expect(event.features).toContain('rotate');
            expect(event.metadata.userAgent).toBe('Chrome/120');
        });
    });
    describe('DocumentationViewedEvent', () => {
        it('should create event with referrer', () => {
            const event = new developer_portal_events_1.DocumentationViewedEvent('doc-123', '/api/users', 'openapi', 300, {
                userId: 'user-123',
                referrer: 'https://google.com',
                timestamp: new Date('2024-01-01')
            });
            expect(event.documentationId).toBe('doc-123');
            expect(event.viewDuration).toBe(300);
            expect(event.metadata.referrer).toBe('https://google.com');
        });
    });
    describe('SdkDownloadedEvent', () => {
        it('should create event with all fields', () => {
            const event = new developer_portal_events_1.SdkDownloadedEvent('javascript', '1.2.3', 'api-sdk-js', 'https://downloads.example.com/sdk-1.2.3.zip', {
                userId: 'user-123',
                ipAddress: '192.168.1.1',
                userAgent: 'npm/8.0.0',
                timestamp: new Date('2024-01-01')
            });
            expect(event.language).toBe('javascript');
            expect(event.version).toBe('1.2.3');
            expect(event.packageName).toBe('api-sdk-js');
            expect(event.downloadUrl).toBe('https://downloads.example.com/sdk-1.2.3.zip');
            expect(event.metadata.userAgent).toBe('npm/8.0.0');
        });
    });
    describe('TutorialStartedEvent', () => {
        it('should create event with referral source', () => {
            const event = new developer_portal_events_1.TutorialStartedEvent('tutorial-1', 'user-123', 'Getting Started with API', 'beginner', 900, {
                referralSource: 'dashboard',
                timestamp: new Date('2024-01-01')
            });
            expect(event.tutorialId).toBe('tutorial-1');
            expect(event.tutorialTitle).toBe('Getting Started with API');
            expect(event.difficulty).toBe('beginner');
            expect(event.estimatedDuration).toBe(900);
            expect(event.metadata.referralSource).toBe('dashboard');
        });
    });
    describe('TutorialCompletedEvent', () => {
        it('should create event with feedback', () => {
            const event = new developer_portal_events_1.TutorialCompletedEvent('tutorial-1', 'user-123', 750, {
                rating: 5,
                comment: 'Very helpful!',
                difficulty: 'just-right'
            }, {
                timestamp: new Date('2024-01-01')
            });
            expect(event.completionTime).toBe(750);
            expect(event.feedback?.rating).toBe(5);
            expect(event.feedback?.difficulty).toBe('just-right');
        });
        it('should create event without feedback', () => {
            const event = new developer_portal_events_1.TutorialCompletedEvent('tutorial-1', 'user-123', 600);
            expect(event.completionTime).toBe(600);
            expect(event.feedback).toBeUndefined();
            expect(event.metadata).toBeUndefined();
        });
    });
    describe('CommunityPostCreatedEvent', () => {
        it('should create event with tags', () => {
            const event = new developer_portal_events_1.CommunityPostCreatedEvent('post-123', 'user-123', 'How to handle rate limiting?', 'questions', 'question', ['rate-limiting', 'best-practices', 'api'], {
                timestamp: new Date('2024-01-01')
            });
            expect(event.postId).toBe('post-123');
            expect(event.title).toBe('How to handle rate limiting?');
            expect(event.category).toBe('questions');
            expect(event.tags).toHaveLength(3);
            expect(event.tags).toContain('rate-limiting');
        });
    });
    describe('SupportTicketCreatedEvent', () => {
        it('should create event with priority', () => {
            const event = new developer_portal_events_1.SupportTicketCreatedEvent('ticket-123', 'user-123', 'API returns 500 error', 'technical', 'high', {
                ipAddress: '192.168.1.1',
                userAgent: 'Chrome/120',
                timestamp: new Date('2024-01-01')
            });
            expect(event.ticketId).toBe('ticket-123');
            expect(event.subject).toBe('API returns 500 error');
            expect(event.priority).toBe('high');
            expect(event.metadata.ipAddress).toBe('192.168.1.1');
        });
    });
    describe('DeveloperFeedbackSubmittedEvent', () => {
        it('should create rating feedback', () => {
            const event = new developer_portal_events_1.DeveloperFeedbackSubmittedEvent('feedback-1', 'user-123', 'rating', {
                rating: 4,
                comment: 'Good API, needs better docs',
                category: 'documentation'
            }, {
                page: '/docs/api',
                feature: 'api-reference'
            }, {
                timestamp: new Date('2024-01-01')
            });
            expect(event.type).toBe('rating');
            expect(event.content.rating).toBe(4);
            expect(event.context.page).toBe('/docs/api');
        });
        it('should create bug report feedback', () => {
            const event = new developer_portal_events_1.DeveloperFeedbackSubmittedEvent('feedback-2', 'user-123', 'bug_report', {
                comment: 'SDK throws error on init',
                category: 'sdk'
            }, {
                endpoint: '/api/auth'
            }, {
                timestamp: new Date('2024-01-01')
            });
            expect(event.type).toBe('bug_report');
            expect(event.content.comment).toBe('SDK throws error on init');
            expect(event.context.endpoint).toBe('/api/auth');
        });
    });
    describe('ApiChangelogUpdatedEvent', () => {
        it('should create event with changes', () => {
            const event = new developer_portal_events_1.ApiChangelogUpdatedEvent('2.0.0', [
                {
                    type: 'breaking',
                    title: 'Changed authentication method',
                    description: 'Moved from API keys to OAuth2',
                    endpoints: ['/api/auth', '/api/users'],
                    impact: 'high'
                },
                {
                    type: 'feature',
                    title: 'Added pagination',
                    description: 'All list endpoints now support pagination',
                    endpoints: ['/api/users', '/api/items'],
                    impact: 'low'
                }
            ], new Date('2024-01-15'), {
                publishedBy: 'admin-user',
                timestamp: new Date('2024-01-01')
            });
            expect(event.version).toBe('2.0.0');
            expect(event.changes).toHaveLength(2);
            expect(event.changes[0].type).toBe('breaking');
            expect(event.changes[0].impact).toBe('high');
            expect(event.releaseDate).toEqual(new Date('2024-01-15'));
        });
    });
    describe('DeveloperPortalAnalyticsRequestedEvent', () => {
        it('should create event with filters', () => {
            const event = new developer_portal_events_1.DeveloperPortalAnalyticsRequestedEvent('monthly', new Date('2024-01-01'), new Date('2024-01-31'), ['api-calls', 'errors', 'latency'], {
                userId: 'user-123',
                endpoint: '/api/users',
                language: 'javascript'
            }, {
                requestId: 'analytics-req-123',
                timestamp: new Date('2024-01-01')
            });
            expect(event.period).toBe('monthly');
            expect(event.metrics).toContain('api-calls');
            expect(event.filters?.userId).toBe('user-123');
            expect(event.filters?.language).toBe('javascript');
        });
        it('should create event without filters', () => {
            const event = new developer_portal_events_1.DeveloperPortalAnalyticsRequestedEvent('daily', new Date('2024-01-01'), new Date('2024-01-01'), ['api-calls']);
            expect(event.period).toBe('daily');
            expect(event.filters).toBeUndefined();
            expect(event.metadata).toBeUndefined();
        });
    });
    describe('CodeSampleExecutedEvent', () => {
        it('should create successful execution event', () => {
            const event = new developer_portal_events_1.CodeSampleExecutedEvent('sample-1', 'javascript', '/api/users', true, 250, undefined, {
                userId: 'user-123',
                timestamp: new Date('2024-01-01')
            });
            expect(event.sampleId).toBe('sample-1');
            expect(event.success).toBe(true);
            expect(event.executionTime).toBe(250);
            expect(event.error).toBeUndefined();
        });
        it('should create failed execution event', () => {
            const event = new developer_portal_events_1.CodeSampleExecutedEvent('sample-2', 'python', '/api/auth', false, 50, 'Authentication failed');
            expect(event.success).toBe(false);
            expect(event.error).toBe('Authentication failed');
            expect(event.metadata).toBeUndefined();
        });
    });
    describe('DeveloperPortalConfigurationUpdatedEvent', () => {
        it('should create event with changes', () => {
            const event = new developer_portal_events_1.DeveloperPortalConfigurationUpdatedEvent('api-settings', {
                rateLimit: { from: 100, to: 200 },
                authentication: { from: 'api-key', to: 'oauth2' }
            }, {
                updatedBy: 'admin-123',
                timestamp: new Date('2024-01-01')
            });
            expect(event.section).toBe('api-settings');
            expect(event.changes.rateLimit).toEqual({ from: 100, to: 200 });
            expect(event.metadata.updatedBy).toBe('admin-123');
        });
    });
});
//# sourceMappingURL=developer-portal-events.test.js.map