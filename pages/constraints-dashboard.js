/**
 * Constraints Dashboard Controller
 * Manages the UI for viewing and editing scheduling constraints
 */

// State
let rules = null;
let hasChanges = false;
let editingConstraint = null;
let facultyList = [];
let courseList = [];

// Room and time slot options
const ROOMS = {
    catalyst: ['206', '209', '210', '212'],
    cheney: ['CEB 102', 'CEB 104']
};
const ALL_ROOMS = [...ROOMS.catalyst, ...ROOMS.cheney];
const TIME_SLOTS = ['morning', 'afternoon', 'evening'];
const DAY_PATTERNS = ['MW', 'TR'];

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing Constraints Dashboard...');

    try {
        // Load rules
        const response = await fetch('../data/scheduling-rules.json');
        if (!response.ok) throw new Error('Failed to load scheduling rules');
        rules = await response.json();
        console.log('Loaded scheduling rules:', rules);

        // Load faculty list from workload data
        await loadFacultyList();

        // Load course list from catalog
        await loadCourseList();

        // Render all sections
        renderCourseConstraints();
        renderFacultyConstraints();
        renderFacultyPreferences();
        renderRoomConstraints();
        renderCaseByeCaseCourses();
        populateFacultyDropdown();

        showToast('Constraints loaded successfully', 'success');
    } catch (error) {
        console.error('Error loading constraints:', error);
        showToast('Error loading constraints: ' + error.message, 'error');
    }
});

/**
 * Load faculty list from workload data
 */
async function loadFacultyList() {
    try {
        const response = await fetch('../workload-data.json');
        if (!response.ok) return;
        const data = await response.json();

        // Extract unique faculty names
        const facultySet = new Set();

        // From current year workload
        if (data.facultyWorkload) {
            Object.keys(data.facultyWorkload).forEach(name => facultySet.add(name));
        }

        // From workload by year
        if (data.workloadByYear?.byYear) {
            Object.values(data.workloadByYear.byYear).forEach(yearData => {
                if (yearData.fullTime) {
                    Object.keys(yearData.fullTime).forEach(name => facultySet.add(name));
                }
                if (yearData.adjunct) {
                    Object.keys(yearData.adjunct).forEach(name => facultySet.add(name));
                }
            });
        }

        facultyList = Array.from(facultySet).sort();
        console.log('Loaded faculty list:', facultyList.length, 'faculty');
    } catch (err) {
        console.warn('Could not load faculty list:', err);
    }
}

/**
 * Load course list from catalog
 */
async function loadCourseList() {
    try {
        const response = await fetch('../data/course-catalog.json');
        if (!response.ok) return;
        const data = await response.json();

        if (data.courses) {
            courseList = data.courses.map(c => c.code).sort();
        }
        console.log('Loaded course list:', courseList.length, 'courses');
    } catch (err) {
        console.warn('Could not load course list:', err);
    }
}

/**
 * Populate faculty dropdown
 */
function populateFacultyDropdown() {
    const dropdown = document.getElementById('facultyDropdown');
    if (!dropdown) return;

    // Get faculty who have preferences
    const facultyWithPrefs = (rules.facultyPreferences || []).map(p => p.faculty);

    let options = '<option value="all">All Faculty</option>';

    // Add faculty with existing preferences first
    facultyWithPrefs.forEach(faculty => {
        options += `<option value="${faculty}">${faculty}</option>`;
    });

    dropdown.innerHTML = options;
}

/**
 * Render faculty preferences section
 */
