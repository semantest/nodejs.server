"use strict";
/**
 * @fileoverview Developer portal events
 * @description Events for developer portal, API documentation, and SDK generation
 * @author Web-Buddy Team
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeveloperPortalConfigurationUpdatedEvent = exports.CodeSampleExecutedEvent = exports.DeveloperPortalAnalyticsRequestedEvent = exports.ApiChangelogUpdatedEvent = exports.DeveloperFeedbackSubmittedEvent = exports.SupportTicketCreatedEvent = exports.CommunityPostCreatedEvent = exports.TutorialCompletedEvent = exports.TutorialStartedEvent = exports.SdkDownloadedEvent = exports.DocumentationViewedEvent = exports.ApiKeyDashboardAccessedEvent = exports.OnboardingStepCompletedEvent = exports.DeveloperOnboardingStartedEvent = exports.ApiTestExecutedEvent = exports.ApiExplorerSessionStartedEvent = exports.SdkGenerationRequestedEvent = exports.ApiDocumentationRequestedEvent = exports.DeveloperPortalRequestedEvent = void 0;
const typescript_eda_stubs_1 = require("../../stubs/typescript-eda-stubs");
/**
 * Developer portal requested event
 */
class DeveloperPortalRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(action, parameters, metadata) {
        super();
        this.action = action;
        this.parameters = parameters;
        this.metadata = metadata;
    }
}
exports.DeveloperPortalRequestedEvent = DeveloperPortalRequestedEvent;
/**
 * API documentation requested event
 */
class ApiDocumentationRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(format, endpoints, options, metadata) {
        super();
        this.format = format;
        this.endpoints = endpoints;
        this.options = options;
        this.metadata = metadata;
    }
}
exports.ApiDocumentationRequestedEvent = ApiDocumentationRequestedEvent;
/**
 * SDK generation requested event
 */
class SdkGenerationRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(language, version, configuration, metadata) {
        super();
        this.language = language;
        this.version = version;
        this.configuration = configuration;
        this.metadata = metadata;
    }
}
exports.SdkGenerationRequestedEvent = SdkGenerationRequestedEvent;
/**
 * API explorer session started event
 */
class ApiExplorerSessionStartedEvent extends typescript_eda_stubs_1.Event {
    constructor(sessionId, userId, endpoint, configuration, metadata) {
        super();
        this.sessionId = sessionId;
        this.userId = userId;
        this.endpoint = endpoint;
        this.configuration = configuration;
        this.metadata = metadata;
    }
}
exports.ApiExplorerSessionStartedEvent = ApiExplorerSessionStartedEvent;
/**
 * API test executed event
 */
class ApiTestExecutedEvent extends typescript_eda_stubs_1.Event {
    constructor(sessionId, endpoint, method, parameters, result, metadata) {
        super();
        this.sessionId = sessionId;
        this.endpoint = endpoint;
        this.method = method;
        this.parameters = parameters;
        this.result = result;
        this.metadata = metadata;
    }
}
exports.ApiTestExecutedEvent = ApiTestExecutedEvent;
/**
 * Developer onboarding started event
 */
class DeveloperOnboardingStartedEvent extends typescript_eda_stubs_1.Event {
    constructor(userId, flow, metadata) {
        super();
        this.userId = userId;
        this.flow = flow;
        this.metadata = metadata;
    }
}
exports.DeveloperOnboardingStartedEvent = DeveloperOnboardingStartedEvent;
/**
 * Onboarding step completed event
 */
class OnboardingStepCompletedEvent extends typescript_eda_stubs_1.Event {
    constructor(userId, stepId, stepName, completionTime, nextStep, metadata) {
        super();
        this.userId = userId;
        this.stepId = stepId;
        this.stepName = stepName;
        this.completionTime = completionTime;
        this.nextStep = nextStep;
        this.metadata = metadata;
    }
}
exports.OnboardingStepCompletedEvent = OnboardingStepCompletedEvent;
/**
 * API key dashboard accessed event
 */
class ApiKeyDashboardAccessedEvent extends typescript_eda_stubs_1.Event {
    constructor(userId, features, metadata) {
        super();
        this.userId = userId;
        this.features = features;
        this.metadata = metadata;
    }
}
exports.ApiKeyDashboardAccessedEvent = ApiKeyDashboardAccessedEvent;
/**
 * Documentation viewed event
 */
class DocumentationViewedEvent extends typescript_eda_stubs_1.Event {
    constructor(documentationId, endpoint, format, viewDuration, metadata) {
        super();
        this.documentationId = documentationId;
        this.endpoint = endpoint;
        this.format = format;
        this.viewDuration = viewDuration;
        this.metadata = metadata;
    }
}
exports.DocumentationViewedEvent = DocumentationViewedEvent;
/**
 * SDK downloaded event
 */
