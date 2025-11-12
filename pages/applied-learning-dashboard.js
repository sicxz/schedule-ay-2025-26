/**
 * EWU Design Applied Learning Dashboard
 * Tracks DESN 499, 495, 491 supervision and trends
 */

// Global state
let workloadData = null;
let currentYear = '2024-25';
let charts = {};

/**
 * Initialize dashboard
 */
async function initDashboard() {
    console.log('🚀 Initializing Applied Learning Dashboard');

    // Load workload data
    workloadData = await loadWorkloadData('../');

    if (!workloadData) {
        showError('Failed to load workload data.');
        return;
    }

    // Setup year filter
    document.getElementById('academicYearFilter').addEventListener('change', onYearChange);

    // Initial load
    onYearChange({ target: { value: currentYear } });

    hideLoadingShowContent();

    console.log('✅ Dashboard initialized');
}

/**
 * Handle year change
 */
function onYearChange(event) {
    if (event && event.target) {
        currentYear = event.target.value;
    }

    console.log(`📅 Year changed to: ${currentYear}`);

    // Update badges
    document.getElementById('yearBadge').textContent = currentYear === 'all'
        ? 'All Years'
        : currentYear;
    document.getElementById('currentYearBadge').textContent = currentYear === 'all'
        ? 'All Years'
        : currentYear;

    // Refresh all visualizations
    refreshDashboard();
}

/**
 * Refresh all dashboard sections
 */
function refreshDashboard() {
    if (!workloadData || !workloadData.appliedLearningTrends) {
        console.warn('⚠️ No applied learning data available');
        return;
    }

    updateSummaryStats();
    renderCumulativeTrendChart();
    renderInstructorSummaryChart();
    renderAnnualBreakdownTable();
    renderCurrentYearDetails();
}

/**
 * Update summary statistics
 */
function updateSummaryStats() {
    const trends = workloadData.appliedLearningTrends.trends;

    if (currentYear === 'all') {
        // Calculate cumulative totals
        let total499 = 0, total495 = 0, total491 = 0;
        let totalStudents = 0, totalWorkload = 0;
        let sections499 = 0, sections495 = 0, sections491 = 0;

        Object.values(trends).forEach(yearData => {
            total499 += yearData['DESN 499'].totalCredits || 0;
            total495 += yearData['DESN 495'].totalCredits || 0;
            // Note: DESN 491 might not be in the data yet
            total491 += (yearData['DESN 491']?.totalCredits || 0);

            totalStudents += yearData.total.students || 0;
            totalWorkload += yearData.total.workloadEquivalent || 0;

            sections499 += yearData['DESN 499'].sections || 0;
            sections495 += yearData['DESN 495'].sections || 0;
            sections491 += (yearData['DESN 491']?.sections || 0);
        });

        document.getElementById('desn499Total').textContent = `${totalStudents} students`;
        document.getElementById('desn499Credits').textContent = `${total499} total credits`;
        document.getElementById('desn499Sections').textContent = `${sections499} sections`;
        document.getElementById('desn499Workload').textContent = `${(total499 * 0.2).toFixed(1)} workload`;

        document.getElementById('desn495Total').textContent = `${totalStudents} students`;
        document.getElementById('desn495Credits').textContent = `${total495} total credits`;
        document.getElementById('desn495Sections').textContent = `${sections495} sections`;
        document.getElementById('desn495Workload').textContent = `${(total495 * 0.1).toFixed(1)} workload`;

        document.getElementById('desn491Total').textContent = `${total491} credits`;
        document.getElementById('desn491Credits').textContent = `${total491} total credits`;
        document.getElementById('desn491Sections').textContent = `${sections491} sections`;

        document.getElementById('totalStudents').textContent = totalStudents;
        document.getElementById('totalWorkload').textContent = `${totalWorkload.toFixed(1)} credits`;

    } else {
        // Show specific year
        const yearData = trends[currentYear];

        if (yearData) {
            const desn499 = yearData['DESN 499'];
            const desn495 = yearData['DESN 495'];
            const desn491 = yearData['DESN 491'] || { totalCredits: 0, students: 0, sections: 0 };

            document.getElementById('desn499Total').textContent = `${desn499.students} students`;
            document.getElementById('desn499Credits').textContent = `${desn499.totalCredits} credits`;
            document.getElementById('desn499Sections').textContent = `${desn499.sections} sections`;
            document.getElementById('desn499Workload').textContent = `${desn499.workloadCredits.toFixed(1)} workload`;

            document.getElementById('desn495Total').textContent = `${desn495.students} students`;
            document.getElementById('desn495Credits').textContent = `${desn495.totalCredits} credits`;
            document.getElementById('desn495Sections').textContent = `${desn495.sections} sections`;
            document.getElementById('desn495Workload').textContent = `${desn495.workloadCredits.toFixed(1)} workload`;

            document.getElementById('desn491Total').textContent = `${desn491.totalCredits} credits`;
            document.getElementById('desn491Credits').textContent = `${desn491.totalCredits} credits`;
            document.getElementById('desn491Sections').textContent = `${desn491.sections} sections`;

            document.getElementById('totalStudents').textContent = yearData.total.students;
            document.getElementById('totalWorkload').textContent = `${yearData.total.workloadEquivalent.toFixed(1)} credits`;
        }
    }
}

