/**
 * EWU Design Faculty Workload Calculator
 *
 * Calculates faculty workload credits with special multipliers for applied learning courses:
 * - DESN 499 (Independent Study): 1 credit = 0.2 workload credit
 * - DESN 495 (Internship): 1 credit = 0.1 workload credit
 * - All other courses: 1 credit = 1.0 workload credit
 */

const fs = require('fs');
const path = require('path');

class WorkloadCalculator {
    constructor() {
        this.specialMultipliers = {
            'DESN 499': 0.2,
            'DESN 495': 0.1
        };

        // Standard workload limits by faculty rank (per academic year)
        this.workloadLimits = {
            'Full Professor': 30,
            'Associate Professor': 30,
            'Assistant Professor': 30,
            'Senior Lecturer': 40,
            'Lecturer': 45,
            'Adjunct': 15
        };
    }

    /**
     * Calculate workload credits for a course
     */
    calculateCourseWorkload(courseCode, credits, enrolled = 0) {
        const multiplier = this.specialMultipliers[courseCode] || 1.0;
        const workloadCredits = credits * multiplier;

        return {
            courseCode,
            credits,
            enrolled,
            multiplier,
            workloadCredits,
            type: multiplier < 1.0 ? 'applied-learning' : 'scheduled'
        };
    }

    /**
     * Calculate total workload for a faculty member across multiple courses
     */
    calculateFacultyWorkload(facultyName, courses) {
        let totalCredits = 0;
        let totalWorkloadCredits = 0;
        let scheduledCredits = 0;
        let appliedLearningCredits = 0;
        let appliedLearningWorkload = 0;
        let totalStudents = 0;
        let sections = courses.length;

        const courseDetails = [];
        const appliedLearningDetails = {
            'DESN 499': { credits: 0, workload: 0, students: 0, sections: 0 },
            'DESN 495': { credits: 0, workload: 0, students: 0, sections: 0 }
        };

        courses.forEach(course => {
            const workload = this.calculateCourseWorkload(
                course.courseCode,
                course.credits,
                course.enrolled
            );

            totalCredits += course.credits;
            totalWorkloadCredits += workload.workloadCredits;
            totalStudents += course.enrolled || 0;

            if (workload.type === 'applied-learning') {
                appliedLearningCredits += course.credits;
                appliedLearningWorkload += workload.workloadCredits;

                // Track applied learning details
                if (appliedLearningDetails[course.courseCode]) {
                    appliedLearningDetails[course.courseCode].credits += course.credits;
                    appliedLearningDetails[course.courseCode].workload += workload.workloadCredits;
                    appliedLearningDetails[course.courseCode].students += course.enrolled || 0;
                    appliedLearningDetails[course.courseCode].sections += 1;
                }
            } else {
                scheduledCredits += course.credits;
            }

            courseDetails.push({
                ...workload,
                quarter: course.quarter,
                section: course.section
            });
        });

        return {
            facultyName,
            totalCredits,
            totalWorkloadCredits,
            scheduledCredits,
            appliedLearningCredits,
            appliedLearningWorkload,
            totalStudents,
            sections,
            courses: courseDetails,
            appliedLearning: appliedLearningDetails
        };
    }

    /**
     * Calculate faculty capacity utilization
     */
    calculateUtilization(workload, facultyRank = 'Lecturer') {
        const maxWorkload = this.workloadLimits[facultyRank] || 45;
        const utilizationRate = (workload.totalWorkloadCredits / maxWorkload) * 100;

        let status = 'optimal';
        if (utilizationRate > 100) {
            status = 'overloaded';
        } else if (utilizationRate < 60) {
            status = 'underutilized';
        }

        return {
            maxWorkload,
            currentWorkload: workload.totalWorkloadCredits,
            utilizationRate: Math.round(utilizationRate * 10) / 10,
            status,
            availableCapacity: Math.max(0, maxWorkload - workload.totalWorkloadCredits)
        };
    }

