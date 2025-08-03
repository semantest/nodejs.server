/**
 * @fileoverview Developer portal service
 * @description Handles interactive API documentation, SDK generation, and developer onboarding
 * @author Web-Buddy Team
 */
import { Application } from '../stubs/typescript-eda-stubs';
import { DeveloperPortalRequestedEvent, ApiDocumentationRequestedEvent, SdkGenerationRequestedEvent } from '../core/events/developer-portal-events';
import { ApiDocumentation } from './domain/developer-portal-entities';
/**
 * Developer portal service for API documentation and developer experience
 */
export declare class DeveloperPortalService extends Application {
    readonly metadata: Map<string, string>;
    private openApiGenerator;
    private sdkGenerator;
    private apiExplorer;
    private developerOnboarding;
    private apiKeyDashboard;
    /**
     * Handle developer portal requests
     */
    handleDeveloperPortalRequest(event: DeveloperPortalRequestedEvent): Promise<void>;
    /**
     * Handle API documentation requests
     */
    handleApiDocumentationRequest(event: ApiDocumentationRequestedEvent): Promise<void>;
    /**
     * Handle SDK generation requests
     */
    handleSdkGenerationRequest(event: SdkGenerationRequestedEvent): Promise<void>;
    /**
     * Generate API documentation
     */
    generateApiDocumentation(parameters: {
        format: string;
        endpoints: string[];
        options?: any;
    }): Promise<ApiDocumentation>;
    /**
     * Launch API explorer
     */
    launchApiExplorer(parameters: {
        endpoint?: string;
        apiKey?: string;
        environment?: string;
    }): Promise<void>;
    /**
     * Generate SDK
     */
    generateSdk(parameters: {
        language: string;
        version?: string;
        configuration?: any;
    }): Promise<any>;
    /**
     * Start developer onboarding
     */
    startDeveloperOnboarding(parameters: {
        userId: string;
        experience?: string;
        goals?: string[];
    }): Promise<void>;
    /**
     * Open API key dashboard
     */
    openApiKeyDashboard(parameters: {
        userId: string;
        features?: string[];
    }): Promise<void>;
    /**
     * Get available documentation formats
     */
    getAvailableDocumentationFormats(): string[];
    /**
     * Get supported SDK languages
     */
    getSupportedSdkLanguages(): string[];
    /**
     * Get API endpoints for documentation
     */
    getApiEndpoints(): Promise<string[]>;
    /**
     * Get portal metrics
     */
    getPortalMetrics(): Promise<any>;
    /**
     * Get developer feedback
     */
    getDeveloperFeedback(): Promise<any>;
    /**
     * Helper methods for metrics (mock implementations)
     */
    private getTotalDevelopers;
    private getActiveApiKeys;
    private getDocumentationViews;
    private getSdkDownloads;
    private getApiExplorerSessions;
    private getOnboardingCompletions;
    private getFeedbackRatings;
    private getFeedbackComments;
    private getFeedbackSuggestions;
    private getFeedbackIssues;
}
//# sourceMappingURL=portal-service.d.ts.map