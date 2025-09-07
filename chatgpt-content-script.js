/**
 * ChatGPT Chrome Extension Content Script
 * Handles interaction with ChatGPT's web interface
 */

class ChatGPTContentScript {
    constructor() {
        this.isReady = false;
        this.inputElement = null;
        this.sendButton = null;
        this.responseContainer = null;
        this.messageObserver = null;
        
        this.init();
        this.setupMessageListener();
    }

    /**
     * Initialize the content script
     */
    async init() {
        // Wait for page to load
        if (document.readyState !== 'complete') {
            await new Promise(resolve => {
                window.addEventListener('load', resolve);
            });
        }

        // Additional delay for dynamic content
        await this.delay(2000);
        
        this.findElements();
        this.setupResponseObserver();
        this.isReady = true;
        
        console.log('ChatGPT Content Script initialized', {
            inputFound: !!this.inputElement,
            sendButtonFound: !!this.sendButton,
            responseContainerFound: !!this.responseContainer
        });
    }

    /**
     * Find key DOM elements
     */
    findElements() {
        this.inputElement = this.findInputElement();
        this.sendButton = this.findSendButton();
        this.responseContainer = this.findResponseContainer();
    }

    /**
     * Find the main input element
     */
    findInputElement() {
        const selectors = [
            'div[contenteditable="true"][data-id]',
            '#prompt-textarea',
            '[data-testid="message-input"]',
            'div[role="textbox"][contenteditable="true"]',
            'main div[contenteditable="true"]',
            'form div[contenteditable="true"]'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && this.isElementVisible(element)) {
                return element;
            }
        }

        // Fallback: find any visible contenteditable
        const editables = document.querySelectorAll('div[contenteditable="true"]');
        for (const el of editables) {
            if (this.isElementVisible(el) && el.getBoundingClientRect().height > 30) {
                return el;
            }
        }

