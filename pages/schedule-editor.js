/**
 * Schedule Editor Page
 * Drag-and-drop interface for course scheduling
 */

// State
let currentYear = '2025-26';
let currentQuarter = 'Fall';
let workloadData = null;
let facultyList = [];

// DOM Elements
const quarterTabs = document.getElementById('quarterTabs');
const coursePool = document.getElementById('unassignedCourses');
const facultyPanel = document.getElementById('facultyPanel');
const unassignedCount = document.getElementById('unassignedCount');
const courseSearch = document.getElementById('courseSearch');
const academicYearFilter = document.getElementById('academicYearFilter');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Schedule Editor initializing...');

    // Load data
    await loadData();

    // Set up event listeners
    setupEventListeners();

    // Initial render
    render();

    console.log('Schedule Editor initialized');
});

/**
 * Load all required data
 */
async function loadData() {
    try {
        // Initialize ScheduleManager with catalog
        await ScheduleManager.init({ catalogPath: '../data/course-catalog.json' });

        // Also load catalog explicitly to ensure it's available
        await ScheduleManager.loadCourseCatalog('../data/course-catalog.json');

        // Load workload data
        workloadData = await loadWorkloadData('../data/workload-data.json');

        // Import data into ScheduleManager if not already done
        if (ScheduleManager.getAvailableYears().length === 0 && workloadData) {
            ScheduleManager.importFromWorkloadData(workloadData);
        }

        // Auto-create 2026-27 from 2025-26 if it doesn't exist
        if (!ScheduleManager.yearExists('2026-27') && ScheduleManager.yearExists('2025-26')) {
            const result = ScheduleManager.createYearFromTemplate('2026-27', '2025-26');
            if (result.success) {
                console.log('✅ Auto-created 2026-27 schedule from 2025-26');
                currentYear = '2026-27';
            }
        }

        // Build faculty list
        buildFacultyList();

        // Populate dropdowns
        populateYearDropdown();
        populateCourseDropdown();
        populateFacultyDropdown();

    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Error loading data');
    }
}

/**
 * Populate the academic year dropdown dynamically
 */
function populateYearDropdown() {
    const select = document.getElementById('academicYearFilter');
    const years = ScheduleManager.getAvailableYears();

    select.innerHTML = '';

    // Sort years in descending order (newest first)
    years.sort().reverse().forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    // If current year not in list, add it
    if (!years.includes(currentYear) && years.length > 0) {
        currentYear = years[0];
        select.value = currentYear;
    }
}

/**
 * Load workload data from JSON
 */
async function loadWorkloadData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load workload data');
        return await response.json();
    } catch (error) {
        console.error('Error loading workload data:', error);
        return null;
    }
}

/**
 * Build list of all faculty members
 */
function buildFacultyList() {
    if (!workloadData) return;

    const yearData = workloadData.academicYears.find(y => y.year === currentYear);
    if (!yearData) return;

    facultyList = yearData.faculty.map(f => ({
        name: f.name,
        rank: f.rank,
        targetLoad: getTargetLoad(f.rank)
    })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get target load based on rank
 */
function getTargetLoad(rank) {
    const limits = {
        'Full Professor': 36,
        'Associate Professor': 36,
        'Assistant Professor': 36,
        'Senior Lecturer': 45,
        'Lecturer': 45,
        'Adjunct': 15
    };
    return limits[rank] || 36;
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Quarter tabs
    quarterTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('quarter-tab')) {
            document.querySelectorAll('.quarter-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentQuarter = e.target.dataset.quarter;
            render();
        }
    });

    // Academic year filter
    academicYearFilter.addEventListener('change', async (e) => {
        currentYear = e.target.value;
        buildFacultyList();
        render();
    });

    // Course search
    courseSearch.addEventListener('input', (e) => {
        renderUnassignedCourses(e.target.value);
    });

    // Add course button
    document.getElementById('addCourseBtn').addEventListener('click', openAddCourseModal);

    // New Year button
    document.getElementById('newYearBtn').addEventListener('click', openCreateYearModal);

    // Save button
    document.getElementById('saveBtn').addEventListener('click', saveChanges);

    // Export button
    document.getElementById('exportBtn').addEventListener('click', exportSchedule);

    // Undo/Redo
    document.getElementById('undoBtn').addEventListener('click', handleUndo);
    document.getElementById('redoBtn').addEventListener('click', handleRedo);

    // Subscribe to ScheduleManager changes
    ScheduleManager.subscribe((action, data) => {
        console.log('Schedule changed:', action, data);
        render();
        updateUndoRedoButtons();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault();
                handleUndo();
            } else if (e.key === 'y') {
                e.preventDefault();
                handleRedo();
            } else if (e.key === 's') {
                e.preventDefault();
                saveChanges();
            }
        }
    });
}

