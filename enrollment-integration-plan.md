# Enrollment Data Integration Plan
**EWU Design Department Schedule Analyzer**
**Created:** November 7, 2025

---

## Executive Summary

This document outlines the strategy for integrating historical enrollment data (2022-2025) into the EWU Design Schedule Analyzer to enable data-driven scheduling decisions, capacity planning, and conflict resolution.

---

## 1. Available Data Sources

### Enrollment Trend Images
**Location:** `/Users/tmasingale/documents/github/schedule/course-enrollement-trends-2022-2025/`

**Files:**
1. CleanShot 2025-11-07 at 15.40.05@2x.png - Department overview dashboard
2. CleanShot 2025-11-07 at 15.43.22@2x.png - Course enrollment data (set 1)
3. CleanShot 2025-11-07 at 15.43.27@2x.png - Course enrollment data (set 2)
4. CleanShot 2025-11-07 at 15.43.32@2x.png - Course enrollment data (set 3)
5. CleanShot 2025-11-07 at 15.43.39@2x.png - Course enrollment data (set 4)
6. CleanShot 2025-11-07 at 15.43.45@2x.png - Course enrollment data (set 5)
7. CleanShot 2025-11-07 at 15.43.52@2x.png - Course enrollment data (set 6)

### Data Coverage
- **Time Period:** Fall 2022 through Fall 2025 (12+ quarters)
- **Courses Tracked:** 40+ DESN courses (100-499 level)
- **Granularity:** Quarter-by-quarter enrollment counts
- **Department Aggregate:** Overall headcount trends (91-128 students)

### Data Format
- Visual line graphs showing enrollment trends
- Actual enrollment numbers labeled on data points
- Organized by academic year columns (2022-23, 2023-24, 2024-25)
- Sparkline format for quick trend visualization

---

## 2. Integration Strategy

### Approach 1: Enrollment Counts on Course Blocks

**Display Method:**
- Add enrollment indicator to each course block in schedule grid
- Show average enrollment or most recent quarter data
- Update course block HTML to include enrollment badge

**Visual Design:**
```
┌─────────────────────────┐
│ DESN 338               │
│ UX Design 1            │
│ M.Lybbert    [👥 18]   │
└─────────────────────────┘
```

**Data Points:**
- Average enrollment across all offerings
- Most recent quarter enrollment
- Peak enrollment (highest recorded)

### Approach 2: Historical Trend on Hover

**Interaction:**
- Hover over course block to see detailed enrollment history
- Display tooltip with quarter-by-quarter breakdown
- Include trend indicator (↗ growing, ↘ declining, → stable)

**Tooltip Content:**
```
DESN 338 - UX Design 1
━━━━━━━━━━━━━━━━━━━━━━
Fall 2022:   23 students
Winter 2023: 18 students
Spring 2023: 21 students
Fall 2023:   19 students
Winter 2024: 22 students
Spring 2024: 25 students ↗

Trend: Growing (+8.7%)
Average: 21 students
Peak: 25 (Spring 2024)
```

### Approach 3: Enrollment Analytics Panel

**New Dashboard Section:**
Located above or below the conflicts panel

**Components:**

#### A. Enrollment Distribution
- **High Demand** (30+ students)
  - List courses exceeding typical capacity
  - Suggest larger room assignments

- **Medium Demand** (15-29 students)
  - Standard enrollment courses
  - Current room assignments appropriate

- **Low Demand** (<15 students)
  - Flag for review
  - Consider consolidation or alternate quarter offering

#### B. Quarterly Trends
- Line chart showing department-wide enrollment by quarter
- Identify peak enrollment periods
- Forecast future quarters based on 3-year trend

#### C. At-Risk Courses
- Courses with declining enrollment (>30% drop year-over-year)
- Courses with inconsistent offerings
- Recommendations for schedule optimization

### Approach 4: Color-Coded Enrollment Indicators

**Visual System:**

**High Enrollment (30+):**
- Border accent: Bold/thick
- Background intensity: Darker
- Icon: 👥👥👥

**Medium Enrollment (15-29):**
- Border accent: Standard
- Background intensity: Medium
- Icon: 👥👥

**Low Enrollment (<15):**
- Border accent: Thin
- Background intensity: Light
- Icon: 👥

**Implementation:**
Add CSS classes based on enrollment thresholds:
```css
.enrollment-high { border-width: 4px; opacity: 1.0; }
.enrollment-medium { border-width: 3px; opacity: 0.85; }
.enrollment-low { border-width: 2px; opacity: 0.7; }
```

### Approach 5: Insights & Validation

