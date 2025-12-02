/**
 * EWU Design Schedule Analyzer - Constants Configuration
 * Centralized configuration for all magic numbers and constants
 */

const CONSTANTS = {
    // ===========================================
    // WORKLOAD CONFIGURATION
    // ===========================================
    WORKLOAD: {
        /**
         * Credit multipliers for applied learning courses
         * Regular courses use 1.0 multiplier
         */
        MULTIPLIERS: {
            'DESN 499': 0.2,  // Independent Study
            'DESN 495': 0.1,  // Internship
            'DESN 491': 0.15, // Practicum
            DEFAULT: 1.0
        },

        /**
         * Maximum workload credits per academic year by faculty rank
         */
        LIMITS: {
            'Full Professor': 36,
            'Associate Professor': 36,
            'Assistant Professor': 36,
            'Senior Lecturer': 45,
            'Lecturer': 45,
            'Adjunct': 15
        },

        /**
         * Utilization rate thresholds (percentage)
         */
        UTILIZATION_THRESHOLDS: {
            OVERLOADED: 100,    // Above 100% = overloaded
            OPTIMAL_MIN: 60,    // 60-100% = optimal
            UNDERUTILIZED: 60   // Below 60% = underutilized
        },

        /**
         * Default values
         */
        DEFAULTS: {
            CREDITS_PER_COURSE: 5,
            MAX_WORKLOAD: 45
        }
    },

    // ===========================================
    // RELEASE TIME CONFIGURATION
    // ===========================================
    RELEASE_TIME: {
        /**
         * Release time category definitions
         */
        CATEGORIES: [
            { id: 'sabbatical', label: 'Sabbatical', color: '#10b981', maxCredits: 45 },
            { id: 'chair', label: 'Chair Duties', color: '#f59e0b', maxCredits: 15 },
            { id: 'advising', label: 'Advising', color: '#3b82f6', maxCredits: 10 },
            { id: 'committee', label: 'Committee Work', color: '#8b5cf6', maxCredits: 6 },
            { id: 'coordinator', label: 'Coordinator', color: '#06b6d4', maxCredits: 10 },
            { id: 'research', label: 'Research/Grants', color: '#14b8a6', maxCredits: 15 },
            { id: 'course_release', label: 'Course Release', color: '#ec4899', maxCredits: 15 },
            { id: 'independent_study', label: 'Independent Study (499)', color: '#f472b6', maxCredits: 15 },
            { id: 'applied_learning', label: 'Applied Learning (495)', color: '#a78bfa', maxCredits: 15 },
            { id: 'other', label: 'Other', color: '#6b7280', maxCredits: 10 }
        ],

        /**
         * Valid academic quarters
         */
        VALID_QUARTERS: ['Fall', 'Winter', 'Spring', 'Summer'],

        /**
         * Maximum total release time credits per year
         */
        MAX_ANNUAL_CREDITS: 45
    },

    // ===========================================
    // ACADEMIC YEAR CONFIGURATION
    // ===========================================
    ACADEMIC_YEAR: {
        /**
         * Available academic years for filtering
         */
        AVAILABLE_YEARS: ['2022-23', '2023-24', '2024-25', '2025-26'],

        /**
         * Default year to display
         */
        DEFAULT_YEAR: '2025-26',

        /**
         * Current projected year (data may be estimated)
         */
        PROJECTED_YEAR: '2025-26'
    },

    // ===========================================
    // CHART CONFIGURATION
    // ===========================================
    CHART: {
        /**
         * Default chart dimensions
         */
        HEIGHTS: {
            DEFAULT: 300,
            TALL: 400,
            SHORT: 250,
            MINI: 200
        },

        /**
         * Color schemes for different data types
         */
        COLORS: {
            // Utilization status colors
            UTILIZATION: {
                OVERLOADED: '#dc3545',    // Red
                OPTIMAL: '#28a745',        // Green
                UNDERUTILIZED: '#ffc107'   // Yellow/Amber
            },

            // Primary chart colors (for bars, lines, etc.)
            PRIMARY: [
                '#3b82f6', // Blue
                '#10b981', // Green
                '#f59e0b', // Amber
                '#ef4444', // Red
                '#8b5cf6', // Purple
                '#06b6d4', // Cyan
                '#ec4899', // Pink
                '#14b8a6'  // Teal
            ],

            // Faculty category colors
            FACULTY: {
                FULL_TIME: '#3b82f6',
                ADJUNCT: '#f59e0b',
                FORMER: '#6b7280'
            },

            // Workload type colors
            WORKLOAD: {
                SCHEDULED: '#3b82f6',
                APPLIED_LEARNING: '#10b981',
                RELEASE_TIME: '#f59e0b'
            }
        },

        /**
         * Animation settings
         */
        ANIMATION: {
            DURATION: 750,
            EASING: 'easeInOutQuart'
        }
    },

    // ===========================================
    // UI CONFIGURATION
    // ===========================================
    UI: {
        /**
         * Table display limits
         */
        TABLE: {
            DEFAULT_PAGE_SIZE: 10,
            MAX_PAGE_SIZE: 50,
            TOP_FACULTY_LIMIT: 15
        },

        /**
         * Status badge classes
         */
        STATUS_CLASSES: {
            OVERLOADED: 'status-overloaded',
            OPTIMAL: 'status-optimal',
            UNDERUTILIZED: 'status-underutilized'
        },

        /**
         * Toast notification duration (ms)
         */
        TOAST_DURATION: 5000,

        /**
         * Debounce delay for search/filter inputs (ms)
         */
        DEBOUNCE_DELAY: 300
    },

    // ===========================================
    // DATA LOADING CONFIGURATION
    // ===========================================
    DATA: {
        /**
         * File paths (relative to pages/ directory)
         */
        PATHS: {
            WORKLOAD: '../workload-data.json',
            ENROLLMENT: '../enrollment-dashboard-data.json',
            ADJUSTMENTS: '../data/release-time-adjustments.json'
        },

        /**
         * Cache settings
         */
        CACHE: {
            ENABLED: true,
            DURATION: 5 * 60 * 1000  // 5 minutes in milliseconds
        },

        /**
         * Retry settings for failed requests
         */
        RETRY: {
            MAX_ATTEMPTS: 3,
            DELAY: 1000  // ms between retries
        }
    },

    // ===========================================
    // NOTIFICATION CONFIGURATION
    // ===========================================
    NOTIFICATIONS: {
        /**
         * Priority levels
         */
        PRIORITY: {
            CRITICAL: 'critical',
            WARNING: 'warning',
            INFO: 'info',
            SUCCESS: 'success'
        },

        /**
         * Alert thresholds
         */
        THRESHOLDS: {
            CAPACITY_CRITICAL: 110,     // Utilization % to trigger critical alert
            CAPACITY_WARNING: 95,       // Utilization % to trigger warning
            ENROLLMENT_SPIKE: 20,       // % growth to flag as spike
            LOW_ENROLLMENT: 10          // Minimum enrollment before warning
        },

        /**
         * Maximum notifications to store
         */
        MAX_STORED: 50
    },

    // ===========================================
    // EXPORT CONFIGURATION
    // ===========================================
    EXPORT: {
        /**
         * Supported export formats
         */
        FORMATS: ['pdf', 'csv', 'excel'],

        /**
         * PDF settings
         */
        PDF: {
            PAGE_SIZE: 'letter',
            ORIENTATION: 'landscape',
            MARGIN: 40
        },

        /**
         * CSV settings
         */
        CSV: {
            DELIMITER: ',',
            LINE_ENDING: '\n'
        }
    },

    // ===========================================
    // VALIDATION CONFIGURATION
    // ===========================================
    VALIDATION: {
        /**
         * Course code pattern (e.g., "DESN 100", "DESN 499")
         */
        COURSE_CODE_PATTERN: /^DESN\s\d{3}$/,

        /**
         * Academic year pattern (e.g., "2024-25")
         */
        ACADEMIC_YEAR_PATTERN: /^\d{4}-\d{2}$/,

        /**
         * Maximum credits per course
         */
        MAX_CREDITS_PER_COURSE: 15,

        /**
         * Maximum enrollment per section
         */
        MAX_ENROLLMENT_PER_SECTION: 100
    },

    // ===========================================
    // BACKUP/UNDO CONFIGURATION
    // ===========================================
    BACKUP: {
        /**
         * Maximum history items to keep
         */
        MAX_HISTORY: 20,

        /**
         * Local storage key prefix
         */
        STORAGE_KEY_PREFIX: 'ewu_schedule_',

        /**
         * Auto-save interval (ms)
         */
        AUTO_SAVE_INTERVAL: 30000  // 30 seconds
    }
};

// Freeze the object to prevent accidental modifications
if (typeof Object.freeze === 'function') {
    Object.freeze(CONSTANTS);
    Object.freeze(CONSTANTS.WORKLOAD);
    Object.freeze(CONSTANTS.WORKLOAD.MULTIPLIERS);
    Object.freeze(CONSTANTS.WORKLOAD.LIMITS);
    Object.freeze(CONSTANTS.WORKLOAD.UTILIZATION_THRESHOLDS);
    Object.freeze(CONSTANTS.RELEASE_TIME);
    Object.freeze(CONSTANTS.ACADEMIC_YEAR);
    Object.freeze(CONSTANTS.CHART);
    Object.freeze(CONSTANTS.CHART.COLORS);
    Object.freeze(CONSTANTS.UI);
    Object.freeze(CONSTANTS.DATA);
    Object.freeze(CONSTANTS.NOTIFICATIONS);
    Object.freeze(CONSTANTS.EXPORT);
    Object.freeze(CONSTANTS.VALIDATION);
    Object.freeze(CONSTANTS.BACKUP);
}

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONSTANTS;
}
