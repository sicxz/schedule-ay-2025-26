/**
 * Schedule Builder Page Controller
 * Handles UI interactions and rendering for the schedule builder
 */

// Global state
let currentSchedule = null;
let currentView = 'grid';
let assignedCourses = {}; // { 'MW-10:00-12:00-206': [course1, course2], ... }
let roomConstraints = null; // Loaded from room-constraints.json
let caseByeCaseCourses = []; // Courses handled individually, not in grid

// Room configuration - organized by campus (207 excluded from grid)
const CATALYST_ROOMS = ['206', '209', '210', '212'];
const CHENEY_ROOMS = ['CEB 102', 'CEB 104'];
const ROOMS = [...CATALYST_ROOMS, ...CHENEY_ROOMS];
const ROOM_NAMES = {
    '206': '206 UX Lab',
    '209': '209 Mac Lab',
    '210': '210 Mac Lab',
    '212': '212 Project Lab',
    'CEB 102': 'CEB 102',
    'CEB 104': 'CEB 104'
};

// Courses allowed in Room 212
const ROOM_212_PRIMARY = ['DESN 301', 'DESN 359', 'DESN 401'];
const ROOM_212_OVERFLOW = ['DESN 100', 'DESN 200'];

// State for all quarters
let allQuartersSchedule = {
    Fall: { assignedCourses: {}, caseByeCaseCourses: [] },
    Winter: { assignedCourses: {}, caseByeCaseCourses: [] },
    Spring: { assignedCourses: {}, caseByeCaseCourses: [] }
};
let activeQuarter = 'Fall';
let courseCatalog = null; // Loaded from course-catalog.json

// Time slots: 2hr 20min classes
const TIMES = ['10:00 AM - 12:20 PM', '1:00 PM - 3:20 PM', '4:00 PM - 6:20 PM'];
const TIME_KEYS = ['10:00-12:20', '13:00-15:20', '16:00-18:20']; // For data storage
const DAYS = ['MW', 'TR'];

// Evening time slot (for safety pairing rule)
const EVENING_TIME = '4:00 PM - 6:20 PM';

// Store courses from database for constraints
let dbCourses = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing Schedule Builder...');

    try {
        // Load room constraints
        const constraintsResponse = await fetch('../data/room-constraints.json');
        if (constraintsResponse.ok) {
            roomConstraints = await constraintsResponse.json();
            console.log('Room constraints loaded:', roomConstraints);
        }

        // Load course catalog for offering patterns
        const catalogResponse = await fetch('../data/course-catalog.json');
        if (catalogResponse.ok) {
            courseCatalog = await catalogResponse.json();
            console.log('Course catalog loaded:', courseCatalog.courses?.length, 'courses');
        }

        // Load courses from database for constraints (if dbService is available)
        if (typeof dbService !== 'undefined') {
            try {
                dbCourses = await dbService.getCourses();
                console.log('Database courses loaded:', dbCourses?.length || 0, 'courses');
            } catch (err) {
                console.warn('Could not load courses from database:', err);
            }
        }

        if (typeof ScheduleGenerator !== 'undefined') {
            await ScheduleGenerator.init({
                workloadPath: '../workload-data.json',
                catalogPath: '../data/course-catalog.json',
                enrollmentPath: '../enrollment-dashboard-data.json'
            });
        }

        if (typeof DemandPredictor !== 'undefined') {
            await DemandPredictor.init({
                graphPath: '../data/prerequisite-graph.json',
                enrollmentPath: '../enrollment-dashboard-data.json',
                catalogPath: '../data/course-catalog.json'
            });
        }

        // Initialize constraints engine
        if (typeof ConstraintsEngine !== 'undefined') {
            await ConstraintsEngine.init('../data/scheduling-rules.json');
            // Pass database courses to constraints engine
            if (dbCourses.length > 0) {
                ConstraintsEngine.setCoursesData(dbCourses);
            }
            console.log('Constraints engine initialized');
        }

        console.log('Schedule Builder modules initialized');
        loadDraft();

    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Error initializing: ' + error.message, 'error');
    }
});

// Store analysis results for recommendations
let analysisResults = null;

/**
 * Handle Load & Analyze button - loads previous year and runs analysis
 */
async function handleLoadAndAnalyze() {
    const sourceYear = document.getElementById('sourceYear').value;
    const targetYear = document.getElementById('academicYear').value;

    // Show loading state
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('loadingContainer').style.display = 'block';
    document.getElementById('builderContent').style.display = 'none';
    document.getElementById('projectedDemandSection').style.display = 'none';
    document.getElementById('analysisDashboard').style.display = 'none';
    document.getElementById('actionBar').style.display = 'none';

    try {
        // Initialize analyzer
        await ScheduleAnalyzer.init();

        // Load source year's schedule from workload-data.json
        const workloadResponse = await fetch('../workload-data.json');
        if (!workloadResponse.ok) throw new Error('Failed to load workload data');
        const workloadData = await workloadResponse.json();

        // Get source year data
        const yearData = workloadData.workloadByYear?.byYear?.[sourceYear];
        if (!yearData) throw new Error(`No data found for ${sourceYear}`);

        // Extract all courses from all faculty
        const allCourses = extractCoursesFromYear(yearData, workloadData.facultyWorkload);

        // Group by quarter and build schedule
        const quarters = ['Fall', 'Winter', 'Spring'];
        allQuartersSchedule = {
            Fall: { assignedCourses: {}, caseByeCaseCourses: [] },
            Winter: { assignedCourses: {}, caseByeCaseCourses: [] },
            Spring: { assignedCourses: {}, caseByeCaseCourses: [] }
        };

        let totalSections = 0;

        // Generate schedule for each quarter
        for (const quarter of quarters) {
            const quarterCourses = allCourses.filter(c => c.quarter === quarter);
            const recommendations = buildRecommendations(quarterCourses, quarter);

            // Reset current quarter state
            assignedCourses = {};
            caseByeCaseCourses = [];

            // Filter case-by-case and assign to grid
            const gridCourses = filterCaseByeCaseCourses(recommendations, quarter);
            autoAssignToGrid(gridCourses, quarter);

            // Store in allQuartersSchedule
            allQuartersSchedule[quarter] = {
                assignedCourses: { ...assignedCourses },
                caseByeCaseCourses: [...caseByeCaseCourses],
                recommendations: recommendations
            };

            totalSections += Object.values(assignedCourses).flat().length;
        }

        // Run analysis
        analysisResults = ScheduleAnalyzer.analyzeSchedule(allQuartersSchedule, sourceYear, targetYear);

        // Update analysis dashboard header
        document.getElementById('analysisSourceYear').textContent = sourceYear;
        document.getElementById('analysisTargetYear').textContent = targetYear;

        // Render analysis results
        renderAnalysisDashboard(analysisResults);

        // Hide loading, show analysis dashboard
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('analysisDashboard').style.display = 'block';

        showToast(`Loaded ${totalSections} sections from ${sourceYear}. Review analysis before proceeding.`);

    } catch (error) {
        console.error('Load error:', error);
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        showToast('Error loading schedule: ' + error.message, 'error');
    }
}

/**
 * Render analysis dashboard with recommendations
 */
function renderAnalysisDashboard(results) {
    // Update summary stats
    document.getElementById('totalIssues').textContent = results.summary.totalIssues;
    document.getElementById('capacityWarnings').textContent = results.summary.capacityWarnings;
    document.getElementById('coursesLoaded').textContent = results.summary.coursesLoaded;

    // Render enrollment recommendations
    renderRecommendationList('enrollmentRecommendations', results.enrollment, 'enrollmentCount');

    // Render conflict warnings
    renderRecommendationList('conflictRecommendations', results.conflicts, 'conflictCount');

    // Render missing courses
    renderRecommendationList('missingRecommendations', results.missing, 'missingCount');
}

/**
 * Render a list of recommendations with checkboxes
 */
