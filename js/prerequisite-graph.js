/**
 * Prerequisite Graph Module
 * Manages course dependency relationships and flow analysis
 */

const PrerequisiteGraph = (function() {
    'use strict';

    let graphData = null;
    let enrollmentData = null;

    /**
     * Initialize the prerequisite graph with data
     */
    async function init(options = {}) {
        const graphPath = options.graphPath || 'data/prerequisite-graph.json';
        const enrollmentPath = options.enrollmentPath || 'enrollment-dashboard-data.json';

        try {
            // Load prerequisite graph
            const graphResponse = await fetch(graphPath);
            if (!graphResponse.ok) throw new Error('Failed to load prerequisite graph');
            graphData = await graphResponse.json();

            // Load enrollment data
            const enrollmentResponse = await fetch(enrollmentPath);
            if (!enrollmentResponse.ok) throw new Error('Failed to load enrollment data');
            const enrollmentJson = await enrollmentResponse.json();
            enrollmentData = enrollmentJson.courseStats || {};

            console.log('PrerequisiteGraph initialized');
            console.log(`  Courses: ${Object.keys(graphData.courses).length}`);
            console.log(`  Tracks: ${Object.keys(graphData.tracks).length}`);

            return { success: true };
        } catch (error) {
            console.error('PrerequisiteGraph init error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get course information
     */
    function getCourse(courseCode) {
        const normalizedCode = normalizeCode(courseCode);
        return graphData?.courses?.[normalizedCode] || null;
    }

    /**
     * Normalize course code (DESN 216 -> DESN-216)
     */
    function normalizeCode(code) {
        return code.replace(/\s+/g, '-').toUpperCase();
    }

    /**
     * Get all prerequisites for a course (direct only)
     */
    function getPrerequisites(courseCode) {
        const course = getCourse(courseCode);
        return course?.prerequisites || [];
    }

    /**
     * Get all prerequisites recursively (full dependency chain)
     */
    function getAllPrerequisites(courseCode, visited = new Set()) {
        const prerequisites = [];
        const direct = getPrerequisites(courseCode);

        direct.forEach(prereqCode => {
            if (!visited.has(prereqCode)) {
                visited.add(prereqCode);
                prerequisites.push(prereqCode);
                // Recursively get prerequisites of prerequisites
                const nested = getAllPrerequisites(prereqCode, visited);
                prerequisites.push(...nested);
            }
        });

        return prerequisites;
    }

    /**
     * Get courses that this course unlocks
     */
    function getUnlockedCourses(courseCode) {
        const course = getCourse(courseCode);
        return course?.unlocks || [];
    }

    /**
     * Get all downstream courses (full dependency chain)
     */
    function getAllDownstream(courseCode, visited = new Set()) {
        const downstream = [];
        const direct = getUnlockedCourses(courseCode);

        direct.forEach(code => {
            if (!visited.has(code)) {
                visited.add(code);
                downstream.push(code);
                const nested = getAllDownstream(code, visited);
                downstream.push(...nested);
            }
        });

        return downstream;
    }

    /**
     * Check if a course is a critical gatekeeper
     */
    function isCriticalGatekeeper(courseCode) {
        const course = getCourse(courseCode);
        return course?.isCriticalGatekeeper || false;
    }

    /**
     * Get all critical gatekeepers
     */
    function getCriticalGatekeepers() {
        return graphData?.criticalGatekeepers || [];
    }

    /**
     * Get flow rate from one course to another
     */
    function getFlowRate(fromCourse, toCourse) {
        const fromCode = normalizeCode(fromCourse);
        const toCode = normalizeCode(toCourse);
        const flowKey = `to_${toCode}`;

        return graphData?.flowRates?.[fromCode]?.[flowKey] || null;
    }

    /**
     * Get all flow rates from a course
     */
    function getOutgoingFlowRates(courseCode) {
        const code = normalizeCode(courseCode);
        const rates = graphData?.flowRates?.[code] || {};
        const result = {};

        Object.entries(rates).forEach(([key, rate]) => {
            // Convert "to_DESN-368" -> "DESN-368"
            const targetCode = key.replace('to_', '');
            result[targetCode] = rate;
        });

        return result;
    }

    /**
     * Get track information
     */
    function getTrack(trackKey) {
        return graphData?.tracks?.[trackKey] || null;
    }

    /**
     * Get all tracks
     */
    function getAllTracks() {
        return graphData?.tracks || {};
    }

    /**
     * Get tracks that include a specific course
     */
    function getTracksForCourse(courseCode) {
        const course = getCourse(courseCode);
        return course?.tracks || [];
    }

    /**
     * Get enrollment data for a course
     */
    function getEnrollment(courseCode) {
        // Try both formats: "DESN 216" and "DESN-216"
        const spaceCode = courseCode.replace(/-/g, ' ');
        const dashCode = courseCode.replace(/\s+/g, '-');

        return enrollmentData?.[spaceCode] || enrollmentData?.[dashCode] || null;
    }

    /**
     * Get quarterly enrollment for a specific quarter
     */
    function getQuarterlyEnrollment(courseCode, quarter) {
        const enrollment = getEnrollment(courseCode);
        if (!enrollment?.quarterly) return null;
        return enrollment.quarterly[quarter] || null;
    }

    /**
     * Calculate the pipeline (students expected from prerequisites)
     */
    function calculatePipeline(courseCode, referenceQuarter = null) {
        const prerequisites = getPrerequisites(courseCode);
        if (prerequisites.length === 0) return null;

        const pipeline = {
            total: 0,
            sources: []
        };

        prerequisites.forEach(prereqCode => {
            const flowRate = getFlowRate(prereqCode, courseCode) || 0.5; // Default 50%
            const enrollment = getEnrollment(prereqCode);

            let sourceEnrollment = enrollment?.average || 0;

            // If reference quarter provided, use that quarter's data from previous year
            if (referenceQuarter && enrollment?.quarterly) {
                const quarterData = enrollment.quarterly[referenceQuarter];
                if (quarterData) {
                    sourceEnrollment = typeof quarterData === 'object'
                        ? quarterData.total
                        : quarterData;
                }
            }

            const expectedFromPrereq = Math.round(sourceEnrollment * flowRate);

            pipeline.sources.push({
                course: prereqCode,
                enrollment: sourceEnrollment,
                flowRate: flowRate,
                expected: expectedFromPrereq
            });

            pipeline.total += expectedFromPrereq;
        });

        return pipeline;
    }

    /**
     * Get course level (100, 200, 300, 400)
     */
    function getCourseLevel(courseCode) {
        const course = getCourse(courseCode);
        return course?.level || parseInt(courseCode.match(/\d+/)?.[0]?.charAt(0) + '00') || 0;
    }

    /**
     * Get all courses at a specific level
     */
    function getCoursesAtLevel(level) {
        if (!graphData?.courses) return [];

        return Object.entries(graphData.courses)
            .filter(([code, course]) => course.level === level)
            .map(([code, course]) => ({ code, ...course }));
    }

    /**
     * Check if course has standing requirement
     */
    function getStandingRequirement(courseCode) {
        const course = getCourse(courseCode);
        return course?.standingRequired || null;
    }

    /**
     * Get the complete course catalog from the graph
     */
    function getAllCourses() {
        if (!graphData?.courses) return [];

        return Object.entries(graphData.courses).map(([code, course]) => ({
            code,
            ...course
        }));
    }

    /**
     * Find common pathways (frequently taken course sequences)
     */
    function getTrackSequences(trackKey) {
        const track = getTrack(trackKey);
        return track?.sequences || [];
    }

    /**
     * Calculate course bottleneck score
     * Higher score = more courses depend on this one
     */
    function getBottleneckScore(courseCode) {
        const downstream = getAllDownstream(courseCode);
        const course = getCourse(courseCode);

        let score = downstream.length;

        // Bonus for being explicitly marked as critical
        if (course?.isCriticalGatekeeper) {
            score += 5;
        }

        // Bonus for unlocking senior capstone path
        if (downstream.includes('DESN-490')) {
            score += 3;
        }

        return score;
    }

    // Public API
    return {
        init,
        getCourse,
        getPrerequisites,
        getAllPrerequisites,
        getUnlockedCourses,
        getAllDownstream,
        isCriticalGatekeeper,
        getCriticalGatekeepers,
        getFlowRate,
        getOutgoingFlowRates,
        getTrack,
        getAllTracks,
        getTracksForCourse,
        getEnrollment,
        getQuarterlyEnrollment,
        calculatePipeline,
        getCourseLevel,
        getCoursesAtLevel,
        getStandingRequirement,
        getAllCourses,
        getTrackSequences,
        getBottleneckScore,
        normalizeCode
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PrerequisiteGraph;
}