        return null;
    }

    /**
     * Find the send button
     */
    findSendButton() {
        const selectors = [
            'button[data-testid="send-button"]',
            'button[aria-label*="Send"]',
            'form button[type="submit"]',
            'button:has(svg[data-icon="send"])'
        ];

        for (const selector of selectors) {
            try {
                const element = document.querySelector(selector);
                if (element && this.isElementVisible(element)) {
                    return element;
                }
            } catch (e) {
                // :has() might not be supported in all browsers
                continue;
            }
        }

        // Find button near input area
        if (this.inputElement) {
            const form = this.inputElement.closest('form');
            if (form) {
                const buttons = form.querySelectorAll('button:not([disabled])');
                if (buttons.length > 0) {
                    return buttons[buttons.length - 1]; // Usually the last button
                }
            }

            // Look in parent containers
            const container = this.inputElement.closest('.relative, .flex, .sticky');
            if (container) {
                const buttons = container.querySelectorAll('button');
                for (const btn of buttons) {
                    if (this.isElementVisible(btn) && !btn.disabled) {
                        return btn;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Find the response container
     */
    findResponseContainer() {
        const selectors = [
            'main[role="main"]',
            '[data-testid*="conversation"]',
            'div[class*="conversation"]',
            'main',
            '.h-full' // Common wrapper class
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                // Verify it contains or can contain messages
                if (element.querySelector('[data-message-author-role]') || 
                    element.querySelector('[data-testid*="conversation-turn"]')) {
                    return element;
                }
                // If it's a main element, use it as fallback
                if (element.tagName === 'MAIN') {
                    return element;
                }
            }
        }

        return document.body;
    }

    /**
     * Check if element is visible
     */
    isElementVisible(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && 
               rect.height > 0 && 
               element.offsetParent !== null &&
               window.getComputedStyle(element).visibility !== 'hidden';
    }

    /**
     * Setup observer for new messages
     */
    setupResponseObserver() {
        if (this.messageObserver) {
            this.messageObserver.disconnect();
        }

        if (!this.responseContainer) return;

        this.messageObserver = new MutationObserver((mutations) => {
            let hasNewMessage = false;
            
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check for new conversation turns or assistant messages
                        if (node.matches && 
                            (node.matches('[data-testid*="conversation-turn"]') ||
                             node.matches('[data-message-author-role="assistant"]') ||
                             node.querySelector('[data-message-author-role="assistant"]'))) {
                            hasNewMessage = true;
                        }
                    }
                });
            });

            if (hasNewMessage) {
                // Notify extension of new message
                this.notifyNewMessage();
            }
        });

        this.messageObserver.observe(this.responseContainer, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Setup message listener for extension communication
     */
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });
    }

    /**
     * Handle messages from extension
     */
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'ping':
                    sendResponse({ success: true, ready: this.isReady });
                    break;

                case 'send_message':
                    const result = await this.sendMessage(request.text);
                    sendResponse({ success: result, ready: this.isReady });
                    break;

                case 'get_response':
                    const response = this.getLatestResponse();
                    sendResponse({ success: !!response, response, ready: this.isReady });
                    break;

                case 'get_all_messages':
                    const messages = this.getAllMessages();
                    sendResponse({ success: true, messages, ready: this.isReady });
                    break;

                case 'wait_for_response':
                    try {
                        const newResponse = await this.waitForResponse(request.timeout || 30000);
                        sendResponse({ success: true, response: newResponse, ready: this.isReady });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message, ready: this.isReady });
                    }
                    break;

                case 'refresh_elements':
                    this.findElements();
                    sendResponse({ 
                        success: true, 
                        ready: this.isReady,
                        found: {
                            input: !!this.inputElement,
                            sendButton: !!this.sendButton,
                            responseContainer: !!this.responseContainer
                        }
                    });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Send a message to ChatGPT
     */
    async sendMessage(text) {
        if (!text || !text.trim()) return false;

        // Refresh elements if needed
        if (!this.inputElement || !this.sendButton) {
            this.findElements();
        }

        if (!this.inputElement || !this.sendButton) {
            console.error('Input or send button not found');
            return false;
        }

        try {
            // Focus and clear input
            this.inputElement.focus();
            await this.delay(100);

            // Set text content
            if (this.inputElement.tagName === 'TEXTAREA') {
                this.inputElement.value = text;
                this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                // For contenteditable div
                this.inputElement.textContent = text;
                // Trigger various events to ensure the interface recognizes the change
                this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
                this.inputElement.dispatchEvent(new Event('keyup', { bubbles: true }));
                this.inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            }

            await this.delay(200);

            // Check if send button is enabled
            if (this.sendButton.disabled) {
                console.warn('Send button is disabled');
                return false;
            }

            // Click send button
            this.sendButton.click();
            
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    }

    /**
     * Get the latest response from ChatGPT
     */
    getLatestResponse() {
        const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
        if (assistantMessages.length === 0) return null;

        const latest = assistantMessages[assistantMessages.length - 1];
        
        // Try to find markdown content first, then fallback to text content
        const markdownContainer = latest.querySelector('[class*="markdown"]');
        const content = markdownContainer || latest;
        
        return content.textContent || content.innerText || null;
    }

    /**
     * Get all messages in the conversation
     */
    getAllMessages() {
        const messages = [];
        const messageElements = document.querySelectorAll('[data-message-author-role]');

        messageElements.forEach((el, index) => {
            const role = el.getAttribute('data-message-author-role');
            const markdownContainer = el.querySelector('[class*="markdown"]');
            const content = markdownContainer || el;
            const text = content.textContent || content.innerText || '';

            messages.push({
                index,
                role,
                content: text.trim(),
                timestamp: Date.now(), // Could be improved to extract actual timestamp
                element: el
            });
        });

        return messages;
    }

    /**
     * Wait for a new response from ChatGPT
     */
    waitForResponse(timeout = 30000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const initialCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;

            const checkForResponse = () => {
                const currentCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
                const elapsed = Date.now() - startTime;

                if (currentCount > initialCount) {
                    // New response appeared
                    resolve(this.getLatestResponse());
                } else if (elapsed > timeout) {
                    reject(new Error('Response timeout'));
                } else {
                    // Check for loading indicators that might suggest response is still generating
                    const loadingIndicators = document.querySelectorAll('[class*="loading"], [class*="typing"], [aria-live="polite"]');
                    const isLoading = Array.from(loadingIndicators).some(el => this.isElementVisible(el));
                    
                    if (!isLoading && elapsed > 5000) {
                        // No loading indicators and been waiting for 5+ seconds
                        reject(new Error('No response generated'));
                    } else {
                        setTimeout(checkForResponse, 500);
                    }
                }
            };

            // Start checking after a small delay
            setTimeout(checkForResponse, 1000);
        });
    }

    /**
     * Notify extension of new message
     */
    notifyNewMessage() {
        try {
            chrome.runtime.sendMessage({
                action: 'new_message',
                response: this.getLatestResponse()
            });
        } catch (error) {
            console.error('Error notifying of new message:', error);
        }
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the content script when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ChatGPTContentScript();
    });
} else {
    new ChatGPTContentScript();
}