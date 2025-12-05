/**
 * Schedule Analyzer Module
 * Analyzes loaded schedule data and generates recommendations
 */

const ScheduleAnalyzer = (function() {
    'use strict';

    // Configuration
    const CONFIG = {
        enrollmentThresholds: {
            high: 0.90,      // >90% = add section
            low: 0.60        // <60% = consider reducing
        },
        facultyCapacity: {
            fullTime: 15,    // credits per quarter
            adjunct: 5       // credits per quarter
        },
        defaultEnrollmentCap: 24
    };

    // Store for analysis data
    let enrollmentData = null;
    let courseCatalog = null;
    let prerequisiteGraph = null;

    /**
     * Initialize analyzer with data sources
     */
    async function init() {
        try {
            // Load enrollment dashboard data
            const enrollmentResponse = await fetch('../enrollment-dashboard-data.json');
            if (enrollmentResponse.ok) {
                enrollmentData = await enrollmentResponse.json();
                console.log('Enrollment data loaded for analyzer');
            }

            // Load course catalog
            const catalogResponse = await fetch('../data/course-catalog.json');
            if (catalogResponse.ok) {
                courseCatalog = await catalogResponse.json();
                console.log('Course catalog loaded for analyzer');
            }

            // Load prerequisite graph
            const prereqResponse = await fetch('../data/prerequisite-graph.json');
            if (prereqResponse.ok) {
                prerequisiteGraph = await prereqResponse.json();
                console.log('Prerequisite graph loaded for analyzer');
            }

            // Initialize constraints engine if available
            if (typeof ConstraintsEngine !== 'undefined') {
                await ConstraintsEngine.init('../data/scheduling-rules.json');
                console.log('Constraints engine loaded for analyzer');
            }

            return true;
        } catch (err) {
            console.error('Error initializing analyzer:', err);
            return false;
        }
    }

    /**
     * Run full analysis on loaded schedule
     * @param {Object} schedule - The loaded schedule data by quarter
     * @param {String} sourceYear - Source year being copied
     * @param {String} targetYear - Target year being created
     * @returns {Object} Analysis results with recommendations
     */
    function analyzeSchedule(schedule, sourceYear, targetYear) {
        const results = {
            enrollment: [],
            conflicts: [],
            missing: [],
            summary: {
                totalIssues: 0,
                capacityWarnings: 0,
                coursesLoaded: 0
            }
        };

        // Count total courses loaded
        let totalCourses = 0;
        Object.values(schedule).forEach(quarterData => {
            Object.values(quarterData.assignedCourses || {}).forEach(courses => {
                totalCourses += courses.length;
            });
        });
        results.summary.coursesLoaded = totalCourses;

        // Run individual analyses
        const enrollmentResults = analyzeEnrollment(schedule);
        const conflictResults = analyzeConflicts(schedule);
        const missingResults = analyzeMissingCourses(schedule, targetYear);

        results.enrollment = enrollmentResults;
        results.conflicts = conflictResults;
        results.missing = missingResults;

        // Calculate totals
        results.summary.totalIssues =
            enrollmentResults.length +
            conflictResults.length +
            missingResults.length;
        results.summary.capacityWarnings = enrollmentResults.filter(r =>
            r.type === 'add-section' || r.type === 'reduce-section'
        ).length;

        return results;
    }

    /**
     * Analyze enrollment trends and capacity
     */
    function analyzeEnrollment(schedule) {
        const recommendations = [];

        if (!enrollmentData?.courseStats) {
            console.warn('No enrollment data available for analysis');
            return recommendations;
        }

        // Aggregate courses across quarters
        const coursesByCode = {};
        Object.entries(schedule).forEach(([quarter, quarterData]) => {
            Object.values(quarterData.assignedCourses || {}).forEach(courses => {
                courses.forEach(course => {
                    const code = course.courseCode;
                    if (!coursesByCode[code]) {
                        coursesByCode[code] = {
                            sections: 0,
                            quarters: []
                        };
                    }
                    coursesByCode[code].sections++;
                    if (!coursesByCode[code].quarters.includes(quarter)) {
                        coursesByCode[code].quarters.push(quarter);
                    }
                });
            });
        });

        // Compare with enrollment data
        Object.entries(coursesByCode).forEach(([code, data]) => {
            const stats = enrollmentData.courseStats[code];
            if (!stats) return;

            const avgEnrollment = stats.average || 0;
            const currentCapacity = data.sections * CONFIG.defaultEnrollmentCap;
            const utilization = avgEnrollment / currentCapacity;
            const trend = stats.trend || 'stable';

            // Check for high demand
            if (utilization > CONFIG.enrollmentThresholds.high || trend === 'growing') {
                recommendations.push({
                    id: `enroll-${code}-add`,
                    type: 'add-section',
                    courseCode: code,
                    title: `Add section to ${code}`,
                    detail: `Avg enrollment: ${avgEnrollment}, Current capacity: ${currentCapacity} (${Math.round(utilization * 100)}% utilization). Trend: ${trend}`,
                    priority: utilization > 1 ? 'high' : 'medium',
                    action: { type: 'add-section', courseCode: code }
                });
            }

            // Check for low demand
            if (utilization < CONFIG.enrollmentThresholds.low && data.sections > 1) {
                recommendations.push({
                    id: `enroll-${code}-reduce`,
                    type: 'reduce-section',
                    courseCode: code,
                    title: `Consider reducing ${code} sections`,
                    detail: `Only ${Math.round(utilization * 100)}% utilization with ${data.sections} sections. Trend: ${trend}`,
                    priority: 'low',
                    action: { type: 'reduce-section', courseCode: code }
                });
            }
        });

        return recommendations;
    }

    /**
     * Analyze scheduling conflicts
     */
    function analyzeConflicts(schedule) {
        const conflicts = [];

        Object.entries(schedule).forEach(([quarter, quarterData]) => {
            const assignedCourses = quarterData.assignedCourses || {};

            // Evening safety check
            const eveningCoursesByDay = { 'MW': [], 'TR': [] };
            Object.entries(assignedCourses).forEach(([key, courses]) => {
                if (key === 'unassigned') return;
                const [day, time] = key.split('-');
                // Check if evening slot (16:00 or 4:00 PM)
                if (time && (time.includes('16:00') || time.includes('4:00'))) {
                    courses.forEach(c => eveningCoursesByDay[day]?.push({ ...c, slotKey: key }));
                }
            });

            ['MW', 'TR'].forEach(day => {
                if (eveningCoursesByDay[day].length === 1) {
                    const course = eveningCoursesByDay[day][0];
                    conflicts.push({
                        id: `safety-${quarter}-${day}`,
                        type: 'evening-safety',
                        quarter: quarter,
                        day: day,
                        courseCode: course.courseCode,
                        title: `Evening safety: Only one course on ${day} in ${quarter}`,
                        detail: `${course.courseCode} is scheduled alone after 4pm. Two instructors should be present for safety.`,
                        priority: 'high',
                        action: { type: 'add-evening-pair', quarter, day }
                    });
                }
            });

            // MW/TR balance check
            const dayCounts = { 'MW': 0, 'TR': 0 };
            Object.entries(assignedCourses).forEach(([key, courses]) => {
                if (key === 'unassigned') return;
                const day = key.split('-')[0];
                if (dayCounts[day] !== undefined) {
                    dayCounts[day] += courses.length;
                }
            });

            const imbalance = Math.abs(dayCounts['MW'] - dayCounts['TR']);
            if (imbalance > 3) {
                conflicts.push({
                    id: `balance-${quarter}`,
                    type: 'day-imbalance',
                    quarter: quarter,
                    title: `MW/TR imbalance in ${quarter}`,
                    detail: `MW has ${dayCounts['MW']} courses, TR has ${dayCounts['TR']} courses (difference: ${imbalance})`,
                    priority: 'medium',
                    action: { type: 'rebalance', quarter }
                });
            }

            // Room 212 constraint check
            const room212Courses = ['DESN 301', 'DESN 359', 'DESN 401'];
            const room212Overflow = ['DESN 100', 'DESN 200'];
            Object.entries(assignedCourses).forEach(([key, courses]) => {
                if (!key.includes('212')) return;
                courses.forEach(course => {
                    if (!room212Courses.includes(course.courseCode) &&
                        !room212Overflow.includes(course.courseCode)) {
                        conflicts.push({
                            id: `room212-${quarter}-${course.courseCode}`,
                            type: 'room-constraint',
                            quarter: quarter,
                            courseCode: course.courseCode,
                            title: `Room 212 violation: ${course.courseCode}`,
                            detail: `${course.courseCode} should not be in Room 212 (restricted to 301, 359, 401, 100, 200)`,
                            priority: 'medium',
                            action: { type: 'move-room', quarter, courseCode: course.courseCode, fromRoom: '212' }
                        });
                    }
                });
            });

            // ITGS Cheney-only + no evening constraint check
            Object.entries(assignedCourses).forEach(([key, courses]) => {
                if (key === 'unassigned') return;
                const isCheneyRoom = key.includes('CEB');
                const isEvening = key.includes('16:00') || key.includes('4:00');
                courses.forEach(course => {
                    if (course.courseCode.startsWith('ITGS')) {
                        if (!isCheneyRoom) {
                            conflicts.push({
                                id: `itgs-cheney-${quarter}-${course.courseCode}`,
                                type: 'room-constraint',
                                quarter: quarter,
                                courseCode: course.courseCode,
                                title: `ITGS must be in Cheney: ${course.courseCode}`,
                                detail: `${course.courseCode} is in Spokane but ITGS courses can only be offered in Cheney (CEB 102/104)`,
                                priority: 'high',
                                action: { type: 'move-room', quarter, courseCode: course.courseCode, toRoom: 'CEB' }
                            });
                        }
                        if (isEvening) {
                            conflicts.push({
                                id: `itgs-evening-${quarter}-${course.courseCode}`,
                                type: 'time-constraint',
                                quarter: quarter,
                                courseCode: course.courseCode,
                                title: `ITGS no evenings: ${course.courseCode}`,
                                detail: `${course.courseCode} is scheduled in evening but ITGS courses cannot be offered after 4pm`,
                                priority: 'high',
                                action: { type: 'move-time', quarter, courseCode: course.courseCode }
                            });
                        }
                    }
                });
            });

            // Faculty double-booking check
            const facultyBySlot = {};
            Object.entries(assignedCourses).forEach(([key, courses]) => {
                if (key === 'unassigned') return;
                courses.forEach(course => {
                    const faculty = course.facultyName;
                    if (faculty && faculty !== 'TBD') {
                        if (!facultyBySlot[key]) facultyBySlot[key] = [];
                        facultyBySlot[key].push({ faculty, courseCode: course.courseCode });
                    }
                });
            });

            // Check for faculty teaching multiple courses at same time (different rooms)
            const slotsByTime = {};
            Object.entries(facultyBySlot).forEach(([key, assignments]) => {
                const [day, time] = key.split('-');
                const timeKey = `${day}-${time}`;
                if (!slotsByTime[timeKey]) slotsByTime[timeKey] = [];
                slotsByTime[timeKey].push(...assignments);
            });

            Object.entries(slotsByTime).forEach(([timeKey, assignments]) => {
                const facultyCounts = {};
                assignments.forEach(a => {
                    if (!facultyCounts[a.faculty]) facultyCounts[a.faculty] = [];
                    facultyCounts[a.faculty].push(a.courseCode);
                });

                Object.entries(facultyCounts).forEach(([faculty, courses]) => {
                    if (courses.length > 1) {
                        conflicts.push({
                            id: `faculty-conflict-${quarter}-${faculty}-${timeKey}`,
                            type: 'faculty-double-booking',
                            quarter: quarter,
                            faculty: faculty,
                            title: `Faculty double-booking: ${faculty}`,
                            detail: `${faculty} is assigned to ${courses.join(' and ')} at the same time (${timeKey})`,
                            priority: 'high',
                            action: { type: 'resolve-faculty-conflict', quarter, faculty }
                        });
                    }
                });
            });

            // Time slot distribution check
            const timeCounts = { 'morning': 0, 'afternoon': 0, 'evening': 0 };
            let totalCourses = 0;
            Object.entries(assignedCourses).forEach(([key, courses]) => {
                if (key === 'unassigned') return;
                const time = key.split('-')[1];
                if (time?.includes('10:00') || time?.includes('10:00-12:20')) {
                    timeCounts.morning += courses.length;
                } else if (time?.includes('13:00') || time?.includes('1:00')) {
                    timeCounts.afternoon += courses.length;
                } else if (time?.includes('16:00') || time?.includes('4:00')) {
                    timeCounts.evening += courses.length;
                }
                totalCourses += courses.length;
            });

            if (totalCourses > 0) {
                const morningPct = (timeCounts.morning / totalCourses) * 100;
                const afternoonPct = (timeCounts.afternoon / totalCourses) * 100;
                const eveningPct = (timeCounts.evening / totalCourses) * 100;

                if (morningPct > 60) {
                    conflicts.push({
                        id: `time-clustering-${quarter}-morning`,
                        type: 'time-clustering',
                        quarter: quarter,
                        title: `Time slot imbalance in ${quarter}`,
                        detail: `${Math.round(morningPct)}% of courses in morning slot (Morning: ${timeCounts.morning}, Afternoon: ${timeCounts.afternoon}, Evening: ${timeCounts.evening})`,
                        priority: 'low',
                        action: { type: 'redistribute-times', quarter }
                    });
                }
            }
        });

        return conflicts;
    }

    /**
     * Analyze missing or required courses
     */
    function analyzeMissingCourses(schedule, targetYear) {
        const missing = [];

        if (!courseCatalog?.courses) {
            console.warn('No course catalog available for missing course analysis');
            return missing;
        }

        // Get all scheduled course codes by quarter
        const scheduledByQuarter = { Fall: [], Winter: [], Spring: [] };
        Object.entries(schedule).forEach(([quarter, quarterData]) => {
            Object.values(quarterData.assignedCourses || {}).forEach(courses => {
                courses.forEach(course => {
                    if (!scheduledByQuarter[quarter].includes(course.courseCode)) {
                        scheduledByQuarter[quarter].push(course.courseCode);
                    }
                });
            });
        });

        // Check required courses
        courseCatalog.courses.forEach(course => {
            if (course.required) {
                // Check if required course is scheduled in appropriate quarter
                const offeredIn = course.offeredQuarters || [];
                offeredIn.forEach(quarter => {
                    if (!scheduledByQuarter[quarter]?.includes(course.code)) {
                        missing.push({
                            id: `missing-${course.code}-${quarter}`,
                            type: 'required-missing',
                            courseCode: course.code,
                            quarter: quarter,
                            title: `Required: ${course.code} not scheduled in ${quarter}`,
                            detail: `${course.title} is a required course and should be offered in ${quarter}`,
                            priority: 'high',
                            action: { type: 'add-course', courseCode: course.code, quarter }
                        });
                    }
                });
            }
        });

        // Check for prerequisite sequence issues
        if (prerequisiteGraph?.courses) {
            Object.entries(prerequisiteGraph.courses).forEach(([code, courseData]) => {
                if (!courseData.prerequisites || courseData.prerequisites.length === 0) return;

                // Find which quarter this course is scheduled
                let scheduledQuarter = null;
                Object.entries(scheduledByQuarter).forEach(([quarter, codes]) => {
                    if (codes.includes(code)) scheduledQuarter = quarter;
                });

                if (!scheduledQuarter) return;

                // Check each prerequisite
                courseData.prerequisites.forEach(prereq => {
                    const prereqQuarter = getPrerequisiteQuarter(prereq, scheduledByQuarter, scheduledQuarter);
                    if (prereqQuarter === 'not-offered') {
                        missing.push({
                            id: `prereq-${prereq}-for-${code}`,
                            type: 'prerequisite-missing',
                            courseCode: prereq,
                            dependentCourse: code,
                            title: `Prerequisite missing: ${prereq}`,
                            detail: `${code} requires ${prereq}, but ${prereq} is not offered in a prior quarter`,
                            priority: 'high',
                            action: { type: 'add-prerequisite', courseCode: prereq, for: code }
                        });
                    }
                });
            });
        }

        return missing;
    }

    /**
     * Helper: Check if prerequisite is offered before dependent course
     */
    function getPrerequisiteQuarter(prereqCode, scheduledByQuarter, dependentQuarter) {
        const quarterOrder = ['Fall', 'Winter', 'Spring'];
        const depIndex = quarterOrder.indexOf(dependentQuarter);

        // Check if prerequisite is in an earlier quarter
        for (let i = 0; i < depIndex; i++) {
            if (scheduledByQuarter[quarterOrder[i]].includes(prereqCode)) {
                return quarterOrder[i];
            }
        }

        // Also check if it could be from previous year (assume any quarter counts)
        for (const quarter of quarterOrder) {
            if (scheduledByQuarter[quarter].includes(prereqCode)) {
                return quarter;
            }
        }

        return 'not-offered';
    }

    /**
     * Get faculty workload analysis
     */
    function analyzeFacultyWorkload(schedule) {
        const facultyLoads = {};

        Object.entries(schedule).forEach(([quarter, quarterData]) => {
            Object.values(quarterData.assignedCourses || {}).forEach(courses => {
                courses.forEach(course => {
                    const faculty = course.facultyName || 'TBD';
                    if (!facultyLoads[faculty]) {
                        facultyLoads[faculty] = { Fall: 0, Winter: 0, Spring: 0 };
                    }
                    facultyLoads[faculty][quarter] += course.credits || 5;
                });
            });
        });

        const warnings = [];
        Object.entries(facultyLoads).forEach(([name, loads]) => {
            Object.entries(loads).forEach(([quarter, credits]) => {
                if (credits > CONFIG.facultyCapacity.fullTime) {
                    warnings.push({
                        id: `overload-${name}-${quarter}`,
                        type: 'faculty-overload',
                        faculty: name,
                        quarter: quarter,
                        credits: credits,
                        title: `Faculty overload: ${name} in ${quarter}`,
                        detail: `${name} has ${credits} credits in ${quarter} (max recommended: ${CONFIG.facultyCapacity.fullTime})`,
                        priority: 'high'
                    });
                }
            });
        });

        return { facultyLoads, warnings };
    }

    // Public API
    return {
        init,
        analyzeSchedule,
        analyzeEnrollment,
        analyzeConflicts,
        analyzeMissingCourses,
        analyzeFacultyWorkload
    };
})();

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
    window.ScheduleAnalyzer = ScheduleAnalyzer;
}
