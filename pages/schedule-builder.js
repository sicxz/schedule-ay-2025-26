/**
 * Schedule Builder Page Controller
 * Handles UI interactions and rendering for the schedule builder
 */

// Global state
let currentSchedule = null;
let currentView = 'grid';
let assignedCourses = {}; // { 'MW-10:00-12:00-206': [course1, course2], ... }
let roomConstraints = null; // Loaded from room-constraints.json
let caseByeCaseCourses = []; // Courses handled individually, not in grid

// Room configuration - organized by campus
const CATALYST_ROOMS = ['206', '207', '209', '210', '212'];
const CHENEY_ROOMS = ['CEB 102', 'CEB 104'];
const ROOMS = [...CATALYST_ROOMS, ...CHENEY_ROOMS];
const ROOM_NAMES = {
    '206': '206 UX Lab',
    '207': '207 Media Lab',
    '209': '209 Mac Lab',
    '210': '210 Mac Lab',
    '212': '212 Project Lab',
    'CEB 102': 'CEB 102',
    'CEB 104': 'CEB 104'
};
const TIMES = ['10:00-12:00', '13:00-15:00', '16:00-18:00'];
const DAYS = ['MW', 'TR'];

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Initializing Schedule Builder...');

    try {
        // Load room constraints
        const constraintsResponse = await fetch('../data/room-constraints.json');
        if (constraintsResponse.ok) {
            roomConstraints = await constraintsResponse.json();
            console.log('Room constraints loaded:', roomConstraints);
        }

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

        console.log('Schedule Builder modules initialized');
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
    document.getElementById('projectedDemandSection').style.display = 'none';
    document.getElementById('actionBar').style.display = 'none';

    try {
        const schedule = await ScheduleGenerator.generateSchedule(quarter, year);
        currentSchedule = schedule;

        // Reset assigned courses and case-by-case
        assignedCourses = {};
        caseByeCaseCourses = [];

        // Separate case-by-case courses from grid courses
        const gridCourses = filterCaseByeCaseCourses(schedule.recommendations, quarter);

        // Auto-assign courses to time slots with room constraints
        autoAssignToGrid(gridCourses, quarter);

        // Hide loading, show content
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('projectedDemandSection').style.display = 'block';
        document.getElementById('builderContent').style.display = 'grid';
        document.getElementById('actionBar').style.display = 'flex';

        // Update titles
        document.getElementById('gridTitle').textContent = `Schedule Grid - ${quarter} ${year}`;
        document.getElementById('demandQuarterYear').textContent = `${quarter} ${year}`;

        // Render all components
        renderSummaryCards(schedule.summary);
        renderProjectedDemand(schedule.recommendations, quarter);
        renderScheduleGrid();
        renderUnassignedList();
        renderFacultySummary();

        showToast(`Generated ${schedule.summary.totalSections} sections for ${quarter} ${year}`);

    } catch (error) {
        console.error('Generation error:', error);
        document.getElementById('loadingContainer').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        showToast('Error generating schedule: ' + error.message, 'error');
    }
}

/**
 * Filter out case-by-case courses (not scheduled in grid)
 */
function filterCaseByeCaseCourses(recommendations, quarter) {
    const caseByeCaseList = roomConstraints?.caseByCase?.courses || ['DESN 495', 'DESN 491', 'DESN 499', 'DESN 399'];

    const gridCourses = [];
    recommendations.forEach(rec => {
        if (caseByeCaseList.includes(rec.courseCode)) {
            caseByeCaseCourses.push({
                ...rec,
                description: roomConstraints?.caseByCase?.descriptions?.[rec.courseCode] || 'Individual basis'
            });
        } else {
            gridCourses.push(rec);
        }
    });

    return gridCourses;
}

/**
 * Get valid rooms for a course based on constraints
 */