/**
 * Main render function
 */
function render() {
    renderUnassignedCourses();
    renderFacultyCards();
}

/**
 * Render unassigned courses in the left panel
 */
function renderUnassignedCourses(searchFilter = '') {
    const courses = ScheduleManager.getUnassignedCourses(currentYear, currentQuarter);

    // Filter by search
    const filtered = searchFilter
        ? courses.filter(c =>
            c.courseCode.toLowerCase().includes(searchFilter.toLowerCase()) ||
            (c.title && c.title.toLowerCase().includes(searchFilter.toLowerCase()))
          )
        : courses;

    // Update count
    unassignedCount.textContent = filtered.length;

    // Render cards
    coursePool.innerHTML = filtered.length === 0
        ? `<div class="empty-state">
             <div class="empty-state-icon">📚</div>
             <div class="empty-state-text">No unassigned courses</div>
           </div>`
        : filtered.map(course => renderCourseCard(course)).join('');

    // Make cards draggable
    coursePool.querySelectorAll('.course-card').forEach(card => {
        makeDraggable(card);
    });
}

/**
 * Render a single course card
 */
function renderCourseCard(course) {
    const catalogInfo = ScheduleManager.getCourseInfo(course.courseCode);
    const isAppliedLearning = catalogInfo && catalogInfo.workloadMultiplier;

    return `
        <div class="course-card ${isAppliedLearning ? 'applied-learning' : ''}"
             draggable="true"
             data-course-id="${course.id}"
             data-course-code="${course.courseCode}">
            <div class="course-card-header">
                <span class="course-code">${course.courseCode}</span>
                <span class="course-credits">${course.credits} cr</span>
            </div>
            <div class="course-title">${catalogInfo?.title || ''}</div>
            <div class="course-section">Section ${course.section}</div>
        </div>
    `;
}

/**
 * Render faculty cards in the right panel
 */
