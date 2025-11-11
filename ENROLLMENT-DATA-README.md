# EWU Design Enrollment Data Processing System

**Last Updated:** November 11, 2025
**Version:** 1.0

---

## Overview

This system automates the processing and analysis of enrollment data for the EWU Design Department. It eliminates hardcoded data, calculates dynamic faculty workload, generates trend analytics, and produces forecasts for enrollment planning.

---

## Quick Start

### 1. Enter Enrollment Data

Use the CSV template to enter enrollment data from EWU Institutional Research reports:

```bash
# Copy the template
cp enrollment-entry-template.csv enrollment-data/processed/fall-2022.csv

# Edit with your data
# Open in Excel, Google Sheets, or text editor
```

### 2. Validate Data

Before processing, validate your CSV files for errors:

```bash
# Validate a single file
node scripts/validate-enrollment.js enrollment-data/processed/fall-2022.csv

# Validate all files in a directory
node scripts/validate-enrollment.js enrollment-data/processed/
```

### 3. Process Data

Generate analytics and dashboard data:

```bash
# Process all CSV files in the default directory
node scripts/process-enrollment-data.js

# Or specify a custom directory
node scripts/process-enrollment-data.js ./enrollment-data/processed
```

This will generate `enrollment-dashboard-data.json` with:
- Course statistics (average, peak, trend)
- Dynamic faculty workload calculations
- Census data and quarterly trends
- Enrollment forecasts

### 4. View Dashboard

Open `enrollment-dashboard.html` in your browser. The dashboard will automatically load the generated JSON data if available.

---

## Directory Structure

```
schedule/
├── enrollment-entry-template.csv          # CSV template for data entry
├── enrollment-dashboard-data.json         # Generated analytics (auto-created)
├── enrollment-dashboard.html              # Visualization dashboard
├── index.html                              # Main schedule analyzer
├── scripts/
│   ├── validate-enrollment.js             # Data validation tool
│   └── process-enrollment-data.js         # Data processing agent
├── enrollment-data/
│   ├── raw/                                # PNG screenshots from IR
│   └── processed/                          # CSV files (quarter per file)
└── course-enrollement-trends-2022-2025/
    └── 2022-23/
        ├── fall-2022/                      # 4 PNG screenshots
        ├── winter-2023/                    # 4 PNG screenshots
        └── spring-2023/                    # 4 PNG screenshots
```

---

## CSV Data Entry Guide

### Template Fields

| Field | Description | Example | Required |
|-------|-------------|---------|----------|
| `AcademicYear` | Academic year (YYYY-YY) | 2022-23 | ✅ |
| `Quarter` | Fall, Winter, Spring, Summer | Fall | ✅ |
| `CensusDate` | Census date (YYYY-MM-DD) | 2022-10-07 | ❌ |
| `CourseCode` | Course code with space | DESN 100 | ✅ |
| `Section` | Section number | 001 | ❌ |
| `CRN` | Course registration number | 16234 | ❌ |
| `Instructor` | Last, First format | Mills, Simeon | ❌ |
| `Capacity` | Total capacity | 25 | ✅ |
| `Enrolled` | Students enrolled | 21 | ✅ |
| `SeatsRemaining` | Seats remaining | 4 | ❌ |
| `Waitlist` | Waitlist count | 0 | ❌ |
| `Campus` | Cheney, Online, Hybrid | Cheney | ❌ |
| `Days` | Meeting days | MWF | ❌ |
| `StartTime` | 24-hour format | 10:00 | ❌ |
| `EndTime` | 24-hour format | 12:20 | ❌ |
| `Credits` | Credit hours | 5 | ❌ |
| `ScheduleType` | Performance, Lecture, etc. | Performance | ❌ |
| `DeliveryMode` | Campus, Online, Hybrid, ITV | Campus | ❌ |
| `Room` | Room number | 209 | ❌ |
| `Building` | Building name/code | CEB | ❌ |

### Data Entry Tips

1. **"X of Y seats remain" = Enrolled**
   - Example: "4 of 25 seats remain" → Enrolled = 21 (25 - 4)
   - Capacity = 25, Enrolled = 21, SeatsRemaining = 4

2. **One CSV file per quarter**
   - `fall-2022.csv`, `winter-2023.csv`, `spring-2023.csv`
   - Include all sections from all PNG screenshots

3. **Online vs In-Person Sections**
   - Use `DeliveryMode` field: Campus, Online, Hybrid
   - Use different section numbers: 001 (campus), 040 (online)

