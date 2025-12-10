/**
 * Schedule Evaluator
 * Builds prompts for Claude analysis and parses responses
 */

const ScheduleEvaluator = (function() {

    /**
     * Build a comprehensive prompt for schedule analysis
     */
    function buildPrompt(scheduleData, facultyData, coursesData, options = {}) {
        const { quarter = 'all', includeWorkload = true } = options;

        // Flatten schedule data for readability
        const scheduleText = formatScheduleForPrompt(scheduleData, quarter);
        const constraintsText = getConstraintsText();
        const facultyText = formatFacultyForPrompt(facultyData);
        const coursesText = formatCoursesForPrompt(coursesData);

        const prompt = `You are an expert university course scheduling assistant for Eastern Washington University's Design program. Analyze the following schedule and provide detailed feedback.

## CURRENT SCHEDULE
${scheduleText}

## SCHEDULING CONSTRAINTS
${constraintsText}

## FACULTY INFORMATION
${facultyText}

## COURSE PREFERENCES
${coursesText}

## YOUR TASK
Analyze this schedule thoroughly and return a JSON response with the following structure:

{
  "summary": {
    "healthScore": <number 0-100>,
    "totalConflicts": <number>,
    "totalOptimizations": <number>,
    "overallAssessment": "<brief summary>"
  },
  "conflicts": [
    {
      "id": "<unique-id>",
      "severity": "critical" | "high" | "medium" | "low",
      "type": "room" | "faculty" | "time" | "curriculum" | "safety",
      "title": "<short title>",
      "description": "<detailed description>",
      "affectedCourses": ["DESN XXX", ...],
      "suggestion": {
        "action": "<what to do>",
        "details": "<specific steps>",
        "automatable": true | false
      }
    }
  ],
  "optimizations": [
    {
      "id": "<unique-id>",
      "priority": "high" | "medium" | "low",
      "type": "room" | "balance" | "efficiency" | "enrollment",
      "title": "<short title>",
      "description": "<detailed description>",
      "suggestion": {
        "action": "<what to do>",
        "details": "<specific steps>",
        "automatable": true | false
      }
    }
  ],
  "workload": {
    "balanced": true | false,
    "issues": [
      {
        "faculty": "<name>",
        "currentCredits": <number>,
        "targetCredits": <number>,
        "status": "overloaded" | "underloaded" | "optimal",
        "recommendation": "<what to adjust>"
      }
    ]
  },
  "capacityAnalysis": {
    "oversubscribed": ["<courses with high demand>"],
    "undersubscribed": ["<courses with low enrollment>"],
    "recommendations": ["<suggestions>"]
  }
}

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks
- Be specific with course codes (e.g., "DESN 311" not just "UX course")
- For automatable suggestions, describe the exact move (e.g., "Move DESN 263 from MW 10:00 Room 206 to MW 10:00 Room 209")
- Consider prerequisite chains when suggesting schedule changes
- Prioritize safety issues (evening classes need 2+ instructors)`;

        return prompt;
    }

    /**
     * Format schedule data for the prompt
     */
    function formatScheduleForPrompt(scheduleData, quarter) {
        if (!scheduleData) return 'No schedule data available';

        let text = '';
        const quarters = quarter === 'all'
            ? ['Fall', 'Winter', 'Spring']
            : [quarter];

        for (const q of quarters) {
            const quarterData = scheduleData[q];
            if (!quarterData?.assignedCourses) continue;

            text += `\n### ${q} Quarter\n`;

            // Group by day/time for readability
            const bySlot = {};
            for (const [key, courses] of Object.entries(quarterData.assignedCourses)) {
                if (key === 'unassigned') {
                    text += `\nUNASSIGNED COURSES:\n`;
                    courses.forEach(c => {
                        text += `- ${c.courseCode} (${c.facultyName || 'TBD'})\n`;
                    });
                    continue;
                }

                const [day, time, room] = key.split('-');
                const slotKey = `${day} ${time}`;
                if (!bySlot[slotKey]) bySlot[slotKey] = [];

                courses.forEach(course => {
                    bySlot[slotKey].push({
                        ...course,
                        room,
                        day,
                        time
                    });
                });
            }

            // Output in readable format
            for (const [slot, courses] of Object.entries(bySlot).sort()) {
                text += `\n${slot}:\n`;
                courses.forEach(c => {
                    text += `  - ${c.courseCode}-${c.section} | ${c.courseTitle} | Room ${c.room} | ${c.facultyName || 'TBD'} | Predicted: ${c.predictedDemand || '?'}\n`;
                });
            }
        }

        return text || 'No courses scheduled';
    }

    /**
     * Get scheduling constraints text
     */
    function getConstraintsText() {
        return `
- Room 212 (Project Lab): ONLY for DESN 301, DESN 359, DESN 401. Other courses may use as overflow only if CEB rooms are full.
- CEB 102, CEB 104 (Cheney Campus): Preferred for DESN 100, DESN 200, DESN 216 (freshman/sophomore courses). NO evening classes.
- Room 207 (Media Lab): Not used for scheduled courses
- Faculty Travel: Cannot teach back-to-back at different campuses (30+ minute travel between Cheney and Spokane)
- Evening Safety: At least 2 instructors must be present for evening classes (after 4pm) on the same day
- ITGS Courses: Cheney campus only, no evening classes
- Time Slots: Morning (10:00-12:20), Afternoon (1:00-3:20), Evening (4:00-6:20)
- Day Patterns: MW (Monday/Wednesday), TR (Tuesday/Thursday)
- Case-by-case courses (not grid-scheduled): DESN 495 (Internship), DESN 491 (Practicum), DESN 499 (Independent Study), DESN 399 (Directed Study)`;
    }

    /**
     * Format faculty data for prompt
     */
    function formatFacultyForPrompt(facultyData) {
        if (!facultyData) return 'No faculty data available';

        let text = '';

        // Handle different faculty data formats
        if (facultyData.fullTime) {
            text += 'Full-Time Faculty:\n';
            for (const [name, data] of Object.entries(facultyData.fullTime)) {
                const credits = data.totalCredits || data.courses?.reduce((sum, c) => sum + (c.credits || 0), 0) || 0;
                text += `- ${name}: ${credits} credits\n`;
            }
        }

        if (facultyData.adjunct) {
            text += '\nAdjunct Faculty:\n';
            for (const [name, data] of Object.entries(facultyData.adjunct)) {
                const credits = data.totalCredits || data.courses?.reduce((sum, c) => sum + (c.credits || 0), 0) || 0;
                text += `- ${name}: ${credits} credits\n`;
            }
        }

        return text || 'No faculty data available';
    }

    /**
     * Format courses data for prompt
     */
    function formatCoursesForPrompt(coursesData) {
        if (!coursesData || !Array.isArray(coursesData) || coursesData.length === 0) {
            return 'No course preferences configured';
        }

        let text = 'Course Preferences:\n';

        coursesData.forEach(course => {
            const prefs = [];

            if (course.preferred_times?.length) {
                prefs.push(`Times: ${course.preferred_times.join(', ')}`);
            }
            if (course.preferred_days?.length) {
                prefs.push(`Days: ${course.preferred_days.join(', ')}`);
            }
            if (course.allowed_campus) {
                prefs.push(`Campus: ${course.allowed_campus}`);
            }
            if (course.allowed_rooms?.length) {
                prefs.push(`Rooms: ${course.allowed_rooms.join(', ')}`);
            }
            if (course.is_case_by_case) {
                prefs.push('Case-by-case');
            }

            if (prefs.length > 0) {
                text += `- ${course.code}: ${prefs.join(' | ')}\n`;
            }
        });

        return text;
    }

    /**
     * Parse Claude's response into structured data
     */
    function parseResponse(response) {
        if (!response?.text) {
            throw new Error('Invalid response format');
        }

        let jsonText = response.text.trim();

        // Remove markdown code blocks if present
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.slice(7);
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.slice(3);
        }
        if (jsonText.endsWith('```')) {
            jsonText = jsonText.slice(0, -3);
        }

        try {
            const data = JSON.parse(jsonText.trim());

            // Validate required fields
            if (!data.summary || !data.conflicts || !data.optimizations) {
                throw new Error('Missing required fields in response');
            }

            return {
                success: true,
                data: {
                    summary: data.summary,
                    conflicts: data.conflicts || [],
                    optimizations: data.optimizations || [],
                    workload: data.workload || { balanced: true, issues: [] },
                    capacityAnalysis: data.capacityAnalysis || { oversubscribed: [], undersubscribed: [], recommendations: [] }
                },
                usage: response.usage
            };

        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Raw response:', jsonText);

            // Try to extract useful information from non-JSON response
            return {
                success: false,
                error: 'Failed to parse AI response as JSON',
                rawText: response.text,
                usage: response.usage
            };
        }
    }

    /**
     * Format results for display in the UI
     */
    function formatResults(parsedData) {
        if (!parsedData.success) {
            return {
                error: true,
                message: parsedData.error,
                rawText: parsedData.rawText
            };
        }

        const { data } = parsedData;

        return {
            error: false,
            healthScore: data.summary.healthScore,
            overallAssessment: data.summary.overallAssessment,
            sections: [
                {
                    id: 'conflicts',
                    title: 'Conflicts',
                    icon: '🔴',
                    count: data.conflicts.length,
                    items: data.conflicts.map(c => ({
                        id: c.id,
                        severity: c.severity,
                        type: c.type,
                        title: c.title,
                        description: c.description,
                        suggestion: c.suggestion,
                        affectedCourses: c.affectedCourses
                    }))
                },
                {
                    id: 'optimizations',
                    title: 'Optimizations',
                    icon: '🟡',
                    count: data.optimizations.length,
                    items: data.optimizations.map(o => ({
                        id: o.id,
                        priority: o.priority,
                        type: o.type,
                        title: o.title,
                        description: o.description,
                        suggestion: o.suggestion
                    }))
                },
                {
                    id: 'workload',
                    title: 'Workload',
                    icon: '🟢',
                    count: data.workload.issues?.length || 0,
                    balanced: data.workload.balanced,
                    items: (data.workload.issues || []).map(w => ({
                        faculty: w.faculty,
                        currentCredits: w.currentCredits,
                        targetCredits: w.targetCredits,
                        status: w.status,
                        recommendation: w.recommendation
                    }))
                }
            ],
            capacityAnalysis: data.capacityAnalysis
        };
    }

    /**
     * Get severity color class
     */
    function getSeverityClass(severity) {
        const classes = {
            critical: 'severity-critical',
            high: 'severity-high',
            medium: 'severity-medium',
            low: 'severity-low'
        };
        return classes[severity] || 'severity-medium';
    }

    /**
     * Get priority color class
     */
    function getPriorityClass(priority) {
        const classes = {
            high: 'priority-high',
            medium: 'priority-medium',
            low: 'priority-low'
        };
        return classes[priority] || 'priority-medium';
    }

    // Public API
    return {
        buildPrompt,
        parseResponse,
        formatResults,
        getSeverityClass,
        getPriorityClass
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScheduleEvaluator;
}
