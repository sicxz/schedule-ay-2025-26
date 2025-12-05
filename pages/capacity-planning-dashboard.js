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
        showErrorMessage('loadingMessage', 'Unable to load enrollment data.');
        return;
    }

    // Check if capacity planning data exists
    if (!enrollmentData.capacityPlanning) {
        showErrorMessage('loadingMessage', 'Capacity planning data not available. Please run process-enrollment-data.js');
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

    // Clear existing options safely
    while (filter.firstChild) {
        filter.removeChild(filter.firstChild);
    }

    // Add options safely
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === defaultYear) {
            option.selected = true;
        }
        filter.appendChild(option);
    });

    filter.addEventListener('change', (e) => onChange(e.target.value));
}

/**
 * Show error message using safe DOM methods
 * @param {string} elementId - Element ID to show error in
 * @param {string} message - Error message
 */
function showErrorMessage(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Clear existing content
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }

    const p = document.createElement('p');
    p.style.color = '#ff6b6b';
    p.textContent = '\u26A0\uFE0F ' + message;
    element.appendChild(p);
}

/**
 * Render capacity alert using safe DOM methods
 * @param {HTMLElement} container - Alert container
 * @param {Object} data - Alert data
 */
function renderCapacityAlert(container, data) {
    const {
        netAvailable,
        totalDemand,
        currentLoad,
        adjunctLoad,
        totalCapacity,
        adjunctCount,
        utilizationPercent,
        workloadNote
    } = data;

    // Clear existing content
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    const alertBox = document.createElement('div');
    alertBox.className = 'alert-box';

    let bgColor, title, content;

    if (netAvailable < 0) {
        // Over capacity
        const projectedAdjunctNeed = Math.abs(netAvailable);
        bgColor = 'linear-gradient(135deg, #ff6b6b 0%, #fa5252 100%)';
        title = '\u26A0\uFE0F Over-Capacity Alert';
        content = [
            { text: workloadNote, italic: true },
            { text: `Total demand: ${totalDemand.toFixed(1)} credits (Full-time: ${currentLoad.toFixed(1)} + Adjuncts: ${adjunctLoad.toFixed(1)})`, bold: ['Total demand:', `${totalDemand.toFixed(1)} credits`] },
            { text: `Full-time baseline capacity: ${totalCapacity} credits`, bold: [`${totalCapacity} credits`] },
            { text: `Program is ${projectedAdjunctNeed.toFixed(1)} credits OVER baseline capacity.`, bold: true },
            { text: `Adjunct capacity = 0 for planning purposes. ${adjunctCount} adjunct(s) teaching indicates over-capacity demand.`, italic: true },
            { text: `Projected Adjunct Need: ${projectedAdjunctNeed.toFixed(1)} credits (approx. ${Math.ceil(projectedAdjunctNeed / 15)} adjunct instructor(s) @ 15 credits each)`, bold: true },
            { text: `Utilization: ${utilizationPercent}` }
        ];
    } else if (adjunctLoad > 0) {
        // Using adjuncts but still within capacity
        bgColor = 'linear-gradient(135deg, #ffa726 0%, #fb8c00 100%)';
        title = '\u26A0\uFE0F Adjunct Usage Alert';
        content = [
            { text: workloadNote, italic: true },
            { text: `Program is using ${adjunctCount} adjunct instructor(s) teaching ${adjunctLoad.toFixed(1)} credits.`, bold: [`${adjunctCount} adjunct instructor(s)`] },
            { text: 'Adjunct capacity = 0 for planning purposes.', bold: true },
            { text: `Net available capacity: ${netAvailable.toFixed(1)} credits | Utilization: ${utilizationPercent}` }
        ];
    } else {
        // Within baseline
        bgColor = 'linear-gradient(135deg, #51cf66 0%, #37b24d 100%)';
        title = '\u2705 Capacity Status - Within Baseline';
        content = [
            { text: workloadNote, italic: true },
            { text: `Total demand: ${totalDemand.toFixed(1)} credits | Full-time baseline capacity: ${totalCapacity} credits` },
            { text: `Available capacity: ${netAvailable.toFixed(1)} credits`, bold: [`${netAvailable.toFixed(1)} credits`] },
            { text: `Utilization: ${utilizationPercent}` }
        ];
    }

    alertBox.style.background = bgColor;

    // Add title
    const h3 = document.createElement('h3');
    h3.textContent = title;
    alertBox.appendChild(h3);

    // Add content paragraphs
    content.forEach(item => {
        const p = document.createElement('p');
        p.style.marginTop = '10px';

        if (item.italic) {
            const em = document.createElement('em');
            em.textContent = item.text;
            p.appendChild(em);
        } else if (item.bold === true) {
            const strong = document.createElement('strong');
            strong.textContent = item.text;
            p.appendChild(strong);
        } else {
            p.textContent = item.text;
        }

        alertBox.appendChild(p);
    });

    container.appendChild(alertBox);
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

    // Build alert using safe DOM methods
    renderCapacityAlert(alertsContainer, {
        netAvailable,
        totalDemand,
        currentLoad,
        adjunctLoad,
        totalCapacity,
        adjunctCount,
        utilizationPercent,
        workloadNote
    });

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

    // Get capacity planning data for all years
    const capacityPlanning = enrollmentData.capacityPlanning;
    if (!capacityPlanning) {
        console.warn('No capacity planning data available');
        return;
    }

    const years = Object.keys(capacityPlanning).sort();
    const ratios = [];
    const facultyCounts = [];
    const enrollments = [];

    years.forEach(year => {
        const yearData = capacityPlanning[year];
        const facultyCount = yearData.fullTimeFaculty ? yearData.fullTimeFaculty.length : 0;
        // Estimate enrollment from capacity data or use a reasonable estimate
        const estimatedEnrollment = yearData.totalFullTimeCapacity * 3; // Rough estimate

        facultyCounts.push(facultyCount);
        enrollments.push(estimatedEnrollment);

        if (facultyCount > 0) {
            ratios.push((estimatedEnrollment / facultyCount).toFixed(1));
        } else {
            ratios.push(0);
        }
    });

    charts.ratio = createLineChart(canvas, {
        data: {
            labels: years,
            datasets: [{
                label: 'Estimated Students per Faculty',
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
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const idx = context.dataIndex;
                            return `Faculty: ${facultyCounts[idx]}`;
                        }
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

    // Get capacity planning data for all years
    const capacityPlanning = enrollmentData.capacityPlanning;
    if (!capacityPlanning) {
        console.warn('No capacity planning data for forecast');
        return;
    }

    const years = Object.keys(capacityPlanning).sort();

    // Build capacity vs demand data by year
    const capacityData = [];
    const demandData = [];
    const facultyCounts = [];

    years.forEach(year => {
        const yearData = capacityPlanning[year];
        const capacity = yearData.totalFullTimeCapacity || 0;
        const adjunctLoad = yearData.adjunctLoad || 0;
        const demand = capacity + adjunctLoad; // Total teaching demand

        capacityData.push(capacity);
        demandData.push(demand);
        facultyCounts.push(yearData.fullTimeFaculty ? yearData.fullTimeFaculty.length : 0);
    });

    // Add forecast for next year if we have data
    const lastYear = years[years.length - 1];
    const lastYearData = capacityPlanning[lastYear];
    if (lastYearData) {
        // Simple projection: assume 5% growth in demand
        const projectedDemand = demandData[demandData.length - 1] * 1.05;
        const projectedCapacity = capacityData[capacityData.length - 1]; // Assume same capacity

        years.push('Next Year (Proj.)');
        capacityData.push(projectedCapacity);
        demandData.push(projectedDemand);
        facultyCounts.push(facultyCounts[facultyCounts.length - 1]);
    }

    charts.forecast = createLineChart(canvas, {
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Full-Time Faculty Capacity',
                    data: capacityData,
                    borderColor: '#51cf66',
                    backgroundColor: 'rgba(81, 207, 102, 0.2)',
                    tension: 0.4,
                    fill: false,
                    borderWidth: 3
                },
                {
                    label: 'Total Teaching Demand (incl. Adjuncts)',
                    data: demandData,
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
                        text: 'Credits'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const idx = context.dataIndex;
                            if (idx < facultyCounts.length) {
                                const gap = demandData[idx] - capacityData[idx];
                                if (gap > 0) {
                                    return `Gap: ${gap.toFixed(1)} credits (needs adjuncts)`;
                                } else {
                                    return `Surplus: ${Math.abs(gap).toFixed(1)} credits available`;
                                }
                            }
                            return '';
                        }
                    }
                }
            }
        }
    });
}

