#!/usr/bin/env node
/**
 * SEMANTEST WebSocket Server - URGENT CEO PRIORITY
 * Handles image generation flow: CLI → Server → Extension → ChatGPT
 * @author Fran - WebSocket Lead
 */

const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('🚀 SEMANTEST Server Starting - CEO PRIORITY MODE');

// HTTP Server on port 8080
const httpServer = http.createServer((req, res) => {
  console.log(`📥 HTTP ${req.method} ${req.url}`);
  
  if (req.url === '/events' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        console.log('🎯 Received event:', event);
        
        // Forward to extension via WebSocket
        broadcastToExtensions(event);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'accepted',
          correlationId: event.payload?.correlationId 
        }));
      } catch (error) {
        console.error('❌ Error parsing event:', error);
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SEMANTEST Server Running - CEO Priority Mode');
  }
});

// WebSocket Server on port 8082 (8081 is taken by Docker)
const wss = new WebSocket.Server({ port: 8082 });
const extensionConnections = new Set();

wss.on('connection', (ws) => {
  console.log('✅ Extension connected via WebSocket');
  extensionConnections.add(ws);
  
  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'ServerConnectedEvent',
    payload: {
      message: 'Connected to SEMANTEST server',
      timestamp: Date.now()
    }
  }));
  
  ws.on('message', async (message) => {
    try {
      const event = JSON.parse(message);
      console.log('📨 Message from extension:', event);
      
      // Handle image URL from ChatGPT
      if (event.type === 'ImageGeneratedEvent') {
        await handleImageGenerated(event.payload);
      }
      
      // Handle state updates
      if (event.type === 'ChatGPTStateEvent') {
        console.log('💡 ChatGPT state:', event.payload.isIdle ? 'IDLE ✅' : 'BUSY 🔄');
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 Extension disconnected');
    extensionConnections.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    extensionConnections.delete(ws);
  });
});

// Broadcast to all connected extensions
function broadcastToExtensions(event) {
  console.log(`📤 Broadcasting to ${extensionConnections.size} extension(s)`);
  
  const message = JSON.stringify(event);
  extensionConnections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// Handle image download
async function handleImageGenerated(payload) {
  const { imageUrl, outputPath, correlationId } = payload;
  
  console.log('🖼️ Downloading image from ChatGPT...');
  console.log('   URL:', imageUrl);
  console.log('   Output:', outputPath || '/tmp/semantest-image.png');
  
  const finalPath = outputPath || `/tmp/semantest-${Date.now()}.png`;
  
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(finalPath);
    
    https.get(imageUrl, (response) => {
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('✅ Image saved to:', finalPath);
        
        // Notify CLI of success
        broadcastToExtensions({
          type: 'ImageDownloadedEvent',
          payload: {
            correlationId,
            path: finalPath,
            success: true
          }
        });
        
        resolve(finalPath);
      });
    }).on('error', (err) => {
      fs.unlink(finalPath, () => {}); // Delete incomplete file
      console.error('❌ Download error:', err);
      reject(err);
    });
  });
}

// Start HTTP server
httpServer.listen(8080, () => {
  console.log('🌐 HTTP Server listening on port 8080');
});

console.log('🔌 WebSocket Server listening on port 8082');
console.log('');
console.log('📋 CEO PRIORITY STATUS:');
console.log('  ✅ WebSocket ready for Fran');
console.log('  ✅ HTTP endpoint ready for CLI');
console.log('  ✅ Image download handler ready');
console.log('');
console.log('🎯 Test with:');
console.log('  curl -X POST http://localhost:8080/events \\');
console.log('    -H "Content-Type: application/json" \\');
console.log('    -d \'{"type":"ImageGenerationRequestedEvent","payload":{"prompt":"a red circle","outputPath":"/tmp/test.png"}}\'');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down SEMANTEST server...');
  
  extensionConnections.forEach(ws => ws.close());
  wss.close();
  httpServer.close();
  
  process.exit(0);
});