function renderFacultyCards() {
    facultyPanel.innerHTML = facultyList.map(faculty => {
        const schedule = ScheduleManager.getFacultySchedule(faculty.name, currentYear);
        const quarterCourses = schedule.filter(c => c.quarter === currentQuarter);
        const workload = ScheduleManager.calculateFacultyWorkload(faculty.name, currentYear);

        const annualCredits = workload.totalCredits;
        const targetLoad = faculty.targetLoad;
        const percentage = Math.round((annualCredits / targetLoad) * 100);

        let statusClass = '';
        let barClass = 'under';
        if (percentage > 100) {
            statusClass = 'overloaded';
            barClass = 'over';
        } else if (percentage >= 80) {
            barClass = 'warning';
        }
        if (percentage >= 95 && percentage <= 105) {
            statusClass = 'optimal';
        }

        return `
            <div class="faculty-card ${statusClass}"
                 data-faculty-name="${faculty.name}">
                <div class="faculty-card-header">
                    <div>
                        <div class="faculty-name">${faculty.name}</div>
                        <div class="faculty-rank">${faculty.rank}</div>
                    </div>
                    ${percentage > 100
                        ? '<span class="status-badge overloaded">Overloaded</span>'
                        : percentage >= 95 && percentage <= 105
                            ? '<span class="status-badge optimal">Optimal</span>'
                            : percentage < 50
                                ? '<span class="status-badge underutilized">Underutilized</span>'
                                : ''}
                </div>

                <div class="workload-bar-container">
                    <div class="workload-bar">
                        <div class="workload-bar-fill ${barClass}"
                             style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <span class="workload-text">${annualCredits}/${targetLoad} cr</span>
                </div>

                <div class="assigned-courses">
                    ${quarterCourses.length === 0
                        ? `<div class="drop-zone-hint">Drop courses here</div>`
                        : quarterCourses.map(c => `
                            <div class="assigned-course" data-course-id="${c.id}">
                                <div class="assigned-course-info">
                                    <span class="assigned-course-code">${c.courseCode}</span>
                                    <span class="assigned-course-credits">${c.credits} cr</span>
                                </div>
                                <div class="assigned-course-actions">
                                    <button class="btn-icon btn-edit"
                                            onclick="openEditCourseModal('${c.id}')"
                                            title="Edit">✏️</button>
                                    <button class="btn-icon btn-unassign"
                                            onclick="unassignCourse('${c.id}')"
                                            title="Unassign">↩</button>
                                </div>
                            </div>
                          `).join('')}
                </div>

                <button class="add-course-btn" onclick="openAssignModalForFaculty('${faculty.name}')">
                    + Add Course
                </button>
            </div>
        `;
    }).join('');

    // Make faculty cards drop zones
    facultyPanel.querySelectorAll('.faculty-card').forEach(card => {
        makeDropZone(card);
    });
}

/**
 * Make an element draggable
 */
function makeDraggable(element) {
    element.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({
            id: element.dataset.courseId,
            courseCode: element.dataset.courseCode
        }));
        element.classList.add('dragging');

        // Add visual feedback to drop zones
        document.querySelectorAll('.faculty-card').forEach(card => {
            card.style.transition = 'all 0.2s ease';
        });
    });

    element.addEventListener('dragend', () => {
        element.classList.remove('dragging');
        document.querySelectorAll('.faculty-card').forEach(card => {
            card.classList.remove('drag-over');
        });
    });
}

/**
 * Make an element a drop zone
 */
function makeDropZone(element) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        element.classList.add('drag-over');
    });

    element.addEventListener('dragleave', (e) => {
        // Only remove if we're leaving the element entirely
        if (!element.contains(e.relatedTarget)) {
            element.classList.remove('drag-over');
        }
    });

    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('drag-over');

        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const facultyName = element.dataset.facultyName;

        // Assign course to faculty
        const result = ScheduleManager.assignToFaculty(
            currentYear,
            currentQuarter,
            data.id,
            facultyName
        );

        if (result.success) {
            showToast(`Assigned ${data.courseCode} to ${facultyName}`);
        } else {
            showToast(result.errors.join(', '), 'error');
        }
    });
}

/**
 * Unassign a course from faculty
 */
function unassignCourse(courseId) {
    const result = ScheduleManager.unassignFromFaculty(currentYear, currentQuarter, courseId);

    if (result.success) {
        showToast('Course unassigned');
    } else {
        showToast(result.errors.join(', '), 'error');
    }
}

/**
 * Find past course data for a course code (from previous quarters/years)
 */
function findPastCourseData(courseCode) {
    const years = ScheduleManager.getAvailableYears().sort().reverse();
    const quarters = ['Spring', 'Winter', 'Fall', 'Summer'];

    // Look through years (newest first) and quarters to find a past instance
    for (const year of years) {
        for (const quarter of quarters) {
            const schedule = ScheduleManager.getQuarterSchedule(year, quarter);
            const pastCourse = schedule.find(c => c.courseCode === courseCode);
            if (pastCourse) {
                return pastCourse;
            }
        }
    }
    return null;
}

