# 🚀 How to Launch the Server Locally

## Prerequisites

1. **Node.js 18+** installed
2. **npm** or **yarn** package manager

## Quick Start

### 1. Navigate to the server directory
```bash
cd /home/chous/work/semantest/nodejs.server
```

### 2. Install dependencies
```bash
npm install
```

### 3. Launch the server

#### Option A: Development mode (with TypeScript)
```bash
npm run dev:server
```

#### Option B: Production mode (compiled)
```bash
npm run start:server
```

## What happens when you start?

1. Server starts on **port 3003** (or PORT env variable)
2. Test data is automatically seeded in development mode
3. You'll see:
   ```
   ✅ Semantest Node.js Server started
   📡 HTTP API available at http://localhost:3003
   🔌 Health check at http://localhost:3003/health
   ```

## Available Endpoints

### Health Check
```bash
curl http://localhost:3003/health
```

### Item History Endpoints

#### Get all items
```bash
curl http://localhost:3003/api/items
```

#### Get item history
```bash
# Replace {item_id} with an actual item ID
curl http://localhost:3003/api/item/{item_id}/history
```

#### Create a new item
```bash
curl -X POST http://localhost:3003/api/items \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test-user" \
  -d '{"name": "My Test Item", "description": "Testing history"}'
```

#### Update an item
```bash
curl -X PUT http://localhost:3003/api/items/{item_id} \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test-user" \
  -d '{"description": "Updated description"}'
```

## Testing the History Feature

1. **Start the server** - it will seed 2 test items
2. **Get the list of items** to find their IDs:
   ```bash
   curl http://localhost:3003/api/items | jq
   ```
3. **Get history for a specific item**:
   ```bash
   curl http://localhost:3003/api/item/{item_id}/history | jq
   ```

## Filtering History

### By date range:
```bash
curl "http://localhost:3003/api/item/{item_id}/history?start_date=2024-01-01&end_date=2024-12-31"
```

### By action type:
```bash
curl "http://localhost:3003/api/item/{item_id}/history?action=status_changed"
```

## Environment Variables

Create a `.env` file in the nodejs.server directory:

```env
PORT=3003
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Troubleshooting

### Port already in use?
Change the port:
```bash
PORT=3004 npm run dev:server
```

### Dependencies not installed?
```bash
npm install
```

### TypeScript errors?
```bash
npm run build
```

## Next Steps

- The server uses in-memory storage by default
- To connect a real database, update the repository implementation
- Add authentication middleware for production use

---

Happy testing! 🎉