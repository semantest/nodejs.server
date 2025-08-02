/**
 * Development server for testing dynamic addon loading
 * Bypasses TypeScript compilation errors
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = 3003;

// CORS configuration for Chrome extensions
app.use(cors({
  origin: (origin, callback) => {
    // Allow chrome extensions and localhost
    if (!origin || origin.startsWith('chrome-extension://') || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// ChatGPT addon manifest
const CHATGPT_MANIFEST = {
  addon_id: 'chatgpt_addon',
  name: 'ChatGPT',
  version: '1.0.0',
  description: 'Enhances ChatGPT with additional features',
  entry_point: 'index.js',
  permissions: ['activeTab', 'storage'],
  domains: ['chat.openai.com', 'chatgpt.com']
};

// ChatGPT addon metadata
const CHATGPT_METADATA = {
  id: 'chatgpt_addon',
  name: 'ChatGPT',
  version: '1.0.0',
  author: 'Semantest',
  created: new Date().toISOString(),
  updated: new Date().toISOString()
};

// API Routes
app.get('/api/addons', (req, res) => {
  console.log('📋 Request for addon list');
  res.json([CHATGPT_MANIFEST]);
});

app.get('/api/addons/chatgpt/manifest', (req, res) => {
  console.log('📋 Request for ChatGPT addon manifest');
  res.json(CHATGPT_MANIFEST);
});

app.get('/api/addons/chatgpt/bundle', async (req, res) => {
  console.log('📦 Request for ChatGPT addon bundle');
  
  try {
    // Read all addon files
    const addonDir = path.join(__dirname, '../extension.chrome/src/addons/chatgpt');
    const files = [
      'state-detector.js',
      'controller.js',
      'button-clicker.js',
      'direct-send.js',
      'image-generator.js',
      'image-downloader.js',
      'queue-manager.js',
      'debug-listener.js',  // Add debug listener
      'index.js'
    ];
    
    // Bundle all files
    let bundle = '// ChatGPT Addon Bundle\n';
    bundle += '(function() {\n';
    bundle += '  "use strict";\n\n';
    
    for (const file of files) {
      const filePath = path.join(addonDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        bundle += `  // === ${file} ===\n`;
        bundle += content.split('\n').map(line => '  ' + line).join('\n');
        bundle += '\n\n';
      } catch (error) {
        console.error(`Failed to read ${file}:`, error);
      }
    }
    
    bundle += '})();\n';
    
    res.type('application/javascript');
    res.send(bundle);
  } catch (error) {
    console.error('Error creating bundle:', error);
    res.status(500).json({ error: 'Failed to create bundle' });
  }
});

app.get('/api/addons/chatgpt/metadata', (req, res) => {
  console.log('ℹ️ Request for ChatGPT addon metadata');
  res.json(CHATGPT_METADATA);
});

app.post('/api/addons/cache/clear', (req, res) => {
  console.log('🗑️ Cache clear requested');
  res.json({ success: true, message: 'Cache cleared' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Dev server running on http://localhost:${PORT}`);
  console.log('📍 Addon endpoints:');
  console.log(`   GET http://localhost:${PORT}/api/addons`);
  console.log(`   GET http://localhost:${PORT}/api/addons/chatgpt/manifest`);
  console.log(`   GET http://localhost:${PORT}/api/addons/chatgpt/bundle`);
  console.log('✅ CORS configured for Chrome extensions');
});