function renderFacultyPreferences() {
    const container = document.getElementById('facultyPreferencesList');
    const preferences = rules?.facultyPreferences || [];
    const filter = document.getElementById('facultyDropdown')?.value || 'all';

    // Filter preferences based on dropdown
    const filtered = filter === 'all'
        ? preferences
        : preferences.filter(p => p.faculty === filter);

    if (filtered.length === 0) {
        container.innerHTML = '<p class="empty-state">No faculty preferences defined. Click "+ Add Faculty" to add one.</p>';
        return;
    }

    container.innerHTML = filtered.map(pref => {
        // Build time preference tags
        const timeTags = [];
        if (pref.timePreferences?.preferred?.length > 0) {
            timeTags.push(`<span class="tag time">Prefers: ${pref.timePreferences.preferred.join(', ')}</span>`);
        }
        if (pref.timePreferences?.blocked?.length > 0) {
            timeTags.push(`<span class="tag safety">No: ${pref.timePreferences.blocked.join(', ')}</span>`);
        }

        // Build day preference tags
        const dayTags = [];
        if (pref.dayPreferences?.preferred?.length > 0) {
            dayTags.push(`<span class="tag campus">Days: ${pref.dayPreferences.preferred.join(', ')}</span>`);
        }
        if (pref.dayPreferences?.blocked?.length > 0) {
            dayTags.push(`<span class="tag safety">Not: ${pref.dayPreferences.blocked.join(', ')}</span>`);
        }

        // Campus tag
        const campusTag = pref.campusAssignment && pref.campusAssignment !== 'any'
            ? `<span class="tag room">Campus: ${pref.campusAssignment}</span>`
            : '<span class="tag room">Campus: Any</span>';

        // Qualified courses
        const coursesTag = pref.qualifiedCourses?.length > 0
            ? `<span class="tag" style="background: #f3e8ff; color: #7c3aed;">Courses: ${pref.qualifiedCourses.length}</span>`
            : '';

        return `
            <div class="faculty-pref-card ${pref.enabled ? '' : 'disabled'}" data-id="${pref.id}">
                <div class="faculty-pref-header">
                    <div>
                        <div class="faculty-pref-name">${pref.faculty}</div>
                        ${pref.notes ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${pref.notes}</div>` : ''}
                    </div>
                    <div class="constraint-actions">
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: #6b7280;">
                            <input type="checkbox" ${pref.enabled ? 'checked' : ''}
                                   onchange="toggleFacultyPreference('${pref.id}', this.checked)"
                                   style="width: 16px; height: 16px; accent-color: #cc0000;">
                            Active
                        </label>
                        <button class="btn-icon" onclick="editFacultyPreference('${pref.id}')" title="Edit">
                            &#9998;
                        </button>
                        <button class="btn-icon delete" onclick="deleteFacultyPreference('${pref.id}')" title="Delete">
                            &#10005;
                        </button>
                    </div>
                </div>
                <div class="faculty-pref-grid">
                    <div class="pref-item">
                        <div class="pref-item-label">Time Preferences</div>
                        <div class="pref-item-value">${timeTags.length > 0 ? timeTags.join(' ') : '<span style="color: #9ca3af;">No preference</span>'}</div>
                    </div>
                    <div class="pref-item">
                        <div class="pref-item-label">Day Preferences</div>
                        <div class="pref-item-value">${dayTags.length > 0 ? dayTags.join(' ') : '<span style="color: #9ca3af;">No preference</span>'}</div>
                    </div>
                    <div class="pref-item">
                        <div class="pref-item-label">Campus</div>
                        <div class="pref-item-value">${campusTag}</div>
                    </div>
                    <div class="pref-item">
                        <div class="pref-item-label">Qualified Courses</div>
                        <div class="pref-item-value">
                            ${pref.qualifiedCourses?.length > 0
                                ? pref.qualifiedCourses.map(c => `<span class="tag" style="background: #f3e8ff; color: #7c3aed;">${c}</span>`).join(' ')
                                : '<span style="color: #9ca3af;">All courses</span>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Filter faculty preferences by dropdown selection
 */
function filterFacultyPreferences() {
    renderFacultyPreferences();
}

/**
 * Toggle faculty preference enabled state
 */
function toggleFacultyPreference(id, enabled) {
    const pref = rules.facultyPreferences?.find(p => p.id === id);
    if (pref) {
        pref.enabled = enabled;
        markUnsaved();
        renderFacultyPreferences();
    }
}

/**
 * Show add faculty preference modal
 */
function showAddFacultyPreference() {
    editingConstraint = { type: 'faculty-pref', id: null };
    document.getElementById('modalTitle').textContent = 'Add Faculty Preferences';

    // Get faculty who don't have preferences yet
    const existingFaculty = (rules.facultyPreferences || []).map(p => p.faculty);
    const availableFaculty = facultyList.filter(f => !existingFaculty.includes(f));

    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>Faculty Member</label>
            <select id="prefFaculty">
                <option value="">Select faculty...</option>
                ${availableFaculty.map(f => `<option value="${f}">${f}</option>`).join('')}
                <option value="__custom__">+ Enter name manually</option>
            </select>
        </div>
        <div class="form-group" id="customFacultyGroup" style="display: none;">
            <label>Faculty Name</label>
            <input type="text" id="customFacultyName" placeholder="Enter faculty name">
        </div>
        <div class="form-group">
            <label>Preferred Time Slots</label>
            <div class="checkbox-group">
                ${TIME_SLOTS.map(slot => `
                    <div class="checkbox-item">
                        <input type="checkbox" id="pref-time-${slot}" value="${slot}">
                        <label for="pref-time-${slot}">${slot.charAt(0).toUpperCase() + slot.slice(1)}</label>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="form-group">
            <label>Blocked Time Slots</label>
            <div class="checkbox-group">
                ${TIME_SLOTS.map(slot => `
                    <div class="checkbox-item">
                        <input type="checkbox" id="blocked-time-${slot}" value="${slot}">
                        <label for="blocked-time-${slot}">${slot.charAt(0).toUpperCase() + slot.slice(1)}</label>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="form-group">
            <label>Preferred Days</label>
            <div class="checkbox-group">
                ${DAY_PATTERNS.map(day => `
                    <div class="checkbox-item">
                        <input type="checkbox" id="pref-day-${day}" value="${day}">
                        <label for="pref-day-${day}">${day}</label>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="form-group">
            <label>Campus Assignment</label>
            <select id="prefCampus">
                <option value="any">Any Campus</option>
                <option value="cheney">Cheney Only</option>
                <option value="catalyst">Catalyst Only</option>
            </select>
        </div>
        <div class="form-group">
            <label>Qualified Courses (leave empty for all courses)</label>
            <div class="checkbox-group" style="max-height: 200px; overflow-y: auto; padding: 8px; background: #f9fafb; border-radius: 6px;">
                ${courseList.map(course => `
                    <div class="checkbox-item">
                        <input type="checkbox" id="qual-course-${course.replace(/\s/g, '-')}" value="${course}">
                        <label for="qual-course-${course.replace(/\s/g, '-')}">${course}</label>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="form-group">
            <label>Notes</label>
            <textarea id="prefNotes" placeholder="Optional notes about this faculty member"></textarea>
        </div>
    `;

    // Handle custom faculty name input
    document.getElementById('prefFaculty').addEventListener('change', function() {
        const customGroup = document.getElementById('customFacultyGroup');
        customGroup.style.display = this.value === '__custom__' ? 'block' : 'none';
    });

    document.getElementById('modalOverlay').style.display = 'flex';
}

/**
 * Edit existing faculty preference
 */
function editFacultyPreference(id) {
    const pref = rules.facultyPreferences?.find(p => p.id === id);
    if (!pref) return;

    editingConstraint = { type: 'faculty-pref', id };
    document.getElementById('modalTitle').textContent = 'Edit Faculty Preferences';

    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>Faculty Member</label>
            <input type="text" id="prefFaculty" value="${pref.faculty}" readonly style="background: #f3f4f6;">
        </div>
        <div class="form-group">
            <label>Preferred Time Slots</label>
            <div class="checkbox-group">
                ${TIME_SLOTS.map(slot => `
                    <div class="checkbox-item">
                        <input type="checkbox" id="pref-time-${slot}" value="${slot}"
                               ${pref.timePreferences?.preferred?.includes(slot) ? 'checked' : ''}>
                        <label for="pref-time-${slot}">${slot.charAt(0).toUpperCase() + slot.slice(1)}</label>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="form-group">
            <label>Blocked Time Slots</label>
            <div class="checkbox-group">
                ${TIME_SLOTS.map(slot => `
                    <div class="checkbox-item">
                        <input type="checkbox" id="blocked-time-${slot}" value="${slot}"
                               ${pref.timePreferences?.blocked?.includes(slot) ? 'checked' : ''}>
                        <label for="blocked-time-${slot}">${slot.charAt(0).toUpperCase() + slot.slice(1)}</label>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="form-group">
            <label>Preferred Days</label>
            <div class="checkbox-group">
                ${DAY_PATTERNS.map(day => `
                    <div class="checkbox-item">
                        <input type="checkbox" id="pref-day-${day}" value="${day}"
                               ${pref.dayPreferences?.preferred?.includes(day) ? 'checked' : ''}>
                        <label for="pref-day-${day}">${day}</label>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="form-group">
            <label>Campus Assignment</label>
            <select id="prefCampus">
                <option value="any" ${pref.campusAssignment === 'any' ? 'selected' : ''}>Any Campus</option>
                <option value="cheney" ${pref.campusAssignment === 'cheney' ? 'selected' : ''}>Cheney Only</option>
                <option value="catalyst" ${pref.campusAssignment === 'catalyst' ? 'selected' : ''}>Catalyst Only</option>
            </select>
        </div>
        <div class="form-group">
            <label>Qualified Courses (leave empty for all courses)</label>
            <div class="checkbox-group" style="max-height: 200px; overflow-y: auto; padding: 8px; background: #f9fafb; border-radius: 6px;">
                ${courseList.map(course => `
                    <div class="checkbox-item">
                        <input type="checkbox" id="qual-course-${course.replace(/\s/g, '-')}" value="${course}"
                               ${pref.qualifiedCourses?.includes(course) ? 'checked' : ''}>
                        <label for="qual-course-${course.replace(/\s/g, '-')}">${course}</label>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="form-group">
            <label>Notes</label>
            <textarea id="prefNotes">${pref.notes || ''}</textarea>
        </div>
    `;

    document.getElementById('modalOverlay').style.display = 'flex';
}

/**
 * Delete faculty preference
 */
function deleteFacultyPreference(id) {
    const pref = rules.facultyPreferences?.find(p => p.id === id);
    if (!pref) return;

    if (!confirm(`Remove preferences for ${pref.faculty}?`)) return;

    rules.facultyPreferences = rules.facultyPreferences.filter(p => p.id !== id);
    renderFacultyPreferences();
    populateFacultyDropdown();
    markUnsaved();
    showToast(`Removed preferences for ${pref.faculty}`);
}

/**
 * Render course constraints section
 */
function renderCourseConstraints() {
    const container = document.getElementById('courseConstraintsList');
    const constraints = rules?.courseConstraints || [];

    if (constraints.length === 0) {
        container.innerHTML = '<p class="empty-state">No course constraints defined</p>';
        return;
    }

    container.innerHTML = constraints.map(constraint => {
        const tags = [];

        // Room tags
        if (constraint.roomRestriction?.allowedRooms) {
            tags.push(`<span class="tag room">Rooms: ${constraint.roomRestriction.allowedRooms.join(', ')}</span>`);
        }
        if (constraint.roomRestriction?.campus) {
            tags.push(`<span class="tag campus">${constraint.roomRestriction.campus}</span>`);
        }

        // Time tags
        if (constraint.timeRestriction?.blockedSlots) {
            tags.push(`<span class="tag time">No ${constraint.timeRestriction.blockedSlots.join(', ')}</span>`);
        }

        const courseLabel = constraint.pattern
            ? `${constraint.pattern} (all)`
            : constraint.courses?.join(', ');

        return `
            <div class="constraint-card ${constraint.enabled ? '' : 'disabled'}" data-id="${constraint.id}">
                <div class="constraint-toggle">
                    <input type="checkbox" ${constraint.enabled ? 'checked' : ''}
                           onchange="toggleConstraint('${constraint.id}', this.checked)">
                </div>
                <div class="constraint-content">
                    <div class="constraint-title">${courseLabel}</div>
                    <div class="constraint-details">${constraint.reason || ''}</div>
                    <div class="constraint-tags">${tags.join('')}</div>
                </div>
                <div class="constraint-actions">
                    <button class="btn-icon" onclick="editCourseConstraint('${constraint.id}')" title="Edit">
                        &#9998;
                    </button>
                    <button class="btn-icon delete" onclick="deleteConstraint('course', '${constraint.id}')" title="Delete">
                        &#10005;
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render faculty constraints section
 */
function renderFacultyConstraints() {
    const container = document.getElementById('facultyConstraintsList');
    const constraints = rules?.facultyConstraints || [];

    if (constraints.length === 0) {
        container.innerHTML = '<p class="empty-state">No faculty constraints defined</p>';
        return;
    }

    container.innerHTML = constraints.map(constraint => {
        let details = constraint.reason || '';
        const tags = [];

        if (constraint.type === 'travel-time') {
            tags.push(`<span class="tag campus">Travel buffer: ${constraint.bufferMinutes} min</span>`);
        }
        if (constraint.type === 'safety') {
            tags.push(`<span class="tag safety">Min ${constraint.minimumCount} after ${constraint.afterTime}</span>`);
        }

        const title = constraint.rule === 'no-back-to-back-different-campus'
            ? 'Campus Travel Buffer'
            : constraint.rule === 'minimum-instructors-evening'
            ? 'Evening Safety Pairing'
            : constraint.id;

        return `
            <div class="constraint-card ${constraint.enabled ? '' : 'disabled'}" data-id="${constraint.id}">
                <div class="constraint-toggle">
                    <input type="checkbox" ${constraint.enabled ? 'checked' : ''}
                           onchange="toggleFacultyConstraint('${constraint.id}', this.checked)">
                </div>
                <div class="constraint-content">
                    <div class="constraint-title">${title}</div>
                    <div class="constraint-details">${details}</div>
                    <div class="constraint-tags">${tags.join('')}</div>
                </div>
                <div class="constraint-actions">
                    <button class="btn-icon" onclick="editFacultyConstraint('${constraint.id}')" title="Edit">
                        &#9998;
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render room constraints section
 */
function renderRoomConstraints() {
    const container = document.getElementById('roomConstraintsList');
    const constraints = rules?.roomConstraints || [];

    if (constraints.length === 0) {
        container.innerHTML = '<p class="empty-state">No room constraints defined</p>';
        return;
    }

    container.innerHTML = constraints.map(constraint => {
        let details = constraint.reason || '';
        const tags = [];

        if (constraint.type === 'exclude-from-grid') {
            tags.push(`<span class="tag room">Excluded from grid</span>`);
        }
        if (constraint.type === 'room-assignment' && constraint.allowedCourses) {
            tags.push(`<span class="tag room">Allowed: ${constraint.allowedCourses.join(', ')}</span>`);
        }
        if (constraint.overflowCourses) {
            tags.push(`<span class="tag time">Overflow: ${constraint.overflowCourses.join(', ')}</span>`);
        }

        return `
            <div class="constraint-card" data-id="${constraint.id}">
                <div class="constraint-content" style="margin-left: 30px;">
                    <div class="constraint-title">Room ${constraint.room}</div>
                    <div class="constraint-details">${details}</div>
                    <div class="constraint-tags">${tags.join('')}</div>
                </div>
                <div class="constraint-actions">
                    <button class="btn-icon" onclick="editRoomConstraint('${constraint.id}')" title="Edit">
                        &#9998;
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render case-by-case courses
 */
function renderCaseByeCaseCourses() {
    const container = document.getElementById('caseByeCaseList');
    const courses = rules?.caseByCase?.courses || [];
    const descriptions = rules?.caseByCase?.descriptions || {};

    if (courses.length === 0) {
        container.innerHTML = '<p class="empty-state">No case-by-case courses defined</p>';
        return;
    }

    container.innerHTML = courses.map(course => `
        <div class="case-course">
            <span class="case-course-code">${course}</span>
            <span class="case-course-desc">${descriptions[course] || ''}</span>
            <button class="btn-remove" onclick="removeCaseByCase('${course}')">&times;</button>
        </div>
    `).join('');
}

/**
 * Toggle constraint enabled state
 */
function toggleConstraint(id, enabled) {
    const constraint = rules.courseConstraints?.find(c => c.id === id);
    if (constraint) {
        constraint.enabled = enabled;
        markUnsaved();
        renderCourseConstraints();
    }
}

function toggleFacultyConstraint(id, enabled) {
    const constraint = rules.facultyConstraints?.find(c => c.id === id);
    if (constraint) {
        constraint.enabled = enabled;
        markUnsaved();
        renderFacultyConstraints();
    }
}

/**
 * Mark as having unsaved changes
 */
function markUnsaved() {
    hasChanges = true;
    document.getElementById('statusText').textContent = 'Unsaved changes';
    document.getElementById('statusText').classList.add('unsaved');
}

/**
 * Show add course constraint modal
 */
function showAddCourseConstraint() {
    editingConstraint = null;
    document.getElementById('modalTitle').textContent = 'Add Course Constraint';

    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>Constraint Type</label>
            <select id="constraintType" onchange="updateConstraintForm()">
                <option value="course-list">Specific Courses</option>
                <option value="course-pattern">Course Pattern (e.g., ITGS)</option>
            </select>
        </div>
        <div class="form-group" id="courseInputGroup">
            <label>Courses (comma-separated)</label>
            <input type="text" id="constraintCourses" placeholder="e.g., DESN 301, DESN 359">
        </div>
        <div class="form-group">
            <label>Allowed Rooms</label>
            <div class="checkbox-group">
                ${ALL_ROOMS.map(room => `
                    <div class="checkbox-item">
                        <input type="checkbox" id="room-${room.replace(' ', '-')}" value="${room}">
                        <label for="room-${room.replace(' ', '-')}">${room}</label>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="form-group">
            <label>Blocked Time Slots</label>
            <div class="checkbox-group">
                ${TIME_SLOTS.map(slot => `
                    <div class="checkbox-item">
                        <input type="checkbox" id="time-${slot}" value="${slot}">
                        <label for="time-${slot}">${slot.charAt(0).toUpperCase() + slot.slice(1)}</label>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="form-group">
            <label>Reason</label>
            <textarea id="constraintReason" placeholder="Why does this constraint exist?"></textarea>
        </div>
    `;

    document.getElementById('modalOverlay').style.display = 'flex';
}

function updateConstraintForm() {
    const type = document.getElementById('constraintType').value;
    const inputGroup = document.getElementById('courseInputGroup');

    if (type === 'course-pattern') {
        inputGroup.innerHTML = `
            <label>Course Pattern</label>
            <input type="text" id="constraintPattern" placeholder="e.g., ITGS">
            <small style="color: #6b7280; display: block; margin-top: 4px;">All courses starting with this prefix</small>
        `;
    } else {
        inputGroup.innerHTML = `
            <label>Courses (comma-separated)</label>
            <input type="text" id="constraintCourses" placeholder="e.g., DESN 301, DESN 359">
        `;
    }
}

/**
 * Edit existing course constraint
 */
function editCourseConstraint(id) {
    const constraint = rules.courseConstraints?.find(c => c.id === id);
    if (!constraint) return;

    editingConstraint = { type: 'course', id };
    document.getElementById('modalTitle').textContent = 'Edit Course Constraint';

    const isPattern = constraint.type === 'course-pattern';

    document.getElementById('modalBody').innerHTML = `
        <div class="form-group">
            <label>Constraint Type</label>
            <select id="constraintType" onchange="updateConstraintForm()">
                <option value="course-list" ${!isPattern ? 'selected' : ''}>Specific Courses</option>
                <option value="course-pattern" ${isPattern ? 'selected' : ''}>Course Pattern</option>
            </select>
        </div>
        <div class="form-group" id="courseInputGroup">
            ${isPattern ? `
                <label>Course Pattern</label>
                <input type="text" id="constraintPattern" value="${constraint.pattern || ''}">
            ` : `
                <label>Courses (comma-separated)</label>
                <input type="text" id="constraintCourses" value="${constraint.courses?.join(', ') || ''}">
            `}
        </div>
        <div class="form-group">
            <label>Allowed Rooms</label>
            <div class="checkbox-group">
                ${ALL_ROOMS.map(room => {
                    const checked = constraint.roomRestriction?.allowedRooms?.includes(room);
                    return `
                        <div class="checkbox-item">
                            <input type="checkbox" id="room-${room.replace(' ', '-')}" value="${room}" ${checked ? 'checked' : ''}>
                            <label for="room-${room.replace(' ', '-')}">${room}</label>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        <div class="form-group">
            <label>Blocked Time Slots</label>
            <div class="checkbox-group">
                ${TIME_SLOTS.map(slot => {
                    const checked = constraint.timeRestriction?.blockedSlots?.includes(slot);
                    return `
                        <div class="checkbox-item">
                            <input type="checkbox" id="time-${slot}" value="${slot}" ${checked ? 'checked' : ''}>
                            <label for="time-${slot}">${slot.charAt(0).toUpperCase() + slot.slice(1)}</label>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        <div class="form-group">
            <label>Reason</label>
            <textarea id="constraintReason">${constraint.reason || ''}</textarea>
        </div>
    `;

    document.getElementById('modalOverlay').style.display = 'flex';
}

/**
 * Edit faculty constraint
 */
function editFacultyConstraint(id) {
    const constraint = rules.facultyConstraints?.find(c => c.id === id);
    if (!constraint) return;

    editingConstraint = { type: 'faculty', id };
    document.getElementById('modalTitle').textContent = 'Edit Faculty Constraint';

    let formHtml = '';

    if (constraint.rule === 'no-back-to-back-different-campus') {
        formHtml = `
            <div class="form-group">
                <label>Buffer Time (minutes)</label>
                <input type="number" id="bufferMinutes" value="${constraint.bufferMinutes || 30}" min="0">
            </div>
        `;
    } else if (constraint.rule === 'minimum-instructors-evening') {
        formHtml = `
            <div class="form-group">
                <label>Minimum Instructors</label>
                <input type="number" id="minimumCount" value="${constraint.minimumCount || 2}" min="1">
            </div>
            <div class="form-group">
                <label>After Time</label>
                <input type="text" id="afterTime" value="${constraint.afterTime || '16:00'}" placeholder="HH:MM">
            </div>
        `;
    }

    formHtml += `
        <div class="form-group">
            <label>Reason</label>
            <textarea id="constraintReason">${constraint.reason || ''}</textarea>
        </div>
    `;

    document.getElementById('modalBody').innerHTML = formHtml;
    document.getElementById('modalOverlay').style.display = 'flex';
}

/**
 * Save constraint from modal
 */
function saveConstraint() {
    if (editingConstraint?.type === 'course') {
        saveCourseConstraint();
    } else if (editingConstraint?.type === 'faculty') {
        saveFacultyConstraintEdit();
    } else if (editingConstraint?.type === 'faculty-pref') {
        saveFacultyPreference();
    } else {
        // New constraint
        saveCourseConstraint();
    }
}

/**
 * Save faculty preference from modal
 */
function saveFacultyPreference() {
    // Get faculty name
    let facultyName;
    const facultySelect = document.getElementById('prefFaculty');

    if (facultySelect?.tagName === 'SELECT') {
        // Add mode - dropdown
        if (facultySelect.value === '__custom__') {
            facultyName = document.getElementById('customFacultyName')?.value?.trim();
        } else {
            facultyName = facultySelect.value;
        }
    } else {
        // Edit mode - readonly input
        facultyName = facultySelect?.value;
    }

    if (!facultyName) {
        showToast('Please select or enter a faculty name', 'error');
        return;
    }

    // Get preferred time slots
    const preferredTimes = TIME_SLOTS.filter(slot => {
        const checkbox = document.getElementById(`pref-time-${slot}`);
        return checkbox?.checked;
    });

    // Get blocked time slots
    const blockedTimes = TIME_SLOTS.filter(slot => {
        const checkbox = document.getElementById(`blocked-time-${slot}`);
        return checkbox?.checked;
    });

    // Get preferred days
    const preferredDays = DAY_PATTERNS.filter(day => {
        const checkbox = document.getElementById(`pref-day-${day}`);
        return checkbox?.checked;
    });

    // Get campus assignment
    const campusAssignment = document.getElementById('prefCampus')?.value || 'any';

    // Get qualified courses
    const qualifiedCourses = courseList.filter(course => {
        const checkbox = document.getElementById(`qual-course-${course.replace(/\s/g, '-')}`);
        return checkbox?.checked;
    });

    // Get notes
    const notes = document.getElementById('prefNotes')?.value?.trim() || '';

    // Build preference object
    const newPref = {
        id: editingConstraint?.id || `faculty-pref-${facultyName.toLowerCase().replace(/\s/g, '-')}-${Date.now()}`,
        faculty: facultyName,
        timePreferences: {
            preferred: preferredTimes,
            blocked: blockedTimes
        },
        dayPreferences: {
            preferred: preferredDays,
            blocked: []
        },
        campusAssignment: campusAssignment,
        qualifiedCourses: qualifiedCourses,
        notes: notes,
        enabled: true
    };

    // Initialize facultyPreferences array if needed
    if (!rules.facultyPreferences) {
        rules.facultyPreferences = [];
    }

    // Update or add
    if (editingConstraint?.id) {
        const idx = rules.facultyPreferences.findIndex(p => p.id === editingConstraint.id);
        if (idx > -1) {
            // Preserve enabled state when editing
            newPref.enabled = rules.facultyPreferences[idx].enabled;
            rules.facultyPreferences[idx] = newPref;
        }
    } else {
        rules.facultyPreferences.push(newPref);
    }

    closeModal();
    renderFacultyPreferences();
    populateFacultyDropdown();
    markUnsaved();
    showToast(`Saved preferences for ${facultyName}`);
}

function saveCourseConstraint() {
    const type = document.getElementById('constraintType').value;
    const reason = document.getElementById('constraintReason').value;

    // Get selected rooms
    const allowedRooms = ALL_ROOMS.filter(room => {
        const checkbox = document.getElementById(`room-${room.replace(' ', '-')}`);
        return checkbox?.checked;
    });

    // Get blocked time slots
    const blockedSlots = TIME_SLOTS.filter(slot => {
        const checkbox = document.getElementById(`time-${slot}`);
        return checkbox?.checked;
    });

    let newConstraint;

    if (type === 'course-pattern') {
        const pattern = document.getElementById('constraintPattern')?.value?.trim();
        if (!pattern) {
            showToast('Please enter a course pattern', 'error');
            return;
        }
        newConstraint = {
            id: editingConstraint?.id || `pattern-${pattern.toLowerCase()}-${Date.now()}`,
            pattern: pattern,
            type: 'course-pattern',
            enabled: true
        };
    } else {
        const coursesInput = document.getElementById('constraintCourses')?.value?.trim();
        if (!coursesInput) {
            showToast('Please enter at least one course', 'error');
            return;
        }
        const courses = coursesInput.split(',').map(c => c.trim()).filter(c => c);
        newConstraint = {
            id: editingConstraint?.id || `courses-${Date.now()}`,
            courses: courses,
            type: 'course-list',
            enabled: true
        };
    }

    if (allowedRooms.length > 0) {
        newConstraint.roomRestriction = { allowedRooms };

        // Determine campus
        const hasCheney = allowedRooms.some(r => r.includes('CEB'));
        const hasCatalyst = allowedRooms.some(r => !r.includes('CEB'));
        if (hasCheney && !hasCatalyst) newConstraint.roomRestriction.campus = 'cheney';
        if (hasCatalyst && !hasCheney) newConstraint.roomRestriction.campus = 'catalyst';
    }

    if (blockedSlots.length > 0) {
        newConstraint.timeRestriction = { blockedSlots };
    }

    if (reason) {
        newConstraint.reason = reason;
    }

    // Update or add
    if (!rules.courseConstraints) rules.courseConstraints = [];

    if (editingConstraint?.id) {
        const idx = rules.courseConstraints.findIndex(c => c.id === editingConstraint.id);
        if (idx > -1) {
            rules.courseConstraints[idx] = newConstraint;
        }
    } else {
        rules.courseConstraints.push(newConstraint);
    }

    closeModal();
    renderCourseConstraints();
    markUnsaved();
    showToast('Constraint saved');
}

function saveFacultyConstraintEdit() {
    const constraint = rules.facultyConstraints?.find(c => c.id === editingConstraint?.id);
    if (!constraint) return;

    const reason = document.getElementById('constraintReason')?.value;

    if (constraint.rule === 'no-back-to-back-different-campus') {
        constraint.bufferMinutes = parseInt(document.getElementById('bufferMinutes')?.value) || 30;
    } else if (constraint.rule === 'minimum-instructors-evening') {
        constraint.minimumCount = parseInt(document.getElementById('minimumCount')?.value) || 2;
        constraint.afterTime = document.getElementById('afterTime')?.value || '16:00';
    }

    if (reason) constraint.reason = reason;

    closeModal();
    renderFacultyConstraints();
    markUnsaved();
    showToast('Constraint saved');
}

/**
 * Delete constraint
 */
function deleteConstraint(type, id) {
    if (!confirm('Are you sure you want to delete this constraint?')) return;

    if (type === 'course') {
        rules.courseConstraints = rules.courseConstraints.filter(c => c.id !== id);
        renderCourseConstraints();
    }

    markUnsaved();
    showToast('Constraint deleted');
}

/**
 * Add case-by-case course
 */
function showAddCaseByCase() {
    const course = prompt('Enter course code (e.g., DESN 495):');
    if (!course) return;

    const description = prompt('Enter description (optional):');

    if (!rules.caseByCase) {
        rules.caseByCase = { courses: [], descriptions: {} };
    }

    if (!rules.caseByCase.courses.includes(course.trim().toUpperCase())) {
        rules.caseByCase.courses.push(course.trim().toUpperCase());
        if (description) {
            rules.caseByCase.descriptions[course.trim().toUpperCase()] = description;
        }
        renderCaseByeCaseCourses();
        markUnsaved();
        showToast(`Added ${course} to case-by-case courses`);
    } else {
        showToast('Course already in list', 'error');
    }
}

function removeCaseByCase(course) {
    if (!confirm(`Remove ${course} from case-by-case courses?`)) return;

    rules.caseByCase.courses = rules.caseByCase.courses.filter(c => c !== course);
    delete rules.caseByCase.descriptions[course];

    renderCaseByeCaseCourses();
    markUnsaved();
    showToast(`Removed ${course}`);
}

/**
 * Run validation
 */
function runValidation() {
    const results = [];

    // Check for conflicts between constraints
    const courseConstraints = rules.courseConstraints || [];

    // Check if any course has conflicting constraints
    const courseRules = {};
    courseConstraints.forEach(constraint => {
        const courses = constraint.courses || [constraint.pattern + '*'];
        courses.forEach(course => {
            if (!courseRules[course]) courseRules[course] = [];
            courseRules[course].push(constraint);
        });
    });

    // Check for courses with multiple room constraints
    Object.entries(courseRules).forEach(([course, constraints]) => {
        if (constraints.length > 1) {
            results.push({
                type: 'warning',
                message: `${course} has ${constraints.length} constraints - verify they don't conflict`
            });
        }
    });

    // Check case-by-case courses aren't also in constraints
    const caseByCase = rules.caseByCase?.courses || [];
    courseConstraints.forEach(constraint => {
        (constraint.courses || []).forEach(course => {
            if (caseByCase.includes(course)) {
                results.push({
                    type: 'error',
                    message: `${course} is both a case-by-case course and has scheduling constraints`
                });
            }
        });
    });

    // Render results
    const container = document.getElementById('validationResults');

    if (results.length === 0) {
        container.innerHTML = `
            <div class="validation-success">
                <span class="icon">&#10003;</span>
                <span>No rule conflicts detected</span>
            </div>
        `;
    } else {
        container.innerHTML = results.map(r => `
            <div class="validation-${r.type}">
                <span class="icon">${r.type === 'error' ? '&#10007;' : '&#9888;'}</span>
                <span>${r.message}</span>
            </div>
        `).join('');
    }

    showToast(`Validation complete: ${results.length} issue(s) found`);
}

/**
 * Save rules to file (triggers download since we can't write directly)
 */
function saveRules() {
    rules.lastModified = new Date().toISOString().split('T')[0];

    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scheduling-rules.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    hasChanges = false;
    document.getElementById('statusText').textContent = 'Changes exported - replace data/scheduling-rules.json';
    document.getElementById('statusText').classList.remove('unsaved');

    showToast('Rules exported. Replace data/scheduling-rules.json with the downloaded file.', 'success');
}

/**
 * Reset to default rules
 */
async function resetToDefaults() {
    if (!confirm('Reset all constraints to defaults? This will discard any changes.')) return;

    try {
        const response = await fetch('../data/scheduling-rules.json');
        if (!response.ok) throw new Error('Failed to load default rules');
        rules = await response.json();

        renderCourseConstraints();
        renderFacultyConstraints();
        renderRoomConstraints();
        renderCaseByeCaseCourses();

        hasChanges = false;
        document.getElementById('statusText').textContent = 'Reset to defaults';
        document.getElementById('statusText').classList.remove('unsaved');

        showToast('Reset to default constraints');
    } catch (error) {
        showToast('Error resetting: ' + error.message, 'error');
    }
}

/**
 * Close modal
 */
function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    editingConstraint = null;
}

// Close modal on overlay click
document.getElementById('modalOverlay')?.addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.add('visible');

    setTimeout(() => {
        toast.classList.remove('visible');
    }, 3000);
}

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', function(e) {
    if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});
