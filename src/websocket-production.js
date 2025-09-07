const WebSocket = require("ws");

// IMPORTANT: Port 8081 is occupied by Nexus Docker container
// Using port 8085 instead - Extension needs to connect to ws://localhost:8085/ws
const PORT = 8085;
const wss = new WebSocket.Server({ 
  port: PORT,
  path: "/ws"
});

console.log(`🚀 SEMANTEST WebSocket Server starting on port ${PORT}...`);

// Connection tracking
const connections = new Map();

wss.on("connection", (ws, req) => {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`✅ New connection: ${clientId} from ${req.socket.remoteAddress}`);
  
  connections.set(clientId, {
    ws,
    type: null,
    authenticated: false
  });
  
  // Handle messages
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`📨 Received from ${clientId}:`, data.type);
      
      // Handle authentication
      if (data.type === "authenticate") {
        connections.get(clientId).type = data.clientType;
        connections.get(clientId).authenticated = true;
        
        ws.send(JSON.stringify({
          type: "authentication_success",
          clientId,
          message: `Authenticated as ${data.clientType}`
        }));
        
        console.log(`🔐 ${clientId} authenticated as ${data.clientType}`);
        return;
      }
      
      // Handle image generation request (from CLI)
      if (data.type === "ImageGenerationRequestedEvent") {
        console.log(`🎨 Image generation request:`, data.requestId);
        
        // Forward to extension
        connections.forEach((conn, id) => {
          if (conn.type === "extension" && conn.authenticated) {
            conn.ws.send(JSON.stringify({
              type: "generate_image",
              ...data
            }));
            console.log(`➡️ Forwarded to extension ${id}`);
          }
        });
      }
      
      // Handle image generated (from Extension)
      if (data.type === "image_generated") {
        console.log(`✅ Image generated:`, data.requestId);
        
        // Forward to CLI
        connections.forEach((conn, id) => {
          if (conn.type === "cli" && conn.authenticated) {
            conn.ws.send(JSON.stringify({
              type: "ImageGeneratedEvent",
              ...data
            }));
            console.log(`➡️ Forwarded to CLI ${id}`);
          }
        });
      }
      
    } catch (err) {
      console.error(`❌ Error processing message from ${clientId}:`, err);
      ws.send(JSON.stringify({
        type: "error",
        message: err.message
      }));
    }
  });
  
  // Handle disconnection
  ws.on("close", () => {
    console.log(`❌ Disconnected: ${clientId}`);
    connections.delete(clientId);
  });
  
  // Handle errors
  ws.on("error", (err) => {
    console.error(`⚠️ WebSocket error for ${clientId}:`, err);
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: "welcome",
    clientId,
    message: "Connected to SEMANTEST WebSocket Server",
    port: PORT,
    note: "Extension must connect to port 8085 (port 8081 is occupied by Nexus)"
  }));
});

console.log(`✅ SEMANTEST WebSocket Server running on ws://localhost:${PORT}/ws`);
console.log(`⚠️ NOTE: Extension must be updated to connect to port ${PORT} instead of 8081`);