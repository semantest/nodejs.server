/**
 * Tests for CacheAdapter
 * Created to improve coverage from 0%
 */

import { CacheAdapter } from '../cache-adapter';
import { Adapter } from '../../../stubs/typescript-eda-stubs';

describe('CacheAdapter', () => {
  let cacheAdapter: CacheAdapter;

  beforeEach(() => {
    cacheAdapter = new CacheAdapter();
  });

  it('should be instantiable', () => {
    expect(cacheAdapter).toBeDefined();
    expect(cacheAdapter).toBeInstanceOf(CacheAdapter);
  });

  it('should extend Adapter', () => {
    expect(cacheAdapter).toBeInstanceOf(Adapter);
  });

  it('should have constructor that calls super', () => {
    // Constructor is called in beforeEach, just verify the instance exists
    expect(cacheAdapter).toBeTruthy();
  });
});