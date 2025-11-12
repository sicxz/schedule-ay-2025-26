/**
 * Capacity Planning Dashboard
 * Year-specific faculty capacity analysis
 */

// State
let workloadData = null;
let enrollmentData = null;
let currentYearData = null;
let currentYear = '2025-26'; // Default to current academic year
let currentQuarter = 'annual';
let includeAppliedLearning = true; // Default to include applied learning

// Chart instances
let charts = {
    capacity: null,
    utilization: null,
    ratio: null,
    forecast: null,
    quarterly: null
};

// Initialize
async function initDashboard() {
    console.log('📊 Initializing Capacity Planning Dashboard');

    // Load both enrollment and workload data
    const [enrollmentResult, workloadResult] = await Promise.all([
        loadEnrollmentData('../'),
        loadWorkloadData('../')
    ]);

    enrollmentData = enrollmentResult;
    workloadData = workloadResult;

    if (!enrollmentData) {
        document.getElementById('loadingMessage').innerHTML = `
            <p style="color: #ff6b6b;">⚠️ Unable to load enrollment data.</p>
        `;
        return;
    }

    // Check if capacity planning data exists
    if (!enrollmentData.capacityPlanning) {
        document.getElementById('loadingMessage').innerHTML = `
            <p style="color: #ff6b6b;">⚠️ Capacity planning data not available. Please run process-enrollment-data.js</p>
        `;
        return;
    }

    // Setup year filter with available years from capacity planning
    const availableYears = Object.keys(enrollmentData.capacityPlanning).sort();

    // Use the most recent year as default if currentYear isn't available
    if (!availableYears.includes(currentYear) && availableYears.length > 0) {
        currentYear = availableYears[availableYears.length - 1]; // Most recent year
    }

    setupYearFilterFromList(availableYears, 'academicYearFilter', (year) => onYearChange(year), currentYear);

    // Setup quarter filter
    const quarterFilter = document.getElementById('quarterFilter');
    if (quarterFilter) {
        quarterFilter.addEventListener('change', (e) => onQuarterChange(e.target.value));
    }

    // Setup applied learning toggle
    const appliedLearningCheckbox = document.getElementById('includeAppliedLearning');
    if (appliedLearningCheckbox) {
        appliedLearningCheckbox.addEventListener('change', (e) => onAppliedLearningToggle(e.target.checked));
    }

    document.getElementById('loadingMessage').style.display = 'none';
    document.getElementById('dashboardContent').style.display = 'block';

    // Update subtitle with year
    updateYearSubtitle(currentYear, 'Faculty Capacity & Enrollment Analysis');

    analyzeCapacity();
}

function setupYearFilterFromList(years, filterId, onChange, defaultYear) {
    const filter = document.getElementById(filterId);
    if (!filter) return;

    filter.innerHTML = years.map(year =>
        `<option value="${year}" ${year === defaultYear ? 'selected' : ''}>${year}</option>`
    ).join('');

    filter.addEventListener('change', (e) => onChange(e.target.value));
}

function onYearChange(year) {
    console.log(`📅 Year changed to: ${year}`);
    currentYear = year;

    // Update subtitle
    updateYearSubtitle(year, 'Faculty Capacity & Enrollment Analysis');

    // Refresh analysis
    analyzeCapacity();
}

function onQuarterChange(quarter) {
    console.log(`📅 Quarter changed to: ${quarter}`);
    currentQuarter = quarter;

    // Refresh analysis with quarter filter
    analyzeCapacity();
}

function onAppliedLearningToggle(include) {
    console.log(`📚 Applied Learning: ${include ? 'included' : 'excluded'}`);
    includeAppliedLearning = include;

    // Refresh analysis
    analyzeCapacity();
}

/**
 * Calculate workload for a specific quarter
 */
