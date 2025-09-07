# ChatGPT Chrome Extension DOM Selectors

Based on analysis of ChatGPT's interface structure (as of 2024), here are the key CSS selectors for Chrome extension automation:

## Main Input Textarea

The main message input area uses a contenteditable div approach:

### Primary Selectors (Most Reliable)
```css
/* Main input area - contenteditable div */
div[contenteditable="true"][data-id]
#prompt-textarea
[data-testid="message-input"]

/* Alternative approaches */
div[contenteditable="true"]:not([role="textbox"])
div[role="textbox"][contenteditable="true"]
```

### Fallback Selectors
```css
/* Generic contenteditable in main area */
main div[contenteditable="true"]
form div[contenteditable="true"]
div[contenteditable="true"][placeholder*="message"]

/* Textarea fallback (if they switch back) */
textarea[placeholder*="Message ChatGPT"]
textarea[data-id*="prompt"]
```

### JavaScript Detection
```javascript
// Find the main input element
function findInputElement() {
    // Try specific selectors first
    const selectors = [
        'div[contenteditable="true"][data-id]',
        '#prompt-textarea',
        '[data-testid="message-input"]',
        'div[role="textbox"][contenteditable="true"]',
        'main div[contenteditable="true"]'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) {
            return element;
        }
    }
    
    // Fallback: find any visible contenteditable in main content area
    const editables = document.querySelectorAll('div[contenteditable="true"]');
    for (const el of editables) {
        if (el.offsetParent !== null && el.getBoundingClientRect().height > 30) {
            return el;
        }
    }
    
    return null;
}
```

## Response Container

The conversation/chat area where responses appear:

### Primary Selectors
```css
/* Main conversation container */
main[role="main"]
[data-testid="conversation-turn-3"] /* Dynamic number */
div[class*="conversation"]
div[class*="chat-messages"]

/* Individual message containers */
div[data-message-author-role="assistant"]
div[data-message-author-role="user"]
[data-testid*="conversation-turn"]
```

### Fallback Selectors
```css
/* Generic conversation patterns */
main div:has(> div[data-message-author-role])
div[role="presentation"]:has(div[data-message-author-role])
main > div > div > div /* Common nesting pattern */
```

### JavaScript Detection
```javascript
function findResponseContainer() {
    const selectors = [
        'main[role="main"]',
        '[data-testid*="conversation"]',
        'div[class*="conversation"]',
        'main div:has([data-message-author-role])'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
    }
    
    // Find container with multiple message elements
    const main = document.querySelector('main');
    if (main) {
        const containers = main.querySelectorAll('div');
        for (const container of containers) {
            if (container.querySelectorAll('[data-message-author-role]').length > 0) {
                return container;
            }
        }
    }
    
    return document.querySelector('main') || document.body;
}
```

## Send Button

The submit/send button to trigger message sending:

### Primary Selectors
```css
/* Send button */
button[data-testid="send-button"]
button[aria-label*="Send"]
form button[type="submit"]
button:has(svg[data-icon="send"])
```

### Fallback Selectors
```css
/* Generic button patterns near input */
form button:not([disabled])
div:has(div[contenteditable]) + button
div:has(div[contenteditable]) button:last-child
button[class*="send"]
button svg[viewBox*="24"]:has(path[d*="M2.01"]) /* Send icon path */
```

### JavaScript Detection
```javascript
function findSendButton() {
    const selectors = [
        'button[data-testid="send-button"]',
        'button[aria-label*="Send"]',
        'form button[type="submit"]',
        'button:has(svg[data-icon="send"])'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && !element.disabled) return element;
    }
    
    // Find button near the input area
    const inputArea = findInputElement();
    if (inputArea) {
        const form = inputArea.closest('form');
        if (form) {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) return submitBtn;
            
            const buttons = form.querySelectorAll('button');
            for (const btn of buttons) {
                if (!btn.disabled && btn.offsetParent !== null) {
                    return btn;
                }
            }
        }
        
        // Look for buttons near the input
        const parent = inputArea.parentElement;
        const nearbyButtons = parent.querySelectorAll('button');
        for (const btn of nearbyButtons) {
            if (!btn.disabled && btn.offsetParent !== null) {
                return btn;
            }
        }
    }
    
    return null;
}
```

## Message Elements

Individual message elements for reading responses:

### Assistant Messages
```css
div[data-message-author-role="assistant"]
div[data-message-author-role="assistant"] div[class*="markdown"]
[data-testid*="conversation-turn"] div[data-message-author-role="assistant"]
```

### User Messages
```css
div[data-message-author-role="user"]
[data-testid*="conversation-turn"] div[data-message-author-role="user"]
```

