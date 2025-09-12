# Event-Sourced Architecture for Semantest

## Overview

Semantest implements a pure event-sourced architecture with CQRS, Saga pattern, and hexagonal architecture principles. The system automates image generation through ChatGPT browser automation, treating every state change as an immutable event.

## Core Architectural Patterns

### 1. Hexagonal Architecture (Ports & Adapters)

```
┌─────────────────────────────────────────────────────────────┐
│                        INFRASTRUCTURE                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  WebSocket  │  │   HTTP API   │  │ Browser Extension│  │
│  │   Adapter   │  │   Adapter    │  │     Adapter      │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
├─────────┼─────────────────┼────────────────────┼────────────┤
│         ▼                 ▼                    ▼            │
│  ┌────────────────────────────────────────────────────┐    │
│  │              APPLICATION LAYER                     │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │    │
│  │  │Command       │  │Query         │  │ Saga    │ │    │
│  │  │Handlers      │  │Handlers      │  │ Manager │ │    │
│  │  └──────┬───────┘  └──────┬───────┘  └────┬────┘ │    │
│  └─────────┼──────────────────┼───────────────┼──────┘    │
│            ▼                  ▼               ▼            │
│  ┌────────────────────────────────────────────────────┐    │
│  │                 DOMAIN LAYER                       │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │    │
│  │  │  Aggregates  │  │Domain Events │  │Business │ │    │
│  │  │              │  │              │  │  Rules  │ │    │
│  │  └──────────────┘  └──────────────┘  └─────────┘ │    │
│  └────────────────────────────────────────────────────┘    │
│            ▼                                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │           INFRASTRUCTURE PERSISTENCE               │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │    │
│  │  │Event Store   │  │Projection    │  │Event    │ │    │
│  │  │              │  │Store         │  │  Bus    │ │    │
│  │  └──────────────┘  └──────────────┘  └─────────┘ │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 2. Event Sourcing

All state changes are captured as events:

```typescript
// Domain Events
ImageGenerationRequested
ImageGenerationValidated
ImageGenerationQueued
ImageGenerationStarted
ImageGenerationCompleted
ImageGenerationFailed
ImageGenerationCancelled
```

Events are:
- **Immutable**: Once created, never modified
- **Append-only**: New events added, never deleted
- **Auditable**: Complete history of all changes
- **Replayable**: Can rebuild state from events

### 3. CQRS (Command Query Responsibility Segregation)

**Commands** (Write Side):
- `RequestImageGenerationCommand`
- `QueueImageGenerationCommand`
- `StartImageProcessingCommand`
- `CompleteImageGenerationCommand`
- `CancelImageGenerationCommand`

**Queries** (Read Side):
- `GetImageGenerationStatusQuery`
- `GetQueuePositionQuery`
- `GetUserGenerationHistoryQuery`
- `GetSystemMetricsQuery`

### 4. Saga Pattern for Browser Orchestration

The browser automation workflow is managed through a saga:

```typescript
ChatGPTImageGenerationSaga:
  1. InitializeBrowser → BrowserSessionInitialized
  2. NavigateToChatGPT → NavigatedToChatGPT
  3. SendImagePrompt → PromptSentToChatGPT
  4. WaitForImageGeneration → ImageGeneratedByChatGPT
  5. ProcessGeneratedImage → ImageProcessingCompleted
  6. CleanupBrowserSession → BrowserSessionClosed
```

Each step can be compensated if failure occurs, ensuring system consistency.

## Component Responsibilities

### Domain Layer
- **Aggregates**: Enforce business rules and invariants
- **Domain Events**: Record what happened in the system
- **Value Objects**: Encapsulate domain concepts

### Application Layer
- **Command Handlers**: Process commands and emit events
- **Query Handlers**: Build read models from projections
- **Saga Manager**: Orchestrate complex workflows

### Infrastructure Layer
- **Event Store**: Persist events with optimistic concurrency
- **Projection Store**: Maintain read models for queries
- **Event Bus**: Enable cross-aggregate communication
- **WebSocket Adapter**: Real-time client communication
- **Browser Adapter**: Interface with Chrome extension

## Event Flow

```
1. Client Request → WebSocket Adapter
2. WebSocket Adapter → Command Handler
3. Command Handler → Aggregate
4. Aggregate → Domain Events
5. Domain Events → Event Store
6. Event Store → Event Bus
7. Event Bus → Projections + Sagas
8. Projections → Query Handlers
9. Query Handlers → WebSocket Response
```

## Browser Automation Architecture

The browser automation uses a distributed architecture:

```
┌──────────────┐     WebSocket      ┌──────────────────┐
│   Node.js    │◄──────────────────►│Chrome Extension  │
│   Server     │                     │                  │
└──────┬───────┘                     └────────┬─────────┘
       │                                       │
       │ Saga Events                          │ DOM Interaction
       ▼                                       ▼
┌──────────────┐                     ┌──────────────────┐
│Saga Manager  │                     │   ChatGPT Tab    │
│              │                     │                  │
└──────────────┘                     └──────────────────┘
```

## Key Design Decisions

### 1. Event-First Design
Every action starts with an event, following Smalltalk's message-passing philosophy. Objects communicate through events, not direct method calls.

### 2. Eventual Consistency
The system embraces eventual consistency. Read models are updated asynchronously from events.

### 3. Saga Compensation
Failed operations are compensated rather than rolled back, maintaining system integrity.

### 4. Browser as External System
The browser is treated as an external system, communicated with through adapters, maintaining clean boundaries.

## Scalability Considerations

### Horizontal Scaling
- Multiple server instances can process events
- Event bus supports distributed processing
- Projections can be rebuilt on new nodes

### Performance Optimization
- Event snapshots for faster aggregate loading
- Projection caching for query performance
- WebSocket connection pooling

### Fault Tolerance
- Saga compensation for failure recovery
- Dead letter queue for failed events
- Event replay for system recovery

## Security Architecture

### Event Security
- Events are signed and validated
- Sensitive data encrypted in event payloads
- Audit trail maintained for all events

### Browser Security
- Content Security Policy enforcement
- Isolated browser contexts
- Secure WebSocket communication

## Testing Strategy

### Unit Tests
- Aggregate business logic
- Command/Query handlers
- Event serialization

### Integration Tests
- Saga workflows
- Event store persistence
- WebSocket communication

### End-to-End Tests
- Complete image generation flow
- Browser automation scenarios
- Failure compensation paths

## Monitoring & Observability

### Metrics
- Event processing rate
- Saga completion time
- Browser automation success rate
- Queue depths

### Logging
- Structured event logging
- Saga state transitions
- Browser interaction logs

### Tracing
- Distributed tracing across sagas
- Event correlation IDs
- Browser session tracking

## Future Enhancements

1. **Event Versioning**: Support for evolving event schemas
2. **Multi-Browser Support**: Firefox, Safari automation
3. **AI Model Integration**: Direct API integration when available
4. **Event Streaming**: Kafka/Pulsar for high-volume processing
5. **GraphQL Subscriptions**: Real-time client updates

## Development Guidelines

1. **Every state change must produce an event**
2. **Aggregates enforce all business rules**
3. **Commands return void (fire-and-forget)**
4. **Queries never modify state**
5. **Sagas handle cross-aggregate transactions**
6. **Adapters handle all external communication**

## Conclusion

This architecture provides a robust, scalable, and maintainable foundation for the Semantest system. The event-sourced approach ensures complete auditability, the hexagonal architecture maintains clean boundaries, and the saga pattern elegantly handles the complex browser automation workflow.