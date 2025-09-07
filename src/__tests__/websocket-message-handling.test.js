/**
 * @fileoverview WebSocket message handling tests
 * @description TDD tests for SEMANTEST WebSocket server message routing
 */

const WebSocket = require('ws');

describe('WebSocket Message Handling', () => {
  const WS_URL = 'ws://localhost:8081';
  let ws;

  beforeEach((done) => {
    ws = new WebSocket(WS_URL);
    ws.on('open', done);
  });

  afterEach((done) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
      ws.on('close', done);
    } else {
      done();
    }
  });

  describe('Connection', () => {
    it('should connect successfully to WebSocket server', (done) => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      done();
    });

    it('should receive welcome message on connection', (done) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('ServerConnectedEvent');
        expect(message.payload).toBeDefined();
        expect(message.payload.message).toContain('SEMANTEST');
        done();
      });
    });
  });

  describe('Authentication', () => {
    it('should authenticate CLI client successfully', (done) => {
      let messageCount = 0;
      
      ws.on('message', (data) => {
        messageCount++;
        if (messageCount === 1) {
          // Skip welcome message
          return;
        }
        
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('authentication_success');
        expect(message.message).toContain('cli');
        done();
      });

      // Send authentication after connection
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'authenticate',
          clientType: 'cli',
          clientId: 'test-cli-001'
        }));
      }, 100);
    });

    it('should authenticate Extension client successfully', (done) => {
      let messageCount = 0;
      
      ws.on('message', (data) => {
        messageCount++;
        if (messageCount === 1) {
          return; // Skip welcome message
        }
        
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('authentication_success');
        expect(message.message).toContain('extension');
        done();
      });

      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'authenticate',
          clientType: 'extension',
          extensionId: 'test-extension-001'
        }));
      }, 100);
    });
  });

  describe('Image Generation Request', () => {
    it('should handle ImageGenerationRequestedEvent from CLI', (done) => {
      const requestId = `test_${Date.now()}`;
      
      // First authenticate as CLI
      ws.send(JSON.stringify({
        type: 'authenticate',
        clientType: 'cli'
      }));

      setTimeout(() => {
        // Send image generation request
        ws.send(JSON.stringify({
          type: 'ImageGenerationRequestedEvent',
          requestId,
          prompt: 'Test image generation',
          model: 'dall-e-3',
          parameters: {
            width: 1024,
            height: 1024
          },
          userId: 'test-user',
          correlationId: `corr_${requestId}`
        }));

        // Server should acknowledge or forward to extension
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'error' && message.message === 'No extension available') {
            // Expected when no extension is connected
            expect(message.requestId).toBe(requestId);
            done();
          } else if (message.type === 'request_forwarded') {
            expect(message.requestId).toBe(requestId);
            done();
          }
        });
      }, 200);
    });
  });

  describe('Heartbeat', () => {
    it('should respond to ping with pong', (done) => {
      let messageCount = 0;
      
      ws.on('message', (data) => {
        messageCount++;
        if (messageCount === 1) {
          return; // Skip welcome message
        }
        
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('pong');
        expect(message.timestamp).toBeDefined();
        done();
      });

      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        }));
      }, 100);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', (done) => {
      let messageCount = 0;
      
      ws.on('message', (data) => {
        messageCount++;
        if (messageCount === 1) {
          return; // Skip welcome message
        }
        
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('error');
        expect(message.message).toBeDefined();
        done();
      });

      setTimeout(() => {
        ws.send('invalid json {]');
      }, 100);
    });
  });
});

describe('Multi-Client Message Routing', () => {
  const WS_URL = 'ws://localhost:8081';
  let cliClient;
  let extensionClient;

  beforeEach((done) => {
    let connectCount = 0;
    
    cliClient = new WebSocket(WS_URL);
    extensionClient = new WebSocket(WS_URL);
    
    cliClient.on('open', () => {
      connectCount++;
      if (connectCount === 2) done();
    });
    
    extensionClient.on('open', () => {
      connectCount++;
      if (connectCount === 2) done();
    });
  });

  afterEach((done) => {
    let closeCount = 0;
    const checkDone = () => {
      closeCount++;
      if (closeCount === 2) done();
    };
    
    if (cliClient.readyState === WebSocket.OPEN) {
      cliClient.close();
      cliClient.on('close', checkDone);
    } else {
      checkDone();
    }
    
    if (extensionClient.readyState === WebSocket.OPEN) {
      extensionClient.close();
      extensionClient.on('close', checkDone);
    } else {
      checkDone();
    }
  });

  it('should route messages from CLI to Extension', (done) => {
    const requestId = `routing_test_${Date.now()}`;
    
    // Authenticate both clients
    setTimeout(() => {
      cliClient.send(JSON.stringify({
        type: 'authenticate',
        clientType: 'cli'
      }));
      
      extensionClient.send(JSON.stringify({
        type: 'authenticate',
        clientType: 'extension',
        extensionId: 'test-ext'
      }));
    }, 100);
    
    // Extension listens for image generation request
    extensionClient.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'generate_image') {
        expect(message.requestId).toBe(requestId);
        expect(message.prompt).toBe('Test routing');
        done();
      }
    });
    
    // CLI sends image generation request
    setTimeout(() => {
      cliClient.send(JSON.stringify({
        type: 'ImageGenerationRequestedEvent',
        requestId,
        prompt: 'Test routing',
        model: 'dall-e-3'
      }));
    }, 300);
  });
});