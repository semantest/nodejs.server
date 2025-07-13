/**
 * @fileoverview CSRF Helper Functions
 * @description Utility functions for CSRF protection in forms and AJAX requests
 * @author Web-Buddy Team
 */

import { Request, Response } from 'express';
import { CSRFService, CSRFConfig } from './csrf-service';

export interface CSRFTokenInfo {
  token: string;
  headerName: string;
  cookieName: string;
  formFieldName: string;
}

export interface FormCSRFOptions {
  formId?: string;
  inputName?: string;
  inputType?: 'hidden' | 'text';
  inputClass?: string;
  autoSubmit?: boolean;
}

export interface AjaxCSRFOptions {
  headerName?: string;
  cookieName?: string;
  autoInclude?: boolean;
  beforeSend?: (xhr: XMLHttpRequest, token: string) => void;
}

/**
 * CSRF Helper Class
 * Provides utility functions for integrating CSRF protection with forms and AJAX
 */
export class CSRFHelpers {
  constructor(private csrfService: CSRFService) {}

  /**
   * Get CSRF token information for client-side use
   */
  public getTokenInfo(req: Request): CSRFTokenInfo {
    const config = this.csrfService.getConfig();
    const token = this.csrfService.getTokenFromCookie(req) || '';

    return {
      token,
      headerName: config.headerName,
      cookieName: config.cookieName,
      formFieldName: 'csrf_token'
    };
  }

  /**
   * Generate HTML for CSRF token hidden input field
   */
  public generateHiddenInput(req: Request, options?: FormCSRFOptions): string {
    const tokenInfo = this.getTokenInfo(req);
    const inputName = options?.inputName || tokenInfo.formFieldName;
    const inputClass = options?.inputClass || 'csrf-token';
    const inputType = options?.inputType || 'hidden';

    return `<input type="${inputType}" name="${inputName}" value="${tokenInfo.token}" class="${inputClass}" data-csrf-token="true" />`;
  }

