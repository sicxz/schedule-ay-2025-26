/**
 * EWU Design Schedule Analyzer - Backup Manager
 * Handles undo/redo, auto-save, and backup functionality
 */

const BackupManager = (function() {
    'use strict';

    // Get constants if available
    const getConstants = () => {
        if (typeof CONSTANTS !== 'undefined') {
            return CONSTANTS;
        }
        return {
            BACKUP: {
                MAX_HISTORY: 20,
                STORAGE_KEY_PREFIX: 'ewu_schedule_',
                AUTO_SAVE_INTERVAL: 30000
            }
        };
    };

    /**
     * Undo history stack
     */
    const undoStack = [];

    /**
     * Redo history stack
     */
    const redoStack = [];

    /**
     * Named snapshots (manual saves)
     */
    const snapshots = new Map();

    /**
     * Auto-save interval ID
     */
    let autoSaveInterval = null;

    /**
     * Change listeners
     */
    const listeners = new Set();

    /**
     * Current state getter function (set by user)
     */
    let getStateFunction = null;

    /**
     * State restore function (set by user)
     */
    let restoreStateFunction = null;

    /**
     * Storage keys
     */
    const STORAGE_KEYS = {
        SNAPSHOTS: 'backup_snapshots',
        AUTO_SAVE: 'backup_autosave'
    };

    /**
     * Initialize the backup manager
     * @param {Object} options - Configuration options
     * @param {Function} options.getState - Function to get current state
     * @param {Function} options.restoreState - Function to restore state
     * @param {boolean} options.autoSave - Enable auto-save (default: true)
     */
    function init(options = {}) {
        if (options.getState) {
            getStateFunction = options.getState;
        }
        if (options.restoreState) {
            restoreStateFunction = options.restoreState;
        }

        // Load snapshots from storage
        loadSnapshots();

        // Start auto-save if enabled
        if (options.autoSave !== false) {
            startAutoSave();
        }

        return this;
    }

    /**
     * Record a state change for undo
     * @param {string} action - Description of the action
     * @param {Object} beforeState - State before change
     * @param {Object} afterState - State after change (optional, will capture current if not provided)
     */
    function recordChange(action, beforeState, afterState = null) {
        const constants = getConstants();

        // If afterState not provided, try to get current state
        if (afterState === null && getStateFunction) {
            afterState = getStateFunction();
        }

        const entry = {
            id: generateId(),
            action,
            beforeState: JSON.parse(JSON.stringify(beforeState)),
            afterState: afterState ? JSON.parse(JSON.stringify(afterState)) : null,
            timestamp: new Date().toISOString()
        };

        undoStack.push(entry);

        // Limit history size
        while (undoStack.length > constants.BACKUP.MAX_HISTORY) {
            undoStack.shift();
        }

        // Clear redo stack on new change
        redoStack.length = 0;

        notifyListeners('record', entry);
    }

    /**
     * Undo the last change
     * @returns {Object|null} The undone entry or null if nothing to undo
     */
    function undo() {
        if (undoStack.length === 0) {
            return null;
        }

        const entry = undoStack.pop();

        // Restore the before state
        if (restoreStateFunction && entry.beforeState) {
            restoreStateFunction(entry.beforeState);
        }

        // Add to redo stack
        redoStack.push(entry);

        notifyListeners('undo', entry);
        return entry;
    }

    /**
     * Redo the last undone change
     * @returns {Object|null} The redone entry or null if nothing to redo
     */
    function redo() {
        if (redoStack.length === 0) {
            return null;
        }

        const entry = redoStack.pop();

        // Restore the after state
        if (restoreStateFunction && entry.afterState) {
            restoreStateFunction(entry.afterState);
        }

        // Add back to undo stack
        undoStack.push(entry);

        notifyListeners('redo', entry);
        return entry;
    }

    /**
     * Check if undo is available
     * @returns {boolean}
     */
    function canUndo() {
        return undoStack.length > 0;
    }

    /**
     * Check if redo is available
     * @returns {boolean}
     */
    function canRedo() {
        return redoStack.length > 0;
    }

    /**
     * Get undo history
     * @returns {Array} List of undo entries
     */
    function getUndoHistory() {
        return undoStack.map(entry => ({
            id: entry.id,
            action: entry.action,
            timestamp: entry.timestamp
        }));
    }

    /**
     * Get redo history
     * @returns {Array} List of redo entries
     */
    function getRedoHistory() {
        return redoStack.map(entry => ({
            id: entry.id,
            action: entry.action,
            timestamp: entry.timestamp
        }));
    }

    /**
     * Clear all undo/redo history
     */
    function clearHistory() {
        undoStack.length = 0;
        redoStack.length = 0;
        snapshots.clear();
        notifyListeners('clearHistory', {});
    }

    /**
     * Create a named snapshot
     * @param {string} name - Snapshot name
     * @param {string} description - Optional description
     * @returns {Object} Snapshot info
     */
    function createSnapshot(name, description = '') {
        if (!getStateFunction) {
            return { success: false, error: 'No state getter configured' };
        }

        const state = getStateFunction();
        const snapshot = {
            id: generateId(),
            name,
            description,
            state: JSON.parse(JSON.stringify(state)),
            createdAt: new Date().toISOString()
        };

        snapshots.set(snapshot.id, snapshot);
        saveSnapshots();

        notifyListeners('snapshot', snapshot);
        return { success: true, snapshot };
    }

    /**
     * Restore a snapshot
     * @param {string} snapshotId - Snapshot ID
     * @returns {Object} Result
     */
    function restoreSnapshot(snapshotId) {
        const snapshot = snapshots.get(snapshotId);

        if (!snapshot) {
            return { success: false, error: 'Snapshot not found' };
        }

        if (!restoreStateFunction) {
            return { success: false, error: 'No state restorer configured' };
        }

        // Record current state before restoring
        if (getStateFunction) {
            recordChange('Restore snapshot: ' + snapshot.name, getStateFunction());
        }

        restoreStateFunction(snapshot.state);

        notifyListeners('restoreSnapshot', snapshot);
        return { success: true, snapshot };
    }

    /**
     * Delete a snapshot
     * @param {string} snapshotId - Snapshot ID
     * @returns {boolean} Success
     */
    function deleteSnapshot(snapshotId) {
        const deleted = snapshots.delete(snapshotId);
        if (deleted) {
            saveSnapshots();
            notifyListeners('deleteSnapshot', { id: snapshotId });
        }
        return deleted;
    }

    /**
     * Get all snapshots
     * @returns {Array} List of snapshot info
     */
    function getSnapshots() {
        return Array.from(snapshots.values()).map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            createdAt: s.createdAt
        }));
    }

    /**
     * Start auto-save
     */
    function startAutoSave() {
        stopAutoSave(); // Clear existing interval

        const constants = getConstants();
        autoSaveInterval = setInterval(() => {
            autoSave();
        }, constants.BACKUP.AUTO_SAVE_INTERVAL);
    }

    /**
     * Stop auto-save
     */
    function stopAutoSave() {
        if (autoSaveInterval) {
            clearInterval(autoSaveInterval);
            autoSaveInterval = null;
        }
    }

    /**
     * Perform auto-save
     */
    function autoSave() {
        if (!getStateFunction) return;

        try {
            const state = getStateFunction();
            const constants = getConstants();
            const key = constants.BACKUP.STORAGE_KEY_PREFIX + STORAGE_KEYS.AUTO_SAVE;

            const autoSaveData = {
                state: state,
                savedAt: new Date().toISOString()
            };

            localStorage.setItem(key, JSON.stringify(autoSaveData));
            notifyListeners('autoSave', { savedAt: autoSaveData.savedAt });
        } catch (e) {
            console.warn('Auto-save failed:', e);
        }
    }

    /**
     * Get last auto-save
     * @returns {Object|null} Auto-save data or null
     */
    function getAutoSave() {
        try {
            const constants = getConstants();
            const key = constants.BACKUP.STORAGE_KEY_PREFIX + STORAGE_KEYS.AUTO_SAVE;
            const stored = localStorage.getItem(key);

            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to load auto-save:', e);
        }
        return null;
    }

    /**
     * Restore from auto-save
     * @returns {Object} Result
     */
    function restoreAutoSave() {
        const autoSaveData = getAutoSave();

        if (!autoSaveData) {
            return { success: false, error: 'No auto-save found' };
        }

        if (!restoreStateFunction) {
            return { success: false, error: 'No state restorer configured' };
        }

        // Record current state before restoring
        if (getStateFunction) {
            recordChange('Restore auto-save', getStateFunction());
        }

        restoreStateFunction(autoSaveData.state);

        notifyListeners('restoreAutoSave', autoSaveData);
        return { success: true, savedAt: autoSaveData.savedAt };
    }

    /**
     * Clear auto-save
     */
    function clearAutoSave() {
        try {
            const constants = getConstants();
            const key = constants.BACKUP.STORAGE_KEY_PREFIX + STORAGE_KEYS.AUTO_SAVE;
            localStorage.removeItem(key);
        } catch (e) {
            // Ignore
        }
    }

    /**
     * Save snapshots to localStorage
     */
    function saveSnapshots() {
        try {
            const constants = getConstants();
            const key = constants.BACKUP.STORAGE_KEY_PREFIX + STORAGE_KEYS.SNAPSHOTS;
            const data = Array.from(snapshots.entries());
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save snapshots:', e);
        }
    }

    /**
     * Load snapshots from localStorage
     */
    function loadSnapshots() {
        try {
            const constants = getConstants();
            const key = constants.BACKUP.STORAGE_KEY_PREFIX + STORAGE_KEYS.SNAPSHOTS;
            const stored = localStorage.getItem(key);

            if (stored) {
                const data = JSON.parse(stored);
                snapshots.clear();
                data.forEach(([id, snapshot]) => {
                    snapshots.set(id, snapshot);
                });
            }
        } catch (e) {
            console.warn('Failed to load snapshots:', e);
        }
    }

    /**
     * Export all backup data
     * @returns {Object} Export data
     */
    function exportBackupData() {
        return {
            snapshots: Array.from(snapshots.entries()),
            undoHistory: undoStack.map(e => ({ action: e.action, timestamp: e.timestamp })),
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Generate unique ID
     * @returns {string}
     */
    function generateId() {
        return 'backup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Subscribe to backup events
     * @param {Function} callback - Callback function (event, data)
     * @returns {Function} Unsubscribe function
     */
    function subscribe(callback) {
        listeners.add(callback);
        return function unsubscribe() {
            listeners.delete(callback);
        };
    }

    /**
     * Notify all listeners
     * @param {string} event - Event type
     * @param {Object} data - Event data
     */
    function notifyListeners(event, data) {
        listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (e) {
                console.error('Backup listener error:', e);
            }
        });
    }

    /**
     * Reset all state (for testing)
     */
    function reset() {
        undoStack.length = 0;
        redoStack.length = 0;
        snapshots.clear();
        listeners.clear();
        stopAutoSave();
        getStateFunction = null;
        restoreStateFunction = null;
    }

    // Public API
    return {
        init,
        recordChange,
        undo,
        redo,
        canUndo,
        canRedo,
        getUndoHistory,
        getRedoHistory,
        clearHistory,
        createSnapshot,
        restoreSnapshot,
        deleteSnapshot,
        getSnapshots,
        startAutoSave,
        stopAutoSave,
        autoSave,
        getAutoSave,
        restoreAutoSave,
        clearAutoSave,
        exportBackupData,
        subscribe,
        reset // For testing
    };
})();

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackupManager;
}
