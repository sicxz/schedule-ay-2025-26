/**
 * EWU Design Faculty Workload Dashboard
 * Handles data loading, filtering, and visualization
 */

// Global state
let workloadData = null;
let currentYearData = null;
let currentFilters = {
    year: '2024-25',
    status: 'all',
    category: 'all'
};

// Chart instances
let charts = {};

/**
 * Initialize dashboard
 */
async function initDashboard() {
    console.log('🚀 Initializing Faculty Workload Dashboard');

    // Load workload data
    workloadData = await loadWorkloadData('../');

    if (!workloadData) {
        showError('Failed to load workload data.');
        return;
    }

    // Initialize ReleaseTimeManager if available
    if (typeof ReleaseTimeManager !== 'undefined') {
        ReleaseTimeManager.init();
        console.log('📋 ReleaseTimeManager initialized');
    }

    // Initialize ScheduleManager if available
    if (typeof ScheduleManager !== 'undefined') {
        await ScheduleManager.init();
        // Import workload data into ScheduleManager
        if (workloadData) {
            ScheduleManager.importFromWorkloadData(workloadData);
        }
        console.log('📝 ScheduleManager initialized');
    }

    // Setup year filter with callback
    setupYearFilter(workloadData, onYearChange);

    // Setup other filters
    document.getElementById('statusFilter').addEventListener('change', onFilterChange);
    document.getElementById('categoryFilter').addEventListener('change', onFilterChange);

    // Hide loading and show content
    hideLoadingShowContent();

    console.log('✅ Dashboard initialized');
}

/**
 * Handle year filter change
 * THIS IS THE KEY FIX - accessing .all property correctly
 */
function onYearChange(year) {
    console.log(`📅 Year changed to: ${year}`);

    currentFilters.year = year;

    // Get year-specific data using utility function
    // This correctly handles the .all, .fullTime, .adjunct structure
    currentYearData = getYearData(workloadData, year);

    // Update subtitle
    updateYearSubtitle(year, 'EWU Design Department - Academic Workload Analysis');

    // Refresh all visualizations
    refreshDashboard();
}

/**
 * Handle status/category filter change
 */
function onFilterChange() {
    currentFilters.status = document.getElementById('statusFilter').value;
    currentFilters.category = document.getElementById('categoryFilter').value;

    console.log('🔍 Filters changed:', currentFilters);

    refreshDashboard();
}

/**
 * Refresh all dashboard sections
 */
function refreshDashboard() {
    if (!currentYearData) {
        console.warn('⚠️ No year data available');
        return;
    }

    // Get faculty data based on category filter
    let facultyData = getFacultyByCategory(currentYearData, currentFilters.category);

    // Apply release time adjustments if ReleaseTimeManager is available
    if (typeof applyReleaseTimeToFacultyData === 'function') {
        facultyData = applyReleaseTimeToFacultyData(facultyData, currentFilters.year);
    }

    // Apply status filter if needed
    if (currentFilters.status !== 'all') {
        const filtered = {};
        Object.entries(facultyData).forEach(([name, data]) => {
            // Use effective status if available, otherwise original status
            const statusToCheck = data.effectiveStatus || data.status;
            if (statusToCheck === currentFilters.status) {
                filtered[name] = data;
            }
        });
        facultyData = filtered;
    }

    // Update all sections
    updateStatistics(currentYearData);
    renderWorkloadChart(facultyData);
    renderUtilizationPie(currentYearData);
    renderFullTimeFaculty(currentYearData.fullTime || {});
    renderAdjunctFaculty(currentYearData.adjunct || {});
    renderReleaseTimeStats(currentFilters.year, currentYearData);
    renderAppliedLearningStats(currentYearData.all || {});
}

/**
 * Update statistics cards
 */
function updateStatistics(yearData) {
    const stats = getYearStatistics(yearData);

    document.getElementById('totalFaculty').textContent = stats.total;
    document.getElementById('facultyBreakdown').textContent =
        `${stats.fullTime} Full-Time, ${stats.adjunct} Adjunct`;
    document.getElementById('overloadedFaculty').textContent = stats.overloaded;
    document.getElementById('optimalFaculty').textContent = stats.optimal;
    document.getElementById('underutilizedFaculty').textContent = stats.underutilized;
}

/**
 * Render workload distribution chart
 */
