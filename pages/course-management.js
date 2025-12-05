/**
 * Course Management Page
 * Handles course catalog and section management
 */

// State
let courses = [];
let sections = [];
let faculty = [];
let rooms = [];
let academicYears = [];
let currentYearId = null;

// Filtered data for display
let filteredCourses = [];
let filteredSections = [];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    await initializePage();
});

async function initializePage() {
    try {
        // Load all reference data in parallel
        const [coursesData, facultyData, roomsData, yearsData] = await Promise.all([
            dbService.getCourses(),
            dbService.getFaculty(),
            dbService.getRooms(),
            dbService.getAcademicYears()
        ]);

        courses = coursesData || [];
        faculty = facultyData || [];
        rooms = roomsData || [];
        academicYears = yearsData || [];

        // Populate dropdowns
        populateYearDropdown();
        populateFacultyDropdown();
        populateRoomDropdown();
        populateCourseDropdown();

        // Render catalog
        filteredCourses = [...courses];
        renderCatalogTable();
        updateStats();

        // Load sections if we have a year
        if (academicYears.length > 0) {
            currentYearId = academicYears[0].id;
            await loadSections();
        }

    } catch (error) {
        console.error('Failed to initialize page:', error);
        showToast('Failed to load data. Please refresh.', 'error');
    }
}

async function refreshData() {
    showToast('Refreshing data...');
    await initializePage();
    showToast('Data refreshed', 'success');
}

// ============================================
// TAB SWITCHING
// ============================================

function switchTab(tab) {
    // Update tab buttons
    document.getElementById('tabCatalog').classList.toggle('active', tab === 'catalog');
    document.getElementById('tabSections').classList.toggle('active', tab === 'sections');

    // Update tab content
    document.getElementById('catalogContent').classList.toggle('active', tab === 'catalog');
    document.getElementById('sectionsContent').classList.toggle('active', tab === 'sections');
}

// ============================================
// COURSE CATALOG
// ============================================

