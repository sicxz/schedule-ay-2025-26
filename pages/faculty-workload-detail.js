/**
 * Faculty Workload Detail Page
 * Maintains per-faculty applied-learning entries for DESN 399/491/495/499.
 */

let workloadData = null;

const state = {
    year: '',
    faculty: '',
    entries: [],
    editingId: null
};

function getCurrentAcademicYear() {
    const now = new Date();
    const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        year: String(params.get('year') || '').trim(),
        faculty: String(params.get('faculty') || '').trim()
    };
}

function formatNumber(value, decimals = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0';
    return String(Number(numeric.toFixed(decimals)));
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getCourseLabel(courseCode) {
    const labels = {
        'DESN 399': 'DESN 399 - Independent Study',
        'DESN 491': 'DESN 491 - Senior Project',
        'DESN 495': 'DESN 495 - Internship',
        'DESN 499': 'DESN 499 - Independent Study'
    };
    return labels[courseCode] || courseCode;
}

function populateCourseSelect() {
    const select = document.getElementById('courseInput');
    select.innerHTML = '';

    const courses = WorkloadIntegration.getAppliedLearningCourses()
        .sort((a, b) => a.code.localeCompare(b.code));

    courses.forEach((course) => {
        const option = document.createElement('option');
        option.value = course.code;
        option.textContent = getCourseLabel(course.code);
        option.dataset.rate = String(course.rate);
        select.appendChild(option);
    });
}

function renderRatesList() {
    const container = document.getElementById('ratesList');
    const courses = WorkloadIntegration.getAppliedLearningCourses()
        .sort((a, b) => a.code.localeCompare(b.code));

    container.innerHTML = courses.map((course) => `
        <div class="rate-item">
            <strong>${escapeHtml(getCourseLabel(course.code))}</strong>
            <span>Rate: ${formatNumber(course.rate, 2)}</span>
        </div>
    `).join('');
}

function updateCalculatedWorkload() {
    const courseCode = document.getElementById('courseInput').value;
    const studentCredits = Number(document.getElementById('studentCreditsInput').value) || 0;
    const rate = WorkloadIntegration.getAppliedLearningRate(courseCode);
    const workloadCredits = studentCredits * rate;

    document.getElementById('rateDisplay').textContent = formatNumber(rate, 2);
    document.getElementById('workloadCreditsInput').value = formatNumber(workloadCredits, 2);
}

function resetForm() {
    state.editingId = null;
    document.getElementById('formTitle').textContent = 'Add Detail Entry';
    document.getElementById('saveEntryBtn').textContent = 'Add Entry';
    document.getElementById('cancelEditBtn').style.display = 'none';

    document.getElementById('quarterInput').value = 'Fall';
    document.getElementById('courseInput').selectedIndex = 0;
    document.getElementById('studentCreditsInput').value = '5';
    document.getElementById('notesInput').value = '';
    updateCalculatedWorkload();
}

function populateYearSelect(requestedYear) {
    const select = document.getElementById('yearSelect');
    const options = WorkloadIntegration.getAcademicYearOptions(workloadData);
    const years = options.length ? options : [getCurrentAcademicYear()];

    select.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join('');

    if (requestedYear && years.includes(requestedYear)) {
        state.year = requestedYear;
    } else if (years.includes(getCurrentAcademicYear())) {
        state.year = getCurrentAcademicYear();
    } else {
        state.year = years[years.length - 1];
    }

    select.value = state.year;
}

function getFacultyOptionsForYear(year, requestedFaculty = '') {
    const names = new Set();
    const integrated = WorkloadIntegration.buildIntegratedWorkloadYearData(workloadData, year);
    Object.keys(integrated?.all || {}).forEach((name) => names.add(name));
    WorkloadIntegration.listFacultyNamesFromDetailEntries(year).forEach((name) => names.add(name));
    if (requestedFaculty) names.add(requestedFaculty);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function populateFacultySelect(requestedFaculty) {
    const select = document.getElementById('facultySelect');
    const facultyNames = getFacultyOptionsForYear(state.year, requestedFaculty);

    if (!facultyNames.length) {
        select.innerHTML = '<option value="">No faculty available</option>';
        state.faculty = '';
        return;
    }

    select.innerHTML = facultyNames.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');

    if (requestedFaculty && facultyNames.includes(requestedFaculty)) {
        state.faculty = requestedFaculty;
    } else if (facultyNames.includes(state.faculty)) {
        // Keep current selection if still valid.
    } else {
        state.faculty = facultyNames[0];
    }

    select.value = state.faculty;
}

function loadEntries() {
    if (!state.year || !state.faculty) {
        state.entries = [];
        return;
    }
    state.entries = WorkloadIntegration.getFacultyWorkloadDetailEntries(state.year, state.faculty);
}

function saveEntries() {
    return WorkloadIntegration.saveFacultyWorkloadDetailEntries(
        state.year,
        state.faculty,
        state.entries,
        state.faculty
    );
}

function renderSummary() {
    const totalStudentCredits = state.entries.reduce((sum, entry) => sum + (Number(entry.studentCredits) || 0), 0);
    const totalWorkloadCredits = state.entries.reduce((sum, entry) => {
        const studentCredits = Number(entry.studentCredits) || 0;
        const rate = Number(entry.workloadRate) || 0;
        return sum + (studentCredits * rate);
    }, 0);

    document.getElementById('totalStudentCredits').textContent = formatNumber(totalStudentCredits, 1);
    document.getElementById('totalWorkloadCredits').textContent = formatNumber(totalWorkloadCredits, 2);
    document.getElementById('entryCount').textContent = String(state.entries.length);
}

function renderEntries() {
    const tbody = document.getElementById('entriesBody');
    while (tbody.firstChild) {
        tbody.removeChild(tbody.firstChild);
    }

    if (!state.entries.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 7;
        cell.style.color = '#6b7280';
        cell.style.textAlign = 'center';
        cell.style.padding = '18px';
        cell.textContent = 'No detail entries saved yet.';
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    state.entries
        .slice()
        .sort((a, b) => {
            if (a.quarter !== b.quarter) return a.quarter.localeCompare(b.quarter);
            return a.courseCode.localeCompare(b.courseCode);
        })
        .forEach((entry) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHtml(entry.quarter)}</td>
                <td>${escapeHtml(getCourseLabel(entry.courseCode))}</td>
                <td>${formatNumber(entry.studentCredits, 1)}</td>
                <td>${formatNumber(entry.workloadRate, 2)}</td>
                <td>${formatNumber((Number(entry.studentCredits) || 0) * (Number(entry.workloadRate) || 0), 2)}</td>
                <td>${escapeHtml(entry.notes || '')}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-secondary" type="button" data-action="edit" data-id="${escapeHtml(entry.id)}">Edit</button>
                        <button class="btn-secondary" type="button" data-action="delete" data-id="${escapeHtml(entry.id)}">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
}

function refreshView() {
    renderSummary();
    renderEntries();
}

function getFormEntry() {
    const courseCode = document.getElementById('courseInput').value;
    const quarter = document.getElementById('quarterInput').value;
    const studentCredits = Number(document.getElementById('studentCreditsInput').value);
    const notes = document.getElementById('notesInput').value.trim();

    if (!courseCode) {
        alert('Choose a course.');
        return null;
    }
    if (!Number.isFinite(studentCredits) || studentCredits <= 0) {
        alert('Student credits must be greater than 0.');
        return null;
    }

    return {
        id: state.editingId || `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        quarter,
        courseCode,
        studentCredits,
        workloadRate: WorkloadIntegration.getAppliedLearningRate(courseCode),
        notes
    };
}

function saveEntry() {
    const entry = getFormEntry();
    if (!entry) return;

    const existingIndex = state.entries.findIndex((item) => item.id === entry.id);
    if (existingIndex >= 0) {
        state.entries[existingIndex] = entry;
    } else {
        state.entries.push(entry);
    }

    if (!saveEntries()) {
        alert('Could not save detail entries.');
        return;
    }

    resetForm();
    loadEntries();
    refreshView();
}

function startEditEntry(entryId) {
    const entry = state.entries.find((item) => item.id === entryId);
    if (!entry) return;

    state.editingId = entry.id;
    document.getElementById('formTitle').textContent = 'Edit Detail Entry';
    document.getElementById('saveEntryBtn').textContent = 'Update Entry';
    document.getElementById('cancelEditBtn').style.display = 'inline-flex';

    document.getElementById('quarterInput').value = entry.quarter;
    document.getElementById('courseInput').value = entry.courseCode;
    document.getElementById('studentCreditsInput').value = String(entry.studentCredits);
    document.getElementById('notesInput').value = entry.notes || '';
    updateCalculatedWorkload();
}

function deleteEntry(entryId) {
    const target = state.entries.find((item) => item.id === entryId);
    if (!target) return;

    const ok = confirm(`Delete ${target.courseCode} (${target.quarter}) entry?`);
    if (!ok) return;

    state.entries = state.entries.filter((entry) => entry.id !== entryId);
    if (!saveEntries()) {
        alert('Could not save detail entries.');
        return;
    }

    if (state.editingId === entryId) {
        resetForm();
    }

    loadEntries();
    refreshView();
}

function handleEntriesTableClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const entryId = button.dataset.id;
    if (action === 'edit') startEditEntry(entryId);
    if (action === 'delete') deleteEntry(entryId);
}

function handleSelectionChange() {
    state.year = document.getElementById('yearSelect').value;
    const currentFaculty = state.faculty;
    populateFacultySelect(currentFaculty);
    state.faculty = document.getElementById('facultySelect').value;
    loadEntries();
    resetForm();
    refreshView();
}

function openDashboard() {
    const params = new URLSearchParams({ year: state.year });
    window.location.href = `./workload-dashboard.html?${params.toString()}`;
}

async function init() {
    const query = getQueryParams();

    workloadData = await loadWorkloadData('../');

    populateCourseSelect();
    renderRatesList();
    populateYearSelect(query.year);
    populateFacultySelect(query.faculty);
    state.faculty = document.getElementById('facultySelect').value;

    loadEntries();
    resetForm();
    refreshView();

    document.getElementById('yearSelect').addEventListener('change', handleSelectionChange);
    document.getElementById('facultySelect').addEventListener('change', () => {
        state.faculty = document.getElementById('facultySelect').value;
        loadEntries();
        resetForm();
        refreshView();
    });
    document.getElementById('courseInput').addEventListener('change', updateCalculatedWorkload);
    document.getElementById('studentCreditsInput').addEventListener('input', updateCalculatedWorkload);
    document.getElementById('saveEntryBtn').addEventListener('click', saveEntry);
    document.getElementById('cancelEditBtn').addEventListener('click', resetForm);
    document.getElementById('entriesBody').addEventListener('click', handleEntriesTableClick);
    document.getElementById('openDashboardBtn').addEventListener('click', openDashboard);
}

window.addEventListener('load', init);
