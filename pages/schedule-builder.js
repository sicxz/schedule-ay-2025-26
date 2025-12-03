/**
 * Schedule Builder Page Controller
 * Handles UI interactions and rendering for the schedule builder
 */

// Global state
let currentSchedule = null;
let currentPreviewTab = 'byLevel';

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing Schedule Builder...');

    // Initialize modules
    try {
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

        if (typeof PrerequisiteGraph !== 'undefined') {
            await PrerequisiteGraph.init({
                graphPath: '../data/prerequisite-graph.json',
                enrollmentPath: '../enrollment-dashboard-data.json'
            });
        }

        console.log('Schedule Builder modules initialized');

        // Load any saved draft
        loadDraft();

    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Error initializing: ' + error.message, 'error');
    }
});

/**
 * Handle generate button click
 */
async function handleGenerate() {
    const year = document.getElementById('academicYear').value;
    const quarter = document.getElementById('targetQuarter').value;

    // Show loading state
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('loadingContainer').style.display = 'block';
    document.getElementById('builderContent').style.display = 'none';
    document.getElementById('actionBar').style.display = 'none';

    try {
        // Generate schedule
        const schedule = await ScheduleGenerator.generateSchedule(quarter, year);
        currentSchedule = schedule;

        // Hide loading, show content
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('builderContent').style.display = 'grid';
        document.getElementById('actionBar').style.display = 'flex';

        // Render all components
        renderSummaryCards(schedule.summary);
        renderRecommendations(schedule.recommendations);
        renderPreview(schedule.recommendations);

        showToast(`Generated ${schedule.summary.totalSections} sections for ${quarter} ${year}`);

    } catch (error) {
        console.error('Generation error:', error);
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        showToast('Error generating schedule: ' + error.message, 'error');
    }
}

/**
 * Render summary cards
 */
function renderSummaryCards(summary) {
    document.getElementById('totalSections').textContent = summary.totalSections;
    document.getElementById('facultyCapacity').textContent = `${summary.assignedSections}/${summary.totalSections}`;
    document.getElementById('highDemand').textContent = summary.highDemandCourses;
    document.getElementById('warnings').textContent = summary.warningCount;

    // Update warning card styling
    const warningCard = document.querySelector('.summary-card.warning');
    if (warningCard) {
        warningCard.style.opacity = summary.warningCount > 0 ? '1' : '0.6';
    }
}

/**
 * Render recommendations list
 */
