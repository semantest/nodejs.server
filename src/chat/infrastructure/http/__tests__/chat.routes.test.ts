/**
 * @fileoverview Tests for chat session HTTP routes
 * @author Semantest Team
 */

import request from 'supertest';
import express from 'express';
import { chatRouter } from '../chat.routes';

const app = express();
app.use(express.json());
app.use('/api', chatRouter);

describe('Chat Routes', () => {
  describe('POST /api/chat/sessions', () => {
    it('should create a new chat session without initial prompt', async () => {
      const response = await request(app)
        .post('/api/chat/sessions')
        .send({
          userId: 'test-user-123'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.session).toBeDefined();
      expect(response.body.session.userId).toBe('test-user-123');
      expect(response.body.session.status).toBe('active');
      expect(response.body.session.messages).toHaveLength(0);
    });

    it('should create a new chat session with initial prompt', async () => {
      const response = await request(app)
        .post('/api/chat/sessions')
        .send({
          userId: 'test-user-123',
          initialPrompt: 'Hello, how can you help me?',
          metadata: {
            title: 'Help Request',
            tags: ['support', 'general']
          }
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.session).toBeDefined();
      expect(response.body.session.messages).toHaveLength(2); // User message + AI response
      expect(response.body.session.messages[0].role).toBe('user');
      expect(response.body.session.messages[0].content).toBe('Hello, how can you help me?');
      expect(response.body.session.messages[1].role).toBe('assistant');
    });

    it('should return 400 if userId is missing', async () => {
      const response = await request(app)
        .post('/api/chat/sessions')
        .send({
          initialPrompt: 'Hello'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('userId is required');
    });
  });

  describe('GET /api/chat/sessions/:sessionId', () => {
    it('should get an existing chat session', async () => {
      // First create a session
      const createResponse = await request(app)
        .post('/api/chat/sessions')
        .send({
          userId: 'test-user-123',
          initialPrompt: 'Test message'
        });

      const sessionId = createResponse.body.session.id;

      // Then get it
      const getResponse = await request(app)
        .get(`/api/chat/sessions/${sessionId}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.session.id).toBe(sessionId);
      expect(getResponse.body.session.messages).toHaveLength(2);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .get('/api/chat/sessions/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Session not found');
    });
  });

  describe('POST /api/chat/sessions/:sessionId/messages', () => {
    it('should add a message to an existing session', async () => {
      // First create a session
      const createResponse = await request(app)
        .post('/api/chat/sessions')
        .send({
          userId: 'test-user-123'
        });

      const sessionId = createResponse.body.session.id;

      // Send a message
      const messageResponse = await request(app)
        .post(`/api/chat/sessions/${sessionId}/messages`)
        .send({
          content: 'What is the weather today?',
          userId: 'test-user-123'
        });

      expect(messageResponse.status).toBe(200);
      expect(messageResponse.body.success).toBe(true);
      expect(messageResponse.body.userMessage).toBeDefined();
      expect(messageResponse.body.userMessage.content).toBe('What is the weather today?');
      expect(messageResponse.body.assistantMessage).toBeDefined();
      expect(messageResponse.body.assistantMessage.role).toBe('assistant');
    });

    it('should return 400 if content is missing', async () => {
      const response = await request(app)
        .post('/api/chat/sessions/some-id/messages')
        .send({
          userId: 'test-user-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('content is required');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .post('/api/chat/sessions/non-existent-id/messages')
        .send({
          content: 'Hello',
          userId: 'test-user-123'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Session not found');
    });
  });

  describe('GET /api/chat/users/:userId/sessions', () => {
    it('should get all sessions for a user', async () => {
      const userId = 'test-user-456';
      
      // Create multiple sessions
      await request(app)
        .post('/api/chat/sessions')
        .send({ userId, initialPrompt: 'Session 1' });
      
      await request(app)
        .post('/api/chat/sessions')
        .send({ userId, initialPrompt: 'Session 2' });

      // Get all sessions
      const response = await request(app)
        .get(`/api/chat/users/${userId}/sessions`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sessions).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    it('should return empty array for user with no sessions', async () => {
      const response = await request(app)
        .get('/api/chat/users/no-sessions-user/sessions');

      expect(response.status).toBe(200);
      expect(response.body.sessions).toHaveLength(0);
      expect(response.body.count).toBe(0);
    });
  });

  describe('DELETE /api/chat/sessions/:sessionId', () => {
    it('should close an existing session', async () => {
      // First create a session
      const createResponse = await request(app)
        .post('/api/chat/sessions')
        .send({
          userId: 'test-user-123'
        });

      const sessionId = createResponse.body.session.id;

      // Close it
      const deleteResponse = await request(app)
        .delete(`/api/chat/sessions/${sessionId}`)
        .send({
          reason: 'User requested closure'
        });

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.message).toBe('Session closed successfully');

      // Verify it's closed
      const getResponse = await request(app)
        .get(`/api/chat/sessions/${sessionId}`);
      
      expect(getResponse.body.session.status).toBe('closed');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app)
        .delete('/api/chat/sessions/non-existent-id')
        .send({
          reason: 'Test'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Session not found');
    });
  });
});