function renderWorkloadChart(facultyData) {
    const topFaculty = getTopFacultyByWorkload(facultyData, 15);

    // Destroy existing chart
    if (charts.workload) {
        destroyChart(charts.workload);
    }

    const canvas = document.getElementById('workloadDistributionChart');
    const datasets = createWorkloadDatasets(topFaculty);

    charts.workload = createStackedBarChart(canvas, {
        data: datasets,
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Scheduled Classes + Applied Learning (Weighted)'
                },
                tooltip: createWorkloadTooltip()
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Workload Credits'
                    }
                }
            }
        }
    });
}

/**
 * Render utilization pie chart
 */
function renderUtilizationPie(yearData) {
    const stats = getYearStatistics(yearData);

    // Destroy existing chart
    if (charts.utilization) {
        destroyChart(charts.utilization);
    }

    const canvas = document.getElementById('utilizationPieChart');
    const data = createUtilizationPieData(stats);

    charts.utilization = createPieChart(canvas, {
        data: data,
        options: {
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    }, 'doughnut');
}

/**
 * Render full-time faculty section
 */
function renderFullTimeFaculty(fullTimeData) {
    const faculty = Object.entries(fullTimeData);

    // Update badge
    document.getElementById('fullTimeBadge').textContent = `${faculty.length} Faculty`;

    // Render chart
    if (charts.fullTime) {
        destroyChart(charts.fullTime);
    }

    const topFaculty = faculty
        .sort((a, b) => b[1].totalWorkloadCredits - a[1].totalWorkloadCredits)
        .slice(0, 15);

    const canvas = document.getElementById('fullTimeChart');
    const datasets = createWorkloadDatasets(topFaculty);

    charts.fullTime = createStackedBarChart(canvas, {
        data: datasets,
        options: {
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: true
                }
            }
        }
    });

    // Render table
    renderFacultyTable(fullTimeData, 'fullTimeTable', true);
}

/**
 * Render adjunct faculty section
 */
function renderAdjunctFaculty(adjunctData) {
    const faculty = Object.entries(adjunctData);

    // Update badge
    document.getElementById('adjunctBadge').textContent = `${faculty.length} Faculty`;

    // Render table
    renderFacultyTable(adjunctData, 'adjunctTable', false);
}

/**
 * Render faculty table using safe DOM methods
 */
function renderFacultyTable(facultyData, tableId, includeRank) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;

    // Clear existing rows
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }

    const faculty = Object.entries(facultyData)
        .sort((a, b) => b[1].totalWorkloadCredits - a[1].totalWorkloadCredits);

    faculty.forEach(([name, data]) => {
        const row = document.createElement('tr');

        if (includeRank) {
            // Full-time faculty row with rank
            row.appendChild(createTableCell(formatFacultyName(name, data)));
            row.appendChild(createTableCell(data.rank || 'N/A'));
            row.appendChild(createTableCell(data.scheduledCredits || 0));

            // Applied learning cell with small text
            const alCell = document.createElement('td');
            alCell.textContent = (data.appliedLearningCredits || 0) + ' ';
            const small = document.createElement('small');
            small.textContent = '(' + (data.appliedLearningWorkload || 0).toFixed(1) + ' weighted)';
            alCell.appendChild(small);
            row.appendChild(alCell);

            // Total workload (bold)
            const totalCell = document.createElement('td');
            const strong = document.createElement('strong');
            strong.textContent = (data.totalWorkloadCredits || 0).toFixed(1);
            totalCell.appendChild(strong);
            row.appendChild(totalCell);

            row.appendChild(createTableCell(data.maxWorkload || 0));

            // Progress bar cell
            row.appendChild(createProgressCell(data.utilizationRate || 0, data.status));

            // Status badge cell
            const statusCell = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = 'status-badge ' + (data.status || '');
            badge.textContent = data.status || 'N/A';
            statusCell.appendChild(badge);
            row.appendChild(statusCell);

            // Actions cell
            row.appendChild(createActionsCell(name));
        } else {
            // Adjunct faculty row (simpler)
            row.appendChild(createTableCell(name));

            const totalCell = document.createElement('td');
            const strong = document.createElement('strong');
            strong.textContent = (data.totalWorkloadCredits || 0).toFixed(1);
            totalCell.appendChild(strong);
            row.appendChild(totalCell);

            row.appendChild(createTableCell((data.maxWorkload || 15) + ' (Adjunct limit)'));

            // Progress bar cell
            row.appendChild(createProgressCell(data.utilizationRate || 0, data.status));

            row.appendChild(createTableCell(data.sections || 0));

            // Actions cell
            row.appendChild(createActionsCell(name));
        }

        tbody.appendChild(row);
    });
}

