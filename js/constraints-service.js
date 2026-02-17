/**
 * Constraints Service
 * Manages scheduling constraints from Supabase database
 */

const ConstraintsService = (function() {
    // Cache for loaded constraints
    let constraintsCache = null;
    let cacheTimestamp = null;
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Load all constraints from Supabase
     * @param {boolean} forceRefresh - Bypass cache
     * @returns {Promise<Array>} Array of constraint objects
     */
    async function loadConstraints(forceRefresh = false) {
        // Check cache
        if (!forceRefresh && constraintsCache && cacheTimestamp) {
            if (Date.now() - cacheTimestamp < CACHE_TTL) {
                return constraintsCache;
            }
        }

        if (!supabase) {
            console.warn('Supabase not configured, using fallback constraints');
            return getFallbackConstraints();
        }

        try {
            const { data, error } = await supabase
                .from('scheduling_constraints')
                .select('*')
                .order('constraint_type');

            if (error) throw error;

            constraintsCache = data || [];
            cacheTimestamp = Date.now();
            console.log(`Loaded ${constraintsCache.length} constraints from Supabase`);
            return constraintsCache;

        } catch (err) {
            console.error('Failed to load constraints:', err.message);
            return getFallbackConstraints();
        }
    }

    /**
     * Load only enabled constraints
     * @returns {Promise<Array>} Array of enabled constraint objects
     */
    async function loadEnabledConstraints() {
        const all = await loadConstraints();
        return all.filter(c => c.enabled);
    }

    /**
     * Toggle a constraint's enabled state
     * @param {string} id - Constraint UUID
     * @param {boolean} enabled - New enabled state
     * @returns {Promise<boolean>} Success
     */
    async function toggleConstraint(id, enabled) {
        if (!supabase) {
            console.warn('Supabase not configured');
            return false;
        }

        try {
            const { error } = await supabase
                .from('scheduling_constraints')
                .update({ enabled })
                .eq('id', id);

            if (error) throw error;

            // Update cache
            if (constraintsCache) {
                const constraint = constraintsCache.find(c => c.id === id);
                if (constraint) constraint.enabled = enabled;
            }

            console.log(`Constraint ${id} ${enabled ? 'enabled' : 'disabled'}`);
            return true;

        } catch (err) {
            console.error('Failed to toggle constraint:', err.message);
            return false;
        }
    }

    /**
     * Save a new constraint
     * @param {Object} constraint - Constraint object
     * @returns {Promise<Object|null>} Created constraint or null
     */
    async function saveConstraint(constraint) {
        if (!supabase) {
            console.warn('Supabase not configured');
            return null;
        }

        try {
            // Get department ID for DESN
            const { data: dept } = await supabase
                .from('departments')
                .select('id')
                .eq('code', 'DESN')
                .single();

            const { data, error } = await supabase
                .from('scheduling_constraints')
                .insert({
                    department_id: dept?.id,
                    constraint_type: constraint.type,
                    description: constraint.description,
                    rule_details: constraint.rule_details,
                    enabled: constraint.enabled ?? true
                })
                .select()
                .single();

            if (error) throw error;

            // Invalidate cache
            constraintsCache = null;

            console.log('Constraint created:', data.id);
            return data;

        } catch (err) {
            console.error('Failed to save constraint:', err.message);
            return null;
        }
    }

    /**
     * Delete a constraint
     * @param {string} id - Constraint UUID
     * @returns {Promise<boolean>} Success
     */
    async function deleteConstraint(id) {
        if (!supabase) {
            console.warn('Supabase not configured');
            return false;
        }

        try {
            const { error } = await supabase
                .from('scheduling_constraints')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Invalidate cache
            constraintsCache = null;

            console.log('Constraint deleted:', id);
            return true;

        } catch (err) {
            console.error('Failed to delete constraint:', err.message);
            return false;
        }
    }

    /**
     * Fallback constraints when Supabase is not available
     * These mirror the seed data
     */
    function getFallbackConstraints() {
        return [
            {
                id: 'fallback-1',
                constraint_type: 'room_restriction',
                description: 'Room 212 is reserved for specific courses only',
                rule_details: {
                    room: '212',
                    allowed_courses: ['DESN 301', 'DESN 359', 'DESN 401'],
                    severity: 'warning',
                    message: 'Room 212 is typically reserved for Visual Storytelling, Histories of Design, and Imaginary Worlds'
                },
                enabled: true
            },
            {
                id: 'fallback-2',
                constraint_type: 'room_restriction',
                description: 'Room 210 has no computers - drawing/lecture only',
                rule_details: {
                    room: '210',
                    allowed_courses: ['DESN 100', 'DESN 301', 'DESN 401', 'DESN 359'],
                    severity: 'warning',
                    message: 'Room 210 has no computers - only suitable for drawing, lecture, or discussion courses'
                },
                enabled: true
            },
            {
                id: 'fallback-3',
                constraint_type: 'student_conflict',
                description: 'Graduation pathway conflicts - courses students take together',
                rule_details: {
                    severity: 'critical',
                    message: 'Courses in the same graduation pathway are scheduled at the same time, preventing students from completing requirements',
                    preferred_resolutions: [
                        { action: 'move_course', target_slot: 'MW 16:00-18:00', reason: 'Evening slot typically has capacity' },
                        { action: 'move_course', target_slot: 'TR 16:00-18:00', reason: 'Evening slot alternative' }
                    ]
                },
                enabled: true
            },
            {
                id: 'fallback-4',
                constraint_type: 'faculty_double_book',
                description: 'Faculty cannot teach two courses at the same time',
                rule_details: {
                    severity: 'critical',
                    message: 'Instructor is scheduled to teach multiple courses at the same time in different rooms'
                },
                enabled: true
            },
            {
                id: 'fallback-5',
                constraint_type: 'room_double_book',
                description: 'Only one course per room per time slot',
                rule_details: {
                    severity: 'critical',
                    message: 'Multiple courses are scheduled in the same room at the same time'
                },
                enabled: true
            },
            {
                id: 'fallback-6',
                constraint_type: 'evening_safety',
                description: 'Minimum instructors for evening classes',
                rule_details: {
                    time_after: '16:00',
                    min_instructors: 2,
                    severity: 'warning',
                    message: 'Only one instructor is scheduled for evening classes - safety concern'
                },
                enabled: true
            },
            {
                id: 'fallback-7',
                constraint_type: 'ay_setup_alignment',
                description: 'Academic Year Setup alignment for workload and adjunct targets',
                rule_details: {
                    annualOverloadWarning: 3,
                    annualOverloadCritical: 8,
                    annualUnderloadWarning: 6,
                    quarterOverloadWarning: 2,
                    quarterOverloadCritical: 5,
                    quarterUnderloadWarning: 3,
                    adjunctUnderloadWarning: 0.5,
                    adjunctOverloadWarning: 2
                },
                enabled: true
            }
        ];
    }

    /**
     * Clear the constraints cache
     */
    function clearCache() {
        constraintsCache = null;
        cacheTimestamp = null;
    }

    // Public API
    return {
        loadConstraints,
        loadEnabledConstraints,
        toggleConstraint,
        saveConstraint,
        deleteConstraint,
        clearCache,
        getFallbackConstraints
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConstraintsService;
}