### Message Content
```javascript
function getLatestResponse() {
    const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
    if (assistantMessages.length > 0) {
        const latest = assistantMessages[assistantMessages.length - 1];
        // Look for markdown content or plain text
        const content = latest.querySelector('[class*="markdown"]') || latest;
        return content.textContent || content.innerText;
    }
    return null;
}

function getAllMessages() {
    const messages = [];
    const messageElements = document.querySelectorAll('[data-message-author-role]');
    
    messageElements.forEach(el => {
        const role = el.getAttribute('data-message-author-role');
        const content = el.querySelector('[class*="markdown"]') || el;
        messages.push({
            role,
            content: content.textContent || content.innerText,
            element: el
        });
    });
    
    return messages;
}
```

## Complete Chrome Extension Helper Functions

```javascript
class ChatGPTAutomation {
    constructor() {
        this.inputElement = null;
        this.responseContainer = null;
        this.sendButton = null;
        this.init();
    }
    
    init() {
        this.inputElement = this.findInputElement();
        this.responseContainer = this.findResponseContainer();
        this.sendButton = this.findSendButton();
    }
    
    findInputElement() {
        const selectors = [
            'div[contenteditable="true"][data-id]',
            '#prompt-textarea',
            '[data-testid="message-input"]',
            'div[role="textbox"][contenteditable="true"]',
            'main div[contenteditable="true"]'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
                return element;
            }
        }
        
        // Fallback approach
        const editables = document.querySelectorAll('div[contenteditable="true"]');
        return Array.from(editables).find(el => 
            el.offsetParent !== null && 
            el.getBoundingClientRect().height > 30
        );
    }
    
    findResponseContainer() {
        const selectors = [
            'main[role="main"]',
            '[data-testid*="conversation"]',
            'div[class*="conversation"]'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        
        return document.querySelector('main') || document.body;
    }
    
    findSendButton() {
        const selectors = [
            'button[data-testid="send-button"]',
            'button[aria-label*="Send"]',
            'form button[type="submit"]'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && !element.disabled) return element;
        }
        
        // Find button near input
        if (this.inputElement) {
            const form = this.inputElement.closest('form');
            if (form) {
                const buttons = form.querySelectorAll('button:not([disabled])');
                return buttons[buttons.length - 1]; // Usually the last button
            }
        }
        
        return null;
    }
    
    sendMessage(text) {
        if (!this.inputElement || !this.sendButton) {
            this.init(); // Retry finding elements
        }
        
        if (this.inputElement && this.sendButton) {
            // Set the text content
            this.inputElement.focus();
            
            if (this.inputElement.tagName === 'TEXTAREA') {
                this.inputElement.value = text;
                this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                // For contenteditable div
                this.inputElement.textContent = text;
                this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            // Trigger send
            setTimeout(() => {
                this.sendButton.click();
            }, 100);
            
            return true;
        }
        
        return false;
    }
    
    getLatestResponse() {
        const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
        if (assistantMessages.length > 0) {
            const latest = assistantMessages[assistantMessages.length - 1];
            const content = latest.querySelector('[class*="markdown"]') || latest;
            return content.textContent || content.innerText;
        }
        return null;
    }
    
    waitForResponse(timeout = 30000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const initialCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
            
            const checkForResponse = () => {
                const currentCount = document.querySelectorAll('[data-message-author-role="assistant"]').length;
                
                if (currentCount > initialCount) {
                    resolve(this.getLatestResponse());
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('Response timeout'));
                } else {
                    setTimeout(checkForResponse, 500);
                }
            };
            
            checkForResponse();
        });
    }
}

// Usage example:
// const chatGPT = new ChatGPTAutomation();
// chatGPT.sendMessage("Hello, how are you?");
// chatGPT.waitForResponse().then(response => console.log(response));
```

## Notes for Implementation

1. **Dynamic Selectors**: ChatGPT's interface may update frequently, so implement fallback strategies
2. **Wait Strategies**: Always wait for elements to be visible and interactable
3. **Rate Limiting**: Implement delays between messages to avoid being flagged
4. **Error Handling**: Handle cases where elements aren't found or have changed
5. **Observer Pattern**: Use MutationObserver to detect new messages dynamically
6. **Security**: Be mindful of ChatGPT's terms of service regarding automation

## Testing Strategy

Test selectors in browser console:
```javascript
// Test input finding
console.log('Input element:', document.querySelector('div[contenteditable="true"]'));

// Test response finding  
console.log('Response container:', document.querySelector('main[role="main"]'));

// Test send button
console.log('Send button:', document.querySelector('button[aria-label*="Send"]'));
```