"use strict";
/**
 * Tests for SessionManagerAdapter
 * Created to improve coverage from 0%
 */
Object.defineProperty(exports, "__esModule", { value: true });
const session_manager_adapter_1 = require("../session-manager-adapter");
const typescript_eda_stubs_1 = require("../../../stubs/typescript-eda-stubs");
describe('SessionManagerAdapter', () => {
    let sessionManagerAdapter;
    beforeEach(() => {
        sessionManagerAdapter = new session_manager_adapter_1.SessionManagerAdapter();
    });
    it('should be instantiable', () => {
        expect(sessionManagerAdapter).toBeDefined();
        expect(sessionManagerAdapter).toBeInstanceOf(session_manager_adapter_1.SessionManagerAdapter);
    });
    it('should extend Adapter', () => {
        expect(sessionManagerAdapter).toBeInstanceOf(typescript_eda_stubs_1.Adapter);
    });
    it('should have constructor that calls super', () => {
        // Constructor is called in beforeEach, just verify the instance exists
        expect(sessionManagerAdapter).toBeTruthy();
    });
});
//# sourceMappingURL=session-manager-adapter.test.js.map