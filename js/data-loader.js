/**
 * EWU Design Schedule Analyzer - Data Loader
 * Utility functions for loading JSON data files
 */

/**
 * Load workload data from workload-data.json
 * @param {string} basePath - Base path to data file (default: '../')
 * @returns {Promise<Object|null>} Workload data or null if load fails
 */
async function loadWorkloadData(basePath = '../') {
    try {
        // Add cache-busting timestamp
        const cacheBuster = new Date().getTime();
        const url = `${basePath}workload-data.json?v=${cacheBuster}`;
        console.log(`📡 Fetching workload data from: ${url}`);

        const response = await fetch(url);
        console.log(`📡 Response status: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Loaded workload data');
            console.log(`   Generated: ${data.generatedAt}`);
            console.log(`   Full-Time Faculty: ${data.summary?.fullTimeFaculty || 'N/A'}`);
            console.log(`   Adjunct Faculty: ${data.summary?.adjunctFaculty || 'N/A'}`);
            return data;
        } else {
            console.error(`❌ Failed to load workload data: ${response.status} ${response.statusText}`);
            console.error(`   URL attempted: ${url}`);
        }
    } catch (error) {
        console.error('❌ Error loading workload data:', error);
        console.error('   Error details:', error.message);
    }
    return null;
}

/**
 * Load enrollment data from enrollment-dashboard-data.json
 * @param {string} basePath - Base path to data file (default: '../')
 * @returns {Promise<Object|null>} Enrollment data or null if load fails
 */
async function loadEnrollmentData(basePath = '../') {
    try {
        // Add cache-busting timestamp
        const cacheBuster = new Date().getTime();
        const url = `${basePath}enrollment-dashboard-data.json?v=${cacheBuster}`;
        console.log(`📡 Fetching enrollment data from: ${url}`);

        const response = await fetch(url);
        console.log(`📡 Response status: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Loaded enrollment data');
            console.log(`   Generated: ${data.generatedAt}`);
            console.log(`   Total Records: ${data.totalRecords}`);
            return data;
        } else {
            console.error(`❌ Failed to load enrollment data: ${response.status} ${response.statusText}`);
            console.error(`   URL attempted: ${url}`);
        }
    } catch (error) {
        console.error('❌ Error loading enrollment data:', error);
        console.error('   Error details:', error.message);
    }
    return null;
}

/**
 * Load release time adjustments data
 * @param {string} basePath - Base path to data file (default: '../')
 * @returns {Promise<Object|null>} Adjustments data or null if load fails
 */
async function loadAdjustmentsData(basePath = '../') {
    try {
        // Try to load from data directory
        const cacheBuster = new Date().getTime();
        const url = `${basePath}data/release-time-adjustments.json?v=${cacheBuster}`;
        console.log(`📡 Fetching adjustments data from: ${url}`);

        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Loaded release time adjustments');
            console.log(`   Last Modified: ${data.lastModified}`);
            console.log(`   Academic Years: ${Object.keys(data.academicYears || {}).join(', ')}`);
            return data;
        } else {
            console.log(`ℹ️ No adjustments file found (this is optional)`);
        }
    } catch (error) {
        console.log(`ℹ️ Adjustments file not available (this is optional):`, error.message);
    }
    return null;
}

/**
 * Merge workload data with release time adjustments
 * @param {Object} workloadData - Base workload data
 * @param {Object} adjustmentsData - Release time adjustments
 * @param {string} year - Academic year to merge
 * @returns {Object} Merged workload data
 */