**Track/Minor Correlation Analysis:**
- Cross-reference students taking UX courses (DESN 338, 348, 458) with Animation courses (DESN 326, 355, 365)
- Validate assumption: "UX students typically don't pursue Animation minor"
- Generate data-driven minor recommendations

**Course Sequencing Analysis:**
- Track enrollment flow: DESN 100 → DESN 200 → DESN 263
- Identify bottlenecks where students can't progress
- Optimize prerequisite course offerings

**Conflict Impact Quantification:**
- Calculate how many students affected by scheduling conflicts
- Prioritize conflict resolution based on enrollment numbers
- Measure improvement after schedule changes

---

## 3. Key Metrics to Extract

### Per-Course Metrics

1. **Average Enrollment**
   - Mean across all quarters offered
   - Used for general capacity planning

2. **Enrollment Variance**
   - Standard deviation
   - Indicates stability/predictability

3. **Year-over-Year Growth Rate**
   - Percent change from previous year
   - Identifies trending courses

4. **Peak Quarter**
   - Which quarter (Fall/Winter/Spring) has highest enrollment
   - Informs when to offer course

5. **Offering Frequency**
   - How consistently course is offered
   - Identifies irregular offerings

6. **Trend Direction**
   - Growing, declining, or stable
   - Based on linear regression over time

### Department-Level Metrics

1. **Total Headcount by Quarter**
   - Overall program enrollment
   - Capacity planning for facilities

2. **Quarter-to-Quarter Retention**
   - How many students continue from one quarter to next
   - Program health indicator

3. **Peak Enrollment Period**
   - Fall consistently highest (new students)
   - Spring graduation impact

---

## 4. Data Structure

### Enrollment Data Object
```javascript
const enrollmentData = {
  "DESN 338": {
    courseName: "UX Design 1",
    quarters: {
      "2022-fall": 23,
      "2023-winter": 18,
      "2023-spring": 21,
      "2023-fall": 19,
      "2024-winter": 22,
      "2024-spring": 25,
      "2024-fall": 27,
      "2025-winter": 24,
      "2025-spring": 26
    },
    metrics: {
      average: 22.8,
      variance: 2.9,
      peakQuarter: "fall",
      trend: "growing",
      growthRate: 8.7,
      peakEnrollment: 27,
      lowestEnrollment: 18,
      offeringFrequency: "consistent"
    }
  },
  "DESN 216": {
    courseName: "Digital Foundations",
    quarters: {
      "2022-fall": 73,
      "2023-winter": 51,
      "2023-spring": 47,
      "2023-fall": 54,
      "2024-winter": 48,
      "2024-spring": 52,
      "2024-fall": 49
    },
    metrics: {
      average: 53.4,
      variance: 8.2,
      peakQuarter: "fall",
      trend: "declining",
      growthRate: -32.9,
      peakEnrollment: 73,
      lowestEnrollment: 47,
      offeringFrequency: "every-quarter"
    }
  }
  // ... additional courses
};
```

---

## 5. Use Cases

### Use Case 1: Room Assignment Optimization
**Scenario:** DESN 216 averages 53 students but is assigned to 209 Mac Lab (capacity ~25)

**Data-Driven Decision:**
- Check enrollment history: consistently 45-73 students
- Peak in Fall quarter (73 students)
- Recommendation: Assign to larger room or add second section

### Use Case 2: Course Offering Schedule
**Scenario:** DESN 350 (Photography) currently offered Spring only

**Validation:**
- Check historical enrollment when offered in other quarters
- If Fall enrollment historically low (e.g., <10), validate Spring-only approach
- If demand exists in Fall, consider dual offering

### Use Case 3: Conflict Resolution Priority
**Scenario:** Multiple conflicts identified, which to fix first?

**Data-Driven Approach:**
1. Calculate students affected: DESN 379 (18) vs DESN 401 (12) vs DESN 463 (10)
2. Prioritize resolving conflict for DESN 379 (highest enrollment)
3. Consider moving lower-enrollment course to different time

### Use Case 4: Minor Program Assessment
**Scenario:** Is the Animation minor attracting students?

**Analysis:**
- Track enrollment in Animation courses (DESN 326, 355, 365, 336)
- Compare to other electives at same level
- If consistently low (<10), reassess minor requirements or marketing

### Use Case 5: Capstone Section Planning
**Scenario:** How many Capstone sections needed?

**Forecast:**
- Review enrollment trends for graduating class size
- Check DESN 490 historical enrollment: Fall (22), Winter (18), Spring (16)
- Plan for 2-3 sections to accommodate ~50-60 seniors

---

## 6. Implementation Steps

