/**
 * Schedule Generator Module
 * Generates schedule recommendations based on demand predictions and faculty assignments
 */

const ScheduleGenerator = (function() {
    'use strict';

    let initialized = false;
    let workloadData = null;
    let catalogData = null;
    let enrollmentData = null;

    // Configuration
    const CONFIG = {
        defaultEnrollmentCap: 24,
        facultyCapacity: {
            fullTime: 15,  // credits per quarter
            adjunct: 5     // credits per quarter
        },
        priorityThresholds: {
            high: 0.9,     // utilization > 90%
            medium: 0.7    // utilization > 70%
        }
    };

    /**
     * Initialize the schedule generator
     */
    async function init(options = {}) {
        try {
            // Load workload data
            const workloadPath = options.workloadPath || '../workload-data.json';
            const workloadResponse = await fetch(workloadPath);
            if (workloadResponse.ok) {
                workloadData = await workloadResponse.json();
            }

            // Load course catalog
            const catalogPath = options.catalogPath || '../data/course-catalog.json';
            const catalogResponse = await fetch(catalogPath);
            if (catalogResponse.ok) {
                catalogData = await catalogResponse.json();
            }

            // Load enrollment data
            const enrollmentPath = options.enrollmentPath || '../enrollment-dashboard-data.json';
            const enrollmentResponse = await fetch(enrollmentPath);
            if (enrollmentResponse.ok) {
                enrollmentData = await enrollmentResponse.json();
            }

            initialized = true;
            console.log('ScheduleGenerator initialized');
            return { success: true };
        } catch (error) {
            console.error('ScheduleGenerator init error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate complete schedule for a quarter
     */
    async function generateSchedule(quarter, year = '2026-27') {
        if (!initialized) {
            await init();
        }

        const recommendations = [];
        const courses = catalogData?.courses || [];
        const quarterCapitalized = quarter.charAt(0).toUpperCase() + quarter.slice(1).toLowerCase();

        // Get faculty teaching history
        const facultyHistory = buildFacultyHistory();
        const facultyLoads = {};

        // Process each course in the catalog
        for (const course of courses) {
            // Check if course is offered in this quarter
            if (!course.offeredQuarters?.includes(quarterCapitalized)) {
                continue;
            }

            // Get demand prediction
            const prediction = predictDemand(course.code, quarterCapitalized);

            // Calculate sections needed
            const cap = course.typicalEnrollmentCap || CONFIG.defaultEnrollmentCap;
            const sectionsNeeded = Math.max(1, Math.ceil(prediction.demand / cap));

            // Determine priority
            const utilization = prediction.demand / (cap * sectionsNeeded);
            const priority = utilization > CONFIG.priorityThresholds.high ? 'high' :
                           utilization > CONFIG.priorityThresholds.medium ? 'medium' : 'low';

            // Auto-assign faculty based on history
            const assignedFaculty = autoAssignFaculty(
                course.code,
                sectionsNeeded,
                facultyHistory,
                facultyLoads,
                course.defaultCredits || 5
            );

            recommendations.push({
                courseCode: course.code,
                courseTitle: course.title,
                credits: course.defaultCredits || 5,
                enrollmentCap: cap,
                predictedDemand: prediction.demand,
                confidence: prediction.confidence,
                sectionsNeeded: sectionsNeeded,
                priority: priority,
                utilization: Math.round(utilization * 100),
                assignedFaculty: assignedFaculty,
                trend: prediction.trend,
                level: course.level,
                workloadMultiplier: course.workloadMultiplier || 1.0,
                isVariable: course.isVariable || false
            });
        }

        // Sort by priority then by course code
        recommendations.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return a.courseCode.localeCompare(b.courseCode);
        });

        // Calculate summary statistics
        const summary = calculateSummary(recommendations, facultyLoads);

        return {
            year: year,
            quarter: quarterCapitalized,
            recommendations: recommendations,
            summary: summary,
            facultyLoads: facultyLoads
        };
    }

    /**
     * Predict demand for a course
     */
    function predictDemand(courseCode, quarter) {
        const courseStats = enrollmentData?.courseStats || {};
        const normalizedCode = courseCode.replace(/-/g, ' ');
        const stats = courseStats[normalizedCode] || courseStats[courseCode];

        if (!stats) {
            return { demand: 20, confidence: 0.3, trend: 'unknown' };
        }

        // Historical analysis - weight recent years more heavily
        const quarterly = stats.quarterly || {};
        const quarterLower = quarter.toLowerCase();

        let totalWeight = 0;
        let weightedSum = 0;
        let dataPoints = [];

        Object.entries(quarterly).forEach(([key, value]) => {
            if (key.startsWith(quarterLower)) {
                const enrollment = typeof value === 'object' ? value.total : value;
                const year = parseInt(key.split('-')[1]) || 2022;
                const weight = 1 + (year - 2022) * 0.3; // Recent years weighted higher
                weightedSum += enrollment * weight;
                totalWeight += weight;
                dataPoints.push({ year, enrollment });
            }
        });

        if (totalWeight === 0) {
            return { demand: stats.average || 20, confidence: 0.4, trend: 'stable' };
        }

        const historicalPrediction = weightedSum / totalWeight;

        // Apply trend adjustment
        let trendMultiplier = 1.0;
        let trend = 'stable';

        if (stats.trend === 'growing') {
            trendMultiplier = 1.1;
            trend = 'growing';
        } else if (stats.trend === 'declining') {
            trendMultiplier = 0.9;
            trend = 'declining';
        }

        const demand = Math.round(historicalPrediction * trendMultiplier);
        const confidence = Math.min(0.95, 0.5 + (dataPoints.length * 0.1));

        return { demand, confidence, trend };
    }

    /**
     * Build faculty teaching history from workload data
     */
    function buildFacultyHistory() {
        const history = {};
        const byYear = workloadData?.workloadByYear?.byYear || workloadData?.byYear || {};

        Object.entries(byYear).forEach(([year, yearData]) => {
            ['fullTime', 'adjunct'].forEach(type => {
                const facultyGroup = yearData[type] || {};
                Object.entries(facultyGroup).forEach(([name, data]) => {
                    if (!history[name]) {
                        history[name] = {
                            courses: {},
                            type: type,
                            capacity: type === 'fullTime' ? CONFIG.facultyCapacity.fullTime : CONFIG.facultyCapacity.adjunct
                        };
                    }

                    const courses = data.courses || [];
                    courses.forEach(course => {
                        const code = course.courseCode;
                        if (!history[name].courses[code]) {
                            history[name].courses[code] = 0;
                        }
                        history[name].courses[code]++;
                    });
                });
            });
        });

        return history;
    }

    /**
     * Auto-assign faculty based on historical teaching patterns
     */
    function autoAssignFaculty(courseCode, sectionsNeeded, history, loads, credits) {
        const assignments = [];
        const normalizedCode = courseCode.replace(/\s+/g, ' ');

        // Find faculty who have taught this course before
        const candidates = [];
        Object.entries(history).forEach(([name, data]) => {
            const courseHistory = data.courses[normalizedCode] || data.courses[courseCode.replace(/ /g, '-')] || 0;
            if (courseHistory > 0) {
                candidates.push({
                    name: name,
                    timesTeught: courseHistory,
                    type: data.type,
                    capacity: data.capacity
                });
            }
        });

        // Sort by times taught (prefer those who taught it more)
        candidates.sort((a, b) => b.timesTeught - a.timesTeught);

        // Assign sections
        let sectionsAssigned = 0;
        for (const candidate of candidates) {
            if (sectionsAssigned >= sectionsNeeded) break;

            // Initialize load tracking
            if (!loads[candidate.name]) {
                loads[candidate.name] = { credits: 0, sections: [] };
            }

            // Check capacity
            const currentLoad = loads[candidate.name].credits;
            const additionalCredits = credits;

            if (currentLoad + additionalCredits <= candidate.capacity) {
                assignments.push({
                    name: candidate.name,
                    section: String(sectionsAssigned + 1).padStart(3, '0'),
                    type: candidate.type
                });
                loads[candidate.name].credits += additionalCredits;
                loads[candidate.name].sections.push(courseCode);
                sectionsAssigned++;
            }
        }

        // Fill remaining with TBD
        while (sectionsAssigned < sectionsNeeded) {
            assignments.push({
                name: 'TBD',
                section: String(sectionsAssigned + 1).padStart(3, '0'),
                type: 'unassigned'
            });
            sectionsAssigned++;
        }

        return assignments;
    }

    /**
     * Calculate summary statistics
     */
    function calculateSummary(recommendations, facultyLoads) {
        const totalSections = recommendations.reduce((sum, r) => sum + r.sectionsNeeded, 0);
        const totalCredits = recommendations.reduce((sum, r) => sum + (r.credits * r.sectionsNeeded), 0);
        const highDemand = recommendations.filter(r => r.priority === 'high').length;

        // Count assigned vs unassigned
        let assignedCount = 0;
        let unassignedCount = 0;
        recommendations.forEach(r => {
            r.assignedFaculty.forEach(f => {
                if (f.name === 'TBD') {
                    unassignedCount++;
                } else {
                    assignedCount++;
                }
            });
        });

        // Faculty utilization warnings
        const warnings = [];
        Object.entries(facultyLoads).forEach(([name, load]) => {
            const capacity = load.capacity || CONFIG.facultyCapacity.fullTime;
            if (load.credits > capacity) {
                warnings.push({
                    type: 'overload',
                    faculty: name,
                    credits: load.credits,
                    capacity: capacity
                });
            }
        });

        return {
            totalSections: totalSections,
            totalCredits: totalCredits,
            highDemandCourses: highDemand,
            assignedSections: assignedCount,
            unassignedSections: unassignedCount,
            facultyCount: Object.keys(facultyLoads).length,
            warnings: warnings,
            warningCount: warnings.length + unassignedCount
        };
    }

    /**
     * Adjust sections for a course
     */
    function adjustSections(recommendations, courseCode, delta) {
        const rec = recommendations.find(r => r.courseCode === courseCode);
        if (!rec) return recommendations;

        rec.sectionsNeeded = Math.max(1, rec.sectionsNeeded + delta);
        rec.utilization = Math.round((rec.predictedDemand / (rec.enrollmentCap * rec.sectionsNeeded)) * 100);

        // Update priority
        const utilRate = rec.utilization / 100;
        rec.priority = utilRate > CONFIG.priorityThresholds.high ? 'high' :
                      utilRate > CONFIG.priorityThresholds.medium ? 'medium' : 'low';

        // Adjust faculty assignments
        if (delta > 0) {
            rec.assignedFaculty.push({
                name: 'TBD',
                section: String(rec.assignedFaculty.length + 1).padStart(3, '0'),
                type: 'unassigned'
            });
        } else if (delta < 0 && rec.assignedFaculty.length > 1) {
            rec.assignedFaculty.pop();
        }

        return recommendations;
    }

    /**
     * Export schedule to JSON format compatible with schedule editor
     */
    function exportForEditor(scheduleData) {
        const exported = {
            academicYear: scheduleData.year,
            quarter: scheduleData.quarter,
            courses: [],
            generatedAt: new Date().toISOString(),
            source: 'schedule-builder'
        };

        scheduleData.recommendations.forEach(rec => {
            rec.assignedFaculty.forEach(faculty => {
                exported.courses.push({
                    courseCode: rec.courseCode,
                    courseTitle: rec.courseTitle,
                    section: faculty.section,
                    credits: rec.credits,
                    enrollmentCap: rec.enrollmentCap,
                    assignedFaculty: faculty.name,
                    predictedEnrollment: Math.round(rec.predictedDemand / rec.sectionsNeeded),
                    workloadMultiplier: rec.workloadMultiplier,
                    room: null,
                    days: null,
                    startTime: null,
                    endTime: null
                });
            });
        });

        return exported;
    }

    // Public API
    return {
        init,
        generateSchedule,
        adjustSections,
        exportForEditor,
        CONFIG
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScheduleGenerator;
}
