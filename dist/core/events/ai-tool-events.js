"use strict";
/**
 * @fileoverview AI Tool activation events for managing AI tool interactions
 * @description Events for AI tool lifecycle management and activation tracking
 * @author Semantest Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIToolState = exports.AIToolDeactivatedEvent = exports.AIToolExecutionFailedEvent = exports.AIToolExecutionCompletedEvent = exports.AIToolExecutionStartedEvent = exports.AIToolActivationFailedEvent = exports.AIToolActivatedEvent = exports.AIToolActivatingEvent = void 0;
const typescript_eda_stubs_1 = require("../../stubs/typescript-eda-stubs");
/**
 * Event triggered when AI tool activation is initiated
 */
class AIToolActivatingEvent extends typescript_eda_stubs_1.Event {
    constructor(toolId, addonId, activationMethod, queueItemId, metadata) {
        super();
        this.toolId = toolId;
        this.addonId = addonId;
        this.activationMethod = activationMethod;
        this.queueItemId = queueItemId;
        this.metadata = metadata;
        this.type = 'AIToolActivating';
    }
}
exports.AIToolActivatingEvent = AIToolActivatingEvent;
/**
 * Event triggered when AI tool is successfully activated
 */
class AIToolActivatedEvent extends typescript_eda_stubs_1.Event {
    constructor(toolId, addonId, activationDuration, confirmationSignals, queueItemId) {
        super();
        this.toolId = toolId;
        this.addonId = addonId;
        this.activationDuration = activationDuration;
        this.confirmationSignals = confirmationSignals;
        this.queueItemId = queueItemId;
        this.type = 'AIToolActivated';
    }
}
exports.AIToolActivatedEvent = AIToolActivatedEvent;
/**
 * Event triggered when AI tool activation fails
 */
class AIToolActivationFailedEvent extends typescript_eda_stubs_1.Event {
    constructor(toolId, addonId, error, attemptNumber, willRetry, queueItemId) {
        super();
        this.toolId = toolId;
        this.addonId = addonId;
        this.error = error;
        this.attemptNumber = attemptNumber;
        this.willRetry = willRetry;
        this.queueItemId = queueItemId;
        this.type = 'AIToolActivationFailed';
    }
}
exports.AIToolActivationFailedEvent = AIToolActivationFailedEvent;
/**
 * Event triggered when AI tool execution starts
 */
class AIToolExecutionStartedEvent extends typescript_eda_stubs_1.Event {
    constructor(toolId, addonId, input, executionId, queueItemId) {
        super();
        this.toolId = toolId;
        this.addonId = addonId;
        this.input = input;
        this.executionId = executionId;
        this.queueItemId = queueItemId;
        this.type = 'AIToolExecutionStarted';
    }
}
exports.AIToolExecutionStartedEvent = AIToolExecutionStartedEvent;
/**
 * Event triggered when AI tool execution completes
 */
class AIToolExecutionCompletedEvent extends typescript_eda_stubs_1.Event {
    constructor(toolId, addonId, executionId, result, executionTime, queueItemId) {
        super();
        this.toolId = toolId;
        this.addonId = addonId;
        this.executionId = executionId;
        this.result = result;
        this.executionTime = executionTime;
        this.queueItemId = queueItemId;
        this.type = 'AIToolExecutionCompleted';
    }
}
exports.AIToolExecutionCompletedEvent = AIToolExecutionCompletedEvent;
/**
 * Event triggered when AI tool execution fails
 */
class AIToolExecutionFailedEvent extends typescript_eda_stubs_1.Event {
    constructor(toolId, addonId, executionId, error, queueItemId, partialResult) {
        super();
        this.toolId = toolId;
        this.addonId = addonId;
        this.executionId = executionId;
        this.error = error;
        this.queueItemId = queueItemId;
        this.partialResult = partialResult;
        this.type = 'AIToolExecutionFailed';
    }
}
exports.AIToolExecutionFailedEvent = AIToolExecutionFailedEvent;
/**
 * Event triggered when AI tool is deactivated
 */
class AIToolDeactivatedEvent extends typescript_eda_stubs_1.Event {
    constructor(toolId, addonId, reason, sessionDuration) {
        super();
        this.toolId = toolId;
        this.addonId = addonId;
        this.reason = reason;
        this.sessionDuration = sessionDuration;
        this.type = 'AIToolDeactivated';
    }
}
exports.AIToolDeactivatedEvent = AIToolDeactivatedEvent;
/**
 * AI Tool activation state
 */
var AIToolState;
(function (AIToolState) {
    AIToolState["IDLE"] = "idle";
    AIToolState["ACTIVATING"] = "activating";
    AIToolState["ACTIVE"] = "active";
    AIToolState["EXECUTING"] = "executing";
    AIToolState["DEACTIVATING"] = "deactivating";
    AIToolState["ERROR"] = "error";
})(AIToolState || (exports.AIToolState = AIToolState = {}));
//# sourceMappingURL=ai-tool-events.js.map