function getValidRooms(courseCode, quarter) {
    if (!roomConstraints) return ROOMS;

    const rules = roomConstraints.courseRoomRules;

    // Cheney-only courses (freshman/sophomore)
    if (rules?.cheneyOnly?.courses?.includes(courseCode)) {
        return rules.cheneyOnly.validRooms || CHENEY_ROOMS;
    }

    // DESN 359: Winter at Catalyst, otherwise Cheney
    if (rules?.specialRules?.[courseCode]) {
        const specialRule = rules.specialRules[courseCode];
        if (specialRule[quarter]) {
            return specialRule[quarter];
        }
        return specialRule.default || ROOMS;
    }

    // Media Lab courses
    if (rules?.mediaLab?.courses?.includes(courseCode)) {
        return rules.mediaLab.validRooms || ['207'];
    }

    // Project Lab courses
    if (rules?.projectLab?.courses?.includes(courseCode)) {
        return rules.projectLab.validRooms || ['212'];
    }

    // All other upper-division: any Catalyst room
    return CATALYST_ROOMS;
}

/**
 * Auto-assign courses to grid slots with room constraints
 */
function autoAssignToGrid(recommendations, quarter) {
    // Sort by priority (high first) then by level
    const sorted = [...recommendations].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return (a.level || '300').localeCompare(b.level || '300');
    });

    // Track room usage per time slot
    const slotUsage = {};

    sorted.forEach(rec => {
        // Get valid rooms for this course
        const validRooms = getValidRooms(rec.courseCode, quarter);

        for (let s = 0; s < rec.sectionsNeeded; s++) {
            const faculty = rec.assignedFaculty[s] || { name: 'TBD', section: String(s + 1).padStart(3, '0') };

            // Find an available slot
            let assigned = false;

            // Try to find the least used slot in valid rooms only
            for (const day of DAYS) {
                if (assigned) break;
                for (const time of TIMES) {
                    if (assigned) break;
                    for (const room of validRooms) {
                        const key = `${day}-${time}-${room}`;
                        if (!slotUsage[key]) slotUsage[key] = 0;

                        // Allow up to 1 course per cell for cleaner grid
                        if (slotUsage[key] < 1) {
                            if (!assignedCourses[key]) assignedCourses[key] = [];
                            assignedCourses[key].push({
                                ...rec,
                                section: faculty.section,
                                facultyName: faculty.name,
                                day: day,
                                time: time,
                                room: room
                            });
                            slotUsage[key]++;
                            assigned = true;
                            break;
                        }
                    }
                }
            }

            // If no slot found in valid rooms, try any room as fallback
            if (!assigned) {
                for (const day of DAYS) {
                    if (assigned) break;
                    for (const time of TIMES) {
                        if (assigned) break;
                        for (const room of ROOMS) {
                            const key = `${day}-${time}-${room}`;
                            if (!slotUsage[key]) slotUsage[key] = 0;
                            if (slotUsage[key] < 1) {
                                if (!assignedCourses[key]) assignedCourses[key] = [];
                                assignedCourses[key].push({
                                    ...rec,
                                    section: faculty.section,
                                    facultyName: faculty.name,
                                    day: day,
                                    time: time,
                                    room: room,
                                    roomConflict: true // Flag that this is outside preferred room
                                });
                                slotUsage[key]++;
                                assigned = true;
                                break;
                            }
                        }
                    }
                }
            }

            // If still no slot found, mark as unassigned
            if (!assigned) {
                const unassignedKey = 'unassigned';
                if (!assignedCourses[unassignedKey]) assignedCourses[unassignedKey] = [];
                assignedCourses[unassignedKey].push({
                    ...rec,
                    section: faculty.section,
                    facultyName: faculty.name
                });
            }
        }
    });
}

/**
 * Render projected demand section
 */
