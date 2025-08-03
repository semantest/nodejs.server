/**
 * @fileoverview Developer portal events
 * @description Events for developer portal, API documentation, and SDK generation
 * @author Web-Buddy Team
 */
import { Event } from '../../stubs/typescript-eda-stubs';
/**
 * Developer portal requested event
 */
export declare class DeveloperPortalRequestedEvent extends Event {
    readonly action: 'get_documentation' | 'explore_api' | 'generate_sdk' | 'onboard_developer' | 'manage_api_keys';
    readonly parameters: any;
    readonly metadata?: {
        userId?: string;
        requestId: string;
        timestamp: Date;
    };
    constructor(action: 'get_documentation' | 'explore_api' | 'generate_sdk' | 'onboard_developer' | 'manage_api_keys', parameters: any, metadata?: {
        userId?: string;
        requestId: string;
        timestamp: Date;
    });
}
/**
 * API documentation requested event
 */
export declare class ApiDocumentationRequestedEvent extends Event {
    readonly format: 'openapi' | 'postman' | 'insomnia' | 'curl';
    readonly endpoints: string[];
    readonly options?: {
        includeExamples?: boolean;
        includeSchemas?: boolean;
        includeAuth?: boolean;
        version?: string;
    };
    readonly metadata?: {
        userId?: string;
        requestId: string;
        timestamp: Date;
    };
    constructor(format: 'openapi' | 'postman' | 'insomnia' | 'curl', endpoints: string[], options?: {
        includeExamples?: boolean;
        includeSchemas?: boolean;
        includeAuth?: boolean;
        version?: string;
    }, metadata?: {
        userId?: string;
        requestId: string;
        timestamp: Date;
    });
}
/**
 * SDK generation requested event
 */
export declare class SdkGenerationRequestedEvent extends Event {
    readonly language: string;
    readonly version: string;
    readonly configuration: {
        packageName?: string;
        namespace?: string;
        baseUrl?: string;
        authentication?: string;
        features?: string[];
    };
    readonly metadata?: {
        userId?: string;
        requestId: string;
        timestamp: Date;
    };
    constructor(language: string, version: string, configuration: {
        packageName?: string;
        namespace?: string;
        baseUrl?: string;
        authentication?: string;
        features?: string[];
    }, metadata?: {
        userId?: string;
        requestId: string;
        timestamp: Date;
    });
}
/**
 * API explorer session started event
 */
export declare class ApiExplorerSessionStartedEvent extends Event {
    readonly sessionId: string;
    readonly userId: string;
    readonly endpoint: string;
    readonly configuration: {
        apiKey?: string;
        environment?: string;
        features?: string[];
    };
    readonly metadata: {
        ipAddress: string;
        userAgent: string;
        timestamp: Date;
    };
    constructor(sessionId: string, userId: string, endpoint: string, configuration: {
        apiKey?: string;
        environment?: string;
        features?: string[];
    }, metadata: {
        ipAddress: string;
        userAgent: string;
        timestamp: Date;
    });
}
/**
 * API test executed event
 */
export declare class ApiTestExecutedEvent extends Event {
    readonly sessionId: string;
    readonly endpoint: string;
    readonly method: string;
    readonly parameters: any;
    readonly result: {
        success: boolean;
        statusCode?: number;
        responseTime?: number;
        error?: string;
    };
    readonly metadata: {
        userId?: string;
        timestamp: Date;
    };
    constructor(sessionId: string, endpoint: string, method: string, parameters: any, result: {
        success: boolean;
        statusCode?: number;
        responseTime?: number;
        error?: string;
    }, metadata: {
        userId?: string;
        timestamp: Date;
    });
}
/**
 * Developer onboarding started event
 */
export declare class DeveloperOnboardingStartedEvent extends Event {
    readonly userId: string;
    readonly flow: {
        experience: string;
        goals: string[];
        steps: string[];
        estimatedDuration: number;
    };
    readonly metadata: {
        referralSource?: string;
        timestamp: Date;
    };
    constructor(userId: string, flow: {
        experience: string;
        goals: string[];
        steps: string[];
        estimatedDuration: number;
    }, metadata: {
        referralSource?: string;
        timestamp: Date;
    });
}
/**
 * Onboarding step completed event
 */
export declare class OnboardingStepCompletedEvent extends Event {
    readonly userId: string;
    readonly stepId: string;
    readonly stepName: string;
    readonly completionTime: number;
    readonly nextStep?: string;
    readonly metadata?: {
        feedback?: string;
        difficulty?: string;
        timestamp: Date;
    };
    constructor(userId: string, stepId: string, stepName: string, completionTime: number, nextStep?: string, metadata?: {
        feedback?: string;
        difficulty?: string;
        timestamp: Date;
    });
}
/**
 * API key dashboard accessed event
 */
export declare class ApiKeyDashboardAccessedEvent extends Event {
    readonly userId: string;
    readonly features: string[];
    readonly metadata: {
        ipAddress: string;
        userAgent: string;
        timestamp: Date;
    };
    constructor(userId: string, features: string[], metadata: {
        ipAddress: string;
        userAgent: string;
        timestamp: Date;
    });
}
/**
 * Documentation viewed event
 */
export declare class DocumentationViewedEvent extends Event {
    readonly documentationId: string;
    readonly endpoint: string;
    readonly format: string;
    readonly viewDuration: number;
    readonly metadata: {
        userId?: string;
        referrer?: string;
        timestamp: Date;
    };
    constructor(documentationId: string, endpoint: string, format: string, viewDuration: number, metadata: {
        userId?: string;
        referrer?: string;
        timestamp: Date;
    });
}
/**
 * SDK downloaded event
 */
