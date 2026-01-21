/**
 * Faculty Manager Module
 * Manages faculty selection and availability for schedule building
 * Prioritizes: Full-time Faculty (Professors, Lecturers, Senior Lecturers) over Adjuncts
 */

const FacultyManager = (function() {
    'use strict';

    const FACULTY_RANKS = {
        'Full Professor': { priority: 1, type: 'full-time', maxCredits: 36 },
        'Associate Professor': { priority: 2, type: 'full-time', maxCredits: 36 },
        'Assistant Professor': { priority: 3, type: 'full-time', maxCredits: 36 },
        'Senior Lecturer': { priority: 4, type: 'full-time', maxCredits: 45 },
        'Lecturer': { priority: 5, type: 'full-time', maxCredits: 45 },
        'Adjunct': { priority: 10, type: 'adjunct', maxCredits: 15 }
    };

    const FACULTY_COLORS = {
        'T.Masingale': '#667eea',
        'M.Lybbert': '#e74c3c',
        'G.Hustrulid': '#f39c12',
        'C.Manikoth': '#27ae60',
        'S.Durr': '#e67e22',
        'S.Mills': '#9b59b6',
        'A.Sopu': '#3498db',
        'S.Allison': '#1abc9c',
        'Adjunct': '#7f8c8d'
    };

    let allFaculty = [];
    let selectedFaculty = new Set();
    let facultyByRank = {};
    let initialized = false;

    const STORAGE_KEY = 'faculty_selections';

    /**
     * Initialize with faculty data
     */
    async function init(options = {}) {
        try {
            const workloadPath = options.workloadPath || 'workload-data.json';
            const response = await fetch(workloadPath);
            if (!response.ok) throw new Error('Failed to load workload data');
            
            const data = await response.json();
            allFaculty = extractFacultyFromWorkload(data);
            organizeFacultyByRank();
            loadSelections();
            initialized = true;
            console.log(`✅ FacultyManager initialized with ${allFaculty.length} faculty members`);
            return true;
        } catch (error) {
            console.error('FacultyManager init error:', error);
            return false;
        }
    }

    /**
     * Extract faculty info from workload data
     */
    function extractFacultyFromWorkload(workloadData) {
        const faculty = [];
        const seen = new Set();

        if (workloadData.facultyWorkload) {
            Object.entries(workloadData.facultyWorkload).forEach(([name, data]) => {
                if (seen.has(name)) return;
                seen.add(name);

                const rank = inferRank(name, data);
                const shortName = getShortName(name);
                
                faculty.push({
                    name: name,
                    shortName: shortName,
                    rank: rank,
                    rankInfo: FACULTY_RANKS[rank] || FACULTY_RANKS['Adjunct'],
                    color: FACULTY_COLORS[shortName] || FACULTY_COLORS['Adjunct'] || '#7f8c8d',
                    totalCredits: data.totalCredits || 0,
                    sections: data.sections || 0,
                    courses: data.courses || [],
                    specializations: inferSpecializations(data.courses || [])
                });
            });
        }

        return faculty.sort((a, b) => a.rankInfo.priority - b.rankInfo.priority);
    }

    /**
     * Infer faculty rank from name patterns and workload
     */
    function inferRank(name, data) {
        const nameLower = name.toLowerCase();
        
        if (nameLower.includes('masingale') || nameLower.includes('lybbert') || nameLower.includes('hustrulid')) {
            return 'Full Professor';
        }
        if (nameLower.includes('manikoth')) {
            return 'Assistant Professor';
        }
        if (nameLower.includes('durr') || nameLower.includes('mills')) {
            return 'Senior Lecturer';
        }
        if (nameLower.includes('sopu') || nameLower.includes('allison')) {
            return 'Lecturer';
        }
        
        if (data.sections <= 3 || data.totalCredits <= 15) {
            return 'Adjunct';
        }
        
        return 'Lecturer';
    }

    /**
     * Get short name for faculty
     */
    function getShortName(fullName) {
        const parts = fullName.split(' ');
        if (parts.length >= 2) {
            return `${parts[0].charAt(0)}.${parts[parts.length - 1]}`;
        }
        return fullName;
    }

    /**
     * Infer specializations from courses taught
     */
    function inferSpecializations(courses) {
        const specs = new Set();
        courses.forEach(c => {
            const code = c.courseCode || '';
            if (code.includes('368') || code.includes('378') || code.includes('468') || code.includes('374')) {
                specs.add('Code + Design');
            }
            if (code.includes('338') || code.includes('348') || code.includes('458')) {
                specs.add('UX Design');
            }
            if (code.includes('326') || code.includes('355') || code.includes('365')) {
                specs.add('Animation');
            }
            if (code.includes('369') || code.includes('379')) {
                specs.add('Web Development');
            }
            if (code.includes('243')) {
                specs.add('Typography');
            }
            if (code.includes('100') || code.includes('200') || code.includes('216')) {
                specs.add('Foundation');
            }
        });
        return Array.from(specs);
    }

    /**
     * Organize faculty by rank for easy access
     */
    function organizeFacultyByRank() {
        facultyByRank = {};
        allFaculty.forEach(f => {
            if (!facultyByRank[f.rank]) {
                facultyByRank[f.rank] = [];
            }
            facultyByRank[f.rank].push(f);
        });
    }

    /**
     * Load saved selections from localStorage
     */
    function loadSelections() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                selectedFaculty = new Set(JSON.parse(saved));
            } else {
                selectAllFullTime();
            }
        } catch (e) {
            selectAllFullTime();
        }
    }

    /**
     * Save selections to localStorage
     */
    function saveSelections() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(selectedFaculty)));
    }

    /**
     * Select all full-time faculty by default
     */
    function selectAllFullTime() {
        selectedFaculty.clear();
        allFaculty.forEach(f => {
            if (f.rankInfo.type === 'full-time') {
                selectedFaculty.add(f.name);
            }
        });
        saveSelections();
    }

    /**
     * Select all faculty
     */
    function selectAll() {
        allFaculty.forEach(f => selectedFaculty.add(f.name));
        saveSelections();
    }

    /**
     * Deselect all faculty
     */
    function deselectAll() {
        selectedFaculty.clear();
        saveSelections();
    }

    /**
     * Toggle faculty selection
     */
    function toggleFaculty(name) {
        if (selectedFaculty.has(name)) {
            selectedFaculty.delete(name);
        } else {
            selectedFaculty.add(name);
        }
        saveSelections();
    }

    /**
     * Check if faculty is selected
     */
    function isSelected(name) {
        return selectedFaculty.has(name);
    }

    /**
     * Get all faculty
     */
    function getAllFaculty() {
        return allFaculty;
    }

    /**
     * Get selected faculty (sorted by rank priority)
     */
    function getSelectedFaculty() {
        return allFaculty.filter(f => selectedFaculty.has(f.name));
    }

    /**
     * Get faculty by type
     */
    function getFacultyByType(type) {
        return allFaculty.filter(f => f.rankInfo.type === type);
    }

    /**
     * Get full-time faculty only
     */
    function getFullTimeFaculty() {
        return getFacultyByType('full-time');
    }

    /**
     * Get adjunct faculty only
     */
    function getAdjunctFaculty() {
        return getFacultyByType('adjunct');
    }

    /**
     * Get faculty grouped by rank
     */
    function getFacultyByRank() {
        return facultyByRank;
    }

    /**
     * Get faculty info by name
     */
    function getFacultyInfo(name) {
        return allFaculty.find(f => 
            f.name === name || 
            f.shortName === name ||
            f.name.toLowerCase().includes(name.toLowerCase())
        );
    }

    /**
     * Get best available faculty for a course based on history and availability
     */
    function getBestFacultyForCourse(courseCode, previousInstructor = null) {
        const selected = getSelectedFaculty();
        
        if (previousInstructor && selectedFaculty.has(previousInstructor)) {
            return previousInstructor;
        }
        
        const fullTime = selected.filter(f => f.rankInfo.type === 'full-time');
        for (const faculty of fullTime) {
            if (faculty.courses.some(c => c.courseCode === courseCode)) {
                return faculty.name;
            }
        }
        
        const adjuncts = selected.filter(f => f.rankInfo.type === 'adjunct');
        for (const adjunct of adjuncts) {
            if (adjunct.courses.some(c => c.courseCode === courseCode)) {
                return adjunct.name;
            }
        }
        
        return 'TBD';
    }

    /**
     * Render faculty selection UI
     */
    function renderSelectionUI(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const rankOrder = ['Full Professor', 'Associate Professor', 'Assistant Professor', 'Senior Lecturer', 'Lecturer', 'Adjunct'];
        
        let html = `
            <div class="faculty-selection-header">
                <h3>Faculty for Next Year</h3>
                <div class="faculty-actions">
                    <button class="btn-small" onclick="FacultyManager.selectAllFullTime(); FacultyManager.renderSelectionUI('${containerId}');">
                        Select Full-Time
                    </button>
                    <button class="btn-small" onclick="FacultyManager.selectAll(); FacultyManager.renderSelectionUI('${containerId}');">
                        Select All
                    </button>
                    <button class="btn-small" onclick="FacultyManager.deselectAll(); FacultyManager.renderSelectionUI('${containerId}');">
                        Clear
                    </button>
                </div>
            </div>
            <div class="faculty-selection-grid">
        `;

        rankOrder.forEach(rank => {
            const facultyInRank = facultyByRank[rank] || [];
            if (facultyInRank.length === 0) return;

            const rankInfo = FACULTY_RANKS[rank];
            const typeClass = rankInfo.type === 'adjunct' ? 'adjunct-group' : 'fulltime-group';

            html += `
                <div class="faculty-rank-group ${typeClass}">
                    <div class="rank-header">
                        <span class="rank-title">${rank}</span>
                        <span class="rank-type-badge ${rankInfo.type}">${rankInfo.type === 'adjunct' ? 'Placeholder' : 'Primary'}</span>
                    </div>
                    <div class="faculty-list">
            `;

            facultyInRank.forEach(f => {
                const isChecked = selectedFaculty.has(f.name);
                const specs = f.specializations.slice(0, 2).join(', ') || 'General';
                
                html += `
                    <label class="faculty-item ${isChecked ? 'selected' : ''}">
                        <input type="checkbox" 
                            ${isChecked ? 'checked' : ''} 
                            onchange="FacultyManager.toggleFaculty('${f.name}'); this.closest('.faculty-item').classList.toggle('selected');">
                        <span class="faculty-color" style="background-color: ${f.color};"></span>
                        <div class="faculty-info">
                            <span class="faculty-name">${f.shortName}</span>
                            <span class="faculty-specs">${specs}</span>
                        </div>
                        <span class="faculty-sections">${f.sections} sections</span>
                    </label>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        
        const selectedCount = selectedFaculty.size;
        const fullTimeCount = getSelectedFaculty().filter(f => f.rankInfo.type === 'full-time').length;
        const adjunctCount = selectedCount - fullTimeCount;

        html += `
            <div class="faculty-selection-summary">
                <span><strong>${selectedCount}</strong> faculty selected</span>
                <span class="summary-detail">(${fullTimeCount} full-time, ${adjunctCount} adjunct)</span>
            </div>
        `;

        container.innerHTML = html;
    }

    return {
        init,
        getAllFaculty,
        getSelectedFaculty,
        getFacultyByType,
        getFullTimeFaculty,
        getAdjunctFaculty,
        getFacultyByRank,
        getFacultyInfo,
        getBestFacultyForCourse,
        toggleFaculty,
        isSelected,
        selectAll,
        deselectAll,
        selectAllFullTime,
        renderSelectionUI,
        FACULTY_RANKS
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FacultyManager;
}
