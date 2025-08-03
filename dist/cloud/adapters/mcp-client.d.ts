import { AutomationWorkflow } from '../domain/automation-workflow';
/**
 * MCP Client Configuration
 */
export interface MCPConfig {
    endpoint: string;
    apiKey: string;
    timeout: number;
    retryAttempts: number;
    rateLimitPerMinute: number;
}
/**
 * MCP Context Request
 */
export interface MCPContextRequest {
    modelId: string;
    workflow?: AutomationWorkflow;
    capabilities?: any[];
    constraints?: Record<string, any>;
    examples?: any[];
    preferences?: Record<string, any>;
    executionHistory?: any[];
    optimizationGoals?: string[];
}
/**
 * MCP Context Response
 */
export interface MCPContext {
    id: string;
    modelId: string;
    createdAt: Date;
    expiresAt: Date;
    confidence: number;
    capabilities: string[];
}
export declare class MCPContextHelper {
    static fromJSON(data: any): MCPContext;
}
/**
 * MCP Workflow Request
 */
export interface MCPWorkflowRequest {
    contextId: string;
    objective: string;
    domain: string;
    examples?: any[];
    preferences?: Record<string, any>;
    optimizationGoals?: string[];
}
/**
 * MCP Feedback Data
 */
export interface MCPFeedback {
    workflowId: string;
    modelId: string;
    contextId: string;
    success: boolean;
    performance: {
        executionTime: number;
        resourceUsage: Record<string, number>;
        errorRate: number;
        stepSuccessRate: number;
    };
    issues: string[];
    improvements: string[];
    qualityScore: number;
    userSatisfaction?: number;
}
/**
 * MCP Client for AI Integration
 *
 * Provides communication with Model Context Protocol (MCP) services
 * for AI-powered workflow generation, optimization, and learning.
 */
export declare class MCPClient {
    private config;
    private httpClient;
    private rateLimiter;
    constructor(config: MCPConfig);
    /**
     * Creates a new MCP context for AI operations
     */
    createContext(request: MCPContextRequest): Promise<MCPContext>;
    /**
     * Generates a new workflow using AI
     */
    generateWorkflow(request: MCPWorkflowRequest): Promise<AutomationWorkflow>;
    /**
     * Optimizes an existing workflow using AI
     */
    optimizeWorkflow(request: {
        contextId: string;
        currentWorkflow: AutomationWorkflow;
        executionHistory: any[];
        optimizationGoals: string[];
        constraints?: Record<string, any>;
    }): Promise<AutomationWorkflow>;
    /**
     * Repairs a workflow with validation errors using AI
     */
    repairWorkflow(request: {
        contextId: string;
        workflow: AutomationWorkflow;
        errors: string[];
        repairStrategy: 'conservative' | 'aggressive';
    }): Promise<AutomationWorkflow>;
    /**
     * Generates documentation for a workflow using AI
     */
    generateDocumentation(request: {
        contextId: string;
        workflow: AutomationWorkflow;
        format: 'markdown' | 'html' | 'plain';
        includeExamples: boolean;
        includePerformanceNotes: boolean;
    }): Promise<string>;
    /**
     * Provides feedback to AI model for learning
     */
    provideFeedback(feedback: MCPFeedback): Promise<void>;
    /**
     * Deletes an MCP context
     */
    deleteContext(contextId: string): Promise<void>;
    /**
     * Gets health status of MCP service
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: Record<string, any>;
    }>;
    /**
     * Gets MCP service metrics
     */
    getMetrics(): Promise<Record<string, any>>;
    /**
     * Sets up HTTP interceptors for logging and error handling
     */
    private setupInterceptors;
    /**
     * Checks rate limit for operation
     */
    private checkRateLimit;
    /**
     * Serializes workflow for API transmission
     */
    private serializeWorkflow;
    /**
     * Deserializes workflow from API response
     */
    private deserializeWorkflow;
    /**
     * Handles and logs errors
     */
    private handleError;
    /**
     * Gets current rate limit usage
     */
    private getRateLimitUsage;
    /**
     * Gets total request count
     */
    private getTotalRequests;
    /**
     * Gets last request timestamp
     */
    private getLastRequestTime;
}
//# sourceMappingURL=mcp-client.d.ts.map