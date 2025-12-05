-- Course Management Enhancement - Add Scheduling Preferences
-- Run this in Supabase SQL Editor

-- ============================================
-- ADD NEW COLUMNS TO COURSES TABLE
-- ============================================

-- Scheduling preference columns
ALTER TABLE courses ADD COLUMN IF NOT EXISTS quarters_offered TEXT[] DEFAULT ARRAY['Fall', 'Winter', 'Spring'];
ALTER TABLE courses ADD COLUMN IF NOT EXISTS preferred_times TEXT[] DEFAULT ARRAY['morning', 'afternoon', 'evening'];
ALTER TABLE courses ADD COLUMN IF NOT EXISTS preferred_days TEXT[] DEFAULT ARRAY['MW', 'TR'];
ALTER TABLE courses ADD COLUMN IF NOT EXISTS allowed_rooms TEXT[] DEFAULT NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS allowed_campus VARCHAR(20) DEFAULT NULL;

-- Constraint flags
ALTER TABLE courses ADD COLUMN IF NOT EXISTS room_constraint_hard BOOLEAN DEFAULT FALSE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS time_constraint_hard BOOLEAN DEFAULT FALSE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_case_by_case BOOLEAN DEFAULT FALSE;

-- ============================================
-- SET DEFAULTS FOR EXISTING COURSES
-- ============================================

UPDATE courses SET quarters_offered = ARRAY['Fall', 'Winter', 'Spring'] WHERE quarters_offered IS NULL;
UPDATE courses SET preferred_times = ARRAY['morning', 'afternoon', 'evening'] WHERE preferred_times IS NULL;
UPDATE courses SET preferred_days = ARRAY['MW', 'TR'] WHERE preferred_days IS NULL;

-- ============================================
-- MIGRATE EXISTING CONSTRAINTS FROM scheduling-rules.json
-- ============================================

-- DESN 301, 359, 401: Room 212 only (hard constraint)
-- These are project-based courses that require the Project Lab
UPDATE courses
SET allowed_rooms = ARRAY['212'],
    room_constraint_hard = TRUE
WHERE code IN ('DESN 301', 'DESN 359', 'DESN 401');

-- DESN 100, 200, 216: Cheney campus (hard constraint) with CEB rooms
-- These intro courses are taught on main campus
UPDATE courses
SET allowed_campus = 'cheney',
    allowed_rooms = ARRAY['CEB 102', 'CEB 104'],
    room_constraint_hard = TRUE
WHERE code IN ('DESN 100', 'DESN 200', 'DESN 216');

-- ITGS courses: Cheney only, no evening (hard constraints)
UPDATE courses
SET allowed_campus = 'cheney',
    room_constraint_hard = TRUE,
    preferred_times = ARRAY['morning', 'afternoon'],
    time_constraint_hard = TRUE
WHERE code LIKE 'ITGS%';

-- Case-by-case courses (not grid-scheduled)
-- Internships, practicums, independent studies
UPDATE courses
SET is_case_by_case = TRUE
WHERE code IN ('DESN 495', 'DESN 491', 'DESN 499', 'DESN 399', 'DESN 396');

-- ============================================
-- VERIFY MIGRATION
-- ============================================

-- Show courses with constraints
SELECT code, title,
       quarters_offered,
       preferred_times,
       preferred_days,
       allowed_rooms,
       allowed_campus,
       room_constraint_hard,
       time_constraint_hard,
       is_case_by_case
FROM courses
WHERE room_constraint_hard = TRUE
   OR time_constraint_hard = TRUE
   OR is_case_by_case = TRUE
ORDER BY code;
