/**
 * EWU Design Schedule Analyzer - Year Filter Utilities
 * Shared year filtering logic for all dashboards
 */

/**
 * Get the default academic year (most recent complete year)
 * @returns {string} Default academic year (e.g., '2024-25')
 */
function getDefaultYear() {
    return '2024-25'; // Most recent complete academic year
}

/**
 * Get available academic years from workload data
 * @param {Object} workloadData - Workload data object
 * @returns {Array<string>} Array of academic years
 */
function getAvailableYears(workloadData) {
    if (workloadData && workloadData.workloadByYear && workloadData.workloadByYear.years) {
        return workloadData.workloadByYear.years;
    }
    return [];
}

/**
 * Get year-specific faculty workload data
 * Handles the new data structure with .all, .fullTime, .adjunct, .former
 * @param {Object} workloadData - Complete workload data object
 * @param {string} year - Academic year (e.g., '2024-25') or 'all'
 * @returns {Object} Faculty workload data for the specified year
 */
function getYearData(workloadData, year) {
    if (!workloadData) {
        return null;
    }

    // If 'all' or no year-specific data, return aggregated data
    if (year === 'all' || !workloadData.workloadByYear) {
        return {
            all: workloadData.facultyWorkload || {},
            fullTime: workloadData.fullTimeFaculty || {},
            adjunct: workloadData.adjunctFaculty || {},
            former: workloadData.formerFaculty || {}
        };
    }

    // Return year-specific data
    if (workloadData.workloadByYear.byYear && workloadData.workloadByYear.byYear[year]) {
        return workloadData.workloadByYear.byYear[year];
    }

    // Fallback to aggregated data if year not found
    console.warn(`⚠️ Year ${year} not found, using aggregated data`);
    return {
        all: workloadData.facultyWorkload || {},
        fullTime: workloadData.fullTimeFaculty || {},
        adjunct: workloadData.adjunctFaculty || {},
        former: workloadData.formerFaculty || {}
    };
}

/**
 * Setup year filter dropdown and event listener
 * @param {Object} workloadData - Workload data object
 * @param {Function} onChangeCallback - Callback function when year changes
 * @param {string} selectId - ID of the select element (default: 'academicYearFilter')
 */
function setupYearFilter(workloadData, onChangeCallback, selectId = 'academicYearFilter') {
    const selectElement = document.getElementById(selectId);

    if (!selectElement) {
        console.warn(`⚠️ Year filter select element '${selectId}' not found`);
        return;
    }

    // Populate dropdown with available years
    const years = getAvailableYears(workloadData);
    const defaultYear = getDefaultYear();

    // Clear existing options except "All Years"
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }

    // Add year options
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === defaultYear) {
            option.textContent += ' (Most Recent Complete)';
            option.selected = true;
        }
        selectElement.appendChild(option);
    });

    // Add event listener
    selectElement.addEventListener('change', function() {
        const selectedYear = this.value;
        console.log(`📅 Year filter changed to: ${selectedYear}`);

        if (onChangeCallback && typeof onChangeCallback === 'function') {
            onChangeCallback(selectedYear);
        }
    });

    // Trigger initial load with default year
    if (onChangeCallback && typeof onChangeCallback === 'function') {
        selectElement.dispatchEvent(new Event('change'));
    }
}

/**
 * Update subtitle to reflect selected year
 * @param {string} year - Selected academic year or 'all'
 * @param {string} baseTitle - Base title for the dashboard
 * @param {string} subtitleSelector - CSS selector for subtitle element
 */
function updateYearSubtitle(year, baseTitle = 'EWU Design Department', subtitleSelector = '.subtitle') {
    const subtitleElement = document.querySelector(subtitleSelector);

    if (!subtitleElement) {
        return;
    }

    if (year === 'all') {
        subtitleElement.textContent = `${baseTitle} - All Years (2022-2026)`;
    } else {
        subtitleElement.textContent = `${baseTitle} - Academic Year ${year}`;
    }
}

/**
 * Filter enrollment data by academic year
 * @param {Object} enrollmentData - Enrollment dashboard data
 * @param {string} year - Academic year to filter by
 * @returns {Object} Filtered enrollment data
 */
function filterEnrollmentByYear(enrollmentData, year) {
    if (!enrollmentData || year === 'all') {
        return enrollmentData;
    }

    // This would need to be implemented based on enrollment data structure
    // For now, return unfiltered data
    console.warn('⚠️ Enrollment year filtering not yet implemented');
    return enrollmentData;
}

/**
 * Get faculty statistics for a specific year
 * @param {Object} yearData - Year-specific faculty data
 * @returns {Object} Statistics object with counts and utilization info
 */
function getYearStatistics(yearData) {
    const stats = {
        total: 0,
        fullTime: 0,
        adjunct: 0,
        former: 0,
        overloaded: 0,
        optimal: 0,
        underutilized: 0
    };

    if (!yearData || !yearData.all) {
        return stats;
    }

    const faculty = yearData.all;

    stats.total = Object.keys(faculty).length;
    stats.fullTime = yearData.fullTime ? Object.keys(yearData.fullTime).length : 0;
    stats.adjunct = yearData.adjunct ? Object.keys(yearData.adjunct).length : 0;
    stats.former = yearData.former ? Object.keys(yearData.former).length : 0;

    // Count utilization status
    Object.values(faculty).forEach(f => {
        if (f.status === 'overloaded') stats.overloaded++;
        else if (f.status === 'optimal') stats.optimal++;
        else if (f.status === 'underutilized') stats.underutilized++;
    });

    return stats;
}
