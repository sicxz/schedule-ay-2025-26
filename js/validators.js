/**
 * EWU Design Schedule Analyzer - Validators
 * Input validation and data structure checking
 */

const Validators = (function() {
    'use strict';

    // Get constants if available
    const getConstants = () => {
        if (typeof CONSTANTS !== 'undefined') {
            return CONSTANTS;
        }
        // Fallback defaults
        return {
            VALIDATION: {
                COURSE_CODE_PATTERN: /^DESN\s\d{3}$/,
                ACADEMIC_YEAR_PATTERN: /^\d{4}-\d{2}$/,
                MAX_CREDITS_PER_COURSE: 15,
                MAX_ENROLLMENT_PER_SECTION: 100
            },
            RELEASE_TIME: {
                VALID_QUARTERS: ['Fall', 'Winter', 'Spring', 'Summer']
            }
        };
    };

    /**
     * Validation result object
     * @param {boolean} valid - Whether validation passed
     * @param {Array<string>} errors - Error messages
     * @param {Array<string>} warnings - Warning messages
     */
    function ValidationResult(valid, errors = [], warnings = []) {
        return { valid, errors, warnings };
    }

    /**
     * Validate workload data structure
     * @param {Object} data - Workload data to validate
     * @returns {ValidationResult}
     */
    function validateWorkloadData(data) {
        const errors = [];
        const warnings = [];

        if (!data || typeof data !== 'object') {
            return ValidationResult(false, ['Data must be an object']);
        }

        // Required fields
        if (!data.generatedAt) {
            errors.push('Missing required field: generatedAt');
        }

        if (!data.facultyWorkload || typeof data.facultyWorkload !== 'object') {
            errors.push('Missing or invalid field: facultyWorkload');
        }

        // Validate facultyWorkload entries
        if (data.facultyWorkload) {
            Object.entries(data.facultyWorkload).forEach(([name, faculty]) => {
                const facultyErrors = validateFacultyEntry(faculty, name);
                errors.push(...facultyErrors.errors);
                warnings.push(...facultyErrors.warnings);
            });
        }

        // Validate workloadByYear if present
        if (data.workloadByYear) {
            if (!Array.isArray(data.workloadByYear.years)) {
                warnings.push('workloadByYear.years should be an array');
            }
            if (!data.workloadByYear.byYear || typeof data.workloadByYear.byYear !== 'object') {
                warnings.push('workloadByYear.byYear should be an object');
            }
        }

        return ValidationResult(errors.length === 0, errors, warnings);
    }

    /**
     * Validate a single faculty entry
     * @param {Object} faculty - Faculty data
     * @param {string} name - Faculty name for error messages
     * @returns {ValidationResult}
     */
    function validateFacultyEntry(faculty, name = 'Unknown') {
        const errors = [];
        const warnings = [];
        const prefix = `Faculty "${name}": `;

        if (!faculty || typeof faculty !== 'object') {
            return ValidationResult(false, [prefix + 'Invalid faculty data']);
        }

        // Check numeric fields
        if (faculty.totalCredits !== undefined && typeof faculty.totalCredits !== 'number') {
            errors.push(prefix + 'totalCredits must be a number');
        }

        if (faculty.totalWorkloadCredits !== undefined && typeof faculty.totalWorkloadCredits !== 'number') {
            errors.push(prefix + 'totalWorkloadCredits must be a number');
        }

        if (faculty.maxWorkload !== undefined) {
            if (typeof faculty.maxWorkload !== 'number') {
                errors.push(prefix + 'maxWorkload must be a number');
            } else if (faculty.maxWorkload < 0 || faculty.maxWorkload > 100) {
                warnings.push(prefix + 'maxWorkload seems unusual: ' + faculty.maxWorkload);
            }
        }

        // Validate courses array if present
        if (faculty.courses) {
            if (!Array.isArray(faculty.courses)) {
                errors.push(prefix + 'courses must be an array');
            } else {
                faculty.courses.forEach((course, index) => {
                    const courseErrors = validateCourse(course);
                    courseErrors.errors.forEach(err => {
                        errors.push(prefix + `course[${index}]: ${err}`);
                    });
                });
            }
        }

        return ValidationResult(errors.length === 0, errors, warnings);
    }

    /**
     * Validate a course entry
     * @param {Object} course - Course data
     * @returns {ValidationResult}
     */
    function validateCourse(course) {
        const errors = [];
        const warnings = [];
        const constants = getConstants();

        if (!course || typeof course !== 'object') {
            return ValidationResult(false, ['Invalid course data']);
        }

        // Course code validation
        if (!course.courseCode) {
            errors.push('Missing courseCode');
        } else if (!constants.VALIDATION.COURSE_CODE_PATTERN.test(course.courseCode)) {
            warnings.push(`Course code "${course.courseCode}" does not match expected pattern`);
        }

        // Credits validation
        if (course.credits !== undefined) {
            if (typeof course.credits !== 'number') {
                errors.push('credits must be a number');
            } else if (course.credits < 0 || course.credits > constants.VALIDATION.MAX_CREDITS_PER_COURSE) {
                warnings.push(`Unusual credit value: ${course.credits}`);
            }
        }

        // Quarter validation
        if (course.quarter && !constants.RELEASE_TIME.VALID_QUARTERS.includes(course.quarter)) {
            warnings.push(`Unknown quarter: ${course.quarter}`);
        }

        return ValidationResult(errors.length === 0, errors, warnings);
    }

    /**
     * Validate enrollment data structure
     * @param {Object} data - Enrollment data to validate
     * @returns {ValidationResult}
     */
    function validateEnrollmentData(data) {
        const errors = [];
        const warnings = [];

        if (!data || typeof data !== 'object') {
            return ValidationResult(false, ['Data must be an object']);
        }

        // Required fields
        if (!data.generatedAt) {
            errors.push('Missing required field: generatedAt');
        }

        if (!data.courseStats || typeof data.courseStats !== 'object') {
            errors.push('Missing or invalid field: courseStats');
        }

        // Validate courseStats entries
        if (data.courseStats) {
            Object.entries(data.courseStats).forEach(([code, stats]) => {
                if (typeof stats.average !== 'number') {
                    warnings.push(`Course ${code}: average should be a number`);
                }
                if (typeof stats.peak !== 'number') {
                    warnings.push(`Course ${code}: peak should be a number`);
                }
            });
        }

        // Validate capacityPlanning if present
        if (data.capacityPlanning) {
            Object.entries(data.capacityPlanning).forEach(([year, yearData]) => {
                const yearResult = validateAcademicYear(year);
                if (!yearResult.valid) {
                    warnings.push(`Invalid academic year format: ${year}`);
                }

                if (!Array.isArray(yearData.fullTimeFaculty)) {
                    warnings.push(`capacityPlanning.${year}.fullTimeFaculty should be an array`);
                }
            });
        }

        return ValidationResult(errors.length === 0, errors, warnings);
    }

    /**
     * Validate academic year format
     * @param {string} year - Academic year (e.g., "2024-25")
     * @returns {ValidationResult}
     */
    function validateAcademicYear(year) {
        const constants = getConstants();

        if (!year || typeof year !== 'string') {
            return ValidationResult(false, ['Academic year must be a string']);
        }

        if (!constants.VALIDATION.ACADEMIC_YEAR_PATTERN.test(year)) {
            return ValidationResult(false, [`Invalid academic year format: ${year}. Expected format: YYYY-YY`]);
        }

        // Validate year continuity (e.g., 2024-25, not 2024-27)
        const parts = year.split('-');
        const startYear = parseInt(parts[0]);
        const endYearShort = parseInt(parts[1]);
        const expectedEnd = (startYear + 1) % 100;

        if (endYearShort !== expectedEnd) {
            return ValidationResult(false, [`Academic year mismatch: ${year}. Year should be consecutive.`]);
        }

        return ValidationResult(true);
    }

    /**
     * Validate release time entry
     * @param {Object} releaseTime - Release time data
     * @returns {ValidationResult}
     */
    function validateReleaseTime(releaseTime) {
        const errors = [];
        const warnings = [];
        const constants = getConstants();

        if (!releaseTime || typeof releaseTime !== 'object') {
            return ValidationResult(false, ['Release time data must be an object']);
        }

        // Validate totalCredits
        if (releaseTime.totalCredits !== undefined) {
            if (typeof releaseTime.totalCredits !== 'number') {
                errors.push('totalCredits must be a number');
            } else if (releaseTime.totalCredits < 0) {
                errors.push('totalCredits cannot be negative');
            } else if (releaseTime.totalCredits > 45) {
                warnings.push('totalCredits exceeds typical maximum (45)');
            }
        }

        // Validate categories
        if (releaseTime.categories) {
            if (!Array.isArray(releaseTime.categories)) {
                errors.push('categories must be an array');
            } else {
                releaseTime.categories.forEach((cat, index) => {
                    if (!cat.type) {
                        errors.push(`categories[${index}]: missing type`);
                    }
                    if (typeof cat.credits !== 'number' || cat.credits < 0) {
                        errors.push(`categories[${index}]: credits must be a non-negative number`);
                    }
                    if (cat.quarters) {
                        if (!Array.isArray(cat.quarters)) {
                            errors.push(`categories[${index}]: quarters must be an array`);
                        } else {
                            cat.quarters.forEach(q => {
                                if (!constants.RELEASE_TIME.VALID_QUARTERS.includes(q)) {
                                    warnings.push(`categories[${index}]: unknown quarter "${q}"`);
                                }
                            });
                        }
                    }
                });
            }
        }

        return ValidationResult(errors.length === 0, errors, warnings);
    }

    /**
     * Validate a number is within range
     * @param {number} value - Value to check
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @param {string} fieldName - Field name for error message
     * @returns {ValidationResult}
     */
    function validateNumberInRange(value, min, max, fieldName = 'Value') {
        if (typeof value !== 'number' || isNaN(value)) {
            return ValidationResult(false, [`${fieldName} must be a valid number`]);
        }

        if (value < min || value > max) {
            return ValidationResult(false, [`${fieldName} must be between ${min} and ${max}`]);
        }

        return ValidationResult(true);
    }

    /**
     * Validate required fields exist in object
     * @param {Object} obj - Object to check
     * @param {Array<string>} fields - Required field names
     * @returns {ValidationResult}
     */
    function validateRequiredFields(obj, fields) {
        const errors = [];

        if (!obj || typeof obj !== 'object') {
            return ValidationResult(false, ['Object is required']);
        }

        fields.forEach(field => {
            if (obj[field] === undefined || obj[field] === null) {
                errors.push(`Missing required field: ${field}`);
            }
        });

        return ValidationResult(errors.length === 0, errors);
    }

    /**
     * Validate string is not empty
     * @param {string} value - String to check
     * @param {string} fieldName - Field name for error message
     * @returns {ValidationResult}
     */
    function validateNonEmptyString(value, fieldName = 'Value') {
        if (typeof value !== 'string') {
            return ValidationResult(false, [`${fieldName} must be a string`]);
        }

        if (value.trim().length === 0) {
            return ValidationResult(false, [`${fieldName} cannot be empty`]);
        }

        return ValidationResult(true);
    }

    /**
     * Validate array is not empty
     * @param {Array} arr - Array to check
     * @param {string} fieldName - Field name for error message
     * @returns {ValidationResult}
     */
    function validateNonEmptyArray(arr, fieldName = 'Array') {
        if (!Array.isArray(arr)) {
            return ValidationResult(false, [`${fieldName} must be an array`]);
        }

        if (arr.length === 0) {
            return ValidationResult(false, [`${fieldName} cannot be empty`]);
        }

        return ValidationResult(true);
    }

    /**
     * Sanitize string input (remove potentially dangerous characters)
     * @param {string} input - Input string
     * @returns {string} Sanitized string
     */
    function sanitizeString(input) {
        if (typeof input !== 'string') {
            return '';
        }

        return input
            .replace(/[<>]/g, '') // Remove angle brackets
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
            .trim();
    }

    /**
     * Sanitize object values recursively
     * @param {Object} obj - Object to sanitize
     * @returns {Object} Sanitized object
     */
    function sanitizeObject(obj) {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => {
                if (typeof item === 'string') {
                    return sanitizeString(item);
                }
                return sanitizeObject(item);
            });
        }

        const sanitized = {};
        Object.entries(obj).forEach(([key, value]) => {
            const sanitizedKey = sanitizeString(key);
            if (typeof value === 'string') {
                sanitized[sanitizedKey] = sanitizeString(value);
            } else if (typeof value === 'object') {
                sanitized[sanitizedKey] = sanitizeObject(value);
            } else {
                sanitized[sanitizedKey] = value;
            }
        });

        return sanitized;
    }

    // Public API
    return {
        validateWorkloadData,
        validateEnrollmentData,
        validateFacultyEntry,
        validateCourse,
        validateAcademicYear,
        validateReleaseTime,
        validateNumberInRange,
        validateRequiredFields,
        validateNonEmptyString,
        validateNonEmptyArray,
        sanitizeString,
        sanitizeObject,
        ValidationResult
    };
})();

// Export for both browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Validators;
}