export declare class SdkDownloadedEvent extends Event {
    readonly language: string;
    readonly version: string;
    readonly packageName: string;
    readonly downloadUrl: string;
    readonly metadata: {
        userId?: string;
        ipAddress: string;
        userAgent: string;
        timestamp: Date;
    };
    constructor(language: string, version: string, packageName: string, downloadUrl: string, metadata: {
        userId?: string;
        ipAddress: string;
        userAgent: string;
        timestamp: Date;
    });
}
/**
 * Tutorial started event
 */
export declare class TutorialStartedEvent extends Event {
    readonly tutorialId: string;
    readonly userId: string;
    readonly tutorialTitle: string;
    readonly difficulty: string;
    readonly estimatedDuration: number;
    readonly metadata: {
        referralSource?: string;
        timestamp: Date;
    };
    constructor(tutorialId: string, userId: string, tutorialTitle: string, difficulty: string, estimatedDuration: number, metadata: {
        referralSource?: string;
        timestamp: Date;
    });
}
/**
 * Tutorial completed event
 */
export declare class TutorialCompletedEvent extends Event {
    readonly tutorialId: string;
    readonly userId: string;
    readonly completionTime: number;
    readonly feedback?: {
        rating: number;
        comment: string;
        difficulty: string;
    };
    readonly metadata?: {
        timestamp: Date;
    };
    constructor(tutorialId: string, userId: string, completionTime: number, feedback?: {
        rating: number;
        comment: string;
        difficulty: string;
    }, metadata?: {
        timestamp: Date;
    });
}
/**
 * Community post created event
 */
export declare class CommunityPostCreatedEvent extends Event {
    readonly postId: string;
    readonly authorId: string;
    readonly title: string;
    readonly category: string;
    readonly type: string;
    readonly tags: string[];
    readonly metadata: {
        timestamp: Date;
    };
    constructor(postId: string, authorId: string, title: string, category: string, type: string, tags: string[], metadata: {
        timestamp: Date;
    });
}
/**
 * Support ticket created event
 */
export declare class SupportTicketCreatedEvent extends Event {
    readonly ticketId: string;
    readonly userId: string;
    readonly subject: string;
    readonly category: string;
    readonly priority: string;
    readonly metadata: {
        ipAddress: string;
        userAgent: string;
        timestamp: Date;
    };
    constructor(ticketId: string, userId: string, subject: string, category: string, priority: string, metadata: {
        ipAddress: string;
        userAgent: string;
        timestamp: Date;
    });
}
/**
 * Developer feedback submitted event
 */
export declare class DeveloperFeedbackSubmittedEvent extends Event {
    readonly feedbackId: string;
    readonly userId: string;
    readonly type: 'rating' | 'comment' | 'suggestion' | 'bug_report';
    readonly content: {
        rating?: number;
        comment?: string;
        suggestion?: string;
        category?: string;
    };
    readonly context: {
        page?: string;
        feature?: string;
        endpoint?: string;
    };
    readonly metadata: {
        timestamp: Date;
    };
    constructor(feedbackId: string, userId: string, type: 'rating' | 'comment' | 'suggestion' | 'bug_report', content: {
        rating?: number;
        comment?: string;
        suggestion?: string;
        category?: string;
    }, context: {
        page?: string;
        feature?: string;
        endpoint?: string;
    }, metadata: {
        timestamp: Date;
    });
}
/**
 * API changelog updated event
 */
export declare class ApiChangelogUpdatedEvent extends Event {
    readonly version: string;
    readonly changes: Array<{
        type: string;
        title: string;
        description: string;
        endpoints: string[];
        impact: string;
    }>;
    readonly releaseDate: Date;
    readonly metadata: {
        publishedBy: string;
        timestamp: Date;
    };
    constructor(version: string, changes: Array<{
        type: string;
        title: string;
        description: string;
        endpoints: string[];
        impact: string;
    }>, releaseDate: Date, metadata: {
        publishedBy: string;
        timestamp: Date;
    });
}
/**
 * Developer portal analytics requested event
 */
export declare class DeveloperPortalAnalyticsRequestedEvent extends Event {
    readonly period: string;
    readonly startDate: Date;
    readonly endDate: Date;
    readonly metrics: string[];
    readonly filters?: {
        userId?: string;
        endpoint?: string;
        language?: string;
    };
    readonly metadata?: {
        requestId: string;
        timestamp: Date;
    };
    constructor(period: string, startDate: Date, endDate: Date, metrics: string[], filters?: {
        userId?: string;
        endpoint?: string;
        language?: string;
    }, metadata?: {
        requestId: string;
        timestamp: Date;
    });
}
/**
 * Code sample executed event
 */
export declare class CodeSampleExecutedEvent extends Event {
    readonly sampleId: string;
    readonly language: string;
    readonly endpoint: string;
    readonly success: boolean;
    readonly executionTime: number;
    readonly error?: string;
    readonly metadata?: {
        userId?: string;
        timestamp: Date;
    };
    constructor(sampleId: string, language: string, endpoint: string, success: boolean, executionTime: number, error?: string, metadata?: {
        userId?: string;
        timestamp: Date;
    });
}
/**
 * Developer portal configuration updated event
 */
export declare class DeveloperPortalConfigurationUpdatedEvent extends Event {
    readonly section: string;
    readonly changes: Record<string, any>;
    readonly metadata: {
        updatedBy: string;
        timestamp: Date;
    };
    constructor(section: string, changes: Record<string, any>, metadata: {
        updatedBy: string;
        timestamp: Date;
    });
}
//# sourceMappingURL=developer-portal-events.d.ts.map