/**
 * Helper to create actions cell with edit button
 */
function createActionsCell(facultyName) {
    const td = document.createElement('td');

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon btn-edit';
    editBtn.title = 'Edit courses';
    editBtn.textContent = '✏️';
    editBtn.onclick = () => openFacultyEditModal(facultyName);

    td.appendChild(editBtn);
    return td;
}

/**
 * Helper to create a simple table cell
 */
function createTableCell(content) {
    const td = document.createElement('td');
    td.textContent = String(content);
    return td;
}

/**
 * Helper to create a progress bar cell
 */
function createProgressCell(utilizationRate, status) {
    const td = document.createElement('td');

    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';

    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill ' + getUtilizationColorClass(status);
    progressFill.style.width = Math.min(100, utilizationRate) + '%';
    progressFill.textContent = utilizationRate.toFixed(1) + '%';

    progressBar.appendChild(progressFill);
    td.appendChild(progressBar);

    return td;
}

/**
 * Render applied learning statistics
 */
function renderAppliedLearningStats(facultyData) {
    const summary = calculateAppliedLearningSummary(facultyData);

    document.getElementById('desn499Credits').textContent =
        `${summary.desn499.credits} credits`;
    document.getElementById('desn499Workload').textContent =
        `${summary.desn499.workload.toFixed(1)} workload credits (${summary.desn499.sections} sections)`;

    document.getElementById('desn495Credits').textContent =
        `${summary.desn495.credits} credits`;
    document.getElementById('desn495Workload').textContent =
        `${summary.desn495.workload.toFixed(1)} workload credits (${summary.desn495.sections} sections)`;

    document.getElementById('totalAppliedCredits').textContent =
        `${summary.totalCredits} credits`;
    document.getElementById('totalAppliedWorkload').textContent =
        `${summary.totalWorkload.toFixed(1)} workload credits`;
}

/**
 * Render release time statistics section
 */
function renderReleaseTimeStats(academicYear, yearData) {
    // Get release time summary
    const releaseTimeSummary = calculateDepartmentReleaseTimeSummary(academicYear);

    // Calculate full-time capacity for impact percentage
    let fullTimeCapacity = 0;
    if (yearData && yearData.fullTime) {
        Object.values(yearData.fullTime).forEach(f => {
            fullTimeCapacity += f.maxWorkload || 0;
        });
    }

    // Update stats
    document.getElementById('totalReleaseCredits').textContent = releaseTimeSummary.totalCredits;

    document.getElementById('facultyWithRelease').textContent = releaseTimeSummary.totalFaculty;

    // Build breakdown text from categories
    const breakdownParts = [];
    if (releaseTimeSummary.byCategory) {
        Object.entries(releaseTimeSummary.byCategory).forEach(([cat, data]) => {
            if (data.credits > 0) {
                breakdownParts.push(`${cat}: ${data.credits}`);
            }
        });
    }
    document.getElementById('releaseBreakdown').textContent =
        breakdownParts.length > 0 ? breakdownParts.slice(0, 3).join(', ') : 'No allocations';

    // Calculate capacity impact percentage
    const impactPercent = fullTimeCapacity > 0
        ? Math.round((releaseTimeSummary.totalCredits / fullTimeCapacity) * 100 * 10) / 10
        : 0;
    document.getElementById('capacityImpact').textContent = impactPercent + '%';
}

// Initialize dashboard when page loads
window.addEventListener('load', initDashboard);


// ============================================
// INLINE EDITING FUNCTIONS
// ============================================

/**
 * Open faculty edit modal
 */
function openFacultyEditModal(facultyName) {
    const modal = document.getElementById('facultyEditModal');
    const titleEl = document.getElementById('editModalTitle');
    const hiddenInput = document.getElementById('editFacultyName');

    titleEl.textContent = `Edit Courses - ${facultyName}`;
    hiddenInput.value = facultyName;

    // Populate current courses
    renderCurrentCourses(facultyName);

    // Populate add course dropdown
    populateAddCourseDropdown();

    modal.classList.add('active');
}

/**
 * Close faculty edit modal
 */