function renderProjectedDemand(recommendations, quarter) {
    // High demand courses (>90% capacity or high priority)
    const highDemandList = document.getElementById('highDemandList');
    const highDemand = recommendations.filter(r => r.priority === 'high' || r.predictedDemand > 20);

    if (highDemand.length === 0) {
        highDemandList.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 12px;">No high demand courses</p>';
    } else {
        highDemandList.innerHTML = highDemand.map(course => `
            <div class="demand-item">
                <div>
                    <span class="course-code">${course.courseCode}</span>
                    <span class="course-info">${course.courseTitle}</span>
                </div>
                <span class="sections-badge">${course.sectionsNeeded} section${course.sectionsNeeded > 1 ? 's' : ''}</span>
            </div>
        `).join('');
    }

    // Case-by-case courses
    const caseByeCaseList = document.getElementById('caseByeCaseList');
    if (caseByeCaseCourses.length === 0) {
        caseByeCaseList.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 12px;">No case-by-case courses</p>';
    } else {
        caseByeCaseList.innerHTML = caseByeCaseCourses.map(course => `
            <div class="demand-item case-by-case-item">
                <div>
                    <span class="course-code">${course.courseCode}</span>
                    <span class="course-info">${course.description}</span>
                </div>
                <span class="sections-badge">~${course.predictedDemand || '?'} students</span>
            </div>
        `).join('');
    }

    // Curriculum recommendations
    const recommendationsList = document.getElementById('curriculumRecommendations');
    const curriculumFlags = roomConstraints?.curriculumFlags || {};
    const flaggedCourses = Object.entries(curriculumFlags);

    let recsHtml = '';

    // Add curriculum flags
    flaggedCourses.forEach(([courseCode, info]) => {
        recsHtml += `
            <div class="recommendation-item">
                <div class="rec-title">⚠️ ${courseCode}: ${info.recommendation}</div>
                <div class="rec-description">${info.reason}</div>
                ${info.impact ? `<div class="rec-impact">${info.impact}</div>` : ''}
            </div>
        `;
    });

    // Add capacity recommendations
    const overloadedCourses = recommendations.filter(r => r.sectionsNeeded > 2);
    overloadedCourses.forEach(course => {
        recsHtml += `
            <div class="recommendation-item">
                <div class="rec-title">📈 ${course.courseCode}: High demand</div>
                <div class="rec-description">${course.predictedDemand} students predicted - ${course.sectionsNeeded} sections needed</div>
                <div class="rec-impact">Consider adding adjunct capacity</div>
            </div>
        `;
    });

    if (recsHtml === '') {
        recsHtml = '<p style="color: #6b7280; text-align: center; padding: 12px;">No recommendations at this time</p>';
    }

    recommendationsList.innerHTML = recsHtml;
}

/**
 * Render the schedule grid with campus headers
 */
function renderScheduleGrid() {
    const grid = document.getElementById('scheduleGrid');
    grid.innerHTML = '';

    // Update grid columns for campus structure
    const totalColumns = 1 + CATALYST_ROOMS.length + CHENEY_ROOMS.length;
    grid.style.gridTemplateColumns = `100px repeat(${CATALYST_ROOMS.length}, 1fr) repeat(${CHENEY_ROOMS.length}, 1fr)`;

    // Campus header row
    const emptyCorner = document.createElement('div');
    emptyCorner.className = 'grid-header';
    emptyCorner.textContent = '';
    grid.appendChild(emptyCorner);

    // Catalyst campus header (spans Catalyst rooms)
    const catalystHeader = document.createElement('div');
    catalystHeader.className = 'campus-header';
    catalystHeader.style.gridColumn = `span ${CATALYST_ROOMS.length}`;
    catalystHeader.textContent = 'Catalyst (Spokane)';
    grid.appendChild(catalystHeader);

    // Cheney campus header (spans Cheney rooms)
    const cheneyHeader = document.createElement('div');
    cheneyHeader.className = 'campus-header cheney';
    cheneyHeader.style.gridColumn = `span ${CHENEY_ROOMS.length}`;
    cheneyHeader.textContent = 'Cheney (Main)';
    grid.appendChild(cheneyHeader);

    // Room header row
    const timeHeader = document.createElement('div');
    timeHeader.className = 'grid-header';
    timeHeader.textContent = 'Time';
    grid.appendChild(timeHeader);

    // Catalyst room headers
    CATALYST_ROOMS.forEach(room => {
        const header = document.createElement('div');
        header.className = 'grid-header';
        header.innerHTML = `${room}<span class="room-type-badge">${getRoomType(room)}</span>`;
        grid.appendChild(header);
    });

    // Cheney room headers
    CHENEY_ROOMS.forEach(room => {
        const header = document.createElement('div');
        header.className = 'grid-header';
        header.innerHTML = `${room}<span class="room-type-badge">${getRoomType(room)}</span>`;
        grid.appendChild(header);
    });

    // Rows for each day/time combination
    DAYS.forEach((day, dayIndex) => {
        // Day divider
        const divider = document.createElement('div');
        divider.className = 'day-divider ' + (dayIndex === 0 ? 'mw' : 'tr');
        grid.appendChild(divider);

        TIMES.forEach(time => {
            // Time slot label
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot';
            timeSlot.innerHTML = `<span>${day}</span><span>${time}</span>`;
            grid.appendChild(timeSlot);

            // Catalyst room cells first
            CATALYST_ROOMS.forEach(room => {
                const cell = createGridCell(day, time, room);
                grid.appendChild(cell);
            });

            // Then Cheney room cells
            CHENEY_ROOMS.forEach(room => {
                const cell = createGridCell(day, time, room);
                grid.appendChild(cell);
            });
        });
    });
}