class SdkDownloadedEvent extends typescript_eda_stubs_1.Event {
    constructor(language, version, packageName, downloadUrl, metadata) {
        super();
        this.language = language;
        this.version = version;
        this.packageName = packageName;
        this.downloadUrl = downloadUrl;
        this.metadata = metadata;
    }
}
exports.SdkDownloadedEvent = SdkDownloadedEvent;
/**
 * Tutorial started event
 */
class TutorialStartedEvent extends typescript_eda_stubs_1.Event {
    constructor(tutorialId, userId, tutorialTitle, difficulty, estimatedDuration, metadata) {
        super();
        this.tutorialId = tutorialId;
        this.userId = userId;
        this.tutorialTitle = tutorialTitle;
        this.difficulty = difficulty;
        this.estimatedDuration = estimatedDuration;
        this.metadata = metadata;
    }
}
exports.TutorialStartedEvent = TutorialStartedEvent;
/**
 * Tutorial completed event
 */
class TutorialCompletedEvent extends typescript_eda_stubs_1.Event {
    constructor(tutorialId, userId, completionTime, feedback, metadata) {
        super();
        this.tutorialId = tutorialId;
        this.userId = userId;
        this.completionTime = completionTime;
        this.feedback = feedback;
        this.metadata = metadata;
    }
}
exports.TutorialCompletedEvent = TutorialCompletedEvent;
/**
 * Community post created event
 */
class CommunityPostCreatedEvent extends typescript_eda_stubs_1.Event {
    constructor(postId, authorId, title, category, type, tags, metadata) {
        super();
        this.postId = postId;
        this.authorId = authorId;
        this.title = title;
        this.category = category;
        this.type = type;
        this.tags = tags;
        this.metadata = metadata;
    }
}
exports.CommunityPostCreatedEvent = CommunityPostCreatedEvent;
/**
 * Support ticket created event
 */
class SupportTicketCreatedEvent extends typescript_eda_stubs_1.Event {
    constructor(ticketId, userId, subject, category, priority, metadata) {
        super();
        this.ticketId = ticketId;
        this.userId = userId;
        this.subject = subject;
        this.category = category;
        this.priority = priority;
        this.metadata = metadata;
    }
}
exports.SupportTicketCreatedEvent = SupportTicketCreatedEvent;
/**
 * Developer feedback submitted event
 */
class DeveloperFeedbackSubmittedEvent extends typescript_eda_stubs_1.Event {
    constructor(feedbackId, userId, type, content, context, metadata) {
        super();
        this.feedbackId = feedbackId;
        this.userId = userId;
        this.type = type;
        this.content = content;
        this.context = context;
        this.metadata = metadata;
    }
}
exports.DeveloperFeedbackSubmittedEvent = DeveloperFeedbackSubmittedEvent;
/**
 * API changelog updated event
 */
class ApiChangelogUpdatedEvent extends typescript_eda_stubs_1.Event {
    constructor(version, changes, releaseDate, metadata) {
        super();
        this.version = version;
        this.changes = changes;
        this.releaseDate = releaseDate;
        this.metadata = metadata;
    }
}
exports.ApiChangelogUpdatedEvent = ApiChangelogUpdatedEvent;
/**
 * Developer portal analytics requested event
 */
class DeveloperPortalAnalyticsRequestedEvent extends typescript_eda_stubs_1.Event {
    constructor(period, startDate, endDate, metrics, filters, metadata) {
        super();
        this.period = period;
        this.startDate = startDate;
        this.endDate = endDate;
        this.metrics = metrics;
        this.filters = filters;
        this.metadata = metadata;
    }
}
exports.DeveloperPortalAnalyticsRequestedEvent = DeveloperPortalAnalyticsRequestedEvent;
/**
 * Code sample executed event
 */
class CodeSampleExecutedEvent extends typescript_eda_stubs_1.Event {
    constructor(sampleId, language, endpoint, success, executionTime, error, metadata) {
        super();
        this.sampleId = sampleId;
        this.language = language;
        this.endpoint = endpoint;
        this.success = success;
        this.executionTime = executionTime;
        this.error = error;
        this.metadata = metadata;
    }
}
exports.CodeSampleExecutedEvent = CodeSampleExecutedEvent;
/**
 * Developer portal configuration updated event
 */
class DeveloperPortalConfigurationUpdatedEvent extends typescript_eda_stubs_1.Event {
    constructor(section, changes, metadata) {
        super();
        this.section = section;
        this.changes = changes;
        this.metadata = metadata;
    }
}
exports.DeveloperPortalConfigurationUpdatedEvent = DeveloperPortalConfigurationUpdatedEvent;
//# sourceMappingURL=developer-portal-events.js.map