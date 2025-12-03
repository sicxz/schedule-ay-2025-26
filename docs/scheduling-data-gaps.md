# Data Gaps for Improved Schedule Generation

This document identifies data that would improve the accuracy and automation of the EWU Design schedule generation system.

---

## Current Data Available

| Data Source | Description | Quality |
|-------------|-------------|---------|
| `enrollment-dashboard-data.json` | 3+ years of enrollment history (Fall 2022 - Fall 2025) | Good |
| `data/prerequisite-graph.json` | Course dependencies and flow rates | Good |
| `data/course-catalog.json` | Course metadata (credits, caps, offered quarters) | Good |
| `workload-data.json` | Faculty workload and historical assignments | Good |

---

## Priority 1: Room Inventory and Constraints

### What's Missing
- Available room list with room numbers
- Room capacities (how many students each room holds)
- Room equipment (computer labs, projectors, etc.)
- Room availability by time slot
- Building/location information

### Current Workaround
Rooms are assigned manually after schedule generation. No automated conflict checking.

### Ideal Data Format
```json
{
  "rooms": {
    "CEB-206": {
      "capacity": 24,
      "equipment": ["projector", "computers"],
      "building": "CEB",
      "floor": 2,
      "available": ["MW 8:00-18:00", "TR 8:00-18:00", "F 8:00-15:00"]
    }
  }
}
```

### Impact if Added
- Automatic room assignment based on section enrollment
- Conflict detection (double-booking prevention)
- Optimization for travel time between buildings

---

## Priority 2: Faculty Preferences

### What's Missing
- Preferred teaching times (morning vs. afternoon)
- Course preferences (which courses faculty want to teach)
- Days off preferences (e.g., no Fridays)
- Maximum courses per day
- Course expertise/qualification

### Current Workaround
Faculty are assigned based purely on historical teaching patterns. No preference consideration.

### Ideal Data Format
```json
{
  "facultyPreferences": {
    "T.Masingale": {
      "preferredTimes": ["morning"],
      "preferredDays": ["M", "T", "W", "Th"],
      "coursePreferences": ["DESN 368", "DESN 369", "DESN 378"],
      "maxCoursesPerDay": 2,
      "expertise": ["web-development", "ux-interaction"]
    }
  }
}
```

### Impact if Added
- Faculty satisfaction improvement
- Better course-faculty matching
- Automatic workload balancing

---

## Priority 3: Student Progress Tracking

### What's Missing
- Individual student course completion records
- Actual prerequisite completion rates
- Student major/minor declarations
- Expected graduation timelines
- Course waitlist data

### Current Workaround
Using estimated flow rates from historical enrollment ratios (e.g., 45% of DESN-216 students take DESN-368).

### Ideal Data Format
```json
{
  "studentProgress": {
    "cohort2024": {
      "totalStudents": 45,
      "coursesCompleted": {
        "DESN-216": 42,
        "DESN-243": 38,
        "DESN-368": 20
      },
      "expectedGraduation": "Spring 2028"
    }
  }
}
```

### Impact if Added
- Precise demand forecasting instead of estimates
- Bottleneck identification for degree completion
- Better prerequisite sequencing

---

## Priority 4: Pass/Fail and DFW Rates

### What's Missing
- Course pass rates by section
- Drop/Fail/Withdraw (DFW) rates
- Grade distributions
- Repeat student counts

### Current Workaround
All enrolled students assumed to pass. No accounting for repeaters.

### Ideal Data Format
```json
{
  "courseOutcomes": {
    "DESN-368": {
      "passRate": 0.92,
      "dfwRate": 0.08,
      "avgRepeatersPerQuarter": 2,
      "gradeDistribution": {"A": 0.3, "B": 0.45, "C": 0.15, "D": 0.05, "F": 0.05}
    }
  }
}
```

### Impact if Added
- Account for repeat students in demand forecasting
- Identify courses needing support resources
- Better capacity planning

---

## Priority 5: Cohort Size Projections

### What's Missing
- Incoming class sizes by year
- Major declaration rates
- Transfer student projections
- Retention rates by year

### Current Workaround
Relying on historical enrollment patterns without adjusting for program growth or decline.

### Ideal Data Format
```json
{
  "cohortProjections": {
    "2026-27": {
      "incomingFreshmen": 50,
      "transferStudents": 15,
      "retentionRate": 0.85,
      "expectedMajorDeclarations": 55
    }
  }
}
```

### Impact if Added
- Multi-year capacity planning
- Better prediction of upper-division demand
- Resource allocation improvements

---

## Priority 6: Time Slot History and Patterns

### What's Missing
- Standard department time blocks
- Historical time slot assignments
- Student time preferences
- Cross-listed course constraints

### Current Workaround
Manual time slot assignment. No optimization for student schedules.

### Ideal Data Format
```json
{
  "timeSlots": {
    "standard": [
      {"days": "MW", "start": "10:00", "end": "12:00"},
      {"days": "MW", "start": "13:00", "end": "15:00"},
      {"days": "TR", "start": "10:00", "end": "12:00"}
    ],
    "historicalAssignments": {
      "DESN-368": {"typical": "MW 10:00-12:00", "frequency": 0.8}
    }
  }
}
```

### Impact if Added
- Automatic time slot assignment
- Conflict minimization for students
- Better scheduling consistency

---

## Summary: Data Collection Priorities

| Priority | Data Gap | Effort to Collect | Impact on Scheduling |
|----------|----------|-------------------|---------------------|
| 1 | Room Inventory | Medium | High |
| 2 | Faculty Preferences | Low (survey) | High |
| 3 | Student Progress | High (requires Banner access) | High |
| 4 | Pass/Fail Rates | Low (institutional research) | Medium |
| 5 | Cohort Projections | Medium | Medium |
| 6 | Time Slot Patterns | Low | Medium |

---

## Recommended Next Steps

1. **Immediate (Low Effort)**
   - Create faculty preference survey
   - Request pass/fail data from Institutional Research
   - Document standard time slots

2. **Short-term (Medium Effort)**
   - Build room inventory database
   - Collect cohort projection data from admissions

3. **Long-term (High Effort)**
   - Integrate with Banner for student progress data
   - Build automated data refresh pipeline

---

## Data File Locations

When data becomes available, add files to:

```
schedule/
├── data/
│   ├── room-inventory.json        (Priority 1)
│   ├── faculty-preferences.json   (Priority 2)
│   ├── student-progress.json      (Priority 3)
│   ├── course-outcomes.json       (Priority 4)
│   ├── cohort-projections.json    (Priority 5)
│   └── time-slot-patterns.json    (Priority 6)
```

Update `js/schedule-generator.js` to incorporate new data sources as they become available.
