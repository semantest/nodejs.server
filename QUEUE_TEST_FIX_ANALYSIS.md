# AI Tool Queue Test Fix Analysis

## Issue
The test `should handle AI tool activation failures` is failing because:
- Test expects `status.totalFailed` to be 1 after calling `failProcessing`
- But `failProcessing` only emits an event, doesn't update counters

## Current Implementation
```typescript
failProcessing(id: string, error: Error): void {
  this.emit(`process:${id}:error`, error);
}
```

## Expected Behavior
When `failProcessing` is called, it should:
1. Move the item from processing to failed/DLQ
2. Update the failed counter
3. Emit the error event

## Fix Options
1. Update `failProcessing` to handle counter updates
2. Have the test listen for the event and check async behavior
3. Add a separate method for marking items as failed

## Recommendation
Option 1 - Update `failProcessing` to properly handle failures and update counters, similar to how `completeProcessing` works.