-- Seed scheduling constraints with current hardcoded rules
-- Run this in Supabase SQL Editor after creating the schema

-- Get the Design department ID
DO $$
DECLARE
    dept_id UUID;
BEGIN
    SELECT id INTO dept_id FROM departments WHERE code = 'DESN';

    -- 1. Room 212 Restriction
    INSERT INTO scheduling_constraints (department_id, constraint_type, description, rule_details, enabled)
    VALUES (
        dept_id,
        'room_restriction',
        'Room 212 is reserved for specific courses only',
        '{
            "room": "212",
            "allowed_courses": ["DESN 301", "DESN 359", "DESN 401"],
            "severity": "warning",
            "message": "Room 212 is typically reserved for Visual Storytelling, Histories of Design, and Imaginary Worlds"
        }'::jsonb,
        true
    );

    -- 2. Student Scheduling Conflict (upper-division overlap)
    INSERT INTO scheduling_constraints (department_id, constraint_type, description, rule_details, enabled)
    VALUES (
        dept_id,
        'student_conflict',
        'Limit upper-division courses in same time slot',
        '{
            "course_level_min": 300,
            "course_level_max": 499,
            "max_courses_per_slot": 2,
            "severity": "critical",
            "message": "Students cannot take multiple upper-division electives simultaneously",
            "preferred_resolutions": [
                {"action": "move_course", "target_slot": "MW 16:00-18:00", "reason": "Evening slot typically has capacity"},
                {"action": "move_course", "target_slot": "TR 16:00-18:00", "reason": "Evening slot alternative"},
                {"action": "move_course", "target_slot": "MW 13:00-15:00", "reason": "Afternoon slot"},
                {"action": "move_course", "target_slot": "TR 13:00-15:00", "reason": "Afternoon slot alternative"}
            ]
        }'::jsonb,
        true
    );

    -- 3. Faculty Double-Booking
    INSERT INTO scheduling_constraints (department_id, constraint_type, description, rule_details, enabled)
    VALUES (
        dept_id,
        'faculty_double_book',
        'Faculty cannot teach two courses at the same time',
        '{
            "severity": "critical",
            "message": "Instructor is scheduled to teach multiple courses at the same time in different rooms"
        }'::jsonb,
        true
    );

    -- 4. Room Double-Booking
    INSERT INTO scheduling_constraints (department_id, constraint_type, description, rule_details, enabled)
    VALUES (
        dept_id,
        'room_double_book',
        'Only one course per room per time slot',
        '{
            "severity": "critical",
            "message": "Multiple courses are scheduled in the same room at the same time"
        }'::jsonb,
        true
    );

    -- 5. Evening Safety
    INSERT INTO scheduling_constraints (department_id, constraint_type, description, rule_details, enabled)
    VALUES (
        dept_id,
        'evening_safety',
        'Minimum instructors for evening classes',
        '{
            "time_after": "16:00",
            "min_instructors": 2,
            "severity": "warning",
            "message": "Only one instructor is scheduled for evening classes - safety concern"
        }'::jsonb,
        true
    );

    -- 6. Campus Transition Time
    INSERT INTO scheduling_constraints (department_id, constraint_type, description, rule_details, enabled)
    VALUES (
        dept_id,
        'campus_transition',
        'Faculty need time to travel between campuses',
        '{
            "campuses": ["Cheney", "Spokane"],
            "min_gap_hours": 2,
            "severity": "warning",
            "message": "Faculty is scheduled back-to-back at different campuses without travel time"
        }'::jsonb,
        false
    );

    -- 8. Room 207 - Project Room
    INSERT INTO scheduling_constraints (department_id, constraint_type, description, rule_details, enabled)
    VALUES (
        dept_id,
        'room_restriction',
        'Room 207 is a project room (best for hands-on courses)',
        '{
            "room": "207",
            "preferred_courses": ["DESN 301", "DESN 326", "DESN 336", "DESN 355", "DESN 401"],
            "severity": "info",
            "message": "Room 207 is a project room - best suited for hands-on studio courses"
        }'::jsonb,
        true
    );

    -- 9. Room 210 - No Computers
    INSERT INTO scheduling_constraints (department_id, constraint_type, description, rule_details, enabled)
    VALUES (
        dept_id,
        'room_restriction',
        'Room 210 has no computers - drawing/lecture only',
        '{
            "room": "210",
            "allowed_courses": ["DESN 100", "DESN 301", "DESN 401", "DESN 359"],
            "severity": "warning",
            "message": "Room 210 has no computers - only suitable for drawing, lecture, or discussion courses"
        }'::jsonb,
        true
    );

    -- 7. Enrollment Threshold
    INSERT INTO scheduling_constraints (department_id, constraint_type, description, rule_details, enabled)
    VALUES (
        dept_id,
        'enrollment_threshold',
        'Flag courses with very low or high enrollment',
        '{
            "min_enrollment": 8,
            "max_enrollment": 28,
            "severity": "warning",
            "message": "Course enrollment is outside normal range"
        }'::jsonb,
        true
    );

    RAISE NOTICE 'Seeded 9 scheduling constraints for Design department';
END $$;

-- Verify the constraints were added
SELECT constraint_type, description, enabled
FROM scheduling_constraints
ORDER BY constraint_type;
