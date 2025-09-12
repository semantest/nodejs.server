/**
 * Saga Manager for Browser Orchestration
 * Implements the Saga pattern for managing distributed transactions
 * across browser automation workflows
 */

import { EventStore } from '../event-store/event-store';
import { DomainEvent } from '../../domain/core/domain-event';
import { 
  ImageGenerationRequested,
  ImageGenerationValidated,
  ImageGenerationQueued,
  ImageGenerationStarted,
  ImageGenerationCompleted,
  ImageGenerationFailed 
} from '../../domain/events/image-generation-events';

export interface SagaStep<T extends DomainEvent = DomainEvent> {
  name: string;
  eventType: string;
  execute: (event: T) => Promise<void>;
  compensate?: (event: T) => Promise<void>;
  canRetry?: boolean;
  maxRetries?: number;
  timeout?: number;
}

export interface SagaDefinition {
  name: string;
  triggerEventType: string;
  steps: SagaStep[];
  timeoutMs?: number;
}

export interface SagaInstance {
  id: string;
  sagaName: string;
  aggregateId: string;
  currentStep: number;
  status: 'running' | 'completed' | 'failed' | 'compensating';
  startedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  compensationStack: string[];
}

export class SagaManager {
  private sagas: Map<string, SagaDefinition> = new Map();
  private instances: Map<string, SagaInstance> = new Map();
  private eventHandlers: Map<string, ((event: DomainEvent) => Promise<void>)[]> = new Map();

  constructor(
    private readonly eventStore: EventStore,
    private readonly eventBus?: EventBus
  ) {
    this.initializeDefaultSagas();
  }

  /**
   * Register a saga definition
   */
  public registerSaga(saga: SagaDefinition): void {
    this.sagas.set(saga.name, saga);
    
    // Register trigger event handler
    this.subscribeToEvent(saga.triggerEventType, async (event) => {
      await this.startSaga(saga.name, event);
    });

    // Register step event handlers
    saga.steps.forEach(step => {
      this.subscribeToEvent(step.eventType, async (event) => {
        await this.handleStepEvent(event);
      });
    });
  }

  /**
   * Start a new saga instance
   */
  private async startSaga(sagaName: string, triggerEvent: DomainEvent): Promise<void> {
    const saga = this.sagas.get(sagaName);
    if (!saga) {
      throw new Error(`Saga ${sagaName} not found`);
    }

    const instance: SagaInstance = {
      id: this.generateSagaId(),
      sagaName,
      aggregateId: triggerEvent.aggregateId,
      currentStep: 0,
      status: 'running',
      startedAt: new Date(),
      compensationStack: []
    };

    this.instances.set(instance.id, instance);

    // Execute first step
    await this.executeStep(instance, saga.steps[0], triggerEvent);
  }

