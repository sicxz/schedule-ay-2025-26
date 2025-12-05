/**
 * EWU Design Schedule Analyzer - Faculty Utilities
 * Helper functions for working with faculty data
 */

/**
 * Get release time data for a faculty member
 * Uses ReleaseTimeManager if available
 * @param {string} facultyName - Faculty name
 * @param {string} academicYear - Academic year (e.g., '2025-26')
 * @returns {Object} Release time info with totalCredits and allocations
 */
function getFacultyReleaseTime(facultyName, academicYear) {
    // Check if ReleaseTimeManager is available
    if (typeof ReleaseTimeManager !== 'undefined') {
        const allocations = ReleaseTimeManager.getFacultyAllocations(facultyName, academicYear);
        const totalCredits = ReleaseTimeManager.getFacultyTotalCredits(facultyName, academicYear);
        return {
            totalCredits: totalCredits,
            allocations: allocations
        };
    }
    return { totalCredits: 0, allocations: [] };
}

/**
 * Apply release time adjustments to faculty data
 * This modifies the available capacity based on release time
 * @param {Object} facultyData - Original faculty workload data
 * @param {string} academicYear - Academic year for release time lookup
 * @returns {Object} Adjusted faculty data with release time applied
 */
function applyReleaseTimeToFacultyData(facultyData, academicYear) {
    if (!facultyData || typeof ReleaseTimeManager === 'undefined') {
        return facultyData;
    }

    const adjusted = {};

    Object.entries(facultyData).forEach(([name, data]) => {
        const releaseTime = getFacultyReleaseTime(name, academicYear);

        // Copy original data
        const adjustedData = { ...data };

        // Apply release time reduction to capacity
        if (releaseTime.totalCredits > 0) {
            adjustedData.releaseTimeCredits = releaseTime.totalCredits;
            adjustedData.releaseTimeAllocations = releaseTime.allocations;

            // Reduce effective capacity by release time
            adjustedData.effectiveMaxWorkload = Math.max(0, (data.maxWorkload || 0) - releaseTime.totalCredits);

            // Recalculate utilization based on effective capacity
            if (adjustedData.effectiveMaxWorkload > 0) {
                adjustedData.effectiveUtilizationRate = Math.round(
                    ((adjustedData.totalWorkloadCredits || 0) / adjustedData.effectiveMaxWorkload) * 100 * 10
                ) / 10;
            } else {
                adjustedData.effectiveUtilizationRate = adjustedData.totalWorkloadCredits > 0 ? 999 : 0;
            }

            // Update status based on effective utilization
            adjustedData.effectiveStatus = getUtilizationStatus(adjustedData.effectiveUtilizationRate);
        }

        adjusted[name] = adjustedData;
    });

    return adjusted;
}

/**
 * Calculate department-wide release time impact
 * @param {string} academicYear - Academic year
 * @returns {Object} Department release time summary
 */
function calculateDepartmentReleaseTimeSummary(academicYear) {
    if (typeof ReleaseTimeManager === 'undefined') {
        return {
            totalCredits: 0,
            facultyCount: 0,
            byCategory: {},
            byQuarter: {}
        };
    }

    return ReleaseTimeManager.getDepartmentSummary(academicYear);
}

/**
 * Get faculty by category (fullTime, adjunct, former)
 * @param {Object} yearData - Year-specific data from workload JSON
 * @param {string} category - Category: 'fullTime', 'adjunct', 'former', or 'all'
 * @returns {Object} Faculty data for the specified category
 */
function getFacultyByCategory(yearData, category = 'all') {
    if (!yearData) {
        return {};
    }

    switch(category) {
        case 'fullTime':
            return yearData.fullTime || {};
        case 'adjunct':
            return yearData.adjunct || {};
        case 'former':
            return yearData.former || {};
        case 'all':
        default:
            return yearData.all || {};
    }
}

