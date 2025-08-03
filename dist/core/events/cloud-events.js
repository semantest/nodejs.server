"use strict";
/*
 * Copyright (C) 2024-present Semantest, rydnr
 *
 * This file is part of @semantest/nodejs.server.
 *
 * @semantest/nodejs.server is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * @semantest/nodejs.server is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with @semantest/nodejs.server. If not, see <https://www.gnu.org/licenses/>.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityValidationEvent = exports.ClientDisconnectedEvent = exports.ClientConnectedEvent = exports.AIWorkflowGenerationFailedEvent = exports.AIWorkflowGeneratedEvent = exports.AIWorkflowRequestedEvent = exports.WorkflowExecutionCompletedEvent = exports.ClientHeartbeatEvent = exports.WorkflowQueuedEvent = exports.WorkflowRejectedEvent = exports.WorkflowScheduledEvent = exports.AutomationWorkflowSubmittedEvent = void 0;
const typescript_eda_domain_1 = require("typescript-eda-domain");
/**
 * Event fired when an automation workflow is submitted for execution
 */
class AutomationWorkflowSubmittedEvent extends typescript_eda_domain_1.Event {
    constructor(workflowId, workflow, submittedBy, priority = 'normal', _correlationId) {
        super();
        this.workflowId = workflowId;
        this.workflow = workflow;
        this.submittedBy = submittedBy;
        this.priority = priority;
        this._correlationId = _correlationId;
        this.type = 'AutomationWorkflowSubmittedEvent';
    }
    get correlationId() {
        return this._correlationId;
    }
    toJSON() {
        return {
            type: this.type,
            workflowId: this.workflowId,
            workflow: this.workflow,
            submittedBy: this.submittedBy,
            priority: this.priority,
            correlationId: this.correlationId,
            timestamp: this.occurredOn.toISOString()
        };
    }
}
exports.AutomationWorkflowSubmittedEvent = AutomationWorkflowSubmittedEvent;
/**
 * Event fired when a workflow is successfully scheduled for execution
 */
class WorkflowScheduledEvent extends typescript_eda_domain_1.Event {
    constructor(workflowId, executionId, assignedClientId, _correlationId, scheduledAt = new Date()) {
        super();
        this.workflowId = workflowId;
        this.executionId = executionId;
        this.assignedClientId = assignedClientId;
        this._correlationId = _correlationId;
        this.scheduledAt = scheduledAt;
        this.type = 'WorkflowScheduledEvent';
    }
    get correlationId() {
        return this._correlationId;
    }
    toJSON() {
        return {
            type: this.type,
            workflowId: this.workflowId,
            executionId: this.executionId,
            assignedClientId: this.assignedClientId,
            scheduledAt: this.scheduledAt.toISOString(),
            correlationId: this.correlationId,
            timestamp: this.occurredOn.toISOString()
        };
    }
}
exports.WorkflowScheduledEvent = WorkflowScheduledEvent;
/**
 * Event fired when a workflow is rejected due to validation or permission issues
 */
class WorkflowRejectedEvent extends typescript_eda_domain_1.Event {
    constructor(workflowId, reasons, _correlationId, rejectedAt = new Date()) {
        super();
        this.workflowId = workflowId;
        this.reasons = reasons;
        this._correlationId = _correlationId;
        this.rejectedAt = rejectedAt;
        this.type = 'WorkflowRejectedEvent';
    }
    get correlationId() {
        return this._correlationId;
    }
    toJSON() {
        return {
            type: this.type,
            workflowId: this.workflowId,
            reasons: this.reasons,
            rejectedAt: this.rejectedAt.toISOString(),
            correlationId: this.correlationId,
            timestamp: this.occurredOn.toISOString()
        };
    }
}
exports.WorkflowRejectedEvent = WorkflowRejectedEvent;
/**
 * Event fired when a workflow is queued due to no available clients
 */
class WorkflowQueuedEvent extends typescript_eda_domain_1.Event {
    constructor(workflowId, reason, _correlationId, queuedAt = new Date()) {
        super();
        this.workflowId = workflowId;
        this.reason = reason;
        this._correlationId = _correlationId;
        this.queuedAt = queuedAt;
        this.type = 'WorkflowQueuedEvent';
    }
    get correlationId() {
        return this._correlationId;
    }
    toJSON() {
        return {
            type: this.type,
            workflowId: this.workflowId,
            reason: this.reason,
            queuedAt: this.queuedAt.toISOString(),
            correlationId: this.correlationId,
            timestamp: this.occurredOn.toISOString()
        };
    }
}
exports.WorkflowQueuedEvent = WorkflowQueuedEvent;
/**
 * Event fired when a client sends a heartbeat with status and capabilities
 */
