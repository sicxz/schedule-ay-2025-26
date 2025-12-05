/**
 * Constraints Engine
 * Centralized constraint validation for scheduling
 * Used by Schedule Builder and Schedule Analyzer
 */

const ConstraintsEngine = (function() {
    'use strict';

    // Store loaded rules from JSON file
    let rules = null;

    // Store course data from database (for course-level constraints)
    let coursesData = [];

    /**
     * Initialize the constraints engine by loading rules
     */
    async function init(rulesPath = '../data/scheduling-rules.json') {
        try {
            const response = await fetch(rulesPath);
            if (!response.ok) throw new Error('Failed to load scheduling rules');
            rules = await response.json();
            console.log('Constraints engine initialized with',
                rules.courseConstraints?.length || 0, 'course constraints,',
                rules.facultyConstraints?.length || 0, 'faculty constraints');
            return true;
        } catch (err) {
            console.error('Error initializing constraints engine:', err);
            return false;
        }
    }

    /**
     * Set course data from database for course-level constraints
     * Call this after loading courses from dbService
     * @param {Array} courses - Array of course objects from database
     */
    function setCoursesData(courses) {
        coursesData = courses || [];
        console.log('Constraints engine loaded', coursesData.length, 'courses with preferences');
    }

    /**
     * Get course data by code
     */
    function getCourseByCode(courseCode) {
        return coursesData.find(c => c.code === courseCode);
    }

    /**
     * Get all loaded rules
     */
    function getRules() {
        return rules;
    }

    /**
     * Get valid rooms for a course based on constraints
     * @param {string} courseCode - The course code (e.g., "DESN 301", "ITGS 110")
     * @param {Object} options - Optional: { slotUsage: {}, checkOverflow: true }
     * @returns {string[]} Array of valid room IDs
     */
    function getValidRooms(courseCode, options = {}) {
        const { slotUsage = {}, checkOverflow = true } = options;

        // FIRST: Check course-level constraints from database
        const course = getCourseByCode(courseCode);
        if (course) {
            // If course has room constraints, use those
            if (course.allowed_rooms && course.allowed_rooms.length > 0) {
                // If hard constraint, only return these rooms
                if (course.room_constraint_hard) {
                    return [...course.allowed_rooms];
                }
                // Soft constraint: prefer these but allow all
                // Return allowed rooms first, then others
                const preferred = [...course.allowed_rooms];
                const others = getAvailableRooms().filter(r => !preferred.includes(r));
                return [...preferred, ...others];
            }

            // If course has campus constraint, filter by campus
            if (course.allowed_campus) {
                const campusRooms = getRoomsForCampus(course.allowed_campus);
                if (course.room_constraint_hard) {
                    return campusRooms;
                }
                // Soft: prefer campus rooms but allow others
                const others = getAvailableRooms().filter(r => !campusRooms.includes(r));
                return [...campusRooms, ...others];
            }
        }

        // FALLBACK: Check JSON file course constraints
        if (rules) {
            for (const constraint of rules.courseConstraints || []) {
                if (!constraint.enabled) continue;

                // Check if this constraint applies to the course
                const matches = constraintMatchesCourse(constraint, courseCode);
                if (!matches) continue;

                // Get room restriction
                if (constraint.roomRestriction) {
                    const allowedRooms = [...constraint.roomRestriction.allowedRooms];

                    // Check overflow rooms
                    if (checkOverflow && constraint.roomRestriction.overflowRooms) {
                        const primaryRoomsFull = arePrimaryRoomsFull(allowedRooms, slotUsage);
                        if (primaryRoomsFull) {
                            allowedRooms.push(...constraint.roomRestriction.overflowRooms);
                        }
                    }

                    return allowedRooms;
                }
            }

            // Check room constraints for course assignments
            for (const roomConstraint of rules.roomConstraints || []) {
                if (roomConstraint.type === 'room-assignment') {
                    if (roomConstraint.allowedCourses?.includes(courseCode)) {
                        return [roomConstraint.room];
                    }
                }
            }
        }

        // Default: return all available rooms (excluding excluded ones)
        return getAvailableRooms();
    }

    /**
     * Get rooms for a specific campus
     */
    function getRoomsForCampus(campusId) {
        if (!rules?.campuses?.[campusId]) {
            // Fallback if no rules loaded
            if (campusId === 'cheney') return ['CEB 102', 'CEB 104'];
            if (campusId === 'catalyst') return ['206', '209', '210', '212'];
            return [];
        }
        return rules.campuses[campusId].rooms || [];
    }

    /**
     * Check if a course matches a constraint
     */
    function constraintMatchesCourse(constraint, courseCode) {
        if (constraint.courses) {
            return constraint.courses.includes(courseCode);
        }
        if (constraint.pattern) {
            return courseCode.startsWith(constraint.pattern);
        }
        return false;
    }

    /**
     * Check if primary rooms are full
     */
    function arePrimaryRoomsFull(rooms, slotUsage) {
        const timeSlots = Object.keys(rules?.timeSlots || {}).length || 3;
        const dayPatterns = Object.keys(rules?.dayPatterns || {}).length || 2;
        const maxSlots = timeSlots * dayPatterns * rooms.length;

        const usedSlots = Object.keys(slotUsage).filter(key =>
            rooms.some(room => key.includes(room))
        ).length;

        return usedSlots >= maxSlots;
    }

    /**
     * Get all available rooms (excluding excluded ones)
     */
    function getAvailableRooms() {
        const excluded = [];
        for (const rc of rules?.roomConstraints || []) {
            if (rc.type === 'exclude-from-grid') {
                excluded.push(rc.room);
            }
        }

        const allRooms = getAllRooms();
        return allRooms.filter(room => !excluded.includes(room));
    }

    /**
     * Get all rooms from all campuses
     */
    function getAllRooms() {
        if (!rules?.campuses) {
            return ['206', '209', '210', '212', 'CEB 102', 'CEB 104'];
        }

        const rooms = [];
        Object.values(rules.campuses).forEach(campus => {
            rooms.push(...(campus.rooms || []));
        });
        return rooms;
    }

    /**
     * Get valid time slots for a course
     * @param {string} courseCode - The course code
     * @returns {string[]} Array of valid time slot IDs (e.g., ['morning', 'afternoon'])
     */
    function getValidTimeSlots(courseCode) {
        const allSlots = ['morning', 'afternoon', 'evening'];

        // FIRST: Check course-level constraints from database
        const course = getCourseByCode(courseCode);
        if (course && course.preferred_times && course.preferred_times.length > 0) {
            // If hard constraint, only return these times
            if (course.time_constraint_hard) {
                return [...course.preferred_times];
            }
            // Soft constraint: return preferred times first, then others
            const preferred = [...course.preferred_times];
            const others = allSlots.filter(t => !preferred.includes(t));
            return [...preferred, ...others];
        }

        // FALLBACK: Check JSON file course constraints
        if (rules) {
            const rulesSlots = Object.keys(rules.timeSlots || {});

            for (const constraint of rules.courseConstraints || []) {
                if (!constraint.enabled) continue;
                if (!constraintMatchesCourse(constraint, courseCode)) continue;

                if (constraint.timeRestriction?.blockedSlots) {
                    return rulesSlots.filter(slot =>
                        !constraint.timeRestriction.blockedSlots.includes(slot)
                    );
                }
            }

            return rulesSlots.length > 0 ? rulesSlots : allSlots;
        }

        return allSlots;
    }

    /**
     * Check if a course can be scheduled in a specific time slot
     */
    function canScheduleInTimeSlot(courseCode, timeSlotId) {
        const validSlots = getValidTimeSlots(courseCode);
        return validSlots.includes(timeSlotId);
    }

    /**
     * Check if a course is case-by-case (not grid scheduled)
     */
    function isCaseByCase(courseCode) {
        // FIRST: Check course-level flag from database
        const course = getCourseByCode(courseCode);
        if (course && course.is_case_by_case) {
            return true;
        }

        // FALLBACK: Check JSON file
        return rules?.caseByCase?.courses?.includes(courseCode) || false;
    }

    /**
     * Get case-by-case courses list
     */
    function getCaseByeCaseCourses() {
        // Combine database courses with JSON file courses
        const dbCaseByCase = coursesData
            .filter(c => c.is_case_by_case)
            .map(c => c.code);
        const jsonCaseByCase = rules?.caseByCase?.courses || [];

        // Return unique list
        return [...new Set([...dbCaseByCase, ...jsonCaseByCase])];
    }

    /**
     * Get course preferences for pre-populating schedule builder forms
     * @param {string} courseCode - The course code
     * @returns {Object} Preferences object with times, days, rooms, campus
     */
    function getCoursePreferences(courseCode) {
        const course = getCourseByCode(courseCode);
        if (!course) {
            return {
                preferredTimes: ['morning', 'afternoon', 'evening'],
                preferredDays: ['MW', 'TR'],
                allowedRooms: null,
                allowedCampus: null,
                quartersOffered: ['Fall', 'Winter', 'Spring'],
                roomConstraintHard: false,
                timeConstraintHard: false,
                isCaseByCase: false
            };
        }

        return {
            preferredTimes: course.preferred_times || ['morning', 'afternoon', 'evening'],
            preferredDays: course.preferred_days || ['MW', 'TR'],
            allowedRooms: course.allowed_rooms || null,
            allowedCampus: course.allowed_campus || null,
            quartersOffered: course.quarters_offered || ['Fall', 'Winter', 'Spring'],
            roomConstraintHard: course.room_constraint_hard || false,
            timeConstraintHard: course.time_constraint_hard || false,
            isCaseByCase: course.is_case_by_case || false
        };
    }

    /**
     * Check faculty constraints for a schedule
     * @param {Object} schedule - Schedule data with faculty assignments
     * @returns {Object[]} Array of constraint violations
     */
    function checkFacultyConstraints(schedule) {
        const violations = [];

        if (!rules?.facultyConstraints) return violations;

        for (const constraint of rules.facultyConstraints) {
            if (!constraint.enabled) continue;

            switch (constraint.rule) {
                case 'no-back-to-back-different-campus':
                    violations.push(...checkCampusTravelConflicts(schedule, constraint));
                    break;
                case 'minimum-instructors-evening':
                    violations.push(...checkEveningSafety(schedule, constraint));
                    break;
            }
        }

        return violations;
    }

    /**
     * Check for campus travel conflicts (back-to-back different campuses)
     */
    function checkCampusTravelConflicts(schedule, constraint) {
        const violations = [];

        // Group assignments by faculty and day
        const facultySchedules = {};

        Object.entries(schedule).forEach(([quarter, quarterData]) => {
            Object.entries(quarterData.assignedCourses || {}).forEach(([slotKey, courses]) => {
                if (slotKey === 'unassigned') return;

                const [day, time, ...roomParts] = slotKey.split('-');
                const room = roomParts.join('-');
                const campus = getCampusForRoom(room);

                courses.forEach(course => {
                    const faculty = course.facultyName;
                    if (!faculty || faculty === 'TBD') return;

                    const key = `${faculty}-${quarter}-${day}`;
                    if (!facultySchedules[key]) facultySchedules[key] = [];
                    facultySchedules[key].push({ time, campus, course: course.courseCode, room });
                });
            });
        });

        // Check each faculty's day schedule for conflicts
        Object.entries(facultySchedules).forEach(([key, assignments]) => {
            if (assignments.length < 2) return;

            // Sort by time
            assignments.sort((a, b) => a.time.localeCompare(b.time));

            // Check consecutive time slots for campus changes
            for (let i = 0; i < assignments.length - 1; i++) {
                const current = assignments[i];
                const next = assignments[i + 1];

                if (current.campus !== next.campus) {
                    const [faculty, quarter, day] = key.split('-');
                    violations.push({
                        id: `travel-${key}-${i}`,
                        type: 'faculty-travel',
                        constraintId: constraint.id,
                        faculty,
                        quarter,
                        day,
                        title: `Campus travel conflict: ${faculty}`,
                        detail: `${faculty} has ${current.course} in ${current.campus} then ${next.course} in ${next.campus} on ${day}`,
                        priority: 'high'
                    });
                }
            }
        });

        return violations;
    }

    /**
     * Check evening safety (minimum instructors)
     */
    function checkEveningSafety(schedule, constraint) {
        const violations = [];
        const afterTime = constraint.afterTime || '16:00';
        const minCount = constraint.minimumCount || 2;

        Object.entries(schedule).forEach(([quarter, quarterData]) => {
            // Group evening courses by day
            const eveningByDay = { 'MW': [], 'TR': [] };

            Object.entries(quarterData.assignedCourses || {}).forEach(([slotKey, courses]) => {
                if (slotKey === 'unassigned') return;

                const [day, time] = slotKey.split('-');
                const isEvening = time >= afterTime.replace(':', '') || time.includes('16:00');

                if (isEvening && eveningByDay[day]) {
                    courses.forEach(course => {
                        if (course.facultyName && course.facultyName !== 'TBD') {
                            eveningByDay[day].push(course.facultyName);
                        }
                    });
                }
            });

            // Check each day
            Object.entries(eveningByDay).forEach(([day, faculty]) => {
                const uniqueFaculty = [...new Set(faculty)];
                if (uniqueFaculty.length > 0 && uniqueFaculty.length < minCount) {
                    violations.push({
                        id: `evening-safety-${quarter}-${day}`,
                        type: 'evening-safety',
                        constraintId: constraint.id,
                        quarter,
                        day,
                        title: `Evening safety: Only ${uniqueFaculty.length} instructor on ${day}`,
                        detail: `${quarter} ${day} evening has ${uniqueFaculty.join(', ')} - need ${minCount}+ instructors for safety`,
                        priority: 'high'
                    });
                }
            });
        });

        return violations;
    }

    /**
     * Get campus for a room
     */
    function getCampusForRoom(roomId) {
        if (!rules?.campuses) {
            return roomId.includes('CEB') ? 'cheney' : 'catalyst';
        }

        for (const [campusId, campus] of Object.entries(rules.campuses)) {
            if (campus.rooms?.includes(roomId)) {
                return campusId;
            }
        }
        return 'unknown';
    }

    /**
     * Validate a course assignment against all constraints
     * @param {string} courseCode
     * @param {string} room
     * @param {string} timeSlot - e.g., 'morning', 'afternoon', 'evening'
     * @returns {Object} { valid: boolean, violations: string[] }
     */
    function validateAssignment(courseCode, room, timeSlot) {
        const violations = [];

        // Check room validity
        const validRooms = getValidRooms(courseCode);
        if (!validRooms.includes(room)) {
            violations.push(`${courseCode} cannot be assigned to ${room}. Valid rooms: ${validRooms.join(', ')}`);
        }

        // Check time slot validity
        const validSlots = getValidTimeSlots(courseCode);
        if (!validSlots.includes(timeSlot)) {
            violations.push(`${courseCode} cannot be scheduled in ${timeSlot}. Valid times: ${validSlots.join(', ')}`);
        }

        // Check if case-by-case
        if (isCaseByCase(courseCode)) {
            violations.push(`${courseCode} is a case-by-case course and should not be grid-scheduled`);
        }

        return {
            valid: violations.length === 0,
            violations
        };
    }

    /**
     * Get time slot info
     */
    function getTimeSlots() {
        return rules?.timeSlots || {
            morning: { start: '10:00', end: '12:20' },
            afternoon: { start: '13:00', end: '15:20' },
            evening: { start: '16:00', end: '18:20' }
        };
    }

    /**
     * Get constraint by ID
     */
    function getConstraintById(id) {
        const allConstraints = [
            ...(rules?.courseConstraints || []),
            ...(rules?.facultyConstraints || []),
            ...(rules?.roomConstraints || [])
        ];
        return allConstraints.find(c => c.id === id);
    }

    /**
     * Update a constraint's enabled state
     */
    function setConstraintEnabled(id, enabled) {
        const constraint = getConstraintById(id);
        if (constraint) {
            constraint.enabled = enabled;
            return true;
        }
        return false;
    }

    // Public API
    return {
        init,
        setCoursesData,
        getCoursePreferences,
        getRules,
        getValidRooms,
        getValidTimeSlots,
        canScheduleInTimeSlot,
        isCaseByCase,
        getCaseByeCaseCourses,
        checkFacultyConstraints,
        validateAssignment,
        getTimeSlots,
        getAvailableRooms,
        getRoomsForCampus,
        getCampusForRoom,
        getConstraintById,
        setConstraintEnabled
    };
})();

// Export for use in browser and Node.js
if (typeof window !== 'undefined') {
    window.ConstraintsEngine = ConstraintsEngine;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConstraintsEngine;
}