function renderCatalogTable() {
    const tbody = document.getElementById('catalogTableBody');
    const emptyState = document.getElementById('catalogEmptyState');
    const tableContainer = document.querySelector('#catalogContent .ds-table-container');

    if (filteredCourses.length === 0) {
        tableContainer.classList.add('ds-hidden');
        emptyState.classList.remove('ds-hidden');
        return;
    }

    tableContainer.classList.remove('ds-hidden');
    emptyState.classList.add('ds-hidden');

    tbody.innerHTML = filteredCourses.map(course => {
        // Generate quarter badges
        const quarters = course.quarters_offered || ['Fall', 'Winter', 'Spring'];
        const quarterBadges = quarters.map(q => `<span class="pref-badge quarter">${q[0]}</span>`).join('');

        // Generate time/day badges
        const times = course.preferred_times || ['morning', 'afternoon', 'evening'];
        const days = course.preferred_days || ['MW', 'TR'];
        const timeBadges = times.map(t => `<span class="pref-badge time">${getTimeLabel(t)}</span>`).join('');
        const dayBadges = days.map(d => `<span class="pref-badge day">${d}</span>`).join('');

        // Location display
        let locationDisplay = 'Any';
        if (course.allowed_campus) {
            locationDisplay = course.allowed_campus === 'catalyst' ? 'Catalyst' : 'Cheney';
        }
        if (course.allowed_rooms && course.allowed_rooms.length > 0) {
            locationDisplay = course.allowed_rooms.join(', ');
        }

        // Constraint indicators
        const hardIndicator = (course.room_constraint_hard || course.time_constraint_hard)
            ? '<span class="constraint-icon" title="Has hard constraints">&#128274;</span>'
            : '';
        const caseByCase = course.is_case_by_case
            ? '<span class="pref-badge case-by-case">Case-by-case</span>'
            : '';

        return `
            <tr>
                <td>
                    <span class="course-code">${escapeHtml(course.code)}</span>
                    ${hardIndicator}
                </td>
                <td>${escapeHtml(course.title)} ${caseByCase}</td>
                <td><span class="credits-badge">${course.default_credits || 5}</span></td>
                <td>${course.typical_cap || 24}</td>
                <td><div class="pref-badges">${quarterBadges}</div></td>
                <td><div class="pref-badges">${timeBadges} ${dayBadges}</div></td>
                <td>${locationDisplay}</td>
                <td class="actions">
                    <button class="ds-btn ds-btn-secondary ds-btn-sm" onclick="editCourse('${course.id}')">Edit</button>
                    <button class="ds-btn ds-btn-secondary ds-btn-sm" onclick="confirmDeleteCourse('${course.id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function getTimeLabel(time) {
    const labels = { morning: 'AM', afternoon: 'PM', evening: 'EVE' };
    return labels[time] || time;
}

function filterCatalog() {
    const search = document.getElementById('catalogSearch').value.toLowerCase();
    const level = document.getElementById('levelFilter').value;

    filteredCourses = courses.filter(course => {
        const matchesSearch = !search ||
            course.code.toLowerCase().includes(search) ||
            course.title.toLowerCase().includes(search);
        const matchesLevel = !level || course.level === level;
        return matchesSearch && matchesLevel;
    });

    renderCatalogTable();
}

function getLevelLabel(level) {
    const labels = {
        intro: 'Intro',
        intermediate: 'Intermediate',
        advanced: 'Advanced',
        graduate: 'Graduate'
    };
    return labels[level] || 'Intro';
}

// ============================================
// COURSE SECTIONS
// ============================================

async function loadSections() {
    const yearSelect = document.getElementById('sectionYear');
    const quarterSelect = document.getElementById('sectionQuarter');

    const yearId = yearSelect.value;
    const quarter = quarterSelect.value || null;

    if (!yearId) {
        sections = [];
        filteredSections = [];
        renderSectionsTable();
        return;
    }

    try {
        sections = await dbService.getSchedule(yearId, quarter);
        filteredSections = [...sections];
        renderSectionsTable();
        updateStats();
    } catch (error) {
        console.error('Failed to load sections:', error);
        showToast('Failed to load sections', 'error');
    }
}

function renderSectionsTable() {
    const tbody = document.getElementById('sectionsTableBody');
    const emptyState = document.getElementById('sectionsEmptyState');
    const tableContainer = document.querySelector('#sectionsContent .ds-table-container');

    if (filteredSections.length === 0) {
        tableContainer.classList.add('ds-hidden');
        emptyState.classList.remove('ds-hidden');
        return;
    }

    tableContainer.classList.remove('ds-hidden');
    emptyState.classList.add('ds-hidden');

    tbody.innerHTML = filteredSections.map(section => {
        const courseCode = section.course?.code || 'Unknown';
        const courseTitle = section.course?.title || '';
        const facultyName = section.faculty?.name || 'TBD';
        const roomCode = section.room?.room_code || 'TBD';
        const initials = getInitials(facultyName);
        const enrollment = section.projected_enrollment || 0;
        const cap = getCourseCapacity(section.course_id);
        const enrollmentPercent = cap > 0 ? Math.min(100, (enrollment / cap) * 100) : 0;

        return `
            <tr>
                <td>
                    <span class="course-code">${escapeHtml(courseCode)}</span>
                    <span class="text-muted text-sm"> ${escapeHtml(courseTitle)}</span>
                </td>
                <td>${escapeHtml(section.section || '001')}</td>
                <td>
                    <div class="section-faculty">
                        <span class="faculty-avatar">${initials}</span>
                        <span>${escapeHtml(facultyName)}</span>
                    </div>
                </td>
                <td>${escapeHtml(roomCode)}</td>
                <td><span class="days-badge">${section.day_pattern || 'TBD'}</span></td>
                <td><span class="time-slot">${formatTimeSlot(section.time_slot)}</span></td>
                <td>
                    <div class="enrollment-bar">
                        <span>${enrollment}/${cap}</span>
                        <div class="ds-progress">
                            <div class="ds-progress-bar ${getEnrollmentClass(enrollmentPercent)}" style="width: ${enrollmentPercent}%"></div>
                        </div>
                    </div>
                </td>
                <td class="actions">
                    <button class="ds-btn ds-btn-secondary ds-btn-sm" onclick="editSection('${section.id}')">Edit</button>
                    <button class="ds-btn ds-btn-secondary ds-btn-sm" onclick="confirmDeleteSection('${section.id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterSections() {
    const search = document.getElementById('sectionSearch').value.toLowerCase();

    filteredSections = sections.filter(section => {
        const courseCode = section.course?.code?.toLowerCase() || '';
        const facultyName = section.faculty?.name?.toLowerCase() || '';
        return !search || courseCode.includes(search) || facultyName.includes(search);
    });

    renderSectionsTable();
}

// ============================================
// DROPDOWN POPULATION
// ============================================

function populateYearDropdown() {
    const select = document.getElementById('sectionYear');
    select.innerHTML = academicYears.map(year =>
        `<option value="${year.id}">${year.year}${year.is_active ? ' (Active)' : ''}</option>`
    ).join('');
}

function populateFacultyDropdown() {
    const selects = [document.getElementById('sectionFaculty')];

    selects.forEach(select => {
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">TBD</option>' +
            faculty.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
        if (currentValue) select.value = currentValue;
    });
}

function populateRoomDropdown() {
    const select = document.getElementById('sectionRoom');
    if (!select) return;

    // Group rooms by campus
    const roomsByCompus = {};
    rooms.forEach(room => {
        const campus = room.campus || 'Other';
        if (!roomsByCompus[campus]) roomsByCompus[campus] = [];
        roomsByCompus[campus].push(room);
    });

    let html = '<option value="">TBD</option>';
    for (const [campus, campusRooms] of Object.entries(roomsByCompus)) {
        html += `<optgroup label="${campus}">`;
        campusRooms.forEach(room => {
            html += `<option value="${room.id}">${escapeHtml(room.room_code)} - ${escapeHtml(room.name || room.room_code)}</option>`;
        });
        html += '</optgroup>';
    }

    select.innerHTML = html;
}

function populateCourseDropdown() {
    const select = document.getElementById('sectionCourse');
    if (!select) return;

    select.innerHTML = '<option value="">Select course...</option>' +
        courses.map(c => `<option value="${c.id}">${escapeHtml(c.code)} - ${escapeHtml(c.title)}</option>`).join('');
}

// ============================================
// COURSE MODAL HANDLERS
// ============================================

function openAddCourseModal() {
    document.getElementById('courseModalTitle').textContent = 'Add Course';
    document.getElementById('courseForm').reset();
    document.getElementById('courseId').value = '';

    // Set default checkboxes
    setCheckboxGroup('quarters', ['Fall', 'Winter', 'Spring']);
    setCheckboxGroup('times', ['morning', 'afternoon', 'evening']);
    setCheckboxGroup('days', ['MW', 'TR']);

    // Reset other fields
    document.getElementById('courseCampus').value = '';
    document.getElementById('courseRooms').selectedIndex = -1;
    document.getElementById('roomConstraintHard').checked = false;
    document.getElementById('timeConstraintHard').checked = false;
    document.getElementById('isCaseByCase').checked = false;

    document.getElementById('courseModal').classList.add('active');
}

function editCourse(id) {
    const course = courses.find(c => c.id === id);
    if (!course) return;

    document.getElementById('courseModalTitle').textContent = 'Edit Course';
    document.getElementById('courseId').value = id;
    document.getElementById('courseCode').value = course.code;
    document.getElementById('courseTitle').value = course.title;
    document.getElementById('courseCredits').value = course.default_credits || 5;
    document.getElementById('courseCap').value = course.typical_cap || 24;
    document.getElementById('courseLevel').value = course.level || 'intro';

    // Set scheduling preferences
    setCheckboxGroup('quarters', course.quarters_offered || ['Fall', 'Winter', 'Spring']);
    setCheckboxGroup('times', course.preferred_times || ['morning', 'afternoon', 'evening']);
    setCheckboxGroup('days', course.preferred_days || ['MW', 'TR']);

    // Set location preferences
    document.getElementById('courseCampus').value = course.allowed_campus || '';
    setMultiSelect('courseRooms', course.allowed_rooms || []);

    // Set constraint flags
    document.getElementById('roomConstraintHard').checked = course.room_constraint_hard || false;
    document.getElementById('timeConstraintHard').checked = course.time_constraint_hard || false;
    document.getElementById('isCaseByCase').checked = course.is_case_by_case || false;

    document.getElementById('courseModal').classList.add('active');
}

// Helper to set checkbox group values
function setCheckboxGroup(name, values) {
    const checkboxes = document.querySelectorAll(`input[name="${name}"]`);
    checkboxes.forEach(cb => {
        cb.checked = values.includes(cb.value);
    });
}

// Helper to get checkbox group values
function getCheckboxGroup(name) {
    const checkboxes = document.querySelectorAll(`input[name="${name}"]:checked`);
    return Array.from(checkboxes).map(cb => cb.value);
}

// Helper to set multi-select values
function setMultiSelect(id, values) {
    const select = document.getElementById(id);
    if (!select) return;
    Array.from(select.options).forEach(opt => {
        opt.selected = values.includes(opt.value);
    });
}

// Helper to get multi-select values
function getMultiSelect(id) {
    const select = document.getElementById(id);
    if (!select) return [];
    return Array.from(select.selectedOptions).map(opt => opt.value);
}

function closeCourseModal() {
    document.getElementById('courseModal').classList.remove('active');
}

async function handleCourseSubmit(event) {
    event.preventDefault();

    const id = document.getElementById('courseId').value;

    // Collect all course data including scheduling preferences
    const courseData = {
        // Basic info
        code: document.getElementById('courseCode').value.trim(),
        title: document.getElementById('courseTitle').value.trim(),
        defaultCredits: parseInt(document.getElementById('courseCredits').value) || 5,
        typicalCap: parseInt(document.getElementById('courseCap').value) || 24,
        level: document.getElementById('courseLevel').value,

        // Scheduling preferences
        quartersOffered: getCheckboxGroup('quarters'),
        preferredTimes: getCheckboxGroup('times'),
        preferredDays: getCheckboxGroup('days'),

        // Location preferences
        allowedCampus: document.getElementById('courseCampus').value || null,
        allowedRooms: getMultiSelect('courseRooms'),

        // Constraint flags
        roomConstraintHard: document.getElementById('roomConstraintHard').checked,
        timeConstraintHard: document.getElementById('timeConstraintHard').checked,
        isCaseByCase: document.getElementById('isCaseByCase').checked
    };

    // Convert empty arrays to null for rooms
    if (courseData.allowedRooms.length === 0) {
        courseData.allowedRooms = null;
    }

    try {
        if (id) {
            await dbService.updateCourse(id, courseData);
            showToast('Course updated successfully', 'success');
        } else {
            await dbService.addCourse(courseData);
            showToast('Course added successfully', 'success');
        }

        closeCourseModal();

        // Reload courses
        courses = await dbService.getCourses();
        filteredCourses = [...courses];
        renderCatalogTable();
        populateCourseDropdown();
        updateStats();

    } catch (error) {
        console.error('Failed to save course:', error);
        showToast('Failed to save course: ' + error.message, 'error');
    }
}

function confirmDeleteCourse(id) {
    const course = courses.find(c => c.id === id);
    if (!course) return;

    document.getElementById('deleteMessage').textContent =
        `Are you sure you want to delete "${course.code} - ${course.title}"? This action cannot be undone.`;

    document.getElementById('confirmDeleteBtn').onclick = () => handleDeleteCourse(id);
    document.getElementById('deleteModal').classList.add('active');
}

async function handleDeleteCourse(id) {
    try {
        await dbService.deleteCourse(id);
        closeDeleteModal();
        showToast('Course deleted', 'success');

        // Reload courses
        courses = await dbService.getCourses();
        filteredCourses = [...courses];
        renderCatalogTable();
        populateCourseDropdown();
        updateStats();

    } catch (error) {
        console.error('Failed to delete course:', error);
        showToast('Failed to delete course: ' + error.message, 'error');
    }
}

// ============================================
// SECTION MODAL HANDLERS
// ============================================

function openAddSectionModal() {
    document.getElementById('sectionModalTitle').textContent = 'Add Section';
    document.getElementById('sectionForm').reset();
    document.getElementById('sectionId').value = '';
    document.getElementById('sectionModal').classList.add('active');
}

function editSection(id) {
    const section = sections.find(s => s.id === id);
    if (!section) return;

    document.getElementById('sectionModalTitle').textContent = 'Edit Section';
    document.getElementById('sectionId').value = id;
    document.getElementById('sectionCourse').value = section.course_id || '';
    document.getElementById('sectionNumber').value = section.section || '001';
    document.getElementById('sectionQuarterSelect').value = section.quarter || 'Fall';
    document.getElementById('sectionFaculty').value = section.faculty_id || '';
    document.getElementById('sectionDays').value = section.day_pattern || 'MW';
    document.getElementById('sectionTime').value = section.time_slot || '10:00-12:20';
    document.getElementById('sectionRoom').value = section.room_id || '';
    document.getElementById('sectionEnrollment').value = section.projected_enrollment || '';

    document.getElementById('sectionModal').classList.add('active');
}

function closeSectionModal() {
    document.getElementById('sectionModal').classList.remove('active');
}

async function handleSectionSubmit(event) {
    event.preventDefault();

    const id = document.getElementById('sectionId').value;
    const yearSelect = document.getElementById('sectionYear');

    const sectionData = {
        academicYearId: yearSelect.value,
        courseId: document.getElementById('sectionCourse').value,
        section: document.getElementById('sectionNumber').value.trim() || '001',
        quarter: document.getElementById('sectionQuarterSelect').value,
        facultyId: document.getElementById('sectionFaculty').value || null,
        dayPattern: document.getElementById('sectionDays').value,
        timeSlot: document.getElementById('sectionTime').value,
        roomId: document.getElementById('sectionRoom').value || null,
        projectedEnrollment: parseInt(document.getElementById('sectionEnrollment').value) || null
    };

    if (id) {
        sectionData.id = id;
    }

    try {
        await dbService.saveScheduledCourse(sectionData);
        showToast(id ? 'Section updated' : 'Section added', 'success');

        closeSectionModal();
        await loadSections();

    } catch (error) {
        console.error('Failed to save section:', error);
        showToast('Failed to save section: ' + error.message, 'error');
    }
}

function confirmDeleteSection(id) {
    const section = sections.find(s => s.id === id);
    if (!section) return;

    const courseCode = section.course?.code || 'Unknown';
    document.getElementById('deleteMessage').textContent =
        `Are you sure you want to delete section ${section.section} of ${courseCode}? This action cannot be undone.`;

    document.getElementById('confirmDeleteBtn').onclick = () => handleDeleteSection(id);
    document.getElementById('deleteModal').classList.add('active');
}

async function handleDeleteSection(id) {
    try {
        await dbService.deleteScheduledCourse(id);
        closeDeleteModal();
        showToast('Section deleted', 'success');
        await loadSections();

    } catch (error) {
        console.error('Failed to delete section:', error);
        showToast('Failed to delete section: ' + error.message, 'error');
    }
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
}

// ============================================
// STATS
// ============================================

function updateStats() {
    document.getElementById('statTotalCourses').textContent = courses.length;
    document.getElementById('statActiveSections').textContent = sections.length;

    const assignedSections = sections.filter(s => s.faculty_id).length;
    document.getElementById('statFacultyAssigned').textContent = assignedSections;
    document.getElementById('statUnassigned').textContent = sections.length - assignedSections;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getInitials(name) {
    if (!name || name === 'TBD') return '?';
    return name.split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

function formatTimeSlot(timeSlot) {
    if (!timeSlot) return 'TBD';
    const [start, end] = timeSlot.split('-');
    return `${formatTime(start)} - ${formatTime(end)}`;
}

function formatTime(time) {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${hour12}:${minutes} ${ampm}`;
}

function getCourseCapacity(courseId) {
    const course = courses.find(c => c.id === courseId);
    return course?.typical_cap || 24;
}

function getEnrollmentClass(percent) {
    if (percent >= 90) return 'error';
    if (percent >= 70) return 'warning';
    return 'success';
}

function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'ds-toast active';
    if (type) toast.classList.add(type);

    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}
