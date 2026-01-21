# EWU Design Schedule Builder

## Overview
A focused course scheduling application for Eastern Washington University's Design Department. Built as a fresh, clean implementation connecting to an existing Supabase database.

## Current State: Phase 1 - Core Scheduler
The application provides:
- Academic year and quarter selection (Fall, Winter, Spring)
- Visual schedule grid with time slots and weekdays
- Course addition with faculty assignment
- Drag-and-drop course repositioning
- Copy from previous year functionality
- Real-time save to Supabase database

## Project Structure
- `index.html` - Main scheduler application (single-page app)
- `server.js` - Node.js static file server (port 5000)
- `scripts/supabase-schema.sql` - Database schema reference

## Database (Supabase)
Connected to existing Supabase instance with tables:
- `departments` - Department info (DESN = Design)
- `academic_years` - Year records (2023-24, 2024-25, 2025-26)
- `courses` - Course catalog
- `faculty` - Faculty members
- `rooms` - Available rooms
- `scheduled_courses` - Main schedule data (quarter, day_pattern, time_slot, faculty_id)

## Running the Application
```
node server.js
```
Access at http://localhost:5000

## Planned Phases
- **Phase 1 (Current)**: Core scheduler with faculty assignment
- **Phase 2**: Enrollment intelligence - historical data, demand indicators
- **Phase 3**: Predictions and constraints - faculty restrictions, optimization suggestions

## Recent Changes
- January 2026: Fresh rebuild as focused Phase 1 scheduler
- Removed complex analytics dashboards to focus on core scheduling
- Connected to existing Supabase database
- Implemented copy-from-previous-year feature