class ClientHeartbeatEvent extends typescript_eda_domain_1.Event {
    constructor(clientId, status, capabilities, currentLoad = 0, performance, _correlationId) {
        super();
        this.clientId = clientId;
        this.status = status;
        this.capabilities = capabilities;
        this.currentLoad = currentLoad;
        this.performance = performance;
        this._correlationId = _correlationId;
        this.type = 'ClientHeartbeatEvent';
    }
    get correlationId() {
        return this._correlationId;
    }
    toJSON() {
        return {
            type: this.type,
            clientId: this.clientId,
            status: this.status,
            capabilities: this.capabilities,
            currentLoad: this.currentLoad,
            performance: this.performance,
            correlationId: this.correlationId,
            timestamp: this.occurredOn.toISOString()
        };
    }
}
exports.ClientHeartbeatEvent = ClientHeartbeatEvent;
/**
 * Event fired when a workflow execution is completed
 */
class WorkflowExecutionCompletedEvent extends typescript_eda_domain_1.Event {
    constructor(workflowId, executionId, clientId, success, workflow, performance, result, error, issues = [], suggestedImprovements = [], userFeedback, _correlationId) {
        super();
        this.workflowId = workflowId;
        this.executionId = executionId;
        this.clientId = clientId;
        this.success = success;
        this.workflow = workflow;
        this.performance = performance;
        this.result = result;
        this.error = error;
        this.issues = issues;
        this.suggestedImprovements = suggestedImprovements;
        this.userFeedback = userFeedback;
        this._correlationId = _correlationId;
        this.type = 'WorkflowExecutionCompletedEvent';
    }
    get correlationId() {
        return this._correlationId;
    }
    toJSON() {
        return {
            type: this.type,
            workflowId: this.workflowId,
            executionId: this.executionId,
            clientId: this.clientId,
            success: this.success,
            workflow: this.workflow,
            performance: this.performance,
            result: this.result,
            error: this.error,
            issues: this.issues,
            suggestedImprovements: this.suggestedImprovements,
            userFeedback: this.userFeedback,
            correlationId: this.correlationId,
            timestamp: this.occurredOn.toISOString()
        };
    }
}
exports.WorkflowExecutionCompletedEvent = WorkflowExecutionCompletedEvent;
/**
 * Event fired when an AI workflow generation is requested
 */
class AIWorkflowRequestedEvent extends typescript_eda_domain_1.Event {
    constructor(requestId, workflowType, objective, domain, requirements, availableCapabilities, constraints = {}, examples = [], preferences = {}, optimizationGoals = ['reliability', 'performance'], workflow, _correlationId) {
        super();
        this.requestId = requestId;
        this.workflowType = workflowType;
        this.objective = objective;
        this.domain = domain;
        this.requirements = requirements;
        this.availableCapabilities = availableCapabilities;
        this.constraints = constraints;
        this.examples = examples;
        this.preferences = preferences;
        this.optimizationGoals = optimizationGoals;
        this.workflow = workflow;
        this._correlationId = _correlationId;
        this.type = 'AIWorkflowRequestedEvent';
    }
    get correlationId() {
        return this._correlationId;
    }
    toJSON() {
        return {
            type: this.type,
            requestId: this.requestId,
            workflowType: this.workflowType,
            objective: this.objective,
            domain: this.domain,
            requirements: this.requirements,
            availableCapabilities: this.availableCapabilities,
            constraints: this.constraints,
            examples: this.examples,
            preferences: this.preferences,
            optimizationGoals: this.optimizationGoals,
            workflow: this.workflow,
            correlationId: this.correlationId,
            timestamp: this.occurredOn.toISOString()
        };
    }
}
exports.AIWorkflowRequestedEvent = AIWorkflowRequestedEvent;
/**
 * Event fired when an AI workflow is successfully generated
 */
