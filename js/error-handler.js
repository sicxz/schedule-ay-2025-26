/**
 * EWU Design Schedule Analyzer - Error Handler
 * Centralized error handling with user-facing feedback
 */

const ErrorHandler = (function() {
    'use strict';

    /**
     * Error types for categorization
     */
    const ERROR_TYPES = {
        NETWORK: 'network',
        DATA: 'data',
        VALIDATION: 'validation',
        PERMISSION: 'permission',
        NOT_FOUND: 'not_found',
        TIMEOUT: 'timeout',
        UNKNOWN: 'unknown'
    };

    /**
     * Error severity levels
     */
    const SEVERITY = {
        CRITICAL: 'critical',   // App cannot function
        ERROR: 'error',         // Feature is broken
        WARNING: 'warning',     // Degraded functionality
        INFO: 'info'           // Informational
    };

    /**
     * Default error messages by type
     */
    const DEFAULT_MESSAGES = {
        [ERROR_TYPES.NETWORK]: {
            title: 'Connection Error',
            message: 'Unable to connect to the server. Please check your internet connection.',
            suggestion: 'Try refreshing the page or check if you are connected to the network.'
        },
        [ERROR_TYPES.DATA]: {
            title: 'Data Error',
            message: 'The data could not be loaded or is in an unexpected format.',
            suggestion: 'The data files may need to be regenerated.'
        },
        [ERROR_TYPES.VALIDATION]: {
            title: 'Validation Error',
            message: 'The provided data does not meet the required format.',
            suggestion: 'Please check the input values and try again.'
        },
        [ERROR_TYPES.PERMISSION]: {
            title: 'Permission Denied',
            message: 'You do not have permission to perform this action.',
            suggestion: 'Please contact your administrator if you believe this is an error.'
        },
        [ERROR_TYPES.NOT_FOUND]: {
            title: 'Not Found',
            message: 'The requested resource could not be found.',
            suggestion: 'Make sure the data files exist in the correct location.'
        },
        [ERROR_TYPES.TIMEOUT]: {
            title: 'Request Timeout',
            message: 'The request took too long to complete.',
            suggestion: 'Please try again. If the problem persists, the server may be experiencing issues.'
        },
        [ERROR_TYPES.UNKNOWN]: {
            title: 'Unexpected Error',
            message: 'An unexpected error occurred.',
            suggestion: 'Please refresh the page and try again.'
        }
    };

    /**
     * Error log storage
     */
    let errorLog = [];
    const MAX_LOG_SIZE = 100;

    /**
     * Current error container element
     */
    let defaultContainer = null;

    /**
     * Initialize the error handler
     * @param {Object} options - Configuration options
     */
    function init(options = {}) {
        if (options.container) {
            defaultContainer = typeof options.container === 'string'
                ? document.getElementById(options.container)
                : options.container;
        }

        // Set up global error handlers
        if (options.captureGlobalErrors !== false) {
            setupGlobalErrorHandlers();
        }
    }

    /**
     * Set up global error handlers
     */
    function setupGlobalErrorHandlers() {
        // Handle uncaught errors
        window.addEventListener('error', function(event) {
            logError({
                type: ERROR_TYPES.UNKNOWN,
                severity: SEVERITY.ERROR,
                message: event.message,
                source: event.filename,
                line: event.lineno,
                column: event.colno,
                stack: event.error?.stack
            });
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', function(event) {
            logError({
                type: ERROR_TYPES.UNKNOWN,
                severity: SEVERITY.ERROR,
                message: event.reason?.message || 'Unhandled promise rejection',
                stack: event.reason?.stack
            });
        });
    }

    /**
     * Determine error type from an error object or response
     * @param {Error|Response|Object} error - Error to analyze
     * @returns {string} Error type
     */
    function determineErrorType(error) {
        if (!error) return ERROR_TYPES.UNKNOWN;

        // Fetch Response
        if (error instanceof Response || error.status) {
            const status = error.status;
            if (status === 404) return ERROR_TYPES.NOT_FOUND;
            if (status === 403 || status === 401) return ERROR_TYPES.PERMISSION;
            if (status >= 500) return ERROR_TYPES.NETWORK;
            return ERROR_TYPES.DATA;
        }

        // Network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
            return ERROR_TYPES.NETWORK;
        }
        if (error.name === 'AbortError' || error.message?.includes('timeout')) {
            return ERROR_TYPES.TIMEOUT;
        }

        // JSON parse errors
        if (error instanceof SyntaxError && error.message.includes('JSON')) {
            return ERROR_TYPES.DATA;
        }

        // Validation errors
        if (error.name === 'ValidationError' || error.type === 'validation') {
            return ERROR_TYPES.VALIDATION;
        }

        return ERROR_TYPES.UNKNOWN;
    }

    /**
     * Log an error
     * @param {Object} errorInfo - Error information
     */
    function logError(errorInfo) {
        const entry = {
            timestamp: new Date().toISOString(),
            ...errorInfo
        };

        errorLog.push(entry);

        // Trim log if too large
        if (errorLog.length > MAX_LOG_SIZE) {
            errorLog = errorLog.slice(-MAX_LOG_SIZE);
        }

        // Console output for debugging
        console.error('[ErrorHandler]', entry);
    }

    /**
     * Show an error to the user
     * @param {string|Error|Object} error - Error to display
     * @param {Object} options - Display options
     */
    function show(error, options = {}) {
        const {
            container = defaultContainer,
            type = null,
            title = null,
            message = null,
            suggestion = null,
            code = null,
            onRetry = null,
            onDismiss = null,
            autoDismiss = false,
            dismissDelay = 10000
        } = options;

        // Determine error type
        const errorType = type || determineErrorType(error);
        const defaults = DEFAULT_MESSAGES[errorType] || DEFAULT_MESSAGES[ERROR_TYPES.UNKNOWN];

        // Build error info
        const errorInfo = {
            type: errorType,
            title: title || defaults.title,
            message: message || (error instanceof Error ? error.message : defaults.message),
            suggestion: suggestion || defaults.suggestion,
            code: code
        };

        // Log the error
        logError({
            ...errorInfo,
            originalError: error instanceof Error ? error.stack : error
        });

        // Create error element using DOMUtils if available, otherwise use basic DOM
        const errorElement = createErrorElement(errorInfo, { onRetry, onDismiss });

        // Display the error
        const targetContainer = typeof container === 'string'
            ? document.getElementById(container)
            : container;

        if (targetContainer) {
            // Clear previous errors
            clearErrors(targetContainer);
            targetContainer.appendChild(errorElement);
            targetContainer.style.display = 'block';

            // Auto-dismiss if configured
            if (autoDismiss) {
                setTimeout(() => {
                    hide(targetContainer);
                    if (onDismiss) onDismiss();
                }, dismissDelay);
            }
        } else {
            console.warn('[ErrorHandler] No container specified for error display');
        }

        return errorElement;
    }

    /**
     * Create an error display element
     * @param {Object} errorInfo - Error information
     * @param {Object} callbacks - Callback functions
     * @returns {HTMLElement} Error element
     */
    function createErrorElement(errorInfo, callbacks = {}) {
        const { onRetry, onDismiss } = callbacks;

        // Use DOMUtils if available
        if (typeof DOMUtils !== 'undefined' && DOMUtils.createErrorElement) {
            return DOMUtils.createErrorElement(errorInfo.title, errorInfo.message, {
                suggestion: errorInfo.suggestion ? {
                    text: errorInfo.suggestion,
                    code: errorInfo.code
                } : null,
                onRetry
            });
        }

        // Fallback: create element manually (safe DOM methods)
        const container = document.createElement('div');
        container.className = 'error-container error-' + errorInfo.type;
        container.setAttribute('role', 'alert');
        container.setAttribute('aria-live', 'polite');
        container.style.cssText = 'color: #dc3545; padding: 20px; background-color: #fff5f5; border: 1px solid #dc3545; border-radius: 8px; margin: 20px 0;';

        // Title
        const titleEl = document.createElement('h3');
        titleEl.textContent = '\u26A0\uFE0F ' + errorInfo.title;
        titleEl.style.margin = '0 0 10px 0';
        container.appendChild(titleEl);

        // Message
        const messageEl = document.createElement('p');
        messageEl.textContent = errorInfo.message;
        messageEl.style.margin = '0 0 10px 0';
        container.appendChild(messageEl);

        // Suggestion
        if (errorInfo.suggestion) {
            const suggestionEl = document.createElement('p');
            suggestionEl.style.cssText = 'margin-top: 15px; font-size: 0.9em;';
            suggestionEl.textContent = errorInfo.suggestion;

            if (errorInfo.code) {
                suggestionEl.appendChild(document.createElement('br'));
                const codeEl = document.createElement('code');
                codeEl.textContent = errorInfo.code;
                codeEl.style.cssText = 'background: #f8f9fa; padding: 5px 10px; border-radius: 4px; display: inline-block; margin-top: 5px;';
                suggestionEl.appendChild(codeEl);
            }

            container.appendChild(suggestionEl);
        }

        // Buttons container
        const buttonsEl = document.createElement('div');
        buttonsEl.style.cssText = 'margin-top: 15px; display: flex; gap: 10px;';

        // Retry button
        if (onRetry && typeof onRetry === 'function') {
            const retryBtn = document.createElement('button');
            retryBtn.textContent = 'Retry';
            retryBtn.className = 'btn btn-primary';
            retryBtn.style.cssText = 'padding: 8px 16px; border: none; border-radius: 4px; background: #3b82f6; color: white; cursor: pointer;';
            retryBtn.addEventListener('click', onRetry);
            buttonsEl.appendChild(retryBtn);
        }

        // Dismiss button
        if (onDismiss && typeof onDismiss === 'function') {
            const dismissBtn = document.createElement('button');
            dismissBtn.textContent = 'Dismiss';
            dismissBtn.className = 'btn btn-secondary';
            dismissBtn.style.cssText = 'padding: 8px 16px; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer;';
            dismissBtn.addEventListener('click', () => {
                container.remove();
                onDismiss();
            });
            buttonsEl.appendChild(dismissBtn);
        }

        if (buttonsEl.children.length > 0) {
            container.appendChild(buttonsEl);
        }

        return container;
    }

    /**
     * Hide/clear error display
     * @param {HTMLElement|string} container - Container element or ID
     */
    function hide(container) {
        const targetContainer = typeof container === 'string'
            ? document.getElementById(container)
            : (container || defaultContainer);

        if (targetContainer) {
            targetContainer.style.display = 'none';
            clearErrors(targetContainer);
        }
    }

    /**
     * Clear all error elements from a container
     * @param {HTMLElement} container - Container element
     */
    function clearErrors(container) {
        if (!container) return;

        const errors = container.querySelectorAll('.error-container');
        errors.forEach(el => el.remove());
    }

    /**
     * Show a network error with data generation instructions
     * @param {HTMLElement|string} container - Container element or ID
     * @param {Function} onRetry - Retry callback
     */
    function showDataLoadError(container, onRetry = null) {
        show(new Error('Failed to load data'), {
            container,
            type: ERROR_TYPES.DATA,
            title: 'Error Loading Data',
            message: 'The dashboard data could not be loaded.',
            suggestion: 'Make sure you\'ve generated the data files by running:',
            code: 'node scripts/workload-calculator.js enrollment-data/processed',
            onRetry
        });
    }

    /**
     * Create a validation error
     * @param {string} field - Field that failed validation
     * @param {string} reason - Reason for failure
     * @returns {Error} Validation error
     */
    function createValidationError(field, reason) {
        const error = new Error(`Validation failed for ${field}: ${reason}`);
        error.name = 'ValidationError';
        error.field = field;
        error.type = 'validation';
        return error;
    }

    /**
     * Wrap an async function with error handling
     * @param {Function} fn - Async function to wrap
     * @param {Object} options - Error handling options
     * @returns {Function} Wrapped function
     */
    function wrapAsync(fn, options = {}) {
        return async function(...args) {
            try {
                return await fn.apply(this, args);
            } catch (error) {
                show(error, options);
                if (options.rethrow) {
                    throw error;
                }
                return options.fallback !== undefined ? options.fallback : null;
            }
        };
    }

    /**
     * Get the error log
     * @returns {Array} Error log entries
     */
    function getLog() {
        return [...errorLog];
    }

    /**
     * Clear the error log
     */
    function clearLog() {
        errorLog = [];
    }

    // Public API
    return {
        init,
        show,
        hide,
        clearErrors,
        showDataLoadError,
        createValidationError,
        wrapAsync,
        determineErrorType,
        logError,
        getLog,
        clearLog,
        ERROR_TYPES,
        SEVERITY
    };
})();

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}