/**
 * Render cumulative trend chart
 */
function renderCumulativeTrendChart() {
    if (charts.cumulative) {
        destroyChart(charts.cumulative);
    }

    const trends = workloadData.appliedLearningTrends.trends;
    const years = workloadData.appliedLearningTrends.years;

    const data499 = years.map(year => trends[year]['DESN 499'].totalCredits);
    const data495 = years.map(year => trends[year]['DESN 495'].totalCredits);
    const data491 = years.map(year => trends[year]['DESN 491']?.totalCredits || 0);

    const canvas = document.getElementById('cumulativeTrendChart');

    charts.cumulative = createLineChart(canvas, {
        data: {
            labels: years,
            datasets: [
                {
                    label: 'DESN 499 (Independent Study)',
                    data: data499,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true
                },
                {
                    label: 'DESN 495 (Internship)',
                    data: data495,
                    borderColor: '#51cf66',
                    backgroundColor: 'rgba(81, 207, 102, 0.1)',
                    borderWidth: 3,
                    fill: true
                },
                {
                    label: 'DESN 491 (Senior Project)',
                    data: data491,
                    borderColor: '#ffa726',
                    backgroundColor: 'rgba(255, 167, 38, 0.1)',
                    borderWidth: 3,
                    fill: true
                }
            ]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: 'Growth in Applied Learning Credits (2022-2026)'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Total Credits'
                    }
                }
            }
        }
    });
}

/**
 * Render instructor summary chart
 */