/**
 * Create a grid cell for a specific day/time/room
 */
function createGridCell(day, time, room) {
    const key = `${day}-${time}-${room}`;
    const courses = assignedCourses[key] || [];

    const cell = document.createElement('div');
    cell.className = 'schedule-cell drop-zone';
    cell.dataset.day = day;
    cell.dataset.time = time;
    cell.dataset.room = room;

    // Add drag-and-drop handlers
    cell.ondragover = (e) => {
        e.preventDefault();
        cell.classList.add('drag-over');
    };
    cell.ondragleave = () => cell.classList.remove('drag-over');
    cell.ondrop = (e) => handleDrop(e, day, time, room);

    courses.forEach(course => {
        const block = createCourseBlock(course);
        cell.appendChild(block);
    });

    return cell;
}

/**
 * Get room type description
 */
function getRoomType(roomId) {
    if (!roomConstraints) {
        const types = {
            '206': 'UX Lab',
            '207': 'Media Lab',
            '209': 'Mac Lab',
            '210': 'Mac Lab',
            '212': 'Project Lab',
            'CEB 102': 'Computer',
            'CEB 104': 'Classroom'
        };
        return types[roomId] || '';
    }

    // Look up from constraints
    const allRooms = [
        ...(roomConstraints.campuses?.catalyst?.rooms || []),
        ...(roomConstraints.campuses?.cheney?.rooms || [])
    ];
    const room = allRooms.find(r => r.id === roomId);
    if (room) {
        return room.type?.replace('-', ' ') || '';
    }
    return '';
}

/**
 * Create a course block element
 */
function createCourseBlock(course) {
    const block = document.createElement('div');
    block.className = `course-block priority-${course.priority}`;
    block.draggable = true;
    block.dataset.courseCode = course.courseCode;
    block.dataset.section = course.section;

    block.innerHTML = `
        <div class="course-code">
            ${course.courseCode}-${course.section}
            <span class="demand-badge">${course.predictedDemand} pred</span>
        </div>
        <div class="course-info">${course.courseTitle}</div>
        <div class="course-faculty">${course.facultyName}</div>
    `;

    // Drag handlers
    block.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({
            courseCode: course.courseCode,
            section: course.section,
            fromDay: course.day,
            fromTime: course.time,
            fromRoom: course.room
        }));
        block.classList.add('dragging');
    };
    block.ondragend = () => block.classList.remove('dragging');

    // Click to show details
    block.onclick = () => showCourseDetails(course);

    return block;
}

/**
 * Handle drop on grid cell
 */
function handleDrop(e, toDay, toTime, toRoom) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        const fromKey = data.fromDay ? `${data.fromDay}-${data.fromTime}-${data.fromRoom}` : 'unassigned';
        const toKey = `${toDay}-${toTime}-${toRoom}`;

        if (fromKey === toKey) return;

        // Find and remove from old location
        let movedCourse = null;
        if (assignedCourses[fromKey]) {
            const idx = assignedCourses[fromKey].findIndex(
                c => c.courseCode === data.courseCode && c.section === data.section
            );
            if (idx > -1) {
                movedCourse = assignedCourses[fromKey].splice(idx, 1)[0];
            }
        }

        if (movedCourse) {
            // Update course location
            movedCourse.day = toDay;
            movedCourse.time = toTime;
            movedCourse.room = toRoom;

            // Add to new location
            if (!assignedCourses[toKey]) assignedCourses[toKey] = [];
            assignedCourses[toKey].push(movedCourse);

            // Re-render
            renderScheduleGrid();
            renderUnassignedList();

            showToast(`Moved ${data.courseCode}-${data.section} to ${toDay} ${toTime}`);
        }
    } catch (err) {
        console.error('Drop error:', err);
    }
}

