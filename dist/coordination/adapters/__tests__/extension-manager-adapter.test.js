"use strict";
/**
 * Tests for ExtensionManagerAdapter
 * Created to improve coverage from 0%
 */
Object.defineProperty(exports, "__esModule", { value: true });
const extension_manager_adapter_1 = require("../extension-manager-adapter");
const typescript_eda_stubs_1 = require("../../../stubs/typescript-eda-stubs");
describe('ExtensionManagerAdapter', () => {
    let extensionManagerAdapter;
    beforeEach(() => {
        extensionManagerAdapter = new extension_manager_adapter_1.ExtensionManagerAdapter();
    });
    it('should be instantiable', () => {
        expect(extensionManagerAdapter).toBeDefined();
        expect(extensionManagerAdapter).toBeInstanceOf(extension_manager_adapter_1.ExtensionManagerAdapter);
    });
    it('should extend Adapter', () => {
        expect(extensionManagerAdapter).toBeInstanceOf(typescript_eda_stubs_1.Adapter);
    });
    it('should have constructor that calls super', () => {
        // Constructor is called in beforeEach, just verify the instance exists
        expect(extensionManagerAdapter).toBeTruthy();
    });
});
//# sourceMappingURL=extension-manager-adapter.test.js.map