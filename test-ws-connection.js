const WebSocket = require('ws');

console.log('🧪 Testing WebSocket connection to ws://localhost:8081...');

const ws = new WebSocket('ws://localhost:8081');

ws.on('open', () => {
  console.log('✅ Connected successfully!');
  
  // Send test message
  ws.send(JSON.stringify({
    type: 'test',
    message: 'Hello from test client'
  }));
  
  // Close after 2 seconds
  setTimeout(() => {
    ws.close();
    console.log('🔌 Connection closed');
    process.exit(0);
  }, 2000);
});

ws.on('message', (data) => {
  console.log('📨 Received:', data.toString());
});

ws.on('error', (err) => {
  console.error('❌ Connection error:', err.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('❌ Connection closed by server');
});