/**
 * Populate course dropdown in modal
 */
function populateCourseDropdown() {
    const select = document.getElementById('courseCodeSelect');
    const catalog = ScheduleManager.getCourseCatalog();

    select.innerHTML = '<option value="">Select Course...</option>';

    catalog.forEach(course => {
        const option = document.createElement('option');
        option.value = course.code;
        option.textContent = `${course.code} - ${course.title}`;
        option.dataset.credits = course.defaultCredits;
        option.dataset.cap = course.typicalEnrollmentCap;
        select.appendChild(option);
    });

    // Auto-fill all fields when course is selected
    select.addEventListener('change', () => {
        const courseCode = select.value;
        if (!courseCode) return;

        const selectedOption = select.options[select.selectedIndex];
        const catalogInfo = ScheduleManager.getCourseInfo(courseCode);

        // First try to find past course data
        const pastData = findPastCourseData(courseCode);

        if (pastData) {
            // Fill from past data
            document.getElementById('creditsInput').value = pastData.credits || selectedOption.dataset.credits;
            document.getElementById('enrollmentCapInput').value = pastData.enrollmentCap || selectedOption.dataset.cap || '';
            document.getElementById('roomInput').value = pastData.room || '';
            setDayCheckboxes(pastData.days || []);
            document.getElementById('startTimeInput').value = pastData.startTime || '';
            document.getElementById('endTimeInput').value = pastData.endTime || '';
        } else {
            // Fall back to catalog defaults
            document.getElementById('creditsInput').value = selectedOption.dataset.credits || '';
            document.getElementById('enrollmentCapInput').value = selectedOption.dataset.cap || '';
            document.getElementById('roomInput').value = '';
            setDayCheckboxes([]);
            document.getElementById('startTimeInput').value = '';
            document.getElementById('endTimeInput').value = '';
        }
    });
}

/**
 * Populate faculty dropdown in modal
 */
function populateFacultyDropdown() {
    const selects = [
        document.getElementById('facultyAssignSelect'),
        document.getElementById('assignFacultySelect')
    ];

    selects.forEach(select => {
        if (!select) return;

        const firstOption = select.querySelector('option');
        select.innerHTML = '';
        if (firstOption) select.appendChild(firstOption);

        facultyList.forEach(faculty => {
            const option = document.createElement('option');
            option.value = faculty.name;
            option.textContent = `${faculty.name} (${faculty.rank})`;
            select.appendChild(option);
        });
    });
}

/**
 * Open add course modal
 */
function openAddCourseModal() {
    document.getElementById('courseModalTitle').textContent = 'Add Course';
    document.getElementById('courseSubmitBtn').textContent = 'Add Course';
    document.getElementById('courseForm').reset();
    document.getElementById('editCourseId').value = '';
    setDayCheckboxes([]);
    document.getElementById('courseModalOverlay').classList.add('active');
}

/**
 * Open edit course modal
 */
function openEditCourseModal(courseId) {
    const schedule = ScheduleManager.getQuarterSchedule(currentYear, currentQuarter);
    const course = schedule.find(c => c.id === courseId);

    if (!course) return;

    document.getElementById('courseModalTitle').textContent = 'Edit Course';
    document.getElementById('courseSubmitBtn').textContent = 'Save Changes';
    document.getElementById('editCourseId').value = courseId;
    document.getElementById('courseCodeSelect').value = course.courseCode;
    document.getElementById('sectionInput').value = course.section;
    document.getElementById('creditsInput').value = course.credits;
    document.getElementById('enrollmentCapInput').value = course.enrollmentCap || '';
    document.getElementById('facultyAssignSelect').value = course.assignedFaculty || '';
    document.getElementById('roomInput').value = course.room || '';
    setDayCheckboxes(course.days || []);
    document.getElementById('startTimeInput').value = course.startTime || '';
    document.getElementById('endTimeInput').value = course.endTime || '';
    document.getElementById('notesInput').value = course.notes || '';

    document.getElementById('courseModalOverlay').classList.add('active');
}

