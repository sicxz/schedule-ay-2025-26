/**
 * EWU Design Schedule Manager
 * Manages course assignments and schedule editing
 * Following the ReleaseTimeManager pattern
 */

const ScheduleManager = (function() {
    'use strict';

    // Get constants if available
    const getConstants = () => {
        if (typeof CONSTANTS !== 'undefined') {
            return CONSTANTS;
        }
        return {
            WORKLOAD: {
                LIMITS: {
                    'Full Professor': 36,
                    'Associate Professor': 36,
                    'Assistant Professor': 36,
                    'Senior Lecturer': 45,
                    'Lecturer': 45,
                    'Adjunct': 15
                },
                MULTIPLIERS: {
                    'DESN 499': 0.2,
                    'DESN 495': 0.1,
                    'DESN 491': 0.15,
                    DEFAULT: 1.0
                }
            },
            BACKUP: {
                STORAGE_KEY_PREFIX: 'ewu_schedule_'
            }
        };
    };

    /**
     * Internal storage for schedule data
     * Structure: { academicYear: { quarters: { Fall: { courses: [...] } } } }
     */
    let scheduleData = {};

    /**
     * Course catalog cache
     */
    let courseCatalog = null;

    /**
     * Change listeners
     */
    const listeners = new Set();

    /**
     * Storage key for persistence
     */
    const STORAGE_KEY = 'schedule_edits';

    /**
     * Initialize the manager
     * @param {Object} options - Configuration options
     */
    async function init(options = {}) {
        // Load from localStorage if available
        loadFromStorage();

        // Load course catalog
        if (options.catalogPath) {
            await loadCourseCatalog(options.catalogPath);
        }

        // Import initial workload data if provided
        if (options.workloadData) {
            importFromWorkloadData(options.workloadData);
        }

        return this;
    }

    /**
     * Load course catalog from JSON file
     * @param {string} path - Path to course-catalog.json
     */
    async function loadCourseCatalog(path = '../data/course-catalog.json') {
        try {
            const response = await fetch(path);
            if (response.ok) {
                const data = await response.json();
                courseCatalog = data.courses || [];
                console.log(`✅ Loaded ${courseCatalog.length} courses from catalog`);
            }
        } catch (error) {
            console.warn('⚠️ Could not load course catalog:', error.message);
            courseCatalog = [];
        }
    }

    /**
     * Get all courses from catalog
     * @returns {Array} Course catalog
     */
    function getCourseCatalog() {
        return courseCatalog || [];
    }

    /**
     * Get course info from catalog
     * @param {string} courseCode - Course code (e.g., "DESN 100")
     * @returns {Object|null} Course info or null
     */
    function getCourseInfo(courseCode) {
        if (!courseCatalog) return null;
        return courseCatalog.find(c => c.code === courseCode) || null;
    }

    /**
     * Import schedule from existing workload data
     * @param {Object} workloadData - Workload data from workload-data.json
     */
    function importFromWorkloadData(workloadData) {
        if (!workloadData || !workloadData.workloadByYear) return;

        Object.entries(workloadData.workloadByYear.byYear || {}).forEach(([year, yearData]) => {
            if (!scheduleData[year]) {
                scheduleData[year] = {
                    quarters: {
                        Fall: { courses: [] },
                        Winter: { courses: [] },
                        Spring: { courses: [] },
                        Summer: { courses: [] }
                    }
                };
            }

            // Process full-time faculty
            processYearFaculty(yearData.fullTime || {}, year);
            // Process adjunct faculty
            processYearFaculty(yearData.adjunct || {}, year);
        });

        console.log(`✅ Imported schedule data for ${Object.keys(scheduleData).length} years`);
    }

    /**
     * Process faculty data for a year
     */
    function processYearFaculty(facultyData, year) {
        Object.entries(facultyData).forEach(([facultyName, data]) => {
            (data.courses || []).forEach(course => {
                const quarter = course.quarter || 'Fall';
                const id = generateAssignmentId(year, quarter, course.courseCode, course.section);

                const assignment = {
                    id,
                    courseCode: course.courseCode,
                    section: course.section || '001',
                    credits: course.credits || 5,
                    enrollmentCap: course.enrolled || 20,
                    assignedFaculty: facultyName,
                    workloadCredits: course.workloadCredits || course.credits,
                    multiplier: course.multiplier || 1.0,
                    type: course.type || 'scheduled'
                };

                // Add to quarter if not already exists
                const existingIndex = scheduleData[year].quarters[quarter].courses
                    .findIndex(c => c.id === id);

                if (existingIndex === -1) {
                    scheduleData[year].quarters[quarter].courses.push(assignment);
                }
            });
        });
    }

    /**
     * Generate unique assignment ID
     */
    function generateAssignmentId(year, quarter, courseCode, section) {
        const code = courseCode.replace(/\s+/g, '').toLowerCase();
        return `${year}-${quarter.toLowerCase()}-${code}-${section || '001'}`;
    }

    /**
     * Get schedule for a specific quarter
     * @param {string} academicYear - Academic year (e.g., "2025-26")
     * @param {string} quarter - Quarter name
     * @returns {Array} Courses for that quarter
     */
    function getQuarterSchedule(academicYear, quarter) {
        if (!scheduleData[academicYear] || !scheduleData[academicYear].quarters[quarter]) {
            return [];
        }
        return scheduleData[academicYear].quarters[quarter].courses || [];
    }

    /**
     * Get all courses assigned to a faculty member
     * @param {string} facultyName - Faculty name
     * @param {string} academicYear - Academic year
     * @param {string} quarter - Optional specific quarter
     * @returns {Array} Assigned courses
     */
    function getFacultySchedule(facultyName, academicYear, quarter = null) {
        const courses = [];

        if (!scheduleData[academicYear]) return courses;

        const quarters = quarter
            ? [quarter]
            : Object.keys(scheduleData[academicYear].quarters);

        quarters.forEach(q => {
            const quarterCourses = scheduleData[academicYear].quarters[q]?.courses || [];
            quarterCourses.forEach(course => {
                if (course.assignedFaculty === facultyName) {
                    courses.push({ ...course, quarter: q });
                }
            });
        });

        return courses;
    }

    /**
     * Get unassigned courses for a quarter
     * @param {string} academicYear - Academic year
     * @param {string} quarter - Quarter name
     * @returns {Array} Unassigned courses
     */
    function getUnassignedCourses(academicYear, quarter) {
        const quarterCourses = getQuarterSchedule(academicYear, quarter);
        return quarterCourses.filter(c => !c.assignedFaculty || c.assignedFaculty === '');
    }

    /**
     * Add a course assignment
     * @param {string} academicYear - Academic year
     * @param {string} quarter - Quarter name
     * @param {Object} courseData - Course assignment data
     * @returns {Object} Result with success status
     */
    function addCourseAssignment(academicYear, quarter, courseData) {
        const validation = validateCourseAssignment(courseData);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        // Ensure data structure exists
        ensureYearStructure(academicYear);

        // Generate ID if not provided
        const id = courseData.id || generateAssignmentId(
            academicYear,
            quarter,
            courseData.courseCode,
            courseData.section
        );

        // Check for duplicate
        const existing = scheduleData[academicYear].quarters[quarter].courses
            .find(c => c.id === id);
        if (existing) {
            return { success: false, errors: ['Course assignment already exists'] };
        }

        // Get workload multiplier from catalog or constants
        const courseInfo = getCourseInfo(courseData.courseCode);
        const constants = getConstants();
        const multiplier = courseInfo?.workloadMultiplier
            || constants.WORKLOAD.MULTIPLIERS[courseData.courseCode]
            || constants.WORKLOAD.MULTIPLIERS.DEFAULT;

        const newAssignment = {
            id,
            courseCode: courseData.courseCode,
            section: courseData.section || '001',
            credits: courseData.credits || courseInfo?.defaultCredits || 5,
            enrollmentCap: courseData.enrollmentCap || courseInfo?.typicalEnrollmentCap || 20,
            assignedFaculty: courseData.assignedFaculty || '',
            room: courseData.room || '',
            days: courseData.days || [],
            startTime: courseData.startTime || '',
            endTime: courseData.endTime || '',
            multiplier,
            workloadCredits: (courseData.credits || 5) * multiplier,
            type: multiplier < 1.0 ? 'applied-learning' : 'scheduled',
            notes: courseData.notes || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        scheduleData[academicYear].quarters[quarter].courses.push(newAssignment);

        // Save and notify
        saveToStorage();
        notifyListeners('add', { academicYear, quarter, assignment: newAssignment });

        return { success: true, id, assignment: newAssignment };
    }

    /**
     * Update a course assignment
     * @param {string} academicYear - Academic year
     * @param {string} quarter - Quarter name
     * @param {string} assignmentId - Assignment ID
     * @param {Object} updates - Fields to update
     * @returns {Object} Result with success status
     */
    function updateCourseAssignment(academicYear, quarter, assignmentId, updates) {
        if (!scheduleData[academicYear]?.quarters[quarter]) {
            return { success: false, errors: ['Quarter not found'] };
        }

        const courses = scheduleData[academicYear].quarters[quarter].courses;
        const index = courses.findIndex(c => c.id === assignmentId);

        if (index === -1) {
            return { success: false, errors: ['Assignment not found'] };
        }

        const oldAssignment = { ...courses[index] };

        // Apply updates
        Object.assign(courses[index], updates, {
            updatedAt: new Date().toISOString()
        });

        // Recalculate workload credits if credits changed
        if (updates.credits) {
            courses[index].workloadCredits = updates.credits * courses[index].multiplier;
        }

        // Save and notify
        saveToStorage();
        notifyListeners('update', {
            academicYear,
            quarter,
            assignment: courses[index],
            oldAssignment
        });

        return { success: true, assignment: courses[index] };
    }

    /**
     * Remove a course assignment
     * @param {string} academicYear - Academic year
     * @param {string} quarter - Quarter name
     * @param {string} assignmentId - Assignment ID
     * @returns {Object} Result with success status
     */
    function removeCourseAssignment(academicYear, quarter, assignmentId) {
        if (!scheduleData[academicYear]?.quarters[quarter]) {
            return { success: false, errors: ['Quarter not found'] };
        }

        const courses = scheduleData[academicYear].quarters[quarter].courses;
        const index = courses.findIndex(c => c.id === assignmentId);

        if (index === -1) {
            return { success: false, errors: ['Assignment not found'] };
        }

        const removed = courses.splice(index, 1)[0];

        // Save and notify
        saveToStorage();
        notifyListeners('remove', { academicYear, quarter, assignment: removed });

        return { success: true, assignment: removed };
    }

    /**
     * Assign a course to a faculty member
     * @param {string} academicYear - Academic year
     * @param {string} quarter - Quarter name
     * @param {string} assignmentId - Assignment ID
     * @param {string} facultyName - Faculty name to assign
     * @returns {Object} Result with success status
     */
    function assignToFaculty(academicYear, quarter, assignmentId, facultyName) {
        return updateCourseAssignment(academicYear, quarter, assignmentId, {
            assignedFaculty: facultyName
        });
    }

    /**
     * Unassign a course from faculty
     * @param {string} academicYear - Academic year
     * @param {string} quarter - Quarter name
     * @param {string} assignmentId - Assignment ID
     * @returns {Object} Result with success status
     */
    function unassignFromFaculty(academicYear, quarter, assignmentId) {
        return updateCourseAssignment(academicYear, quarter, assignmentId, {
            assignedFaculty: ''
        });
    }

    /**
     * Calculate total workload for a faculty member
     * @param {string} facultyName - Faculty name
     * @param {string} academicYear - Academic year
     * @returns {Object} Workload summary
     */
    function calculateFacultyWorkload(facultyName, academicYear) {
        const courses = getFacultySchedule(facultyName, academicYear);

        let totalCredits = 0;
        let totalWorkloadCredits = 0;
        let scheduledCredits = 0;
        let appliedLearningCredits = 0;

        const byQuarter = {
            Fall: { credits: 0, workload: 0 },
            Winter: { credits: 0, workload: 0 },
            Spring: { credits: 0, workload: 0 },
            Summer: { credits: 0, workload: 0 }
        };

        courses.forEach(course => {
            totalCredits += course.credits;
            totalWorkloadCredits += course.workloadCredits;

            if (course.type === 'applied-learning') {
                appliedLearningCredits += course.credits;
            } else {
                scheduledCredits += course.credits;
            }

            if (byQuarter[course.quarter]) {
                byQuarter[course.quarter].credits += course.credits;
                byQuarter[course.quarter].workload += course.workloadCredits;
            }
        });

        return {
            facultyName,
            academicYear,
            totalCredits,
            totalWorkloadCredits,
            scheduledCredits,
            appliedLearningCredits,
            courseCount: courses.length,
            byQuarter,
            courses
        };
    }

    /**
     * Validate a course assignment
     * @param {Object} courseData - Course data to validate
     * @returns {Object} Validation result
     */
    function validateCourseAssignment(courseData) {
        const errors = [];
        const warnings = [];

        if (!courseData || typeof courseData !== 'object') {
            return { valid: false, errors: ['Invalid course data'] };
        }

        if (!courseData.courseCode) {
            errors.push('Course code is required');
        }

        if (courseData.credits && (courseData.credits < 1 || courseData.credits > 15)) {
            errors.push('Credits must be between 1 and 15');
        }

        if (courseData.enrollmentCap && courseData.enrollmentCap < 1) {
            errors.push('Enrollment cap must be at least 1');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate faculty workload
     * @param {string} facultyName - Faculty name
     * @param {string} academicYear - Academic year
     * @param {string} facultyRank - Faculty rank
     * @returns {Object} Validation result
     */
    function validateFacultyWorkload(facultyName, academicYear, facultyRank = 'Lecturer') {
        const workload = calculateFacultyWorkload(facultyName, academicYear);
        const constants = getConstants();
        const maxWorkload = constants.WORKLOAD.LIMITS[facultyRank] || 45;

        const utilizationRate = (workload.totalWorkloadCredits / maxWorkload) * 100;

        let status = 'optimal';
        const warnings = [];

        if (utilizationRate > 100) {
            status = 'overloaded';
            warnings.push(`Faculty is over capacity by ${(workload.totalWorkloadCredits - maxWorkload).toFixed(1)} credits`);
        } else if (utilizationRate < 60) {
            status = 'underutilized';
        }

        return {
            valid: utilizationRate <= 100,
            status,
            utilizationRate: Math.round(utilizationRate * 10) / 10,
            currentWorkload: workload.totalWorkloadCredits,
            maxWorkload,
            availableCapacity: Math.max(0, maxWorkload - workload.totalWorkloadCredits),
            warnings
        };
    }

    /**
     * Ensure year data structure exists
     */
    function ensureYearStructure(academicYear) {
        if (!scheduleData[academicYear]) {
            scheduleData[academicYear] = {
                quarters: {
                    Fall: { courses: [] },
                    Winter: { courses: [] },
                    Spring: { courses: [] },
                    Summer: { courses: [] }
                }
            };
        }
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
     */
    function notifyListeners(action, data) {
        listeners.forEach(callback => {
            try {
                callback(action, data);
            } catch (e) {
                console.error('Schedule listener error:', e);
            }
        });
    }

    /**
     * Save data to localStorage
     */
    function saveToStorage() {
        try {
            const key = getConstants().BACKUP.STORAGE_KEY_PREFIX + STORAGE_KEY;
            localStorage.setItem(key, JSON.stringify(scheduleData));
        } catch (e) {
            console.warn('Failed to save schedule data:', e);
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
                scheduleData = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to load schedule data:', e);
            scheduleData = {};
        }
    }

    /**
     * Export all schedule data
     * @returns {Object} All schedule data
     */
    function exportData() {
        return JSON.parse(JSON.stringify(scheduleData));
    }

    /**
     * Import schedule data
     * @param {Object} data - Data to import
     * @param {boolean} replace - Replace existing data instead of merge
     */
    function importData(data, replace = false) {
        if (replace) {
            scheduleData = data;
        } else {
            // Merge data
            Object.entries(data).forEach(([year, yearData]) => {
                ensureYearStructure(year);
                Object.entries(yearData.quarters || {}).forEach(([quarter, quarterData]) => {
                    (quarterData.courses || []).forEach(course => {
                        const existing = scheduleData[year].quarters[quarter].courses
                            .find(c => c.id === course.id);
                        if (!existing) {
                            scheduleData[year].quarters[quarter].courses.push(course);
                        }
                    });
                });
            });
        }

        saveToStorage();
        notifyListeners('import', { data });
    }

    /**
     * Clear all schedule data
     */
    function clearAll() {
        const oldData = exportData();
        scheduleData = {};
        saveToStorage();
        notifyListeners('clear', { oldData });
    }

    /**
     * Get available academic years
     * @returns {Array} List of academic years
     */
    function getAvailableYears() {
        return Object.keys(scheduleData).sort();
    }

    /**
     * Get all faculty with assignments for a year
     * @param {string} academicYear - Academic year
     * @returns {Array} Faculty names with assignments
     */
    function getFacultyWithAssignments(academicYear) {
        const facultySet = new Set();

        if (!scheduleData[academicYear]) return [];

        Object.values(scheduleData[academicYear].quarters).forEach(quarter => {
            (quarter.courses || []).forEach(course => {
                if (course.assignedFaculty) {
                    facultySet.add(course.assignedFaculty);
                }
            });
        });

        return Array.from(facultySet).sort();
    }

    /**
     * Validate academic year format (e.g., "2026-27")
     * @param {string} year - Year string to validate
     * @returns {Object} Validation result
     */
    function validateYearFormat(year) {
        const errors = [];

        // Check format YYYY-YY
        const yearRegex = /^\d{4}-\d{2}$/;
        if (!yearRegex.test(year)) {
            errors.push('Format must be YYYY-YY (e.g., 2026-27)');
            return { valid: false, errors };
        }

        // Check that second part is correct (e.g., 2026-27 not 2026-28)
        const [startYear, endPart] = year.split('-');
        const expectedEnd = (parseInt(startYear) + 1).toString().slice(-2);

        if (endPart !== expectedEnd) {
            errors.push(`Year range invalid: ${startYear} should be followed by ${expectedEnd}`);
            return { valid: false, errors };
        }

        return { valid: true, errors: [] };
    }

    /**
     * Create a blank academic year
     * @param {string} academicYear - Academic year (e.g., "2026-27")
     * @returns {Object} Result with success status
     */
    function createBlankYear(academicYear) {
        // Validate format
        const validation = validateYearFormat(academicYear);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        // Check if year already exists
        if (scheduleData[academicYear]) {
            return { success: false, errors: [`Year ${academicYear} already exists`] };
        }

        // Create empty structure
        ensureYearStructure(academicYear);

        // Save and notify
        saveToStorage();
        notifyListeners('yearCreated', { academicYear, fromTemplate: null });

        return { success: true, academicYear };
    }

    /**
     * Create a new academic year by copying from a template year
     * @param {string} newYear - New academic year (e.g., "2026-27")
     * @param {string} templateYear - Year to copy from (e.g., "2025-26")
     * @returns {Object} Result with success status
     */
    function createYearFromTemplate(newYear, templateYear) {
        // Validate new year format
        const validation = validateYearFormat(newYear);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        // Check if new year already exists
        if (scheduleData[newYear]) {
            return { success: false, errors: [`Year ${newYear} already exists`] };
        }

        // Check if template year exists
        if (!scheduleData[templateYear]) {
            return { success: false, errors: [`Template year ${templateYear} not found`] };
        }

        // Deep clone the template year's schedule
        const templateData = JSON.parse(JSON.stringify(scheduleData[templateYear]));

        // Update course IDs to reflect new year
        Object.keys(templateData.quarters).forEach(quarter => {
            templateData.quarters[quarter].courses = templateData.quarters[quarter].courses.map(course => {
                // Generate new ID with new year
                const newId = generateAssignmentId(newYear, quarter, course.courseCode, course.section);
                return {
                    ...course,
                    id: newId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            });
        });

        // Add to schedule data
        scheduleData[newYear] = templateData;

        // Save and notify
        saveToStorage();
        notifyListeners('yearCreated', { academicYear: newYear, fromTemplate: templateYear });

        return { success: true, academicYear: newYear, copiedFrom: templateYear };
    }

    /**
     * Check if an academic year exists
     * @param {string} academicYear - Academic year to check
     * @returns {boolean} Whether year exists
     */
    function yearExists(academicYear) {
        return !!scheduleData[academicYear];
    }

    // Public API
    return {
        init,
        loadCourseCatalog,
        getCourseCatalog,
        getCourseInfo,
        importFromWorkloadData,
        getQuarterSchedule,
        getFacultySchedule,
        getUnassignedCourses,
        addCourseAssignment,
        updateCourseAssignment,
        removeCourseAssignment,
        assignToFaculty,
        unassignFromFaculty,
        calculateFacultyWorkload,
        validateCourseAssignment,
        validateFacultyWorkload,
        subscribe,
        exportData,
        importData,
        clearAll,
        getAvailableYears,
        getFacultyWithAssignments,
        // Year management
        validateYearFormat,
        createBlankYear,
        createYearFromTemplate,
        yearExists
    };
})();

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScheduleManager;
}
