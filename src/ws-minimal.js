const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8082, path: "/ws" });

wss.on("connection", (ws, req) => {
  console.log(`✅ New connection from ${req.socket.remoteAddress}`);
  
  ws.on("message", (msg) => {
    console.log("📨 Received:", msg.toString());
    ws.send(JSON.stringify({ type: "ack", message: "Message received" }));
  });
  
  ws.on("close", () => {
    console.log("❌ Connection closed");
  });
  
  ws.on("error", (err) => {
    console.error("⚠️ WebSocket error:", err);
  });
  
  // Send welcome message
  ws.send(JSON.stringify({ type: "welcome", message: "Connected to minimal WebSocket server" }));
});

console.log("🚀 Minimal WebSocket server running on ws://localhost:8082/ws");