class AIWorkflowGeneratedEvent extends typescript_eda_domain_1.Event {
    constructor(requestId, generatedWorkflow, modelId, confidence = 0.8, generationTime = 0, _correlationId) {
        super();
        this.requestId = requestId;
        this.generatedWorkflow = generatedWorkflow;
        this.modelId = modelId;
        this.confidence = confidence;
        this.generationTime = generationTime;
        this._correlationId = _correlationId;
        this.type = 'AIWorkflowGeneratedEvent';
    }
    get correlationId() {
        return this._correlationId;
    }
    toJSON() {
        return {
            type: this.type,
            requestId: this.requestId,
            generatedWorkflow: this.generatedWorkflow,
            modelId: this.modelId,
            confidence: this.confidence,
            generationTime: this.generationTime,
            correlationId: this.correlationId,
            timestamp: this.occurredOn.toISOString()
        };
    }
}
exports.AIWorkflowGeneratedEvent = AIWorkflowGeneratedEvent;
/**
 * Event fired when AI workflow generation fails
 */
class AIWorkflowGenerationFailedEvent extends typescript_eda_domain_1.Event {
    constructor(requestId, errors, _correlationId, attemptCount = 1, maxAttempts = 3) {
        super();
        this.requestId = requestId;
        this.errors = errors;
        this._correlationId = _correlationId;
        this.attemptCount = attemptCount;
        this.maxAttempts = maxAttempts;
        this.type = 'AIWorkflowGenerationFailedEvent';
    }
    get correlationId() {
        return this._correlationId;
    }
    get canRetry() {
        return this.attemptCount < this.maxAttempts;
    }
    toJSON() {
        return {
            type: this.type,
            requestId: this.requestId,
            errors: this.errors,
            attemptCount: this.attemptCount,
            maxAttempts: this.maxAttempts,
            canRetry: this.canRetry,
            correlationId: this.correlationId,
            timestamp: this.occurredOn.toISOString()
        };
    }
}
exports.AIWorkflowGenerationFailedEvent = AIWorkflowGenerationFailedEvent;
/**
 * Event fired when a client connects to the cloud service
 */
class ClientConnectedEvent extends typescript_eda_domain_1.Event {
    constructor(clientId, clientType, version, capabilities, metadata = {}, _correlationId) {
        super();
        this.clientId = clientId;
        this.clientType = clientType;
        this.version = version;
        this.capabilities = capabilities;
        this.metadata = metadata;
        this._correlationId = _correlationId;
        this.type = 'ClientConnectedEvent';
    }
    get correlationId() {
        return this._correlationId;
    }
    toJSON() {
        return {
            type: this.type,
            clientId: this.clientId,
            clientType: this.clientType,
            version: this.version,
            capabilities: this.capabilities,
            metadata: this.metadata,
            correlationId: this.correlationId,
            timestamp: this.occurredOn.toISOString()
        };
    }
}
exports.ClientConnectedEvent = ClientConnectedEvent;
/**
 * Event fired when a client disconnects from the cloud service
 */
class ClientDisconnectedEvent extends typescript_eda_domain_1.Event {
    constructor(clientId, reason, lastSeen, _correlationId) {
        super();
        this.clientId = clientId;
        this.reason = reason;
        this.lastSeen = lastSeen;
        this._correlationId = _correlationId;
        this.type = 'ClientDisconnectedEvent';
    }
    get correlationId() {
        return this._correlationId;
    }
    toJSON() {
        return {
            type: this.type,
            clientId: this.clientId,
            reason: this.reason,
            lastSeen: this.lastSeen.toISOString(),
            correlationId: this.correlationId,
            timestamp: this.occurredOn.toISOString()
        };
    }
}
exports.ClientDisconnectedEvent = ClientDisconnectedEvent;
/**
 * Event fired when system security validation is performed
 */
class SecurityValidationEvent extends typescript_eda_domain_1.Event {
    constructor(validationType, success, userId, clientId, details = {}, securityLevel = 'medium', _correlationId) {
        super();
        this.validationType = validationType;
        this.success = success;
        this.userId = userId;
        this.clientId = clientId;
        this.details = details;
        this.securityLevel = securityLevel;
        this._correlationId = _correlationId;
        this.type = 'SecurityValidationEvent';
    }
    get correlationId() {
        return this._correlationId;
    }
    toJSON() {
        return {
            type: this.type,
            validationType: this.validationType,
            success: this.success,
            userId: this.userId,
            clientId: this.clientId,
            details: this.details,
            securityLevel: this.securityLevel,
            correlationId: this.correlationId,
            timestamp: this.occurredOn.toISOString()
        };
    }
}
exports.SecurityValidationEvent = SecurityValidationEvent;
//# sourceMappingURL=cloud-events.js.map