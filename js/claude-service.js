/**
 * Backward-compatible AI service.
 * Kept as `ClaudeService` so existing pages keep working, but now routes to OpenAI via `/api/ai/*`.
 */

const ClaudeService = (function() {
    const STORAGE_KEY = 'openai_api_key';
    const PROVIDER_PREF_KEY = 'ai_provider_preference';
    const MODEL_PREFS_KEY = 'ai_model_preferences';
    const CHAT_ENDPOINT = '/api/ai/chat';
    const TEST_ENDPOINT = '/api/ai/test';
    const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
    const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-5';

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

    function validateApiKey(key) {
        if (!key || typeof key !== 'string' || !key.trim()) {
            throw new Error('Invalid API key');
        }
        const trimmed = key.trim();
        if (!trimmed.startsWith('sk-')) {
            throw new Error('API key must start with "sk-"');
        }
        return trimmed;
    }

    function getProviderFromKey(key) {
        if (!key || typeof key !== 'string') {
            return 'openai';
        }
        return key.startsWith('sk-ant-') ? 'anthropic' : 'openai';
    }

    function setProviderPreference(provider) {
        const normalized = provider === 'openai' || provider === 'anthropic' ? provider : null;
        if (normalized) {
            localStorage.setItem(PROVIDER_PREF_KEY, normalized);
        } else {
            localStorage.removeItem(PROVIDER_PREF_KEY);
        }
    }

    function getProviderPreference() {
        const stored = localStorage.getItem(PROVIDER_PREF_KEY);
        if (stored === 'openai' || stored === 'anthropic') {
            return stored;
        }
        return null;
    }

    function getModelPreferences() {
        const raw = localStorage.getItem(MODEL_PREFS_KEY);
        if (!raw) {
            return {};
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                return parsed;
            }
        } catch {
            return {};
        }
        return {};
    }

    function setModelPreference(model, provider = getCurrentProvider()) {
        const prefs = getModelPreferences();
        if (!model || typeof model !== 'string' || !model.trim()) {
            delete prefs[provider];
        } else {
            prefs[provider] = model.trim();
        }
        localStorage.setItem(MODEL_PREFS_KEY, JSON.stringify(prefs));
    }

    function getModelPreference(provider = getCurrentProvider()) {
        const prefs = getModelPreferences();
        const model = prefs[provider];
        if (typeof model === 'string' && model.trim()) {
            return model.trim();
        }
        return null;
    }

    function getDefaultModelForProvider(provider) {
        return provider === 'anthropic' ? ANTHROPIC_DEFAULT_MODEL : OPENAI_DEFAULT_MODEL;
    }

    function getCurrentProvider() {
        const preferred = getProviderPreference();
        if (preferred) {
            return preferred;
        }
        return getProviderFromKey(getApiKey());
    }

    function getCurrentDefaultModel() {
        const provider = getCurrentProvider();
        return getModelPreference(provider) || getDefaultModelForProvider(provider);
    }

    function setApiKey(key) {
        const normalized = validateApiKey(key);
        localStorage.setItem(STORAGE_KEY, obfuscate(normalized));
    }

    function getApiKey() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return null;
        }
        return deobfuscate(stored);
    }

    function hasApiKey() {
        return Boolean(getApiKey());
    }

    function clearApiKey() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PROVIDER_PREF_KEY);
        localStorage.removeItem(MODEL_PREFS_KEY);
    }

    async function request(endpoint, payload = {}) {
        const apiKey = getApiKey();
        const headers = {
            'Content-Type': 'application/json'
        };
        if (apiKey) {
            headers['x-ai-api-key'] = apiKey;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        let data = {};
        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok || data.success === false) {
            const message = data.error || `Request failed (${response.status})`;
            throw new Error(message);
        }

        return data;
    }

    async function testConnection(model = getCurrentDefaultModel(), provider = null) {
        const effectiveProvider = provider || getCurrentProvider();
        try {
            const data = await request(TEST_ENDPOINT, {
                model,
                provider: effectiveProvider
            });
            return {
                success: true,
                message: data.message || 'Connected',
                model: data.model || model,
                provider: data.provider || effectiveProvider
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Connection failed'
            };
        }
    }

    async function analyze(prompt, options = {}) {
        if (!prompt || typeof prompt !== 'string') {
            throw new Error('Prompt is required');
        }

        const {
            model = getCurrentDefaultModel(),
            maxTokens = 4096,
            temperature = 0.3,
            systemPrompt = null,
            responseFormat = null,
            provider = null
        } = options;
        const effectiveProvider = provider || getCurrentProvider();

        const payload = {
            prompt,
            provider: effectiveProvider,
            model,
            maxTokens,
            temperature
        };

        if (systemPrompt) {
            payload.systemPrompt = systemPrompt;
        }
        if (responseFormat) {
            payload.responseFormat = responseFormat;
        }

        const data = await request(CHAT_ENDPOINT, payload);
        return {
            text: data.text || '',
            usage: data.usage || null,
            model: data.model || model,
            provider: data.provider || effectiveProvider
        };
    }

    async function chat(messages, options = {}) {
        if (!Array.isArray(messages) || messages.length === 0) {
            throw new Error('Messages are required');
        }

        const {
            model = getCurrentDefaultModel(),
            maxTokens = 1200,
            temperature = 0.3,
            responseFormat = null,
            provider = null
        } = options;
        const effectiveProvider = provider || getCurrentProvider();

        const payload = {
            messages,
            provider: effectiveProvider,
            model,
            maxTokens,
            temperature
        };

        if (responseFormat) {
            payload.responseFormat = responseFormat;
        }

        const data = await request(CHAT_ENDPOINT, payload);
        return {
            text: data.text || '',
            usage: data.usage || null,
            model: data.model || model,
            provider: data.provider || effectiveProvider
        };
    }

    function maskApiKey(key) {
        if (!key || key.length < 15) {
            return '••••••••••••';
        }
        return key.substring(0, 7) + '••••••••••••' + key.substring(key.length - 4);
    }

    return {
        setApiKey,
        getApiKey,
        hasApiKey,
        clearApiKey,
        testConnection,
        analyze,
        chat,
        maskApiKey,
        provider: getCurrentProvider(),
        defaultModel: getCurrentDefaultModel(),
        getCurrentProvider,
        getCurrentDefaultModel,
        setProviderPreference,
        getProviderPreference,
        setModelPreference,
        getModelPreference
    };
})();

if (typeof window !== 'undefined') {
    window.OpenAIService = ClaudeService;
    window.SchedulerAIService = ClaudeService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClaudeService;
}
