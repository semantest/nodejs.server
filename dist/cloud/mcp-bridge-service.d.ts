import { Application } from 'typescript-eda-application';
import { EventBus } from 'typescript-eda-infrastructure';
import { AIWorkflowRequestedEvent, WorkflowExecutionCompletedEvent } from '../core/events/cloud-events';
import { MCPClient } from './adapters/mcp-client';
import { AIModelRegistry } from './ai-model-registry';
import { WorkflowService } from './workflow-service';
import { AutomationWorkflow } from './domain/automation-workflow';
/**
 * MCP Bridge Service
 *
 * Integration service for Model Context Protocol (MCP) that enables AI-powered
 * workflow generation, optimization, and learning capabilities.
 */
export declare class MCPBridgeService extends Application {
    private mcpClient;
    private aiModelRegistry;
    private workflowService;
    constructor(eventBus: EventBus, mcpClient: MCPClient, aiModelRegistry: AIModelRegistry, workflowService: WorkflowService);
    /**
     * Handles AI workflow generation requests
     */
    handleAIWorkflowRequested(event: AIWorkflowRequestedEvent): Promise<void>;
    /**
     * Handles workflow execution completion for AI learning
     */
    handleWorkflowCompleted(event: WorkflowExecutionCompletedEvent): Promise<void>;
    /**
     * Requests workflow optimization from AI
     */
    optimizeWorkflow(workflow: AutomationWorkflow, executionHistory: any[], optimizationGoals: string[]): Promise<AutomationWorkflow | null>;
    /**
     * Generates workflow documentation using AI
     */
    generateWorkflowDocumentation(workflow: AutomationWorkflow): Promise<string | null>;
    /**
     * Enhances workflow with AI metadata
     */
    private enhanceWorkflowWithAIMetadata;
    /**
     * Attempts to repair invalid workflow using AI
     */
    private attemptWorkflowRepair;
    /**
     * Calculates quality score for workflow execution
     */
    private calculateWorkflowQualityScore;
    /**
     * Gets service health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: Record<string, any>;
    }>;
    /**
     * Gets service metrics
     */
    getMetrics(): Promise<Record<string, any>>;
}
//# sourceMappingURL=mcp-bridge-service.d.ts.map