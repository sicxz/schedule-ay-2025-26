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
 * Show error message
 * @param {string} message - Error message to display
 * @param {string} elementId - ID of element to show error in
 */
function showError(message, elementId = 'loadingMessage') {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div style="color: #dc3545; padding: 20px;">
                <h3>⚠️ Error Loading Data</h3>
                <p>${message}</p>
                <p style="margin-top: 15px; font-size: 0.9em;">
                    Make sure you've generated the data files by running:<br>
                    <code style="background: #f8f9fa; padding: 5px 10px; border-radius: 4px; display: inline-block; margin-top: 5px;">
                        node scripts/workload-calculator.js enrollment-data/processed
                    </code>
                </p>
            </div>
        `;
    }
}