function renderRecommendations(recommendations) {
    const container = document.getElementById('recommendationsList');

    if (recommendations.length === 0) {
        container.innerHTML = '<p class="empty-message">No courses to display for this quarter.</p>';
        return;
    }

    let html = '';

    recommendations.forEach(rec => {
        const facultyNames = rec.assignedFaculty.map(f => f.name).join(', ');
        const confidencePercent = Math.round(rec.confidence * 100);

        html += `
            <div class="recommendation-card priority-${rec.priority}" data-course="${rec.courseCode}">
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
                        <div class="metric-label">Predicted Demand</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${rec.enrollmentCap}</div>
                        <div class="metric-label">Cap per Section</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${rec.utilization}%</div>
                        <div class="metric-label">Utilization</div>
                    </div>
                </div>

                <div class="rec-faculty">
                    <strong>Faculty:</strong> ${facultyNames}
                </div>

                <div class="rec-actions">
                    <span class="trend-indicator" title="Enrollment trend: ${rec.trend}">
                        ${getTrendIcon(rec.trend)}
                    </span>
                    <div class="section-adjuster">
                        <button class="btn-adjust" onclick="adjustSections('${rec.courseCode}', -1)">−</button>
                        <span class="section-count">${rec.sectionsNeeded}</span>
                        <button class="btn-adjust" onclick="adjustSections('${rec.courseCode}', 1)">+</button>
                        <span style="font-size: 0.85em; color: #6b7280; margin-left: 4px;">sections</span>
                    </div>
                </div>

                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${confidencePercent}%"></div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Get trend icon
 */
function getTrendIcon(trend) {
    switch (trend) {
        case 'growing': return '<span style="color: #10b981;">↗️</span>';
        case 'declining': return '<span style="color: #ef4444;">↘️</span>';
        default: return '<span style="color: #6b7280;">→</span>';
    }
}

/**
 * Render preview panel
 */
function renderPreview(recommendations) {
    const container = document.getElementById('previewContent');
    const countEl = document.getElementById('previewCount');

    const totalSections = recommendations.reduce((sum, r) => sum + r.sectionsNeeded, 0);
    countEl.textContent = `${totalSections} sections`;

    switch (currentPreviewTab) {
        case 'byLevel':
            renderPreviewByLevel(container, recommendations);
            break;
        case 'byFaculty':
            renderPreviewByFaculty(container, recommendations);
            break;
        case 'unassigned':
            renderPreviewUnassigned(container, recommendations);
            break;
    }
}

/**
 * Render preview grouped by level
 */
function renderPreviewByLevel(container, recommendations) {
    const levels = { '100': [], '200': [], '300': [], '400': [] };

    recommendations.forEach(rec => {
        const level = rec.level || '300';
        if (!levels[level]) levels[level] = [];
        levels[level].push(rec);
    });

    let html = '';

    Object.entries(levels).forEach(([level, courses]) => {
        if (courses.length === 0) return;

        const sectionCount = courses.reduce((sum, c) => sum + c.sectionsNeeded, 0);

        html += `
            <div class="preview-group">
                <div class="preview-group-header">${level}-Level Courses (${sectionCount} sections)</div>
        `;

        courses.forEach(rec => {
            rec.assignedFaculty.forEach(faculty => {
                html += `
                    <div class="preview-item">
                        <span class="preview-item-code">${rec.courseCode}</span>
                        <span class="preview-item-title">${rec.courseTitle}</span>
                        <span class="preview-item-faculty">${faculty.name}</span>
                        <span class="preview-item-sections">${rec.credits} cr</span>
                    </div>
                `;
            });
        });

        html += '</div>';
    });

    container.innerHTML = html || '<p class="empty-message">No courses to display.</p>';
}

/**
 * Render preview grouped by faculty
 */
function renderPreviewByFaculty(container, recommendations) {
    const facultyGroups = {};

    recommendations.forEach(rec => {
        rec.assignedFaculty.forEach(faculty => {
            const name = faculty.name;
            if (!facultyGroups[name]) {
                facultyGroups[name] = { sections: [], credits: 0 };
            }
            facultyGroups[name].sections.push({
                code: rec.courseCode,
                title: rec.courseTitle,
                credits: rec.credits
            });
            facultyGroups[name].credits += rec.credits;
        });
    });

    // Sort by name, but put TBD at the end
    const sortedFaculty = Object.keys(facultyGroups).sort((a, b) => {
        if (a === 'TBD') return 1;
        if (b === 'TBD') return -1;
        return a.localeCompare(b);
    });

    let html = '';

    sortedFaculty.forEach(name => {
        const group = facultyGroups[name];

        html += `
            <div class="preview-group">
                <div class="preview-group-header">${name} (${group.credits} credits)</div>
        `;

        group.sections.forEach(section => {
            html += `
                <div class="preview-item">
                    <span class="preview-item-code">${section.code}</span>
                    <span class="preview-item-title">${section.title}</span>
                    <span class="preview-item-sections">${section.credits} cr</span>
                </div>
            `;
        });

        html += '</div>';
    });

    container.innerHTML = html || '<p class="empty-message">No faculty assignments yet.</p>';
}

/**
 * Render unassigned sections
 */
function renderPreviewUnassigned(container, recommendations) {
    const unassigned = [];

    recommendations.forEach(rec => {
        rec.assignedFaculty.forEach(faculty => {
            if (faculty.name === 'TBD') {
                unassigned.push({
                    code: rec.courseCode,
                    title: rec.courseTitle,
                    credits: rec.credits,
                    section: faculty.section
                });
            }
        });
    });

    if (unassigned.length === 0) {
        container.innerHTML = '<p class="empty-message" style="text-align: center; padding: 40px; color: #10b981;">All sections have faculty assigned!</p>';
        return;
    }

    let html = `
        <div class="preview-group">
            <div class="preview-group-header">Unassigned Sections (${unassigned.length})</div>
    `;

    unassigned.forEach(section => {
        html += `
            <div class="preview-item" style="border-left: 3px solid #ef4444;">
                <span class="preview-item-code">${section.code}-${section.section}</span>
                <span class="preview-item-title">${section.title}</span>
                <span class="preview-item-sections">${section.credits} cr</span>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

/**
 * Switch preview tab
 */
function showPreviewTab(tab) {
    currentPreviewTab = tab;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Re-render preview
    if (currentSchedule) {
        renderPreview(currentSchedule.recommendations);
    }
}

/**
 * Adjust sections for a course
 */
function adjustSections(courseCode, delta) {
    if (!currentSchedule) return;

    ScheduleGenerator.adjustSections(currentSchedule.recommendations, courseCode, delta);

    // Recalculate summary
    const summary = recalculateSummary(currentSchedule.recommendations);
    currentSchedule.summary = summary;

    // Re-render
    renderSummaryCards(summary);
    renderRecommendations(currentSchedule.recommendations);
    renderPreview(currentSchedule.recommendations);
}

/**
 * Recalculate summary after adjustment
 */
function recalculateSummary(recommendations) {
    const totalSections = recommendations.reduce((sum, r) => sum + r.sectionsNeeded, 0);
    const totalCredits = recommendations.reduce((sum, r) => sum + (r.credits * r.sectionsNeeded), 0);
    const highDemand = recommendations.filter(r => r.priority === 'high').length;

    let assignedCount = 0;
    let unassignedCount = 0;
    recommendations.forEach(r => {
        r.assignedFaculty.forEach(f => {
            if (f.name === 'TBD') unassignedCount++;
            else assignedCount++;
        });
    });

    return {
        totalSections,
        totalCredits,
        highDemandCourses: highDemand,
        assignedSections: assignedCount,
        unassignedSections: unassignedCount,
        warningCount: unassignedCount
    };
}

/**
 * Sort recommendations
 */
function sortRecommendations() {
    if (!currentSchedule) return;

    const sortBy = document.getElementById('sortBy').value;

    currentSchedule.recommendations.sort((a, b) => {
        switch (sortBy) {
            case 'priority':
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            case 'demand':
                return b.predictedDemand - a.predictedDemand;
            case 'code':
                return a.courseCode.localeCompare(b.courseCode);
            default:
                return 0;
        }
    });

    renderRecommendations(currentSchedule.recommendations);
}

/**
 * Save draft to localStorage
 */
function saveDraft() {
    if (!currentSchedule) {
        showToast('No schedule to save', 'error');
        return;
    }

    localStorage.setItem('scheduleBuilderDraft', JSON.stringify(currentSchedule));
    showToast('Draft saved successfully');
}

/**
 * Load draft from localStorage
 */
function loadDraft() {
    const draft = localStorage.getItem('scheduleBuilderDraft');
    if (!draft) return;

    try {
        currentSchedule = JSON.parse(draft);

        // Update dropdowns
        document.getElementById('academicYear').value = currentSchedule.year;
        document.getElementById('targetQuarter').value = currentSchedule.quarter;

        // Show content
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('builderContent').style.display = 'grid';
        document.getElementById('actionBar').style.display = 'flex';

        // Render
        renderSummaryCards(currentSchedule.summary);
        renderRecommendations(currentSchedule.recommendations);
        renderPreview(currentSchedule.recommendations);

        showToast('Draft loaded');
    } catch (error) {
        console.error('Error loading draft:', error);
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

    const exported = ScheduleGenerator.exportForEditor(currentSchedule);
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
 * Export to schedule editor
 */
function exportToEditor() {
    if (!currentSchedule) {
        showToast('No schedule to export', 'error');
        return;
    }

    // Save to localStorage for schedule editor to pick up
    const exported = ScheduleGenerator.exportForEditor(currentSchedule);
    localStorage.setItem('importedSchedule', JSON.stringify(exported));

    showToast('Exporting to Schedule Editor...');

    // Navigate to schedule editor
    setTimeout(() => {
        window.location.href = 'schedule-editor.html?import=true';
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