function renderRecommendationList(containerId, recommendations, countId) {
    const container = document.getElementById(containerId);
    document.getElementById(countId).textContent = recommendations.length;

    if (recommendations.length === 0) {
        container.innerHTML = '<p class="no-recommendations">No issues found</p>';
        return;
    }

    let html = '';
    recommendations.forEach(rec => {
        const badgeClass = rec.priority === 'high' ? 'required' :
                          rec.type === 'add-section' ? 'add' : 'warning';
        const badgeText = rec.priority === 'high' ? 'High Priority' :
                         rec.type === 'add-section' ? 'Add' :
                         rec.type === 'reduce-section' ? 'Reduce' : 'Warning';

        html += `
            <div class="recommendation-item">
                <input type="checkbox" id="${rec.id}" data-action='${JSON.stringify(rec.action)}' checked>
                <div class="recommendation-content">
                    <div class="recommendation-title">${rec.title}</div>
                    <div class="recommendation-detail">${rec.detail}</div>
                </div>
                <span class="recommendation-badge ${badgeClass}">${badgeText}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Select all recommendation checkboxes
 */
function selectAllRecommendations() {
    document.querySelectorAll('.recommendation-item input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
    });
}

/**
 * Deselect all recommendation checkboxes
 */
function deselectAllRecommendations() {
    document.querySelectorAll('.recommendation-item input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
}

/**
 * Apply selected recommendations
 */
function applySelectedRecommendations() {
    const checkedItems = document.querySelectorAll('.recommendation-item input[type="checkbox"]:checked');
    let appliedCount = 0;

    checkedItems.forEach(checkbox => {
        try {
            const action = JSON.parse(checkbox.dataset.action);
            if (applyRecommendation(action)) {
                appliedCount++;
            }
        } catch (err) {
            console.error('Error applying recommendation:', err);
        }
    });

    showToast(`Applied ${appliedCount} recommendations`);

    // Re-run analysis to update dashboard
    if (appliedCount > 0) {
        const sourceYear = document.getElementById('sourceYear').value;
        const targetYear = document.getElementById('academicYear').value;
        analysisResults = ScheduleAnalyzer.analyzeSchedule(allQuartersSchedule, sourceYear, targetYear);
        renderAnalysisDashboard(analysisResults);
    }
}

/**
 * Apply a single recommendation action
 */
function applyRecommendation(action) {
    switch (action.type) {
        case 'add-section':
            return addSectionForCourse(action.courseCode);
        case 'reduce-section':
            return reduceSectionForCourse(action.courseCode);
        case 'add-course':
            return addCourseToSchedule(action.courseCode, action.quarter);
        case 'add-evening-pair':
            // This requires manual intervention - just flag it
            console.log(`Manual action needed: Add evening course on ${action.day} in ${action.quarter}`);
            return false;
        case 'rebalance':
            // This also requires manual intervention
            console.log(`Manual action needed: Rebalance MW/TR in ${action.quarter}`);
            return false;
        default:
            console.log('Unknown action type:', action.type);
            return false;
    }
}

/**
 * Add a section for a course
 */
function addSectionForCourse(courseCode) {
    // Find which quarter has this course and add a section
    for (const quarter of ['Fall', 'Winter', 'Spring']) {
        const quarterData = allQuartersSchedule[quarter];
        for (const [key, courses] of Object.entries(quarterData.assignedCourses)) {
            const existing = courses.find(c => c.courseCode === courseCode);
            if (existing) {
                // Create new section based on existing
                const newSection = {
                    ...existing,
                    section: String(parseInt(existing.section) + 1).padStart(3, '0'),
                    facultyName: 'TBD'
                };

                // Find empty slot
                const emptySlot = findEmptySlot(quarter);
                if (emptySlot) {
                    newSection.day = emptySlot.day;
                    newSection.time = emptySlot.time;
                    newSection.room = emptySlot.room;
                    newSection.timeDisplay = emptySlot.timeDisplay;

                    const slotKey = `${emptySlot.day}-${emptySlot.time}-${emptySlot.room}`;
                    if (!quarterData.assignedCourses[slotKey]) {
                        quarterData.assignedCourses[slotKey] = [];
                    }
                    quarterData.assignedCourses[slotKey].push(newSection);
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Find an empty slot in the schedule
 */
function findEmptySlot(quarter) {
    const quarterData = allQuartersSchedule[quarter];
    for (const day of DAYS) {
        for (let i = 0; i < TIME_KEYS.length; i++) {
            const timeKey = TIME_KEYS[i];
            for (const room of ROOMS) {
                const key = `${day}-${timeKey}-${room}`;
                if (!quarterData.assignedCourses[key] || quarterData.assignedCourses[key].length === 0) {
                    return { day, time: timeKey, room, timeDisplay: TIMES[i] };
                }
            }
        }
    }
    return null;
}

/**
 * Reduce sections for a course
 */
function reduceSectionForCourse(courseCode) {
    for (const quarter of ['Fall', 'Winter', 'Spring']) {
        const quarterData = allQuartersSchedule[quarter];
        for (const [key, courses] of Object.entries(quarterData.assignedCourses)) {
            const idx = courses.findIndex(c => c.courseCode === courseCode);
            if (idx > -1 && courses.length > 1) {
                courses.splice(idx, 1);
                return true;
            }
        }
    }
    return false;
}

/**
 * Add a course to the schedule
 */
function addCourseToSchedule(courseCode, quarter) {
    const quarterData = allQuartersSchedule[quarter];
    const emptySlot = findEmptySlot(quarter);

    if (!emptySlot) return false;

    // Get course info from catalog
    const courseInfo = courseCatalog?.courses?.find(c => c.code === courseCode) || {};

    const newCourse = {
        courseCode: courseCode,
        courseTitle: courseInfo.title || courseCode,
        section: '001',
        credits: courseInfo.defaultCredits || 5,
        facultyName: 'TBD',
        predictedDemand: 20,
        priority: 'high',
        day: emptySlot.day,
        time: emptySlot.time,
        room: emptySlot.room,
        timeDisplay: emptySlot.timeDisplay
    };

    const slotKey = `${emptySlot.day}-${emptySlot.time}-${emptySlot.room}`;
    if (!quarterData.assignedCourses[slotKey]) {
        quarterData.assignedCourses[slotKey] = [];
    }
    quarterData.assignedCourses[slotKey].push(newCourse);
    return true;
}

/**
 * Proceed to grid editing after analysis
 */
function proceedToGrid() {
    const targetYear = document.getElementById('academicYear').value;

    // Set active quarter and restore its state
    activeQuarter = 'Fall';
    assignedCourses = allQuartersSchedule[activeQuarter].assignedCourses;
    caseByeCaseCourses = allQuartersSchedule[activeQuarter].caseByeCaseCourses;

    // Calculate total sections
    let totalSections = 0;
    Object.values(allQuartersSchedule).forEach(q => {
        Object.values(q.assignedCourses).forEach(courses => {
            totalSections += courses.length;
        });
    });

    // Create schedule summary
    currentSchedule = {
        year: targetYear,
        quarter: activeQuarter,
        summary: {
            totalSections: totalSections,
            assignedSections: totalSections,
            highDemandCourses: analysisResults?.enrollment?.length || 0,
            warningCount: analysisResults?.summary?.totalIssues || 0
        },
        recommendations: allQuartersSchedule[activeQuarter].recommendations
    };

    // Hide analysis dashboard, show grid
    document.getElementById('analysisDashboard').style.display = 'none';
    document.getElementById('projectedDemandSection').style.display = 'block';
    document.getElementById('builderContent').style.display = 'grid';
    document.getElementById('actionBar').style.display = 'flex';

    // Update titles
    document.getElementById('gridTitle').textContent = `Schedule Grid - ${activeQuarter} ${targetYear}`;
    document.getElementById('demandQuarterYear').textContent = `${activeQuarter} ${targetYear}`;

    // Render all components
    renderSummaryCards(currentSchedule.summary);
    renderProjectedDemand(currentSchedule.recommendations, activeQuarter);
    renderScheduleGrid();
    renderUnassignedList();
    renderFacultySummary();
    renderQuarterTabs();

    showToast(`Ready to edit ${targetYear} schedule`);
}

/**
 * Legacy: Handle generate button click - loads previous year and generates all three quarters
 */
async function handleGenerate() {
    const targetYear = document.getElementById('academicYear').value;
    const previousYear = document.getElementById('sourceYear')?.value || '2025-26';

    // Show loading state
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('loadingContainer').style.display = 'block';
    document.getElementById('builderContent').style.display = 'none';
    document.getElementById('projectedDemandSection').style.display = 'none';
    document.getElementById('actionBar').style.display = 'none';

    try {
        // Load previous year's schedule from workload-data.json
        const workloadResponse = await fetch('../workload-data.json');
        if (!workloadResponse.ok) throw new Error('Failed to load workload data');
        const workloadData = await workloadResponse.json();

        // Get previous year data
        const yearData = workloadData.workloadByYear?.byYear?.[previousYear];
        if (!yearData) throw new Error(`No data found for ${previousYear}`);

        // Extract all courses from all faculty
        const allCourses = extractCoursesFromYear(yearData, workloadData.facultyWorkload);

        // Group by quarter
        const quarters = ['Fall', 'Winter', 'Spring'];

        // Reset all quarters schedule
        allQuartersSchedule = {
            Fall: { assignedCourses: {}, caseByeCaseCourses: [] },
            Winter: { assignedCourses: {}, caseByeCaseCourses: [] },
            Spring: { assignedCourses: {}, caseByeCaseCourses: [] }
        };

        let totalSections = 0;

        // Generate schedule for each quarter
        for (const quarter of quarters) {
            const quarterCourses = allCourses.filter(c => c.quarter === quarter);
            const recommendations = buildRecommendations(quarterCourses, quarter);

            // Reset current quarter state
            assignedCourses = {};
            caseByeCaseCourses = [];

            // Filter case-by-case and assign to grid
            const gridCourses = filterCaseByeCaseCourses(recommendations, quarter);
            autoAssignToGrid(gridCourses, quarter);

            // Store in allQuartersSchedule
            allQuartersSchedule[quarter] = {
                assignedCourses: { ...assignedCourses },
                caseByeCaseCourses: [...caseByeCaseCourses],
                recommendations: recommendations
            };

            totalSections += Object.values(assignedCourses).flat().length;
        }

        // Set active quarter and restore its state
        activeQuarter = 'Fall';
        assignedCourses = allQuartersSchedule[activeQuarter].assignedCourses;
        caseByeCaseCourses = allQuartersSchedule[activeQuarter].caseByeCaseCourses;

        // Create schedule summary
        currentSchedule = {
            year: targetYear,
            quarter: activeQuarter,
            summary: {
                totalSections: totalSections,
                assignedSections: totalSections,
                highDemandCourses: allCourses.filter(c => c.enrolled > 20).length,
                warningCount: Object.values(allQuartersSchedule).reduce((sum, q) =>
                    sum + (q.assignedCourses['unassigned']?.length || 0), 0)
            },
            recommendations: allQuartersSchedule[activeQuarter].recommendations
        };

        // Hide loading, show content
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('projectedDemandSection').style.display = 'block';
        document.getElementById('builderContent').style.display = 'grid';
        document.getElementById('actionBar').style.display = 'flex';

        // Update titles
        document.getElementById('gridTitle').textContent = `Schedule Grid - ${activeQuarter} ${targetYear}`;
        document.getElementById('demandQuarterYear').textContent = `${activeQuarter} ${targetYear}`;

        // Render all components
        renderSummaryCards(currentSchedule.summary);
        renderProjectedDemand(currentSchedule.recommendations, activeQuarter);
        renderScheduleGrid();
        renderUnassignedList();
        renderFacultySummary();
        renderQuarterTabs();

        showToast(`Generated schedule for ${targetYear} based on ${previousYear} data (${totalSections} total sections)`);

    } catch (error) {
        console.error('Generation error:', error);
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        showToast('Error generating schedule: ' + error.message, 'error');
    }
}

/**
 * Extract all courses from year data
 */
function extractCoursesFromYear(yearData, currentYearFaculty) {
    const courses = [];
    const seenCourses = new Set(); // Track unique course-quarter-section combos

    // Process full-time faculty
    if (yearData.fullTime) {
        Object.entries(yearData.fullTime).forEach(([facultyName, facultyData]) => {
            if (facultyData.courses) {
                facultyData.courses.forEach(course => {
                    if (course.type === 'scheduled') {
                        const key = `${course.courseCode}-${course.quarter}-${course.section}`;
                        if (!seenCourses.has(key)) {
                            seenCourses.add(key);
                            courses.push({
                                ...course,
                                facultyName: facultyName
                            });
                        }
                    }
                });
            }
        });
    }

    // Process adjunct faculty
    if (yearData.adjunct) {
        Object.entries(yearData.adjunct).forEach(([facultyName, facultyData]) => {
            if (facultyData.courses) {
                facultyData.courses.forEach(course => {
                    if (course.type === 'scheduled') {
                        const key = `${course.courseCode}-${course.quarter}-${course.section}`;
                        if (!seenCourses.has(key)) {
                            seenCourses.add(key);
                            courses.push({
                                ...course,
                                facultyName: facultyName
                            });
                        }
                    }
                });
            }
        });
    }

    return courses;
}

/**
 * Build recommendations from courses
 */
function buildRecommendations(courses, quarter) {
    // Group courses by course code
    const courseGroups = {};
    courses.forEach(course => {
        if (!courseGroups[course.courseCode]) {
            courseGroups[course.courseCode] = {
                courseCode: course.courseCode,
                courseTitle: getCourseTitle(course.courseCode),
                credits: course.credits,
                sections: [],
                totalEnrolled: 0,
                level: course.courseCode.split(' ')[1]?.charAt(0) + '00' || '300'
            };
        }
        courseGroups[course.courseCode].sections.push(course);
        courseGroups[course.courseCode].totalEnrolled += course.enrolled || 0;
    });

    // Convert to recommendations array
    return Object.values(courseGroups).map(group => {
        const avgEnrollment = group.totalEnrolled / group.sections.length;
        return {
            courseCode: group.courseCode,
            courseTitle: group.courseTitle,
            credits: group.credits,
            sectionsNeeded: group.sections.length,
            predictedDemand: Math.round(avgEnrollment),
            utilization: Math.round((avgEnrollment / 24) * 100),
            // Color coding: red (<6), orange (6-15), yellow (16-20), green (21+)
            priority: avgEnrollment < 6 ? 'critical' :
                      avgEnrollment <= 15 ? 'low' :
                      avgEnrollment <= 20 ? 'medium' : 'high',
            level: group.level,
            assignedFaculty: group.sections.map((s, i) => ({
                name: s.facultyName || 'TBD',
                section: s.section || String(i + 1).padStart(3, '0')
            }))
        };
    });
}

/**
 * Get course title from code
 */
function getCourseTitle(courseCode) {
    const titles = {
        'DESN 100': 'Introduction to Design',
        'DESN 200': 'Typography',
        'DESN 216': 'Drawing for Design',
        'DESN 263': 'Digital Imaging',
        'DESN 265': 'Digital Illustration',
        'DESN 267': 'Visual Storytelling',
        'DESN 301': 'Senior Thesis I',
        'DESN 311': 'UX I',
        'DESN 313': 'UX II',
        'DESN 326': 'Motion Design I',
        'DESN 336': 'Motion Design II',
        'DESN 350': 'Design History',
        'DESN 355': 'Web Design',
        'DESN 357': 'Print Design',
        'DESN 359': 'Design Studio I',
        'DESN 360': 'Design Studio II',
        'DESN 384': 'Professional Practice',
        'DESN 399': 'Directed Study',
        'DESN 401': 'Senior Thesis II',
        'DESN 491': 'Practicum',
        'DESN 495': 'Internship',
        'DESN 499': 'Independent Study'
    };
    return titles[courseCode] || courseCode;
}

/**
 * Switch to a different quarter tab
 */
function switchQuarter(quarter) {
    // Save current quarter state
    allQuartersSchedule[activeQuarter] = {
        ...allQuartersSchedule[activeQuarter],
        assignedCourses: { ...assignedCourses },
        caseByeCaseCourses: [...caseByeCaseCourses]
    };

    // Switch to new quarter
    activeQuarter = quarter;
    assignedCourses = allQuartersSchedule[quarter].assignedCourses || {};
    caseByeCaseCourses = allQuartersSchedule[quarter].caseByeCaseCourses || [];

    // Update current schedule reference
    currentSchedule.quarter = quarter;
    currentSchedule.recommendations = allQuartersSchedule[quarter].recommendations || [];

    // Update UI
    const year = document.getElementById('academicYear').value;
    document.getElementById('gridTitle').textContent = `Schedule Grid - ${quarter} ${year}`;
    document.getElementById('demandQuarterYear').textContent = `${quarter} ${year}`;

    // Re-render
    renderProjectedDemand(currentSchedule.recommendations, quarter);
    renderScheduleGrid();
    renderUnassignedList();
    renderFacultySummary();
    renderQuarterTabs();
}

/**
 * Render quarter tabs
 */
function renderQuarterTabs() {
    let tabsContainer = document.getElementById('quarterTabs');
    if (!tabsContainer) {
        // Create tabs container if it doesn't exist
        const controlsBar = document.querySelector('.controls-bar');
        tabsContainer = document.createElement('div');
        tabsContainer.id = 'quarterTabs';
        tabsContainer.className = 'quarter-tabs';
        controlsBar.parentNode.insertBefore(tabsContainer, controlsBar.nextSibling);
    }

    const quarters = ['Fall', 'Winter', 'Spring'];
    tabsContainer.innerHTML = quarters.map(q => {
        const courseCount = Object.values(allQuartersSchedule[q]?.assignedCourses || {}).flat().length;
        const unassignedCount = allQuartersSchedule[q]?.assignedCourses?.['unassigned']?.length || 0;
        const assignedCount = courseCount - unassignedCount;
        return `
            <button class="quarter-tab ${q === activeQuarter ? 'active' : ''}"
                    onclick="switchQuarter('${q}')">
                ${q}
                <span class="tab-count">${assignedCount} courses</span>
                ${unassignedCount > 0 ? `<span class="tab-warning">${unassignedCount}</span>` : ''}
            </button>
        `;
    }).join('');
}

/**
 * Filter out case-by-case courses (not scheduled in grid)
 */
function filterCaseByeCaseCourses(recommendations, quarter) {
    const caseByeCaseList = roomConstraints?.caseByCase?.courses || ['DESN 495', 'DESN 491', 'DESN 499', 'DESN 399'];

    const gridCourses = [];
    recommendations.forEach(rec => {
        if (caseByeCaseList.includes(rec.courseCode)) {
            caseByeCaseCourses.push({
                ...rec,
                description: roomConstraints?.caseByCase?.descriptions?.[rec.courseCode] || 'Individual basis'
            });
        } else {
            gridCourses.push(rec);
        }
    });

    return gridCourses;
}

/**
 * Get valid rooms for a course based on constraints
 * Room 212: DESN 301, 359, 401 (primary), DESN 100, 200 (overflow only)
 * Never assigns to 207
 */
function getValidRooms(courseCode, quarter, slotUsage = {}) {
    // Room 212 primary courses always go to 212
    if (ROOM_212_PRIMARY.includes(courseCode)) {
        return ['212'];
    }

    // ITGS courses - Cheney ONLY, no evening classes (all ITGS courses)
    if (courseCode.startsWith('ITGS')) {
        return ['CEB 102', 'CEB 104'];
    }

    // Cheney-only courses (freshman/sophomore) - CEB rooms first
    if (['DESN 100', 'DESN 200', 'DESN 216'].includes(courseCode)) {
        // Check if CEB rooms are full - if so, allow 212 overflow for 100/200
        const cebSlots = Object.keys(slotUsage).filter(k =>
            k.includes('CEB 102') || k.includes('CEB 104')
        );
        const cebFull = cebSlots.length >= (TIMES.length * DAYS.length * 2); // 2 CEB rooms

        if (cebFull && ROOM_212_OVERFLOW.includes(courseCode)) {
            return ['CEB 102', 'CEB 104', '212'];
        }
        return ['CEB 102', 'CEB 104'];
    }

    // All other courses: Catalyst rooms except 212 (unless full)
    // 212 is restricted to specific courses only
    return ['206', '209', '210', 'CEB 102', 'CEB 104'];
}

/**
 * Auto-assign courses to grid slots with room constraints
 * Includes MW/TR balancing, time slot balancing, and evening safety pairing
 */
function autoAssignToGrid(recommendations, quarter) {
    // Sort by priority: Room 212 courses first, then high priority, then by level
    const sorted = [...recommendations].sort((a, b) => {
        // Room 212 primary courses get highest priority
        const aIs212 = ROOM_212_PRIMARY.includes(a.courseCode) ? 0 : 1;
        const bIs212 = ROOM_212_PRIMARY.includes(b.courseCode) ? 0 : 1;
        if (aIs212 !== bIs212) return aIs212 - bIs212;

        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return (a.level || '300').localeCompare(b.level || '300');
    });

    // Track room usage per time slot
    const slotUsage = {};

    // Track day counts for MW/TR balancing
    const dayCounts = { 'MW': 0, 'TR': 0 };

    // Track time slot counts for even distribution
    // Index 0 = morning (10:00), 1 = afternoon (1:00), 2 = evening (4:00)
    const timeSlotCounts = { 0: 0, 1: 0, 2: 0 };

    // Track evening courses for safety pairing
    const eveningCourses = [];

    sorted.forEach(rec => {
        // Check if course is valid for this quarter (using catalog if available)
        if (!isCourseOfferedInQuarter(rec.courseCode, quarter)) {
            console.log(`Skipping ${rec.courseCode} - not offered in ${quarter}`);
            return;
        }

        // Get valid rooms for this course
        const validRooms = getValidRooms(rec.courseCode, quarter, slotUsage);

        for (let s = 0; s < rec.sectionsNeeded; s++) {
            const faculty = rec.assignedFaculty[s] || { name: 'TBD', section: String(s + 1).padStart(3, '0') };

            // Find an available slot with MW/TR and time slot balancing
            let assigned = false;

            // Sort days by count (prefer less-used day for balance)
            const sortedDays = [...DAYS].sort((a, b) => dayCounts[a] - dayCounts[b]);

            // Time slot priority: morning (0), afternoon (1), then evening (2) last
            // This prioritizes daytime slots before evening
            const sortedTimeIndices = [0, 1, 2]; // Fixed order: 10am, 1pm, 4pm

            for (const day of sortedDays) {
                if (assigned) break;

                // Iterate through time slots in priority order (morning/afternoon before evening)
                for (const timeIdx of sortedTimeIndices) {
                    if (assigned) break;
                    const timeKey = TIME_KEYS[timeIdx];
                    const timeDisplay = TIMES[timeIdx];

                    for (const room of validRooms) {
                        // No evening classes in Cheney (CEB rooms)
                        if (timeIdx === 2 && (room === 'CEB 102' || room === 'CEB 104')) {
                            continue;
                        }

                        const key = `${day}-${timeKey}-${room}`;
                        if (!slotUsage[key]) slotUsage[key] = 0;

                        // Allow up to 1 course per cell for cleaner grid
                        if (slotUsage[key] < 1) {
                            const courseData = {
                                ...rec,
                                section: faculty.section,
                                facultyName: faculty.name,
                                day: day,
                                time: timeKey,
                                timeDisplay: timeDisplay,
                                room: room
                            };

                            if (!assignedCourses[key]) assignedCourses[key] = [];
                            assignedCourses[key].push(courseData);
                            slotUsage[key]++;
                            dayCounts[day]++;
                            timeSlotCounts[timeIdx]++;
                            assigned = true;

                            // Track evening courses for safety check
                            if (timeIdx === 2) { // Evening slot
                                eveningCourses.push({ day, room, courseData });
                            }
                            break;
                        }
                    }
                }
            }

            // If no slot found, mark as unassigned
            if (!assigned) {
                const unassignedKey = 'unassigned';
                if (!assignedCourses[unassignedKey]) assignedCourses[unassignedKey] = [];
                assignedCourses[unassignedKey].push({
                    ...rec,
                    section: faculty.section,
                    facultyName: faculty.name,
                    roomConflict: true
                });
            }
        }
    });

    // Log distribution stats for debugging
    console.log(`${quarter} distribution - Days:`, dayCounts, 'Time slots:', {
        morning: timeSlotCounts[0],
        afternoon: timeSlotCounts[1],
        evening: timeSlotCounts[2]
    });

    // Evening safety check: warn if only one course in evening slot
    checkEveningSafety(eveningCourses);
}

/**
 * Check if a course is offered in a given quarter
 */
function isCourseOfferedInQuarter(courseCode, quarter) {
    if (!courseCatalog?.courses) return true; // Allow if no catalog

    const course = courseCatalog.courses.find(c => c.code === courseCode);
    if (!course) return true; // Allow if course not in catalog

    if (!course.offeredQuarters || course.offeredQuarters.length === 0) return true;

    return course.offeredQuarters.includes(quarter);
}

/**
 * Check evening safety - warn if only one instructor after 5pm
 */
function checkEveningSafety(eveningCourses) {
    // Group by day
    const byDay = { 'MW': [], 'TR': [] };
    eveningCourses.forEach(ec => {
        byDay[ec.day].push(ec);
    });

    // Check each day
    ['MW', 'TR'].forEach(day => {
        if (byDay[day].length === 1) {
            console.warn(`⚠️ SAFETY WARNING: Only one evening course on ${day} - ${byDay[day][0].courseData.courseCode}`);
            // Mark the course with a warning
            byDay[day][0].courseData.eveningSafetyWarning = true;
        }
    });
}

/**
 * Render projected demand section
 */
function renderProjectedDemand(recommendations, quarter) {
    // High demand courses (>90% capacity or high priority)
    const highDemandList = document.getElementById('highDemandList');
    const highDemand = recommendations.filter(r => r.priority === 'high' || r.predictedDemand > 20);

    if (highDemand.length === 0) {
        highDemandList.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 12px;">No high demand courses</p>';
    } else {
        highDemandList.innerHTML = highDemand.map(course => `
            <div class="demand-item">
                <div>
                    <span class="course-code">${course.courseCode}</span>
                    <span class="course-info">${course.courseTitle}</span>
                </div>
                <span class="sections-badge">${course.sectionsNeeded} section${course.sectionsNeeded > 1 ? 's' : ''}</span>
            </div>
        `).join('');
    }

    // Case-by-case courses
    const caseByeCaseList = document.getElementById('caseByeCaseList');
    if (caseByeCaseCourses.length === 0) {
        caseByeCaseList.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 12px;">No case-by-case courses</p>';
    } else {
        caseByeCaseList.innerHTML = caseByeCaseCourses.map(course => `
            <div class="demand-item case-by-case-item">
                <div>
                    <span class="course-code">${course.courseCode}</span>
                    <span class="course-info">${course.description}</span>
                </div>
                <span class="sections-badge">~${course.predictedDemand || '?'} students</span>
            </div>
        `).join('');
    }

    // Curriculum recommendations
    const recommendationsList = document.getElementById('curriculumRecommendations');
    const curriculumFlags = roomConstraints?.curriculumFlags || {};
    const flaggedCourses = Object.entries(curriculumFlags);

    let recsHtml = '';

    // Add curriculum flags
    flaggedCourses.forEach(([courseCode, info]) => {
        recsHtml += `
            <div class="recommendation-item">
                <div class="rec-title">⚠️ ${courseCode}: ${info.recommendation}</div>
                <div class="rec-description">${info.reason}</div>
                ${info.impact ? `<div class="rec-impact">${info.impact}</div>` : ''}
            </div>
        `;
    });

    // Add capacity recommendations
    const overloadedCourses = recommendations.filter(r => r.sectionsNeeded > 2);
    overloadedCourses.forEach(course => {
        recsHtml += `
            <div class="recommendation-item">
                <div class="rec-title">📈 ${course.courseCode}: High demand</div>
                <div class="rec-description">${course.predictedDemand} students predicted - ${course.sectionsNeeded} sections needed</div>
                <div class="rec-impact">Consider adding adjunct capacity</div>
            </div>
        `;
    });

    if (recsHtml === '') {
        recsHtml = '<p style="color: #6b7280; text-align: center; padding: 12px;">No recommendations at this time</p>';
    }

    recommendationsList.innerHTML = recsHtml;
}

/**
 * Render the schedule grid with campus headers
 */
function renderScheduleGrid() {
    const grid = document.getElementById('scheduleGrid');
    grid.innerHTML = '';

    // Update grid columns for campus structure
    const totalColumns = 1 + CATALYST_ROOMS.length + CHENEY_ROOMS.length;
    grid.style.gridTemplateColumns = `100px repeat(${CATALYST_ROOMS.length}, 1fr) repeat(${CHENEY_ROOMS.length}, 1fr)`;

    // Campus header row
    const emptyCorner = document.createElement('div');
    emptyCorner.className = 'grid-header';
    emptyCorner.textContent = '';
    grid.appendChild(emptyCorner);

    // Catalyst campus header (spans Catalyst rooms)
    const catalystHeader = document.createElement('div');
    catalystHeader.className = 'campus-header';
    catalystHeader.style.gridColumn = `span ${CATALYST_ROOMS.length}`;
    catalystHeader.textContent = 'Catalyst (Spokane)';
    grid.appendChild(catalystHeader);

    // Cheney campus header (spans Cheney rooms)
    const cheneyHeader = document.createElement('div');
    cheneyHeader.className = 'campus-header cheney';
    cheneyHeader.style.gridColumn = `span ${CHENEY_ROOMS.length}`;
    cheneyHeader.textContent = 'Cheney (Main)';
    grid.appendChild(cheneyHeader);

    // Room header row
    const timeHeader = document.createElement('div');
    timeHeader.className = 'grid-header';
    timeHeader.textContent = 'Time';
    grid.appendChild(timeHeader);

    // Catalyst room headers
    CATALYST_ROOMS.forEach(room => {
        const header = document.createElement('div');
        header.className = 'grid-header';
        header.innerHTML = `${room}<span class="room-type-badge">${getRoomType(room)}</span>`;
        grid.appendChild(header);
    });

    // Cheney room headers
    CHENEY_ROOMS.forEach(room => {
        const header = document.createElement('div');
        header.className = 'grid-header';
        header.innerHTML = `${room}<span class="room-type-badge">${getRoomType(room)}</span>`;
        grid.appendChild(header);
    });

    // Rows for each day/time combination
    DAYS.forEach((day, dayIndex) => {
        // Day divider
        const divider = document.createElement('div');
        divider.className = 'day-divider ' + (dayIndex === 0 ? 'mw' : 'tr');
        grid.appendChild(divider);

        // Use TIME_KEYS for data lookup, TIMES for display
        for (let timeIdx = 0; timeIdx < TIME_KEYS.length; timeIdx++) {
            const timeKey = TIME_KEYS[timeIdx];
            const timeDisplay = TIMES[timeIdx];

            // Time slot label
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            timeSlot.innerHTML = `<span>${day}</span><span>${timeDisplay}</span>`;
            grid.appendChild(timeSlot);

            // Catalyst room cells first
            CATALYST_ROOMS.forEach(room => {
                const cell = createGridCell(day, timeKey, room, timeDisplay);
                grid.appendChild(cell);
            });

            // Then Cheney room cells
            CHENEY_ROOMS.forEach(room => {
                const cell = createGridCell(day, timeKey, room, timeDisplay);
                grid.appendChild(cell);
            });
        }
    });
}

/**
 * Create a grid cell for a specific day/time/room
 */
function createGridCell(day, timeKey, room, timeDisplay) {
    const key = `${day}-${timeKey}-${room}`;
    const courses = assignedCourses[key] || [];

    const cell = document.createElement('div');
    cell.className = 'schedule-cell drop-zone';
    cell.dataset.day = day;
    cell.dataset.time = timeKey;
    cell.dataset.timeDisplay = timeDisplay || timeKey;
    cell.dataset.room = room;

    // Add drag-and-drop handlers
    cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        cell.classList.add('drag-over');
    });
    cell.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        cell.classList.remove('drag-over');
    });
    cell.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleDrop(e, day, timeKey, room);
    });

    courses.forEach(course => {
        const block = createCourseBlock(course);
        cell.appendChild(block);
    });

    return cell;
}

/**
 * Get room type description
 */
function getRoomType(roomId) {
    if (!roomConstraints) {
        const types = {
            '206': 'UX Lab',
            '207': 'Media Lab',
            '209': 'Mac Lab',
            '210': 'Mac Lab',
            '212': 'Project Lab',
            'CEB 102': 'Computer',
            'CEB 104': 'Classroom'
        };
        return types[roomId] || '';
    }

    // Look up from constraints
    const allRooms = [
        ...(roomConstraints.campuses?.catalyst?.rooms || []),
        ...(roomConstraints.campuses?.cheney?.rooms || [])
    ];
    const room = allRooms.find(r => r.id === roomId);
    if (room) {
        return room.type?.replace('-', ' ') || '';
    }
    return '';
}

/**
 * Create a course block element
 */
function createCourseBlock(course) {
    const block = document.createElement('div');
    block.className = `course-block priority-${course.priority}`;
    block.draggable = true;
    block.dataset.courseCode = course.courseCode;
    block.dataset.section = course.section;

    block.innerHTML = `
        <div class="course-code">
            ${course.courseCode}-${course.section}
            <span class="demand-badge">${course.predictedDemand} pred</span>
        </div>
        <div class="course-info">${course.courseTitle}</div>
        <div class="course-faculty">${course.facultyName}</div>
    `;

    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'course-delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Remove course from schedule';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteCourse(course.courseCode, course.section, course.day, course.time, course.room);
    };
    block.appendChild(deleteBtn);

    // Drag handlers using addEventListener for better event handling
    block.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({
            courseCode: course.courseCode,
            section: course.section,
            fromDay: course.day,
            fromTime: course.time,
            fromRoom: course.room
        }));
        block.classList.add('dragging');
        // Small delay to prevent visual glitch
        setTimeout(() => block.style.opacity = '0.5', 0);
    });
    block.addEventListener('dragend', (e) => {
        e.stopPropagation();
        block.classList.remove('dragging');
        block.style.opacity = '1';
    });

    // Click to show details
    block.onclick = () => showCourseDetails(course);

    return block;
}

/**
 * Delete a course from the schedule
 */
function deleteCourse(courseCode, section, day, time, room) {
    const key = `${day}-${time}-${room}`;
    const courses = assignedCourses[key];
    if (!courses) return;

    const index = courses.findIndex(c => c.courseCode === courseCode && c.section === section);
    if (index > -1) {
        courses.splice(index, 1);
        showToast(`${courseCode}-${section} removed from schedule`);
        renderScheduleGrid();
        renderUnassignedList();
    }
}

/**
 * Handle drop on grid cell - with automatic swap
 */
function handleDrop(e, toDay, toTime, toRoom) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const fromKey = data.fromDay ? `${data.fromDay}-${data.fromTime}-${data.fromRoom}` : 'unassigned';
        const toKey = `${toDay}-${toTime}-${toRoom}`;

        if (fromKey === toKey) return;

        // Find and remove from old location
        let movedCourse = null;
        if (assignedCourses[fromKey]) {
            const idx = assignedCourses[fromKey].findIndex(
                c => c.courseCode === data.courseCode && c.section === data.section
            );
            if (idx > -1) {
                movedCourse = assignedCourses[fromKey].splice(idx, 1)[0];
            }
        }

        if (movedCourse) {
            // Check if target has existing courses - SWAP them to source location
            let swappedCourse = null;
            if (assignedCourses[toKey] && assignedCourses[toKey].length > 0) {
                // Find first course in same room at target
                const targetIdx = assignedCourses[toKey].findIndex(c => c.room === toRoom);
                if (targetIdx > -1) {
                    swappedCourse = assignedCourses[toKey].splice(targetIdx, 1)[0];

                    // Move swapped course to source location (only if source wasn't unassigned)
                    if (fromKey !== 'unassigned' && data.fromDay) {
                        swappedCourse.day = data.fromDay;
                        swappedCourse.time = data.fromTime;
                        swappedCourse.room = data.fromRoom;
                        if (!assignedCourses[fromKey]) assignedCourses[fromKey] = [];
                        assignedCourses[fromKey].push(swappedCourse);
                    } else {
                        // If source was unassigned, move swapped course to unassigned
                        if (!assignedCourses['unassigned']) assignedCourses['unassigned'] = [];
                        swappedCourse.day = null;
                        swappedCourse.time = null;
                        swappedCourse.room = null;
                        assignedCourses['unassigned'].push(swappedCourse);
                    }
                }
            }

            // Update moved course location
            movedCourse.day = toDay;
            movedCourse.time = toTime;
            movedCourse.room = toRoom;

            // Add to new location
            if (!assignedCourses[toKey]) assignedCourses[toKey] = [];
            assignedCourses[toKey].push(movedCourse);

            // Re-render
            renderScheduleGrid();
            renderUnassignedList();

            // Show appropriate toast
            if (swappedCourse) {
                showToast(`Swapped ${data.courseCode} with ${swappedCourse.courseCode}`);
            } else {
                showToast(`Moved ${data.courseCode}-${data.section} to ${toDay} ${toTime}`);
            }
        }
    } catch (err) {
        console.error('Drop error:', err);
    }
}

/**
 * Render unassigned courses in sidebar
 */
function renderUnassignedList() {
    const container = document.getElementById('unassignedList');
    const unassigned = assignedCourses['unassigned'] || [];

    if (unassigned.length === 0) {
        container.innerHTML = '<p style="color: #10b981; text-align: center; padding: 20px;">All courses assigned!</p>';
        return;
    }

    let html = '';
    unassigned.forEach(course => {
        html += `
            <div class="unassigned-item" draggable="true"
                 ondragstart="handleUnassignedDrag(event, '${course.courseCode}', '${course.section}')"
                 data-course="${course.courseCode}" data-section="${course.section}">
                <div class="course-code">
                    ${course.courseCode}-${course.section}
                    <span class="sections-badge">${course.credits} cr</span>
                </div>
                <div class="course-title">${course.courseTitle}</div>
                <div style="font-size: 0.75em; color: #6b7280; margin-top: 4px;">
                    ${course.facultyName} | ${course.predictedDemand} predicted
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Handle drag from unassigned list
 */
function handleUnassignedDrag(e, courseCode, section) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({
        courseCode: courseCode,
        section: section,
        fromDay: null,
        fromTime: null,
        fromRoom: null
    }));
    // Add visual feedback
    e.target.classList.add('dragging');
}

/**
 * Render faculty summary in sidebar
 */
function renderFacultySummary() {
    const container = document.getElementById('facultySummary');

    if (!currentSchedule) {
        container.innerHTML = '<p style="color: #6b7280;">No schedule generated</p>';
        return;
    }

    // Calculate faculty loads from assigned courses
    const facultyLoads = {};
    Object.values(assignedCourses).forEach(courses => {
        courses.forEach(course => {
            const name = course.facultyName || 'TBD';
            if (!facultyLoads[name]) facultyLoads[name] = 0;
            facultyLoads[name] += course.credits || 5;
        });
    });

    // Sort by load descending
    const sorted = Object.entries(facultyLoads)
        .filter(([name]) => name !== 'TBD')
        .sort((a, b) => b[1] - a[1]);

    let html = '';
    sorted.forEach(([name, credits]) => {
        const isOverload = credits > 15; // Simple threshold
        html += `
            <div class="faculty-row">
                <span class="faculty-name">${name}</span>
                <span class="faculty-load ${isOverload ? 'overload' : ''}">${credits} cr</span>
            </div>
        `;
    });

    // Show TBD at the end
    if (facultyLoads['TBD']) {
        html += `
            <div class="faculty-row">
                <span class="faculty-name" style="color: #ef4444;">TBD (Unassigned)</span>
                <span class="faculty-load">${facultyLoads['TBD']} cr</span>
            </div>
        `;
    }

    container.innerHTML = html || '<p style="color: #6b7280;">No faculty assignments</p>';
}

/**
 * Show course details in alert (could be modal later)
 */
function showCourseDetails(course) {
    alert(`
${course.courseCode} - ${course.courseTitle}
Section: ${course.section}
Faculty: ${course.facultyName}
Credits: ${course.credits}
Predicted Demand: ${course.predictedDemand}
Priority: ${course.priority}
Location: ${course.day} ${course.time} - Room ${course.room}
    `.trim());
}

/**
 * Render summary cards
 */
function renderSummaryCards(summary) {
    document.getElementById('totalSections').textContent = summary.totalSections;
    document.getElementById('facultyCapacity').textContent = `${summary.assignedSections}/${summary.totalSections}`;
    document.getElementById('highDemand').textContent = summary.highDemandCourses;
    document.getElementById('warnings').textContent = summary.warningCount;
}

/**
 * Toggle between grid and list view
 */
function setView(view) {
    currentView = view;

    document.getElementById('gridViewBtn').classList.toggle('active', view === 'grid');
    document.getElementById('listViewBtn').classList.toggle('active', view === 'list');

    document.getElementById('scheduleGrid').style.display = view === 'grid' ? 'grid' : 'none';
    document.getElementById('listView').style.display = view === 'list' ? 'block' : 'none';

    if (view === 'list') {
        renderListView();
    }
}

/**
 * Render list view
 */
function renderListView() {
    const container = document.getElementById('recommendationsList');

    if (!currentSchedule) {
        container.innerHTML = '<p>No schedule generated</p>';
        return;
    }

    let html = '';
    currentSchedule.recommendations.forEach(rec => {
        html += `
            <div class="recommendation-card priority-${rec.priority}">
                <div class="rec-header">
                    <div class="rec-course-info">
                        <h3>${rec.courseCode}</h3>
                        <span class="rec-course-title">${rec.courseTitle}</span>
                    </div>
                    <span class="rec-badge ${rec.priority}">${rec.priority.toUpperCase()}</span>
                </div>
                <div class="rec-metrics">
                    <div class="metric">
                        <div class="metric-value">${rec.predictedDemand}</div>
                        <div class="metric-label">Predicted</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${rec.sectionsNeeded}</div>
                        <div class="metric-label">Sections</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${rec.utilization}%</div>
                        <div class="metric-label">Utilization</div>
                    </div>
                </div>
                <div class="rec-faculty">
                    <strong>Faculty:</strong> ${rec.assignedFaculty.map(f => f.name).join(', ')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Save draft to localStorage
 */
function saveDraft() {
    if (!currentSchedule) {
        showToast('No schedule to save', 'error');
        return;
    }

    const draft = {
        schedule: currentSchedule,
        assignedCourses: assignedCourses,
        caseByeCaseCourses: caseByeCaseCourses
    };

    localStorage.setItem('scheduleBuilderDraft', JSON.stringify(draft));
    showToast('Draft saved successfully');
}

/**
 * Load draft from localStorage
 */
function loadDraft() {
    const draft = localStorage.getItem('scheduleBuilderDraft');
    if (!draft) return;

    try {
        const data = JSON.parse(draft);
        currentSchedule = data.schedule;
        assignedCourses = data.assignedCourses || {};
        caseByeCaseCourses = data.caseByeCaseCourses || [];

        document.getElementById('academicYear').value = currentSchedule.year;
        document.getElementById('targetQuarter').value = currentSchedule.quarter;

        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('projectedDemandSection').style.display = 'block';
        document.getElementById('builderContent').style.display = 'grid';
        document.getElementById('actionBar').style.display = 'flex';

        document.getElementById('gridTitle').textContent = `Schedule Grid - ${currentSchedule.quarter} ${currentSchedule.year}`;
        document.getElementById('demandQuarterYear').textContent = `${currentSchedule.quarter} ${currentSchedule.year}`;

        renderSummaryCards(currentSchedule.summary);
        renderProjectedDemand(currentSchedule.recommendations, currentSchedule.quarter);
        renderScheduleGrid();
        renderUnassignedList();
        renderFacultySummary();

        showToast('Draft loaded');
    } catch (error) {
        console.error('Error loading draft:', error);
    }
}

// ============================================
// DATABASE SAVE/LOAD FUNCTIONS
// ============================================

/**
 * Save schedule to Supabase database
 */
async function saveToDatabase() {
    if (!currentSchedule) {
        showToast('No schedule to save', 'error');
        return;
    }

    if (!isSupabaseConfigured()) {
        showToast('Database not configured', 'error');
        return;
    }

    try {
        showToast('Saving to database...');

        // Initialize database service
        await dbService.initialize();

        // Get or create academic year
        const yearRecord = await dbService.getOrCreateYear(currentSchedule.year);
        if (!yearRecord) {
            showToast('Failed to get academic year', 'error');
            return;
        }

        // Clear existing schedule for this year/quarter
        const { error: deleteError } = await supabase
            .from('scheduled_courses')
            .delete()
            .eq('academic_year_id', yearRecord.id)
            .eq('quarter', currentSchedule.quarter);

        if (deleteError) {
            console.error('Error clearing old schedule:', deleteError);
        }

        // Build records to insert
        const records = [];

        for (const [key, courses] of Object.entries(assignedCourses)) {
            if (key === 'unassigned') continue;

            const [dayPattern, timeSlot, room] = key.split('-');

            for (const course of courses) {
                // Look up IDs
                const courseId = await dbService.lookupCourseId(course.courseCode);
                const facultyId = course.facultyName && course.facultyName !== 'TBD' && course.facultyName !== 'Adjunct'
                    ? await dbService.lookupFacultyId(course.facultyName)
                    : null;
                const roomId = await dbService.lookupRoomId(room);

                records.push({
                    academic_year_id: yearRecord.id,
                    course_id: courseId,
                    faculty_id: facultyId,
                    room_id: roomId,
                    quarter: currentSchedule.quarter,
                    day_pattern: dayPattern,
                    time_slot: timeSlot,
                    section: course.section || '001',
                    projected_enrollment: course.predictedDemand || null
                });
            }
        }

        // Insert all records
        if (records.length > 0) {
            const { data, error } = await supabase
                .from('scheduled_courses')
                .insert(records)
                .select();

            if (error) {
                console.error('Error saving schedule:', error);
                showToast('Error saving to database', 'error');
                return;
            }

            showToast(`Saved ${records.length} courses to database`);
        } else {
            showToast('No courses to save');
        }

    } catch (error) {
        console.error('Database save error:', error);
        showToast('Error saving to database', 'error');
    }
}

/**
 * Load schedule from Supabase database
 */
async function loadFromDatabase() {
    if (!isSupabaseConfigured()) {
        showToast('Database not configured', 'error');
        return null;
    }

    try {
        await dbService.initialize();

        const yearString = document.getElementById('sourceYear')?.value || '2025-26';
        const quarter = activeQuarter || 'Fall';

        // Get academic year ID
        const yearRecord = await dbService.getOrCreateYear(yearString);
        if (!yearRecord) {
            return null;
        }

        // Fetch schedule
        const schedule = await dbService.getSchedule(yearRecord.id, quarter);

        if (!schedule || schedule.length === 0) {
            console.log('No schedule found in database for', yearString, quarter);
            return null;
        }

        // Convert to assignedCourses format
        const loaded = { unassigned: [] };

        for (const record of schedule) {
            const key = `${record.day_pattern}-${record.time_slot}-${record.room?.room_code || 'TBD'}`;

            if (!loaded[key]) {
                loaded[key] = [];
            }

            loaded[key].push({
                courseCode: record.course?.code || 'Unknown',
                courseTitle: record.course?.title || '',
                section: record.section,
                credits: record.course?.default_credits || 5,
                facultyName: record.faculty?.name || 'TBD',
                predictedDemand: record.projected_enrollment,
                priority: record.projected_enrollment < 6 ? 'critical' :
                         record.projected_enrollment <= 15 ? 'low' :
                         record.projected_enrollment <= 20 ? 'medium' : 'high'
            });
        }

        showToast(`Loaded ${schedule.length} courses from database`);
        return loaded;

    } catch (error) {
        console.error('Database load error:', error);
        showToast('Error loading from database', 'error');
        return null;
    }
}

/**
 * Check if a schedule exists in the database
 */
async function checkDatabaseSchedule(yearString, quarter) {
    if (!isSupabaseConfigured()) {
        return false;
    }

    try {
        await dbService.initialize();

        const yearRecord = await dbService.getOrCreateYear(yearString);
        if (!yearRecord) return false;

        const { count, error } = await supabase
            .from('scheduled_courses')
            .select('id', { count: 'exact', head: true })
            .eq('academic_year_id', yearRecord.id)
            .eq('quarter', quarter);

        if (error) return false;
        return count > 0;

    } catch (error) {
        console.error('Error checking database:', error);
        return false;
    }
}

/**
 * Export to JSON file
 */
function exportJSON() {
    if (!currentSchedule) {
        showToast('No schedule to export', 'error');
        return;
    }

    const exported = {
        academicYear: currentSchedule.year,
        quarter: currentSchedule.quarter,
        generatedAt: new Date().toISOString(),
        courses: []
    };

    // Flatten assigned courses
    Object.entries(assignedCourses).forEach(([key, courses]) => {
        if (key === 'unassigned') return;
        const [day, time, room] = key.split('-');
        courses.forEach(course => {
            exported.courses.push({
                courseCode: course.courseCode,
                courseTitle: course.courseTitle,
                section: course.section,
                credits: course.credits,
                faculty: course.facultyName,
                day: day,
                time: time,
                room: room,
                predictedEnrollment: course.predictedDemand
            });
        });
    });

    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule-${currentSchedule.quarter.toLowerCase()}-${currentSchedule.year}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Schedule exported');
}

/**
 * Export to main schedule page (all three quarters)
 */
function exportToEditor() {
    if (!currentSchedule) {
        showToast('No schedule to export', 'error');
        return;
    }

    // Save current quarter state first
    allQuartersSchedule[activeQuarter] = {
        ...allQuartersSchedule[activeQuarter],
        assignedCourses: { ...assignedCourses },
        caseByeCaseCourses: [...caseByeCaseCourses]
    };

    // Build schedule data in the format the main page expects
    const scheduleData = {
        fall: { MW: {}, TR: {} },
        winter: { MW: {}, TR: {} },
        spring: { MW: {}, TR: {} }
    };

    // Convert each quarter's data
    ['Fall', 'Winter', 'Spring'].forEach(quarter => {
        const quarterKey = quarter.toLowerCase();
        const quarterData = allQuartersSchedule[quarter];

        if (!quarterData?.assignedCourses) return;

        // Initialize time slots
        TIMES.forEach(time => {
            scheduleData[quarterKey]['MW'][time] = [];
            scheduleData[quarterKey]['TR'][time] = [];
        });

        // Populate with courses
        Object.entries(quarterData.assignedCourses).forEach(([key, courses]) => {
            if (key === 'unassigned') return;

            const parts = key.split('-');
            const day = parts[0];
            const time = parts[1] + '-' + parts[2];
            const room = parts.slice(3).join('-');

            courses.forEach(course => {
                const courseData = {
                    code: course.courseCode,
                    name: course.courseTitle || getCourseTitle(course.courseCode),
                    instructor: course.facultyName || 'TBD',
                    room: room,
                    section: course.section,
                    credits: course.credits || 5,
                    enrollment: course.predictedDemand || 0
                };

                if (scheduleData[quarterKey][day] && scheduleData[quarterKey][day][time]) {
                    scheduleData[quarterKey][day][time].push(courseData);
                }
            });
        });
    });

    // Store in localStorage for main page to import
    const exportData = {
        academicYear: currentSchedule.year,
        generatedAt: new Date().toISOString(),
        scheduleData: scheduleData,
        source: 'schedule-builder'
    };

    localStorage.setItem('importedScheduleData', JSON.stringify(exportData));
    showToast('Exporting all quarters to main schedule...');

    setTimeout(() => {
        window.location.href = '../index.html?import=true';
    }, 500);
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    toast.style.background = type === 'error' ? '#ef4444' : '#1f2937';
    toast.classList.add('visible');

    setTimeout(() => {
        toast.classList.remove('visible');
    }, 3000);
}

/**
 * Open Add Course modal
 */
function openAddCourseModal() {
    populateCourseDropdown();
    populateFacultyDropdown();
    document.getElementById('addCourseModal').classList.add('active');
    document.getElementById('addCourseSection').value = '001';
}

/**
 * Close Add Course modal
 */
function closeAddCourseModal() {
    document.getElementById('addCourseModal').classList.remove('active');
    document.getElementById('addCourseForm').reset();
}

/**
 * Handle course selection in Add Course modal - pre-populate based on preferences
 */
function handleCourseSelection() {
    const courseCode = document.getElementById('addCourseCode').value;
    if (!courseCode) return;

    // Get preferences from constraints engine (reads from database courses)
    if (typeof ConstraintsEngine !== 'undefined' && ConstraintsEngine.getCoursePreferences) {
        const prefs = ConstraintsEngine.getCoursePreferences(courseCode);

        // Pre-populate day pattern (select first preferred day)
        const daysSelect = document.getElementById('addCourseDays');
        if (prefs.preferredDays && prefs.preferredDays.length > 0) {
            // Check if first preferred day is a valid option
            const preferredDay = prefs.preferredDays[0];
            if ([...daysSelect.options].some(opt => opt.value === preferredDay)) {
                daysSelect.value = preferredDay;
            }
        }

        // Pre-populate time slot based on preferred times
        const timeSelect = document.getElementById('addCourseTime');
        if (prefs.preferredTimes && prefs.preferredTimes.length > 0) {
            // Map time preferences to actual time keys
            const timeMapping = {
                'morning': '10:00-12:20',
                'afternoon': '13:00-15:20',
                'evening': '16:00-18:20'
            };
            // Select first preferred time that's valid
            for (const timePref of prefs.preferredTimes) {
                const timeKey = timeMapping[timePref];
                if (timeKey && [...timeSelect.options].some(opt => opt.value === timeKey)) {
                    timeSelect.value = timeKey;
                    break;
                }
            }
        }

        // Pre-populate room based on allowed rooms or campus
        const roomSelect = document.getElementById('addCourseRoom');
        if (prefs.allowedRooms && prefs.allowedRooms.length > 0) {
            // Select first allowed room
            const preferredRoom = prefs.allowedRooms[0];
            if ([...roomSelect.options].some(opt => opt.value === preferredRoom)) {
                roomSelect.value = preferredRoom;
            }
        } else if (prefs.allowedCampus) {
            // Select first room on allowed campus
            const campusRooms = {
                'catalyst': ['206', '209', '210', '212'],
                'cheney': ['CEB 102', 'CEB 104']
            };
            const rooms = campusRooms[prefs.allowedCampus] || [];
            for (const room of rooms) {
                if ([...roomSelect.options].some(opt => opt.value === room)) {
                    roomSelect.value = room;
                    break;
                }
            }
        }

        // Show indicator if course has hard constraints
        updateConstraintIndicators(prefs);
    }
}

/**
 * Update UI to show constraint indicators on the Add Course modal
 */
function updateConstraintIndicators(prefs) {
    // Remove existing indicators
    document.querySelectorAll('.constraint-indicator').forEach(el => el.remove());

    // Add indicator for time constraints
    if (prefs.timeConstraintHard) {
        const timeLabel = document.querySelector('label[for="addCourseTime"]');
        if (timeLabel) {
            const indicator = document.createElement('span');
            indicator.className = 'constraint-indicator hard';
            indicator.textContent = ' (Required)';
            indicator.title = 'This course has a hard time constraint';
            timeLabel.appendChild(indicator);
        }
    }

    // Add indicator for room constraints
    if (prefs.roomConstraintHard) {
        const roomLabel = document.querySelector('label[for="addCourseRoom"]');
        if (roomLabel) {
            const indicator = document.createElement('span');
            indicator.className = 'constraint-indicator hard';
            indicator.textContent = ' (Required)';
            indicator.title = 'This course has a hard room/campus constraint';
            roomLabel.appendChild(indicator);
        }
    }

    // Add indicator for case-by-case courses
    if (prefs.isCaseByCase) {
        const courseLabel = document.querySelector('label[for="addCourseCode"]');
        if (courseLabel) {
            const indicator = document.createElement('span');
            indicator.className = 'constraint-indicator case-by-case';
            indicator.textContent = ' ⚠️ Case-by-case';
            indicator.title = 'This course is typically scheduled individually, not on the grid';
            courseLabel.appendChild(indicator);
        }
    }
}

/**
 * Populate course dropdown with available courses
 */
function populateCourseDropdown() {
    const select = document.getElementById('addCourseCode');
    select.innerHTML = '<option value="">Select a course...</option>';

    // Add onchange handler for preference pre-population
    select.onchange = handleCourseSelection;

    // Get courses from catalog or use default list
    const courses = courseCatalog?.courses || [
        { code: 'DESN 100', title: 'Introduction to Design' },
        { code: 'DESN 200', title: 'Typography' },
        { code: 'DESN 216', title: 'Drawing for Design' },
        { code: 'DESN 263', title: 'Digital Imaging' },
        { code: 'DESN 265', title: 'Digital Illustration' },
        { code: 'DESN 267', title: 'Visual Storytelling' },
        { code: 'DESN 301', title: 'Senior Thesis I' },
        { code: 'DESN 311', title: 'UX I' },
        { code: 'DESN 313', title: 'UX II' },
        { code: 'DESN 326', title: 'Motion Design I' },
        { code: 'DESN 336', title: 'Motion Design II' },
        { code: 'DESN 350', title: 'Design History' },
        { code: 'DESN 355', title: 'Web Design' },
        { code: 'DESN 357', title: 'Print Design' },
        { code: 'DESN 359', title: 'Design Studio I' },
        { code: 'DESN 360', title: 'Design Studio II' },
        { code: 'DESN 384', title: 'Professional Practice' },
        { code: 'DESN 401', title: 'Senior Thesis II' }
    ];

    courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.code;
        option.textContent = `${course.code} - ${course.title}`;
        select.appendChild(option);
    });
}

/**
 * Populate faculty dropdown - Full-time faculty only + Adjunct option
 */
async function populateFacultyDropdown() {
    const select = document.getElementById('addCourseFaculty');
    select.innerHTML = '<option value="">TBD</option><option value="Adjunct">Adjunct</option>';

    // Load workload data to get full-time faculty
    try {
        const response = await fetch('../workload-data.json');
        const data = await response.json();
        const currentYear = '2025-26';
        const yearData = data.workloadByYear?.byYear?.[currentYear];

        if (yearData?.fullTime) {
            Object.keys(yearData.fullTime).sort().forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                select.appendChild(option);
            });
        }
    } catch (err) {
        console.error('Error loading faculty:', err);
        // Fallback: get from current schedule
        const facultyNames = new Set();
        Object.values(assignedCourses).forEach(courses => {
            courses.forEach(course => {
                if (course.facultyName && course.facultyName !== 'TBD' && course.facultyName !== 'Adjunct') {
                    facultyNames.add(course.facultyName);
                }
            });
        });
        [...facultyNames].sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    }
}

/**
 * Handle Add Course form submission
 */
function handleAddCourse(e) {
    e.preventDefault();

    const courseCode = document.getElementById('addCourseCode').value;
    const section = document.getElementById('addCourseSection').value || '001';
    const days = document.getElementById('addCourseDays').value;
    const time = document.getElementById('addCourseTime').value;
    const room = document.getElementById('addCourseRoom').value;
    const faculty = document.getElementById('addCourseFaculty').value || 'TBD';

    if (!courseCode) {
        showToast('Please select a course', 'error');
        return;
    }

    const key = `${days}-${time}-${room}`;

    // Get course info
    const courseInfo = courseCatalog?.courses?.find(c => c.code === courseCode) || {};
    const courseTitle = courseInfo.title || getCourseTitle(courseCode);

    // Create new course object
    const newCourse = {
        courseCode: courseCode,
        courseTitle: courseTitle,
        section: section.padStart(3, '0'),
        credits: courseInfo.defaultCredits || 5,
        facultyName: faculty,
        predictedDemand: 20,
        priority: 'medium',
        day: days,
        time: time,
        room: room,
        timeDisplay: TIMES[TIME_KEYS.indexOf(time)] || time
    };

    // Add to assigned courses
    if (!assignedCourses[key]) assignedCourses[key] = [];
    assignedCourses[key].push(newCourse);

    // Close modal and refresh grid
    closeAddCourseModal();
    renderScheduleGrid();
    renderUnassignedList();
    renderFacultySummary();

    showToast(`${courseCode}-${newCourse.section} added to schedule`);
}

// ============================================
// FACULTY PREFERENCES MODAL FUNCTIONS
// ============================================

let currentFacultyId = null;

/**
 * Open the Faculty Preferences modal
 */
async function openFacultyPreferencesModal() {
    const modal = document.getElementById('facultyPreferencesModal');
    const select = document.getElementById('prefFacultyName');

    // Clear and populate faculty dropdown
    select.innerHTML = '<option value="">Select faculty...</option>';

    try {
        // Try to load from database first
        if (isSupabaseConfigured()) {
            await dbService.initialize();
            const faculty = await dbService.getFullTimeFaculty();
            faculty.forEach(f => {
                const option = document.createElement('option');
                option.value = f.id;
                option.textContent = f.name;
                select.appendChild(option);
            });
        } else {
            // Fallback to workload data
            const response = await fetch('../workload-data.json');
            const data = await response.json();
            const yearData = data.workloadByYear?.byYear?.['2025-26'];

            if (yearData?.fullTime) {
                Object.keys(yearData.fullTime).sort().forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    select.appendChild(option);
                });
            }
        }
    } catch (err) {
        console.error('Error loading faculty:', err);
    }

    // Reset form
    document.getElementById('facultyPreferencesForm').reset();
    currentFacultyId = null;

    modal.classList.add('active');
}

/**
 * Close the Faculty Preferences modal
 */
function closeFacultyPreferencesModal() {
    document.getElementById('facultyPreferencesModal').classList.remove('active');
    currentFacultyId = null;
}

/**
 * Load preferences when faculty is selected
 */
async function loadFacultyPreferences() {
    const select = document.getElementById('prefFacultyName');
    const facultyId = select.value;

    if (!facultyId) {
        document.getElementById('facultyPreferencesForm').reset();
        select.value = '';
        return;
    }

    currentFacultyId = facultyId;

    if (!isSupabaseConfigured()) {
        showToast('Database not configured - preferences won\'t be saved', 'warning');
        return;
    }

    try {
        const prefs = await dbService.getFacultyPreferences(facultyId);

        if (prefs) {
            // Set time preferences
            document.querySelectorAll('input[name="timePref"]').forEach(cb => {
                cb.checked = (prefs.time_preferred || []).includes(cb.value);
            });
            document.querySelectorAll('input[name="timeBlocked"]').forEach(cb => {
                cb.checked = (prefs.time_blocked || []).includes(cb.value);
            });

            // Set day preferences
            document.querySelectorAll('input[name="dayPref"]').forEach(cb => {
                cb.checked = (prefs.day_preferred || []).includes(cb.value);
            });
            document.querySelectorAll('input[name="dayBlocked"]').forEach(cb => {
                cb.checked = (prefs.day_blocked || []).includes(cb.value);
            });

            // Set campus and notes
            document.getElementById('prefCampus').value = prefs.campus_assignment || 'any';
            document.getElementById('prefNotes').value = prefs.notes || '';

            showToast('Preferences loaded');
        }
    } catch (error) {
        console.error('Error loading preferences:', error);
    }
}

/**
 * Save faculty preferences to database
 */
async function handleSaveFacultyPreferences(e) {
    e.preventDefault();

    if (!currentFacultyId) {
        showToast('Please select a faculty member', 'error');
        return;
    }

    if (!isSupabaseConfigured()) {
        showToast('Database not configured', 'error');
        return;
    }

    try {
        // Gather form data
        const timePreferred = Array.from(document.querySelectorAll('input[name="timePref"]:checked'))
            .map(cb => cb.value);
        const timeBlocked = Array.from(document.querySelectorAll('input[name="timeBlocked"]:checked'))
            .map(cb => cb.value);
        const dayPreferred = Array.from(document.querySelectorAll('input[name="dayPref"]:checked'))
            .map(cb => cb.value);
        const dayBlocked = Array.from(document.querySelectorAll('input[name="dayBlocked"]:checked'))
            .map(cb => cb.value);
        const campusAssignment = document.getElementById('prefCampus').value;
        const notes = document.getElementById('prefNotes').value;

        await dbService.saveFacultyPreferences(currentFacultyId, {
            timePreferred,
            timeBlocked,
            dayPreferred,
            dayBlocked,
            campusAssignment,
            notes
        });

        showToast('Preferences saved');
        closeFacultyPreferencesModal();

    } catch (error) {
        console.error('Error saving preferences:', error);
        showToast('Error saving preferences', 'error');
    }
}
