/**
 * Conflict Engine
 * Evaluates schedules against database-driven constraints
 */

const ConflictEngine = (function() {

    // Courses that are exempt from upper-division conflict rules
    // DESN 374 (AI + Design) is open to all levels
    const UPPER_DIV_EXEMPT = ['DESN 374'];

    // Available rooms for resolution calculations
    const ROOMS = ['206', '207', '208', '209', '210', '212'];
    const TIME_SLOTS = ['10:00-12:00', '13:00-15:00', '16:00-18:00'];
    const DAY_PATTERNS = ['MW', 'TR'];

    /**
     * Evaluate a schedule against all enabled constraints
     * @param {Array} schedule - Array of course objects from getCurrentScheduleData()
     * @param {Array} constraints - Array of constraint objects from ConstraintsService
     * @returns {Object} { conflicts: [], warnings: [], suggestions: [] }
     */
    function evaluate(schedule, constraints) {
        const results = {
            conflicts: [],
            warnings: [],
            suggestions: [],
            summary: {
                totalIssues: 0,
                criticalCount: 0,
                warningCount: 0
            }
        };

        if (!schedule || schedule.length === 0) {
            return results;
        }

        // Run each enabled constraint checker
        constraints.filter(c => c.enabled).forEach(constraint => {
            const checker = checkers[constraint.constraint_type];
            if (checker) {
                const issues = checker(schedule, constraint.rule_details, constraint);
                issues.forEach(issue => {
                    issue.constraintId = constraint.id;
                    issue.constraintType = constraint.constraint_type;

                    if (issue.severity === 'critical') {
                        results.conflicts.push(issue);
                        results.summary.criticalCount++;
                    } else if (issue.severity === 'warning') {
                        results.warnings.push(issue);
                        results.summary.warningCount++;
                    } else {
                        results.suggestions.push(issue);
                    }
                });
            }
        });

        results.summary.totalIssues = results.conflicts.length + results.warnings.length;
        return results;
    }

    /**
     * Constraint checker functions
     */
    const checkers = {

        /**
         * Room restriction - check if courses are in allowed rooms
         */
        room_restriction: function(schedule, rule, constraint) {
            const issues = [];
            const roomCourses = schedule.filter(c => c.room === rule.room);

            roomCourses.forEach(course => {
                // Check against allowed_courses (strict)
                if (rule.allowed_courses && !rule.allowed_courses.includes(course.code)) {
                    issues.push({
                        severity: rule.severity || 'warning',
                        title: `Room ${rule.room} Restriction`,
                        description: rule.message || `${course.code} is scheduled in Room ${rule.room}, which is reserved for specific courses`,
                        courses: [course],
                        suggestion: `Consider moving ${course.code} to a different room`,
                        resolutions: calculateRoomResolutions(schedule, course)
                    });
                }
                // Check against preferred_courses (soft recommendation)
                else if (rule.preferred_courses && !rule.preferred_courses.includes(course.code)) {
                    issues.push({
                        severity: 'info',
                        title: `Room ${rule.room} Preference`,
                        description: `${course.code} in Room ${rule.room} - this room is best suited for hands-on courses`,
                        courses: [course],
                        suggestion: `Room ${rule.room} works better for project-based courses`
                    });
                }
            });

            return issues;
        },

        /**
         * Student conflict - too many upper-division courses at same time
         */
        student_conflict: function(schedule, rule, constraint) {
            const issues = [];
            const levelMin = rule.course_level_min || 300;
            const levelMax = rule.course_level_max || 499;
            const maxPerSlot = rule.max_courses_per_slot || 2;

            // Filter to upper-division courses (excluding exempt courses like DESN 374)
            const upperDiv = schedule.filter(c => {
                const num = parseInt(c.code.replace('DESN ', ''));
                return num >= levelMin && num <= levelMax && !UPPER_DIV_EXEMPT.includes(c.code);
            });

            // Group by day+time
            const slots = {};
            upperDiv.forEach(course => {
                if (course.day && course.time) {
                    const key = `${course.day}-${course.time}`;
                    if (!slots[key]) slots[key] = [];
                    slots[key].push(course);
                }
            });

            // Check each slot
            Object.entries(slots).forEach(([key, courses]) => {
                if (courses.length > maxPerSlot) {
                    const [day, time] = key.split('-');
                    const dayName = day === 'MW' ? 'Monday/Wednesday' : day === 'TR' ? 'Tuesday/Thursday' : day;
                    const timeFormatted = formatTime(time);

                    // Get stored preferred resolutions
                    const storedResolutions = rule.preferred_resolutions || [];

                    // Calculate dynamic resolutions
                    const dynamicResolutions = calculateSlotResolutions(schedule, courses[0], day, time);

                    // Merge and sort by impact
                    const allResolutions = [...storedResolutions, ...dynamicResolutions]
                        .slice(0, 4);

                    issues.push({
                        severity: rule.severity || 'critical',
                        type: 'student-conflict',
                        title: `${dayName}, ${timeFormatted}`,
                        description: rule.message || 'Students cannot take multiple upper-division electives simultaneously',
                        courses: courses,
                        studentsAffected: estimateAffectedStudents(courses),
                        currentSlot: `${day} ${time}`,
                        resolutions: allResolutions,
                        suggestion: `Move one of these courses to a different time slot to reduce student scheduling conflicts`
                    });
                }
            });

            return issues;
        },

        /**
         * Faculty double-booking - same instructor, same time, different rooms
         */
        faculty_double_book: function(schedule, rule, constraint) {
            const issues = [];
            const slots = {};

            schedule.forEach(course => {
                if (course.instructor && course.instructor !== 'TBD' && course.day && course.time) {
                    const key = `${course.instructor}-${course.day}-${course.time}`;
                    if (!slots[key]) slots[key] = [];
                    slots[key].push(course);
                }
            });

            Object.entries(slots).forEach(([key, courses]) => {
                if (courses.length > 1) {
                    const rooms = [...new Set(courses.map(c => c.room))];
                    if (rooms.length > 1) {
                        issues.push({
                            severity: rule.severity || 'critical',
                            title: 'Faculty Double-Booking',
                            description: `${courses[0].instructor} is scheduled to teach ${courses.map(c => c.code).join(' and ')} at the same time in different rooms`,
                            courses: courses,
                            suggestion: 'Reassign one course to a different instructor or time',
                            resolutions: calculateTimeResolutions(schedule, courses[0])
                        });
                    }
                }
            });

            return issues;
        },

        /**
         * Room double-booking - multiple courses in same room at same time
         */
        room_double_book: function(schedule, rule, constraint) {
            const issues = [];
            const slots = {};

            schedule.forEach(course => {
                if (course.room && course.day && course.time) {
                    const key = `${course.room}-${course.day}-${course.time}`;
                    if (!slots[key]) slots[key] = [];
                    slots[key].push(course);
                }
            });

            Object.entries(slots).forEach(([key, courses]) => {
                if (courses.length > 1) {
                    issues.push({
                        severity: rule.severity || 'critical',
                        title: 'Room Double-Booking',
                        description: `${courses.map(c => c.code).join(' and ')} are both scheduled in Room ${courses[0].room} on ${courses[0].day} at ${courses[0].time}`,
                        courses: courses,
                        suggestion: 'Move one course to a different room or time slot',
                        resolutions: calculateRoomResolutions(schedule, courses[1])
                    });
                }
            });

            return issues;
        },

        /**
         * Evening safety - minimum instructors for evening classes
         */
        evening_safety: function(schedule, rule, constraint) {
            const issues = [];
            const timeAfter = rule.time_after || '16:00';
            const minInstructors = rule.min_instructors || 2;

            // Find evening classes
            const eveningClasses = schedule.filter(c => {
                if (!c.time) return false;
                const hour = parseInt(c.time.split(':')[0]);
                const threshold = parseInt(timeAfter.split(':')[0]);
                return hour >= threshold;
            });

            // Group by day
            const days = {};
            eveningClasses.forEach(course => {
                if (!days[course.day]) days[course.day] = new Set();
                if (course.instructor && course.instructor !== 'TBD') {
                    days[course.day].add(course.instructor);
                }
            });

            Object.entries(days).forEach(([day, instructors]) => {
                if (instructors.size > 0 && instructors.size < minInstructors) {
                    const dayName = day === 'MW' ? 'Monday/Wednesday' : day === 'TR' ? 'Tuesday/Thursday' : day;
                    issues.push({
                        severity: rule.severity || 'warning',
                        title: 'Evening Safety Concern',
                        description: `Only ${instructors.size} instructor(s) (${[...instructors].join(', ')}) scheduled for evening classes on ${dayName}`,
                        suggestion: `Schedule at least ${minInstructors} instructors for evening safety`,
                        courses: eveningClasses.filter(c => c.day === day)
                    });
                }
            });

            return issues;
        },

        /**
         * Enrollment threshold - flag courses outside normal range
         */
        enrollment_threshold: function(schedule, rule, constraint) {
            // This would need enrollment data passed in
            // For now, return empty - can be enhanced later
            return [];
        },

        /**
         * Campus transition - check for back-to-back classes at different campuses
         */
        campus_transition: function(schedule, rule, constraint) {
            // This would need campus data on courses
            // For now, return empty - can be enhanced later
            return [];
        }
    };

    /**
     * Calculate available room resolutions for a course
     */
    function calculateRoomResolutions(schedule, course) {
        const resolutions = [];
        const usedRooms = schedule
            .filter(c => c.day === course.day && c.time === course.time)
            .map(c => c.room);

        ROOMS.forEach(room => {
            if (!usedRooms.includes(room) && room !== course.room) {
                resolutions.push({
                    action: 'move_room',
                    target_room: room,
                    reason: `Room ${room} is available at this time`
                });
            }
        });

        return resolutions.slice(0, 3);
    }

    /**
     * Calculate available time slot resolutions for moving a course
     */
    function calculateSlotResolutions(schedule, course, currentDay, currentTime) {
        const resolutions = [];

        DAY_PATTERNS.forEach(day => {
            TIME_SLOTS.forEach(time => {
                if (day === currentDay && time === currentTime) return;

                // Count courses in this slot
                const coursesInSlot = schedule.filter(c => c.day === day && c.time === time);
                const usedRooms = coursesInSlot.map(c => c.room);
                const availableRooms = ROOMS.filter(r => !usedRooms.includes(r));

                if (availableRooms.length >= 1) {
                    const dayName = day === 'MW' ? 'Monday/Wednesday' : 'Tuesday/Thursday';
                    resolutions.push({
                        action: 'move_course',
                        target_slot: `${day} ${time}`,
                        dayName: dayName,
                        time: time,
                        availableRooms: availableRooms.length,
                        currentCourses: coursesInSlot.map(c => `${c.code} (${c.room})`).join(', ') || 'None',
                        reason: coursesInSlot.length <= 2 ? 'Minimal impact, plenty of space' : 'Moderate impact'
                    });
                }
            });
        });

        // Sort by available rooms (most available first)
        return resolutions.sort((a, b) => b.availableRooms - a.availableRooms);
    }

    /**
     * Calculate time-based resolutions for a course
     */
    function calculateTimeResolutions(schedule, course) {
        return calculateSlotResolutions(schedule, course, course.day, course.time).slice(0, 4);
    }

    /**
     * Format time for display (24hr to AM/PM)
     */
    function formatTime(time) {
        if (!time) return '';
        
        if (time.includes('-')) {
            const [start, end] = time.split('-');
            return `${formatSingleTime(start)} - ${formatSingleTime(end)}`;
        }
        return formatSingleTime(time);
    }
    
    function formatSingleTime(t) {
        if (!t) return '';
        const match = t.match(/(\d{1,2}):(\d{2})/);
        if (!match) return t;
        
        let hour = parseInt(match[1]);
        const min = match[2];
        const ampm = hour >= 12 ? 'PM' : 'AM';
        
        if (hour > 12) hour -= 12;
        if (hour === 0) hour = 12;
        
        return `${hour}:${min} ${ampm}`;
    }
    
    /**
     * Estimate number of students affected by a conflict
     */
    function estimateAffectedStudents(courses) {
        const uniqueCourses = courses.length;
        if (uniqueCourses >= 4) return 'Very High (15-25 students)';
        if (uniqueCourses >= 3) return 'High (10-20 students)';
        return 'Moderate (5-15 students)';
    }

    // Public API
    return {
        evaluate,
        checkers,
        UPPER_DIV_EXEMPT
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConflictEngine;
}