  /**
   * Generate complete HTML form with CSRF protection
   */
  public generateFormHTML(
    req: Request,
    formAttributes: Record<string, string>,
    formContent: string,
    options?: FormCSRFOptions
  ): string {
    const csrfInput = this.generateHiddenInput(req, options);
    const formId = options?.formId || 'csrf-protected-form';
    
    // Build form attributes string
    const attrs = Object.entries(formAttributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');

    return `
      <form id="${formId}" ${attrs}>
        ${csrfInput}
        ${formContent}
      </form>
    `;
  }

  /**
   * Generate JavaScript code for CSRF token handling in AJAX requests
   */
  public generateAjaxScript(req: Request, options?: AjaxCSRFOptions): string {
    const tokenInfo = this.getTokenInfo(req);
    const headerName = options?.headerName || tokenInfo.headerName;
    const cookieName = options?.cookieName || tokenInfo.cookieName;

    return `
(function() {
  // CSRF Protection for AJAX Requests
  const CSRF = {
    token: '${tokenInfo.token}',
    headerName: '${headerName}',
    cookieName: '${cookieName}',
    
    // Get token from cookie
    getTokenFromCookie: function() {
      const name = this.cookieName + '=';
      const decodedCookie = decodeURIComponent(document.cookie);
      const cookies = decodedCookie.split(';');
      
      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.indexOf(name) === 0) {
          return cookie.substring(name.length);
        }
      }
      return null;
    },
    
    // Get current token (preferring cookie over initial value)
    getCurrentToken: function() {
      return this.getTokenFromCookie() || this.token;
    },
    
    // Setup AJAX defaults for jQuery
    setupJQuery: function() {
      if (typeof $ !== 'undefined') {
        $.ajaxSetup({
          beforeSend: function(xhr, settings) {
            if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
              xhr.setRequestHeader(CSRF.headerName, CSRF.getCurrentToken());
            }
          }
        });
      }
    },
    
    // Setup AJAX defaults for Axios
    setupAxios: function() {
      if (typeof axios !== 'undefined') {
        axios.defaults.headers.common[this.headerName] = this.getCurrentToken();
        
        // Update token on each request
        axios.interceptors.request.use(function(config) {
          if (!/^(get|head|options|trace)$/i.test(config.method)) {
            config.headers[CSRF.headerName] = CSRF.getCurrentToken();
          }
          return config;
        });
      }
    },
    
    // Setup AJAX defaults for Fetch API
    setupFetch: function() {
      const originalFetch = window.fetch;
      window.fetch = function(url, options = {}) {
        if (!options.headers) {
          options.headers = {};
        }
        
        const method = (options.method || 'GET').toUpperCase();
        if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
          options.headers[CSRF.headerName] = CSRF.getCurrentToken();
        }
        
        return originalFetch(url, options);
      };
    },
    
    // Add token to form
    addToForm: function(form) {
      const formElement = typeof form === 'string' ? document.getElementById(form) : form;
      if (!formElement) return false;
      
      // Remove existing CSRF input
      const existingInput = formElement.querySelector('input[data-csrf-token="true"]');
      if (existingInput) {
        existingInput.remove();
      }
      
      // Add new CSRF input
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'csrf_token';
      input.value = this.getCurrentToken();
      input.setAttribute('data-csrf-token', 'true');
      formElement.appendChild(input);
      
      return true;
    },
    
    // Update token in all forms
    updateAllForms: function() {
      const forms = document.querySelectorAll('form[data-csrf-protected="true"]');
      forms.forEach(form => this.addToForm(form));
    },
    
    // Initialize CSRF protection
    init: function() {
      this.setupJQuery();
      this.setupAxios();
      this.setupFetch();
      this.updateAllForms();
      
      console.log('🛡️ CSRF protection initialized');
    },
    
    // Refresh token from server
    refreshToken: function(callback) {
      fetch('/auth/csrf-token', {
        method: 'GET',
        credentials: 'include'
      })
      .then(response => response.json())
      .then(data => {
        if (data.csrfToken) {
          this.token = data.csrfToken;
          this.updateAllForms();
          console.log('🔄 CSRF token refreshed');
          if (callback) callback(data.csrfToken);
        }
      })
      .catch(error => {
        console.error('❌ Failed to refresh CSRF token:', error);
        if (callback) callback(null);
      });
    }
  };
  
  // Auto-initialize if enabled
  ${options?.autoInclude !== false ? 'CSRF.init();' : ''}
  
  // Make CSRF object globally available
  window.CSRF = CSRF;
})();`;
  }

  /**
   * Generate meta tags for CSRF token (for use in HTML head)
   */
  public generateMetaTags(req: Request): string {
    const tokenInfo = this.getTokenInfo(req);
    
    return `
<meta name="csrf-token" content="${tokenInfo.token}">
<meta name="csrf-header" content="${tokenInfo.headerName}">
<meta name="csrf-cookie" content="${tokenInfo.cookieName}">`;
  }

  /**
   * Generate React/Vue.js compatible token object
   */
  public generateReactConfig(req: Request): string {
    const tokenInfo = this.getTokenInfo(req);
    
    return `window.CSRF_CONFIG = ${JSON.stringify({
      token: tokenInfo.token,
      headerName: tokenInfo.headerName,
      cookieName: tokenInfo.cookieName,
      formFieldName: tokenInfo.formFieldName
    }, null, 2)};`;
  }

  /**
   * Validate CSRF token from form data
   */
  public validateFormToken(req: Request, formFieldName = 'csrf_token'): boolean {
    const formToken = req.body?.[formFieldName];
    const cookieToken = this.csrfService.getTokenFromCookie(req);
    
    if (!formToken || !cookieToken) {
      return false;
    }
    
    const user = req.user as any;
    return this.csrfService.validateToken(
      formToken,
      cookieToken,
      user?.sessionId,
      user?.userId
    );
  }

  /**
   * Middleware to add CSRF token to response locals for templates
   */
  public templateMiddleware() {
    return (req: Request, res: Response, next: Function) => {
      res.locals.csrf = this.getTokenInfo(req);
      res.locals.csrfToken = res.locals.csrf.token;
      res.locals.csrfHiddenInput = this.generateHiddenInput(req);
      res.locals.csrfMetaTags = this.generateMetaTags(req);
      next();
    };
  }

  /**
   * Express middleware to provide CSRF helpers in response
   */
  public expressHelperMiddleware() {
    return (req: Request, res: Response, next: Function) => {
      // Add helper methods to response object
      res.csrf = {
        getToken: () => this.getTokenInfo(req).token,
        getTokenInfo: () => this.getTokenInfo(req),
        hiddenInput: (options?: FormCSRFOptions) => this.generateHiddenInput(req, options),
        metaTags: () => this.generateMetaTags(req),
        ajaxScript: (options?: AjaxCSRFOptions) => this.generateAjaxScript(req, options),
        reactConfig: () => this.generateReactConfig(req)
      };
      
      next();
    };
  }

  /**
   * Generate complete HTML page with CSRF protection
   */
  public generateProtectedPage(req: Request, options: {
    title: string;
    bodyContent: string;
    includeJQuery?: boolean;
    includeAxios?: boolean;
    customCSS?: string;
    customJS?: string;
  }): string {
    const metaTags = this.generateMetaTags(req);
    const ajaxScript = this.generateAjaxScript(req);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
  ${metaTags}
  ${options.customCSS ? `<style>${options.customCSS}</style>` : ''}
  ${options.includeJQuery ? '<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>' : ''}
  ${options.includeAxios ? '<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>' : ''}
</head>
<body>
  ${options.bodyContent}
  
  <script>
    ${ajaxScript}
    ${options.customJS || ''}
  </script>
</body>
</html>`;
  }

  /**
   * Create form validation middleware
   */
  public createFormValidationMiddleware(formFieldName = 'csrf_token') {
    return (req: Request, res: Response, next: Function) => {
      const method = req.method.toUpperCase();
      
      // Skip validation for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return next();
      }
      
      // Validate CSRF token
      if (!this.validateFormToken(req, formFieldName)) {
        return res.status(403).json({
          error: 'CSRF validation failed',
          message: 'Invalid or missing CSRF token in form data'
        });
      }
      
      next();
    };
  }

  /**
   * Create API response with CSRF token information
   */
  public createTokenResponse(req: Request): any {
    const tokenInfo = this.getTokenInfo(req);
    
    return {
      csrfToken: tokenInfo.token,
      headerName: tokenInfo.headerName,
      cookieName: tokenInfo.cookieName,
      formFieldName: tokenInfo.formFieldName,
      usage: {
        forms: `Add <input type="hidden" name="${tokenInfo.formFieldName}" value="${tokenInfo.token}"> to your forms`,
        ajax: `Include header "${tokenInfo.headerName}: ${tokenInfo.token}" in your AJAX requests`,
        meta: `Add <meta name="csrf-token" content="${tokenInfo.token}"> to your HTML head`
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Export utility functions

/**
 * Create CSRF helpers instance
 */
export function createCSRFHelpers(csrfService: CSRFService): CSRFHelpers {
  return new CSRFHelpers(csrfService);
}

/**
 * Quick helper to get CSRF token from request
 */
export function getCSRFToken(req: Request, csrfService: CSRFService): string {
  return csrfService.getTokenFromCookie(req) || '';
}

/**
 * Quick helper to validate CSRF token
 */
export function validateCSRFToken(
  req: Request,
  csrfService: CSRFService,
  formFieldName = 'csrf_token'
): boolean {
  const helpers = new CSRFHelpers(csrfService);
  return helpers.validateFormToken(req, formFieldName);
}

/**
 * Generate CSRF protection snippet for external use
 */
export function generateCSRFSnippet(req: Request, csrfService: CSRFService): {
  html: string;
  javascript: string;
  meta: string;
} {
  const helpers = new CSRFHelpers(csrfService);
  
  return {
    html: helpers.generateHiddenInput(req),
    javascript: helpers.generateAjaxScript(req),
    meta: helpers.generateMetaTags(req)
  };
}