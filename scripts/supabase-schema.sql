-- EWU Schedule Builder - Supabase Schema
-- Run this in Supabase SQL Editor to create all tables

-- Departments (for multi-department scaling)
CREATE TABLE departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Academic Years
CREATE TABLE academic_years (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id),
  year VARCHAR(10) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(department_id, year)
);

-- Rooms
CREATE TABLE rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id),
  room_code VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  campus VARCHAR(50),
  capacity INT,
  room_type VARCHAR(50),
  exclude_from_grid BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Course Catalog
CREATE TABLE courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id),
  code VARCHAR(20) NOT NULL,
  title VARCHAR(255),
  default_credits INT DEFAULT 5,
  typical_cap INT DEFAULT 24,
  level VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(department_id, code)
);

-- Faculty
CREATE TABLE faculty (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  category VARCHAR(50) DEFAULT 'fullTime',
  max_workload NUMERIC(5,2) DEFAULT 45,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(department_id, name)
);

-- Scheduled Courses (main schedule data)
CREATE TABLE scheduled_courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year_id UUID REFERENCES academic_years(id),
  course_id UUID REFERENCES courses(id),
  faculty_id UUID REFERENCES faculty(id),
  room_id UUID REFERENCES rooms(id),
  quarter VARCHAR(20) NOT NULL,
  day_pattern VARCHAR(10),
  time_slot VARCHAR(20),
  section VARCHAR(10),
  projected_enrollment INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Faculty Preferences
CREATE TABLE faculty_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  faculty_id UUID REFERENCES faculty(id) UNIQUE,
  time_preferred JSONB DEFAULT '[]',
  time_blocked JSONB DEFAULT '[]',
  day_preferred JSONB DEFAULT '[]',
  day_blocked JSONB DEFAULT '[]',
  campus_assignment VARCHAR(50) DEFAULT 'any',
  qualified_courses JSONB DEFAULT '[]',
  notes TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Scheduling Constraints
CREATE TABLE scheduling_constraints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id),
  constraint_type VARCHAR(50),
  description TEXT,
  rule_details JSONB,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Release Time Allocations
CREATE TABLE release_time (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  faculty_id UUID REFERENCES faculty(id),
  academic_year_id UUID REFERENCES academic_years(id),
  category VARCHAR(50),
  credits NUMERIC(5,2),
  quarters JSONB DEFAULT '["Fall","Winter","Spring"]',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE release_time ENABLE ROW LEVEL SECURITY;

-- Public read access policies (can restrict later with auth)
CREATE POLICY "Public read" ON departments FOR SELECT USING (true);
CREATE POLICY "Public read" ON academic_years FOR SELECT USING (true);
CREATE POLICY "Public read" ON rooms FOR SELECT USING (true);
CREATE POLICY "Public read" ON courses FOR SELECT USING (true);
CREATE POLICY "Public read" ON faculty FOR SELECT USING (true);
CREATE POLICY "Public read" ON scheduled_courses FOR SELECT USING (true);
CREATE POLICY "Public read" ON faculty_preferences FOR SELECT USING (true);
CREATE POLICY "Public read" ON scheduling_constraints FOR SELECT USING (true);
CREATE POLICY "Public read" ON release_time FOR SELECT USING (true);

-- Public write access (restrict later when adding auth)
CREATE POLICY "Public write" ON departments FOR ALL USING (true);
CREATE POLICY "Public write" ON academic_years FOR ALL USING (true);
CREATE POLICY "Public write" ON rooms FOR ALL USING (true);
CREATE POLICY "Public write" ON courses FOR ALL USING (true);
CREATE POLICY "Public write" ON faculty FOR ALL USING (true);
CREATE POLICY "Public write" ON scheduled_courses FOR ALL USING (true);
CREATE POLICY "Public write" ON faculty_preferences FOR ALL USING (true);
CREATE POLICY "Public write" ON scheduling_constraints FOR ALL USING (true);
CREATE POLICY "Public write" ON release_time FOR ALL USING (true);

-- Insert initial Design department
INSERT INTO departments (name, code) VALUES ('Design', 'DESN');

-- Success message
SELECT 'Schema created successfully! Tables: departments, academic_years, rooms, courses, faculty, scheduled_courses, faculty_preferences, scheduling_constraints, release_time' as status;