function renderInstructorSummaryChart() {
    if (charts.instructorSummary) {
        destroyChart(charts.instructorSummary);
    }

    // Aggregate by instructor across all years
    const instructorData = {};
    const trends = workloadData.appliedLearningTrends.trends;

    Object.values(trends).forEach(yearData => {
        // DESN 499
        Object.entries(yearData['DESN 499'].supervisors || {}).forEach(([instructor, data]) => {
            if (!instructorData[instructor]) {
                instructorData[instructor] = { desn499: 0, desn495: 0, desn491: 0 };
            }
            instructorData[instructor].desn499 += data.credits || 0;
        });

        // DESN 495
        Object.entries(yearData['DESN 495'].supervisors || {}).forEach(([instructor, data]) => {
            if (!instructorData[instructor]) {
                instructorData[instructor] = { desn499: 0, desn495: 0, desn491: 0 };
            }
            instructorData[instructor].desn495 += data.credits || 0;
        });

        // DESN 491 (if exists)
        if (yearData['DESN 491'] && yearData['DESN 491'].supervisors) {
            Object.entries(yearData['DESN 491'].supervisors).forEach(([instructor, data]) => {
                if (!instructorData[instructor]) {
                    instructorData[instructor] = { desn499: 0, desn495: 0, desn491: 0 };
                }
                instructorData[instructor].desn491 += data.credits || 0;
            });
        }
    });

    // Sort by total credits
    const sorted = Object.entries(instructorData)
        .map(([name, data]) => ({
            name,
            ...data,
            total: data.desn499 + data.desn495 + data.desn491
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 15);

    const canvas = document.getElementById('instructorSummaryChart');

    charts.instructorSummary = createStackedBarChart(canvas, {
        data: {
            labels: sorted.map(d => d.name),
            datasets: [
                {
                    label: 'DESN 499',
                    data: sorted.map(d => d.desn499),
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: '#667eea',
                    borderWidth: 2
                },
                {
                    label: 'DESN 495',
                    data: sorted.map(d => d.desn495),
                    backgroundColor: 'rgba(81, 207, 102, 0.8)',
                    borderColor: '#51cf66',
                    borderWidth: 2
                },
                {
                    label: 'DESN 491',
                    data: sorted.map(d => d.desn491),
                    backgroundColor: 'rgba(255, 167, 38, 0.8)',
                    borderColor: '#ffa726',
                    borderWidth: 2
                }
            ]
        },
        options: {
            indexAxis: 'y',
            plugins: {
                title: {
                    display: true,
                    text: 'Total Applied Learning Credits by Faculty (2022-2026)'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Total Credits'
                    }
                }
            }
        }
    });
}

/**
 * Render annual breakdown table
 */
function renderAnnualBreakdownTable() {
    const tbody = document.querySelector('#annualBreakdownTable tbody');
    tbody.innerHTML = '';

    // Get all instructors across all years
    const instructors = new Set();
    const trends = workloadData.appliedLearningTrends.trends;

    Object.values(trends).forEach(yearData => {
        Object.keys(yearData['DESN 499'].supervisors || {}).forEach(name => instructors.add(name));
        Object.keys(yearData['DESN 495'].supervisors || {}).forEach(name => instructors.add(name));
        if (yearData['DESN 491']) {
            Object.keys(yearData['DESN 491'].supervisors || {}).forEach(name => instructors.add(name));
        }
    });

    const sortedInstructors = Array.from(instructors).sort();

    sortedInstructors.forEach(instructor => {
        const row = document.createElement('tr');

        let totalCredits = 0;

        let html = `<td><strong>${instructor}</strong></td>`;

        // For each year
        ['2022-23', '2023-24', '2024-25', '2025-26'].forEach(year => {
            const yearData = trends[year];

            if (yearData) {
                const credits499 = yearData['DESN 499'].supervisors?.[instructor]?.credits || 0;
                const credits495 = yearData['DESN 495'].supervisors?.[instructor]?.credits || 0;
                const credits491 = yearData['DESN 491']?.supervisors?.[instructor]?.credits || 0;

                totalCredits += credits499 + credits495 + credits491;

                html += `
                    <td>${credits499 || '-'}</td>
                    <td>${credits495 || '-'}</td>
                    <td>${credits491 || '-'}</td>
                `;
            } else {
                html += `<td>-</td><td>-</td><td>-</td>`;
            }
        });

        html += `<td><strong>${totalCredits}</strong></td>`;

        row.innerHTML = html;
        tbody.appendChild(row);
    });
}

/**
 * Render current year details
 */
function renderCurrentYearDetails() {
    if (currentYear === 'all') {
        document.getElementById('desn499Details').innerHTML = '<p>Select a specific year to view details.</p>';
        document.getElementById('desn495Details').innerHTML = '<p>Select a specific year to view details.</p>';
        document.getElementById('desn491Details').innerHTML = '<p>Select a specific year to view details.</p>';
        return;
    }

    const yearData = workloadData.appliedLearningTrends.trends[currentYear];

    if (!yearData) {
        document.getElementById('desn499Details').innerHTML = '<p>No data available for this year.</p>';
        document.getElementById('desn495Details').innerHTML = '<p>No data available for this year.</p>';
        document.getElementById('desn491Details').innerHTML = '<p>No data available for this year.</p>';
        return;
    }

    // DESN 499 Details
    const desn499 = yearData['DESN 499'];
    let html499 = `
        <div class="card-metric">
            <span class="card-metric-label">Total Students:</span>
            <span class="card-metric-value">${desn499.students}</span>
        </div>
        <div class="card-metric">
            <span class="card-metric-label">Total Credits:</span>
            <span class="card-metric-value">${desn499.totalCredits}</span>
        </div>
        <div class="card-metric">
            <span class="card-metric-label">Sections:</span>
            <span class="card-metric-value">${desn499.sections}</span>
        </div>
        <div class="card-metric">
            <span class="card-metric-label">Workload Equivalent:</span>
            <span class="card-metric-value">${desn499.workloadCredits.toFixed(1)} (0.2× multiplier)</span>
        </div>
        <h4 style="margin-top: 15px; margin-bottom: 10px;">Supervisors:</h4>
    `;

    Object.entries(desn499.supervisors || {}).forEach(([name, data]) => {
        html499 += `
            <div class="card-metric">
                <span class="card-metric-label">${name}:</span>
                <span class="card-metric-value">${data.credits} credits (${data.sections} sections)</span>
            </div>
        `;
    });

    document.getElementById('desn499Details').innerHTML = html499;

    // DESN 495 Details
    const desn495 = yearData['DESN 495'];
    let html495 = `
        <div class="card-metric">
            <span class="card-metric-label">Total Students:</span>
            <span class="card-metric-value">${desn495.students}</span>
        </div>
        <div class="card-metric">
            <span class="card-metric-label">Total Credits:</span>
            <span class="card-metric-value">${desn495.totalCredits}</span>
        </div>
        <div class="card-metric">
            <span class="card-metric-label">Sections:</span>
            <span class="card-metric-value">${desn495.sections}</span>
        </div>
        <div class="card-metric">
            <span class="card-metric-label">Workload Equivalent:</span>
            <span class="card-metric-value">${desn495.workloadCredits.toFixed(1)} (0.1× multiplier)</span>
        </div>
        <h4 style="margin-top: 15px; margin-bottom: 10px;">Supervisors:</h4>
    `;

    Object.entries(desn495.supervisors || {}).forEach(([name, data]) => {
        html495 += `
            <div class="card-metric">
                <span class="card-metric-label">${name}:</span>
                <span class="card-metric-value">${data.credits} credits (${data.sections} sections)</span>
            </div>
        `;
    });

    document.getElementById('desn495Details').innerHTML = html495;

    // DESN 491 Details
    const desn491 = yearData['DESN 491'] || { students: 0, totalCredits: 0, sections: 0, supervisors: {} };
    let html491 = `
        <div class="card-metric">
            <span class="card-metric-label">Total Students:</span>
            <span class="card-metric-value">${desn491.students || 0}</span>
        </div>
        <div class="card-metric">
            <span class="card-metric-label">Total Credits:</span>
            <span class="card-metric-value">${desn491.totalCredits || 0}</span>
        </div>
        <div class="card-metric">
            <span class="card-metric-label">Sections:</span>
            <span class="card-metric-value">${desn491.sections || 0}</span>
        </div>
    `;

    if (desn491.supervisors && Object.keys(desn491.supervisors).length > 0) {
        html491 += '<h4 style="margin-top: 15px; margin-bottom: 10px;">Supervisors:</h4>';
        Object.entries(desn491.supervisors).forEach(([name, data]) => {
            html491 += `
                <div class="card-metric">
                    <span class="card-metric-label">${name}:</span>
                    <span class="card-metric-value">${data.credits} credits (${data.sections} sections)</span>
                </div>
            `;
        });
    } else {
        html491 += '<p style="margin-top: 15px; color: #6c757d;">No DESN 491 data available for this year.</p>';
    }

    document.getElementById('desn491Details').innerHTML = html491;
}

// Initialize on page load
window.addEventListener('load', initDashboard);