/**
 * Calculate utilization statistics from faculty data
 * @param {Object} facultyData - Faculty workload data
 * @returns {Object} Statistics object
 */
function calculateUtilizationStats(facultyData) {
    const stats = {
        total: 0,
        overloaded: 0,
        optimal: 0,
        underutilized: 0,
        totalWorkload: 0,
        totalCapacity: 0,
        averageUtilization: 0
    };

    if (!facultyData || Object.keys(facultyData).length === 0) {
        return stats;
    }

    const faculty = Object.values(facultyData);
    stats.total = faculty.length;

    faculty.forEach(f => {
        // Count by status
        if (f.status === 'overloaded') stats.overloaded++;
        else if (f.status === 'optimal') stats.optimal++;
        else if (f.status === 'underutilized') stats.underutilized++;

        // Sum workload and capacity
        stats.totalWorkload += f.totalWorkloadCredits || 0;
        stats.totalCapacity += f.maxWorkload || 0;
    });

    // Calculate average utilization
    if (stats.totalCapacity > 0) {
        stats.averageUtilization = Math.round((stats.totalWorkload / stats.totalCapacity) * 100 * 10) / 10;
    }

    return stats;
}

/**
 * Get top N faculty by workload
 * @param {Object} facultyData - Faculty workload data
 * @param {number} limit - Number of faculty to return
 * @returns {Array} Array of [name, data] pairs sorted by workload
 */
function getTopFacultyByWorkload(facultyData, limit = 10) {
    if (!facultyData) {
        return [];
    }

    return Object.entries(facultyData)
        .sort((a, b) => b[1].totalWorkloadCredits - a[1].totalWorkloadCredits)
        .slice(0, limit);
}

/**
 * Get faculty by utilization status
 * @param {Object} facultyData - Faculty workload data
 * @param {string} status - Status: 'overloaded', 'optimal', 'underutilized'
 * @returns {Array} Array of [name, data] pairs with specified status
 */
function getFacultyByStatus(facultyData, status) {
    if (!facultyData) {
        return [];
    }

    return Object.entries(facultyData)
        .filter(([_, data]) => data.status === status)
        .sort((a, b) => b[1].utilizationRate - a[1].utilizationRate);
}

/**
 * Calculate applied learning totals for faculty
 * @param {Object} facultyData - Faculty workload data
 * @returns {Object} Applied learning summary
 */
function calculateAppliedLearningSummary(facultyData) {
    const summary = {
        totalCredits: 0,
        totalWorkload: 0,
        desn499: { credits: 0, workload: 0, sections: 0 },
        desn495: { credits: 0, workload: 0, sections: 0 }
    };

    if (!facultyData) {
        return summary;
    }

    Object.values(facultyData).forEach(faculty => {
        if (faculty.appliedLearning) {
            // DESN 499
            if (faculty.appliedLearning['DESN 499']) {
                const desn499 = faculty.appliedLearning['DESN 499'];
                summary.desn499.credits += desn499.credits || 0;
                summary.desn499.workload += desn499.workload || 0;
                summary.desn499.sections += desn499.sections || 0;
            }

            // DESN 495
            if (faculty.appliedLearning['DESN 495']) {
                const desn495 = faculty.appliedLearning['DESN 495'];
                summary.desn495.credits += desn495.credits || 0;
                summary.desn495.workload += desn495.workload || 0;
                summary.desn495.sections += desn495.sections || 0;
            }
        }

        summary.totalCredits += faculty.appliedLearningCredits || 0;
        summary.totalWorkload += faculty.appliedLearningWorkload || 0;
    });

    return summary;
}

/**
 * Format faculty name for display
 * @param {string} name - Faculty name
 * @param {Object} facultyData - Faculty data object
 * @returns {string} Formatted name with status indicators
 */
