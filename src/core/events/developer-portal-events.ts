/**
 * @fileoverview Developer portal events
 * @description Events for developer portal, API documentation, and SDK generation
 * @author Web-Buddy Team
 */

import { Event } from '../../stubs/typescript-eda-stubs';

/**
 * Developer portal requested event
 */
export class DeveloperPortalRequestedEvent extends Event {
  constructor(
    public readonly action: 'get_documentation' | 'explore_api' | 'generate_sdk' | 'onboard_developer' | 'manage_api_keys',
    public readonly parameters: any,
    public readonly metadata?: {
      userId?: string;
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * API documentation requested event
 */
export class ApiDocumentationRequestedEvent extends Event {
  constructor(
    public readonly format: 'openapi' | 'postman' | 'insomnia' | 'curl',
    public readonly endpoints: string[],
    public readonly options?: {
      includeExamples?: boolean;
      includeSchemas?: boolean;
      includeAuth?: boolean;
      version?: string;
    },
    public readonly metadata?: {
      userId?: string;
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * SDK generation requested event
 */
export class SdkGenerationRequestedEvent extends Event {
  constructor(
    public readonly language: string,
    public readonly version: string,
    public readonly configuration: {
      packageName?: string;
      namespace?: string;
      baseUrl?: string;
      authentication?: string;
      features?: string[];
    },
    public readonly metadata?: {
      userId?: string;
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * API explorer session started event
 */
export class ApiExplorerSessionStartedEvent extends Event {
  constructor(
    public readonly sessionId: string,
    public readonly userId: string,
    public readonly endpoint: string,
    public readonly configuration: {
      apiKey?: string;
      environment?: string;
      features?: string[];
    },
    public readonly metadata: {
      ipAddress: string;
      userAgent: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * API test executed event
 */
export class ApiTestExecutedEvent extends Event {
  constructor(
    public readonly sessionId: string,
    public readonly endpoint: string,
    public readonly method: string,
    public readonly parameters: any,
    public readonly result: {
      success: boolean;
      statusCode?: number;
      responseTime?: number;
      error?: string;
    },
    public readonly metadata: {
      userId?: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Developer onboarding started event
 */
export class DeveloperOnboardingStartedEvent extends Event {
  constructor(
    public readonly userId: string,
    public readonly flow: {
      experience: string;
      goals: string[];
      steps: string[];
      estimatedDuration: number;
    },
    public readonly metadata: {
      referralSource?: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Onboarding step completed event
 */
export class OnboardingStepCompletedEvent extends Event {
  constructor(
    public readonly userId: string,
    public readonly stepId: string,
    public readonly stepName: string,
    public readonly completionTime: number,
    public readonly nextStep?: string,
    public readonly metadata?: {
      feedback?: string;
      difficulty?: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * API key dashboard accessed event
 */
export class ApiKeyDashboardAccessedEvent extends Event {
  constructor(
    public readonly userId: string,
    public readonly features: string[],
    public readonly metadata: {
      ipAddress: string;
      userAgent: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Documentation viewed event
 */
export class DocumentationViewedEvent extends Event {
  constructor(
    public readonly documentationId: string,
    public readonly endpoint: string,
    public readonly format: string,
    public readonly viewDuration: number,
    public readonly metadata: {
      userId?: string;
      referrer?: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * SDK downloaded event
 */
export class SdkDownloadedEvent extends Event {
  constructor(
    public readonly language: string,
    public readonly version: string,
    public readonly packageName: string,
    public readonly downloadUrl: string,
    public readonly metadata: {
      userId?: string;
      ipAddress: string;
      userAgent: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Tutorial started event
 */
export class TutorialStartedEvent extends Event {
  constructor(
    public readonly tutorialId: string,
    public readonly userId: string,
    public readonly tutorialTitle: string,
    public readonly difficulty: string,
    public readonly estimatedDuration: number,
    public readonly metadata: {
      referralSource?: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Tutorial completed event
 */
export class TutorialCompletedEvent extends Event {
  constructor(
    public readonly tutorialId: string,
    public readonly userId: string,
    public readonly completionTime: number,
    public readonly feedback?: {
      rating: number;
      comment: string;
      difficulty: string;
    },
    public readonly metadata?: {
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Community post created event
 */
export class CommunityPostCreatedEvent extends Event {
  constructor(
    public readonly postId: string,
    public readonly authorId: string,
    public readonly title: string,
    public readonly category: string,
    public readonly type: string,
    public readonly tags: string[],
    public readonly metadata: {
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Support ticket created event
 */
export class SupportTicketCreatedEvent extends Event {
  constructor(
    public readonly ticketId: string,
    public readonly userId: string,
    public readonly subject: string,
    public readonly category: string,
    public readonly priority: string,
    public readonly metadata: {
      ipAddress: string;
      userAgent: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Developer feedback submitted event
 */
export class DeveloperFeedbackSubmittedEvent extends Event {
  constructor(
    public readonly feedbackId: string,
    public readonly userId: string,
    public readonly type: 'rating' | 'comment' | 'suggestion' | 'bug_report',
    public readonly content: {
      rating?: number;
      comment?: string;
      suggestion?: string;
      category?: string;
    },
    public readonly context: {
      page?: string;
      feature?: string;
      endpoint?: string;
    },
    public readonly metadata: {
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * API changelog updated event
 */
export class ApiChangelogUpdatedEvent extends Event {
  constructor(
    public readonly version: string,
    public readonly changes: Array<{
      type: string;
      title: string;
      description: string;
      endpoints: string[];
      impact: string;
    }>,
    public readonly releaseDate: Date,
    public readonly metadata: {
      publishedBy: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Developer portal analytics requested event
 */
export class DeveloperPortalAnalyticsRequestedEvent extends Event {
  constructor(
    public readonly period: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly metrics: string[],
    public readonly filters?: {
      userId?: string;
      endpoint?: string;
      language?: string;
    },
    public readonly metadata?: {
      requestId: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Code sample executed event
 */
export class CodeSampleExecutedEvent extends Event {
  constructor(
    public readonly sampleId: string,
    public readonly language: string,
    public readonly endpoint: string,
    public readonly success: boolean,
    public readonly executionTime: number,
    public readonly error?: string,
    public readonly metadata?: {
      userId?: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}

/**
 * Developer portal configuration updated event
 */
export class DeveloperPortalConfigurationUpdatedEvent extends Event {
  constructor(
    public readonly section: string,
    public readonly changes: Record<string, any>,
    public readonly metadata: {
      updatedBy: string;
      timestamp: Date;
    }
  ) {
    super();
  }
}