4. **Validation is Your Friend**
   - Always run validation before processing
   - Fix all errors (❌) before proceeding
   - Warnings (⚠️) are informational but should be reviewed

---

## Validation Script

### Usage

```bash
# Single file
node scripts/validate-enrollment.js data.csv

# Directory
node scripts/validate-enrollment.js ./enrollment-data/processed/
```

### What It Checks

✅ **Required fields** - AcademicYear, Quarter, CourseCode, Capacity, Enrolled
✅ **Math validation** - Capacity = Enrolled + SeatsRemaining
✅ **Numeric fields** - Capacity, Enrolled, Credits must be numbers
✅ **Format validation** - Course codes, academic years, quarters
✅ **DESN 495 warning** - Flags discontinued course

### Example Output

```
📋 Validating: fall-2022.csv
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Validation Summary:
   Total rows: 33
   ✅ Valid: 32
   ❌ Errors: 1
   ⚠️  Warnings: 0

❌ ERRORS (1):
   Row 15: DESN 216 - 001
      • Capacity mismatch: 25 ≠ 24 + 2

❌ Validation failed. Please fix errors before proceeding.
```

---

## Processing Agent

### Features

The `process-enrollment-data.js` agent automatically:

1. **Loads all CSV files** from the processed directory
2. **Calculates course statistics**:
   - Average enrollment across all quarters
   - Peak enrollment and quarter
   - Trend analysis (growing, declining, stable)
   - Quarterly breakdowns

3. **Generates census data**:
   - Program headcount per quarter
   - Total seat enrollments
   - Quarter-over-quarter (QoQ) growth
   - Year-over-year (YoY) growth

4. **Calculates faculty workload** (dynamic):
   - Total students per faculty member
   - Number of sections taught
   - Course assignments per quarter

5. **Produces forecasts**:
   - Linear regression predictions
   - 95% confidence intervals
   - Growth rate analysis

6. **Outputs JSON** for dashboard consumption

### Usage

```bash
# Default: reads from ./enrollment-data/processed
node scripts/process-enrollment-data.js

# Custom directory
node scripts/process-enrollment-data.js ./my-data/
```

### Example Output

```
🚀 Starting Enrollment Data Processing

📂 Loading enrollment data from: ./enrollment-data/processed
Found 3 CSV file(s)
   Loading: fall-2022.csv
   Loading: winter-2023.csv
   Loading: spring-2023.csv
✅ Loaded 112 enrollment records

📊 Calculating course statistics...
✅ Processed 28 courses

📈 Calculating census data...
✅ Generated census data for 10 quarters

📊 Calculating enrollment trends...
✅ Calculated trends for 10 quarters

👥 Calculating faculty workload...
✅ Calculated workload for 7 faculty members

💾 Generating output file...
🔮 Generating enrollment forecast...
   Forecast: 127 students (95% CI: 115-139)
   Trend: growing (2.3% per quarter)

✅ Output written to: ./enrollment-dashboard-data.json

═════════════════════════════════════════════════════════════
📊 ENROLLMENT PROCESSING SUMMARY
═════════════════════════════════════════════════════════════

📈 Program Overview:
   Latest Quarter: Fall 2025
   Current Headcount: 124 students
   Overall Growth: +33 (+36.3%)
   Period: Fall 2022 → Fall 2025

📚 Course Statistics:
   Total Courses: 28
   Total Sections: 112
   Growing: 5 | Declining: 3 | Stable: 20

👥 Faculty Workload:
   A.Sopu: 315 students, 9 sections
   M.Lybbert: 143 students, 8 sections
   S.Mills: 141 students, 7 sections
   S.Durr: 132 students, 8 sections
   C.Manikoth: 125 students, 7 sections
   G.Hustrulid: 77 students, 4 sections
   T.Masingale: 72 students, 4 sections

═════════════════════════════════════════════════════════════

✅ Processing complete!
```

---

## Dashboard Integration

### How It Works

1. When `enrollment-dashboard.html` loads, it attempts to fetch `enrollment-dashboard-data.json`
2. If found, it uses **dynamic data** from the JSON file
3. If not found, it falls back to **placeholder data** and logs a warning

### Using Dynamic Data

After running `process-enrollment-data.js`, simply refresh the dashboard:

```bash
# Process data
node scripts/process-enrollment-data.js

# Open dashboard
open enrollment-dashboard.html
```

