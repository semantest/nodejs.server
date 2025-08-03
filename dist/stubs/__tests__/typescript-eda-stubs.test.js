"use strict";
/**
 * Tests for TypeScript-EDA stubs
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const typescript_eda_stubs_1 = require("../typescript-eda-stubs");
describe('TypeScript-EDA Stubs', () => {
    describe('Event class', () => {
        it('should create an Event instance', () => {
            const event = new typescript_eda_stubs_1.Event();
            expect(event).toBeDefined();
            expect(event).toBeInstanceOf(typescript_eda_stubs_1.Event);
        });
        it('should be extendable', () => {
            class CustomEvent extends typescript_eda_stubs_1.Event {
                constructor(data) {
                    super();
                    this.data = data;
                }
            }
            const customEvent = new CustomEvent('test data');
            expect(customEvent).toBeInstanceOf(typescript_eda_stubs_1.Event);
            expect(customEvent).toBeInstanceOf(CustomEvent);
            expect(customEvent.data).toBe('test data');
        });
    });
    describe('listen decorator', () => {
        it('should be a function that returns a decorator', () => {
            expect(typeof typescript_eda_stubs_1.listen).toBe('function');
            const decorator = (0, typescript_eda_stubs_1.listen)(typescript_eda_stubs_1.Event);
            expect(typeof decorator).toBe('function');
        });
        it('should decorate a method', () => {
            class TestHandler {
                handleEvent(event) {
                    // Handler implementation
                }
            }
            __decorate([
                (0, typescript_eda_stubs_1.listen)(typescript_eda_stubs_1.Event),
                __metadata("design:type", Function),
                __metadata("design:paramtypes", [typescript_eda_stubs_1.Event]),
                __metadata("design:returntype", void 0)
            ], TestHandler.prototype, "handleEvent", null);
            const handler = new TestHandler();
            expect(handler.handleEvent).toBeDefined();
        });
        it('should work with custom event classes', () => {
            class CustomEvent extends typescript_eda_stubs_1.Event {
            }
            class TestHandler {
                handleCustomEvent(event) {
                    // Handler implementation
                }
            }
            __decorate([
                (0, typescript_eda_stubs_1.listen)(CustomEvent),
                __metadata("design:type", Function),
                __metadata("design:paramtypes", [CustomEvent]),
                __metadata("design:returntype", void 0)
            ], TestHandler.prototype, "handleCustomEvent", null);
            const handler = new TestHandler();
            expect(handler.handleCustomEvent).toBeDefined();
        });
    });
    describe('Application class', () => {
        it('should create an Application instance', () => {
            const app = new typescript_eda_stubs_1.Application();
            expect(app).toBeDefined();
            expect(app).toBeInstanceOf(typescript_eda_stubs_1.Application);
        });
        it('should be extendable', () => {
            class CustomApplication extends typescript_eda_stubs_1.Application {
                constructor(name) {
                    super();
                    this.name = name;
                }
            }
            const customApp = new CustomApplication('TestApp');
            expect(customApp).toBeInstanceOf(typescript_eda_stubs_1.Application);
            expect(customApp).toBeInstanceOf(CustomApplication);
            expect(customApp.name).toBe('TestApp');
        });
    });
    describe('Enable decorator', () => {
        it('should be a function that returns a decorator', () => {
            expect(typeof typescript_eda_stubs_1.Enable).toBe('function');
            const decorator = (0, typescript_eda_stubs_1.Enable)(typescript_eda_stubs_1.Adapter);
            expect(typeof decorator).toBe('function');
        });
        it('should decorate a class', () => {
            let TestApplication = class TestApplication extends typescript_eda_stubs_1.Application {
            };
            TestApplication = __decorate([
                (0, typescript_eda_stubs_1.Enable)(typescript_eda_stubs_1.Adapter)
            ], TestApplication);
            const app = new TestApplication();
            expect(app).toBeInstanceOf(typescript_eda_stubs_1.Application);
        });
        it('should work with multiple adapters', () => {
            class CustomAdapter extends typescript_eda_stubs_1.Adapter {
            }
            let TestApplication = class TestApplication extends typescript_eda_stubs_1.Application {
            };
            TestApplication = __decorate([
                (0, typescript_eda_stubs_1.Enable)(typescript_eda_stubs_1.Adapter),
                (0, typescript_eda_stubs_1.Enable)(CustomAdapter)
            ], TestApplication);
            const app = new TestApplication();
            expect(app).toBeInstanceOf(typescript_eda_stubs_1.Application);
        });
    });
    describe('Adapter class', () => {
        it('should create an Adapter instance', () => {
            const adapter = new typescript_eda_stubs_1.Adapter();
            expect(adapter).toBeDefined();
            expect(adapter).toBeInstanceOf(typescript_eda_stubs_1.Adapter);
        });
        it('should be extendable', () => {
            class CustomAdapter extends typescript_eda_stubs_1.Adapter {
                constructor(config) {
                    super();
                    this.config = config;
                }
            }
            const customAdapter = new CustomAdapter({ key: 'value' });
            expect(customAdapter).toBeInstanceOf(typescript_eda_stubs_1.Adapter);
            expect(customAdapter).toBeInstanceOf(CustomAdapter);
            expect(customAdapter.config).toEqual({ key: 'value' });
        });
    });
    describe('Port class', () => {
        it('should be defined', () => {
            expect(typescript_eda_stubs_1.Port).toBeDefined();
        });
        it('should be usable as a type', () => {
            const portInstance = new typescript_eda_stubs_1.Port();
            expect(portInstance).toBeDefined();
        });
    });
    describe('AdapterFor decorator', () => {
        it('should be a function that returns a decorator', () => {
            expect(typeof typescript_eda_stubs_1.AdapterFor).toBe('function');
            const decorator = (0, typescript_eda_stubs_1.AdapterFor)(typescript_eda_stubs_1.Port);
            expect(typeof decorator).toBe('function');
        });
        it('should decorate an adapter class', () => {
            let TestAdapter = class TestAdapter extends typescript_eda_stubs_1.Adapter {
            };
            TestAdapter = __decorate([
                (0, typescript_eda_stubs_1.AdapterFor)(typescript_eda_stubs_1.Port)
            ], TestAdapter);
            const adapter = new TestAdapter();
            expect(adapter).toBeInstanceOf(typescript_eda_stubs_1.Adapter);
        });
        it('should work with custom port classes', () => {
            class CustomPort extends typescript_eda_stubs_1.Port {
            }
            let TestAdapter = class TestAdapter extends typescript_eda_stubs_1.Adapter {
            };
            TestAdapter = __decorate([
                (0, typescript_eda_stubs_1.AdapterFor)(CustomPort)
            ], TestAdapter);
            const adapter = new TestAdapter();
            expect(adapter).toBeInstanceOf(typescript_eda_stubs_1.Adapter);
        });
    });
    describe('Integration scenarios', () => {
        it('should allow creating a complete application setup', () => {
            // Define custom event
            class UserCreatedEvent extends typescript_eda_stubs_1.Event {
                constructor(userId) {
                    super();
                    this.userId = userId;
                }
            }
            // Define custom port
            class UserPort extends typescript_eda_stubs_1.Port {
            }
            // Define adapter for the port
            let UserAdapter = class UserAdapter extends typescript_eda_stubs_1.Adapter {
            };
            UserAdapter = __decorate([
                (0, typescript_eda_stubs_1.AdapterFor)(UserPort)
            ], UserAdapter);
            // Define application with adapter enabled
            let UserApplication = class UserApplication extends typescript_eda_stubs_1.Application {
                handleUserCreated(event) {
                    // Handle event
                }
            };
            __decorate([
                (0, typescript_eda_stubs_1.listen)(UserCreatedEvent),
                __metadata("design:type", Function),
                __metadata("design:paramtypes", [UserCreatedEvent]),
                __metadata("design:returntype", void 0)
            ], UserApplication.prototype, "handleUserCreated", null);
            UserApplication = __decorate([
                (0, typescript_eda_stubs_1.Enable)(UserAdapter)
            ], UserApplication);
            const app = new UserApplication();
            expect(app).toBeInstanceOf(typescript_eda_stubs_1.Application);
            expect(app.handleUserCreated).toBeDefined();
        });
        it('should support multiple event handlers', () => {
            class Event1 extends typescript_eda_stubs_1.Event {
            }
            class Event2 extends typescript_eda_stubs_1.Event {
            }
            class Event3 extends typescript_eda_stubs_1.Event {
            }
            class MultiHandlerApp extends typescript_eda_stubs_1.Application {
                handleEvent1(event) { }
                handleEvent2(event) { }
                handleEvent3(event) { }
            }
            __decorate([
                (0, typescript_eda_stubs_1.listen)(Event1),
                __metadata("design:type", Function),
                __metadata("design:paramtypes", [Event1]),
                __metadata("design:returntype", void 0)
            ], MultiHandlerApp.prototype, "handleEvent1", null);
            __decorate([
                (0, typescript_eda_stubs_1.listen)(Event2),
                __metadata("design:type", Function),
                __metadata("design:paramtypes", [Event2]),
                __metadata("design:returntype", void 0)
            ], MultiHandlerApp.prototype, "handleEvent2", null);
            __decorate([
                (0, typescript_eda_stubs_1.listen)(Event3),
                __metadata("design:type", Function),
                __metadata("design:paramtypes", [Event3]),
                __metadata("design:returntype", void 0)
            ], MultiHandlerApp.prototype, "handleEvent3", null);
            const app = new MultiHandlerApp();
            expect(app.handleEvent1).toBeDefined();
            expect(app.handleEvent2).toBeDefined();
            expect(app.handleEvent3).toBeDefined();
        });
    });
});
//# sourceMappingURL=typescript-eda-stubs.test.js.map