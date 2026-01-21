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