function formatFacultyName(name, facultyData) {
    let formatted = name;

    if (facultyData) {
        if (facultyData.status === 'sabbatical') {
            formatted += ' (Sabbatical)';
        } else if (facultyData.category === 'former') {
            formatted += ' (Former)';
        } else if (facultyData.category === 'adjunct') {
            formatted += ' (Adjunct)';
        }

        if (facultyData.specialRole) {
            formatted += ` - ${facultyData.specialRole}`;
        }
    }

    return formatted;
}

/**
 * Get utilization color class based on status
 * @param {string} status - Utilization status
 * @returns {string} CSS class name
 */
function getUtilizationColorClass(status) {
    switch(status) {
        case 'overloaded':
            return 'overloaded';
        case 'optimal':
            return 'optimal';
        case 'underutilized':
            return 'underutilized';
        default:
            return '';
    }
}

/**
 * Get utilization status from rate
 * @param {number} rate - Utilization rate percentage
 * @returns {string} Status: 'overloaded', 'optimal', or 'underutilized'
 */
function getUtilizationStatus(rate) {
    if (rate > 100) return 'overloaded';
    if (rate >= 60) return 'optimal';
    return 'underutilized';
}

/**
 * Calculate capacity summary for full-time vs adjunct
 * @param {Object} yearData - Year-specific faculty data
 * @returns {Object} Capacity summary by category
 */
function calculateCapacitySummary(yearData) {
    const summary = {
        fullTime: {
            count: 0,
            totalCapacity: 0,
            currentLoad: 0,
            available: 0,
            utilizationRate: 0
        },
        adjunct: {
            count: 0,
            totalCapacity: 0,
            currentLoad: 0,
            available: 0,
            utilizationRate: 0
        },
        overall: {
            count: 0,
            totalCapacity: 0,
            currentLoad: 0,
            available: 0,
            utilizationRate: 0
        }
    };

    if (!yearData) {
        return summary;
    }

    // Calculate full-time faculty capacity
    if (yearData.fullTime) {
        const fullTimeFaculty = Object.values(yearData.fullTime);
        summary.fullTime.count = fullTimeFaculty.length;

        fullTimeFaculty.forEach(f => {
            summary.fullTime.totalCapacity += f.maxWorkload || 0;
            summary.fullTime.currentLoad += f.totalWorkloadCredits || 0;
        });

        summary.fullTime.available = Math.max(0, summary.fullTime.totalCapacity - summary.fullTime.currentLoad);
        summary.fullTime.utilizationRate = summary.fullTime.totalCapacity > 0
            ? Math.round((summary.fullTime.currentLoad / summary.fullTime.totalCapacity) * 100 * 10) / 10
            : 0;
    }

    // Calculate adjunct faculty capacity
    if (yearData.adjunct) {
        const adjunctFaculty = Object.values(yearData.adjunct);
        summary.adjunct.count = adjunctFaculty.length;

        adjunctFaculty.forEach(f => {
            summary.adjunct.totalCapacity += f.maxWorkload || 0;
            summary.adjunct.currentLoad += f.totalWorkloadCredits || 0;
        });

        summary.adjunct.available = Math.max(0, summary.adjunct.totalCapacity - summary.adjunct.currentLoad);
        summary.adjunct.utilizationRate = summary.adjunct.totalCapacity > 0
            ? Math.round((summary.adjunct.currentLoad / summary.adjunct.totalCapacity) * 100 * 10) / 10
            : 0;
    }

    // Calculate overall capacity
    summary.overall.count = summary.fullTime.count + summary.adjunct.count;
    summary.overall.totalCapacity = summary.fullTime.totalCapacity + summary.adjunct.totalCapacity;
    summary.overall.currentLoad = summary.fullTime.currentLoad + summary.adjunct.currentLoad;
    summary.overall.available = Math.max(0, summary.overall.totalCapacity - summary.overall.currentLoad);
    summary.overall.utilizationRate = summary.overall.totalCapacity > 0
        ? Math.round((summary.overall.currentLoad / summary.overall.totalCapacity) * 100 * 10) / 10
        : 0;

    return summary;
}