  /**
   * Execute a saga step
   */
  private async executeStep(
    instance: SagaInstance, 
    step: SagaStep, 
    event: DomainEvent
  ): Promise<void> {
    try {
      console.log(`Executing saga step: ${step.name} for instance ${instance.id}`);
      
      // Set timeout if configured
      const timeout = step.timeout || 30000;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Step ${step.name} timed out`)), timeout)
      );

      // Execute step with timeout
      await Promise.race([
        step.execute(event),
        timeoutPromise
      ]);

      // Add to compensation stack if step has compensate method
      if (step.compensate) {
        instance.compensationStack.push(step.name);
      }

      // Move to next step or complete
      const saga = this.sagas.get(instance.sagaName)!;
      if (instance.currentStep < saga.steps.length - 1) {
        instance.currentStep++;
      } else {
        await this.completeSaga(instance);
      }
    } catch (error: any) {
      console.error(`Saga step ${step.name} failed:`, error);
      await this.handleStepFailure(instance, step, error);
    }
  }

  /**
   * Handle step failure and trigger compensation
   */
  private async handleStepFailure(
    instance: SagaInstance,
    failedStep: SagaStep,
    error: Error
  ): Promise<void> {
    instance.status = 'compensating';
    instance.error = error.message;

    // Execute compensation in reverse order
    const saga = this.sagas.get(instance.sagaName)!;
    const compensationSteps = instance.compensationStack.reverse();

    for (const stepName of compensationSteps) {
      const step = saga.steps.find(s => s.name === stepName);
      if (step?.compensate) {
        try {
          console.log(`Compensating step: ${stepName}`);
          // Create a compensation event
          const compensationEvent: DomainEvent = {
            aggregateId: instance.aggregateId,
            eventId: this.generateEventId(),
            eventType: `${stepName}Compensation`,
            eventVersion: 1,
            occurredAt: new Date(),
            payload: { sagaId: instance.id, error: error.message }
          };
          await step.compensate(compensationEvent);
        } catch (compensationError) {
          console.error(`Compensation failed for step ${stepName}:`, compensationError);
        }
      }
    }

    instance.status = 'failed';
    instance.failedAt = new Date();
  }

  /**
   * Complete a saga instance
   */
  private async completeSaga(instance: SagaInstance): Promise<void> {
    instance.status = 'completed';
    instance.completedAt = new Date();
    console.log(`Saga ${instance.sagaName} completed successfully`);
  }

  /**
   * Handle incoming events for saga steps
   */
  private async handleStepEvent(event: DomainEvent): Promise<void> {
    // Find active saga instances for this aggregate
    const instances = Array.from(this.instances.values()).filter(
      i => i.aggregateId === event.aggregateId && i.status === 'running'
    );

    for (const instance of instances) {
      const saga = this.sagas.get(instance.sagaName)!;
      const currentStep = saga.steps[instance.currentStep];
      
      if (currentStep.eventType === event.eventType) {
        await this.executeStep(instance, currentStep, event);
      }
    }
  }

  /**
   * Subscribe to domain events
   */
  private subscribeToEvent(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Process an incoming event
   */
  public async processEvent(event: DomainEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.eventType) || [];
    await Promise.all(handlers.map(handler => handler(event)));
  }

  /**
   * Initialize default sagas for image generation workflow
   */
  private initializeDefaultSagas(): void {
    // Browser Automation Saga
    const browserAutomationSaga: SagaDefinition = {
      name: 'BrowserImageGeneration',
      triggerEventType: 'ImageGenerationRequested',
      steps: [
        {
          name: 'ValidateRequest',
          eventType: 'ImageGenerationValidated',
          execute: async (event) => {
            console.log('Validating image generation request...');
            // Validation logic would go here
          },
          compensate: async (event) => {
            console.log('Compensating validation...');
            // Clean up any validation resources
          }
        },
        {
          name: 'QueueForProcessing',
          eventType: 'ImageGenerationQueued',
          execute: async (event) => {
            console.log('Queueing request for processing...');
            // Queue management logic
          },
          compensate: async (event) => {
            console.log('Removing from queue...');
            // Remove from queue
          }
        },
        {
          name: 'LaunchBrowserAutomation',
          eventType: 'ImageGenerationStarted',
          execute: async (event) => {
            console.log('Starting browser automation...');
            // Launch browser and navigate to ChatGPT
          },
          compensate: async (event) => {
            console.log('Closing browser session...');
            // Close browser and clean up
          },
          timeout: 60000 // 60 second timeout for browser launch
        },
        {
          name: 'GenerateImage',
          eventType: 'ImageGenerationCompleted',
          execute: async (event) => {
            console.log('Generating image via ChatGPT...');
            // Interact with ChatGPT to generate image
          },
          compensate: async (event) => {
            console.log('Cancelling generation...');
            // Cancel generation if possible
          },
          timeout: 120000 // 2 minute timeout for generation
        }
      ]
    };

    this.registerSaga(browserAutomationSaga);
  }

  private generateSagaId(): string {
    return `saga_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get saga instance status
   */
  public getSagaInstance(sagaId: string): SagaInstance | undefined {
    return this.instances.get(sagaId);
  }

  /**
   * Get all active saga instances
   */
  public getActiveSagas(): SagaInstance[] {
    return Array.from(this.instances.values()).filter(
      i => i.status === 'running' || i.status === 'compensating'
    );
  }
}

// Event Bus interface for cross-aggregate communication
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
}