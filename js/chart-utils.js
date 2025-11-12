/**
 * EWU Design Schedule Analyzer - Chart Utilities
 * Helper functions for Chart.js visualizations
 */

// Color scheme constants
const CHART_COLORS = {
    primary: '#667eea',
    secondary: '#764ba2',
    success: '#51cf66',
    warning: '#ffa726',
    danger: '#ff6b6b',
    info: '#74c0fc',
    light: '#e9ecef',
    dark: '#495057'
};

const UTILIZATION_COLORS = {
    overloaded: '#ff6b6b',
    optimal: '#51cf66',
    underutilized: '#74c0fc'
};

const TRANSPARENCY = {
    solid: 1.0,
    medium: 0.8,
    light: 0.5,
    veryLight: 0.2
};

/**
 * Common Chart.js default options
 */
const DEFAULT_CHART_OPTIONS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'top',
            labels: {
                font: {
                    size: 12,
                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto'
                },
                padding: 15
            }
        }
    }
};

/**
 * Create a bar chart with common configuration
 * @param {HTMLCanvasElement} canvas - Canvas element or context
 * @param {Object} config - Chart configuration
 * @returns {Chart} Chart.js instance
 */
function createBarChart(canvas, config) {
    const ctx = canvas.getContext ? canvas.getContext('2d') : canvas;

    const defaultConfig = {
        type: 'bar',
        options: {
            ...DEFAULT_CHART_OPTIONS,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    };

    // Merge user config with defaults
    const mergedConfig = deepMerge(defaultConfig, config);

    return new Chart(ctx, mergedConfig);
}

/**
 * Create a stacked bar chart
 * @param {HTMLCanvasElement} canvas - Canvas element or context
 * @param {Object} config - Chart configuration
 * @returns {Chart} Chart.js instance
 */
function createStackedBarChart(canvas, config) {
    const ctx = canvas.getContext ? canvas.getContext('2d') : canvas;

    const stackedConfig = {
        type: 'bar',
        options: {
            ...DEFAULT_CHART_OPTIONS,
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    beginAtZero: true
                }
            }
        }
    };

    const mergedConfig = deepMerge(stackedConfig, config);
    return new Chart(ctx, mergedConfig);
}

/**
 * Create a pie/doughnut chart
 * @param {HTMLCanvasElement} canvas - Canvas element or context
 * @param {Object} config - Chart configuration
 * @param {string} type - 'pie' or 'doughnut'
 * @returns {Chart} Chart.js instance
 */
function createPieChart(canvas, config, type = 'doughnut') {
    const ctx = canvas.getContext ? canvas.getContext('2d') : canvas;

    const pieConfig = {
        type: type,
        options: {
            ...DEFAULT_CHART_OPTIONS,
            cutout: type === 'doughnut' ? '60%' : 0
        }
    };

    const mergedConfig = deepMerge(pieConfig, config);
    return new Chart(ctx, mergedConfig);
}

/**
 * Create a line chart
 * @param {HTMLCanvasElement} canvas - Canvas element or context
 * @param {Object} config - Chart configuration
 * @returns {Chart} Chart.js instance
 */
function createLineChart(canvas, config) {
    const ctx = canvas.getContext ? canvas.getContext('2d') : canvas;

    const lineConfig = {
        type: 'line',
        options: {
            ...DEFAULT_CHART_OPTIONS,
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            elements: {
                line: {
                    tension: 0.4
                }
            }
        }
    };

    const mergedConfig = deepMerge(lineConfig, config);
    return new Chart(ctx, mergedConfig);
}

/**
 * Destroy existing chart if it exists
 * @param {Chart} chart - Chart.js instance
 */
function destroyChart(chart) {
    if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
    }
}

/**
 * Get utilization color based on rate
 * @param {number} rate - Utilization rate percentage
 * @returns {string} Color hex code
 */
function getUtilizationColor(rate) {
    if (rate > 100) return UTILIZATION_COLORS.overloaded;
    if (rate >= 60) return UTILIZATION_COLORS.optimal;
    return UTILIZATION_COLORS.underutilized;
}

/**
 * Generate gradient colors for multiple data points
 * @param {number} count - Number of colors needed
 * @param {number} alpha - Alpha transparency (0-1)
 * @returns {Array<string>} Array of rgba color strings
 */
function generateGradientColors(count, alpha = 0.8) {
    const colors = [];
    const hueStep = 360 / count;

    for (let i = 0; i < count; i++) {
        const hue = i * hueStep;
        colors.push(`hsla(${hue}, 70%, 60%, ${alpha})`);
    }

    return colors;
}

/**
 * Create dataset for workload distribution (scheduled + applied learning)
 * @param {Array} facultyList - Array of [name, data] pairs
 * @returns {Object} Datasets object for Chart.js
 */
function createWorkloadDatasets(facultyList) {
    return {
        labels: facultyList.map(([name, _]) => name),
        datasets: [
            {
                label: 'Scheduled Courses',
                data: facultyList.map(([_, data]) => data.scheduledCredits || 0),
                backgroundColor: `rgba(102, 126, 234, ${TRANSPARENCY.medium})`,
                borderColor: CHART_COLORS.primary,
                borderWidth: 2
            },
            {
                label: 'Applied Learning (Weighted)',
                data: facultyList.map(([_, data]) => data.appliedLearningWorkload || 0),
                backgroundColor: `rgba(155, 89, 182, ${TRANSPARENCY.medium})`,
                borderColor: CHART_COLORS.secondary,
                borderWidth: 2
            }
        ]
    };
}

/**
 * Create dataset for utilization pie chart
 * @param {Object} stats - Statistics with overloaded, optimal, underutilized counts
 * @returns {Object} Dataset object for Chart.js
 */
function createUtilizationPieData(stats) {
    return {
        labels: ['Overloaded', 'Optimal', 'Underutilized'],
        datasets: [{
            data: [
                stats.overloaded || 0,
                stats.optimal || 0,
                stats.underutilized || 0
            ],
            backgroundColor: [
                UTILIZATION_COLORS.overloaded,
                UTILIZATION_COLORS.optimal,
                UTILIZATION_COLORS.underutilized
            ],
            borderWidth: 2,
            borderColor: '#fff'
        }]
    };
}

/**
 * Format number with commas for display
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
    const output = Object.assign({}, target);

    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }

    return output;
}

/**
 * Check if value is an object
 * @param {*} item - Value to check
 * @returns {boolean} True if object
 */
function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Create tooltip formatter for workload charts
 * @returns {Object} Tooltip configuration
 */
function createWorkloadTooltip() {
    return {
        callbacks: {
            label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                    label += ': ';
                }
                label += context.parsed.y + ' credits';
                return label;
            },
            footer: function(tooltipItems) {
                let sum = 0;
                tooltipItems.forEach(function(tooltipItem) {
                    sum += tooltipItem.parsed.y;
                });
                return 'Total: ' + sum + ' credits';
            }
        }
    };
}

// Store chart instances globally to allow cleanup
window.chartInstances = window.chartInstances || {};

/**
 * Register a chart instance for cleanup
 * @param {string} id - Chart identifier
 * @param {Chart} chart - Chart.js instance
 */
function registerChart(id, chart) {
    if (window.chartInstances[id]) {
        destroyChart(window.chartInstances[id]);
    }
    window.chartInstances[id] = chart;
}

/**
 * Destroy all registered charts
 */
function destroyAllCharts() {
    Object.values(window.chartInstances).forEach(chart => destroyChart(chart));
    window.chartInstances = {};
}
