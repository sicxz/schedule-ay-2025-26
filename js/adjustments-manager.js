/**
 * EWU Design Schedule Analyzer - Adjustments Manager
 * Manages manual release time and applied learning adjustments
 */

class ReleaseTimeAdjustmentsManager {
    constructor() {
        this.storageKey = 'ewu-release-time-adjustments';
        this.fileUrl = '../data/release-time-adjustments.json';
        this.adjustments = null;
        this.isLoaded = false;
    }

    /**
     * Get default empty structure
     */
    getDefaultStructure() {
        return {
            version: '1.0',
            lastModified: new Date().toISOString(),
            description: 'Manual adjustments for faculty release time and applied learning projections',
            academicYears: {},
            releaseTimeCategories: [
                { id: 'advising', label: 'Advising', color: '#3b82f6', description: 'Academic advising and student support' },
                { id: 'committee', label: 'Committee Work', color: '#8b5cf6', description: 'Faculty senate, search committees, etc.' },
                { id: 'faculty_org', label: 'Faculty Organization', color: '#ec4899', description: 'Faculty organization leadership' },
                { id: 'chair', label: 'Chair Duties', color: '#f59e0b', description: 'Department chair responsibilities' },
                { id: 'sabbatical', label: 'Sabbatical', color: '#10b981', description: 'Full or partial sabbatical leave' },
                { id: 'research', label: 'Research', color: '#06b6d4', description: 'Research projects and grants' },
                { id: 'other', label: 'Other', color: '#6b7280', description: 'Other release time' }
            ],
            appliedLearningMultipliers: {
                'DESN 499': 0.2,
                'DESN 495': 0.1,
                'DESN 490': 0.15
            }
        };
    }