/**
 * Render unassigned courses in sidebar
 */
function renderUnassignedList() {
    const container = document.getElementById('unassignedList');
    const unassigned = assignedCourses['unassigned'] || [];

    if (unassigned.length === 0) {
        container.innerHTML = '<p style="color: #10b981; text-align: center; padding: 20px;">All courses assigned!</p>';
        return;
    }

    let html = '';
    unassigned.forEach(course => {
        html += `
            <div class="unassigned-item" draggable="true"
                 ondragstart="handleUnassignedDrag(event, '${course.courseCode}', '${course.section}')"
                 data-course="${course.courseCode}" data-section="${course.section}">
                <div class="course-code">
                    ${course.courseCode}-${course.section}
                    <span class="sections-badge">${course.credits} cr</span>
                </div>
                <div class="course-title">${course.courseTitle}</div>
                <div style="font-size: 0.75em; color: #6b7280; margin-top: 4px;">
                    ${course.facultyName} | ${course.predictedDemand} predicted
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Handle drag from unassigned list
 */
function handleUnassignedDrag(e, courseCode, section) {
    e.dataTransfer.setData('text/plain', JSON.stringify({
        courseCode: courseCode,
        section: section,
        fromDay: null,
        fromTime: null,
        fromRoom: null
    }));
}

/**
 * Render faculty summary in sidebar
 */
function renderFacultySummary() {
    const container = document.getElementById('facultySummary');

    if (!currentSchedule) {
        container.innerHTML = '<p style="color: #6b7280;">No schedule generated</p>';
        return;
    }

    // Calculate faculty loads from assigned courses
    const facultyLoads = {};
    Object.values(assignedCourses).forEach(courses => {
        courses.forEach(course => {
            const name = course.facultyName || 'TBD';
            if (!facultyLoads[name]) facultyLoads[name] = 0;
            facultyLoads[name] += course.credits || 5;
        });
    });

    // Sort by load descending
    const sorted = Object.entries(facultyLoads)
        .filter(([name]) => name !== 'TBD')
        .sort((a, b) => b[1] - a[1]);

    let html = '';
    sorted.forEach(([name, credits]) => {
        const isOverload = credits > 15; // Simple threshold
        html += `
            <div class="faculty-row">
                <span class="faculty-name">${name}</span>
                <span class="faculty-load ${isOverload ? 'overload' : ''}">${credits} cr</span>
            </div>
        `;
    });

    // Show TBD at the end
    if (facultyLoads['TBD']) {
        html += `
            <div class="faculty-row">
                <span class="faculty-name" style="color: #ef4444;">TBD (Unassigned)</span>
                <span class="faculty-load">${facultyLoads['TBD']} cr</span>
            </div>
        `;
    }

    container.innerHTML = html || '<p style="color: #6b7280;">No faculty assignments</p>';
}

/**
 * Show course details in alert (could be modal later)
 */
function showCourseDetails(course) {
    alert(`
${course.courseCode} - ${course.courseTitle}
Section: ${course.section}
Faculty: ${course.facultyName}
Credits: ${course.credits}
Predicted Demand: ${course.predictedDemand}
Priority: ${course.priority}
Location: ${course.day} ${course.time} - Room ${course.room}
    `.trim());
}

/**
 * Render summary cards
 */
function renderSummaryCards(summary) {
    document.getElementById('totalSections').textContent = summary.totalSections;
    document.getElementById('facultyCapacity').textContent = `${summary.assignedSections}/${summary.totalSections}`;
    document.getElementById('highDemand').textContent = summary.highDemandCourses;
    document.getElementById('warnings').textContent = summary.warningCount;
}

/**
 * Toggle between grid and list view
 */
function setView(view) {
    currentView = view;

    document.getElementById('gridViewBtn').classList.toggle('active', view === 'grid');
    document.getElementById('listViewBtn').classList.toggle('active', view === 'list');

    document.getElementById('scheduleGrid').style.display = view === 'grid' ? 'grid' : 'none';
    document.getElementById('listView').style.display = view === 'list' ? 'block' : 'none';

    if (view === 'list') {
        renderListView();
    }
}

/**
 * Render list view
 */
function renderListView() {
    const container = document.getElementById('recommendationsList');

    if (!currentSchedule) {
        container.innerHTML = '<p>No schedule generated</p>';
        return;
    }

    let html = '';
    currentSchedule.recommendations.forEach(rec => {
        html += `
            <div class="recommendation-card priority-${rec.priority}">
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
                        <div class="metric-label">Predicted</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${rec.sectionsNeeded}</div>
                        <div class="metric-label">Sections</div>
                    </div>
                    <div class="metric">
                        <div class="metric-value">${rec.utilization}%</div>
                        <div class="metric-label">Utilization</div>
                    </div>
                </div>
                <div class="rec-faculty">
                    <strong>Faculty:</strong> ${rec.assignedFaculty.map(f => f.name).join(', ')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

/**
 * Save draft to localStorage
 */
function saveDraft() {
    if (!currentSchedule) {
        showToast('No schedule to save', 'error');
        return;
    }

    const draft = {
        schedule: currentSchedule,
        assignedCourses: assignedCourses,
        caseByeCaseCourses: caseByeCaseCourses
    };

    localStorage.setItem('scheduleBuilderDraft', JSON.stringify(draft));
    showToast('Draft saved successfully');
}

/**
 * Load draft from localStorage
 */
function loadDraft() {
    const draft = localStorage.getItem('scheduleBuilderDraft');
    if (!draft) return;

    try {
        const data = JSON.parse(draft);
        currentSchedule = data.schedule;
        assignedCourses = data.assignedCourses || {};
        caseByeCaseCourses = data.caseByeCaseCourses || [];

        document.getElementById('academicYear').value = currentSchedule.year;
        document.getElementById('targetQuarter').value = currentSchedule.quarter;

        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('projectedDemandSection').style.display = 'block';
        document.getElementById('builderContent').style.display = 'grid';
        document.getElementById('actionBar').style.display = 'flex';

        document.getElementById('gridTitle').textContent = `Schedule Grid - ${currentSchedule.quarter} ${currentSchedule.year}`;
        document.getElementById('demandQuarterYear').textContent = `${currentSchedule.quarter} ${currentSchedule.year}`;

        renderSummaryCards(currentSchedule.summary);
        renderProjectedDemand(currentSchedule.recommendations, currentSchedule.quarter);
        renderScheduleGrid();
        renderUnassignedList();
        renderFacultySummary();

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

    const exported = {
        academicYear: currentSchedule.year,
        quarter: currentSchedule.quarter,
        generatedAt: new Date().toISOString(),
        courses: []
    };

    // Flatten assigned courses
    Object.entries(assignedCourses).forEach(([key, courses]) => {
        if (key === 'unassigned') return;
        const [day, time, room] = key.split('-');
        courses.forEach(course => {
            exported.courses.push({
                courseCode: course.courseCode,
                courseTitle: course.courseTitle,
                section: course.section,
                credits: course.credits,
                faculty: course.facultyName,
                day: day,
                time: time,
                room: room,
                predictedEnrollment: course.predictedDemand
            });
        });
    });

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

    const exported = {
        academicYear: currentSchedule.year,
        quarter: currentSchedule.quarter,
        courses: []
    };

    Object.entries(assignedCourses).forEach(([key, courses]) => {
        if (key === 'unassigned') return;
        const [day, time, room] = key.split('-');
        courses.forEach(course => {
            exported.courses.push({
                courseCode: course.courseCode,
                section: course.section,
                faculty: course.facultyName,
                day: day,
                time: time,
                room: room
            });
        });
    });

    localStorage.setItem('importedSchedule', JSON.stringify(exported));
    showToast('Exporting to Schedule Editor...');

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
