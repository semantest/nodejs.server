/**
 * Chrome Extension WebSocket Connection Helper
 * For Wences to test extension connection to SEMANTEST server
 */

const WebSocket = require('ws');

console.log('🔌 Chrome Extension WebSocket Connection Helper');
console.log('==========================================');

const WS_URL = 'ws://localhost:8081';
const EXTENSION_ID = 'semantest-extension-001';

console.log(`📡 Connecting to: ${WS_URL}`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to WebSocket server!');
  
  // Authenticate as extension
  console.log('🔐 Authenticating as Chrome Extension...');
  ws.send(JSON.stringify({
    type: 'authenticate',
    clientType: 'extension',
    extensionId: EXTENSION_ID,
    metadata: {
      version: '1.0.0',
      capabilities: ['image-generation', 'dall-e-3']
    }
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📨 Received:', message.type);
  
  if (message.type === 'ServerConnectedEvent') {
    console.log('   Server connected:', message.payload.message);
  }
  
  if (message.type === 'authentication_success') {
    console.log('   ✅ Authentication successful!');
    console.log('   🎯 Ready to receive image generation requests');
  }
  
  if (message.type === 'generate_image') {
    console.log('   🎨 Image generation request received!');
    console.log('   Request ID:', message.requestId);
    console.log('   Prompt:', message.prompt);
    console.log('   Model:', message.model);
    
    // Simulate image generation
    setTimeout(() => {
      console.log('   📸 Sending generated image response...');
      ws.send(JSON.stringify({
        type: 'image_generated',
        requestId: message.requestId,
        imageUrl: 'https://example.com/generated-image.png',
        metadata: {
          model: message.model,
          prompt: message.prompt,
          width: 1024,
          height: 1024,
          generatedAt: new Date().toISOString()
        },
        correlationId: message.correlationId
      }));
      console.log('   ✅ Image response sent!');
    }, 2000);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err.message);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
});

// Keep alive with heartbeat
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'heartbeat',
      extensionId: EXTENSION_ID,
      status: {
        available: true,
        queueSize: 0,
        activeRequests: 0
      }
    }));
  }
}, 30000);

console.log('\n📝 Instructions for Wences:');
console.log('1. This simulates a Chrome Extension connection');
console.log('2. It authenticates and waits for image generation requests');
console.log('3. When it receives a request, it sends back a mock response');
console.log('4. Use this code in your Chrome Extension!');
console.log('\nPress Ctrl+C to stop the extension simulator.');