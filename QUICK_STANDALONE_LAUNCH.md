# 🚀 Quick Standalone Server Launch

Since the workspace has dependency issues, here's a quick standalone setup:

## Steps:

1. **Navigate to the server directory:**
   ```bash
   cd nodejs.server
   ```

2. **Use the standalone package.json:**
   ```bash
   mv package.json package-workspace.json
   mv package-standalone.json package.json
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start the server:**
   ```bash
   npm run dev
   ```

## The server will:
- Start on **http://localhost:3003**
- Have the item history endpoint at `/api/item/:item_id/history`
- Seed test data automatically

## Test it:
```bash
# Get all items
curl http://localhost:3003/api/items

# Get history (use an ID from above)
curl http://localhost:3003/api/item/{item_id}/history
```

## To restore workspace setup later:
```bash
mv package.json package-standalone.json
mv package-workspace.json package.json
```

---

This standalone setup avoids the workspace dependency issues!