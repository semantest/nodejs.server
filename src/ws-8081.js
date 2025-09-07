const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: 8081 });

wss.on("connection", (ws) => {
  console.log("✅ Client connected on port 8081");
  
  ws.on("message", (msg) => {
    console.log("📨 Message:", msg.toString());
    ws.send("ack");
  });
  
  ws.on("close", () => {
    console.log("❌ Client disconnected");
  });
});

console.log("🚀 WebSocket server running on ws://localhost:8081");