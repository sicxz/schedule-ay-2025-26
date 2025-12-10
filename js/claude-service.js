/**
 * Claude API Service
 * Handles API key management and Claude API calls for schedule analysis
 */

const ClaudeService = (function() {
    const STORAGE_KEY = 'claude_api_key';
    const API_URL = 'https://api.anthropic.com/v1/messages';
    const API_VERSION = '2023-06-01';
    const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

    /**
     * Simple obfuscation for localStorage (not true encryption, just basic obscuring)
     */
    function obfuscate(str) {
        return btoa(str.split('').reverse().join(''));
    }

    function deobfuscate(str) {
        try {
            return atob(str).split('').reverse().join('');
        } catch {
            return null;
        }
    }

    /**
     * Store API key in localStorage
     */
    function setApiKey(key) {
        if (!key || typeof key !== 'string') {
            throw new Error('Invalid API key');
        }
        localStorage.setItem(STORAGE_KEY, obfuscate(key));
    }

    /**
     * Retrieve API key from localStorage
     */
    function getApiKey() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        return deobfuscate(stored);
    }

    /**
     * Check if API key is configured
     */
    function hasApiKey() {
        return !!getApiKey();
    }

    /**
     * Clear stored API key
     */
    function clearApiKey() {
        localStorage.removeItem(STORAGE_KEY);
    }

    /**
     * Test connection with a simple API call
     */
    async function testConnection() {
        const apiKey = getApiKey();
        if (!apiKey) {
            return { success: false, error: 'No API key configured' };
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': API_VERSION,
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: DEFAULT_MODEL,
                    max_tokens: 50,
                    messages: [{ role: 'user', content: 'Say "Connected!" and nothing else.' }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                return {
                    success: false,
                    error: errorData.error?.message || `HTTP ${response.status}`
                };
            }

            const data = await response.json();
            return {
                success: true,
                message: data.content?.[0]?.text || 'Connected'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message || 'Connection failed'
            };
        }
    }

    /**
     * Send a prompt to Claude and get a response
     */
    async function analyze(prompt, options = {}) {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('No API key configured. Please add your API key in Settings.');
        }

        const {
            model = DEFAULT_MODEL,
            maxTokens = 4096,
            temperature = 0.3,
            systemPrompt = null
        } = options;

        const messages = [{ role: 'user', content: prompt }];

        const requestBody = {
            model,
            max_tokens: maxTokens,
            messages
        };

        if (systemPrompt) {
            requestBody.system = systemPrompt;
        }

        if (temperature !== undefined) {
            requestBody.temperature = temperature;
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': API_VERSION,
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API error: ${response.status}`);
            }

            const data = await response.json();

            // Extract text content from response
            const textContent = data.content?.find(c => c.type === 'text');
            if (!textContent) {
                throw new Error('No text content in response');
            }

            return {
                text: textContent.text,
                usage: data.usage,
                model: data.model,
                stopReason: data.stop_reason
            };

        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Network error. Check your internet connection and ensure CORS is enabled.');
            }
            throw error;
        }
    }

    /**
     * Mask API key for display (show first 7 and last 4 chars)
     */
    function maskApiKey(key) {
        if (!key || key.length < 15) return '••••••••••••';
        return key.substring(0, 7) + '••••••••••••' + key.substring(key.length - 4);
    }

    // Public API
    return {
        setApiKey,
        getApiKey,
        hasApiKey,
        clearApiKey,
        testConnection,
        analyze,
        maskApiKey
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClaudeService;
}