The dashboard will display:
- ✅ Dynamic faculty workload (accurate, from actual schedule)
- ✅ Real enrollment trends from CSV data
- ✅ Forecasts based on historical data

### Console Output

Open browser console (F12) to see:

```
✅ Loaded dynamic enrollment data from enrollment-dashboard-data.json
   Generated: 2025-11-11T17:30:00.000Z
   Total Records: 112
```

Or if not found:

```
⚠️ Could not load enrollment-dashboard-data.json
   Run: node scripts/process-enrollment-data.js to generate dynamic data
⚠️ Using placeholder faculty data. Run process-enrollment-data.js for accurate workload.
```

---

## Important Notes

### DESN 495 Discontinued

**DESN 495 (Portfolio)** has been discontinued as of AY 2025-26.
Portfolio curriculum has been merged into **DESN 490 (Capstone)**.

- Validation script will warn if DESN 495 appears in data
- Historical data (2022-2025) may include DESN 495
- Do not enter DESN 495 for 2025-26 or later

### Data Accuracy

**Current Status:**
- ✅ Validation script catches common errors
- ✅ Processing agent calculates dynamic metrics
- ⚠️ Manual data entry from PNG screenshots (15 min/quarter)

**Future Improvements:**
- 🔮 OCR automation for PNG screenshots
- 🔮 API integration with Banner system
- 🔮 Real-time enrollment tracking

---

## Workflow Example

### Adding New Quarter Data

1. **Obtain Data**
   - Get PNG screenshots from EWU Institutional Research
   - Save to `course-enrollement-trends-2022-2025/[year]/[quarter]/`

2. **Enter Data**
   ```bash
   cp enrollment-entry-template.csv enrollment-data/processed/winter-2026.csv
   # Open CSV and enter data from screenshots
   ```

3. **Validate**
   ```bash
   node scripts/validate-enrollment.js enrollment-data/processed/winter-2026.csv
   # Fix any errors
   ```

4. **Process**
   ```bash
   node scripts/process-enrollment-data.js
   ```

5. **View Results**
   - Open `enrollment-dashboard.html` in browser
   - Review updated trends and forecasts
   - Share insights with department

---

## Troubleshooting

### Validation Errors

**"Capacity mismatch"**
- Check: Capacity = Enrolled + SeatsRemaining
- Common issue: Typo in one of the three fields

**"Missing required field"**
- Ensure all required fields have values
- Required: AcademicYear, Quarter, CourseCode, Capacity, Enrolled

**"Invalid quarter"**
- Use: Fall, Winter, Spring, or Summer
- Case-sensitive

### Processing Issues

**"No CSV files found"**
- Check that CSV files are in `enrollment-data/processed/`
- Ensure files have `.csv` extension

**"Failed to parse file"**
- Check CSV formatting
- Ensure commas are used as delimiters
- Quote fields with commas (e.g., "Mills, Simeon")

### Dashboard Issues

**"Could not load enrollment-dashboard-data.json"**
- Run: `node scripts/process-enrollment-data.js`
- Check that output file was created
- Ensure dashboard and JSON are in same directory

**Faculty workload shows placeholder data**
- Check browser console for warnings
- Regenerate JSON with processing script
- Hard refresh browser (Cmd+Shift+R)

---

## Next Steps (Roadmap)

### Phase 2: Enhanced Analytics (Weeks 3-4)
- [ ] Add section efficiency metrics (fill rates)
- [ ] Create under-enrollment alerts
- [ ] Build capacity planning tools
- [ ] Add yearly comparison views

### Phase 3: Predictive Tools (Weeks 5-6)
- [ ] Implement multiple linear regression
- [ ] Add confidence intervals to forecasts
- [ ] Create early warning systems
- [ ] Faculty planning predictor

### Phase 4: Automation (Future)
- [ ] OCR for PNG screenshots
- [ ] API integration with Banner
- [ ] Real-time enrollment sync
- [ ] Automated quarterly reports

---

## Support & Documentation

**Files:**
- `enrollment-entry-template.csv` - CSV template
- `scripts/validate-enrollment.js` - Validation tool
- `scripts/process-enrollment-data.js` - Processing agent
- `course-categorizations.md` - Course reference
- `enrollment-implementation-summary.md` - Implementation notes

**Key Resources:**
- EWU Office of Institutional Research
- Banner enrollment reports
- Department schedule data

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Nov 11, 2025 | Initial system deployment |

---

*This automated system replaces hardcoded enrollment data with dynamic processing, enabling accurate workload calculation, trend analysis, and enrollment forecasting.*
