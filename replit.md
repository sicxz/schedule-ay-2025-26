# EWU Design Department Schedule Analyzer

## Overview
This is a static HTML/JavaScript application for Eastern Washington University's Design Department. It provides visual course scheduling, conflict detection, and workload analytics for faculty and course management.

## Project Structure
- `index.html` - Main application entry point
- `server.js` - Simple Node.js static file server (port 5000)
- `js/` - JavaScript modules for scheduling, analytics, and data management
- `css/` - Stylesheets including design-system.css with EWU brand tokens
- `data/` - Data files
- `pages/` - Additional HTML pages
- `enrollment-data/` - Enrollment data files
- `scripts/` - Node.js utility scripts for data processing

## Running the Application
The application runs on port 5000 using a Node.js static file server:
```
node server.js
```

## Key Features
- Visual course scheduling with drag-and-drop
- Conflict detection and resolution
- Faculty workload analytics
- Enrollment tracking
- Capacity planning
- AI-powered schedule analysis

## Design System
The app uses a comprehensive design system (`css/design-system.css`) with:
- EWU brand colors (--ewu-red: #a10022)
- CSS custom properties for colors, shadows, spacing, and transitions
- Reusable component styles for buttons, cards, modals, and forms
- Accessibility-focused focus states
- Smooth transitions and micro-interactions

## Dependencies
- Node.js 20 for the static server and utility scripts
- Supabase client library for database connectivity
- Jest for testing
- Inter font from Google Fonts

## Recent Changes
- January 2026: Google Sheets Export & Print Fixes
  - Fixed row offset calculation in Google Sheets export - courses now appear at correct time slots
  - Duration calculation now properly handles 2h 20min courses (140 min = 3 hourly rows)
  - Added print functionality with option to print current quarter or all three quarters
  - Print output includes MW section, TR section, and online courses
- January 2026: Course Editing & Time Slot Fixes
  - Fixed "Quarter not found" error when saving course edits - now uses direct scheduleData as primary save path
  - Updated time slots to reflect actual 2h 20min course duration (10:00-12:20, 13:00-15:20, 16:00-18:20)
  - Improved instructor pre-selection in edit modal using last name matching
  - ScheduleManager update is now optional secondary sync (won't fail saves if unavailable)
- January 2026: Faculty Roster Update
  - Updated faculty dropdowns to current AY 2026-27 roster
  - Professors: T.Masingale, G.Hustrulid, M.Breen, C.Manikoth
  - Lecturers: S.Mills, A.Sopu, S.Durr
  - Adjuncts: J.Braukmann
  - Added "Add New Faculty" functionality with localStorage persistence
- January 2026: Graduation Pathway Conflict Detection
  - Rewrote student_conflict checker to use graduation pathway pairings instead of generic upper-div counting
  - Defined 25+ common course pairings (senior year: 463+480+490, UX track: 338+348+458, etc.)
  - Conflicts now only flag when courses students commonly take together are at the same time
  - Example: 490, 374, 338 at same time is NOT a conflict; 480, 490, 463 together IS a conflict
  - Updated fallback constraints to match new pairing-based logic
- January 2026: Online Section Support & Bug Fixes
  - Added online/asynchronous section toggle in Add Course modal
  - Online sections stored in ONLINE/async data structure
  - Added "Online / Async" option to room dropdown
  - Fixed conflict detection to display times in AM/PM format (1:00 PM instead of 13:00)
  - Fixed undefined suggestion bug in conflict results by adding suggestion field to all conflict types
- January 2026: Primer Design System Integration
  - Adopted GitHub Primer design patterns for cleaner, professional look
  - System font stack (-apple-system, BlinkMacSystemFont, etc.)
  - 6px border radius on components (Primer standard)
  - 4px spacing scale for consistent layout
  - Primer color tokens for borders, backgrounds, text
  - Flat stat cards with left-side color accents
  - Subtle shadows and transitions (Primer shadow scale)
  - Preserved EWU brand colors (header gradient, accents)
- January 2026: Streamlined UI - Schedule-First Design
  - Added prominent quarter tabs (Fall, Winter, Spring) directly below header
  - Filters panel now collapsed by default with toggle button
  - Action buttons converted to floating action button (FAB) menu
  - Dashboards & Tools section collapsed by default
  - Reduced header size to show schedule grid immediately on load
  - Removed info banner to minimize clutter
- January 2026: Faculty Selection & Schedule Preservation
  - Added Faculty Selection Panel to Schedule Builder for selecting active faculty for next year
  - Faculty organized by rank with priority: Full-time faculty (professors, lecturers) over Adjuncts
  - Adjuncts are treated as "placeholders" for when full-time faculty are unavailable
  - New FacultyManager module (js/faculty-manager.js) for faculty availability and selection
  - Improved schedule loading to preserve previous year's course placements
  - Courses now keep their same time slots when building next year's schedule
  - Saved placements stored in localStorage for consistency across sessions
  - Fixed: parseSlotKey() correctly handles time ranges with dashes (e.g., "MW-10:00-12:20-206")
  - Fixed: Auto-save placements after schedule loading and generation for preservation on first run
- January 2026: Design/UX improvements
  - Updated to EWU brand colors (red #a10022)
  - Modernized button styles with shadows and hover effects
  - Added comprehensive mobile responsiveness (breakpoints at 1200px, 992px, 768px, 480px)
  - Enhanced navigation accordion with brand colors
  - Added Inter font for better typography
  - Improved transitions and micro-interactions
  - Fixed Supabase client initialization
- January 2026: Initial Replit setup with static file server on port 5000
