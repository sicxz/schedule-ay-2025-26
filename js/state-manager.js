/**
 * EWU Design Schedule Analyzer - State Manager
 * Centralized state management for dashboard applications
 *
 * Features:
 * - Centralized state storage
 * - Subscription-based updates
 * - State persistence (localStorage)
 * - State history for undo functionality
 */

const StateManager = (function() {
    'use strict';

    /**
     * Internal state storage
     */
    const state = new Map();

    /**
     * Subscribers for state changes
     */
    const subscribers = new Map();

    /**
     * State history for undo functionality
     */
    const history = [];
    const MAX_HISTORY = 20;

    /**
     * Configuration
     */
    const config = {
        persistKeys: [], // Keys to persist to localStorage
        storagePrefix: 'ewu_schedule_',
        debug: false
    };

    /**
     * Initialize the state manager
     * @param {Object} options - Configuration options
     */
    function init(options = {}) {
        Object.assign(config, options);

        // Load persisted state
        if (config.persistKeys.length > 0) {
            loadPersistedState();
        }

        log('State manager initialized');
    }

    /**
     * Get a value from state
     * @param {string} key - State key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} State value
     */
    function get(key, defaultValue = null) {
        return state.has(key) ? state.get(key) : defaultValue;
    }

    /**
     * Set a value in state
     * @param {string} key - State key
     * @param {*} value - Value to set
     * @param {Object} options - Options (silent: don't notify, persist: save to storage)
     */
    function set(key, value, options = {}) {
        const { silent = false, persist = false, recordHistory = true } = options;

        const oldValue = state.get(key);

        // Record history for undo
        if (recordHistory && oldValue !== undefined) {
            recordStateChange(key, oldValue, value);
        }

        state.set(key, value);

        log(`State set: ${key}`, value);

        // Persist if needed
        if (persist || config.persistKeys.includes(key)) {
            persistState(key, value);
        }

        // Notify subscribers
        if (!silent) {
            notifySubscribers(key, value, oldValue);
        }
    }

    /**
     * Update a nested value in state
     * @param {string} key - State key
     * @param {string} path - Dot-notation path (e.g., 'user.settings.theme')
     * @param {*} value - Value to set
     */
    function setNested(key, path, value) {
        const current = get(key) || {};
        const parts = path.split('.');
        let obj = current;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) {
                obj[parts[i]] = {};
            }
            obj = obj[parts[i]];
        }

        obj[parts[parts.length - 1]] = value;
        set(key, current);
    }

    /**
     * Get a nested value from state
     * @param {string} key - State key
     * @param {string} path - Dot-notation path
     * @param {*} defaultValue - Default value
     * @returns {*} Nested value
     */
    function getNested(key, path, defaultValue = null) {
        const current = get(key);
        if (!current) return defaultValue;

        const parts = path.split('.');
        let obj = current;

        for (const part of parts) {
            if (obj === null || obj === undefined || !Object.prototype.hasOwnProperty.call(obj, part)) {
                return defaultValue;
            }
            obj = obj[part];
        }

        return obj;
    }

    /**
     * Delete a key from state
     * @param {string} key - State key
     */
    function remove(key) {
        const oldValue = state.get(key);
        state.delete(key);

        // Remove from storage
        try {
            localStorage.removeItem(config.storagePrefix + key);
        } catch (e) {
            // Storage not available
        }

        notifySubscribers(key, undefined, oldValue);
        log(`State removed: ${key}`);
    }

    /**
     * Check if key exists in state
     * @param {string} key - State key
     * @returns {boolean}
     */
    function has(key) {
        return state.has(key);
    }

    /**
     * Get all state keys
     * @returns {Array<string>}
     */
    function keys() {
        return Array.from(state.keys());
    }

    /**
     * Subscribe to state changes
     * @param {string} key - State key to watch (or '*' for all)
     * @param {Function} callback - Callback function (newValue, oldValue, key)
     * @returns {Function} Unsubscribe function
     */
    function subscribe(key, callback) {
        if (!subscribers.has(key)) {
            subscribers.set(key, new Set());
        }

        subscribers.get(key).add(callback);

        log(`Subscriber added for: ${key}`);

        // Return unsubscribe function
        return function unsubscribe() {
            const subs = subscribers.get(key);
            if (subs) {
                subs.delete(callback);
                log(`Subscriber removed for: ${key}`);
            }
        };
    }

    /**
     * Subscribe to multiple keys
     * @param {Array<string>} keys - State keys to watch
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    function subscribeMultiple(keys, callback) {
        const unsubscribers = keys.map(key => subscribe(key, callback));

        return function unsubscribeAll() {
            unsubscribers.forEach(unsub => unsub());
        };
    }

    /**
     * Notify subscribers of state change
     * @param {string} key - Changed key
     * @param {*} newValue - New value
     * @param {*} oldValue - Old value
     */
    function notifySubscribers(key, newValue, oldValue) {
        // Notify key-specific subscribers
        const keySubscribers = subscribers.get(key);
        if (keySubscribers) {
            keySubscribers.forEach(callback => {
                try {
                    callback(newValue, oldValue, key);
                } catch (e) {
                    console.error('State subscriber error:', e);
                }
            });
        }

        // Notify wildcard subscribers
        const wildcardSubscribers = subscribers.get('*');
        if (wildcardSubscribers) {
            wildcardSubscribers.forEach(callback => {
                try {
                    callback(newValue, oldValue, key);
                } catch (e) {
                    console.error('State subscriber error:', e);
                }
            });
        }
    }

    /**
     * Record state change for undo
     * @param {string} key - State key
     * @param {*} oldValue - Previous value
     * @param {*} newValue - New value
     */
    function recordStateChange(key, oldValue, newValue) {
        history.push({
            timestamp: Date.now(),
            key,
            oldValue: JSON.parse(JSON.stringify(oldValue)),
            newValue: JSON.parse(JSON.stringify(newValue))
        });

        // Limit history size
        if (history.length > MAX_HISTORY) {
            history.shift();
        }
    }

    /**
     * Undo last state change
     * @returns {Object|null} Undone change or null if nothing to undo
     */
    function undo() {
        if (history.length === 0) {
            return null;
        }

        const lastChange = history.pop();
        set(lastChange.key, lastChange.oldValue, { recordHistory: false });

        log(`Undid change to: ${lastChange.key}`);
        return lastChange;
    }

    /**
     * Get undo history
     * @returns {Array} History entries
     */
    function getHistory() {
        return [...history];
    }

    /**
     * Clear undo history
     */
    function clearHistory() {
        history.length = 0;
    }

    /**
     * Persist state to localStorage
     * @param {string} key - State key
     * @param {*} value - Value to persist
     */
    function persistState(key, value) {
        try {
            const storageKey = config.storagePrefix + key;
            localStorage.setItem(storageKey, JSON.stringify(value));
            log(`Persisted state: ${key}`);
        } catch (e) {
            console.warn('Failed to persist state:', e);
        }
    }

    /**
     * Load persisted state from localStorage
     */
    function loadPersistedState() {
        config.persistKeys.forEach(key => {
            try {
                const storageKey = config.storagePrefix + key;
                const stored = localStorage.getItem(storageKey);

                if (stored !== null) {
                    const value = JSON.parse(stored);
                    state.set(key, value);
                    log(`Loaded persisted state: ${key}`);
                }
            } catch (e) {
                console.warn('Failed to load persisted state:', e);
            }
        });
    }

    /**
     * Clear all persisted state
     */
    function clearPersistedState() {
        config.persistKeys.forEach(key => {
            try {
                localStorage.removeItem(config.storagePrefix + key);
            } catch (e) {
                // Ignore
            }
        });
    }

    /**
     * Reset state to initial values
     * @param {Object} initialState - Initial state object
     */
    function reset(initialState = {}) {
        state.clear();
        clearHistory();

        Object.entries(initialState).forEach(([key, value]) => {
            set(key, value, { silent: true, recordHistory: false });
        });

        // Notify all subscribers of reset
        notifySubscribers('*', null, null);

        log('State reset');
    }

    /**
     * Get entire state as object
     * @returns {Object} State object
     */
    function getAll() {
        const obj = {};
        state.forEach((value, key) => {
            obj[key] = value;
        });
        return obj;
    }

    /**
     * Set multiple state values at once
     * @param {Object} values - Key-value pairs
     * @param {Object} options - Set options
     */
    function setMultiple(values, options = {}) {
        Object.entries(values).forEach(([key, value]) => {
            set(key, value, { ...options, silent: true });
        });

        // Notify once for batch update
        if (!options.silent) {
            notifySubscribers('*', values, null);
        }
    }

    /**
     * Debug logging
     * @param {...*} args - Log arguments
     */
    function log(...args) {
        if (config.debug) {
            console.log('[StateManager]', ...args);
        }
    }

    // Public API
    return {
        init,
        get,
        set,
        getNested,
        setNested,
        remove,
        has,
        keys,
        subscribe,
        subscribeMultiple,
        undo,
        getHistory,
        clearHistory,
        reset,
        getAll,
        setMultiple,
        clearPersistedState
    };
})();

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateManager;
}
