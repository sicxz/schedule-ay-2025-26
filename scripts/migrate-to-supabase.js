/**
 * Data Migration Script for Supabase
 *
 * This script migrates existing JSON data to your Supabase database.
 *
 * SETUP:
 * 1. Install dependencies: npm install @supabase/supabase-js
 * 2. Update SUPABASE_URL and SUPABASE_KEY below with your credentials
 * 3. Run: node scripts/migrate-to-supabase.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
const SUPABASE_URL = 'https://ohnrhjxcjkrdtudpzjgn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obnJoanhjamtyZHR1ZHB6amduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NDQ2NzAsImV4cCI6MjA4MDUyMDY3MH0.XN1CC0xC5dizIhF4cIEkv90TApJHXRBYTC7a6AXPvtU';
const DEPARTMENT_CODE = 'DESN';
const DEPARTMENT_NAME = 'Design';

// ============================================
// INITIALIZE SUPABASE CLIENT
// ============================================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// HELPER FUNCTIONS
// ============================================

function readJsonFile(relativePath) {
    const fullPath = path.join(__dirname, '..', relativePath);
    try {
        const content = fs.readFileSync(fullPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`Failed to read ${relativePath}:`, error.message);
        return null;
    }
}

async function logProgress(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

// ============================================
// MIGRATION FUNCTIONS
// ============================================

async function migrateDepartment() {
    logProgress('Migrating department...');

    // Check if department exists
    const { data: existing } = await supabase
        .from('departments')
        .select('id')
        .eq('code', DEPARTMENT_CODE)
        .single();

    if (existing) {
        logProgress(`Department ${DEPARTMENT_CODE} already exists with ID: ${existing.id}`);
        return existing.id;
    }

    // Insert new department
    const { data, error } = await supabase
        .from('departments')
        .insert({ name: DEPARTMENT_NAME, code: DEPARTMENT_CODE })
        .select('id')
        .single();

    if (error) throw error;
    logProgress(`Created department with ID: ${data.id}`);
    return data.id;
}

async function migrateAcademicYears(departmentId) {
    logProgress('Migrating academic years...');

    const years = ['2022-23', '2023-24', '2024-25', '2025-26', '2026-27'];
    const results = [];

    for (const year of years) {
        // Check if exists
        const { data: existing } = await supabase
            .from('academic_years')
            .select('id')
            .eq('department_id', departmentId)
            .eq('year', year)
            .single();

        if (existing) {
            results.push({ year, id: existing.id });
            continue;
        }

        // Insert new
        const { data, error } = await supabase
            .from('academic_years')
            .insert({
                department_id: departmentId,
                year: year,
                is_active: year === '2025-26'
            })
            .select('id')
            .single();

        if (error) throw error;
        results.push({ year, id: data.id });
    }

    logProgress(`Migrated ${results.length} academic years`);
    return results;
}

async function migrateRooms(departmentId) {
    logProgress('Migrating rooms...');

    const roomData = readJsonFile('data/room-constraints.json');
    if (!roomData?.campuses) {
        logProgress('No room data found');
        return [];
    }

    const rooms = [];
    for (const [campusId, campus] of Object.entries(roomData.campuses)) {
        for (const room of campus.rooms || []) {
            rooms.push({
                department_id: departmentId,
                room_code: room.id,
                name: room.name,
                campus: campusId,
                capacity: room.capacity || 24,
                room_type: room.type || 'classroom',
                exclude_from_grid: room.excludeFromGrid || false
            });
        }
    }

    // Delete existing rooms for this department and re-insert
    await supabase.from('rooms').delete().eq('department_id', departmentId);

    const { data, error } = await supabase
        .from('rooms')
        .insert(rooms)
        .select();

    if (error) throw error;
    logProgress(`Migrated ${data.length} rooms`);
    return data;
}

async function migrateCourses(departmentId) {
    logProgress('Migrating courses...');

    const catalogData = readJsonFile('data/course-catalog.json');
    if (!catalogData?.courses) {
        logProgress('No course catalog found');
        return [];
    }

    const courses = catalogData.courses.map(course => ({
        department_id: departmentId,
        code: course.code,
        title: course.title,
        default_credits: course.defaultCredits || 5,
        typical_cap: course.typicalEnrollmentCap || 24,
        level: course.level
    }));

    // Delete existing courses for this department and re-insert
    await supabase.from('courses').delete().eq('department_id', departmentId);

    const { data, error } = await supabase
        .from('courses')
        .insert(courses)
        .select();

    if (error) throw error;
    logProgress(`Migrated ${data.length} courses`);
    return data;
}

async function migrateFaculty(departmentId) {
    logProgress('Migrating faculty...');

    const workloadData = readJsonFile('workload-data.json');
    if (!workloadData?.workloadByYear?.byYear) {
        logProgress('No workload data found');
        return [];
    }

    const facultyMap = new Map();
    const currentYear = workloadData.workloadByYear.byYear['2025-26'] || {};

    // Get full-time faculty
    for (const [name, data] of Object.entries(currentYear.fullTime || {})) {
        facultyMap.set(name, {
            department_id: departmentId,
            name: name,
            category: 'fullTime',
            max_workload: 45
        });
    }

    // Get adjunct faculty
    for (const [name, data] of Object.entries(currentYear.adjunct || {})) {
        if (!facultyMap.has(name)) {
            facultyMap.set(name, {
                department_id: departmentId,
                name: name,
                category: 'adjunct',
                max_workload: null
            });
        }
    }

    // Also check former faculty
    for (const [name, data] of Object.entries(currentYear.former || {})) {
        if (!facultyMap.has(name)) {
            facultyMap.set(name, {
                department_id: departmentId,
                name: name,
                category: 'former',
                max_workload: null
            });
        }
    }

    const faculty = Array.from(facultyMap.values());

    // Delete existing faculty for this department and re-insert
    await supabase.from('faculty').delete().eq('department_id', departmentId);

    const { data, error } = await supabase
        .from('faculty')
        .insert(faculty)
        .select();

    if (error) throw error;
    logProgress(`Migrated ${data.length} faculty members`);
    return data;
}

async function migrateConstraints(departmentId) {
    logProgress('Migrating constraints...');

    const rulesData = readJsonFile('data/scheduling-rules.json');
    if (!rulesData) {
        logProgress('No scheduling rules found');
        return [];
    }

    const constraints = [];

    // Course constraints
    if (rulesData.courseConstraints) {
        for (const constraint of rulesData.courseConstraints) {
            constraints.push({
                department_id: departmentId,
                constraint_type: 'course-constraint',
                description: constraint.id || 'Course constraint',
                rule_details: constraint,
                enabled: constraint.enabled !== false
            });
        }
    }

    // Faculty constraints
    if (rulesData.facultyConstraints) {
        for (const constraint of rulesData.facultyConstraints) {
            constraints.push({
                department_id: departmentId,
                constraint_type: 'faculty-constraint',
                description: constraint.rule || constraint.id || 'Faculty constraint',
                rule_details: constraint,
                enabled: constraint.enabled !== false
            });
        }
    }

    // Room constraints
    if (rulesData.roomConstraints) {
        for (const constraint of rulesData.roomConstraints) {
            constraints.push({
                department_id: departmentId,
                constraint_type: 'room-constraint',
                description: `Room ${constraint.room} constraint`,
                rule_details: constraint,
                enabled: true
            });
        }
    }

    if (constraints.length === 0) {
        logProgress('No constraints to migrate');
        return [];
    }

    // Delete existing constraints for this department and re-insert
    await supabase.from('scheduling_constraints').delete().eq('department_id', departmentId);

    const { data, error } = await supabase
        .from('scheduling_constraints')
        .insert(constraints)
        .select();

    if (error) throw error;
    logProgress(`Migrated ${data.length} constraints`);
    return data;
}

// ============================================
// MAIN MIGRATION RUNNER
// ============================================

async function runMigration() {
    console.log('\n========================================');
    console.log('EWU Schedule Builder - Data Migration');
    console.log('========================================\n');

    // Validate configuration
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        console.error('ERROR: Please update SUPABASE_URL and SUPABASE_KEY in this script');
        console.error('You can find these in your Supabase project settings under API');
        process.exit(1);
    }

    try {
        // Test connection
        logProgress('Testing Supabase connection...');
        const { data, error } = await supabase.from('departments').select('count').limit(1);
        if (error) {
            console.error('Connection failed:', error.message);
            console.error('\nMake sure you have:');
            console.error('1. Created the tables using scripts/supabase-schema.sql');
            console.error('2. Correct SUPABASE_URL and SUPABASE_KEY');
            process.exit(1);
        }
        logProgress('Connection successful!');

        // Run migrations in order
        const departmentId = await migrateDepartment();
        const years = await migrateAcademicYears(departmentId);
        const rooms = await migrateRooms(departmentId);
        const courses = await migrateCourses(departmentId);
        const faculty = await migrateFaculty(departmentId);
        const constraints = await migrateConstraints(departmentId);

        // Summary
        console.log('\n========================================');
        console.log('Migration Complete!');
        console.log('========================================');
        console.log(`Department ID: ${departmentId}`);
        console.log(`Academic Years: ${years.length}`);
        console.log(`Rooms: ${rooms.length}`);
        console.log(`Courses: ${courses.length}`);
        console.log(`Faculty: ${faculty.length}`);
        console.log(`Constraints: ${constraints.length}`);
        console.log('\nYou can now update js/supabase-config.js with your credentials');
        console.log('and the Schedule Builder will use the database!');

    } catch (error) {
        console.error('\nMigration failed:', error);
        process.exit(1);
    }
}

// Run the migration
runMigration();
