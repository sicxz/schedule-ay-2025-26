/**
 * EWU Design Schedule Analyzer - DOM Utilities
 * Safe DOM manipulation functions to prevent XSS vulnerabilities
 *
 * IMPORTANT: Always use these functions instead of innerHTML when dealing
 * with dynamic content or user-influenced data.
 */

const DOMUtils = (function() {
    'use strict';

    /**
     * Create an element with attributes and children safely
     * @param {string} tag - HTML tag name
     * @param {Object} attributes - Attributes to set (className, id, textContent, data-*, etc.)
     * @param {Array|string|Node} children - Child elements, text, or single node
     * @returns {HTMLElement} The created element
     *
     * @example
     * createElement('div', { className: 'card', id: 'myCard' }, [
     *     createElement('h2', { textContent: 'Title' }),
     *     createElement('p', { textContent: 'Description' })
     * ])
     */
    function createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);

        // Set attributes safely
        Object.entries(attributes).forEach(([key, value]) => {
            if (value === null || value === undefined) return;

            switch (key) {
                case 'className':
                    element.className = String(value);
                    break;
                case 'textContent':
                    element.textContent = String(value);
                    break;
                case 'htmlContent':
                    // Only use for trusted static HTML templates
                    console.warn('DOMUtils: htmlContent should only be used for trusted content');
                    element.innerHTML = value;
                    break;
                case 'style':
                    if (typeof value === 'object') {
                        Object.assign(element.style, value);
                    } else {
                        element.style.cssText = String(value);
                    }
                    break;
                case 'dataset':
                    if (typeof value === 'object') {
                        Object.entries(value).forEach(([dataKey, dataValue]) => {
                            element.dataset[dataKey] = String(dataValue);
                        });
                    }
                    break;
                case 'events':
                    if (typeof value === 'object') {
                        Object.entries(value).forEach(([eventName, handler]) => {
                            element.addEventListener(eventName, handler);
                        });
                    }
                    break;
                case 'aria':
                    if (typeof value === 'object') {
                        Object.entries(value).forEach(([ariaKey, ariaValue]) => {
                            element.setAttribute(`aria-${ariaKey}`, String(ariaValue));
                        });
                    }
                    break;
                default:
                    // Handle data-* attributes
                    if (key.startsWith('data-')) {
                        element.setAttribute(key, String(value));
                    } else if (key === 'for') {
                        element.setAttribute('for', String(value));
                    } else if (typeof value === 'boolean') {
                        if (value) {
                            element.setAttribute(key, '');
                        }
                    } else {
                        element.setAttribute(key, String(value));
                    }
            }
        });

        // Append children
        appendChildren(element, children);

        return element;
    }

    /**
     * Append children to an element safely
     * @param {HTMLElement} parent - Parent element
     * @param {Array|string|Node} children - Children to append
     */
    function appendChildren(parent, children) {
        if (!children) return;

        const childArray = Array.isArray(children) ? children : [children];

        childArray.forEach(child => {
            if (child === null || child === undefined) return;

            if (typeof child === 'string' || typeof child === 'number') {
                parent.appendChild(document.createTextNode(String(child)));
            } else if (child instanceof Node) {
                parent.appendChild(child);
            }
        });
    }

    /**
     * Clear all children from an element
     * @param {HTMLElement|string} element - Element or element ID
     */
    function clearElement(element) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (!el) return;

        while (el.firstChild) {
            el.removeChild(el.firstChild);
        }
    }

    /**
     * Set text content safely
     * @param {HTMLElement|string} element - Element or element ID
     * @param {string} text - Text to set
     */
    function setTextContent(element, text) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el) {
            el.textContent = String(text ?? '');
        }
    }

    /**
     * Replace an element's content with new children
     * @param {HTMLElement|string} element - Element or element ID
     * @param {Array|Node|string} children - New children
     */
    function replaceContent(element, children) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (!el) return;

        clearElement(el);
        appendChildren(el, children);
    }

    /**
     * Create a text node
     * @param {string} text - Text content
     * @returns {Text} Text node
     */
    function createText(text) {
        return document.createTextNode(String(text ?? ''));
    }

    /**
     * Create a safe error display element
     * @param {string} title - Error title
     * @param {string} message - Error message
     * @param {Object} options - Additional options
     * @returns {HTMLElement} Error element
     */
    function createErrorElement(title, message, options = {}) {
        const { suggestion = null, onRetry = null } = options;

        const container = createElement('div', {
            className: 'error-container',
            style: {
                color: '#dc3545',
                padding: '20px',
                backgroundColor: '#fff5f5',
                border: '1px solid #dc3545',
                borderRadius: '8px',
                margin: '20px 0'
            },
            role: 'alert',
            aria: { live: 'polite' }
        });

        // Title
        container.appendChild(
            createElement('h3', {
                textContent: `\u26A0\uFE0F ${title}`,
                style: { margin: '0 0 10px 0' }
            })
        );

        // Message
        container.appendChild(
            createElement('p', {
                textContent: message,
                style: { margin: '0 0 10px 0' }
            })
        );

        // Suggestion
        if (suggestion) {
            const suggestionEl = createElement('p', {
                style: { marginTop: '15px', fontSize: '0.9em' }
            });
            suggestionEl.appendChild(createText(suggestion.text || ''));

            if (suggestion.code) {
                suggestionEl.appendChild(createElement('br'));
                suggestionEl.appendChild(
                    createElement('code', {
                        textContent: suggestion.code,
                        style: {
                            background: '#f8f9fa',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            marginTop: '5px'
                        }
                    })
                );
            }
            container.appendChild(suggestionEl);
        }

        // Retry button
        if (onRetry && typeof onRetry === 'function') {
            container.appendChild(
                createElement('button', {
                    textContent: 'Retry',
                    className: 'btn btn-primary',
                    style: { marginTop: '15px' },
                    events: { click: onRetry }
                })
            );
        }

        return container;
    }

    /**
     * Create a loading element
     * @param {string} message - Loading message
     * @returns {HTMLElement} Loading element
     */
    function createLoadingElement(message = 'Loading...') {
        return createElement('div', {
            className: 'loading-container',
            style: {
                textAlign: 'center',
                padding: '40px',
                color: '#666'
            },
            aria: { busy: 'true', live: 'polite' }
        }, [
            createElement('div', {
                className: 'loading-spinner',
                style: {
                    width: '40px',
                    height: '40px',
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #3498db',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 15px'
                }
            }),
            createElement('p', { textContent: message })
        ]);
    }

    /**
     * Create a stats card element
     * @param {string} label - Card label
     * @param {string|number} value - Card value
     * @param {Object} options - Additional options (color, icon, trend)
     * @returns {HTMLElement} Stats card element
     */
    function createStatsCard(label, value, options = {}) {
        const { color = '#333', icon = null, trend = null, subtitle = null } = options;

        const card = createElement('div', {
            className: 'stat-card',
            style: {
                padding: '15px',
                backgroundColor: '#fff',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                textAlign: 'center'
            }
        });

        // Value
        card.appendChild(
            createElement('div', {
                className: 'stat-value',
                textContent: String(value),
                style: {
                    fontSize: '2em',
                    fontWeight: 'bold',
                    color: color
                }
            })
        );

        // Label
        card.appendChild(
            createElement('div', {
                className: 'stat-label',
                textContent: label,
                style: {
                    color: '#666',
                    marginTop: '5px'
                }
            })
        );

        // Subtitle (optional)
        if (subtitle) {
            card.appendChild(
                createElement('div', {
                    className: 'stat-subtitle',
                    textContent: subtitle,
                    style: {
                        fontSize: '0.85em',
                        color: '#888',
                        marginTop: '3px'
                    }
                })
            );
        }

        // Trend indicator (optional)
        if (trend) {
            const trendColor = trend.direction === 'up' ? '#28a745' :
                              trend.direction === 'down' ? '#dc3545' : '#666';
            const trendIcon = trend.direction === 'up' ? '\u2191' :
                             trend.direction === 'down' ? '\u2193' : '\u2194';

            card.appendChild(
                createElement('div', {
                    className: 'stat-trend',
                    textContent: `${trendIcon} ${trend.value}`,
                    style: {
                        fontSize: '0.85em',
                        color: trendColor,
                        marginTop: '5px'
                    }
                })
            );
        }

        return card;
    }

    /**
     * Create a table from data
     * @param {Array<Object>} data - Array of row objects
     * @param {Array<Object>} columns - Column definitions [{key, label, formatter}]
     * @param {Object} options - Table options
     * @returns {HTMLElement} Table element
     */
    function createTable(data, columns, options = {}) {
        const { className = 'data-table', emptyMessage = 'No data available' } = options;

        const table = createElement('table', { className });

        // Header
        const thead = createElement('thead');
        const headerRow = createElement('tr');
        columns.forEach(col => {
            headerRow.appendChild(
                createElement('th', {
                    textContent: col.label,
                    scope: 'col'
                })
            );
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = createElement('tbody');

        if (data.length === 0) {
            const emptyRow = createElement('tr');
            emptyRow.appendChild(
                createElement('td', {
                    textContent: emptyMessage,
                    colSpan: String(columns.length),
                    style: { textAlign: 'center', padding: '20px', color: '#666' }
                })
            );
            tbody.appendChild(emptyRow);
        } else {
            data.forEach((row, index) => {
                const tr = createElement('tr', { 'data-index': index });
                columns.forEach(col => {
                    const value = row[col.key];
                    const displayValue = col.formatter ? col.formatter(value, row) : value;

                    const td = createElement('td');
                    if (displayValue instanceof Node) {
                        td.appendChild(displayValue);
                    } else {
                        td.textContent = String(displayValue ?? '');
                    }
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
        }

        table.appendChild(tbody);
        return table;
    }

    /**
     * Create a badge element
     * @param {string} text - Badge text
     * @param {string} type - Badge type (success, warning, danger, info)
     * @returns {HTMLElement} Badge element
     */
    function createBadge(text, type = 'info') {
        const colors = {
            success: { bg: '#d4edda', text: '#155724' },
            warning: { bg: '#fff3cd', text: '#856404' },
            danger: { bg: '#f8d7da', text: '#721c24' },
            info: { bg: '#d1ecf1', text: '#0c5460' }
        };

        const colorScheme = colors[type] || colors.info;

        return createElement('span', {
            className: `badge badge-${type}`,
            textContent: text,
            style: {
                display: 'inline-block',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.85em',
                fontWeight: '500',
                backgroundColor: colorScheme.bg,
                color: colorScheme.text
            }
        });
    }

    /**
     * Show an element
     * @param {HTMLElement|string} element - Element or element ID
     * @param {string} display - Display value (default: 'block')
     */
    function showElement(element, display = 'block') {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el) {
            el.style.display = display;
        }
    }

    /**
     * Hide an element
     * @param {HTMLElement|string} element - Element or element ID
     */
    function hideElement(element) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el) {
            el.style.display = 'none';
        }
    }

    /**
     * Toggle element visibility
     * @param {HTMLElement|string} element - Element or element ID
     * @param {boolean} show - Force show/hide (optional)
     */
    function toggleElement(element, show) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (!el) return;

        const shouldShow = show !== undefined ? show : el.style.display === 'none';
        el.style.display = shouldShow ? '' : 'none';
    }

    /**
     * Safely get an element by ID with error handling
     * @param {string} id - Element ID
     * @param {boolean} required - Whether to log warning if not found
     * @returns {HTMLElement|null} Element or null
     */
    function getElement(id, required = false) {
        const el = document.getElementById(id);
        if (!el && required) {
            console.warn(`DOMUtils: Required element not found: #${id}`);
        }
        return el;
    }

    /**
     * Create a document fragment with children
     * @param {Array} children - Children to add
     * @returns {DocumentFragment} Fragment
     */
    function createFragment(children) {
        const fragment = document.createDocumentFragment();
        appendChildren(fragment, children);
        return fragment;
    }

    // Public API
    return {
        createElement,
        createText,
        clearElement,
        setTextContent,
        replaceContent,
        appendChildren,
        createErrorElement,
        createLoadingElement,
        createStatsCard,
        createTable,
        createBadge,
        showElement,
        hideElement,
        toggleElement,
        getElement,
        createFragment
    };
})();

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOMUtils;
}