function calculateQuarterWorkload(facultyData, quarter) {
    if (quarter === 'annual' || !facultyData.courses) {
        return facultyData.totalWorkloadCredits;
    }

    // Filter courses by quarter and sum workload
    return facultyData.courses
        .filter(course => course.quarter === quarter)
        .reduce((sum, course) => sum + (course.workloadCredits || 0), 0);
}

function analyzeCapacity() {
    if (!enrollmentData || !enrollmentData.capacityPlanning) {
        console.error('No capacity planning data available');
        return;
    }

    const yearData = enrollmentData.capacityPlanning[currentYear];
    if (!yearData) {
        console.error(`No capacity data for year: ${currentYear}`);
        return;
    }

    // Get year-specific workload data
    let yearWorkloadData = {};
    let yearAdjunctData = {};

    if (workloadData && workloadData.workloadByYear && workloadData.workloadByYear.byYear) {
        const yearData_workload = workloadData.workloadByYear.byYear[currentYear];
        if (yearData_workload) {
            yearWorkloadData = yearData_workload.fullTime || {};
            yearAdjunctData = yearData_workload.adjunct || {};
        }
    }

    // Build capacity data from fullTimeFaculty
    const capacityData = yearData.fullTimeFaculty.map(faculty => {
        const maxCapacity = faculty.capacity;

        // Get actual workload from year-specific workload data
        const facultyWorkload = yearWorkloadData[faculty.name];

        // Use either total workload (with applied learning) or scheduled only
        let currentLoad = 0;
        if (facultyWorkload) {
            if (includeAppliedLearning) {
                currentLoad = facultyWorkload.totalWorkloadCredits || 0;
            } else {
                currentLoad = facultyWorkload.scheduledCredits || 0;
            }
        }

        const available = maxCapacity - currentLoad;
        const utilizationRate = maxCapacity > 0 ? (currentLoad / maxCapacity) * 100 : 0;

        // Check for release time (sabbatical or chair duties)
        let hasReleaseTime = false;
        let releaseReason = '';

        // Check faculty mapping for sabbatical or chair status
        if (enrollmentData && enrollmentData.capacityPlanning) {
            const capacityInfo = enrollmentData.capacityPlanning[currentYear];

            // Check if this is Melinda Breen with reduced capacity (chair release)
            if (faculty.name === 'Melinda Breen' && maxCapacity < 15) {
                hasReleaseTime = true;
                releaseReason = 'Chair (Full Release)';
            } else if (faculty.name === 'Melinda Breen' && maxCapacity === 15) {
                hasReleaseTime = true;
                releaseReason = 'Chair (Partial Release)';
            }

            // Check if faculty has very low/no load (sabbatical)
            if (currentLoad === 0 && maxCapacity === 0) {
                hasReleaseTime = true;
                releaseReason = 'Sabbatical';
            }

            // Ginelle Hustrulid sabbatical in 2022-23, Travis sabbatical in 2023-24
            if (faculty.name === 'Ginelle Hustrulid' && currentYear === '2022-23') {
                hasReleaseTime = true;
                releaseReason = 'Sabbatical';
            }
            if (faculty.name === 'Travis Masingale' && currentYear === '2023-24') {
                hasReleaseTime = true;
                releaseReason = 'Sabbatical';
            }
        }

        const status = hasReleaseTime ? 'release' :
                      utilizationRate > 100 ? 'overloaded' :
                      utilizationRate >= 60 ? 'optimal' : 'underutilized';

        return {
            name: faculty.name,
            maxCapacity: maxCapacity,
            currentLoad: currentLoad,
            available: available,
            utilizationRate: utilizationRate,
            status: status,
            hasReleaseTime: hasReleaseTime,
            releaseReason: releaseReason,
            category: 'fullTime'
        };
    });

    // Calculate actual workload totals from workload data
    let actualFullTimeLoad = capacityData.reduce((sum, f) => sum + f.currentLoad, 0);
    let actualAdjunctLoad = 0;

    // Add adjunct pool indicator from year-specific data
    if (Object.keys(yearAdjunctData).length > 0) {
        // Use either total workload or scheduled credits for adjuncts
        actualAdjunctLoad = Object.values(yearAdjunctData).reduce((sum, adj) => {
            const load = includeAppliedLearning ?
                (adj.totalWorkloadCredits || 0) :
                (adj.scheduledCredits || 0);
            return sum + load;
        }, 0);

        capacityData.push({
            name: `Adjunct Pool (${Object.keys(yearAdjunctData).length})`,
            maxCapacity: 0,
            currentLoad: actualAdjunctLoad,
            available: 0,
            utilizationRate: 0,
            status: 'overloaded',
            category: 'adjunct'
        });
    } else if (yearData.adjunctCount > 0) {
        // Fallback to yearData if workload data not available for this year
        actualAdjunctLoad = yearData.adjunctLoad || 0;
        capacityData.push({
            name: `Adjunct Pool (${yearData.adjunctCount})`,
            maxCapacity: 0,
            currentLoad: actualAdjunctLoad,
            available: 0,
            utilizationRate: 0,
            status: 'overloaded',
            category: 'adjunct'
        });
    }

    const totalCapacity = yearData.totalFullTimeCapacity;
    const currentLoad = actualFullTimeLoad;
    const adjunctLoad = actualAdjunctLoad;
    const totalDemand = currentLoad + adjunctLoad;
    const netAvailable = totalCapacity - totalDemand;

    // Update stats
    document.getElementById('totalCapacity').textContent = totalCapacity;
    document.getElementById('currentLoad').textContent = totalDemand.toFixed(1);
    document.getElementById('availableCapacity').textContent = netAvailable.toFixed(1);
    document.getElementById('additionalNeeded').textContent = Math.abs(netAvailable) < 0.1 ? '0.0' : Math.max(0, -netAvailable).toFixed(1);

    // Show alerts based on actual department capacity
    const alertsContainer = document.getElementById('capacityAlerts');
    const adjunctCount = Object.keys(yearAdjunctData).length || yearData.adjunctCount;
    const utilizationPercent = totalCapacity > 0 ? ((totalDemand / totalCapacity) * 100).toFixed(1) + '%' : '0.0%';
    const workloadNote = includeAppliedLearning ?
        'Scheduled courses + Applied Learning (499, 495, etc.)' :
        'Scheduled courses only (excludes Applied Learning)';

    if (netAvailable < 0) {
        // Over capacity
        const projectedAdjunctNeed = Math.abs(netAvailable);
        alertsContainer.innerHTML = `
            <div class="alert-box" style="background: linear-gradient(135deg, #ff6b6b 0%, #fa5252 100%);">
                <h3>⚠️ Over-Capacity Alert</h3>
                <p><em>${workloadNote}</em></p>
                <p style="margin-top: 10px;">Total demand: <strong>${totalDemand.toFixed(1)} credits</strong> (Full-time: ${currentLoad.toFixed(1)} + Adjuncts: ${adjunctLoad.toFixed(1)})</p>
                <p style="margin-top: 10px;">Full-time baseline capacity: <strong>${totalCapacity} credits</strong></p>
                <p style="margin-top: 10px;"><strong>Program is ${projectedAdjunctNeed.toFixed(1)} credits OVER baseline capacity.</strong></p>
                <p style="margin-top: 10px;"><em>Adjunct capacity = 0 for planning purposes. ${adjunctCount} adjunct(s) teaching indicates over-capacity demand.</em></p>
                <p style="margin-top: 10px;"><strong>Projected Adjunct Need: ${projectedAdjunctNeed.toFixed(1)} credits</strong> (approx. ${Math.ceil(projectedAdjunctNeed / 15)} adjunct instructor(s) @ 15 credits each)</p>
                <p style="margin-top: 10px;">Utilization: ${utilizationPercent}</p>
            </div>
        `;
    } else if (adjunctLoad > 0) {
        // Using adjuncts but still within capacity
        alertsContainer.innerHTML = `
            <div class="alert-box" style="background: linear-gradient(135deg, #ffa726 0%, #fb8c00 100%);">
                <h3>⚠️ Adjunct Usage Alert</h3>
                <p><em>${workloadNote}</em></p>
                <p style="margin-top: 10px;">Program is using <strong>${adjunctCount} adjunct instructor(s)</strong> teaching ${adjunctLoad.toFixed(1)} credits.</p>
                <p style="margin-top: 10px;"><strong>Adjunct capacity = 0 for planning purposes.</strong></p>
                <p style="margin-top: 10px;">Net available capacity: ${netAvailable.toFixed(1)} credits | Utilization: ${utilizationPercent}</p>
            </div>
        `;
    } else {
        alertsContainer.innerHTML = `
            <div class="alert-box" style="background: linear-gradient(135deg, #51cf66 0%, #37b24d 100%);">
                <h3>✅ Capacity Status - Within Baseline</h3>
                <p><em>${workloadNote}</em></p>
                <p style="margin-top: 10px;">Total demand: ${totalDemand.toFixed(1)} credits | Full-time baseline capacity: ${totalCapacity} credits</p>
                <p style="margin-top: 10px;">Available capacity: <strong>${netAvailable.toFixed(1)} credits</strong></p>
                <p style="margin-top: 10px;">Utilization: ${utilizationPercent}</p>
            </div>
        `;
    }

    renderCapacityChart(capacityData);
    renderUtilizationChart(capacityData);
    renderRatioChart();
    renderForecastCapacityChart();
    renderCapacityTable(capacityData);

    // Hide quarterly comparison chart since we don't have quarter-specific data
    const quarterlyContainer = document.getElementById('quarterlyCapacityContainer');
    if (quarterlyContainer) {
        quarterlyContainer.style.display = 'none';
    }
}