function renderCapacityTable(data) {
    const tbody = document.getElementById('capacityTableBody');
    if (!tbody) return;

    const sorted = data.sort((a, b) => b.utilizationRate - a.utilizationRate);

    // Clear existing rows safely
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }

    // Build rows using safe DOM methods
    sorted.forEach(faculty => {
        const progressClass = faculty.status === 'release' ? 'warning' :
                              faculty.status === 'overloaded' ? 'high' :
                              faculty.status === 'optimal' ? 'medium' : 'low';

        const statusDisplay = faculty.hasReleaseTime && faculty.releaseReason ?
            faculty.releaseReason : faculty.status;

        const statusColor = faculty.status === 'release' ? '#FFC107' :
                           faculty.status === 'overloaded' ? '#ff6b6b' :
                           faculty.status === 'optimal' ? '#ffa726' : '#51cf66';

        const tr = document.createElement('tr');

        // Name cell
        const tdName = document.createElement('td');
        const strong = document.createElement('strong');
        strong.textContent = faculty.name;
        tdName.appendChild(strong);
        tr.appendChild(tdName);

        // Max Capacity cell
        const tdMax = document.createElement('td');
        tdMax.textContent = faculty.maxCapacity;
        tr.appendChild(tdMax);

        // Current Load cell
        const tdLoad = document.createElement('td');
        tdLoad.textContent = faculty.currentLoad.toFixed(1);
        tr.appendChild(tdLoad);

        // Available cell
        const tdAvailable = document.createElement('td');
        tdAvailable.textContent = faculty.available.toFixed(1);
        tr.appendChild(tdAvailable);

        // Utilization cell with progress bar
        const tdUtil = document.createElement('td');
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-bar-container';

        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar ' + progressClass;
        progressBar.style.width = Math.min(faculty.utilizationRate, 100) + '%';
        progressContainer.appendChild(progressBar);
        tdUtil.appendChild(progressContainer);

        const utilText = document.createElement('div');
        utilText.style.marginTop = '5px';
        utilText.textContent = faculty.utilizationRate.toFixed(1) + '%';
        tdUtil.appendChild(utilText);
        tr.appendChild(tdUtil);

        // Status cell
        const tdStatus = document.createElement('td');
        tdStatus.style.fontWeight = '600';
        tdStatus.style.color = statusColor;
        tdStatus.textContent = statusDisplay;
        tr.appendChild(tdStatus);

        tbody.appendChild(tr);
    });
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
