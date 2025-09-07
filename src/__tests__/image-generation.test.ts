/**
 * @fileoverview Tests for image generation functionality
 * @description Test suite for ImageGenerationRequestedEvent, ImageGeneratedEvent, and related handlers
 */

import { ImageGenerationRequestedEvent, ImageGeneratedEvent } from '../core/events/server-events';
import { WebSocketServerAdapter } from '../coordination/adapters/websocket-server-adapter';
import { HttpServerAdapter } from '../server/adapters/http-server-adapter';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import axios from 'axios';

// Mock modules
jest.mock('fs');
jest.mock('https');
jest.mock('http');

describe('Image Generation Events', () => {
  describe('ImageGenerationRequestedEvent', () => {
    it('should create event with all required properties', () => {
      const requestId = uuidv4();
      const correlationId = uuidv4();
      const event = new ImageGenerationRequestedEvent(
        requestId,
        'A beautiful sunset over mountains',
        'dall-e-3',
        { width: 1024, height: 1024, quality: 'hd' },
        'user-123',
        correlationId
      );

      expect(event.type).toBe('ImageGenerationRequestedEvent');
      expect(event.requestId).toBe(requestId);
      expect(event.prompt).toBe('A beautiful sunset over mountains');
      expect(event.model).toBe('dall-e-3');
      expect(event.parameters.width).toBe(1024);
      expect(event.parameters.quality).toBe('hd');
      expect(event.userId).toBe('user-123');
      expect(event.correlationId).toBe(correlationId);
    });

    it('should serialize to JSON correctly', () => {
      const event = new ImageGenerationRequestedEvent(
        'req-123',
        'Test prompt',
        'dall-e-2',
        { numberOfImages: 2 },
        'user-456',
        'corr-789'
      );

      const json = event.toJSON();
      expect(json.type).toBe('ImageGenerationRequestedEvent');
      expect(json.requestId).toBe('req-123');
      expect(json.prompt).toBe('Test prompt');
      expect(json.model).toBe('dall-e-2');
      expect(json.parameters).toEqual({ numberOfImages: 2 });
      expect(json.userId).toBe('user-456');
      expect(json.correlationId).toBe('corr-789');
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('ImageGeneratedEvent', () => {
    it('should create event with all required properties', () => {
      const requestId = uuidv4();
      const correlationId = uuidv4();
      const metadata = {
        model: 'dall-e-3',
        prompt: 'A futuristic city',
        width: 1024,
        height: 1024,
        generatedAt: new Date()
      };

      const event = new ImageGeneratedEvent(
        requestId,
        'https://example.com/image.png',
        metadata,
        'extension-123',
        correlationId,
        '/path/to/image.png'
      );

      expect(event.type).toBe('ImageGeneratedEvent');
      expect(event.requestId).toBe(requestId);
      expect(event.imageUrl).toBe('https://example.com/image.png');
      expect(event.imagePath).toBe('/path/to/image.png');
      expect(event.metadata).toEqual(metadata);
      expect(event.extensionId).toBe('extension-123');
      expect(event.correlationId).toBe(correlationId);
    });

    it('should serialize to JSON correctly', () => {
      const generatedAt = new Date();
      const event = new ImageGeneratedEvent(
        'req-123',
        'https://example.com/test.png',
        {
          model: 'dall-e-2',
          prompt: 'Test',
          width: 512,
          height: 512,
          generatedAt
        },
        'ext-456',
        'corr-789'
      );

      const json = event.toJSON();
      expect(json.type).toBe('ImageGeneratedEvent');
      expect(json.requestId).toBe('req-123');
      expect(json.imageUrl).toBe('https://example.com/test.png');
      expect(json.imagePath).toBeUndefined();
      expect((json.metadata as any).generatedAt).toBe(generatedAt.toISOString());
      expect(json.extensionId).toBe('ext-456');
      expect(json.correlationId).toBe('corr-789');
    });
  });
});

describe('WebSocketServerAdapter Image Handling', () => {
  let adapter: WebSocketServerAdapter;
  let mockWebSocket: jest.Mocked<WebSocket>;
  let mockServer: jest.Mocked<WebSocket.Server>;

  beforeEach(() => {
    adapter = new WebSocketServerAdapter();
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      readyState: WebSocket.OPEN,
      terminate: jest.fn(),
      ping: jest.fn()
    } as any;

    mockServer = {
      on: jest.fn(),
      close: jest.fn()
    } as any;

    jest.spyOn(WebSocket, 'Server').mockImplementation(() => mockServer as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleImageGenerationRequest', () => {
    it('should send image generation request to available extension', async () => {
      await adapter.startServer(3000);
      
      // Simulate connected extension
      const connectionHandler = mockServer.on.mock.calls.find(call => call[0] === 'connection')?.[1];
      if (connectionHandler) {
        connectionHandler.call(mockServer, mockWebSocket, { socket: { remoteAddress: '127.0.0.1' }, headers: {} });
      }

      // Authenticate the extension
      const messageHandler = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')?.[1];
      if (messageHandler) {
        messageHandler.call(mockWebSocket, JSON.stringify({
          type: 'authenticate',
          extensionId: 'test-extension',
          metadata: {}
        }));
      }

      const event = new ImageGenerationRequestedEvent(
        'req-123',
        'Generate a test image',
        'dall-e-3',
        { width: 1024, height: 1024 },
        'user-123',
        'corr-456'
      );

      await adapter.handleImageGenerationRequest(event);

      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[1][0] as string);
      expect(sentMessage.type).toBe('generate_image');
      expect(sentMessage.requestId).toBe('req-123');
      expect(sentMessage.prompt).toBe('Generate a test image');
      expect(sentMessage.model).toBe('dall-e-3');
      expect(sentMessage.parameters).toEqual({ width: 1024, height: 1024 });
    });

    it('should handle case when no extensions are available', async () => {
      await adapter.startServer(3000);
      
      const event = new ImageGenerationRequestedEvent(
        'req-123',
        'Test prompt',
        'dall-e-3',
        {},
        'user-123',
        'corr-456'
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await adapter.handleImageGenerationRequest(event);

      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ No available Chrome extension to handle image generation'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Image download functionality', () => {
    it('should download image from URL successfully', async () => {
      const adapter = new WebSocketServerAdapter();
      const mockWriteStream = {
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        }),
        close: jest.fn()
      };

      const mockResponse = {
        statusCode: 200,
        pipe: jest.fn()
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);
      (http.get as jest.Mock).mockImplementation((url, callback) => {
        callback(mockResponse);
        return { on: jest.fn() };
      });

      // Access private method through reflection
      const downloadImage = (adapter as any).downloadImage.bind(adapter);
      const result = await downloadImage('http://example.com/image.png', 'req-123');

      expect(result).toMatch(/generated-images\/req-123_\d+\.png$/);
      expect(fs.createWriteStream).toHaveBeenCalled();
      expect(mockResponse.pipe).toHaveBeenCalledWith(mockWriteStream);
    });

    it('should handle download errors gracefully', async () => {
      const adapter = new WebSocketServerAdapter();
      
      (http.get as jest.Mock).mockImplementation((url, callback) => {
        return {
          on: jest.fn((event, errorCallback) => {
            if (event === 'error') {
              errorCallback(new Error('Network error'));
            }
          })
        };
      });

      const downloadImage = (adapter as any).downloadImage.bind(adapter);
      
      await expect(downloadImage('http://example.com/image.png', 'req-123'))
        .rejects.toThrow('Network error');
    });
  });
});

describe('HTTP API Image Generation Endpoints', () => {
  let httpAdapter: HttpServerAdapter;
  const PORT = 3001;
  const API_URL = `http://localhost:${PORT}`;

  beforeEach(async () => {
    httpAdapter = new HttpServerAdapter();
    await httpAdapter.startServer(PORT);
  });

  afterEach(async () => {
    await httpAdapter.stopServer();
  });

  describe('POST /api/images/generate', () => {
    it('should accept valid image generation request', async () => {
      const response = await axios.post(`${API_URL}/api/images/generate`, {
        prompt: 'A beautiful landscape',
        model: 'dall-e-3',
        parameters: {
          width: 1024,
          height: 1024,
          quality: 'hd'
        },
        userId: 'test-user'
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('accepted');
      expect(response.data.requestId).toBeDefined();
      expect(response.data.correlationId).toBeDefined();
      expect(response.data.message).toBe('Image generation request submitted');
    });

    it('should reject request without prompt', async () => {
      try {
        await axios.post(`${API_URL}/api/images/generate`, {
          model: 'dall-e-3'
        });
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toBe('Missing required field: prompt');
      }
    });

    it('should use default values for optional fields', async () => {
      const response = await axios.post(`${API_URL}/api/images/generate`, {
        prompt: 'Test image'
      });

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('accepted');
      expect(response.data.requestId).toBeDefined();
    });
  });

  describe('GET /api/images/:requestId/status', () => {
    it('should return status for given request ID', async () => {
      const requestId = uuidv4();
      const response = await axios.get(`${API_URL}/api/images/${requestId}/status`);

      expect(response.status).toBe(200);
      expect(response.data.requestId).toBe(requestId);
      expect(response.data.status).toBeDefined();
      expect(response.data.timestamp).toBeDefined();
    });
  });

  describe('GET /api/images/:requestId', () => {
    it('should return image information for given request ID', async () => {
      const requestId = uuidv4();
      const response = await axios.get(`${API_URL}/api/images/${requestId}`);

      expect(response.status).toBe(200);
      expect(response.data.requestId).toBe(requestId);
      expect(response.data.status).toBeDefined();
      expect(response.data.timestamp).toBeDefined();
    });
  });
});

describe('Integration Test: CLI -> Server -> Extension Flow', () => {
  let httpAdapter: HttpServerAdapter;
  let wsAdapter: WebSocketServerAdapter;
  const HTTP_PORT = 3002;
  const WS_PORT = 3003;

  beforeEach(async () => {
    httpAdapter = new HttpServerAdapter();
    wsAdapter = new WebSocketServerAdapter();
    
    await httpAdapter.startServer(HTTP_PORT);
    await wsAdapter.startServer(WS_PORT);
  });

  afterEach(async () => {
    await httpAdapter.stopServer();
    await wsAdapter.stopServer();
  });

  it('should handle complete image generation flow', async () => {
    // 1. CLI sends image generation request to HTTP API
    const response = await axios.post(`http://localhost:${HTTP_PORT}/api/images/generate`, {
      prompt: 'A test image for integration testing',
      model: 'dall-e-3',
      parameters: {
        width: 512,
        height: 512
      },
      userId: 'integration-test-user'
    });

    expect(response.status).toBe(200);
    expect(response.data.status).toBe('accepted');
    const { requestId } = response.data;

    // 2. Simulate Chrome extension connection to WebSocket
    const ws = new WebSocket(`ws://localhost:${WS_PORT + 1}/ws`);
    
    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        // 3. Authenticate extension
        ws.send(JSON.stringify({
          type: 'authenticate',
          extensionId: 'test-chrome-extension',
          metadata: { version: '1.0.0' }
        }));
        resolve();
      });
    });

    // 4. Extension receives image generation request
    await new Promise<void>((resolve) => {
      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'generate_image') {
          expect(message.prompt).toBe('A test image for integration testing');
          expect(message.model).toBe('dall-e-3');
          
          // 5. Extension sends back generated image
          ws.send(JSON.stringify({
            type: 'image_generated',
            requestId: message.requestId,
            imageUrl: 'https://example.com/generated-image.png',
            metadata: {
              model: 'dall-e-3',
              prompt: message.prompt,
              width: 512,
              height: 512,
              generatedAt: new Date().toISOString()
            },
            correlationId: message.correlationId
          }));
          
          resolve();
        }
      });
    });

    ws.close();
  });
});