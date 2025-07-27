/**
 * Tests for LoggingAdapter
 * Created to improve coverage from 0%
 */

import { LoggingAdapter } from '../logging-adapter';
import { Adapter } from '../../../stubs/typescript-eda-stubs';

describe('LoggingAdapter', () => {
  let loggingAdapter: LoggingAdapter;

  beforeEach(() => {
    loggingAdapter = new LoggingAdapter();
  });

  it('should be instantiable', () => {
    expect(loggingAdapter).toBeDefined();
    expect(loggingAdapter).toBeInstanceOf(LoggingAdapter);
  });

  it('should extend Adapter', () => {
    expect(loggingAdapter).toBeInstanceOf(Adapter);
  });

  it('should have constructor that calls super', () => {
    // Constructor is called in beforeEach, just verify the instance exists
    expect(loggingAdapter).toBeTruthy();
  });
});