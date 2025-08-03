"use strict";
/**
 * @fileoverview Developer portal service
 * @description Handles interactive API documentation, SDK generation, and developer onboarding
 * @author Web-Buddy Team
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeveloperPortalService = void 0;
const typescript_eda_stubs_1 = require("../stubs/typescript-eda-stubs");
const developer_portal_events_1 = require("../core/events/developer-portal-events");
const openapi_documentation_generator_1 = require("./adapters/openapi-documentation-generator");
const sdk_generator_1 = require("./adapters/sdk-generator");
const api_explorer_1 = require("./adapters/api-explorer");
const developer_onboarding_1 = require("./adapters/developer-onboarding");
const api_key_dashboard_1 = require("./adapters/api-key-dashboard");
/**
 * Developer portal service for API documentation and developer experience
 */
let DeveloperPortalService = class DeveloperPortalService extends typescript_eda_stubs_1.Application {
    constructor() {
        super(...arguments);
        this.metadata = new Map([
            ['name', 'Web-Buddy Developer Portal Service'],
            ['version', '1.0.0'],
            ['capabilities', 'api-docs,sdk-generation,api-explorer,developer-onboarding'],
            ['supportedLanguages', 'javascript,typescript,python,java,go,csharp,php,ruby'],
            ['documentationFormats', 'openapi,postman,insomnia,curl']
        ]);
    }
    /**
     * Handle developer portal requests
     */
    async handleDeveloperPortalRequest(event) {
        try {
            const { action, parameters } = event;
            switch (action) {
                case 'get_documentation':
                    await this.generateApiDocumentation(parameters);
                    break;
                case 'explore_api':
                    await this.launchApiExplorer(parameters);
                    break;
                case 'generate_sdk':
                    await this.generateSdk(parameters);
                    break;
                case 'onboard_developer':
                    await this.startDeveloperOnboarding(parameters);
                    break;
                case 'manage_api_keys':
                    await this.openApiKeyDashboard(parameters);
                    break;
                default:
                    throw new Error(`Unsupported developer portal action: ${action}`);
            }
        }
        catch (error) {
            console.error('❌ Developer portal request failed:', error);
            throw error;
        }
    }
    /**
     * Handle API documentation requests
     */
    async handleApiDocumentationRequest(event) {
        try {
            const { format, endpoints, options } = event;
            const documentation = await this.generateApiDocumentation({
                format,
                endpoints,
                options
            });
            console.log(`📚 Generated API documentation in ${format} format`);
            console.log(`📄 Documented ${endpoints.length} endpoints`);
        }
        catch (error) {
            console.error('❌ API documentation generation failed:', error);
            throw error;
        }
    }
    /**
     * Handle SDK generation requests
     */
    async handleSdkGenerationRequest(event) {
        try {
            const { language, version, configuration } = event;
            const sdk = await this.generateSdk({
                language,
                version,
                configuration
            });
            console.log(`🔧 Generated SDK for ${language} (version ${version})`);
        }
        catch (error) {
            console.error('❌ SDK generation failed:', error);
            throw error;
        }
    }
    /**
     * Generate API documentation
     */
    async generateApiDocumentation(parameters) {
        const { format, endpoints, options } = parameters;
        switch (format) {
            case 'openapi':
                return await this.openApiGenerator.generateOpenApiSpec(endpoints, options);
            case 'postman':
                return await this.openApiGenerator.generatePostmanCollection(endpoints, options);
            case 'insomnia':
                return await this.openApiGenerator.generateInsomniaCollection(endpoints, options);
            case 'curl':
                return await this.openApiGenerator.generateCurlExamples(endpoints, options);
            default:
                throw new Error(`Unsupported documentation format: ${format}`);
        }
    }
    /**
     * Launch API explorer
     */
    async launchApiExplorer(parameters) {
        const { endpoint, apiKey, environment } = parameters;
        await this.apiExplorer.launch({
            endpoint,
            apiKey,
            environment,
            features: [
                'live_testing',
                'parameter_validation',
                'response_inspection',
                'code_generation',
                'authentication_testing'
            ]
        });
        console.log('🚀 API Explorer launched successfully');
    }
    /**
     * Generate SDK
     */
    async generateSdk(parameters) {
        const { language, version, configuration } = parameters;
        const sdkConfig = {
            language,
            version: version || 'latest',
            packageName: configuration?.packageName || `web-buddy-${language}-sdk`,
            namespace: configuration?.namespace || 'WebBuddy',
            baseUrl: configuration?.baseUrl || 'https://api.web-buddy.com',
            authentication: configuration?.authentication || 'api_key',
            features: configuration?.features || [
                'async_support',
                'error_handling',
                'retry_logic',
                'rate_limiting',
                'logging'
            ]
        };
        return await this.sdkGenerator.generateSdk(sdkConfig);
    }
    /**
     * Start developer onboarding
     */
    async startDeveloperOnboarding(parameters) {
        const { userId, experience, goals } = parameters;
        const onboardingFlow = {
            userId,
            experience: experience || 'beginner',
            goals: goals || ['api_integration'],
            steps: [
                'welcome',
                'account_setup',
                'api_key_creation',
                'first_api_call',
                'sdk_installation',
                'sample_project',
                'documentation_tour',
                'community_intro'
            ],
            currentStep: 'welcome',
            completedSteps: [],
            startedAt: new Date(),
            estimatedDuration: 30 // minutes
        };
        await this.developerOnboarding.startOnboarding(onboardingFlow);
        console.log(`🎯 Started developer onboarding for user ${userId}`);
    }
    /**
     * Open API key dashboard
     */
    async openApiKeyDashboard(parameters) {
        const { userId, features } = parameters;
        await this.apiKeyDashboard.launch({
            userId,
            features: features || [
                'key_management',
                'usage_analytics',
                'rate_limit_monitoring',
                'billing_info',
                'quota_management',
                'team_management'
            ]
        });
        console.log(`🔑 Opened API key dashboard for user ${userId}`);
    }
    /**
     * Get available documentation formats
     */
    getAvailableDocumentationFormats() {
        return ['openapi', 'postman', 'insomnia', 'curl'];
    }
    /**
     * Get supported SDK languages
     */
    getSupportedSdkLanguages() {
        return ['javascript', 'typescript', 'python', 'java', 'go', 'csharp', 'php', 'ruby'];
    }
    /**
     * Get API endpoints for documentation
     */
    async getApiEndpoints() {
        return [
            '/api/auth/login',
            '/api/auth/register',
            '/api/auth/refresh',
            '/api/users/profile',
            '/api/users/preferences',
            '/api/automation/execute',
            '/api/automation/status',
            '/api/extensions/list',
            '/api/extensions/install',
            '/api/monitoring/health',
            '/api/monitoring/metrics'
        ];
    }
    /**
     * Get portal metrics
     */
    async getPortalMetrics() {
        return {
            totalDevelopers: await this.getTotalDevelopers(),
            activeApiKeys: await this.getActiveApiKeys(),
            documentationViews: await this.getDocumentationViews(),
            sdkDownloads: await this.getSdkDownloads(),
            apiExplorerSessions: await this.getApiExplorerSessions(),
            onboardingCompletions: await this.getOnboardingCompletions()
        };
    }
    /**
     * Get developer feedback
     */
    async getDeveloperFeedback() {
        return {
            ratings: await this.getFeedbackRatings(),
            comments: await this.getFeedbackComments(),
            suggestions: await this.getFeedbackSuggestions(),
            issues: await this.getFeedbackIssues()
        };
    }
    /**
     * Helper methods for metrics (mock implementations)
     */
    async getTotalDevelopers() {
        return 1247;
    }
    async getActiveApiKeys() {
        return 892;
    }
    async getDocumentationViews() {
        return 15634;
    }
    async getSdkDownloads() {
        return 2156;
    }
    async getApiExplorerSessions() {
        return 8743;
    }
    async getOnboardingCompletions() {
        return 934;
    }
    async getFeedbackRatings() {
        return {
            average: 4.6,
            total: 523,
            distribution: { 5: 312, 4: 156, 3: 42, 2: 8, 1: 5 }
        };
    }
    async getFeedbackComments() {
        return {
            positive: 456,
            negative: 67,
            neutral: 89
        };
    }
    async getFeedbackSuggestions() {
        return {
            total: 234,
            implemented: 89,
            pending: 145
        };
    }
    async getFeedbackIssues() {
        return {
            open: 23,
            resolved: 178,
            total: 201
        };
    }
};
exports.DeveloperPortalService = DeveloperPortalService;
__decorate([
    (0, typescript_eda_stubs_1.listen)(developer_portal_events_1.DeveloperPortalRequestedEvent),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [developer_portal_events_1.DeveloperPortalRequestedEvent]),
    __metadata("design:returntype", Promise)
], DeveloperPortalService.prototype, "handleDeveloperPortalRequest", null);
__decorate([
    (0, typescript_eda_stubs_1.listen)(developer_portal_events_1.ApiDocumentationRequestedEvent),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [developer_portal_events_1.ApiDocumentationRequestedEvent]),
    __metadata("design:returntype", Promise)
], DeveloperPortalService.prototype, "handleApiDocumentationRequest", null);
__decorate([
    (0, typescript_eda_stubs_1.listen)(developer_portal_events_1.SdkGenerationRequestedEvent),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [developer_portal_events_1.SdkGenerationRequestedEvent]),
    __metadata("design:returntype", Promise)
], DeveloperPortalService.prototype, "handleSdkGenerationRequest", null);
exports.DeveloperPortalService = DeveloperPortalService = __decorate([
    (0, typescript_eda_stubs_1.Enable)(openapi_documentation_generator_1.OpenApiDocumentationGenerator),
    (0, typescript_eda_stubs_1.Enable)(sdk_generator_1.SdkGenerator),
    (0, typescript_eda_stubs_1.Enable)(api_explorer_1.ApiExplorer),
    (0, typescript_eda_stubs_1.Enable)(developer_onboarding_1.DeveloperOnboarding),
    (0, typescript_eda_stubs_1.Enable)(api_key_dashboard_1.ApiKeyDashboard)
], DeveloperPortalService);
//# sourceMappingURL=portal-service.js.map