function renderCapacityChart(data) {
    const canvas = document.getElementById('capacityChart');

    // Destroy existing chart
    if (charts.capacity) {
        charts.capacity.destroy();
    }

    // Separate full-time and adjunct faculty
    const fullTime = data.filter(d => d.category === 'fullTime');
    const adjuncts = data.filter(d => d.category === 'adjunct');

    // Create adjunct pool entry
    const adjunctPool = {
        name: 'Adjunct Pool',
        maxCapacity: adjuncts.reduce((sum, a) => sum + a.maxCapacity, 0),
        currentLoad: adjuncts.reduce((sum, a) => sum + a.currentLoad, 0),
        available: adjuncts.reduce((sum, a) => sum + a.available, 0),
        category: 'adjunct'
    };

    // Calculate adjunct pool utilization
    adjunctPool.utilizationRate = adjunctPool.maxCapacity > 0
        ? (adjunctPool.currentLoad / adjunctPool.maxCapacity) * 100
        : 0;

    // Determine adjunct pool status
    adjunctPool.status = adjunctPool.utilizationRate > 100 ? 'overloaded' :
                         adjunctPool.utilizationRate >= 60 ? 'optimal' : 'underutilized';

    // Sort full-time by current load (descending), then add adjunct pool
    const sortedFullTime = fullTime.sort((a, b) => b.currentLoad - a.currentLoad);
    const chartData = [...sortedFullTime, adjunctPool];

    charts.capacity = createBarChart(canvas, {
        data: {
            labels: chartData.map(d => d.name),
            datasets: [
                {
                    label: 'Max Capacity',
                    data: chartData.map(d => d.maxCapacity),
                    backgroundColor: 'rgba(102, 126, 234, 0.3)',
                    borderColor: '#667eea',
                    borderWidth: 2
                },
                {
                    label: 'Current Load',
                    data: chartData.map(d => d.currentLoad),
                    backgroundColor: chartData.map(d =>
                        d.status === 'release' ? 'rgba(255, 193, 7, 0.8)' :  // Yellow for release time
                        d.status === 'overloaded' ? 'rgba(255, 107, 107, 0.8)' :
                        d.status === 'optimal' ? 'rgba(255, 167, 38, 0.8)' :
                        'rgba(81, 207, 102, 0.8)'
                    ),
                    borderColor: chartData.map(d =>
                        d.status === 'release' ? '#FFC107' :  // Yellow border for release time
                        d.status === 'overloaded' ? '#ff6b6b' :
                        d.status === 'optimal' ? '#ffa726' :
                        '#51cf66'
                    ),
                    borderWidth: 2
                }
            ]
        },
        options: {
            indexAxis: 'y',
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const index = context.dataIndex;
                            const faculty = chartData[index];
                            if (faculty.hasReleaseTime && faculty.releaseReason) {
                                return `⚠️ ${faculty.releaseReason}`;
                            }
                            return null;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Workload Credits'
                    }
                }
            }
        }
    });
}

