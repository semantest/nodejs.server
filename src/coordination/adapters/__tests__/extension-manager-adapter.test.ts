/**
 * Tests for ExtensionManagerAdapter
 * Created to improve coverage from 0%
 */

import { ExtensionManagerAdapter } from '../extension-manager-adapter';
import { Adapter } from '../../../stubs/typescript-eda-stubs';

describe('ExtensionManagerAdapter', () => {
  let extensionManagerAdapter: ExtensionManagerAdapter;

  beforeEach(() => {
    extensionManagerAdapter = new ExtensionManagerAdapter();
  });

  it('should be instantiable', () => {
    expect(extensionManagerAdapter).toBeDefined();
    expect(extensionManagerAdapter).toBeInstanceOf(ExtensionManagerAdapter);
  });

  it('should extend Adapter', () => {
    expect(extensionManagerAdapter).toBeInstanceOf(Adapter);
  });

  it('should have constructor that calls super', () => {
    // Constructor is called in beforeEach, just verify the instance exists
    expect(extensionManagerAdapter).toBeTruthy();
  });
});