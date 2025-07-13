/**
 * @fileoverview Client-side CSRF Protection Library
 * @description Standalone JavaScript library for handling CSRF tokens in web applications
 * @author Web-Buddy Team
 * @version 1.0.0
 */

(function(window) {
  'use strict';

  /**
   * CSRF Protection Client Library
   * Provides automatic CSRF token handling for forms and AJAX requests
   */
  class CSRFClient {
    constructor(config = {}) {
      this.config = {
        headerName: 'X-CSRF-Token',
        cookieName: 'semantest-csrf-token',
        formFieldName: 'csrf_token',
        metaTagName: 'csrf-token',
        autoInitialize: true,
        debugMode: false,
        refreshEndpoint: '/auth/csrf-token',
        refreshOnError: true,
        ...config
      };

      this.token = null;
      this.isInitialized = false;
      this.retryCount = 0;
      this.maxRetries = 3;

      if (this.config.autoInitialize) {
        this.initialize();
      }
    }

    /**
     * Initialize CSRF protection
     */
    initialize() {
      if (this.isInitialized) {
        this.log('CSRF client already initialized');
        return;
      }

      try {
        // Get initial token from various sources
        this.token = this.getInitialToken();
        
        // Setup automatic AJAX protection
        this.setupAjaxProtection();
        
        // Setup form protection
        this.setupFormProtection();
        
        // Setup automatic token refresh
        this.setupTokenRefresh();
        
        this.isInitialized = true;
        this.log('🛡️ CSRF protection initialized', { token: this.token });
        
        // Dispatch initialization event
        this.dispatchEvent('csrf:initialized', { token: this.token });
        
      } catch (error) {
        this.log('❌ Failed to initialize CSRF protection:', error);
        throw error;
      }
    }

    /**
     * Get initial CSRF token from various sources
     */
    getInitialToken() {
      // Try meta tag first
      const metaTag = document.querySelector(`meta[name="${this.config.metaTagName}"]`);
      if (metaTag && metaTag.getAttribute('content')) {
        return metaTag.getAttribute('content');
      }

      // Try cookie
      const cookieToken = this.getTokenFromCookie();
      if (cookieToken) {
        return cookieToken;
      }

      // Try global config
      if (window.CSRF_CONFIG && window.CSRF_CONFIG.token) {
        return window.CSRF_CONFIG.token;
      }

      this.log('⚠️ No initial CSRF token found');
      return null;
    }

    /**
     * Get CSRF token from cookie
     */
    getTokenFromCookie() {
      const name = this.config.cookieName + '=';
      const decodedCookie = decodeURIComponent(document.cookie);
      const cookies = decodedCookie.split(';');
      
      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.indexOf(name) === 0) {
          return cookie.substring(name.length);
        }
      }
      return null;
    }

    /**
     * Get current active token (prefer cookie over stored value)
     */
    getCurrentToken() {
      const cookieToken = this.getTokenFromCookie();
      return cookieToken || this.token;
    }

    /**
     * Setup automatic AJAX protection for various libraries
     */
    setupAjaxProtection() {
      // Setup for jQuery
      this.setupJQueryProtection();
      
      // Setup for Axios
      this.setupAxiosProtection();
      
      // Setup for Fetch API
      this.setupFetchProtection();
      
      // Setup for XMLHttpRequest
      this.setupXHRProtection();
    }

    /**
     * Setup jQuery AJAX protection
     */
    setupJQueryProtection() {
      if (typeof window.$ !== 'undefined' && window.$.ajaxSetup) {
        const self = this;
        
        window.$.ajaxSetup({
          beforeSend: function(xhr, settings) {
            if (self.shouldAddToken(settings.type, settings.url)) {
              const token = self.getCurrentToken();
              if (token) {
                xhr.setRequestHeader(self.config.headerName, token);
                self.log('🔒 Added CSRF token to jQuery request', { 
                  method: settings.type, 
                  url: settings.url 
                });
              }
            }
          },
          error: function(xhr, status, error) {
            if (xhr.status === 403 && self.config.refreshOnError) {
              self.handleCSRFError(xhr, 'jquery');
            }
          }
        });
        
        this.log('✅ jQuery CSRF protection enabled');
      }
    }

    /**
     * Setup Axios protection
     */
    setupAxiosProtection() {
      if (typeof window.axios !== 'undefined') {
        const self = this;
        
        // Request interceptor
        window.axios.interceptors.request.use(function(config) {
          if (self.shouldAddToken(config.method, config.url)) {
            const token = self.getCurrentToken();
            if (token) {
              config.headers[self.config.headerName] = token;
              self.log('🔒 Added CSRF token to Axios request', { 
                method: config.method, 
                url: config.url 
              });
            }
          }
          return config;
        });
        
        // Response interceptor for error handling
        window.axios.interceptors.response.use(
          function(response) {
            return response;
          },
          function(error) {
            if (error.response && error.response.status === 403 && self.config.refreshOnError) {
              return self.handleCSRFError(error.response, 'axios');
            }
            return Promise.reject(error);
          }
        );
        
        this.log('✅ Axios CSRF protection enabled');
      }
    }

    /**
     * Setup Fetch API protection
     */
    setupFetchProtection() {
      if (typeof window.fetch !== 'undefined') {
        const originalFetch = window.fetch;
        const self = this;
        
        window.fetch = function(url, options = {}) {
          const method = (options.method || 'GET').toUpperCase();
          
          if (self.shouldAddToken(method, url)) {
            const token = self.getCurrentToken();
            if (token) {
              options.headers = {
                ...options.headers,
                [self.config.headerName]: token
              };
              self.log('🔒 Added CSRF token to Fetch request', { method, url });
            }
          }
          
          return originalFetch(url, options)
            .then(response => {
              if (response.status === 403 && self.config.refreshOnError) {
                return self.handleCSRFError(response, 'fetch');
              }
              return response;
            });
        };
        
        this.log('✅ Fetch API CSRF protection enabled');
      }
    }

    /**
     * Setup XMLHttpRequest protection
     */
    setupXHRProtection() {
      const originalOpen = XMLHttpRequest.prototype.open;
      const originalSend = XMLHttpRequest.prototype.send;
      const self = this;
      
      XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        this._method = method;
        this._url = url;
        return originalOpen.call(this, method, url, async, user, password);
      };
      
      XMLHttpRequest.prototype.send = function(data) {
        if (self.shouldAddToken(this._method, this._url)) {
          const token = self.getCurrentToken();
          if (token) {
            this.setRequestHeader(self.config.headerName, token);
            self.log('🔒 Added CSRF token to XHR request', { 
              method: this._method, 
              url: this._url 
            });
          }
        }
        
        // Add error handling
        const originalOnReadyStateChange = this.onreadystatechange;
        this.onreadystatechange = function() {
          if (this.readyState === 4 && this.status === 403 && self.config.refreshOnError) {
            self.handleCSRFError(this, 'xhr');
          }
          if (originalOnReadyStateChange) {
            originalOnReadyStateChange.call(this);
          }
        };
        
        return originalSend.call(this, data);
      };
      
      this.log('✅ XMLHttpRequest CSRF protection enabled');
    }

    /**
     * Setup form protection
     */
    setupFormProtection() {
      // Add tokens to existing forms
      this.updateAllForms();
      
      // Monitor for new forms
      this.observeFormChanges();
      
      // Add form submission handler
      this.setupFormSubmissionHandler();
      
      this.log('✅ Form CSRF protection enabled');
    }

    /**
     * Add CSRF token to a form
     */
    addTokenToForm(form) {
      if (!form || form.tagName !== 'FORM') {
        return false;
      }
      
      // Remove existing CSRF input
      const existingInput = form.querySelector(`input[name="${this.config.formFieldName}"]`);
      if (existingInput) {
        existingInput.remove();
      }
      
      // Add new CSRF input
      const token = this.getCurrentToken();
      if (token) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = this.config.formFieldName;
        input.value = token;
        input.setAttribute('data-csrf-token', 'true');
        form.appendChild(input);
        
        this.log('🔒 Added CSRF token to form', { 
          formId: form.id || 'unnamed',
          action: form.action 
        });
        return true;
      }
      
      return false;
    }

    /**
     * Update all forms with CSRF tokens
     */
    updateAllForms() {
      const forms = document.querySelectorAll('form');
      let updated = 0;
      
      forms.forEach(form => {
        if (this.addTokenToForm(form)) {
          updated++;
        }
      });
      
      this.log(`🔄 Updated ${updated} forms with CSRF tokens`);
      return updated;
    }

    /**
     * Observe for new forms being added to the DOM
     */
    observeFormChanges() {
      if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName === 'FORM') {
                  this.addTokenToForm(node);
                } else {
                  const forms = node.querySelectorAll && node.querySelectorAll('form');
                  if (forms) {
                    forms.forEach(form => this.addTokenToForm(form));
                  }
                }
              }
            });
          });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        this.log('👁️ Form mutation observer enabled');
      }
    }

    /**
     * Setup form submission handler
     */
    setupFormSubmissionHandler() {
      document.addEventListener('submit', event => {
        const form = event.target;
        if (form.tagName === 'FORM') {
          // Ensure form has current token
          this.addTokenToForm(form);
        }
      });
    }

    /**
     * Setup automatic token refresh
     */
    setupTokenRefresh() {
      // Refresh token before expiry
      setInterval(() => {
        this.refreshToken();
      }, 30 * 60 * 1000); // Every 30 minutes
      
      // Refresh on page visibility change
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.refreshToken();
        }
      });
    }

    /**
     * Refresh CSRF token from server
     */
    async refreshToken() {
      try {
        const response = await fetch(this.config.refreshEndpoint, {
          method: 'GET',
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.csrfToken) {
            this.token = data.csrfToken;
            this.updateAllForms();
            this.log('🔄 CSRF token refreshed', { token: this.token });
            this.dispatchEvent('csrf:tokenRefreshed', { token: this.token });
            this.retryCount = 0;
            return this.token;
          }
        }
        
        throw new Error(`Token refresh failed: ${response.status}`);
        
      } catch (error) {
        this.log('❌ Failed to refresh CSRF token:', error);
        this.retryCount++;
        
        if (this.retryCount < this.maxRetries) {
          // Retry with exponential backoff
          setTimeout(() => {
            this.refreshToken();
          }, Math.pow(2, this.retryCount) * 1000);
        }
        
        this.dispatchEvent('csrf:refreshError', { error, retryCount: this.retryCount });
        throw error;
      }
    }

    /**
     * Handle CSRF error responses
     */
    async handleCSRFError(response, source) {
      this.log('🚨 CSRF error detected, attempting token refresh', { source });
      
      try {
        await this.refreshToken();
        this.dispatchEvent('csrf:errorRecovered', { source });
        
        // For fetch, we can retry the request
        if (source === 'fetch') {
          return response;
        }
        
      } catch (error) {
        this.log('❌ Failed to recover from CSRF error:', error);
        this.dispatchEvent('csrf:errorFailed', { source, error });
      }
      
      return response;
    }

    /**
     * Check if token should be added to request
     */
    shouldAddToken(method, url) {
      if (!method || !url) return false;
      
      const upperMethod = method.toUpperCase();
      const safeMethods = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];
      
      // Only add token to state-changing methods
      if (safeMethods.includes(upperMethod)) {
        return false;
      }
      
      // Don't add token to external URLs
      try {
        const requestURL = new URL(url, window.location.origin);
        if (requestURL.origin !== window.location.origin) {
          return false;
        }
      } catch (e) {
        // If URL parsing fails, assume it's relative and add token
      }
      
      return true;
    }

    /**
     * Manually add token to request headers
     */
    addTokenToHeaders(headers = {}) {
      const token = this.getCurrentToken();
      if (token) {
        headers[this.config.headerName] = token;
      }
      return headers;
    }

    /**
     * Create form data with CSRF token
     */
    createFormData(data = {}) {
      const token = this.getCurrentToken();
      if (token) {
        data[this.config.formFieldName] = token;
      }
      return data;
    }

    /**
     * Dispatch custom events
     */
    dispatchEvent(eventType, detail) {
      const event = new CustomEvent(eventType, { detail });
      document.dispatchEvent(event);
    }

    /**
     * Debug logging
     */
    log(message, ...args) {
      if (this.config.debugMode) {
        console.log(`[CSRF] ${message}`, ...args);
      }
    }

    /**
     * Get current configuration
     */
    getConfig() {
      return { ...this.config };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      this.log('⚙️ Configuration updated', this.config);
    }

    /**
     * Get current token info
     */
    getTokenInfo() {
      return {
        token: this.getCurrentToken(),
        isInitialized: this.isInitialized,
        config: this.getConfig(),
        retryCount: this.retryCount
      };
    }

    /**
     * Destroy CSRF client (cleanup)
     */
    destroy() {
      this.isInitialized = false;
      this.token = null;
      this.log('🗑️ CSRF client destroyed');
    }
  }

  // Create and expose global CSRF instance
  const csrf = new CSRFClient();

  // Export to global scope
  window.CSRF = csrf;
  window.CSRFClient = CSRFClient;

  // Export for module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CSRFClient;
  }

  if (typeof define === 'function' && define.amd) {
    define(() => CSRFClient);
  }

})(typeof window !== 'undefined' ? window : global);