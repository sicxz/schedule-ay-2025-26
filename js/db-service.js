/**
 * Database Service Layer
 * Provides functions to interact with Supabase database
 * Falls back to local JSON files when Supabase is not configured
 */

const dbService = {
    departmentId: null,
    initialized: false,

    /**
     * Initialize the database service
     * Gets or creates the department, ensures base data exists
     */
    async initialize() {
        if (this.initialized) return this.departmentId;

        if (!isSupabaseConfigured()) {
            console.log('Database service: Using local JSON fallback mode');
            this.initialized = true;
            return null;
        }

        try {
            // Get or create department
            const { data: dept, error: deptError } = await supabase
                .from('departments')
                .select('id')
                .eq('code', CURRENT_DEPARTMENT_CODE)
                .single();

            if (deptError && deptError.code === 'PGRST116') {
                // Department doesn't exist, create it
                const { data: newDept, error: createError } = await supabase
                    .from('departments')
                    .insert({ name: 'Design', code: CURRENT_DEPARTMENT_CODE })
                    .select('id')
                    .single();

                if (createError) throw createError;
                this.departmentId = newDept.id;
            } else if (deptError) {
                throw deptError;
            } else {
                this.departmentId = dept.id;
            }

            this.initialized = true;
            console.log('Database service initialized. Department ID:', this.departmentId);
            return this.departmentId;
        } catch (error) {
            console.error('Failed to initialize database service:', error);
            throw error;
        }
    },

    // ============================================
    // COURSES
    // ============================================

    /**
     * Get all courses for the department
     */
    async getCourses() {
        if (!isSupabaseConfigured()) {
            return this._fetchLocalCourses();
        }

        await this.initialize();
        const { data, error } = await supabase
            .from('courses')
            .select('*')
            .eq('department_id', this.departmentId)
            .order('code');

        if (error) throw error;
        return data;
    },

    /**
     * Add a new course to the catalog
     */
    async addCourse(course) {
        if (!isSupabaseConfigured()) {
            console.warn('Cannot add course: Supabase not configured');
            return null;
        }

        await this.initialize();
        const { data, error } = await supabase
            .from('courses')
            .insert({
                department_id: this.departmentId,
                code: course.code,
                title: course.title,
                default_credits: course.defaultCredits || 5,
                typical_cap: course.typicalCap || 24,
                level: course.level,
                // Scheduling preferences
                quarters_offered: course.quartersOffered || ['Fall', 'Winter', 'Spring'],
                preferred_times: course.preferredTimes || ['morning', 'afternoon', 'evening'],
                preferred_days: course.preferredDays || ['MW', 'TR'],
                allowed_rooms: course.allowedRooms || null,
                allowed_campus: course.allowedCampus || null,
                // Constraint flags
                room_constraint_hard: course.roomConstraintHard || false,
                time_constraint_hard: course.timeConstraintHard || false,
                is_case_by_case: course.isCaseByCase || false
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update an existing course
     */
    async updateCourse(id, course) {
        if (!isSupabaseConfigured()) {
            console.warn('Cannot update course: Supabase not configured');
            return null;
        }

        await this.initialize();
        const updateData = {
            code: course.code,
            title: course.title,
            default_credits: course.defaultCredits || 5,
            typical_cap: course.typicalCap || 24,
            level: course.level,
            updated_at: new Date().toISOString()
        };

        // Add scheduling preferences if provided
        if (course.quartersOffered !== undefined) updateData.quarters_offered = course.quartersOffered;
        if (course.preferredTimes !== undefined) updateData.preferred_times = course.preferredTimes;
        if (course.preferredDays !== undefined) updateData.preferred_days = course.preferredDays;
        if (course.allowedRooms !== undefined) updateData.allowed_rooms = course.allowedRooms;
        if (course.allowedCampus !== undefined) updateData.allowed_campus = course.allowedCampus;

        // Add constraint flags if provided
        if (course.roomConstraintHard !== undefined) updateData.room_constraint_hard = course.roomConstraintHard;
        if (course.timeConstraintHard !== undefined) updateData.time_constraint_hard = course.timeConstraintHard;
        if (course.isCaseByCase !== undefined) updateData.is_case_by_case = course.isCaseByCase;

        const { data, error } = await supabase
            .from('courses')
            .update(updateData)
            .eq('id', id)
            .eq('department_id', this.departmentId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete a course from the catalog
     */
    async deleteCourse(id) {
        if (!isSupabaseConfigured()) {
            console.warn('Cannot delete course: Supabase not configured');
            return false;
        }

        await this.initialize();
        const { error } = await supabase
            .from('courses')
            .delete()
            .eq('id', id)
            .eq('department_id', this.departmentId);

        if (error) throw error;
        return true;
    },

    // ============================================
    // FACULTY
    // ============================================

    /**
     * Get all faculty for the department
     */
    async getFaculty() {
        if (!isSupabaseConfigured()) {
            return this._fetchLocalFaculty();
        }

        await this.initialize();
        const { data, error } = await supabase
            .from('faculty')
            .select('*')
            .eq('department_id', this.departmentId)
            .order('name');

        if (error) throw error;
        return data;
    },

    /**
     * Get full-time faculty only
     */
    async getFullTimeFaculty() {
        if (!isSupabaseConfigured()) {
            return this._fetchLocalFaculty('fullTime');
        }

        await this.initialize();
        const { data, error } = await supabase
            .from('faculty')
            .select('*')
            .eq('department_id', this.departmentId)
            .eq('category', 'fullTime')
            .order('name');

        if (error) throw error;
        return data;
    },

    /**
     * Add a new faculty member
     */
    async addFaculty(faculty) {
        if (!isSupabaseConfigured()) {
            console.warn('Cannot add faculty: Supabase not configured');
            return null;
        }

        await this.initialize();
        const { data, error } = await supabase
            .from('faculty')
            .insert({
                department_id: this.departmentId,
                name: faculty.name,
                email: faculty.email,
                category: faculty.category || 'fullTime',
                max_workload: faculty.maxWorkload || 45
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // ============================================
    // ROOMS
    // ============================================

    /**
     * Get all rooms for the department
     */
    async getRooms() {
        if (!isSupabaseConfigured()) {
            return this._fetchLocalRooms();
        }

        await this.initialize();
        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('department_id', this.departmentId)
            .order('room_code');

        if (error) throw error;
        return data;
    },

    // ============================================
    // ACADEMIC YEARS
    // ============================================

    /**
     * Get all academic years
     */
    async getAcademicYears() {
        if (!isSupabaseConfigured()) {
            return [
                { year: '2023-24', is_active: false },
                { year: '2024-25', is_active: false },
                { year: '2025-26', is_active: true }
            ];
        }

        await this.initialize();
        const { data, error } = await supabase
            .from('academic_years')
            .select('*')
            .eq('department_id', this.departmentId)
            .order('year', { ascending: false });

        if (error) throw error;
        return data;
    },

    /**
     * Get or create an academic year
     */
    async getOrCreateYear(yearString) {
        if (!isSupabaseConfigured()) return null;

        await this.initialize();

        // Try to get existing
        const { data: existing } = await supabase
            .from('academic_years')
            .select('*')
            .eq('department_id', this.departmentId)
            .eq('year', yearString)
            .single();

        if (existing) return existing;

        // Create new
        const { data, error } = await supabase
            .from('academic_years')
            .insert({
                department_id: this.departmentId,
                year: yearString,
                is_active: false
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // ============================================
    // SCHEDULED COURSES
    // ============================================

    /**
     * Get scheduled courses for a year and quarter
     */
    async getSchedule(yearId, quarter = null) {
        if (!isSupabaseConfigured()) {
            return [];
        }

        let query = supabase
            .from('scheduled_courses')
            .select(`
                *,
                course:courses(code, title, default_credits),
                faculty:faculty(name, category),
                room:rooms(room_code, campus)
            `)
            .eq('academic_year_id', yearId);

        if (quarter) {
            query = query.eq('quarter', quarter);
        }

        const { data, error } = await query.order('quarter').order('day_pattern').order('time_slot');

        if (error) throw error;
        return data;
    },

    /**
     * Save a scheduled course (insert or update)
     */
    async saveScheduledCourse(courseData) {
        if (!isSupabaseConfigured()) {
            console.warn('Cannot save: Supabase not configured');
            return null;
        }

        const record = {
            academic_year_id: courseData.academicYearId,
            course_id: courseData.courseId,
            faculty_id: courseData.facultyId || null,
            room_id: courseData.roomId || null,
            quarter: courseData.quarter,
            day_pattern: courseData.dayPattern,
            time_slot: courseData.timeSlot,
            section: courseData.section,
            projected_enrollment: courseData.projectedEnrollment || null,
            updated_at: new Date().toISOString()
        };

        if (courseData.id) {
            // Update existing
            const { data, error } = await supabase
                .from('scheduled_courses')
                .update(record)
                .eq('id', courseData.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            // Insert new
            const { data, error } = await supabase
                .from('scheduled_courses')
                .insert(record)
                .select()
                .single();

            if (error) throw error;
            return data;
        }
    },

    /**
     * Delete a scheduled course
     */
    async deleteScheduledCourse(id) {
        if (!isSupabaseConfigured()) {
            console.warn('Cannot delete: Supabase not configured');
            return false;
        }

        const { error } = await supabase
            .from('scheduled_courses')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    },

    /**
     * Batch save multiple scheduled courses
     */
    async batchSaveSchedule(courses, yearId) {
        if (!isSupabaseConfigured()) {
            console.warn('Cannot batch save: Supabase not configured');
            return [];
        }

        const records = courses.map(c => ({
            academic_year_id: yearId,
            course_id: c.courseId,
            faculty_id: c.facultyId || null,
            room_id: c.roomId || null,
            quarter: c.quarter,
            day_pattern: c.dayPattern,
            time_slot: c.timeSlot,
            section: c.section,
            projected_enrollment: c.projectedEnrollment || null
        }));

        const { data, error } = await supabase
            .from('scheduled_courses')
            .upsert(records)
            .select();

        if (error) throw error;
        return data;
    },

    // ============================================
    // FACULTY PREFERENCES
    // ============================================

    /**
     * Get preferences for a faculty member
     */
    async getFacultyPreferences(facultyId) {
        if (!isSupabaseConfigured()) {
            return null;
        }

        const { data, error } = await supabase
            .from('faculty_preferences')
            .select('*')
            .eq('faculty_id', facultyId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    /**
     * Save faculty preferences
     */
    async saveFacultyPreferences(facultyId, prefs) {
        if (!isSupabaseConfigured()) {
            console.warn('Cannot save preferences: Supabase not configured');
            return null;
        }

        const record = {
            faculty_id: facultyId,
            time_preferred: prefs.timePreferred || [],
            time_blocked: prefs.timeBlocked || [],
            day_preferred: prefs.dayPreferred || [],
            day_blocked: prefs.dayBlocked || [],
            campus_assignment: prefs.campusAssignment || 'any',
            qualified_courses: prefs.qualifiedCourses || [],
            notes: prefs.notes || '',
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('faculty_preferences')
            .upsert(record, { onConflict: 'faculty_id' })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // ============================================
    // SCHEDULING CONSTRAINTS
    // ============================================

    /**
     * Get all scheduling constraints
     */
    async getConstraints() {
        if (!isSupabaseConfigured()) {
            return this._fetchLocalConstraints();
        }

        await this.initialize();
        const { data, error } = await supabase
            .from('scheduling_constraints')
            .select('*')
            .eq('department_id', this.departmentId)
            .eq('enabled', true);

        if (error) throw error;
        return data;
    },

    /**
     * Save a scheduling constraint
     */
    async saveConstraint(constraint) {
        if (!isSupabaseConfigured()) {
            console.warn('Cannot save constraint: Supabase not configured');
            return null;
        }

        await this.initialize();
        const record = {
            department_id: this.departmentId,
            constraint_type: constraint.type,
            description: constraint.description,
            rule_details: constraint.ruleDetails,
            enabled: constraint.enabled !== false
        };

        if (constraint.id) {
            const { data, error } = await supabase
                .from('scheduling_constraints')
                .update(record)
                .eq('id', constraint.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            const { data, error } = await supabase
                .from('scheduling_constraints')
                .insert(record)
                .select()
                .single();

            if (error) throw error;
            return data;
        }
    },

    // ============================================
    // RELEASE TIME
    // ============================================

    /**
     * Get release time allocations for a faculty member
     */
    async getReleaseTime(facultyId, yearId = null) {
        if (!isSupabaseConfigured()) {
            return [];
        }

        let query = supabase
            .from('release_time')
            .select('*')
            .eq('faculty_id', facultyId);

        if (yearId) {
            query = query.eq('academic_year_id', yearId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
    },

    /**
     * Save release time allocation
     */
    async saveReleaseTime(allocation) {
        if (!isSupabaseConfigured()) {
            console.warn('Cannot save release time: Supabase not configured');
            return null;
        }

        const record = {
            faculty_id: allocation.facultyId,
            academic_year_id: allocation.academicYearId,
            category: allocation.category,
            credits: allocation.credits,
            quarters: allocation.quarters || ['Fall', 'Winter', 'Spring'],
            notes: allocation.notes || ''
        };

        if (allocation.id) {
            const { data, error } = await supabase
                .from('release_time')
                .update(record)
                .eq('id', allocation.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } else {
            const { data, error } = await supabase
                .from('release_time')
                .insert(record)
                .select()
                .single();

            if (error) throw error;
            return data;
        }
    },

    // ============================================
    // LOCAL FALLBACK METHODS
    // ============================================

    async _fetchLocalCourses() {
        try {
            const response = await fetch('../data/course-catalog.json');
            const data = await response.json();
            return data.courses || [];
        } catch (e) {
            console.error('Failed to load local courses:', e);
            return [];
        }
    },

    async _fetchLocalFaculty(category = null) {
        try {
            const response = await fetch('../workload-data.json');
            const data = await response.json();
            const yearData = data.workloadByYear?.byYear?.['2025-26'];

            if (!yearData) return [];

            let faculty = [];
            if (!category || category === 'fullTime') {
                faculty = faculty.concat(
                    Object.keys(yearData.fullTime || {}).map(name => ({
                        name,
                        category: 'fullTime'
                    }))
                );
            }
            if (!category || category === 'adjunct') {
                faculty = faculty.concat(
                    Object.keys(yearData.adjunct || {}).map(name => ({
                        name,
                        category: 'adjunct'
                    }))
                );
            }

            return faculty.sort((a, b) => a.name.localeCompare(b.name));
        } catch (e) {
            console.error('Failed to load local faculty:', e);
            return [];
        }
    },

    async _fetchLocalRooms() {
        try {
            const response = await fetch('../data/room-constraints.json');
            const data = await response.json();

            const rooms = [];
            for (const [campusId, campus] of Object.entries(data.campuses || {})) {
                for (const room of campus.rooms || []) {
                    rooms.push({
                        room_code: room.id,
                        name: room.name,
                        campus: campusId,
                        capacity: room.capacity,
                        room_type: room.type,
                        exclude_from_grid: room.excludeFromGrid || false
                    });
                }
            }
            return rooms;
        } catch (e) {
            console.error('Failed to load local rooms:', e);
            return [];
        }
    },

    async _fetchLocalConstraints() {
        try {
            const response = await fetch('../data/scheduling-rules.json');
            return await response.json();
        } catch (e) {
            console.error('Failed to load local constraints:', e);
            return {};
        }
    },

    // ============================================
    // UTILITY METHODS
    // ============================================

    /**
     * Look up IDs by code/name for easier data entry
     */
    async lookupCourseId(courseCode) {
        if (!isSupabaseConfigured()) return null;

        await this.initialize();
        const { data } = await supabase
            .from('courses')
            .select('id')
            .eq('department_id', this.departmentId)
            .eq('code', courseCode)
            .single();

        return data?.id;
    },

    async lookupFacultyId(facultyName) {
        if (!isSupabaseConfigured()) return null;

        await this.initialize();
        const { data } = await supabase
            .from('faculty')
            .select('id')
            .eq('department_id', this.departmentId)
            .eq('name', facultyName)
            .single();

        return data?.id;
    },

    async lookupRoomId(roomCode) {
        if (!isSupabaseConfigured()) return null;

        await this.initialize();
        const { data } = await supabase
            .from('rooms')
            .select('id')
            .eq('department_id', this.departmentId)
            .eq('room_code', roomCode)
            .single();

        return data?.id;
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = dbService;
}
