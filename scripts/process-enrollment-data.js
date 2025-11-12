/**
 * EWU Design Enrollment Data Processing Agent
 *
 * Automatically processes enrollment CSV files and generates:
 * 1. Course enrollment statistics (average, peak, trend)
 * 2. Dynamic faculty workload calculations
 * 3. Quarter-over-quarter and year-over-year analytics
 * 4. Predictive forecasting data
 * 5. JSON output for dashboard consumption
 */

const fs = require('fs');
const path = require('path');

class EnrollmentProcessor {
    constructor(dataPath = './enrollment-data/processed') {
        this.dataPath = dataPath;
        this.rawData = [];
        this.courseStats = {};
        this.facultyWorkload = {};
        this.censusData = {
            quarters: [],
            headcount: [],
            totalEnrollments: []
        };
        this.quarterlyTrends = [];

        // Load faculty mapping for capacity planning
        this.facultyMapping = this.loadFacultyMapping();
    }

    /**
     * Load faculty mapping configuration
     */
    loadFacultyMapping() {
        try {
            const mappingPath = path.join(__dirname, 'faculty-mapping.json');
            const content = fs.readFileSync(mappingPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            console.warn('⚠️ Could not load faculty-mapping.json');
            return null;
        }
    }

    /**
     * Parse CSV file into records
     */
    parseCSV(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() !== '');

        if (lines.length === 0) return [];

        const headers = lines[0].split(',').map(h => h.trim());
        const records = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            const record = {};
            headers.forEach((header, index) => {
                record[header] = values[index] ? values[index].trim() : '';
            });
            records.push(record);
        }