    /**
     * Calculate annual applied learning totals for department
     */
    calculateAnnualAppliedLearning(enrollmentData, academicYear) {
        const appliedLearning = {
            'DESN 499': {
                sections: 0,
                students: 0,
                totalCredits: 0,
                workloadCredits: 0,
                supervisors: {}
            },
            'DESN 495': {
                sections: 0,
                students: 0,
                totalCredits: 0,
                workloadCredits: 0,
                supervisors: {}
            }
        };

        // Filter data for specific academic year
        const yearData = enrollmentData.filter(record => {
            return record.AcademicYear === academicYear &&
                   (record.CourseCode === 'DESN 499' || record.CourseCode === 'DESN 495');
        });

        yearData.forEach(record => {
            const courseCode = record.CourseCode;
            const credits = parseInt(record.Credits) || 0;
            const enrolled = parseInt(record.Enrolled) || 0;
            const instructor = record.Instructor;

            const workload = this.calculateCourseWorkload(courseCode, credits, enrolled);

            appliedLearning[courseCode].sections += 1;
            appliedLearning[courseCode].students += enrolled;
            appliedLearning[courseCode].totalCredits += credits;
            appliedLearning[courseCode].workloadCredits += workload.workloadCredits;

            // Track by supervisor
            if (instructor) {
                if (!appliedLearning[courseCode].supervisors[instructor]) {
                    appliedLearning[courseCode].supervisors[instructor] = {
                        sections: 0,
                        students: 0,
                        credits: 0,
                        workload: 0
                    };
                }
                appliedLearning[courseCode].supervisors[instructor].sections += 1;
                appliedLearning[courseCode].supervisors[instructor].students += enrolled;
                appliedLearning[courseCode].supervisors[instructor].credits += credits;
                appliedLearning[courseCode].supervisors[instructor].workload += workload.workloadCredits;
            }
        });

        // Calculate totals
        const total = {
            sections: appliedLearning['DESN 499'].sections + appliedLearning['DESN 495'].sections,
            students: appliedLearning['DESN 499'].students + appliedLearning['DESN 495'].students,
            totalCredits: appliedLearning['DESN 499'].totalCredits + appliedLearning['DESN 495'].totalCredits,
            workloadEquivalent: appliedLearning['DESN 499'].workloadCredits + appliedLearning['DESN 495'].workloadCredits
        };

        return {
            academicYear,
            'DESN 499': appliedLearning['DESN 499'],
            'DESN 495': appliedLearning['DESN 495'],
            total
        };
    }

    /**
     * Generate workload report for all faculty
     */
    generateWorkloadReport(enrollmentData, facultyRanks = {}) {
        const facultyWorkloads = {};

        // Group courses by faculty
        enrollmentData.forEach(record => {
            const instructor = record.Instructor;
            if (!instructor) return;

            if (!facultyWorkloads[instructor]) {
                facultyWorkloads[instructor] = [];
            }

            facultyWorkloads[instructor].push({
                courseCode: record.CourseCode,
                section: record.Section,
                credits: parseInt(record.Credits) || 5,
                enrolled: parseInt(record.Enrolled) || 0,
                quarter: record.Quarter,
                academicYear: record.AcademicYear
            });
        });

        // Calculate workload for each faculty member
        const report = {};
        Object.keys(facultyWorkloads).forEach(facultyName => {
            const workload = this.calculateFacultyWorkload(facultyName, facultyWorkloads[facultyName]);
            const rank = facultyRanks[facultyName] || 'Lecturer';
            const utilization = this.calculateUtilization(workload, rank);

            report[facultyName] = {
                ...workload,
                rank,
                ...utilization
            };
        });

        return report;
    }

    /**
     * Generate applied learning trends across multiple years
     */
    generateAppliedLearningTrends(enrollmentData) {
        const trends = {};

        // Get unique academic years
        const academicYears = [...new Set(enrollmentData.map(r => r.AcademicYear))].sort();

        academicYears.forEach(year => {
            trends[year] = this.calculateAnnualAppliedLearning(enrollmentData, year);
        });

        return {
            years: academicYears,
            trends,
            summary: this.calculateAppliedLearningSummary(trends)
        };
    }

    /**
     * Calculate summary statistics for applied learning
     */
    calculateAppliedLearningSummary(trends) {
        const years = Object.keys(trends);
        if (years.length === 0) return null;

        const totals = years.map(year => trends[year].total.workloadEquivalent);
        const average = totals.reduce((a, b) => a + b, 0) / totals.length;
        const latest = trends[years[years.length - 1]];
        const earliest = trends[years[0]];

        const change = latest.total.workloadEquivalent - earliest.total.workloadEquivalent;
        const percentChange = earliest.total.workloadEquivalent > 0
            ? ((change / earliest.total.workloadEquivalent) * 100).toFixed(1)
            : 'N/A';

        return {
            averageAnnualWorkload: Math.round(average * 10) / 10,
            latestYear: years[years.length - 1],
            latestWorkload: latest.total.workloadEquivalent,
            change: Math.round(change * 10) / 10,
            percentChange: percentChange + '%',
            trend: change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable'
        };
    }