/**
 * Close course modal
 */
function closeCourseModal() {
    document.getElementById('courseModalOverlay').classList.remove('active');
}

/**
 * Get selected days from checkboxes
 */
function getSelectedDays() {
    const days = [];
    ['M', 'T', 'W', 'Th', 'F'].forEach(day => {
        const checkbox = document.getElementById(`day${day}`);
        if (checkbox && checkbox.checked) {
            days.push(day);
        }
    });
    return days;
}

/**
 * Set day checkboxes from array
 */
function setDayCheckboxes(days) {
    ['M', 'T', 'W', 'Th', 'F'].forEach(day => {
        const checkbox = document.getElementById(`day${day}`);
        if (checkbox) {
            checkbox.checked = days && days.includes(day);
        }
    });
}

/**
 * Handle course form submit
 */
function handleCourseFormSubmit(e) {
    e.preventDefault();

    const courseId = document.getElementById('editCourseId').value;
    const courseCode = document.getElementById('courseCodeSelect').value;
    const section = document.getElementById('sectionInput').value;
    const credits = parseInt(document.getElementById('creditsInput').value);
    const enrollmentCap = parseInt(document.getElementById('enrollmentCapInput').value) || null;
    const assignedFaculty = document.getElementById('facultyAssignSelect').value || null;
    const room = document.getElementById('roomInput').value || null;
    const days = getSelectedDays();
    const startTime = document.getElementById('startTimeInput').value || null;
    const endTime = document.getElementById('endTimeInput').value || null;
    const notes = document.getElementById('notesInput').value || null;

    const courseData = {
        courseCode,
        section,
        credits,
        enrollmentCap,
        assignedFaculty,
        room,
        days,
        startTime,
        endTime,
        notes
    };

    let result;
    if (courseId) {
        // Update existing
        result = ScheduleManager.updateCourseAssignment(currentYear, currentQuarter, courseId, courseData);
    } else {
        // Add new
        result = ScheduleManager.addCourseAssignment(currentYear, currentQuarter, courseData);
    }

    if (result.success) {
        closeCourseModal();
        showToast(courseId ? 'Course updated' : 'Course added');
    } else {
        showToast(result.errors.join(', '), 'error');
    }
}

/**
 * Open assign modal for a specific faculty
 */
function openAssignModalForFaculty(facultyName) {
    document.getElementById('assignFacultySelect').value = facultyName;

    // Show available courses
    const courses = ScheduleManager.getUnassignedCourses(currentYear, currentQuarter);
    const infoDiv = document.getElementById('assignCourseInfo');

    infoDiv.innerHTML = `
        <div class="form-group">
            <label class="form-label">Select Course to Assign</label>
            <select id="quickAssignCourse" class="form-select" required>
                <option value="">Select Course...</option>
                ${courses.map(c => `
                    <option value="${c.id}">${c.courseCode} - Section ${c.section} (${c.credits} cr)</option>
                `).join('')}
            </select>
        </div>
    `;

    document.getElementById('assignModalOverlay').classList.add('active');
}

/**
 * Close assign modal
 */
function closeAssignModal() {
    document.getElementById('assignModalOverlay').classList.remove('active');
}

/**
 * Handle assign form submit
 */
function handleAssignFormSubmit(e) {
    e.preventDefault();

    const courseId = document.getElementById('quickAssignCourse')?.value ||
                     document.getElementById('assignCourseId').value;
    const facultyName = document.getElementById('assignFacultySelect').value;

    if (!courseId || !facultyName) {
        showToast('Please select a course and faculty', 'error');
        return;
    }

    const result = ScheduleManager.assignToFaculty(currentYear, currentQuarter, courseId, facultyName);

    if (result.success) {
        closeAssignModal();
        showToast(`Course assigned to ${facultyName}`);
    } else {
        showToast(result.errors.join(', '), 'error');
    }
}