function mergeWorkloadWithAdjustments(workloadData, adjustmentsData, year) {
    if (!workloadData || !adjustmentsData) {
        return workloadData;
    }

    console.log(`🔀 Merging adjustments for year: ${year}`);

    const yearAdjustments = adjustmentsData.academicYears?.[year];
    if (!yearAdjustments) {
        console.log(`   No adjustments for ${year}`);
        return workloadData;
    }

    const merged = JSON.parse(JSON.stringify(workloadData)); // Deep clone

    // Get year-specific workload data
    let yearWorkloadData = {};
    if (merged.workloadByYear?.byYear?.[year]) {
        yearWorkloadData = merged.workloadByYear.byYear[year].fullTime || {};
    }

    // Process each faculty member
    Object.entries(yearWorkloadData).forEach(([facultyName, facultyData]) => {
        // Add release time
        const releaseTime = yearAdjustments.releaseTime?.[facultyName];
        if (releaseTime) {
            facultyData.manualReleaseTime = releaseTime.totalCredits || 0;

            // Create breakdown by category
            const breakdown = {};
            releaseTime.categories.forEach(cat => {
                if (!breakdown[cat.type]) {
                    breakdown[cat.type] = 0;
                }
                breakdown[cat.type] += cat.credits || 0;
            });
            facultyData.releaseTimeBreakdown = breakdown;
            facultyData.hasReleaseTimeAdjustment = true;
        } else {
            facultyData.manualReleaseTime = 0;
            facultyData.releaseTimeBreakdown = {};
            facultyData.hasReleaseTimeAdjustment = false;
        }

        // Add applied learning overrides
        const appliedLearningOverride = yearAdjustments.appliedLearningOverrides?.[facultyName];
        if (appliedLearningOverride) {
            let totalOverride = 0;

            // Calculate total across all quarters and courses
            Object.values(appliedLearningOverride).forEach(courseData => {
                if (courseData.projected) {
                    Object.values(courseData.projected).forEach(quarterData => {
                        totalOverride += quarterData.workloadCredits || 0;
                    });
                }
            });

            facultyData.adjustedAppliedLearning = totalOverride;
            facultyData.hasAppliedLearningOverride = true;
        } else {
            facultyData.adjustedAppliedLearning = facultyData.appliedLearningWorkload || 0;
            facultyData.hasAppliedLearningOverride = false;
        }

        // Recalculate total workload with adjustments
        const scheduledCredits = facultyData.scheduledCredits || 0;
        const releaseTimeCredits = facultyData.manualReleaseTime || 0;
        const appliedLearningCredits = facultyData.adjustedAppliedLearning || 0;

        facultyData.totalWorkloadCreditsWithAdjustments =
            scheduledCredits + releaseTimeCredits + appliedLearningCredits;

        // Recalculate utilization rate
        if (facultyData.maxWorkload > 0) {
            facultyData.utilizationRateWithAdjustments =
                (facultyData.totalWorkloadCreditsWithAdjustments / facultyData.maxWorkload) * 100;
        }

        facultyData.hasAnyAdjustments =
            facultyData.hasReleaseTimeAdjustment || facultyData.hasAppliedLearningOverride;
    });

    // Also update the main facultyWorkload object if it exists
    if (merged.facultyWorkload) {
        Object.keys(merged.facultyWorkload).forEach(facultyName => {
            const yearSpecific = yearWorkloadData[facultyName];
            if (yearSpecific && yearSpecific.hasAnyAdjustments) {
                merged.facultyWorkload[facultyName] = {
                    ...merged.facultyWorkload[facultyName],
                    ...yearSpecific
                };
            }
        });
    }

    console.log(`✅ Merged adjustments applied`);
    return merged;
}

/**
 * Load both workload and enrollment data
 * @param {string} basePath - Base path to data files (default: '../')
 * @returns {Promise<Object>} Object with workloadData and enrollmentData properties
 */
async function loadAllData(basePath = '../') {
    const [workloadData, enrollmentData] = await Promise.all([
        loadWorkloadData(basePath),
        loadEnrollmentData(basePath)
    ]);

    return {
        workloadData,
        enrollmentData,
        isComplete: workloadData !== null && enrollmentData !== null
    };
}

/**
 * Load all data including adjustments
 * @param {string} basePath - Base path to data files (default: '../')
 * @param {string} year - Academic year for merging adjustments (optional)
 * @returns {Promise<Object>} Object with all data including merged adjustments
 */
