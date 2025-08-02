/**
 * @fileoverview Tests for NewChatRequestedHandler
 * @author Semantest Team
 */

import { NewChatRequestedHandler } from '../new-chat-requested.handler';
import { NewChatRequestedEvent, ChatSessionCreatedEvent, ChatSessionErrorEvent } from '../../../../core/events/chat-events';
import { ChatService } from '../../../application/services/chat.service';

describe('NewChatRequestedHandler', () => {
  let handler: NewChatRequestedHandler;
  let mockChatService: jest.Mocked<ChatService>;
  let mockEventBus: any;

  beforeEach(() => {
    // Create mocks
    mockChatService = {
      createSession: jest.fn(),
      addMessage: jest.fn(),
      generateResponse: jest.fn()
    } as any;

    mockEventBus = {
      publish: jest.fn()
    };

    handler = new NewChatRequestedHandler(mockChatService, mockEventBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handle', () => {
    it('should create a new chat session without initial prompt', async () => {
      const event = new NewChatRequestedEvent('user-123', '');
      
      mockChatService.createSession.mockResolvedValue({
        id: expect.any(String),
        userId: 'user-123',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        messages: [],
        status: 'active'
      });

      await handler.handle(event);

      expect(mockChatService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          status: 'active',
          messages: []
        })
      );

      expect(mockChatService.addMessage).not.toHaveBeenCalled();
      expect(mockChatService.generateResponse).not.toHaveBeenCalled();

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(ChatSessionCreatedEvent)
      );
    });

    it('should create a new chat session with initial prompt', async () => {
      const event = new NewChatRequestedEvent(
        'user-123', 
        'Hello, how can you help me?',
        { title: 'Help Request' }
      );
      
      mockChatService.createSession.mockResolvedValue({
        id: expect.any(String),
        userId: 'user-123',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        messages: [],
        status: 'active'
      });

      mockChatService.generateResponse.mockResolvedValue('I can help you with...');

      await handler.handle(event);

      expect(mockChatService.createSession).toHaveBeenCalled();
      
      // Should add the initial user message
      expect(mockChatService.addMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          content: 'Hello, how can you help me?',
          role: 'user'
        })
      );

      // Should generate a response
      expect(mockChatService.generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        'Hello, how can you help me?',
        { title: 'Help Request' }
      );

      // Should add the assistant response
      expect(mockChatService.addMessage).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          content: 'I can help you with...',
          role: 'assistant'
        })
      );

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(ChatSessionCreatedEvent)
      );
    });

    it('should emit error event if session creation fails', async () => {
      const event = new NewChatRequestedEvent('user-123', 'Test');
      const error = new Error('Database error');
      
      mockChatService.createSession.mockRejectedValue(error);

      await expect(handler.handle(event)).rejects.toThrow('Database error');

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(ChatSessionErrorEvent)
      );

      const errorEvent = mockEventBus.publish.mock.calls[0][0];
      expect(errorEvent.error).toBe(error);
    });

    it('should still create session even if initial prompt processing fails', async () => {
      const event = new NewChatRequestedEvent('user-123', 'Test prompt');
      
      mockChatService.createSession.mockResolvedValue({
        id: expect.any(String),
        userId: 'user-123',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        messages: [],
        status: 'active'
      });

      mockChatService.generateResponse.mockRejectedValue(new Error('AI service error'));

      await handler.handle(event);

      // Session should still be created
      expect(mockChatService.createSession).toHaveBeenCalled();
      
      // Success event should still be emitted
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.any(ChatSessionCreatedEvent)
      );
    });
  });
});