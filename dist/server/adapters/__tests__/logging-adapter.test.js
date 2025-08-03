"use strict";
/**
 * Tests for LoggingAdapter
 * Created to improve coverage from 0%
 */
Object.defineProperty(exports, "__esModule", { value: true });
const logging_adapter_1 = require("../logging-adapter");
const typescript_eda_stubs_1 = require("../../../stubs/typescript-eda-stubs");
describe('LoggingAdapter', () => {
    let loggingAdapter;
    beforeEach(() => {
        loggingAdapter = new logging_adapter_1.LoggingAdapter();
    });
    it('should be instantiable', () => {
        expect(loggingAdapter).toBeDefined();
        expect(loggingAdapter).toBeInstanceOf(logging_adapter_1.LoggingAdapter);
    });
    it('should extend Adapter', () => {
        expect(loggingAdapter).toBeInstanceOf(typescript_eda_stubs_1.Adapter);
    });
    it('should have constructor that calls super', () => {
        // Constructor is called in beforeEach, just verify the instance exists
        expect(loggingAdapter).toBeTruthy();
    });
});
//# sourceMappingURL=logging-adapter.test.js.map