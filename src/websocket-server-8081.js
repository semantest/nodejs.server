/**
 * SEMANTEST WebSocket Server - Production Ready
 * Port: 8081
 * Path: /ws
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Server configuration
const PORT = 8081;
const wss = new WebSocket.Server({ 
  port: PORT,
  path: '/ws'
});

console.log(`🚀 SEMANTEST WebSocket Server starting on port ${PORT}...`);

// Connection tracking
const connections = new Map();
const pendingRequests = new Map();

// Ensure generated-images directory exists
const imagesDir = path.join(__dirname, '../../generated-images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  console.log(`📁 Created directory: ${imagesDir}`);
}

/**
 * Download image from URL
 */
async function downloadImage(imageUrl, requestId) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const filename = `${requestId}_${timestamp}.png`;
    const filepath = path.join(imagesDir, filename);
    
    const file = fs.createWriteStream(filepath);
    const protocol = imageUrl.startsWith('https') ? https : http;
    
    protocol.get(imageUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✅ Image saved: ${filepath}`);
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

// Handle new connections
wss.on('connection', (ws, req) => {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const clientIp = req.socket.remoteAddress;
  
  console.log(`✅ New connection: ${clientId} from ${clientIp}`);
  
  // Store connection
  connections.set(clientId, {
    ws,
    type: null,
    authenticated: false,
    extensionId: null
  });
  
  // Handle messages
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      const client = connections.get(clientId);
      
      console.log(`📨 Received [${data.type}] from ${clientId}`);
      
      // Handle authentication
      if (data.type === 'authenticate') {
        client.type = data.clientType || 'unknown';
        client.authenticated = true;
        client.extensionId = data.extensionId || clientId;
        
        ws.send(JSON.stringify({
          type: 'authentication_success',
          clientId,
          message: `Authenticated as ${client.type}`
        }));
        
        console.log(`🔐 ${clientId} authenticated as ${client.type}`);
        return;
      }
      
      // Handle image generation request from CLI
      if (data.type === 'ImageGenerationRequestedEvent' || data.type === 'generate_image_request') {
        const requestId = data.requestId || `req_${Date.now()}`;
        
        console.log(`🎨 Image generation request: ${requestId}`);
        console.log(`   Prompt: ${data.prompt}`);
        console.log(`   Model: ${data.model || 'dall-e-3'}`);
        
        // Store request for tracking
        pendingRequests.set(requestId, {
          clientId,
          timestamp: Date.now(),
          data
        });
        
        // Find available extension
        let extensionFound = false;
        connections.forEach((conn, id) => {
          if (conn.type === 'extension' && conn.authenticated && conn.ws.readyState === WebSocket.OPEN) {
            // Forward to extension
            conn.ws.send(JSON.stringify({
              type: 'generate_image',
              requestId,
              prompt: data.prompt,
              model: data.model || 'dall-e-3',
              parameters: data.parameters || {},
              userId: data.userId || 'cli-user',
              correlationId: data.correlationId || requestId
            }));
            
            console.log(`➡️ Forwarded to extension ${id}`);
            extensionFound = true;
          }
        });
        
        if (!extensionFound) {
          console.error('❌ No available extension to handle request');
          ws.send(JSON.stringify({
            type: 'error',
            requestId,
            message: 'No extension available'
          }));
        }
      }
      
      // Handle image generated from Extension
      if (data.type === 'image_generated' || data.type === 'ImageGeneratedEvent') {
        const requestId = data.requestId;
        console.log(`✅ Image generated for request: ${requestId}`);
        console.log(`   Image URL: ${data.imageUrl}`);
        
        // Download image if URL provided
        let localPath = null;
        if (data.imageUrl) {
          try {
            localPath = await downloadImage(data.imageUrl, requestId);
            console.log(`💾 Image downloaded to: ${localPath}`);
          } catch (err) {
            console.error(`❌ Failed to download image: ${err.message}`);
          }
        }
        
        // Find original requester
        const request = pendingRequests.get(requestId);
        if (request) {
          const requester = connections.get(request.clientId);
          if (requester && requester.ws.readyState === WebSocket.OPEN) {
            // Send response back to CLI
            requester.ws.send(JSON.stringify({
              type: 'ImageGeneratedEvent',
              requestId,
              imageUrl: data.imageUrl,
              imagePath: localPath,
              metadata: data.metadata || {},
              correlationId: data.correlationId
            }));
            
            console.log(`➡️ Sent result back to CLI ${request.clientId}`);
          }
          
          // Clean up request
          pendingRequests.delete(requestId);
        }
      }
      
      // Handle generation progress
      if (data.type === 'image_generation_progress') {
        console.log(`📊 Progress for ${data.requestId}: ${data.progress}%`);
        
        const request = pendingRequests.get(data.requestId);
        if (request) {
          const requester = connections.get(request.clientId);
          if (requester && requester.ws.readyState === WebSocket.OPEN) {
            requester.ws.send(JSON.stringify(data));
          }
        }
      }
      
      // Handle generation failure
      if (data.type === 'image_generation_failed') {
        console.error(`❌ Generation failed for ${data.requestId}: ${data.error}`);
        
        const request = pendingRequests.get(data.requestId);
        if (request) {
          const requester = connections.get(request.clientId);
          if (requester && requester.ws.readyState === WebSocket.OPEN) {
            requester.ws.send(JSON.stringify(data));
          }
          pendingRequests.delete(data.requestId);
        }
      }
      
      // Handle heartbeat
      if (data.type === 'ping' || data.type === 'heartbeat') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
      
    } catch (err) {
      console.error(`❌ Error processing message from ${clientId}:`, err);
      ws.send(JSON.stringify({
        type: 'error',
        message: err.message
      }));
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log(`❌ Disconnected: ${clientId}`);
    connections.delete(clientId);
  });
  
  // Handle errors
  ws.on('error', (err) => {
    console.error(`⚠️ WebSocket error for ${clientId}:`, err);
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId,
    message: 'Connected to SEMANTEST WebSocket Server',
    port: PORT,
    requiresAuth: true
  }));
});

// Heartbeat mechanism
setInterval(() => {
  connections.forEach((client, id) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.ping();
    } else {
      connections.delete(id);
    }
  });
}, 30000);

console.log(`✅ SEMANTEST WebSocket Server running on ws://localhost:${PORT}/ws`);
console.log(`📊 Status: Ready for CLI and Extension connections`);
console.log(`🎨 Image generation pipeline: ACTIVE`);
console.log(`💾 Images will be saved to: ${imagesDir}`);