function renderUtilizationChart(data) {
    const canvas = document.getElementById('utilizationChart');

    // Destroy existing chart
    if (charts.utilization) {
        charts.utilization.destroy();
    }

    const overloaded = data.filter(d => d.status === 'overloaded').length;
    const optimal = data.filter(d => d.status === 'optimal').length;
    const underutilized = data.filter(d => d.status === 'underutilized').length;

    charts.utilization = createPieChart(canvas, {
        data: {
            labels: ['Overloaded (>100%)', 'Optimal (60-100%)', 'Underutilized (<60%)'],
            datasets: [{
                data: [overloaded, optimal, underutilized],
                backgroundColor: [
                    'rgba(255, 107, 107, 0.8)',
                    'rgba(255, 167, 38, 0.8)',
                    'rgba(81, 207, 102, 0.8)'
                ],
                borderColor: ['#ff6b6b', '#ffa726', '#51cf66'],
                borderWidth: 2
            }]
        },
        options: {
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function renderRatioChart() {
    const canvas = document.getElementById('ratioChart');

    // Destroy existing chart
    if (charts.ratio) {
        charts.ratio.destroy();
    }

    // Calculate student-to-faculty ratio per quarter
    const census = enrollmentData.censusData;
    const facultyCount = Object.keys(currentYearData.all || {}).length;

    if (facultyCount === 0) {
        console.warn('No faculty data for current year');
        return;
    }

    const ratios = census.headcount.map(count => (count / facultyCount).toFixed(1));

    charts.ratio = createLineChart(canvas, {
        data: {
            labels: census.quarters,
            datasets: [{
                label: 'Students per Faculty Member',
                data: ratios,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.2)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Ratio'
                    }
                }
            }
        }
    });
}

function renderForecastCapacityChart() {
    const canvas = document.getElementById('forecastCapacityChart');

    // Destroy existing chart
    if (charts.forecast) {
        charts.forecast.destroy();
    }

    const census = enrollmentData.censusData;
    const forecast = enrollmentData.forecast;

    // Extend data with forecast
    const labels = [...census.quarters, 'Forecast'];
    const headcount = [...census.headcount, forecast.predicted];

    // Calculate required faculty (assuming 1 faculty per 3 students average)
    const requiredFaculty = headcount.map(count => Math.ceil(count / 3));
    const currentFacultyCount = Object.keys(currentYearData.all || {}).length;
    const currentFaculty = Array(labels.length).fill(currentFacultyCount);

    charts.forecast = createLineChart(canvas, {
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Current Faculty Count',
                    data: currentFaculty,
                    borderColor: '#51cf66',
                    backgroundColor: 'rgba(81, 207, 102, 0.2)',
                    tension: 0,
                    fill: false,
                    borderWidth: 3
                },
                {
                    label: 'Required Faculty (1:3 ratio)',
                    data: requiredFaculty,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.2)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Faculty Count'
                    }
                }
            }
        }
    });
}