        return records;
    }

    /**
     * Parse CSV line handling quoted values
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);

        return result;
    }

    /**
     * Load all CSV files from data directory
     */
    loadData() {
        console.log(`📂 Loading enrollment data from: ${this.dataPath}`);

        if (!fs.existsSync(this.dataPath)) {
            console.error(`❌ Data path not found: ${this.dataPath}`);
            return false;
        }

        const files = fs.readdirSync(this.dataPath)
            .filter(file => file.endsWith('.csv'))
            .map(file => path.join(this.dataPath, file));

        if (files.length === 0) {
            console.error('❌ No CSV files found');
            return false;
        }

        console.log(`Found ${files.length} CSV file(s)`);

        files.forEach(file => {
            console.log(`   Loading: ${path.basename(file)}`);
            const records = this.parseCSV(file);
            this.rawData.push(...records);
        });

        console.log(`✅ Loaded ${this.rawData.length} enrollment records\n`);
        return true;
    }

    /**
     * Calculate course-level statistics
     */
    calculateCourseStats() {
        console.log('📊 Calculating course statistics...');

        const courseSections = {};

        // Group by course code
        this.rawData.forEach(record => {
            const course = record.CourseCode;
            const enrolled = parseInt(record.Enrolled) || 0;

            // Map academic year to calendar year for quarter key
            // fall-2024-25 → fall-2024
            // winter-2024-25 → winter-2025
            // spring-2024-25 → spring-2025
            const [firstYear, secondYear] = record.AcademicYear.split('-');
            const calendarYear = record.Quarter === 'Fall' ? firstYear : `20${secondYear}`;
            const quarter = `${record.Quarter.toLowerCase()}-${calendarYear}`;

            if (!courseSections[course]) {
                courseSections[course] = {
                    enrollments: [],
                    quarterly: {},
                    sections: 0
                };
            }

            courseSections[course].enrollments.push(enrolled);

            // Track quarterly data
            if (!courseSections[course].quarterly[quarter]) {
                courseSections[course].quarterly[quarter] = [];
            }
            courseSections[course].quarterly[quarter].push(enrolled);
            courseSections[course].sections++;
        });

        // Calculate statistics for each course
        Object.keys(courseSections).forEach(course => {
            const data = courseSections[course];
            const enrollments = data.enrollments;

            if (enrollments.length === 0) {
                this.courseStats[course] = {
                    average: 0,
                    peak: 0,
                    trend: 'new',
                    peakQuarter: 'never-offered',
                    isNew: true,
                    sections: 0,
                    quarterly: {}
                };
                return;
            }

            // Calculate average
            const average = Math.round(enrollments.reduce((a, b) => a + b, 0) / enrollments.length);

            // Find peak
            const peak = Math.max(...enrollments);
            const peakQuarter = this.findPeakQuarter(data.quarterly);

            // Calculate trend using linear regression
            const trend = this.calculateTrend(enrollments);

            // Build quarterly aggregates (sum all sections per quarter)
            const quarterly = {};
            Object.keys(data.quarterly).forEach(q => {
                quarterly[q] = data.quarterly[q].reduce((a, b) => a + b, 0);
            });

            this.courseStats[course] = {
                average,
                peak,
                trend,
                peakQuarter,
                sections: data.sections,
                quarterly,
                isNew: enrollments.length < 3
            };
        });

        console.log(`✅ Processed ${Object.keys(this.courseStats).length} courses\n`);
    }

    /**
     * Find the quarter with peak enrollment
     */
    findPeakQuarter(quarterly) {
        let maxEnrollment = 0;
        let peakQuarter = '';

        Object.keys(quarterly).forEach(quarter => {
            const total = quarterly[quarter].reduce((a, b) => a + b, 0);
            if (total > maxEnrollment) {
                maxEnrollment = total;
                peakQuarter = quarter;
            }
        });

        return peakQuarter || 'unknown';
    }

    /**
     * Calculate enrollment trend using linear regression
     */
    calculateTrend(enrollments) {
        if (enrollments.length < 2) return 'new';

        const n = enrollments.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = enrollments;

        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

        // Classify trend
        if (slope > 1) return 'growing';
        if (slope < -1) return 'declining';
        return 'stable';
    }

    /**
     * Calculate dynamic faculty workload from actual schedule data
     */
    calculateFacultyWorkload(scheduleData) {
        console.log('👥 Calculating faculty workload...');

        const faculty = {};

        // Process each quarter's schedule
        Object.keys(scheduleData).forEach(quarter => {
            const quarterData = scheduleData[quarter];

            // Iterate through days and time slots
            Object.keys(quarterData).forEach(day => {
                Object.keys(quarterData[day]).forEach(time => {
                    const courses = quarterData[day][time];

                    courses.forEach(course => {
                        const instructor = course.instructor;
                        const courseCode = course.code;

                        if (!instructor || !courseCode) return;

                        // Initialize faculty record
                        if (!faculty[instructor]) {
                            faculty[instructor] = {
                                sections: 0,
                                students: 0,
                                courses: []
                            };
                        }

                        // Get enrollment from course stats
                        const enrollment = this.courseStats[courseCode]?.average || 0;

                        faculty[instructor].sections++;
                        faculty[instructor].students += enrollment;
                        faculty[instructor].courses.push({
                            code: courseCode,
                            quarter,
                            enrollment
                        });
                    });
                });
            });
        });

        this.facultyWorkload = faculty;

        console.log(`✅ Calculated workload for ${Object.keys(faculty).length} faculty members\n`);
        return faculty;
    }

    /**
     * Calculate capacity planning by academic year
     */
    calculateCapacityPlanning() {
        console.log('📐 Calculating capacity planning...');

        if (!this.facultyMapping || !this.facultyMapping.individualCapacities) {
            console.warn('⚠️ No faculty capacity data available');
            return null;
        }

        const capacityByYear = {};

        // Process each academic year
        Object.keys(this.facultyMapping.individualCapacities).forEach(academicYear => {
            const yearCapacities = this.facultyMapping.individualCapacities[academicYear];
            const facultyStatus = this.facultyMapping.facultyStatusByYear[academicYear];

            if (!facultyStatus) return;

            // Calculate total full-time capacity (adjuncts count as 0)
            let totalFullTimeCapacity = 0;
            let fullTimeFaculty = [];

            facultyStatus.fullTime.forEach(name => {
                const capacity = yearCapacities[name] || 0;
                totalFullTimeCapacity += capacity;
                fullTimeFaculty.push({ name, capacity });
            });

            // Calculate actual workload from enrollment data
            let totalStudentLoad = 0;
            let fullTimeLoad = 0;
            let adjunctLoad = 0;

            Object.entries(this.facultyWorkload).forEach(([name, data]) => {
                totalStudentLoad += data.students;

                if (facultyStatus.fullTime.includes(name)) {
                    fullTimeLoad += data.students;
                } else {
                    adjunctLoad += data.students;
                }
            });

            // Calculate net available capacity
            // Since adjuncts have 0 capacity, total demand = fullTimeLoad + adjunctLoad
            const totalDemand = fullTimeLoad + adjunctLoad;
            const netAvailable = totalFullTimeCapacity - totalDemand;

            capacityByYear[academicYear] = {
                totalFullTimeCapacity,
                fullTimeFaculty,
                fullTimeLoad,
                adjunctLoad,
                totalLoad: totalStudentLoad,
                totalDemand,
                netAvailable,
                capacityUtilization: totalFullTimeCapacity > 0
                    ? ((totalDemand / totalFullTimeCapacity) * 100).toFixed(1) + '%'
                    : 'N/A',
                overCapacity: totalDemand > totalFullTimeCapacity,
                adjunctCount: facultyStatus.adjunct?.length || 0
            };
        });

        console.log(`✅ Capacity planning calculated for ${Object.keys(capacityByYear).length} academic years\n`);
        return capacityByYear;
    }

    /**
     * Calculate census data (unique student headcount per quarter)
     */
    calculateCensusData() {
        console.log('📈 Calculating census data...');

        const quarterlyData = {};

        // Group by academic quarter
        this.rawData.forEach(record => {
            // Map academic year to calendar year
            // Fall 2024-25 → Fall 2024
            // Winter 2024-25 → Winter 2025
            // Spring 2024-25 → Spring 2025
            const [firstYear, secondYear] = record.AcademicYear.split('-');
            const calendarYear = record.Quarter === 'Fall' ? firstYear : `20${secondYear}`;
            const quarter = `${record.Quarter} ${calendarYear}`;

            if (!quarterlyData[quarter]) {
                quarterlyData[quarter] = {
                    students: new Set(),
                    totalEnrollments: 0
                };
            }

            // In real implementation, would track student IDs
            // For now, estimate unique students from section enrollments
            const enrolled = parseInt(record.Enrolled) || 0;
            quarterlyData[quarter].totalEnrollments += enrolled;
        });

        // Sort quarters chronologically
        const sortedQuarters = Object.keys(quarterlyData).sort((a, b) => {
            const [seasonA, yearA] = a.split(' ');
            const [seasonB, yearB] = b.split(' ');

            const seasonOrder = { 'Fall': 0, 'Winter': 1, 'Spring': 2, 'Summer': 3 };

            if (yearA !== yearB) return parseInt(yearA) - parseInt(yearB);
            return seasonOrder[seasonA] - seasonOrder[seasonB];
        });

        // Build census arrays
        sortedQuarters.forEach(quarter => {
            this.censusData.quarters.push(quarter);

            // Estimate unique headcount (total enrollments / ~5 courses per student)
            const estimatedHeadcount = Math.round(quarterlyData[quarter].totalEnrollments / 5);
            this.censusData.headcount.push(estimatedHeadcount);
            this.censusData.totalEnrollments.push(quarterlyData[quarter].totalEnrollments);
        });

        console.log(`✅ Generated census data for ${sortedQuarters.length} quarters\n`);
    }

    /**
     * Calculate quarter-over-quarter and year-over-year trends
     */
    calculateTrends() {
        console.log('📊 Calculating enrollment trends...');

        const trends = [];

        for (let i = 0; i < this.censusData.quarters.length; i++) {
            const quarter = this.censusData.quarters[i];
            const headcount = this.censusData.headcount[i];

            const trend = {
                quarter,
                headcount,
                qoq: null,
                qoqPercent: null,
                yoy: null,
                yoyPercent: null
            };

            // Quarter-over-quarter (previous quarter)
            if (i > 0) {
                const prevHeadcount = this.censusData.headcount[i - 1];
                trend.qoq = headcount - prevHeadcount;
                trend.qoqPercent = ((trend.qoq / prevHeadcount) * 100).toFixed(1);
            }

            // Year-over-year (same quarter last year, ~3 quarters back for Fall/Winter/Spring)
            if (i >= 3) {
                const yoyHeadcount = this.censusData.headcount[i - 3];
                trend.yoy = headcount - yoyHeadcount;
                trend.yoyPercent = ((trend.yoy / yoyHeadcount) * 100).toFixed(1);
            }

            trends.push(trend);
        }

        this.quarterlyTrends = trends;

        console.log(`✅ Calculated trends for ${trends.length} quarters\n`);
    }

    /**
     * Generate predictive forecast for next quarter
     */
    generateForecast() {
        console.log('🔮 Generating enrollment forecast...');

        if (this.censusData.headcount.length < 4) {
            console.log('⚠️  Not enough data for forecasting (need at least 4 quarters)\n');
            return null;
        }

        const headcounts = this.censusData.headcount;
        const n = headcounts.length;

        // Simple linear trend
        const x = Array.from({ length: n }, (_, i) => i);
        const y = headcounts;

        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Predict next quarter
        const nextX = n;
        const predicted = Math.round(slope * nextX + intercept);

        // Calculate confidence interval (95%)
        const residuals = y.map((yi, i) => yi - (slope * x[i] + intercept));
        const mse = residuals.reduce((sum, r) => sum + r * r, 0) / (n - 2);
        const stdError = Math.sqrt(mse);
        const marginOfError = 1.96 * stdError; // 95% confidence

        const forecast = {
            predicted,
            lower95: Math.round(predicted - marginOfError),
            upper95: Math.round(predicted + marginOfError),
            trend: slope > 0 ? 'growing' : slope < 0 ? 'declining' : 'stable',
            growthRate: ((slope / (sumY / n)) * 100).toFixed(1) + '%'
        };

        console.log(`   Forecast: ${forecast.predicted} students (95% CI: ${forecast.lower95}-${forecast.upper95})`);
        console.log(`   Trend: ${forecast.trend} (${forecast.growthRate} per quarter)\n`);

        return forecast;
    }

    /**
     * Generate output JSON for dashboard consumption
     */
    generateOutput(outputPath = './enrollment-dashboard-data.json') {
        console.log('💾 Generating output file...');

        const output = {
            generatedAt: new Date().toISOString(),
            dataSource: this.dataPath,
            totalRecords: this.rawData.length,

            courseStats: this.courseStats,
            facultyWorkload: this.facultyWorkload,
            capacityPlanning: this.calculateCapacityPlanning(),
            censusData: this.censusData,
            quarterlyTrends: this.quarterlyTrends,
            forecast: this.generateForecast(),

            summary: {
                totalCourses: Object.keys(this.courseStats).length,
                totalFaculty: Object.keys(this.facultyWorkload).length,
                latestQuarter: this.censusData.quarters[this.censusData.quarters.length - 1],
                latestHeadcount: this.censusData.headcount[this.censusData.headcount.length - 1],
                programGrowth: this.calculateProgramGrowth()
            }
        };

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

        console.log(`✅ Output written to: ${outputPath}\n`);
        return output;
    }

    /**
     * Calculate overall program growth
     */
    calculateProgramGrowth() {
        if (this.censusData.headcount.length < 2) return null;

        const first = this.censusData.headcount[0];
        const last = this.censusData.headcount[this.censusData.headcount.length - 1];
        const change = last - first;
        const percent = ((change / first) * 100).toFixed(1);

        return {
            from: this.censusData.quarters[0],
            to: this.censusData.quarters[this.censusData.quarters.length - 1],
            change,
            percent: percent + '%',
            direction: change > 0 ? 'growth' : change < 0 ? 'decline' : 'stable'
        };
    }

    /**
     * Print summary report to console
     */
    printSummary() {
        console.log('\n' + '═'.repeat(60));
        console.log('📊 ENROLLMENT PROCESSING SUMMARY');
        console.log('═'.repeat(60) + '\n');

        console.log('📈 Program Overview:');
        console.log(`   Latest Quarter: ${this.censusData.quarters[this.censusData.quarters.length - 1]}`);
        console.log(`   Current Headcount: ${this.censusData.headcount[this.censusData.headcount.length - 1]} students`);

        const growth = this.calculateProgramGrowth();
        if (growth) {
            console.log(`   Overall Growth: ${growth.change > 0 ? '+' : ''}${growth.change} (${growth.percent})`);
            console.log(`   Period: ${growth.from} → ${growth.to}`);
        }

        console.log('\n📚 Course Statistics:');
        console.log(`   Total Courses: ${Object.keys(this.courseStats).length}`);
        console.log(`   Total Sections: ${this.rawData.length}`);

        const growing = Object.values(this.courseStats).filter(c => c.trend === 'growing').length;
        const declining = Object.values(this.courseStats).filter(c => c.trend === 'declining').length;
        const stable = Object.values(this.courseStats).filter(c => c.trend === 'stable').length;

        console.log(`   Growing: ${growing} | Declining: ${declining} | Stable: ${stable}`);

        console.log('\n👥 Faculty Workload:');
        Object.entries(this.facultyWorkload)
            .sort((a, b) => b[1].students - a[1].students)
            .forEach(([name, data]) => {
                console.log(`   ${name}: ${data.students} students, ${data.sections} sections`);
            });

        console.log('\n' + '═'.repeat(60) + '\n');
    }

    /**
     * Main processing pipeline
     */
    async process(scheduleData = null) {
        console.log('\n🚀 Starting Enrollment Data Processing\n');

        // Load data
        if (!this.loadData()) {
            console.error('❌ Failed to load data');
            return false;
        }

        // Calculate statistics
        this.calculateCourseStats();
        this.calculateCensusData();
        this.calculateTrends();

        // Calculate faculty workload if schedule provided
        if (scheduleData) {
            this.calculateFacultyWorkload(scheduleData);
        }

        // Generate output
        this.generateOutput();

        // Print summary
        this.printSummary();

        console.log('✅ Processing complete!\n');
        return true;
    }
}

// CLI Interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const dataPath = args[0] || './enrollment-data/processed';

    const processor = new EnrollmentProcessor(dataPath);
    processor.process().catch(err => {
        console.error('❌ Processing failed:', err);
        process.exit(1);
    });
}

module.exports = EnrollmentProcessor;
