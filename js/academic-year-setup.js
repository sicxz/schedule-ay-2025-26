const STORAGE_KEY = 'programCommandAySetup';
const SCHEDULE_STORAGE_PREFIX = 'designSchedulerData_';
const ROLE_TARGET_DEFAULTS = {
    'Tenure/Tenure-track': 36,
    Lecturer: 45
};

const state = {
    store: loadStore(),
    year: '',
    editingId: null
};

let syncingReleaseFields = false;

function loadStore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.warn('Could not load academic year setup data:', error);
        return {};
    }
}

function saveStore() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.store));
}

function formatAcademicYear(startYear) {
    return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function getPreviousAcademicYear(year) {
    const match = /^(\d{4})-\d{2}$/.exec(String(year || '').trim());
    if (!match) return null;
    const previousStartYear = Number(match[1]) - 1;
    return formatAcademicYear(previousStartYear);
}

function getDefaultAcademicYear() {
    const now = new Date();
    const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return formatAcademicYear(startYear);
}

function getAcademicYearOptions() {
    const existingYears = Object.keys(state.store);
    const defaultYear = getDefaultAcademicYear();
    const start = Number(defaultYear.slice(0, 4));
    const seededYears = [formatAcademicYear(start - 1), defaultYear, formatAcademicYear(start + 1)];
    return [...new Set([...existingYears, ...seededYears])].sort();
}

function ensureYearRecord(year) {
    if (!state.store[year]) {
        state.store[year] = {
            adjunctTargets: { fall: 0, winter: 0, spring: 0 },
            notes: '',
            faculty: [],
            updatedAt: new Date().toISOString()
        };
    }
    return state.store[year];
}

function currentYearData() {
    return ensureYearRecord(state.year);
}

function touchYearRecord(yearData) {
    yearData.updatedAt = new Date().toISOString();
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseNumberInput(id, fallback = 0) {
    const input = document.getElementById(id);
    const value = Number(input?.value);
    if (!Number.isFinite(value) || value < 0) return fallback;
    return value;
}

function formatNumeric(value, decimals = 2) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0';
    return String(Number(numeric.toFixed(decimals)));
}

function getTargetDefaultForRole(role, fallback = null) {
    return Object.prototype.hasOwnProperty.call(ROLE_TARGET_DEFAULTS, role)
        ? ROLE_TARGET_DEFAULTS[role]
        : fallback;
}

function setNumericInputValue(id, value, decimals = 2) {
    const input = document.getElementById(id);
    if (!input) return;
    input.value = formatNumeric(value, decimals);
}

function syncReleasePercentFromCredits() {
    if (syncingReleaseFields) return;
    syncingReleaseFields = true;
    const target = parseNumberInput('annualTargetCredits', 0);
    const releaseCredits = parseNumberInput('releaseCredits', 0);
    const percent = target > 0 ? (releaseCredits / target) * 100 : 0;
    setNumericInputValue('releasePercent', percent, 1);
    syncingReleaseFields = false;
}

function syncReleaseCreditsFromPercent() {
    if (syncingReleaseFields) return;
    syncingReleaseFields = true;
    const target = parseNumberInput('annualTargetCredits', 0);
    const releasePercent = parseNumberInput('releasePercent', 0);
    const credits = target > 0 ? (target * releasePercent) / 100 : 0;
    setNumericInputValue('releaseCredits', credits, 2);
    syncingReleaseFields = false;
}

function applyRoleTargetDefault() {
    const role = document.getElementById('facultyRole').value;
    const defaultTarget = getTargetDefaultForRole(role, null);
    if (defaultTarget === null) return;
    setNumericInputValue('annualTargetCredits', defaultTarget, 1);
    syncReleaseCreditsFromPercent();
}

function normalizeNameForMatch(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function createFacultyId() {
    if (globalThis.crypto?.randomUUID) {
        return crypto.randomUUID();
    }
    return `fac_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function renderYearSelect() {
    const select = document.getElementById('academicYearSelect');
    const years = getAcademicYearOptions();
    select.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join('');

    if (!state.year || !years.includes(state.year)) {
        state.year = years.includes(getDefaultAcademicYear()) ? getDefaultAcademicYear() : years[0];
    }
    select.value = state.year;
}

function setActiveYear(year) {
    state.year = year;
    ensureYearRecord(year);
    saveStore();
    renderYearSelect();
    renderYearData();
}

function renderYearData() {
    const data = currentYearData();
    const adjunctTargets = data.adjunctTargets || { fall: 0, winter: 0, spring: 0 };

    document.getElementById('facultyTableYearLabel').textContent = state.year;
    document.getElementById('adjunctFall').value = adjunctTargets.fall || 0;
    document.getElementById('adjunctWinter').value = adjunctTargets.winter || 0;
    document.getElementById('adjunctSpring').value = adjunctTargets.spring || 0;
    document.getElementById('yearNotes').value = data.notes || '';

    renderFacultyTable();
    renderSummary();
}

function renderSummary() {
    const data = currentYearData();
    const faculty = Array.isArray(data.faculty) ? data.faculty : [];
    const adjunctTargets = data.adjunctTargets || {};

    const totalTargets = faculty.reduce((sum, record) => sum + (Number(record.annualTargetCredits) || 0), 0);
    const totalRelease = faculty.reduce((sum, record) => sum + (Number(record.releaseCredits) || 0), 0);
    const totalAdjunct = (Number(adjunctTargets.fall) || 0) + (Number(adjunctTargets.winter) || 0) + (Number(adjunctTargets.spring) || 0);

    document.getElementById('summaryFacultyCount').textContent = String(faculty.length);
    document.getElementById('summaryTargetCredits').textContent = formatNumeric(totalTargets);
    document.getElementById('summaryReleaseCredits').textContent = formatNumeric(totalRelease);
    document.getElementById('summaryAdjunctCredits').textContent = formatNumeric(totalAdjunct);
}

function renderFacultyTable() {
    const tbody = document.getElementById('facultyTableBody');
    const records = [...(currentYearData().faculty || [])].sort((a, b) => a.name.localeCompare(b.name));

    if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No faculty records yet for this year.</td></tr>';
        return;
    }

    tbody.innerHTML = records
        .map((record) => {
            const target = Number(record.annualTargetCredits) || 0;
            const release = Number(record.releaseCredits) || 0;
            const releasePercent =
                Number.isFinite(Number(record.releasePercent))
                    ? Number(record.releasePercent)
                    : (target > 0 ? (release / target) * 100 : 0);
            const net = target - release;
            return `
                <tr>
                    <td>${escapeHtml(record.name)}</td>
                    <td>${escapeHtml(record.role)}</td>
                    <td>${formatNumeric(record.ftePercent, 1)}%</td>
                    <td>${formatNumeric(target)}</td>
                    <td>${formatNumeric(release)} (${formatNumeric(releasePercent, 1)}%)</td>
                    <td>${formatNumeric(net)}</td>
                    <td>
                        <div class="table-actions">
                            <button type="button" class="secondary" data-action="edit" data-id="${record.id}">Edit</button>
                            <button type="button" class="secondary" data-action="delete" data-id="${record.id}">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join('');
}

function resetForm() {
    state.editingId = null;
    document.getElementById('facultyId').value = '';
    document.getElementById('facultyForm').reset();
    document.getElementById('facultyRole').value = 'Tenure/Tenure-track';
    document.getElementById('ftePercent').value = '100';
    document.getElementById('annualTargetCredits').value = String(getTargetDefaultForRole('Tenure/Tenure-track', 36));
    document.getElementById('releaseCredits').value = '0';
    document.getElementById('releasePercent').value = '0';
    document.getElementById('saveFacultyBtn').textContent = 'Add Faculty';
    document.getElementById('formModeTag').textContent = 'New record';
}

function handleFacultySubmit(event) {
    event.preventDefault();

    const name = document.getElementById('facultyName').value.trim();
    if (!name) return;

    const yearData = currentYearData();
    const records = Array.isArray(yearData.faculty) ? yearData.faculty : [];
    const id = state.editingId || createFacultyId();

    const record = {
        id,
        name,
        role: document.getElementById('facultyRole').value,
        ftePercent: parseNumberInput('ftePercent', 100),
        annualTargetCredits: parseNumberInput('annualTargetCredits', getTargetDefaultForRole(document.getElementById('facultyRole').value, 45)),
        releaseCredits: parseNumberInput('releaseCredits', 0),
        releasePercent: parseNumberInput('releasePercent', 0),
        releaseReason: document.getElementById('releaseReason').value.trim(),
        notes: document.getElementById('facultyNotes').value.trim()
    };

    const index = records.findIndex((entry) => entry.id === id);
    if (index >= 0) {
        records[index] = record;
    } else {
        records.push(record);
    }

    yearData.faculty = records;
    touchYearRecord(yearData);
    saveStore();
    renderFacultyTable();
    renderSummary();
    resetForm();
}

function startEdit(recordId) {
    const yearData = currentYearData();
    const record = (yearData.faculty || []).find((entry) => entry.id === recordId);
    if (!record) return;

    state.editingId = record.id;
    document.getElementById('facultyId').value = record.id;
    document.getElementById('facultyName').value = record.name || '';
    document.getElementById('facultyRole').value = record.role || 'Tenure/Tenure-track';
    document.getElementById('ftePercent').value = String(record.ftePercent ?? 100);
    const targetDefault = getTargetDefaultForRole(record.role || 'Tenure/Tenure-track', 45);
    const targetCredits = Number(record.annualTargetCredits ?? targetDefault);
    const releaseCredits = Number(record.releaseCredits ?? 0);
    const releasePercent = Number.isFinite(Number(record.releasePercent))
        ? Number(record.releasePercent)
        : (targetCredits > 0 ? (releaseCredits / targetCredits) * 100 : 0);
    document.getElementById('annualTargetCredits').value = formatNumeric(targetCredits, 2);
    document.getElementById('releaseCredits').value = formatNumeric(releaseCredits, 2);
    document.getElementById('releasePercent').value = formatNumeric(releasePercent, 1);
    document.getElementById('releaseReason').value = record.releaseReason || '';
    document.getElementById('facultyNotes').value = record.notes || '';
    document.getElementById('saveFacultyBtn').textContent = 'Update Faculty';
    document.getElementById('formModeTag').textContent = 'Editing record';
}

function deleteRecord(recordId) {
    const yearData = currentYearData();
    const record = (yearData.faculty || []).find((entry) => entry.id === recordId);
    if (!record) return;

    const ok = confirm(`Delete faculty record for ${record.name}?`);
    if (!ok) return;

    yearData.faculty = (yearData.faculty || []).filter((entry) => entry.id !== recordId);
    touchYearRecord(yearData);
    saveStore();
    renderFacultyTable();
    renderSummary();

    if (state.editingId === recordId) {
        resetForm();
    }
}

function updateAdjunctPlanning() {
    const yearData = currentYearData();
    yearData.adjunctTargets = {
        fall: parseNumberInput('adjunctFall', 0),
        winter: parseNumberInput('adjunctWinter', 0),
        spring: parseNumberInput('adjunctSpring', 0)
    };
    yearData.notes = document.getElementById('yearNotes').value.trim();
    touchYearRecord(yearData);
    saveStore();
    renderSummary();
}

function resolveRoleFromImportedName(name) {
    const lower = String(name || '').toLowerCase();
    if (lower.includes('adjunct')) return 'Adjunct';
    if (lower.includes('tbd')) return 'Staff/Other';
    return 'Lecturer';
}

function collectInstructorsFromSchedule(scheduleData) {
    const instructors = new Set();
    ['fall', 'winter', 'spring'].forEach((quarter) => {
        const quarterData = scheduleData?.[quarter];
        if (!quarterData || typeof quarterData !== 'object') return;

        Object.values(quarterData).forEach((dayData) => {
            if (!dayData || typeof dayData !== 'object') return;
            Object.values(dayData).forEach((courses) => {
                if (!Array.isArray(courses)) return;
                courses.forEach((course) => {
                    if (course?.instructor && String(course.instructor).trim()) {
                        instructors.add(String(course.instructor).trim());
                    }
                });
            });
        });
    });

    return Array.from(instructors).sort((a, b) => a.localeCompare(b));
}

function importFromSchedule() {
    const key = `${SCHEDULE_STORAGE_PREFIX}${state.year}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
        alert(`No schedule found for ${state.year}.`);
        return;
    }

    let parsed = null;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        alert(`Could not parse schedule data for ${state.year}.`);
        return;
    }

    const instructors = collectInstructorsFromSchedule(parsed);
    if (!instructors.length) {
        alert(`No instructors found in ${state.year} schedule.`);
        return;
    }

    const yearData = currentYearData();
    const faculty = Array.isArray(yearData.faculty) ? yearData.faculty : [];
    const existingNames = new Set(faculty.map((entry) => normalizeNameForMatch(entry.name)));

    let added = 0;
    instructors.forEach((name) => {
        if (existingNames.has(normalizeNameForMatch(name))) return;
        const role = resolveRoleFromImportedName(name);
        faculty.push({
            id: createFacultyId(),
            name,
            role,
            ftePercent: 100,
            annualTargetCredits: getTargetDefaultForRole(role, 45),
            releaseCredits: 0,
            releasePercent: 0,
            releaseReason: '',
            notes: ''
        });
        existingNames.add(normalizeNameForMatch(name));
        added += 1;
    });

    yearData.faculty = faculty;
    touchYearRecord(yearData);
    saveStore();
    renderFacultyTable();
    renderSummary();

    alert(`Imported ${added} faculty records from ${state.year}.`);
}

function addYear() {
    const years = getAcademicYearOptions();
    const highestYear = years.reduce((max, year) => Math.max(max, Number(year.slice(0, 4))), Number(getDefaultAcademicYear().slice(0, 4)));
    const suggestion = formatAcademicYear(highestYear + 1);
    const value = prompt('Enter new academic year (YYYY-YY):', suggestion);
    if (!value) return;

    const cleaned = value.trim();
    if (!/^\d{4}-\d{2}$/.test(cleaned)) {
        alert('Use format YYYY-YY, for example 2027-28.');
        return;
    }

    ensureYearRecord(cleaned);
    saveStore();
    setActiveYear(cleaned);

    const previousYear = getPreviousAcademicYear(cleaned);
    if (previousYear && state.store[previousYear]) {
        const shouldCopy = confirm(`Created ${cleaned}. Copy setup from ${previousYear}?`);
        if (shouldCopy) {
            copyPreviousYear({ skipConfirm: true });
        }
    }
}

function hasMeaningfulYearData(yearData) {
    if (!yearData || typeof yearData !== 'object') return false;
    const facultyCount = Array.isArray(yearData.faculty) ? yearData.faculty.length : 0;
    const notes = String(yearData.notes || '').trim();
    const targets = yearData.adjunctTargets || {};
    const adjunctTotal =
        (Number(targets.fall) || 0) +
        (Number(targets.winter) || 0) +
        (Number(targets.spring) || 0);

    return facultyCount > 0 || adjunctTotal > 0 || Boolean(notes);
}

function copyPreviousYear(options = {}) {
    const { skipConfirm = false } = options;
    const targetYear = state.year;
    const previousYear = getPreviousAcademicYear(targetYear);
    if (!previousYear) {
        alert('Select a valid academic year first.');
        return;
    }

    const previousData = state.store[previousYear];
    if (!previousData) {
        alert(`No setup data found for ${previousYear}.`);
        return;
    }

    const existingTargetData = ensureYearRecord(targetYear);
    const targetHasData = hasMeaningfulYearData(existingTargetData);

    if (!skipConfirm) {
        const promptMessage = targetHasData
            ? `Replace existing ${targetYear} setup with ${previousYear} data?`
            : `Copy ${previousYear} setup into ${targetYear}?`;
        if (!confirm(promptMessage)) {
            return;
        }
    }

    const cloned = JSON.parse(JSON.stringify(previousData));
    if (Array.isArray(cloned.faculty)) {
        cloned.faculty = cloned.faculty.map((record) => ({
            ...record,
            id: createFacultyId()
        }));
    }
    cloned.updatedAt = new Date().toISOString();
    state.store[targetYear] = cloned;
    saveStore();
    renderYearData();
    resetForm();

    if (!skipConfirm) {
        alert(`Copied setup from ${previousYear} to ${targetYear}.`);
    }
}

function wireEvents() {
    document.getElementById('academicYearSelect').addEventListener('change', (event) => {
        setActiveYear(event.target.value);
    });
    document.getElementById('addYearBtn').addEventListener('click', addYear);
    document.getElementById('copyPreviousYearBtn').addEventListener('click', () => copyPreviousYear());

    document.getElementById('facultyForm').addEventListener('submit', handleFacultySubmit);
    document.getElementById('cancelEditBtn').addEventListener('click', resetForm);
    document.getElementById('importFromScheduleBtn').addEventListener('click', importFromSchedule);
    document.getElementById('facultyRole').addEventListener('change', applyRoleTargetDefault);
    document.getElementById('releaseCredits').addEventListener('input', syncReleasePercentFromCredits);
    document.getElementById('releasePercent').addEventListener('input', syncReleaseCreditsFromPercent);
    document.getElementById('annualTargetCredits').addEventListener('input', syncReleaseCreditsFromPercent);

    ['adjunctFall', 'adjunctWinter', 'adjunctSpring', 'yearNotes'].forEach((id) => {
        document.getElementById(id).addEventListener('input', updateAdjunctPlanning);
    });

    document.getElementById('facultyTableBody').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        const recordId = button.dataset.id;
        if (action === 'edit') startEdit(recordId);
        if (action === 'delete') deleteRecord(recordId);
    });
}

function init() {
    renderYearSelect();
    ensureYearRecord(state.year);
    wireEvents();
    renderYearData();
    resetForm();
}

init();
