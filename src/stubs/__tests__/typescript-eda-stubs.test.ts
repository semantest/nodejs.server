/**
 * Tests for TypeScript-EDA stubs
 */

import {
  Event,
  listen,
  Application,
  Enable,
  Adapter,
  Port,
  AdapterFor
} from '../typescript-eda-stubs';

describe('TypeScript-EDA Stubs', () => {
  describe('Event class', () => {
    it('should create an Event instance', () => {
      const event = new Event();
      expect(event).toBeDefined();
      expect(event).toBeInstanceOf(Event);
    });

    it('should be extendable', () => {
      class CustomEvent extends Event {
        constructor(public readonly data: string) {
          super();
        }
      }

      const customEvent = new CustomEvent('test data');
      expect(customEvent).toBeInstanceOf(Event);
      expect(customEvent).toBeInstanceOf(CustomEvent);
      expect(customEvent.data).toBe('test data');
    });
  });

  describe('listen decorator', () => {
    it('should be a function that returns a decorator', () => {
      expect(typeof listen).toBe('function');
      
      const decorator = listen(Event);
      expect(typeof decorator).toBe('function');
    });

    it('should decorate a method', () => {
      class TestHandler {
        @listen(Event)
        handleEvent(event: Event): void {
          // Handler implementation
        }
      }

      const handler = new TestHandler();
      expect(handler.handleEvent).toBeDefined();
    });

    it('should work with custom event classes', () => {
      class CustomEvent extends Event {}

      class TestHandler {
        @listen(CustomEvent)
        handleCustomEvent(event: CustomEvent): void {
          // Handler implementation
        }
      }

      const handler = new TestHandler();
      expect(handler.handleCustomEvent).toBeDefined();
    });
  });

  describe('Application class', () => {
    it('should create an Application instance', () => {
      const app = new Application();
      expect(app).toBeDefined();
      expect(app).toBeInstanceOf(Application);
    });

    it('should be extendable', () => {
      class CustomApplication extends Application {
        constructor(public readonly name: string) {
          super();
        }
      }

      const customApp = new CustomApplication('TestApp');
      expect(customApp).toBeInstanceOf(Application);
      expect(customApp).toBeInstanceOf(CustomApplication);
      expect(customApp.name).toBe('TestApp');
    });
  });

  describe('Enable decorator', () => {
    it('should be a function that returns a decorator', () => {
      expect(typeof Enable).toBe('function');
      
      const decorator = Enable(Adapter);
      expect(typeof decorator).toBe('function');
    });

    it('should decorate a class', () => {
      @Enable(Adapter)
      class TestApplication extends Application {}

      const app = new TestApplication();
      expect(app).toBeInstanceOf(Application);
    });

    it('should work with multiple adapters', () => {
      class CustomAdapter extends Adapter {}

      @Enable(Adapter)
      @Enable(CustomAdapter)
      class TestApplication extends Application {}

      const app = new TestApplication();
      expect(app).toBeInstanceOf(Application);
    });
  });

  describe('Adapter class', () => {
    it('should create an Adapter instance', () => {
      const adapter = new Adapter();
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(Adapter);
    });

    it('should be extendable', () => {
      class CustomAdapter extends Adapter {
        constructor(public readonly config: any) {
          super();
        }
      }

      const customAdapter = new CustomAdapter({ key: 'value' });
      expect(customAdapter).toBeInstanceOf(Adapter);
      expect(customAdapter).toBeInstanceOf(CustomAdapter);
      expect(customAdapter.config).toEqual({ key: 'value' });
    });
  });

  describe('Port class', () => {
    it('should be defined', () => {
      expect(Port).toBeDefined();
    });

    it('should be usable as a type', () => {
      const portInstance: Port = new Port();
      expect(portInstance).toBeDefined();
    });
  });

  describe('AdapterFor decorator', () => {
    it('should be a function that returns a decorator', () => {
      expect(typeof AdapterFor).toBe('function');
      
      const decorator = AdapterFor(Port);
      expect(typeof decorator).toBe('function');
    });

    it('should decorate an adapter class', () => {
      @AdapterFor(Port)
      class TestAdapter extends Adapter {}

      const adapter = new TestAdapter();
      expect(adapter).toBeInstanceOf(Adapter);
    });

    it('should work with custom port classes', () => {
      class CustomPort extends Port {}

      @AdapterFor(CustomPort)
      class TestAdapter extends Adapter {}

      const adapter = new TestAdapter();
      expect(adapter).toBeInstanceOf(Adapter);
    });
  });

  describe('Integration scenarios', () => {
    it('should allow creating a complete application setup', () => {
      // Define custom event
      class UserCreatedEvent extends Event {
        constructor(public readonly userId: string) {
          super();
        }
      }

      // Define custom port
      class UserPort extends Port {}

      // Define adapter for the port
      @AdapterFor(UserPort)
      class UserAdapter extends Adapter {}

      // Define application with adapter enabled
      @Enable(UserAdapter)
      class UserApplication extends Application {
        @listen(UserCreatedEvent)
        handleUserCreated(event: UserCreatedEvent): void {
          // Handle event
        }
      }

      const app = new UserApplication();
      expect(app).toBeInstanceOf(Application);
      expect(app.handleUserCreated).toBeDefined();
    });

    it('should support multiple event handlers', () => {
      class Event1 extends Event {}
      class Event2 extends Event {}
      class Event3 extends Event {}

      class MultiHandlerApp extends Application {
        @listen(Event1)
        handleEvent1(event: Event1): void {}

        @listen(Event2)
        handleEvent2(event: Event2): void {}

        @listen(Event3)
        handleEvent3(event: Event3): void {}
      }

      const app = new MultiHandlerApp();
      expect(app.handleEvent1).toBeDefined();
      expect(app.handleEvent2).toBeDefined();
      expect(app.handleEvent3).toBeDefined();
    });
  });
});