    /**
     * Export workload data to JSON
     */
    exportToJSON(data, outputPath) {
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        console.log(`✅ Workload data exported to: ${outputPath}`);
    }
}

// CLI Interface
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: node workload-calculator.js <data-directory>');
        console.log('\nExample:');
        console.log('  node workload-calculator.js enrollment-data/processed');
        process.exit(1);
    }

    const dataDir = args[0];
    const calculator = new WorkloadCalculator();

    // Load all enrollment data
    const enrollmentData = [];
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv'));

    files.forEach(file => {
        const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() !== '');

        if (lines.length === 0) return;

        const headers = lines[0].split(',').map(h => h.trim());

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const record = {};
            headers.forEach((header, index) => {
                record[header] = values[index] ? values[index].trim() : '';
            });
            enrollmentData.push(record);
        }
    });

    console.log(`\n📊 Loaded ${enrollmentData.length} enrollment records`);
    console.log('━'.repeat(60));

    // Generate workload report
    const workloadReport = calculator.generateWorkloadReport(enrollmentData);

    console.log(`\n👥 Faculty Workload Summary (${Object.keys(workloadReport).length} faculty):\n`);

    // Sort by workload (highest first)
    const sorted = Object.entries(workloadReport).sort((a, b) => b[1].totalWorkloadCredits - a[1].totalWorkloadCredits);

    sorted.forEach(([name, data]) => {
        console.log(`${name}:`);
        console.log(`   Total Credits: ${data.totalCredits}`);
        console.log(`   Workload Credits: ${data.totalWorkloadCredits.toFixed(1)}`);
        console.log(`     - Scheduled: ${data.scheduledCredits}`);
        console.log(`     - Applied Learning: ${data.appliedLearningCredits} (${data.appliedLearningWorkload.toFixed(1)} workload)`);
        console.log(`   Students: ${data.totalStudents} | Sections: ${data.sections}`);
        console.log(`   Utilization: ${data.utilizationRate}% (${data.status})`);
        console.log();
    });

    // Generate applied learning trends
    const appliedLearningTrends = calculator.generateAppliedLearningTrends(enrollmentData);

    console.log('━'.repeat(60));
    console.log('\n📚 Applied Learning Trends:\n');

    Object.keys(appliedLearningTrends.trends).forEach(year => {
        const trend = appliedLearningTrends.trends[year];
        console.log(`${year}:`);
        console.log(`   DESN 499: ${trend['DESN 499'].students} students, ${trend['DESN 499'].totalCredits} credits → ${trend['DESN 499'].workloadCredits.toFixed(1)} workload`);
        console.log(`   DESN 495: ${trend['DESN 495'].students} students, ${trend['DESN 495'].totalCredits} credits → ${trend['DESN 495'].workloadCredits.toFixed(1)} workload`);
        console.log(`   Total Workload Equivalent: ${trend.total.workloadEquivalent.toFixed(1)} credits`);
        console.log();
    });

    if (appliedLearningTrends.summary) {
        console.log('Summary:');
        console.log(`   Average Annual Workload: ${appliedLearningTrends.summary.averageAnnualWorkload} credits`);
        console.log(`   Latest (${appliedLearningTrends.summary.latestYear}): ${appliedLearningTrends.summary.latestWorkload.toFixed(1)} credits`);
        console.log(`   Trend: ${appliedLearningTrends.summary.trend} (${appliedLearningTrends.summary.percentChange})`);
    }

    // Export to JSON
    const output = {
        generatedAt: new Date().toISOString(),
        facultyWorkload: workloadReport,
        appliedLearningTrends,
        summary: {
            totalFaculty: Object.keys(workloadReport).length,
            totalSections: enrollmentData.length,
            averageWorkload: (Object.values(workloadReport).reduce((sum, f) => sum + f.totalWorkloadCredits, 0) / Object.keys(workloadReport).length).toFixed(1),
            overloadedFaculty: Object.values(workloadReport).filter(f => f.status === 'overloaded').length,
            underutilizedFaculty: Object.values(workloadReport).filter(f => f.status === 'underutilized').length
        }
    };

    calculator.exportToJSON(output, './workload-data.json');

    console.log('\n✅ Workload analysis complete!\n');
}

module.exports = WorkloadCalculator;