function closeFacultyEditModal() {
    const modal = document.getElementById('facultyEditModal');
    modal.classList.remove('active');
    document.getElementById('newCourseDetails').style.display = 'none';
}

/**
 * Render current courses for faculty in modal
 */
function renderCurrentCourses(facultyName) {
    const container = document.getElementById('currentCoursesList');

    // Get faculty's courses from ScheduleManager
    let courses = [];
    if (typeof ScheduleManager !== 'undefined') {
        courses = ScheduleManager.getFacultySchedule(facultyName, currentFilters.year);
    }

    // If no ScheduleManager data, fall back to workload data
    if (courses.length === 0 && currentYearData) {
        const facultyData = currentYearData.all?.[facultyName];
        if (facultyData && facultyData.courses) {
            courses = facultyData.courses.map(c => ({
                id: c.courseCode + '-' + (c.section || '001'),
                courseCode: c.courseCode,
                section: c.section || '001',
                credits: c.credits,
                quarter: c.quarter || 'Fall'
            }));
        }
    }

    if (courses.length === 0) {
        container.innerHTML = '<div style="color: #6b7280; text-align: center; padding: 20px;">No courses assigned</div>';
        return;
    }

    container.innerHTML = courses.map(course => `
        <div class="course-edit-item" data-course-id="${course.id}">
            <div class="course-edit-info">
                <span class="course-edit-code">${course.courseCode}</span>
                <span class="course-edit-credits">${course.credits} cr - ${course.quarter}</span>
            </div>
            <button type="button" class="btn-remove-course" onclick="removeCourseFromFaculty('${course.id}')" title="Remove">×</button>
        </div>
    `).join('');
}

/**
 * Populate add course dropdown
 */
function populateAddCourseDropdown() {
    const select = document.getElementById('addCourseSelect');
    select.innerHTML = '<option value="">Select a course to add...</option>';

    if (typeof ScheduleManager !== 'undefined') {
        const catalog = ScheduleManager.getCourseCatalog();
        catalog.forEach(course => {
            const option = document.createElement('option');
            option.value = course.code;
            option.textContent = `${course.code} - ${course.title} (${course.defaultCredits} cr)`;
            option.dataset.credits = course.defaultCredits;
            select.appendChild(option);
        });
    }

    // Show/hide new course details when selection changes
    select.addEventListener('change', function() {
        const detailsDiv = document.getElementById('newCourseDetails');
        if (this.value) {
            detailsDiv.style.display = 'block';
            const selectedOption = this.options[this.selectedIndex];
            document.getElementById('newCourseCredits').value = selectedOption.dataset.credits || 5;
            document.getElementById('newCourseSection').value = '001';
        } else {
            detailsDiv.style.display = 'none';
        }
    });
}

/**
 * Add course to faculty
 */
function addCourseToFaculty() {
    const facultyName = document.getElementById('editFacultyName').value;
    const courseCode = document.getElementById('addCourseSelect').value;
    const section = document.getElementById('newCourseSection').value || '001';
    const credits = parseInt(document.getElementById('newCourseCredits').value) || 5;

    if (!courseCode) {
        alert('Please select a course');
        return;
    }

    if (typeof ScheduleManager !== 'undefined') {
        // Add to Fall quarter by default (can be changed in full editor)
        const result = ScheduleManager.addCourseAssignment(currentFilters.year, 'Fall', {
            courseCode,
            section,
            credits,
            assignedFaculty: facultyName
        });

        if (result.success) {
            renderCurrentCourses(facultyName);
            document.getElementById('addCourseSelect').value = '';
            document.getElementById('newCourseDetails').style.display = 'none';
            refreshDashboard();
        } else {
            alert('Error adding course: ' + result.errors.join(', '));
        }
    } else {
        alert('Schedule Manager not available. Use the full Schedule Editor.');
    }
}

/**
 * Remove course from faculty
 */
function removeCourseFromFaculty(courseId) {
    const facultyName = document.getElementById('editFacultyName').value;

    if (typeof ScheduleManager !== 'undefined') {
        // Try to find and remove from each quarter
        ['Fall', 'Winter', 'Spring', 'Summer'].forEach(quarter => {
            ScheduleManager.unassignFromFaculty(currentFilters.year, quarter, courseId);
        });

        renderCurrentCourses(facultyName);
        refreshDashboard();
    }
}

/**
 * Open schedule editor page
 */
function openScheduleEditor() {
    window.location.href = 'schedule-editor.html';
}