function renderCapacityTable(data) {
    const tbody = document.getElementById('capacityTableBody');
    const sorted = data.sort((a, b) => b.utilizationRate - a.utilizationRate);

    tbody.innerHTML = sorted.map(faculty => {
        const progressClass = faculty.status === 'release' ? 'warning' :
                              faculty.status === 'overloaded' ? 'high' :
                              faculty.status === 'optimal' ? 'medium' : 'low';

        const statusDisplay = faculty.hasReleaseTime && faculty.releaseReason ?
            `${faculty.releaseReason}` : faculty.status;

        const statusColor = faculty.status === 'release' ? '#FFC107' :
                           faculty.status === 'overloaded' ? '#ff6b6b' :
                           faculty.status === 'optimal' ? '#ffa726' : '#51cf66';

        return `
            <tr>
                <td><strong>${faculty.name}</strong></td>
                <td>${faculty.maxCapacity}</td>
                <td>${faculty.currentLoad.toFixed(1)}</td>
                <td>${faculty.available.toFixed(1)}</td>
                <td>
                    <div class="progress-bar-container">
                        <div class="progress-bar ${progressClass}" style="width: ${Math.min(faculty.utilizationRate, 100)}%"></div>
                    </div>
                    <div style="margin-top: 5px;">${faculty.utilizationRate.toFixed(1)}%</div>
                </td>
                <td style="font-weight: 600; color: ${statusColor}">${statusDisplay}</td>
            </tr>
        `;
    }).join('');
}