/**
 * Save changes
 */
function saveChanges() {
    try {
        const data = ScheduleManager.exportData();
        localStorage.setItem('ewu_schedule_data', JSON.stringify(data));
        showToast('Changes saved');
    } catch (error) {
        console.error('Error saving:', error);
        showToast('Error saving changes', 'error');
    }
}

/**
 * Export schedule as JSON
 */
function exportSchedule() {
    const data = ScheduleManager.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule-${currentYear}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Schedule exported');
}

/**
 * Handle undo
 */
function handleUndo() {
    // Integration with BackupManager would go here
    showToast('Undo not yet implemented');
}

/**
 * Handle redo
 */
function handleRedo() {
    // Integration with BackupManager would go here
    showToast('Redo not yet implemented');
}

/**
 * Update undo/redo button states
 */
function updateUndoRedoButtons() {
    // Integration with BackupManager would go here
}

/**
 * Hide undo bar
 */
function hideUndoBar() {
    document.getElementById('undoBar').style.display = 'none';
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    toast.style.background = type === 'error' ? '#dc3545' : '#1f2937';
    toast.classList.add('visible');

    setTimeout(() => {
        toast.classList.remove('visible');
    }, 3000);
}

// ============================================
// CREATE NEW YEAR FUNCTIONS
// ============================================

/**
 * Open the create year modal
 */
function openCreateYearModal() {
    const modal = document.getElementById('createYearModal');
    const templateSelect = document.getElementById('templateYearSelect');
    const newYearInput = document.getElementById('newYearInput');

    // Populate template dropdown with available years
    const years = ScheduleManager.getAvailableYears();
    templateSelect.innerHTML = '';
    years.sort().reverse().forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        templateSelect.appendChild(option);
    });

    // Suggest next year based on latest year
    if (years.length > 0) {
        const latestYear = years.sort().reverse()[0];
        const startYear = parseInt(latestYear.split('-')[0]);
        const nextYear = startYear + 1;
        const nextYearEnd = (nextYear + 1).toString().slice(-2);
        newYearInput.value = `${nextYear}-${nextYearEnd}`;
    } else {
        newYearInput.value = '2026-27';
    }

    // Default to template option
    document.getElementById('sourceTemplate').checked = true;

    modal.classList.add('active');
}

/**
 * Close the create year modal
 */
function closeCreateYearModal() {
    const modal = document.getElementById('createYearModal');
    modal.classList.remove('active');
    document.getElementById('createYearForm').reset();
}

/**
 * Handle create year form submit
 */
function handleCreateYearSubmit(e) {
    e.preventDefault();

    const newYear = document.getElementById('newYearInput').value.trim();
    const useTemplate = document.getElementById('sourceTemplate').checked;
    const templateYear = document.getElementById('templateYearSelect').value;

    // Validate year format
    const validation = ScheduleManager.validateYearFormat(newYear);
    if (!validation.valid) {
        showToast(validation.errors.join(', '), 'error');
        return;
    }

    let result;
    if (useTemplate && templateYear) {
        result = ScheduleManager.createYearFromTemplate(newYear, templateYear);
    } else {
        result = ScheduleManager.createBlankYear(newYear);
    }

    if (result.success) {
        // Update year dropdown
        populateYearDropdown();

        // Switch to new year
        currentYear = newYear;
        document.getElementById('academicYearFilter').value = newYear;

        // Rebuild faculty list for new year
        buildFacultyList();

        // Re-render
        render();

        closeCreateYearModal();

        if (result.copiedFrom) {
            showToast(`Created ${newYear} from ${result.copiedFrom}`);
        } else {
            showToast(`Created blank schedule for ${newYear}`);
        }
    } else {
        showToast(result.errors.join(', '), 'error');
    }
}