### Phase 1: Data Extraction (Manual/Automated)
1. Read enrollment PNG images
2. Extract enrollment numbers for each course by quarter
3. Create structured JSON data file
4. Validate data accuracy against source images

### Phase 2: Data Processing
1. Calculate metrics (average, variance, trends)
2. Categorize courses by enrollment size
3. Identify anomalies and outliers
4. Generate trend predictions

### Phase 3: UI Integration
1. Update course block HTML to include enrollment badges
2. Add hover tooltips with historical data
3. Create enrollment analytics panel
4. Implement color-coding system
5. Add filters for enrollment levels

### Phase 4: Analytics & Insights
1. Build correlation analysis tools
2. Create demand forecasting algorithms
3. Generate automated recommendations
4. Export reports for administrators

---

## 7. Expected Outcomes

### Immediate Benefits
- **Visual clarity** on which courses are high-demand
- **Data-driven room assignments** based on actual enrollment
- **Conflict prioritization** focused on most-affected students
- **Capacity planning** for future quarters

### Strategic Insights
- **Program health indicators** (growing/declining enrollment)
- **Minor program viability** (enrollment in minor courses)
- **Curriculum optimization** (when to offer specific courses)
- **Resource allocation** (faculty assignments based on demand)

### Decision Support
- **Evidence-based scheduling** rather than assumptions
- **Predictive forecasting** for next academic year
- **Bottleneck identification** in course sequences
- **ROI analysis** for course offerings

---

## 8. Technical Considerations

### Data Freshness
- Enrollment data is historical (2022-2025)
- Need mechanism to update with new quarter data
- Consider quarterly data refresh process

### Accuracy
- Manual extraction from images may have errors
- Validate critical numbers against registrar reports
- Implement data quality checks

### Performance
- Large dataset (40+ courses × 12 quarters)
- Optimize data structure for fast lookup
- Consider caching frequently accessed metrics

### Privacy
- Aggregate data only (no individual student records)
- Comply with FERPA regulations
- Anonymize any detailed analytics

---

## 9. Success Metrics

### Quantitative
- **Reduced conflicts:** Decrease from 7 to <3 critical conflicts
- **Improved utilization:** Room capacity matches enrollment ±10%
- **Forecast accuracy:** Enrollment predictions within ±15% of actual
- **Time saved:** 50% reduction in manual schedule planning time

### Qualitative
- **User satisfaction:** Faculty and advisors find tool helpful
- **Decision confidence:** Administrators feel equipped to make changes
- **Process improvement:** Scheduling becomes more systematic
- **Student experience:** Fewer students blocked by conflicts

---

## 10. Future Enhancements

### Advanced Analytics
- Machine learning for enrollment prediction
- Student pathway analysis (track individual progress)
- Real-time enrollment tracking integration
- Automated schedule optimization algorithms

### Integration Opportunities
- Connect to Banner/SIS for live enrollment data
- Export schedules to course catalog systems
- Integration with room booking systems
- Advising tool integration for student planning

### Reporting
- Automated quarterly reports for department chair
- Enrollment trend visualizations (charts/graphs)
- Comparative analysis across academic years
- Export to Excel/PDF for presentations

---

## Appendix A: Sample Data Points

### High Enrollment Courses (30+)
- DESN 216 (Digital Foundations): 53 avg, 73 peak
- DESN 100 (Drawing Communication): 48 avg, 45-48 range
- DESN 243 (Typography): 25 avg, growing trend

### Medium Enrollment Courses (15-29)
- DESN 338 (UX 1): 23 avg, stable
- DESN 359 (Histories of Design): 19 avg, growing
- DESN 263 (VCD 1): 18 avg, stable

### Low Enrollment Courses (<15)
- DESN 463 (Community Design): 12 avg, declining
- DESN 490 (Capstone): 14 avg, variable
- DESN 336 (3D Animation): 8 avg, low demand

### Declining Trends (>30% drop)
- DESN 100: 48 → 45 → 14 (-70% in 2024-25)
- DESN 463: 16 → 10 (-37.5%)

---

## Appendix B: Data Quality Notes

### Known Limitations
- Summer quarter data sparse (limited offerings)
- Some courses not offered every quarter (gaps in data)
- 2025 data incomplete (only Fall quarter available)
- No individual student tracking (aggregate only)

### Validation Needed
- Cross-check enrollment numbers with registrar reports
- Verify course code consistency across quarters
- Confirm room capacity numbers
- Validate faculty assignments

---

## Document Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Nov 7, 2025 | Initial plan document created | Claude |

---

*This plan serves as a roadmap for integrating enrollment data into the EWU Design Schedule Analyzer. Implementation will proceed in phases based on priority and resource availability.*