    /**
     * Load adjustments from localStorage or JSON file
     * Priority: localStorage > JSON file > default
     */
    async load() {
        console.log('📋 Loading release time adjustments...');

        // Try localStorage first
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                this.adjustments = JSON.parse(stored);
                this.isLoaded = true;
                console.log('✅ Loaded adjustments from localStorage');
                return this.adjustments;
            } catch (error) {
                console.warn('⚠️ Failed to parse localStorage data:', error);
            }
        }

        // Try loading from JSON file
        try {
            const response = await fetch(this.fileUrl);
            if (response.ok) {
                this.adjustments = await response.json();
                this.isLoaded = true;
                console.log('✅ Loaded adjustments from JSON file');
                // Save to localStorage for faster future loads
                this.saveToLocalStorage();
                return this.adjustments;
            }
        } catch (error) {
            console.warn('⚠️ Failed to load adjustments file:', error);
        }

        // Fall back to default structure
        console.log('📝 Using default adjustments structure');
        this.adjustments = this.getDefaultStructure();
        this.isLoaded = true;
        return this.adjustments;
    }

    /**
     * Save adjustments to localStorage
     */
    saveToLocalStorage() {
        try {
            this.adjustments.lastModified = new Date().toISOString();
            localStorage.setItem(this.storageKey, JSON.stringify(this.adjustments));
            console.log('💾 Saved adjustments to localStorage');
            this.dispatchChangeEvent();
            return true;
        } catch (error) {
            console.error('❌ Failed to save to localStorage:', error);
            return false;
        }
    }

    /**
     * Get adjustments for a specific academic year
     */
    getYearAdjustments(year) {
        if (!this.adjustments || !this.adjustments.academicYears) {
            return { releaseTime: {}, appliedLearningOverrides: {} };
        }

        return this.adjustments.academicYears[year] || { releaseTime: {}, appliedLearningOverrides: {} };
    }

    /**
     * Get release time for a specific faculty member in a year
     */
    getFacultyReleaseTime(year, facultyName) {
        const yearData = this.getYearAdjustments(year);
        return yearData.releaseTime[facultyName] || null;
    }

    /**
     * Get applied learning override for a faculty member
     */
    getFacultyAppliedLearningOverride(year, facultyName) {
        const yearData = this.getYearAdjustments(year);
        return yearData.appliedLearningOverrides[facultyName] || null;
    }

    /**
     * Add release time category for faculty
     */
    addReleaseTime(year, facultyName, category) {
        this.ensureYearStructure(year);

        if (!this.adjustments.academicYears[year].releaseTime[facultyName]) {
            this.adjustments.academicYears[year].releaseTime[facultyName] = {
                totalCredits: 0,
                categories: []
            };
        }

        // Validate category
        const validationResult = this.validateReleaseTimeCategory(category);
        if (!validationResult.valid) {
            console.error('❌ Invalid release time category:', validationResult.errors);
            return { success: false, errors: validationResult.errors };
        }

        this.adjustments.academicYears[year].releaseTime[facultyName].categories.push(category);
        this.recalculateReleaseTimeTotal(year, facultyName);
        this.saveToLocalStorage();

        return { success: true };
    }

    /**
     * Update release time category
     */
    updateReleaseTime(year, facultyName, categoryIndex, updatedCategory) {
        const facultyReleaseTime = this.getFacultyReleaseTime(year, facultyName);
        if (!facultyReleaseTime || !facultyReleaseTime.categories[categoryIndex]) {
            return { success: false, errors: ['Category not found'] };
        }

        const validationResult = this.validateReleaseTimeCategory(updatedCategory);
        if (!validationResult.valid) {
            return { success: false, errors: validationResult.errors };
        }

        facultyReleaseTime.categories[categoryIndex] = updatedCategory;
        this.recalculateReleaseTimeTotal(year, facultyName);
        this.saveToLocalStorage();

        return { success: true };
    }

    /**
     * Remove release time category
     */
    removeReleaseTime(year, facultyName, categoryIndex) {
        const facultyReleaseTime = this.getFacultyReleaseTime(year, facultyName);
        if (!facultyReleaseTime) {
            return { success: false, errors: ['Faculty not found'] };
        }

        facultyReleaseTime.categories.splice(categoryIndex, 1);
        this.recalculateReleaseTimeTotal(year, facultyName);
        this.saveToLocalStorage();

        return { success: true };
    }

    /**
     * Set applied learning override for faculty
     */
    setAppliedLearningOverride(year, facultyName, courseCode, quarterData) {
        this.ensureYearStructure(year);

        if (!this.adjustments.academicYears[year].appliedLearningOverrides[facultyName]) {
            this.adjustments.academicYears[year].appliedLearningOverrides[facultyName] = {};
        }

        if (!this.adjustments.academicYears[year].appliedLearningOverrides[facultyName][courseCode]) {
            this.adjustments.academicYears[year].appliedLearningOverrides[facultyName][courseCode] = {
                projected: {},
                notes: ''
            };
        }

        this.adjustments.academicYears[year].appliedLearningOverrides[facultyName][courseCode].projected = quarterData;
        this.saveToLocalStorage();

        return { success: true };
    }

    /**
     * Calculate total applied learning workload from override
     */
    calculateAppliedLearningTotal(year, facultyName, quarter = null) {
        const override = this.getFacultyAppliedLearningOverride(year, facultyName);
        if (!override) return 0;

        let total = 0;
        Object.entries(override).forEach(([courseCode, data]) => {
            if (data.projected) {
                if (quarter) {
                    // Specific quarter
                    if (data.projected[quarter]) {
                        total += data.projected[quarter].workloadCredits || 0;
                    }
                } else {
                    // All quarters
                    Object.values(data.projected).forEach(quarterData => {
                        total += quarterData.workloadCredits || 0;
                    });
                }
            }
        });

        return total;
    }

    /**
     * Validate release time category entry
     */
    validateReleaseTimeCategory(category) {
        const errors = [];

        if (!category.type) {
            errors.push('Release time type is required');
        } else {
            const validTypes = this.adjustments.releaseTimeCategories.map(c => c.id);
            if (!validTypes.includes(category.type)) {
                errors.push(`Invalid release time type: ${category.type}`);
            }
        }

        if (category.credits === undefined || category.credits === null) {
            errors.push('Credits are required');
        } else if (category.credits < 0 || category.credits > 45) {
            errors.push('Credits must be between 0 and 45');
        }

        if (!category.quarters || !Array.isArray(category.quarters) || category.quarters.length === 0) {
            errors.push('At least one quarter must be selected');
        } else {
            const validQuarters = ['Fall', 'Winter', 'Spring', 'Summer'];
            const invalidQuarters = category.quarters.filter(q => !validQuarters.includes(q));
            if (invalidQuarters.length > 0) {
                errors.push(`Invalid quarters: ${invalidQuarters.join(', ')}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Recalculate total release time credits for a faculty member
     */
    recalculateReleaseTimeTotal(year, facultyName) {
        const facultyReleaseTime = this.getFacultyReleaseTime(year, facultyName);
        if (!facultyReleaseTime) return;

        facultyReleaseTime.totalCredits = facultyReleaseTime.categories.reduce(
            (sum, category) => sum + (category.credits || 0),
            0
        );
    }

    /**
     * Ensure year structure exists
     */
    ensureYearStructure(year) {
        if (!this.adjustments.academicYears[year]) {
            this.adjustments.academicYears[year] = {
                releaseTime: {},
                appliedLearningOverrides: {}
            };
        }
    }

    /**
     * Export adjustments as JSON file
     */
    exportToFile() {
        const blob = new Blob([JSON.stringify(this.adjustments, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `release-time-adjustments-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('📥 Exported adjustments to file');
    }

    /**
     * Import adjustments from JSON file
     */
    async importFromFile(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Basic validation
            if (!data.version || !data.academicYears) {
                throw new Error('Invalid adjustments file format');
            }

            this.adjustments = data;
            this.saveToLocalStorage();
            console.log('📤 Imported adjustments from file');
            return { success: true };
        } catch (error) {
            console.error('❌ Failed to import adjustments:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Reset adjustments to default (with confirmation)
     */
    reset() {
        this.adjustments = this.getDefaultStructure();
        localStorage.removeItem(this.storageKey);
        console.log('🔄 Reset adjustments to default');
        this.dispatchChangeEvent();
    }

    /**
     * Dispatch custom event when adjustments change
     */
    dispatchChangeEvent() {
        window.dispatchEvent(new CustomEvent('adjustments-changed', {
            detail: this.adjustments
        }));
    }

    /**
     * Get release time breakdown by category for visualization
     */
    getReleaseTimeBreakdown(year, facultyName) {
        const facultyReleaseTime = this.getFacultyReleaseTime(year, facultyName);
        if (!facultyReleaseTime) {
            return {};
        }

        const breakdown = {};
        facultyReleaseTime.categories.forEach(category => {
            if (!breakdown[category.type]) {
                breakdown[category.type] = 0;
            }
            breakdown[category.type] += category.credits;
        });

        return breakdown;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReleaseTimeAdjustmentsManager;
}
