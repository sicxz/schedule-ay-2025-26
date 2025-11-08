# EWU Design Course Catalog

Complete course catalog for Eastern Washington University Design Department, structured for Claude Code workflow.

## Structure

```
courses/
├── 100-level/          # Foundation courses
├── 200-level/          # Skill-building & introductions
├── 300-level/          # Intermediate & specialized
├── 400-level/          # Advanced & capstone
└── by-track/           # Organized by specialization
```

## Frontmatter Fields

Each course file includes:
- `course_code`: Official course number
- `course_name`: Full course title
- `credits`: Credit hours (or range)
- `level`: 100/200/300/400
- `prerequisites`: Array of required courses
- `corequisites`: Courses that can be taken concurrently
- `track`: Primary specialization area
- `topics`: Key concepts covered
- `satisfies`: Graduation requirements
- `repeatable`: Boolean for experimental/workshop courses

## Tracks

- **foundations**: Core design skills (drawing, digital basics, visual thinking)
- **web-development**: HTML/CSS/JS, full-stack development
- **ai-emergent**: AI tools, emerging technologies
- **animation-motion**: Animation, motion graphics, 3D
- **ux-interaction**: User experience, interaction design
- **game-design**: Board games, digital games, world-building
- **typography-publication**: Typography, editorial, zine-making
- **photography-video**: Still and moving image capture
- **audio**: Sound design, digital audio production
- **adobe-tools**: Software-specific 2-credit modules
- **professional**: Portfolio, internship, capstone, practice

## Claude Code Usage Examples

Search by track:
```bash
claude code "list all web-development track courses with their prerequisites"
```

Find course connections:
```bash
claude code "show me what courses use DESN-216 as a prerequisite"
```

Update metadata:
```bash
claude code "add 'taught_by' field to DESN-374, DESN-368, and DESN-216"
```

Generate curriculum map:
```bash
claude code "create a flowchart showing the web development sequence from 216→368→378→468"
```

## Notes

- Experimental courses (396, 496) and directed studies (399, 499) have variable credit hours
- Some courses marked "repeatable" can be taken multiple times
- Prerequisites format: array of course codes, "or" indicates alternatives
- Standing requirements: "junior standing" = 90+ credits, "senior standing" = 135+ credits
