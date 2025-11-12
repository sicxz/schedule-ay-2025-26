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

    // Apply status filter if needed
    if (currentFilters.status !== 'all') {
        const filtered = {};
        Object.entries(facultyData).forEach(([name, data]) => {
            if (data.status === currentFilters.status) {
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
 * Render faculty table
 */
function renderFacultyTable(facultyData, tableId, includeRank) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '';

    const faculty = Object.entries(facultyData)
        .sort((a, b) => b[1].totalWorkloadCredits - a[1].totalWorkloadCredits);

    faculty.forEach(([name, data]) => {
        const row = document.createElement('tr');

        if (includeRank) {
            row.innerHTML = `
                <td>${formatFacultyName(name, data)}</td>
                <td>${data.rank || 'N/A'}</td>
                <td>${data.scheduledCredits || 0}</td>
                <td>${data.appliedLearningCredits || 0}
                    <small>(${(data.appliedLearningWorkload || 0).toFixed(1)} weighted)</small>
                </td>
                <td><strong>${(data.totalWorkloadCredits || 0).toFixed(1)}</strong></td>
                <td>${data.maxWorkload || 0}</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill ${getUtilizationColorClass(data.status)}"
                             style="width: ${Math.min(100, data.utilizationRate || 0)}%">
                            ${(data.utilizationRate || 0).toFixed(1)}%
                        </div>
                    </div>
                </td>
                <td><span class="status-badge ${data.status}">${data.status || 'N/A'}</span></td>
            `;
        } else {
            row.innerHTML = `
                <td>${name}</td>
                <td><strong>${(data.totalWorkloadCredits || 0).toFixed(1)}</strong></td>
                <td>${data.maxWorkload || 15} (Adjunct limit)</td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill ${getUtilizationColorClass(data.status)}"
                             style="width: ${Math.min(100, data.utilizationRate || 0)}%">
                            ${(data.utilizationRate || 0).toFixed(1)}%
                        </div>
                    </div>
                </td>
                <td>${data.sections || 0}</td>
            `;
        }

        tbody.appendChild(row);
    });
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

// Initialize dashboard when page loads
window.addEventListener('load', initDashboard);
