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

        // Load faculty mapping configuration
        const mappingPath = path.join(__dirname, 'faculty-mapping.json');
        try {
            this.facultyMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
            console.log('✅ Loaded faculty mapping configuration');
        } catch (error) {
            console.warn('⚠️  Faculty mapping not found, using default configuration');
            this.facultyMapping = {
                nameNormalization: {},
                facultyStatusByYear: {},
                chairAssignments: {},
                facultyRanks: {},
                workloadLimits: {}
            };
        }

        // Standard workload limits by faculty rank (per academic year)
        this.workloadLimits = this.facultyMapping.workloadLimits || {
            'Full Professor': 36,
            'Associate Professor': 36,
            'Assistant Professor': 36,
            'Senior Lecturer': 45,
            'Lecturer': 45,
            'Adjunct': 15
        };
    }

    /**
     * Normalize faculty name using the mapping configuration
     */
    normalizeFacultyName(name) {
        if (!name) return name;
        return this.facultyMapping.nameNormalization[name] || name;
    }

    /**
     * Get faculty status for a specific academic year
     */
    getFacultyStatus(facultyName, academicYear) {
        const normalizedName = this.normalizeFacultyName(facultyName);
        const yearStatus = this.facultyMapping.facultyStatusByYear[academicYear];

        if (!yearStatus) {
            return { category: 'unknown', status: 'active' };
        }

        if (yearStatus.fullTime && yearStatus.fullTime.includes(normalizedName)) {
            return { category: 'fullTime', status: 'active' };
        }
        if (yearStatus.sabbatical && yearStatus.sabbatical.includes(normalizedName)) {
            return { category: 'fullTime', status: 'sabbatical' };
        }
        if (yearStatus.adjunct && yearStatus.adjunct.includes(normalizedName)) {
            return { category: 'adjunct', status: 'active' };
        }
        if (yearStatus.former && yearStatus.former.includes(normalizedName)) {
            return { category: 'former', status: 'inactive' };
        }

        return { category: 'unknown', status: 'active' };
    }

    /**
     * Get chair assignment for a specific quarter
     */
    getChairAssignment(quarter, academicYear) {
        const quarterKey = quarter.toLowerCase() + '-' + academicYear.split('-')[0];
        return this.facultyMapping.chairAssignments[quarterKey];
    }

    /**
     * Get max workload capacity for a faculty member
     * Uses individualCapacities if available, otherwise falls back to rank-based limits
     */
    getMaxWorkload(facultyName, academicYear, facultyRank = 'Lecturer') {
        const normalizedName = this.normalizeFacultyName(facultyName);

        // Try to get individual capacity first
        if (this.facultyMapping.individualCapacities &&
            this.facultyMapping.individualCapacities[academicYear] &&
            this.facultyMapping.individualCapacities[academicYear][normalizedName]) {
            return this.facultyMapping.individualCapacities[academicYear][normalizedName];
        }

        // Fall back to rank-based capacity
        return this.workloadLimits[facultyRank] || 45;
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
    calculateFacultyWorkload(facultyName, courses, academicYear) {
        const normalizedName = this.normalizeFacultyName(facultyName);

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

        // Get faculty status for this academic year
        const facultyStatus = this.getFacultyStatus(facultyName, academicYear);

        courses.forEach(course => {
            const workload = this.calculateCourseWorkload(
                course.courseCode,
                course.credits,
                course.enrolled
            );

            // Check chair assignment for this quarter
            const chairAssignment = this.getChairAssignment(course.quarter, course.academicYear);
            const isChairThisQuarter = chairAssignment &&
                                      this.normalizeFacultyName(chairAssignment.chair) === normalizedName;
            const hasFullRelease = isChairThisQuarter && chairAssignment.releaseTime === 'full';
            const isAppliedLearning = workload.type === 'applied-learning';

            // Chair with full release: exclude all workload
            // Chair always has DESN 499/495 as administrative duty
            const shouldExcludeAppliedLearning = isAppliedLearning && isChairThisQuarter;
            const shouldExcludeAll = hasFullRelease;

            // Count credits and workload
            if (!shouldExcludeAll) {
                totalCredits += course.credits;

                if (!shouldExcludeAppliedLearning) {
                    totalWorkloadCredits += workload.workloadCredits;
                }

                totalStudents += course.enrolled || 0;
            }

            if (isAppliedLearning) {
                appliedLearningCredits += course.credits;

                if (!shouldExcludeAppliedLearning) {
                    appliedLearningWorkload += workload.workloadCredits;
                }

                // Track applied learning details
                if (appliedLearningDetails[course.courseCode]) {
                    appliedLearningDetails[course.courseCode].credits += course.credits;
                    appliedLearningDetails[course.courseCode].workload += shouldExcludeAppliedLearning ? 0 : workload.workloadCredits;
                    appliedLearningDetails[course.courseCode].students += course.enrolled || 0;
                    appliedLearningDetails[course.courseCode].sections += 1;
                }
            } else if (!shouldExcludeAll) {
                scheduledCredits += course.credits;
            }

            courseDetails.push({
                ...workload,
                quarter: course.quarter,
                section: course.section,
                excludedFromWorkload: shouldExcludeAll || shouldExcludeAppliedLearning,
                excludeReason: shouldExcludeAll ? 'Full release (Chair)' :
                              shouldExcludeAppliedLearning ? 'Administrative duty (Chair)' : null,
                chairThisQuarter: isChairThisQuarter
            });
        });

        return {
            facultyName: normalizedName,
            originalName: facultyName,
            totalCredits,
            totalWorkloadCredits,
            scheduledCredits,
            appliedLearningCredits,
            appliedLearningWorkload,
            totalStudents,
            sections,
            courses: courseDetails,
            appliedLearning: appliedLearningDetails,
            category: facultyStatus.category,
            status: facultyStatus.status
        };
    }

    /**
     * Calculate faculty capacity utilization
     */
    calculateUtilization(workload, facultyRank = 'Lecturer', facultyName = '', academicYear = '2024-25') {
        const maxWorkload = this.getMaxWorkload(facultyName, academicYear, facultyRank);
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
     * Fill quota gaps with estimated applied learning
     * For projected/planning purposes (2025-26)
     */
    fillQuotaGaps(workload, facultyRank, academicYear, facultyName = '') {
        // Only fill gaps for projected years (2025-26) or if specifically requested
        const isProjected = academicYear === '2025-26';

        const maxWorkload = this.getMaxWorkload(facultyName, academicYear, facultyRank);
        const currentWorkload = workload.totalWorkloadCredits;
        const gap = maxWorkload - currentWorkload;

        // If faculty is under quota, estimate applied learning to fill
        if (gap > 0) {
            return {
                ...workload,
                estimatedAppliedLearning: Math.round(gap),
                estimatedAppliedLearningNote: `Estimated ${Math.round(gap)} credits needed to reach quota (${maxWorkload})`,
                projectedTotalWorkload: currentWorkload + gap,
                isProjected: isProjected,
                quotaStatus: 'under-quota'
            };
        }

        return {
            ...workload,
            estimatedAppliedLearning: 0,
            projectedTotalWorkload: currentWorkload,
            isProjected: isProjected,
            quotaStatus: currentWorkload >= maxWorkload ? 'at-or-over-quota' : 'under-quota'
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
            },
            'DESN 491': {
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
                   (record.CourseCode === 'DESN 499' || record.CourseCode === 'DESN 495' || record.CourseCode === 'DESN 491');
        });

        yearData.forEach(record => {
            const courseCode = record.CourseCode;
            const credits = parseInt(record.Credits) || 0;
            const enrolled = parseInt(record.Enrolled) || 0;
            const instructor = record.Instructor;

            const workload = this.calculateCourseWorkload(courseCode, credits, enrolled);

            appliedLearning[courseCode].sections += 1;
            // For applied learning courses, each section = 1 student (with variable credits)
            appliedLearning[courseCode].students += 1;
            appliedLearning[courseCode].totalCredits += credits;
            appliedLearning[courseCode].workloadCredits += workload.workloadCredits;

            // Track by supervisor
            if (instructor) {
                // Normalize instructor name to avoid duplicates
                const normalizedInstructor = this.normalizeFacultyName(instructor);

                if (!appliedLearning[courseCode].supervisors[normalizedInstructor]) {
                    appliedLearning[courseCode].supervisors[normalizedInstructor] = {
                        sections: 0,
                        students: 0,
                        credits: 0,
                        workload: 0
                    };
                }
                appliedLearning[courseCode].supervisors[normalizedInstructor].sections += 1;
                // For applied learning, 1 section = 1 student
                appliedLearning[courseCode].supervisors[normalizedInstructor].students += 1;
                appliedLearning[courseCode].supervisors[normalizedInstructor].credits += credits;
                appliedLearning[courseCode].supervisors[normalizedInstructor].workload += workload.workloadCredits;
            }
        });

        // Calculate totals
        const total = {
            sections: appliedLearning['DESN 499'].sections + appliedLearning['DESN 495'].sections + appliedLearning['DESN 491'].sections,
            students: appliedLearning['DESN 499'].students + appliedLearning['DESN 495'].students + appliedLearning['DESN 491'].students,
            totalCredits: appliedLearning['DESN 499'].totalCredits + appliedLearning['DESN 495'].totalCredits + appliedLearning['DESN 491'].totalCredits,
            workloadEquivalent: appliedLearning['DESN 499'].workloadCredits + appliedLearning['DESN 495'].workloadCredits + appliedLearning['DESN 491'].workloadCredits
        };

        return {
            academicYear,
            'DESN 499': appliedLearning['DESN 499'],
            'DESN 495': appliedLearning['DESN 495'],
            'DESN 491': appliedLearning['DESN 491'],
            total
        };
    }

    /**
     * Generate workload report for all faculty
     */
    generateWorkloadReport(enrollmentData, facultyRanks = {}, academicYear = null) {
        const facultyWorkloads = {};

        // Determine academic year if not provided - use most recent year for categorization
        if (!academicYear && enrollmentData.length > 0) {
            const years = [...new Set(enrollmentData.map(r => r.AcademicYear))].sort();
            academicYear = years[years.length - 1]; // Use most recent year for categorization
        }

        // Group courses by normalized faculty name
        enrollmentData.forEach(record => {
            const instructor = record.Instructor;
            if (!instructor) return;

            const normalizedName = this.normalizeFacultyName(instructor);

            if (!facultyWorkloads[normalizedName]) {
                facultyWorkloads[normalizedName] = [];
            }

            facultyWorkloads[normalizedName].push({
                courseCode: record.CourseCode,
                section: record.Section,
                credits: parseInt(record.Credits) || 5,
                enrolled: parseInt(record.Enrolled) || 0,
                quarter: record.Quarter,
                academicYear: record.AcademicYear
            });
        });

        // Calculate workload for each faculty member
        const fullTimeReport = {};
        const adjunctReport = {};
        const formerReport = {};

        Object.keys(facultyWorkloads).forEach(facultyName => {
            const workload = this.calculateFacultyWorkload(facultyName, facultyWorkloads[facultyName], academicYear);

            // Get rank from mapping or parameter
            const rank = this.facultyMapping.facultyRanks?.[facultyName] ||
                        facultyRanks[facultyName] ||
                        (workload.category === 'adjunct' ? 'Adjunct' : 'Lecturer');

            const utilization = this.calculateUtilization(workload, rank, facultyName, academicYear);

            // Fill quota gaps with estimated applied learning
            const quotaFilled = this.fillQuotaGaps(workload, rank, academicYear, facultyName);

            const facultyData = {
                ...workload,
                rank,
                ...utilization,
                ...quotaFilled
            };

            // Categorize faculty based on most recent year status
            if (workload.category === 'fullTime' || workload.status === 'sabbatical') {
                fullTimeReport[facultyName] = facultyData;
            } else if (workload.category === 'adjunct') {
                adjunctReport[facultyName] = facultyData;
            } else if (workload.category === 'former') {
                formerReport[facultyName] = facultyData;
            } else {
                // Unknown category - try to infer from rank
                if (rank === 'Adjunct') {
                    adjunctReport[facultyName] = facultyData;
                } else {
                    fullTimeReport[facultyName] = facultyData;
                }
            }
        });

        return {
            fullTime: fullTimeReport,
            adjunct: adjunctReport,
            former: formerReport,
            all: { ...fullTimeReport, ...adjunctReport, ...formerReport }
        };
    }

    /**
     * Generate workload report by academic year
     */
    generateWorkloadReportByYear(enrollmentData, facultyRanks = {}) {
        const yearlyReports = {};

        // Get unique academic years
        const academicYears = [...new Set(enrollmentData.map(r => r.AcademicYear))].sort();

        academicYears.forEach(year => {
            // Filter data for this year
            const yearData = enrollmentData.filter(r => r.AcademicYear === year);

            // Generate report for this year, passing the year explicitly
            yearlyReports[year] = this.generateWorkloadReport(yearData, facultyRanks, year);
        });

        return {
            years: academicYears,
            byYear: yearlyReports
        };
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

    // Display full-time faculty
    console.log(`\n👥 Full-Time Faculty Workload (${Object.keys(workloadReport.fullTime).length} faculty):\n`);
    const sortedFullTime = Object.entries(workloadReport.fullTime).sort((a, b) => b[1].totalWorkloadCredits - a[1].totalWorkloadCredits);

    sortedFullTime.forEach(([name, data]) => {
        const statusLabel = data.status === 'sabbatical' ? ' (SABBATICAL)' : '';
        console.log(`${name}${statusLabel}:`);
        console.log(`   Rank: ${data.rank}`);
        console.log(`   Total Credits: ${data.totalCredits}`);
        console.log(`   Workload Credits: ${data.totalWorkloadCredits.toFixed(1)} / ${data.maxWorkload}`);
        console.log(`     - Scheduled: ${data.scheduledCredits}`);
        console.log(`     - Applied Learning: ${data.appliedLearningCredits} (${data.appliedLearningWorkload.toFixed(1)} workload)`);
        console.log(`   Students: ${data.totalStudents} | Sections: ${data.sections}`);
        console.log(`   Utilization: ${data.utilizationRate}% (${data.status})`);
        console.log();
    });

    // Display adjunct faculty
    if (Object.keys(workloadReport.adjunct).length > 0) {
        console.log('━'.repeat(60));
        console.log(`\n📋 Adjunct Faculty / Additional Need (${Object.keys(workloadReport.adjunct).length} faculty):\n`);
        const sortedAdjunct = Object.entries(workloadReport.adjunct).sort((a, b) => b[1].totalWorkloadCredits - a[1].totalWorkloadCredits);

        sortedAdjunct.forEach(([name, data]) => {
            console.log(`${name}:`);
            console.log(`   Total Credits: ${data.totalCredits}`);
            console.log(`   Workload Credits: ${data.totalWorkloadCredits.toFixed(1)} / ${data.maxWorkload} (Adjunct limit)`);
            console.log(`   Students: ${data.totalStudents} | Sections: ${data.sections}`);
            console.log(`   Utilization: ${data.utilizationRate}%`);
            console.log();
        });
    }

    // Display former faculty if any
    if (Object.keys(workloadReport.former).length > 0) {
        console.log('━'.repeat(60));
        console.log(`\n📦 Faculty No Longer With Program (${Object.keys(workloadReport.former).length}):\n`);
        const sortedFormer = Object.entries(workloadReport.former).sort((a, b) => b[1].totalWorkloadCredits - a[1].totalWorkloadCredits);

        sortedFormer.forEach(([name, data]) => {
            console.log(`${name}:`);
            console.log(`   Total Credits: ${data.totalCredits} | Sections: ${data.sections}`);
            console.log();
        });
    }

    // Generate applied learning trends
    const appliedLearningTrends = calculator.generateAppliedLearningTrends(enrollmentData);

    console.log('━'.repeat(60));
    console.log('\n📚 Applied Learning Trends:\n');

    Object.keys(appliedLearningTrends.trends).forEach(year => {
        const trend = appliedLearningTrends.trends[year];
        console.log(`${year}:`);
        console.log(`   DESN 499: ${trend['DESN 499'].students} students, ${trend['DESN 499'].totalCredits} credits → ${trend['DESN 499'].workloadCredits.toFixed(1)} workload`);
        console.log(`   DESN 495: ${trend['DESN 495'].students} students, ${trend['DESN 495'].totalCredits} credits → ${trend['DESN 495'].workloadCredits.toFixed(1)} workload`);
        if (trend['DESN 491'] && trend['DESN 491'].students > 0) {
            console.log(`   DESN 491: ${trend['DESN 491'].students} students, ${trend['DESN 491'].totalCredits} credits → ${trend['DESN 491'].workloadCredits.toFixed(1)} workload`);
        }
        console.log(`   Total Workload Equivalent: ${trend.total.workloadEquivalent.toFixed(1)} credits`);
        console.log();
    });

    if (appliedLearningTrends.summary) {
        console.log('Summary:');
        console.log(`   Average Annual Workload: ${appliedLearningTrends.summary.averageAnnualWorkload} credits`);
        console.log(`   Latest (${appliedLearningTrends.summary.latestYear}): ${appliedLearningTrends.summary.latestWorkload.toFixed(1)} credits`);
        console.log(`   Trend: ${appliedLearningTrends.summary.trend} (${appliedLearningTrends.summary.percentChange})`);
    }

    // Generate workload by year
    console.log('━'.repeat(60));
    console.log('\n📅 Generating workload breakdown by academic year...\n');
    const workloadByYear = calculator.generateWorkloadReportByYear(enrollmentData);

    // Export to JSON
    const output = {
        generatedAt: new Date().toISOString(),
        facultyWorkload: workloadReport.all, // All faculty combined for backward compatibility
        fullTimeFaculty: workloadReport.fullTime,
        adjunctFaculty: workloadReport.adjunct,
        formerFaculty: workloadReport.former,
        workloadByYear: workloadByYear,
        appliedLearningTrends,
        summary: {
            totalFaculty: Object.keys(workloadReport.all).length,
            fullTimeFaculty: Object.keys(workloadReport.fullTime).length,
            adjunctFaculty: Object.keys(workloadReport.adjunct).length,
            formerFaculty: Object.keys(workloadReport.former).length,
            totalSections: enrollmentData.length,
            averageWorkload: (Object.values(workloadReport.fullTime).reduce((sum, f) => sum + f.totalWorkloadCredits, 0) / Object.keys(workloadReport.fullTime).length).toFixed(1),
            overloadedFaculty: Object.values(workloadReport.all).filter(f => f.status === 'overloaded').length,
            underutilizedFaculty: Object.values(workloadReport.all).filter(f => f.status === 'underutilized').length
        }
    };

    calculator.exportToJSON(output, './workload-data.json');

    console.log('\n✅ Workload analysis complete!\n');
    console.log(`📊 Summary:`);
    console.log(`   Full-Time Faculty: ${Object.keys(workloadReport.fullTime).length}`);
    console.log(`   Adjunct Faculty: ${Object.keys(workloadReport.adjunct).length}`);
    console.log(`   Former Faculty: ${Object.keys(workloadReport.former).length}`);
    console.log(`   Total Sections: ${enrollmentData.length}\n`);
}

module.exports = WorkloadCalculator;
