/**
 * @fileoverview CSRF Test Endpoints
 * @description Test endpoints for validating CSRF protection functionality
 * @author Web-Buddy Team
 */

import { Request, Response, Router } from 'express';
import { CSRFService } from './infrastructure/csrf-service';
import { createCSRFMiddlewareWithAuth } from './infrastructure/csrf-middleware';
import { createCSRFHelpers } from './infrastructure/csrf-helpers';
import { createJWTMiddleware } from './infrastructure/jwt-middleware';
import { TokenManager } from './infrastructure/token-manager';

/**
 * Create test router for CSRF functionality
 */
export function createCSRFTestRouter(
  csrfService: CSRFService,
  tokenManager: TokenManager
): Router {
  const router = Router();
  const csrfHelpers = createCSRFHelpers(csrfService);

  // Serve the demo page
  router.get('/demo', (req: Request, res: Response) => {
    try {
      const tokenInfo = csrfHelpers.getTokenInfo(req);
      const ajaxScript = csrfHelpers.generateAjaxScript(req);
      
      const demoHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSRF Test Demo - Semantest</title>
  ${csrfHelpers.generateMetaTags(req)}
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .section { border: 1px solid #ddd; margin: 20px 0; padding: 20px; border-radius: 5px; }
    button { margin: 5px; padding: 10px 15px; background: #007acc; color: white; border: none; border-radius: 3px; cursor: pointer; }
    button:hover { background: #005a9e; }
    .result { margin: 10px 0; padding: 10px; border-radius: 3px; font-family: monospace; }
    .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
    .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
    input, textarea { width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>🛡️ CSRF Protection Test Demo</h1>
  
  <div class="section">
    <h2>Current Token Info</h2>
    <p><strong>Token:</strong> <span id="current-token">${tokenInfo.token}</span></p>
    <p><strong>Header:</strong> ${tokenInfo.headerName}</p>
    <p><strong>Cookie:</strong> ${tokenInfo.cookieName}</p>
    <button onclick="refreshToken()">Refresh Token</button>
  </div>
  
  <div class="section">
    <h2>Form Test</h2>
    <form id="test-form" onsubmit="submitForm(event)">
      ${csrfHelpers.generateHiddenInput(req)}
      <input type="text" name="testField" placeholder="Test data" required>
      <button type="submit">Submit Form</button>
    </form>
  </div>
  
  <div class="section">
    <h2>AJAX Tests</h2>
    <button onclick="testAjax('GET')">GET (Safe)</button>
    <button onclick="testAjax('POST')">POST (Protected)</button>
    <button onclick="testAjax('PUT')">PUT (Protected)</button>
    <button onclick="testAjax('DELETE')">DELETE (Protected)</button>
    <br><br>
    <textarea id="ajax-data" placeholder="Request data (JSON)">${JSON.stringify({test: 'data'}, null, 2)}</textarea>
  </div>
  
  <div class="section">
    <h2>Extension Test</h2>
    <input type="text" id="extension-id" placeholder="Extension ID" value="example-extension-id">
    <button onclick="testExtension()">Test Extension Request</button>
  </div>
  
  <div class="section">
    <h2>Invalid Token Test</h2>
    <button onclick="testInvalidToken()">Test Invalid Token</button>
    <button onclick="testMissingToken()">Test Missing Token</button>
  </div>
  
  <div id="results"></div>
  
  <script>
    ${ajaxScript}
    
    function showResult(title, data, isError = false) {
      const results = document.getElementById('results');
      const div = document.createElement('div');
      div.className = \`result \${isError ? 'error' : 'success'}\`;
      div.innerHTML = \`<strong>\${title}:</strong><br><pre>\${JSON.stringify(data, null, 2)}</pre>\`;
      results.insertBefore(div, results.firstChild);
    }
    
    async function refreshToken() {
      try {
        const response = await fetch('/auth/csrf-token', { credentials: 'include' });
        const data = await response.json();
        document.getElementById('current-token').textContent = data.csrfToken;
        CSRF.token = data.csrfToken;
        CSRF.updateAllForms();
        showResult('Token Refresh', data);
      } catch (error) {
        showResult('Token Refresh Error', { error: error.message }, true);
      }
    }
    
    async function submitForm(event) {
      event.preventDefault();
      const formData = new FormData(event.target);
      const data = Object.fromEntries(formData.entries());
      
      try {
        const response = await fetch('/test/csrf/form-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'include'
        });
        const result = await response.json();
        showResult('Form Submit', result, !response.ok);
      } catch (error) {
        showResult('Form Submit Error', { error: error.message }, true);
      }
    }
    
    async function testAjax(method) {
      const data = JSON.parse(document.getElementById('ajax-data').value || '{}');
      
      try {
        const response = await fetch('/test/csrf/ajax-test', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: method !== 'GET' ? JSON.stringify(data) : undefined,
          credentials: 'include'
        });
        const result = await response.json();
        showResult(\`\${method} Request\`, result, !response.ok);
      } catch (error) {
        showResult(\`\${method} Error\`, { error: error.message }, true);
      }
    }
    
    async function testExtension() {
      const extensionId = document.getElementById('extension-id').value;
      
      try {
        const response = await fetch('/test/csrf/ajax-test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': \`chrome-extension://\${extensionId}\`,
            'X-Extension-Id': extensionId
          },
          body: JSON.stringify({ test: 'extension request' }),
          credentials: 'include'
        });
        const result = await response.json();
        showResult('Extension Request', result, !response.ok);
      } catch (error) {
        showResult('Extension Error', { error: error.message }, true);
      }
    }
    
    async function testInvalidToken() {
      try {
        const response = await fetch('/test/csrf/ajax-test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': 'invalid-token-12345'
          },
          body: JSON.stringify({ test: 'invalid token' }),
          credentials: 'include'
        });
        const result = await response.json();
        showResult('Invalid Token Test', result, !response.ok);
      } catch (error) {
        showResult('Invalid Token Error', { error: error.message }, true);
      }
    }
    
    async function testMissingToken() {
      // Temporarily disable automatic token addition
      const originalFetch = window.fetch;
      window.fetch = originalFetch;
      
      try {
        const response = await originalFetch('/test/csrf/ajax-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'missing token' }),
          credentials: 'include'
        });
        const result = await response.json();
        showResult('Missing Token Test', result, !response.ok);
      } catch (error) {
        showResult('Missing Token Error', { error: error.message }, true);
      } finally {
        // Restore CSRF protection
        CSRF.setupFetch();
      }
    }
  </script>
</body>
</html>`;
      
      res.send(demoHTML);
    } catch (error) {
      console.error('Error serving CSRF demo:', error);
      res.status(500).json({ error: 'Failed to serve demo page' });
    }
  });

  // Test endpoint for form submissions
  router.post('/form-submit',
    createCSRFMiddlewareWithAuth(csrfService, {
      allowedExtensionIds: process.env.ALLOWED_EXTENSION_IDS?.split(',') || []
    }),
    (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'Form submitted successfully with CSRF protection',
        data: req.body,
        timestamp: new Date().toISOString(),
        csrfToken: req.csrfToken
      });
    }
  );

  // Test endpoint for AJAX requests
  router.all('/ajax-test',
    createCSRFMiddlewareWithAuth(csrfService, {
      allowedExtensionIds: process.env.ALLOWED_EXTENSION_IDS?.split(',') || []
    }),
    (req: Request, res: Response) => {
      res.json({
        success: true,
        message: `${req.method} request processed successfully with CSRF protection`,
        method: req.method,
        data: req.body,
        headers: {
          origin: req.headers.origin,
          userAgent: req.headers['user-agent'],
          extensionId: req.headers['x-extension-id']
        },
        timestamp: new Date().toISOString(),
        csrfToken: req.csrfToken,
        isExtensionRequest: csrfService.isExtensionRequest(req)
      });
    }
  );

  // Endpoint to test CSRF without authentication
  router.post('/public-test',
    (req: Request, res: Response, next) => {
      // Apply CSRF protection without JWT requirement
      const csrfMiddleware = createCSRFMiddlewareWithAuth(csrfService, {
        skipPaths: [],
        allowedExtensionIds: process.env.ALLOWED_EXTENSION_IDS?.split(',') || []
      });
      csrfMiddleware(req, res, next);
    },
    (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'Public endpoint with CSRF protection',
        data: req.body,
        timestamp: new Date().toISOString()
      });
    }
  );

  // Endpoint to test JWT + CSRF protection
  router.post('/protected-test',
    createJWTMiddleware({ tokenManager }),
    createCSRFMiddlewareWithAuth(csrfService, {
      allowedExtensionIds: process.env.ALLOWED_EXTENSION_IDS?.split(',') || []
    }),
    (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'Protected endpoint with JWT + CSRF protection',
        user: {
          userId: req.user?.userId,
          sessionId: req.user?.sessionId
        },
        data: req.body,
        timestamp: new Date().toISOString(),
        csrfToken: req.csrfToken
      });
    }
  );

  // Token statistics endpoint
  router.get('/stats', (req: Request, res: Response) => {
    const stats = csrfService.getTokenStats();
    res.json({
      csrf: stats,
      timestamp: new Date().toISOString()
    });
  });

  // Health check for CSRF system
  router.get('/health', (req: Request, res: Response) => {
    try {
      const tokenInfo = csrfHelpers.getTokenInfo(req);
      const config = csrfService.getConfig();
      
      res.json({
        status: 'healthy',
        csrfEnabled: true,
        tokenPresent: !!tokenInfo.token,
        config: {
          headerName: config.headerName,
          cookieName: config.cookieName,
          tokenExpiry: config.tokenExpiry,
          secureCookie: config.secureCookie
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

/**
 * Helper function to add CSRF test routes to existing app
 */
export function addCSRFTestRoutes(
  app: any,
  csrfService: CSRFService,
  tokenManager: TokenManager
): void {
  const testRouter = createCSRFTestRouter(csrfService, tokenManager);
  app.use('/test/csrf', testRouter);
  console.log('🧪 CSRF test routes added at /test/csrf');
}