async function loadAllDataWithAdjustments(basePath = '../', year = null) {
    const [workloadData, enrollmentData, adjustmentsData] = await Promise.all([
        loadWorkloadData(basePath),
        loadEnrollmentData(basePath),
        loadAdjustmentsData(basePath)
    ]);

    let mergedWorkloadData = workloadData;

    // Merge adjustments if year is specified and adjustments exist
    if (year && adjustmentsData && workloadData) {
        mergedWorkloadData = mergeWorkloadWithAdjustments(workloadData, adjustmentsData, year);
    }

    return {
        workloadData: mergedWorkloadData,
        enrollmentData,
        adjustmentsData,
        isComplete: workloadData !== null && enrollmentData !== null,
        hasAdjustments: adjustmentsData !== null
    };
}

/**
 * Show loading message
 * @param {string} elementId - ID of element to show loading message in
 * @param {string} message - Loading message to display
 */
function showLoading(elementId = 'loadingMessage', message = 'Loading data...') {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'block';
        element.textContent = message;
    }
}

/**
 * Hide loading message and show content
 * @param {string} loadingId - ID of loading element to hide
 * @param {string} contentId - ID of content element to show
 */
function hideLoadingShowContent(loadingId = 'loadingMessage', contentId = 'dashboardContent') {
    const loadingEl = document.getElementById(loadingId);
    const contentEl = document.getElementById(contentId);

    if (loadingEl) {
        loadingEl.style.display = 'none';
    }

    if (contentEl) {
        contentEl.style.display = 'block';
    }
}

/**
 * Show error message using safe DOM methods
 * @param {string} message - Error message to display
 * @param {string} elementId - ID of element to show error in
 * @param {Function} onRetry - Optional retry callback
 */
function showError(message, elementId = 'loadingMessage', onRetry = null) {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Use ErrorHandler if available
    if (typeof ErrorHandler !== 'undefined') {
        ErrorHandler.showDataLoadError(element, onRetry);
        return;
    }

    // Fallback: Use DOMUtils if available
    if (typeof DOMUtils !== 'undefined') {
        DOMUtils.clearElement(element);
        const errorEl = DOMUtils.createErrorElement('Error Loading Data', message, {
            suggestion: {
                text: 'Make sure you\'ve generated the data files by running:',
                code: 'node scripts/workload-calculator.js enrollment-data/processed'
            },
            onRetry
        });
        element.appendChild(errorEl);
        return;
    }

    // Ultimate fallback: Safe DOM manipulation without innerHTML
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }

    const container = document.createElement('div');
    container.style.cssText = 'color: #dc3545; padding: 20px;';
    container.setAttribute('role', 'alert');

    const title = document.createElement('h3');
    title.textContent = '\u26A0\uFE0F Error Loading Data';
    container.appendChild(title);

    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    container.appendChild(messageEl);

    const suggestionEl = document.createElement('p');
    suggestionEl.style.cssText = 'margin-top: 15px; font-size: 0.9em;';
    suggestionEl.textContent = 'Make sure you\'ve generated the data files by running:';
    container.appendChild(suggestionEl);

    const codeEl = document.createElement('code');
    codeEl.style.cssText = 'background: #f8f9fa; padding: 5px 10px; border-radius: 4px; display: inline-block; margin-top: 5px;';
    codeEl.textContent = 'node scripts/workload-calculator.js enrollment-data/processed';
    suggestionEl.appendChild(document.createElement('br'));
    suggestionEl.appendChild(codeEl);

    if (onRetry && typeof onRetry === 'function') {
        const retryBtn = document.createElement('button');
        retryBtn.textContent = 'Retry';
        retryBtn.style.cssText = 'margin-top: 15px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;';
        retryBtn.addEventListener('click', onRetry);
        container.appendChild(retryBtn);
    }

    element.appendChild(container);
}
