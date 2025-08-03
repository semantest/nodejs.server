import { Application } from 'typescript-eda-application';
import { EventBus } from 'typescript-eda-infrastructure';
import { AutomationWorkflowSubmittedEvent, ClientHeartbeatEvent } from '../core/events/cloud-events';
import { WorkflowEngine } from './workflow-engine';
import { ClientRegistry } from './client-registry';
import { SecurityService } from './security-service';
/**
 * Cloud Coordination Service
 *
 * Central orchestration service managing automation workflows across distributed clients.
 * Handles workflow submission, validation, scheduling, and execution coordination.
 */
export declare class CloudCoordinationService extends Application {
    private workflowEngine;
    private clientRegistry;
    private securityService;
    constructor(eventBus: EventBus, workflowEngine: WorkflowEngine, clientRegistry: ClientRegistry, securityService: SecurityService);
    /**
     * Handles workflow submission from clients
     */
    handleWorkflowSubmitted(event: AutomationWorkflowSubmittedEvent): Promise<void>;
    /**
     * Handles client heartbeat updates
     */
    handleClientHeartbeat(event: ClientHeartbeatEvent): Promise<void>;
    /**
     * Selects the optimal client for workflow execution
     */
    private selectOptimalClient;
    /**
     * Calculates a score for client selection
     */
    private calculateClientScore;
    /**
     * Calculates how well client capabilities match workflow requirements
     */
    private calculateCapabilityMatchScore;
    /**
     * Checks if client can execute a specific workflow
     */
    private clientCanExecute;
    /**
     * Checks if versions are compatible
     */
    private isVersionCompatible;
    /**
     * Schedules workflow execution on specific client
     */
    private scheduleWorkflowExecution;
    /**
     * Gets service health status
     */
    getHealthStatus(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: Record<string, any>;
    }>;
    /**
     * Gets service metrics for monitoring
     */
    getMetrics(): Promise<Record<string, any>>;
}
//# sourceMappingURL=coordination-service.d.ts.map