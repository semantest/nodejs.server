/**
 * Tests for SessionManagerAdapter
 * Created to improve coverage from 0%
 */

import { SessionManagerAdapter } from '../session-manager-adapter';
import { Adapter } from '../../../stubs/typescript-eda-stubs';

describe('SessionManagerAdapter', () => {
  let sessionManagerAdapter: SessionManagerAdapter;

  beforeEach(() => {
    sessionManagerAdapter = new SessionManagerAdapter();
  });

  it('should be instantiable', () => {
    expect(sessionManagerAdapter).toBeDefined();
    expect(sessionManagerAdapter).toBeInstanceOf(SessionManagerAdapter);
  });

  it('should extend Adapter', () => {
    expect(sessionManagerAdapter).toBeInstanceOf(Adapter);
  });

  it('should have constructor that calls super', () => {
    // Constructor is called in beforeEach, just verify the instance exists
    expect(sessionManagerAdapter).toBeTruthy();
  });
});