/**
 * ChatGPT Addon Bundle Generator
 * Creates a self-contained bundle for dynamic loading
 */

const fs = require('fs').promises;
const path = require('path');

class AddonBundler {
  constructor(addonPath) {
    this.addonPath = addonPath;
    this.manifest = null;
  }

  async loadManifest() {
    const manifestPath = path.join(this.addonPath, 'manifest.json');
    const content = await fs.readFile(manifestPath, 'utf-8');
    this.manifest = JSON.parse(content);
    return this.manifest;
  }

  async bundleScripts() {
    if (!this.manifest || !this.manifest.scripts) {
      throw new Error('No manifest or scripts found');
    }

    const bundledCode = [];
    
    // Add addon namespace
    bundledCode.push(`
// ChatGPT Addon Bundle - Generated ${new Date().toISOString()}
(function() {
  console.log('🔌 Loading ChatGPT addon bundle...');
  
  // Create addon namespace
  window.chatGPTAddon = window.chatGPTAddon || {};
  
`);

    // Bundle each script
    for (const scriptFile of this.manifest.scripts) {
      try {
        const scriptPath = path.join(this.addonPath, scriptFile);
        const scriptContent = await fs.readFile(scriptPath, 'utf-8');
        
        bundledCode.push(`
  // === ${scriptFile} ===
  (function() {
    ${scriptContent}
  })();
  
`);
      } catch (error) {
        console.error(`Failed to bundle ${scriptFile}:`, error);
      }
    }

    // Close namespace
    bundledCode.push(`
  console.log('✅ ChatGPT addon bundle loaded successfully');
})();
`);

    return bundledCode.join('\n');
  }

  async generateBundle() {
    await this.loadManifest();
    const bundle = await this.bundleScripts();
    
    return {
      manifest: this.manifest,
      bundle: bundle,
      metadata: {
        bundledAt: new Date().toISOString(),
        version: this.manifest.version,
        scriptCount: this.manifest.scripts.length
      }
    };
  }
}

// Export for use in REST server
module.exports = AddonBundler;