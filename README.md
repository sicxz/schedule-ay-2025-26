# EWU Design Schedule Analyzer

Interactive analytics dashboards for analyzing enrollment trends, faculty workload, and capacity planning for the EWU Design program.

## 🚀 Quick Start

1. Clone the repository
2. Start a local web server:
   ```bash
   python3 -m http.server 8080
   ```
3. Open your browser to `http://localhost:8080`

## 📊 Dashboards

### Schedule Analyzer (Main)
**`index.html`**

The main dashboard providing an overview of:
- Current enrollment data visualization
- Quick access to all specialized dashboards
- Academic year filtering

### Enrollment Trends Dashboard
**`enrollment-dashboard.html`**

Comprehensive enrollment analysis featuring:
- Quarterly enrollment trends from Fall 2022 to Spring 2025
- Course-level enrollment tracking across 40+ design courses
- Growth/decline indicators for each course
- Census data visualization by quarter
- Enrollment forecasting with confidence intervals
- Year-over-year comparison tools

### Capacity Planning Dashboard
**`pages/capacity-planning-dashboard.html`**

Faculty capacity and workload analysis:
- Real-time faculty capacity vs. current load visualization
- Utilization rate tracking (underutilized, optimal, overloaded)
- Release time indicators (sabbatical, chair duties)
- Applied learning toggle (include/exclude 499, 495 courses)
- Student-to-faculty ratio analysis
- Enrollment forecast vs. faculty capacity projections
- Individual faculty capacity table with status indicators

**Visual Indicators:**
- 🟢 Green: Underutilized (<60%)
- 🟠 Orange: Optimal (60-100%)
- 🔴 Red: Overloaded (>100%)
- 🟡 Yellow: Release time (sabbatical/chair)

### Applied Learning Dashboard
**`pages/applied-learning-dashboard.html`**

Tracks student projects and independent study:
- DESN 495 (Internship) enrollment and workload
- DESN 499 (Independent Study) tracking
- Faculty supervision load from applied learning
- Quarter-by-quarter applied learning trends

### Workload Dashboard
**`pages/workload-dashboard.html`**

Detailed faculty workload analysis:
- Individual faculty workload tracking
- Course assignment visualization
- Workload distribution across quarters
- Applied learning supervision hours
- Historical workload trends by academic year

## 📁 Project Structure

```
schedule/
├── index.html                      # Main dashboard
├── enrollment-dashboard.html       # Enrollment trends
├── pages/
│   ├── capacity-planning-dashboard.html
│   ├── capacity-planning-dashboard.js
│   ├── applied-learning-dashboard.html
│   ├── applied-learning-dashboard.js
│   ├── workload-dashboard.html
│   └── workload-dashboard.js
├── css/
│   ├── shared.css                  # Shared styles across dashboards
│   └── dashboard.css               # Dashboard-specific styles
├── js/
│   ├── chart-utils.js              # Chart.js helper functions
│   ├── data-loader.js              # Data loading utilities
│   ├── faculty-utils.js            # Faculty-related utilities
│   └── year-filter.js              # Year filtering logic
├── scripts/
│   ├── process-enrollment-data.js  # Data processing pipeline
│   ├── workload-calculator.js      # Faculty workload calculations
│   ├── faculty-mapping.json        # Faculty configuration
│   └── transform-corrected-csv.js  # CSV transformation tools
├── enrollment-data/
│   └── processed/
│       └── corrected-all-quarters.csv
├── enrollment-dashboard-data.json  # Processed enrollment data
└── workload-data.json              # Processed workload data
```

## 🔧 Data Processing

### Updating Enrollment Data

1. Add new enrollment CSV to `enrollment-data/processed/`
2. Run the data processor:
   ```bash
   node scripts/process-enrollment-data.js
   ```
3. This regenerates:
   - `enrollment-dashboard-data.json`
   - `workload-data.json`

### Faculty Configuration

Faculty capacities and status are managed in `scripts/faculty-mapping.json`:

```json
{
  "facultyStatusByYear": {
    "2024-25": {
      "fullTime": ["Melinda Breen", "Sonja Durr", ...],
      "sabbatical": [],
      "adjunct": ["Shelby Allison", ...]
    }
  },
  "individualCapacities": {
    "2024-25": {
      "Melinda Breen": 36,
      "Sonja Durr": 45,
      ...
    }
  }
}
```

**Capacity Guidelines:**
- **Full/Associate Professors**: 36 credits
- **Assistant Professors**: 36 credits
- **Senior Lecturers**: 45 credits
- **Lecturers**: 45 credits
- **Adjuncts**: Varies (typically 5-15 credits)

### Workload Calculation

Workload credits are calculated as:
- **Regular courses**: Credit hours × 1.0
- **DESN 495 (Internship)**: Credit hours × 0.1
- **DESN 499 (Independent Study)**: Credit hours × 0.2

**Manual Overrides (AY 2025-26):**
- Melinda Breen: 36 credits (set based on outside data)
- Ginelle Hustrulid: 36 credits (set based on outside data)
- Travis Masingale: +4 credits projected applied learning
- Simeon Mills: +5 credits for advising
- Sonja Durr: +5 credits for advising

> **Note:** Manual overrides are temporary until release time can be properly reflected in the calculation system.

## 📈 Data Sources

### Enrollment Data
- Source: Corrected enrollment CSV from institutional data
- Coverage: Fall 2022 through Spring 2025 (actual)
- Projections: 2025-26 based on published schedules

### Faculty Data
- Full-time faculty assignments
- Adjunct instructor assignments
- Sabbatical and chair release tracking
- Historical workload from Fall 2022 to present

## 🎯 Features

### Academic Year Filtering
All dashboards support filtering by academic year:
- 2022-23
- 2023-24
- 2024-25 (current)
- 2025-26 (projected)

### Applied Learning Toggle
Capacity Planning Dashboard includes toggle to:
- Include applied learning (499, 495) in workload calculations
- Exclude applied learning for scheduled courses only view

### Release Time Tracking
System tracks and visualizes:
- Sabbatical leave (0 capacity)
- Chair duties (reduced capacity)
- Partial vs. full release indicators

## 🔮 Future Enhancements

### Planned Features
1. **Release Time Input System**
   - UI for adding/editing faculty release time
   - Automatic capacity adjustment calculations
   - Release reason tracking (sabbatical, chair, research, etc.)

2. **Course Recommendations Engine**
   - AI-powered course scheduling suggestions
   - Enrollment prediction improvements
   - Faculty assignment optimization

3. **Real-time Data Integration**
   - Direct integration with institutional databases
   - Automatic data refresh
   - Live enrollment tracking

## 📊 Technologies

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Charts**: Chart.js 4.4.0
- **Data Processing**: Node.js
- **Version Control**: Git/GitHub
- **Hosting**: GitHub Pages compatible

## 🤝 Contributing

When adding data or making changes:

1. Update source data in `enrollment-data/processed/`
2. Run data processing scripts
3. Test all dashboards locally
4. Commit with descriptive messages
5. Push to GitHub

## 📝 Notes

### Known Limitations
- Applied learning data for Winter/Spring 2026 is projected from schedules
- Some faculty workload includes manual overrides (documented in workload-data.json)
- Release time calculations are currently manual (automation planned)

### Data Quality
- Census data: Verified against institutional reports
- Enrollment trends: Based on corrected historical data
- Projections: Conservative estimates based on 3-year trends

## 📧 Contact

For questions or data updates, contact the Design Department.

---

**Last Updated:** November 2025
**Data Coverage:** Fall 2022 - Spring 2025 (actual), 2025-26 (projected)
