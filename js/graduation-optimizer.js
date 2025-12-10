/**
 * Graduation Pathway Optimizer
 * Analyzes schedules against BDES degree requirements to minimize graduation conflicts
 */

const GraduationOptimizer = (function() {
    'use strict';

    // BDES Degree Requirements (2025-2026 Catalog)
    const DEGREE_REQUIREMENTS = {
        name: 'Bachelor of Design in Visual Communication Design',
        totalCredits: 180,
        majorCredits: 90,
        requiredCourses: [
            { code: 'DESN 100', title: 'Drawing for Communication', credits: 5, level: 100 },
            { code: 'DESN 200', title: 'Visual Thinking + Making', credits: 5, level: 200 },
            { code: 'DESN 216', title: 'Digital Foundations', credits: 5, level: 200, critical: true },
            { code: 'DESN 243', title: 'Typography', credits: 5, level: 200 },
            { code: 'DESN 263', title: 'Visual Communication Design', credits: 5, level: 200 },
            { code: 'DESN 338', title: 'User Experience Design 1', credits: 5, level: 300 },
            { code: 'DESN 359', title: 'Histories of Design', credits: 5, level: 300 },
            { code: 'DESN 463', title: 'Community-Driven Design', credits: 5, level: 400 },
            { code: 'DESN 480', title: 'Professional Practice', credits: 5, level: 400 },
            { code: 'DESN 490', title: 'Senior Capstone', credits: 5, level: 400, critical: true }
        ],
        electiveCredits: 40,
        electiveMinCourses: 8
    };

    // Minor requirements
    const MINORS = {
        'animation': {
            name: 'Animation & Motion Design',
            credits: 45,
            courses: ['DESN 100', 'DESN 200', 'DESN 216', 'DESN 301', 'DESN 326', 'DESN 336', 'DESN 355', 'DESN 365', 'DESN 401'],
            sequence: ['DESN 100', 'DESN 200', 'DESN 216', 'DESN 326', 'DESN 336', 'DESN 355', 'DESN 365']
        },
        'game-design': {
            name: 'Game Design',
            credits: 30,
            courses: ['DESN 100', 'DESN 216', 'DESN 301', 'DESN 326', 'DESN 335', 'DESN 345'],
            sequence: ['DESN 100', 'DESN 216', 'DESN 301', 'DESN 326', 'DESN 345']
        },
        'interaction': {
            name: 'Interaction Design',
            credits: 35,
            courses: ['DESN 216', 'DESN 338', 'DESN 348', 'DESN 368', 'DESN 378', 'DESN 458', 'DESN 468'],
            sequence: ['DESN 216', 'DESN 338', 'DESN 348', 'DESN 458', 'DESN 368', 'DESN 378', 'DESN 468']
        },
        'ux': {
            name: 'User Experience Design',
            credits: 15,
            courses: ['DESN 338', 'DESN 348', 'DESN 458'],
            sequence: ['DESN 338', 'DESN 348', 'DESN 458']
        },
        'web': {
            name: 'Web Development',
            credits: 15,
            courses: ['DESN 369', 'DESN 379', 'DESN 469'],
            sequence: ['DESN 369', 'DESN 379', 'DESN 469']
        },
        'graphic': {
            name: 'Graphic Design',
            credits: 15,
            courses: ['DESN 463', 'DESN 305', 'DESN 343', 'DESN 360', 'DESN 366'],
            required: ['DESN 463'],
            chooseFrom: ['DESN 305', 'DESN 343', 'DESN 360', 'DESN 366'],
            chooseCount: 2
        },
        'photography': {
            name: 'Photography',
            credits: 25,
            courses: ['DESN 200', 'DESN 350', 'DESN 351'],
            sequence: ['DESN 200', 'DESN 350', 'DESN 351']
        }
    };

    // Typical 4-year pathway (quarters when courses should be offered)
    const IDEAL_SEQUENCE = {
        'year1-fall': ['DESN 100', 'DESN 216'],
        'year1-winter': ['DESN 200', 'DESN 243'],
        'year1-spring': ['DESN 263', 'DESN 214', 'DESN 215'],
        'year2-fall': ['DESN 301', 'DESN 326', 'DESN 368'],
        'year2-winter': ['DESN 338', 'DESN 355', 'DESN 369'],
        'year2-spring': ['DESN 359', 'DESN 348', 'DESN 374'],
        'year3-fall': ['DESN 336', 'DESN 378', 'DESN 343'],
        'year3-winter': ['DESN 365', 'DESN 379', 'DESN 458'],
        'year3-spring': ['DESN 345', 'DESN 366', 'DESN 468'],
        'year4-fall': ['DESN 463', 'DESN 469', 'DESN 480'],
        'year4-winter': ['DESN 490'],
        'year4-spring': ['DESN 490', 'DESN 495']
    };

    // Prerequisite chains
    const PREREQUISITES = {
        'DESN 243': ['DESN 100', 'DESN 216'],
        'DESN 263': ['DESN 100', 'DESN 216'],
        'DESN 301': ['DESN 100'],
        'DESN 326': ['DESN 200', 'DESN 216'],
        'DESN 336': ['DESN 326'],
        'DESN 338': [],
        'DESN 343': ['DESN 243'],
        'DESN 345': ['DESN 301', 'DESN 326'],
        'DESN 348': ['DESN 338'],
        'DESN 355': ['DESN 200', 'DESN 216'],
        'DESN 365': ['DESN 355'],
        'DESN 366': ['DESN 243', 'DESN 263'],
        'DESN 368': ['DESN 216'],
        'DESN 369': ['DESN 216', 'DESN 368'],
        'DESN 374': ['DESN 216'],
        'DESN 378': ['DESN 368'],
        'DESN 379': ['DESN 369'],
        'DESN 401': ['DESN 301'],
        'DESN 446': ['DESN 336', 'DESN 365'],
        'DESN 458': ['DESN 348'],
        'DESN 463': ['DESN 243', 'DESN 263'],
        'DESN 468': ['DESN 378'],
        'DESN 469': ['DESN 379'],
        'DESN 490': ['DESN 368']
    };

    /**
     * Analyze a year's schedule for graduation pathway conflicts
     * @param {Object} scheduleData - Schedule data for all quarters
     * @returns {Object} Analysis results with conflicts and recommendations
     */
    function analyzePathways(scheduleData) {
        const results = {
            conflicts: [],
            warnings: [],
            recommendations: [],
            pathwayHealth: 100,
            quarterAnalysis: {}
        };

        const quarters = ['fall', 'winter', 'spring'];

        quarters.forEach(quarter => {
            const quarterData = scheduleData[quarter] || {};
            results.quarterAnalysis[quarter] = analyzeQuarter(quarterData, quarter);
        });

        // Check prerequisite chain availability
        checkPrerequisiteFlow(scheduleData, results);

        // Check required course availability
        checkRequiredCourses(scheduleData, results);

        // Check time slot conflicts for common pathways
        checkPathwayConflicts(scheduleData, results);

        // Check minor completability
        checkMinorPaths(scheduleData, results);

        // Calculate overall pathway health
        results.pathwayHealth = calculatePathwayHealth(results);

        return results;
    }

    /**
     * Analyze a single quarter's offerings
     */
    function analyzeQuarter(quarterData, quarterName) {
        const courses = extractCourses(quarterData);
        const analysis = {
            courseCount: courses.length,
            byLevel: {
                100: courses.filter(c => getCourseLevel(c) === 100),
                200: courses.filter(c => getCourseLevel(c) === 200),
                300: courses.filter(c => getCourseLevel(c) === 300),
                400: courses.filter(c => getCourseLevel(c) === 400)
            },
            requiredOffered: [],
            missingRequired: [],
            timeSlotUsage: {}
        };

        // Check which required courses are offered
        DEGREE_REQUIREMENTS.requiredCourses.forEach(req => {
            if (courses.includes(req.code)) {
                analysis.requiredOffered.push(req.code);
            }
        });

        // Analyze time slot distribution
        Object.entries(quarterData).forEach(([day, times]) => {
            Object.entries(times || {}).forEach(([time, slots]) => {
                const key = `${day} ${time}`;
                analysis.timeSlotUsage[key] = (slots || []).length;
            });
        });

        return analysis;
    }

    /**
     * Extract course codes from schedule data
     */
    function extractCourses(quarterData) {
        const courses = [];
        Object.values(quarterData).forEach(dayData => {
            Object.values(dayData || {}).forEach(timeSlot => {
                (timeSlot || []).forEach(course => {
                    if (course.code && !courses.includes(course.code)) {
                        courses.push(course.code);
                    }
                });
            });
        });
        return courses;
    }

    /**
     * Get course level from code
     */
    function getCourseLevel(courseCode) {
        const match = courseCode.match(/\d+/);
        if (match) {
            const num = parseInt(match[0]);
            return Math.floor(num / 100) * 100;
        }
        return 0;
    }

    /**
     * Check prerequisite flow across quarters
     */
    function checkPrerequisiteFlow(scheduleData, results) {
        const quarterOrder = ['fall', 'winter', 'spring'];

        // Key sequences that must flow correctly
        const criticalSequences = [
            ['DESN 216', 'DESN 368', 'DESN 490'],
            ['DESN 338', 'DESN 348', 'DESN 458'],
            ['DESN 326', 'DESN 336', 'DESN 446'],
            ['DESN 355', 'DESN 365', 'DESN 446'],
            ['DESN 368', 'DESN 369', 'DESN 379', 'DESN 469'],
            ['DESN 100', 'DESN 301', 'DESN 345']
        ];

        criticalSequences.forEach(sequence => {
            const availability = sequence.map(course => {
                for (const quarter of quarterOrder) {
                    const courses = extractCourses(scheduleData[quarter] || {});
                    if (courses.includes(course)) {
                        return { course, quarter, index: quarterOrder.indexOf(quarter) };
                    }
                }
                return { course, quarter: null, index: -1 };
            });

            // Check for broken sequences
            for (let i = 1; i < availability.length; i++) {
                const prev = availability[i - 1];
                const curr = availability[i];

                if (prev.quarter && curr.quarter && curr.index <= prev.index) {
                    results.conflicts.push({
                        type: 'prerequisite_order',
                        severity: 'critical',
                        title: 'Prerequisite Sequence Broken',
                        description: `${curr.course} is offered in ${curr.quarter} but its prerequisite ${prev.course} is in ${prev.quarter} (same or later quarter)`,
                        courses: [prev.course, curr.course],
                        recommendation: `Move ${curr.course} to a later quarter or ${prev.course} to an earlier quarter`
                    });
                }

                if (!prev.quarter && curr.quarter) {
                    results.warnings.push({
                        type: 'missing_prerequisite',
                        severity: 'warning',
                        title: 'Missing Prerequisite',
                        description: `${curr.course} is offered but ${prev.course} is not scheduled this year`,
                        courses: [prev.course, curr.course],
                        recommendation: `Consider adding ${prev.course} to enable students to take ${curr.course}`
                    });
                }
            }
        });
    }

    /**
     * Check if required courses are offered appropriately
     */
    function checkRequiredCourses(scheduleData, results) {
        const allCourses = [];
        ['fall', 'winter', 'spring'].forEach(quarter => {
            allCourses.push(...extractCourses(scheduleData[quarter] || {}));
        });

        const uniqueCourses = [...new Set(allCourses)];

        // Critical required courses that must be offered
        const criticalRequired = ['DESN 216', 'DESN 368', 'DESN 490'];

        criticalRequired.forEach(code => {
            if (!uniqueCourses.includes(code)) {
                results.conflicts.push({
                    type: 'missing_required',
                    severity: 'critical',
                    title: 'Critical Course Not Offered',
                    description: `${code} is required for graduation and must be offered at least once per year`,
                    courses: [code],
                    recommendation: `Add ${code} to the schedule - this is a graduation requirement`
                });
            }
        });

        // Check other required courses
        DEGREE_REQUIREMENTS.requiredCourses.forEach(req => {
            if (!criticalRequired.includes(req.code) && !uniqueCourses.includes(req.code)) {
                results.warnings.push({
                    type: 'missing_required',
                    severity: 'warning',
                    title: 'Required Course Not Offered',
                    description: `${req.code} (${req.title}) is a required course not currently scheduled`,
                    courses: [req.code],
                    recommendation: `Consider adding ${req.code} - students need this to graduate`
                });
            }
        });
    }

    /**
     * Check for time conflicts in common course combinations
     */
    function checkPathwayConflicts(scheduleData, results) {
        // Common course combinations students take together
        const commonPairs = [
            ['DESN 216', 'DESN 200'],  // Freshman year
            ['DESN 243', 'DESN 263'],  // Sophomore year
            ['DESN 326', 'DESN 355'],  // Animation track
            ['DESN 338', 'DESN 368'],  // UX + Code
            ['DESN 348', 'DESN 378'],  // UX 2 + Code 2
            ['DESN 336', 'DESN 365'],  // Animation paths
            ['DESN 463', 'DESN 480'],  // Senior year
        ];

        ['fall', 'winter', 'spring'].forEach(quarter => {
            const quarterData = scheduleData[quarter] || {};

            commonPairs.forEach(([course1, course2]) => {
                const slot1 = findCourseSlot(quarterData, course1);
                const slot2 = findCourseSlot(quarterData, course2);

                if (slot1 && slot2 && slot1.day === slot2.day && slot1.time === slot2.time) {
                    results.warnings.push({
                        type: 'pathway_conflict',
                        severity: 'warning',
                        title: 'Common Pathway Conflict',
                        description: `${course1} and ${course2} are scheduled at the same time (${slot1.day} ${slot1.time}) in ${quarter}. Students often take these together.`,
                        courses: [course1, course2],
                        quarter: quarter,
                        recommendation: `Move one course to a different time slot to allow students to take both`
                    });
                }
            });
        });
    }

    /**
     * Find what time slot a course is in
     */
    function findCourseSlot(quarterData, courseCode) {
        for (const [day, times] of Object.entries(quarterData)) {
            for (const [time, courses] of Object.entries(times || {})) {
                if ((courses || []).some(c => c.code === courseCode)) {
                    return { day, time };
                }
            }
        }
        return null;
    }

    /**
     * Check if students can complete each minor
     */
    function checkMinorPaths(scheduleData, results) {
        const allCourses = [];
        ['fall', 'winter', 'spring'].forEach(quarter => {
            allCourses.push(...extractCourses(scheduleData[quarter] || {}));
        });
        const uniqueCourses = [...new Set(allCourses)];

        Object.entries(MINORS).forEach(([key, minor]) => {
            const offered = minor.courses.filter(c => uniqueCourses.includes(c));
            const missing = minor.courses.filter(c => !uniqueCourses.includes(c));
            const coverage = (offered.length / minor.courses.length) * 100;

            if (coverage < 50) {
                results.warnings.push({
                    type: 'minor_incomplete',
                    severity: 'info',
                    title: `${minor.name} Minor Gap`,
                    description: `Only ${Math.round(coverage)}% of ${minor.name} courses are offered this year`,
                    courses: missing,
                    recommendation: `Consider adding: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '...' : ''}`
                });
            }
        });
    }

    /**
     * Calculate overall pathway health score
     */
    function calculatePathwayHealth(results) {
        let score = 100;

        // Deduct for critical conflicts
        score -= results.conflicts.length * 15;

        // Deduct for warnings
        score -= results.warnings.length * 5;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Generate optimal schedule recommendations
     */
    function generateRecommendations(scheduleData) {
        const recommendations = [];
        const analysis = analyzePathways(scheduleData);

        // Priority 1: Fix critical prerequisite issues
        analysis.conflicts
            .filter(c => c.type === 'prerequisite_order')
            .forEach(conflict => {
                recommendations.push({
                    priority: 'critical',
                    action: 'reorder',
                    ...conflict
                });
            });

        // Priority 2: Add missing required courses
        analysis.conflicts
            .filter(c => c.type === 'missing_required')
            .forEach(conflict => {
                recommendations.push({
                    priority: 'critical',
                    action: 'add_course',
                    ...conflict
                });
            });

        // Priority 3: Resolve pathway conflicts
        analysis.warnings
            .filter(w => w.type === 'pathway_conflict')
            .forEach(warning => {
                recommendations.push({
                    priority: 'high',
                    action: 'reschedule',
                    ...warning
                });
            });

        // Sort by priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        return recommendations;
    }

    /**
     * Get optimal time slots for a course to minimize conflicts
     */
    function getOptimalSlots(scheduleData, courseCode, quarter) {
        const quarterData = scheduleData[quarter] || {};
        const slots = [];
        const days = ['MW', 'TR'];
        const times = ['10:00-12:00', '13:00-15:00', '16:00-18:00'];

        // Find common pairings for this course
        const commonPairs = getCommonPairings(courseCode);

        days.forEach(day => {
            times.forEach(time => {
                const existing = ((quarterData[day] || {})[time] || []).map(c => c.code);

                // Check if any common pairing is in this slot
                const hasConflict = commonPairs.some(pair => existing.includes(pair));

                // Count upper-division courses in slot
                const upperDivCount = existing.filter(c => getCourseLevel(c) >= 300).length;

                slots.push({
                    day,
                    time,
                    hasConflict,
                    upperDivCount,
                    score: calculateSlotScore(hasConflict, upperDivCount, time)
                });
            });
        });

        return slots.sort((a, b) => b.score - a.score);
    }

    /**
     * Get courses commonly taken with this one
     */
    function getCommonPairings(courseCode) {
        const pairings = {
            'DESN 216': ['DESN 200', 'DESN 100'],
            'DESN 243': ['DESN 263'],
            'DESN 263': ['DESN 243'],
            'DESN 326': ['DESN 355', 'DESN 301'],
            'DESN 336': ['DESN 365'],
            'DESN 338': ['DESN 368'],
            'DESN 348': ['DESN 378'],
            'DESN 355': ['DESN 326'],
            'DESN 365': ['DESN 336'],
            'DESN 368': ['DESN 338'],
            'DESN 378': ['DESN 348'],
            'DESN 463': ['DESN 480'],
            'DESN 480': ['DESN 463']
        };
        return pairings[courseCode] || [];
    }

    /**
     * Calculate score for a time slot (higher is better)
     */
    function calculateSlotScore(hasConflict, upperDivCount, time) {
        let score = 100;

        if (hasConflict) score -= 50;
        if (upperDivCount >= 2) score -= 20;
        if (upperDivCount >= 3) score -= 30;

        // Prefer morning/afternoon over evening
        if (time === '16:00-18:00') score -= 10;

        return score;
    }

    // Public API
    return {
        analyzePathways,
        generateRecommendations,
        getOptimalSlots,
        DEGREE_REQUIREMENTS,
        MINORS,
        PREREQUISITES
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GraduationOptimizer;
}
