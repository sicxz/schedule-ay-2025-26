# Claude Code Quick Start Guide

## Setup

1. **Initialize repository:**
```bash
cd ewu-design-catalog
git init
git add .
git commit -m "Initial catalog structure"
```

2. **Test query tools:**
```bash
python3 query_courses.py --list-tracks
python3 query_courses.py --unlocks DESN-216
```

## Common Claude Code Commands

### Find Course Information
```bash
# Find prerequisites for a course
claude code "what are the prerequisites for DESN-468?"

# Find what courses a course unlocks
claude code "what courses does DESN-216 unlock?"

# Show full course sequence
claude code "show me the complete web development sequence from DESN-216 to DESN-469"
```

### Track Queries
```bash
# List all courses in a track
claude code "list all courses in the web-development track"

# Compare tracks
claude code "compare the animation-motion track with the game-design track - what overlaps?"

# Find track requirements
claude code "what's the minimum path through the ux-interaction track?"
```

### Curriculum Planning
```bash
# Add metadata to courses
claude code "add a 'taught_by' field to DESN-374, DESN-368, and DESN-216"

# Update course descriptions
claude code "update DESN-374 description to include 'NotebookLM' as a key tool"

# Create teaching notes
claude code "create a teaching-notes.md file for DESN-368 with weekly breakdown"
```

### Cross-Course Analysis
```bash
# Find common topics
claude code "which courses cover 'typography'?"

# Map prerequisites
claude code "create a visual prerequisite map for all 300-level courses"

# Identify bottlenecks
claude code "which courses are prerequisites for the most other courses?"
```

### Content Generation
```bash
# Generate syllabi templates
claude code "create a syllabus template for DESN-374 based on the catalog description"

# Create assignment sequences
claude code "suggest 10 progressive assignments for DESN-368 that build from CodePen to Netlify"

# Generate rubrics
claude code "create a grading rubric for DESN-374 that assesses prompt engineering skills"
```

## File Structure Commands

### Navigate by level
```bash
# List all 300-level courses
claude code "show all courses in courses/300-level/"

# Compare levels
claude code "what's the difference between 300-level and 400-level web dev courses?"
```

### Update metadata
```bash
# Batch update frontmatter
claude code "add 'last_updated: 2025' to all course files"

# Add custom fields
claude code "add a 'software_required' array to all adobe-tools track courses"
```

### Export formats
```bash
# Create CSV
claude code "export all course codes, names, and credits to courses.csv"

# Generate reports
claude code "create a markdown report showing credit hours by track"

# Build flowcharts
claude code "generate a mermaid flowchart showing the web development sequence"
```

## Advanced Workflows

### Curriculum Mapping
```bash
claude code "analyze all courses and create a skills progression matrix showing how HTML/CSS/JS skills develop across courses"
```

### Gap Analysis
```bash
claude code "compare the adobe-tools courses (213-217) with the actual software used in other courses - are we missing any tool training?"
```

### Prerequisites Validation
```bash
claude code "check all course prerequisites - are there any circular dependencies or impossible sequences?"
```

### Student Path Planning
```bash
claude code "create 3 sample 4-year plans: one focused on web dev, one on animation, one on UX"
```

## Integration Examples

### With Your Teaching Materials
```bash
# Link to assignment repos
claude code "add 'github_repo' links to DESN-368, DESN-378, DESN-468 pointing to course assignment repositories"

# Connect to Canvas
claude code "generate Canvas module import files for DESN-374 based on the course topics"
```

### With Degree Requirements
```bash
# Check graduation reqs
claude code "which courses satisfy graduation requirements? create a summary"

# Plan course rotations
claude code "if we can only offer 3 electives per year, what's the optimal rotation for game design students?"
```

## Query Script Examples

Direct Python usage for scripting:

```bash
# List all tracks
python3 query_courses.py --list-tracks

# Show prerequisites
python3 query_courses.py --prerequisites DESN-490

# Find unlocked courses
python3 query_courses.py --unlocks DESN-368

# Get track courses
python3 query_courses.py --track web-development

# Find level courses
python3 query_courses.py --level 300

# Forward sequence (what comes after)
python3 query_courses.py --sequence-forward DESN-216

# Backward sequence (what comes before)
python3 query_courses.py --sequence-backward DESN-490
```

## Tips for Best Results

1. **Be specific:** "Update DESN-374" works better than "update that AI course"
2. **Use course codes:** DESN-368 is clearer than "Code + Design 1"
3. **Reference files:** "in courses/300-level/" helps Claude locate the right files
4. **Ask for validation:** "check if this makes sense" catches errors
5. **Iterate:** Start with "list", then "show details", then "modify"

## Extending the Catalog

### Add Custom Fields
```bash
claude code "add these fields to all course files: quarter_offered, enrollment_cap, lab_required"
```

### Create New Views
```bash
claude code "create a new file 'courses-by-software.md' that groups courses by software/tools used"
```

### Build Utilities
```bash
claude code "create a script that checks for broken prerequisite links"
```

## Notes

- All course files use YAML frontmatter for metadata
- Prerequisites are stored as arrays for easy parsing
- Track names use kebab-case (web-development, not Web Development)
- Course codes use format DESN-XXX (with hyphen, not space)
- Repeatable courses marked with `repeatable: true` in frontmatter
