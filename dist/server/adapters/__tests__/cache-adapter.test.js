"use strict";
/**
 * Tests for CacheAdapter
 * Created to improve coverage from 0%
 */
Object.defineProperty(exports, "__esModule", { value: true });
const cache_adapter_1 = require("../cache-adapter");
const typescript_eda_stubs_1 = require("../../../stubs/typescript-eda-stubs");
describe('CacheAdapter', () => {
    let cacheAdapter;
    beforeEach(() => {
        cacheAdapter = new cache_adapter_1.CacheAdapter();
    });
    it('should be instantiable', () => {
        expect(cacheAdapter).toBeDefined();
        expect(cacheAdapter).toBeInstanceOf(cache_adapter_1.CacheAdapter);
    });
    it('should extend Adapter', () => {
        expect(cacheAdapter).toBeInstanceOf(typescript_eda_stubs_1.Adapter);
    });
    it('should have constructor that calls super', () => {
        // Constructor is called in beforeEach, just verify the instance exists
        expect(cacheAdapter).toBeTruthy();
    });
});
//# sourceMappingURL=cache-adapter.test.js.map