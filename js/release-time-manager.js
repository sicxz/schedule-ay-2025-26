/**
 * EWU Design Schedule Analyzer - Release Time Manager
 * Manages faculty release time allocations and calculations
 */

const ReleaseTimeManager = (function() {
    'use strict';

    // Get constants if available
    const getConstants = () => {
        if (typeof CONSTANTS !== 'undefined') {
            return CONSTANTS;
        }
        return {
            RELEASE_TIME: {
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
                VALID_QUARTERS: ['Fall', 'Winter', 'Spring', 'Summer'],
                MAX_ANNUAL_CREDITS: 45
            },
            BACKUP: {
                STORAGE_KEY_PREFIX: 'ewu_schedule_'
            }
        };
    };

    /**
     * Internal storage for release time data
     * Structure: { academicYear: { facultyName: { allocations: [...] } } }
     */
    let releaseTimeData = {};

    /**
     * Change listeners
     */
    const listeners = new Set();

    /**
     * Storage key for persistence
     */
    const STORAGE_KEY = 'release_time_data';

    /**
     * Initialize the manager
     * @param {Object} options - Configuration options
     */
    function init(options = {}) {
        // Load from localStorage if available
        loadFromStorage();

        // Load initial data if provided
        if (options.initialData) {
            importData(options.initialData);
        }

        return this;
    }

    /**
     * Get all release time categories
     * @returns {Array} Category definitions
     */
    function getCategories() {
        return getConstants().RELEASE_TIME.CATEGORIES;
    }

    /**
     * Get category by ID
     * @param {string} categoryId - Category ID
     * @returns {Object|null} Category definition
     */
    function getCategoryById(categoryId) {
        return getCategories().find(c => c.id === categoryId) || null;
    }

    /**
     * Get all release time allocations for a faculty member
     * @param {string} facultyName - Faculty name
     * @param {string} academicYear - Academic year (e.g., "2025-26")
     * @returns {Array} List of allocations
     */
    function getFacultyAllocations(facultyName, academicYear) {
        if (!releaseTimeData[academicYear] || !releaseTimeData[academicYear][facultyName]) {
            return [];
        }
        return releaseTimeData[academicYear][facultyName].allocations || [];
    }

    /**
     * Get total release time credits for a faculty member
     * @param {string} facultyName - Faculty name
     * @param {string} academicYear - Academic year
     * @param {string} quarter - Optional specific quarter (if null, returns annual total)
     * @param {boolean} annual - If true and no quarter specified, multiply by quarters count
     * @returns {number} Total credits (annual if no quarter specified, per-quarter if quarter specified)
     */
    function getFacultyTotalCredits(facultyName, academicYear, quarter = null, annual = true) {
        const allocations = getFacultyAllocations(facultyName, academicYear);

        return allocations.reduce((total, alloc) => {
            if (quarter) {
                // Return credits for specific quarter only
                if (!alloc.quarters.includes(quarter)) {
                    return total;
                }
                return total + (alloc.credits || 0);
            }
            // Return annual total (credits × number of quarters)
            const numQuarters = (alloc.quarters || []).length || 1;
            const credits = alloc.credits || 0;
            return total + (annual ? credits * numQuarters : credits);
        }, 0);
    }

    /**
     * Get release time summary by category for a faculty member
     * @param {string} facultyName - Faculty name
     * @param {string} academicYear - Academic year
     * @returns {Object} Credits by category
     */
    function getFacultySummaryByCategory(facultyName, academicYear) {
        const allocations = getFacultyAllocations(facultyName, academicYear);
        const summary = {};

        getCategories().forEach(cat => {
            summary[cat.id] = 0;
        });

        allocations.forEach(alloc => {
            if (summary[alloc.category] !== undefined) {
                summary[alloc.category] += alloc.credits || 0;
            }
        });

        return summary;
    }

    /**
     * Add a release time allocation
     * @param {string} facultyName - Faculty name
     * @param {string} academicYear - Academic year
     * @param {Object} allocation - Allocation data
     * @returns {Object} Result with success status and allocation ID
     */
    function addAllocation(facultyName, academicYear, allocation) {
        const validation = validateAllocation(allocation);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        // Ensure data structure exists
        if (!releaseTimeData[academicYear]) {
            releaseTimeData[academicYear] = {};
        }
        if (!releaseTimeData[academicYear][facultyName]) {
            releaseTimeData[academicYear][facultyName] = { allocations: [] };
        }

        // Generate unique ID
        const id = generateAllocationId();
        const newAllocation = {
            id,
            category: allocation.category,
            credits: allocation.credits,
            quarters: allocation.quarters || getConstants().RELEASE_TIME.VALID_QUARTERS.slice(0, 3),
            description: allocation.description || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        releaseTimeData[academicYear][facultyName].allocations.push(newAllocation);

        // Save and notify
        saveToStorage();
        notifyListeners('add', { facultyName, academicYear, allocation: newAllocation });

        return { success: true, id, allocation: newAllocation };
    }

    /**
     * Update an existing allocation
     * @param {string} facultyName - Faculty name
     * @param {string} academicYear - Academic year
     * @param {string} allocationId - Allocation ID
     * @param {Object} updates - Fields to update
     * @returns {Object} Result with success status
     */
    function updateAllocation(facultyName, academicYear, allocationId, updates) {
        const allocations = getFacultyAllocations(facultyName, academicYear);
        const index = allocations.findIndex(a => a.id === allocationId);

        if (index === -1) {
            return { success: false, errors: ['Allocation not found'] };
        }

        // Validate updates
        const merged = { ...allocations[index], ...updates };
        const validation = validateAllocation(merged);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        // Apply updates
        const oldAllocation = { ...allocations[index] };
        Object.assign(allocations[index], updates, { updatedAt: new Date().toISOString() });

        // Save and notify
        saveToStorage();
        notifyListeners('update', {
            facultyName,
            academicYear,
            allocation: allocations[index],
            oldAllocation
        });

        return { success: true, allocation: allocations[index] };
    }

    /**
     * Remove an allocation
     * @param {string} facultyName - Faculty name
     * @param {string} academicYear - Academic year
     * @param {string} allocationId - Allocation ID
     * @returns {Object} Result with success status
     */
    function removeAllocation(facultyName, academicYear, allocationId) {
        if (!releaseTimeData[academicYear] || !releaseTimeData[academicYear][facultyName]) {
            return { success: false, errors: ['Faculty not found'] };
        }

        const allocations = releaseTimeData[academicYear][facultyName].allocations;
        const index = allocations.findIndex(a => a.id === allocationId);

        if (index === -1) {
            return { success: false, errors: ['Allocation not found'] };
        }

        const removed = allocations.splice(index, 1)[0];

        // Save and notify
        saveToStorage();
        notifyListeners('remove', { facultyName, academicYear, allocation: removed });

        return { success: true, allocation: removed };
    }

    /**
     * Get all faculty with release time for an academic year
     * @param {string} academicYear - Academic year
     * @returns {Array} List of faculty with their total release credits (annual)
     */
    function getAllFacultyWithReleaseTime(academicYear) {
        if (!releaseTimeData[academicYear]) {
            return [];
        }

        return Object.entries(releaseTimeData[academicYear]).map(([name, data]) => {
            const allocations = data.allocations || [];
            // Calculate annual total (credits × number of quarters)
            const totalCredits = allocations.reduce((sum, a) => {
                const numQuarters = (a.quarters || []).length || 1;
                return sum + ((a.credits || 0) * numQuarters);
            }, 0);
            return {
                name,
                totalCredits,
                allocations
            };
        }).filter(f => f.totalCredits > 0);
    }

    /**
     * Get department-wide release time summary
     * @param {string} academicYear - Academic year
     * @returns {Object} Summary statistics
     */
    function getDepartmentSummary(academicYear) {
        const faculty = getAllFacultyWithReleaseTime(academicYear);
        const categories = getCategories();

        const summary = {
            totalFaculty: faculty.length,
            totalCredits: 0,
            byCategory: {},
            byQuarter: { Fall: 0, Winter: 0, Spring: 0, Summer: 0 }
        };

        // Initialize category totals
        categories.forEach(cat => {
            summary.byCategory[cat.id] = { credits: 0, annualCredits: 0, faculty: 0 };
        });

        faculty.forEach(f => {
            f.allocations.forEach(alloc => {
                const numQuarters = (alloc.quarters || []).length || 1;
                // Annual credits = credits per quarter × number of quarters
                const annualCredits = alloc.credits * numQuarters;

                if (summary.byCategory[alloc.category]) {
                    // Per-entry credits (as entered)
                    summary.byCategory[alloc.category].credits += alloc.credits;
                    // Annual total (credits × quarters)
                    summary.byCategory[alloc.category].annualCredits += annualCredits;
                }

                // Add to total (annual basis)
                summary.totalCredits += annualCredits;

                // Count credits per quarter
                (alloc.quarters || []).forEach(q => {
                    if (summary.byQuarter[q] !== undefined) {
                        summary.byQuarter[q] += alloc.credits;
                    }
                });
            });
        });

        // Count faculty per category
        categories.forEach(cat => {
            summary.byCategory[cat.id].faculty = faculty.filter(f =>
                f.allocations.some(a => a.category === cat.id)
            ).length;
        });

        return summary;
    }

    /**
     * Validate an allocation object
     * @param {Object} allocation - Allocation to validate
     * @returns {Object} Validation result
     */
    function validateAllocation(allocation) {
        const errors = [];
        const warnings = [];
        const constants = getConstants();

        if (!allocation || typeof allocation !== 'object') {
            return { valid: false, errors: ['Invalid allocation object'] };
        }

        // Category validation
        const category = getCategoryById(allocation.category);
        if (!category) {
            errors.push('Invalid category: ' + allocation.category);
        }

        // Credits validation
        if (typeof allocation.credits !== 'number' || allocation.credits < 0) {
            errors.push('Credits must be a positive number');
        } else if (category && allocation.credits > category.maxCredits) {
            warnings.push('Credits exceed typical maximum for ' + category.label);
        }

        // Quarters validation
        if (allocation.quarters) {
            if (!Array.isArray(allocation.quarters)) {
                errors.push('Quarters must be an array');
            } else {
                allocation.quarters.forEach(q => {
                    if (!constants.RELEASE_TIME.VALID_QUARTERS.includes(q)) {
                        errors.push('Invalid quarter: ' + q);
                    }
                });
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Generate unique allocation ID
     * @returns {string} Unique ID
     */
    function generateAllocationId() {
        return 'alloc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Subscribe to changes
     * @param {Function} callback - Callback function (action, data)
     * @returns {Function} Unsubscribe function
     */
    function subscribe(callback) {
        listeners.add(callback);
        return function unsubscribe() {
            listeners.delete(callback);
        };
    }

    /**
     * Notify all listeners of a change
     * @param {string} action - Action type (add, update, remove)
     * @param {Object} data - Change data
     */
    function notifyListeners(action, data) {
        listeners.forEach(callback => {
            try {
                callback(action, data);
            } catch (e) {
                console.error('Release time listener error:', e);
            }
        });
    }

    /**
     * Save data to localStorage
     */
    function saveToStorage() {
        try {
            const key = getConstants().BACKUP.STORAGE_KEY_PREFIX + STORAGE_KEY;
            localStorage.setItem(key, JSON.stringify(releaseTimeData));
        } catch (e) {
            console.warn('Failed to save release time data:', e);
        }
    }

    /**
     * Load data from localStorage
     */
    function loadFromStorage() {
        try {
            const key = getConstants().BACKUP.STORAGE_KEY_PREFIX + STORAGE_KEY;
            const stored = localStorage.getItem(key);
            if (stored) {
                releaseTimeData = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to load release time data:', e);
            releaseTimeData = {};
        }
    }

    /**
     * Export all data
     * @returns {Object} All release time data
     */
    function exportData() {
        return JSON.parse(JSON.stringify(releaseTimeData));
    }

    /**
     * Import data (merges with existing)
     * @param {Object} data - Data to import
     * @param {boolean} replace - Replace existing data instead of merge
     */
    function importData(data, replace = false) {
        if (replace) {
            releaseTimeData = data;
        } else {
            // Merge data
            Object.entries(data).forEach(([year, yearData]) => {
                if (!releaseTimeData[year]) {
                    releaseTimeData[year] = {};
                }
                Object.entries(yearData).forEach(([faculty, facultyData]) => {
                    if (!releaseTimeData[year][faculty]) {
                        releaseTimeData[year][faculty] = { allocations: [] };
                    }
                    // Add allocations that don't already exist
                    (facultyData.allocations || []).forEach(alloc => {
                        if (!releaseTimeData[year][faculty].allocations.find(a => a.id === alloc.id)) {
                            releaseTimeData[year][faculty].allocations.push(alloc);
                        }
                    });
                });
            });
        }

        saveToStorage();
        notifyListeners('import', { data });
    }

    /**
     * Clear all data
     */
    function clearAll() {
        const oldData = exportData();
        releaseTimeData = {};
        saveToStorage();
        notifyListeners('clear', { oldData });
    }

    /**
     * Get available academic years with data
     * @returns {Array} List of academic years
     */
    function getAvailableYears() {
        return Object.keys(releaseTimeData).sort();
    }

    // Public API
    return {
        init,
        getCategories,
        getCategoryById,
        getFacultyAllocations,
        getFacultyTotalCredits,
        getFacultySummaryByCategory,
        addAllocation,
        updateAllocation,
        removeAllocation,
        getAllFacultyWithReleaseTime,
        getDepartmentSummary,
        validateAllocation,
        subscribe,
        exportData,
        importData,
        clearAll,
        getAvailableYears
    };
})();

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReleaseTimeManager;
}
