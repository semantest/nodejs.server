#!/usr/bin/env node

/**
 * Semantest Polling Server
 * Provides polling endpoints for Chrome extension
 */

const http = require('http');
const WebSocket = require('ws');

class SemantestPollingServer {
  constructor() {
    this.pendingTasks = [];
    this.processedTasks = new Set();
    this.extensions = new Map();
    this.httpPort = 8080;
    this.wsPort = 8081;
  }

  start() {
    this.startHttpServer();
    this.startWebSocketServer();
    console.log('🚀 Semantest Polling Server Started');
  }

  startHttpServer() {
    const server = http.createServer((req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Extension-Id, X-Last-Id');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = new URL(req.url, `http://localhost:${this.httpPort}`);
      console.log(`📥 ${req.method} ${url.pathname}`);

      if (url.pathname === '/events' && req.method === 'POST') {
        this.handleEventSubmission(req, res);
      } else if (url.pathname === '/pending-tasks' && req.method === 'GET') {
        this.handlePendingTasks(req, res);
      } else if (url.pathname === '/task-status' && req.method === 'POST') {
        this.handleTaskStatus(req, res);
      } else if (url.pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'healthy', 
          pendingTasks: this.pendingTasks.length,
          extensionsConnected: this.extensions.size
        }));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(this.httpPort, () => {
      console.log(`🌐 HTTP Server listening on port ${this.httpPort}`);
    });
  }

  handleEventSubmission(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        console.log('🎯 Received event:', event.type);

        // Add to pending tasks
        this.pendingTasks.push({
          ...event,
          receivedAt: Date.now()
        });

        // Send to WebSocket clients (legacy support)
        this.broadcastToWebSockets(event);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'accepted',
          correlationId: event.payload?.correlationId || event.correlationId
        }));
      } catch (error) {
        console.error('Error processing event:', error);
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid event' }));
      }
    });
  }

  handlePendingTasks(req, res) {
    const extensionId = req.headers['x-extension-id'];
    const lastId = req.headers['x-last-id'];

    // Get unprocessed tasks
    const tasks = this.pendingTasks.filter(task => {
      return !this.processedTasks.has(task.id) || 
             (lastId && task.id > lastId);
    });

    // DON'T mark as processed here - wait for confirmation via task-status
    // This allows retries if the extension doesn't actually process them
    // tasks.forEach(task => this.processedTasks.add(task.id));

    // Clean old tasks (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 300000;
    this.pendingTasks = this.pendingTasks.filter(task => 
      task.receivedAt > fiveMinutesAgo
    );
    
    // Also clean old processed tasks
    if (this.processedTasks.size > 100) {
      this.processedTasks.clear();
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tasks }));
  }

  handleTaskStatus(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const status = JSON.parse(body);
        console.log('📊 Task status:', status);
        
        // Mark task as processed when it's delivered or completed
        if (status.taskId && (status.status === 'delivered' || 
            status.status === 'sent' || 
            status.status === 'completed')) {
          this.processedTasks.add(status.taskId);
        }
        
        res.writeHead(200);
        res.end(JSON.stringify({ received: true }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid status' }));
      }
    });
  }

  startWebSocketServer() {
    const wss = new WebSocket.Server({ port: this.wsPort });

    wss.on('connection', (ws) => {
      const extensionId = `ext_${Date.now()}`;
      this.extensions.set(extensionId, ws);
      console.log('✅ Extension connected via WebSocket');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          console.log('📨 Message from extension:', data);
        } catch (error) {
          console.error('Invalid message:', error);
        }
      });

      ws.on('close', () => {
        this.extensions.delete(extensionId);
        console.log('🔌 Extension disconnected');
      });
    });

    console.log(`🔌 WebSocket Server listening on port ${this.wsPort}`);
  }

  broadcastToWebSockets(event) {
    const message = JSON.stringify(event);
    let sent = 0;
    
    this.extensions.forEach((ws, id) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        sent++;
      }
    });
    
    console.log(`📤 Broadcasting to ${sent} extension(s)`);
  }
}

// Start server
const server = new SemantestPollingServer();
server.start();

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});