function renderQuarterlyCapacityChart() {
    const canvas = document.getElementById('quarterlyCapacityChart');
    if (!currentYearData) return;

    // Destroy existing chart
    if (charts.quarterly) {
        charts.quarterly.destroy();
    }

    const faculty = currentYearData.all || {};
    const quarters = ['Fall', 'Winter', 'Spring'];

    // Calculate capacity and load for each quarter
    const quarterlyData = quarters.map(quarter => {
        let totalCapacity = 0;
        let totalLoad = 0;
        let overload = 0;
        let underutilized = 0;

        Object.entries(faculty).forEach(([name, data]) => {
            const quarterLoad = calculateQuarterWorkload(data, quarter);
            totalCapacity += data.maxWorkload;
            totalLoad += quarterLoad;

            const excess = Math.max(0, quarterLoad - data.maxWorkload);
            const available = Math.max(0, data.maxWorkload - quarterLoad);

            overload += excess;
            underutilized += available;
        });

        return {
            quarter,
            capacity: totalCapacity,
            load: totalLoad,
            available: totalCapacity - totalLoad,
            overload,
            underutilized
        };
    });

    charts.quarterly = createBarChart(canvas, {
        data: {
            labels: quarters,
            datasets: [
                {
                    label: 'Total Capacity',
                    data: quarterlyData.map(d => d.capacity),
                    backgroundColor: 'rgba(102, 126, 234, 0.3)',
                    borderColor: '#667eea',
                    borderWidth: 2
                },
                {
                    label: 'Current Load',
                    data: quarterlyData.map(d => d.load),
                    backgroundColor: quarterlyData.map(d =>
                        d.available < 0 ? 'rgba(255, 107, 107, 0.8)' :
                        d.overload > 0 ? 'rgba(255, 167, 38, 0.8)' :
                        'rgba(81, 207, 102, 0.8)'
                    ),
                    borderColor: quarterlyData.map(d =>
                        d.available < 0 ? '#ff6b6b' :
                        d.overload > 0 ? '#ffa726' :
                        '#51cf66'
                    ),
                    borderWidth: 2
                }
            ]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Workload Credits'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const quarterData = quarterlyData[context.dataIndex];
                            if (quarterData.available < 0) {
                                return `Over capacity by ${Math.abs(quarterData.available).toFixed(1)} credits`;
                            } else if (quarterData.overload > 0) {
                                return `${quarterData.overload.toFixed(1)} credits overloaded\n${quarterData.underutilized.toFixed(1)} credits underutilized`;
                            } else {
                                return `${quarterData.available.toFixed(1)} credits available`;
                            }
                        }
                    }
                }
            }
        }
    });
}

window.addEventListener('load', initDashboard);
