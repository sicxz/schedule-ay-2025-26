/**
 * EWU Design Enrollment Data Validator
 * Validates CSV enrollment data for consistency and accuracy
 */

const fs = require('fs');
const path = require('path');

class EnrollmentValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.stats = {
            totalRows: 0,
            validRows: 0,
            errorRows: 0,
            warningRows: 0
        };
    }

    /**
     * Validate a single enrollment record
     */
    validateRecord(record, rowNumber) {
        const rowErrors = [];
        const rowWarnings = [];

        // Required field validation
        const requiredFields = ['AcademicYear', 'Quarter', 'CourseCode', 'Capacity', 'Enrolled'];
        requiredFields.forEach(field => {
            if (!record[field] || record[field].trim() === '') {
                rowErrors.push(`Missing required field: ${field}`);
            }
        });

        // Capacity math validation: Capacity = Enrolled + SeatsRemaining
        if (record.Capacity && record.Enrolled && record.SeatsRemaining) {
            const capacity = parseInt(record.Capacity);
            const enrolled = parseInt(record.Enrolled);
            const remaining = parseInt(record.SeatsRemaining);

            if (capacity !== enrolled + remaining) {
                rowErrors.push(`Capacity mismatch: ${capacity} ≠ ${enrolled} + ${remaining}`);
            }
        }

        // Numeric field validation
        const numericFields = ['Capacity', 'Enrolled', 'SeatsRemaining', 'Waitlist', 'Credits'];
        numericFields.forEach(field => {
            if (record[field] && isNaN(parseInt(record[field]))) {
                rowErrors.push(`${field} must be numeric, got: ${record[field]}`);
            }
        });

        // Course code format validation (DESN XXX)
        if (record.CourseCode && !record.CourseCode.match(/^DESN\s+\d{3}$/)) {
            rowWarnings.push(`Course code format unusual: ${record.CourseCode} (expected "DESN XXX")`);
        }

        // Quarter validation
        const validQuarters = ['Fall', 'Winter', 'Spring', 'Summer'];
        if (record.Quarter && !validQuarters.includes(record.Quarter)) {
            rowErrors.push(`Invalid quarter: ${record.Quarter} (expected: Fall, Winter, Spring, or Summer)`);
        }

        // Academic year format validation (YYYY-YY)
        if (record.AcademicYear && !record.AcademicYear.match(/^\d{4}-\d{2}$/)) {
            rowErrors.push(`Invalid academic year format: ${record.AcademicYear} (expected: YYYY-YY)`);
        }

        // Enrollment validation
        if (record.Enrolled && record.Capacity) {
            const enrolled = parseInt(record.Enrolled);
            const capacity = parseInt(record.Capacity);

            if (enrolled > capacity && !record.Waitlist) {
                rowWarnings.push(`Over-enrolled (${enrolled}/${capacity}) but no waitlist recorded`);
            }

            if (enrolled === 0) {
                rowWarnings.push(`Course has zero enrollment`);
            }
        }

        // Delivery mode validation
        const validDeliveryModes = ['Campus', 'Online', 'Hybrid', 'ITV'];
        if (record.DeliveryMode && !validDeliveryModes.includes(record.DeliveryMode)) {
            rowWarnings.push(`Unusual delivery mode: ${record.DeliveryMode}`);
        }

        // DESN 495 discontinued check
        if (record.CourseCode && record.CourseCode.includes('495')) {
            rowWarnings.push(`DESN 495 discontinued (merged into DESN 490)`);
        }

        // Store errors and warnings
        if (rowErrors.length > 0) {
            this.errors.push({
                row: rowNumber,
                errors: rowErrors,
                record: record
            });
            this.stats.errorRows++;
        }

        if (rowWarnings.length > 0) {
            this.warnings.push({
                row: rowNumber,
                warnings: rowWarnings,
                record: record
            });
            this.stats.warningRows++;
        }

        if (rowErrors.length === 0) {
            this.stats.validRows++;
        }

        this.stats.totalRows++;
    }

    /**
     * Parse CSV file
     */
    parseCSV(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() !== '');

        if (lines.length === 0) {
            throw new Error('CSV file is empty');
        }

        // Parse header
        const headers = lines[0].split(',').map(h => h.trim());

        // Parse records
        const records = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const record = {};
            headers.forEach((header, index) => {
                record[header] = values[index] ? values[index].trim() : '';
            });
            records.push(record);
        }

        return records;
    }

    /**
     * Validate a CSV file
     */
    validateFile(filePath) {
        console.log(`\n📋 Validating: ${path.basename(filePath)}`);
        console.log('━'.repeat(60));

        try {
            const records = this.parseCSV(filePath);

            records.forEach((record, index) => {
                this.validateRecord(record, index + 2); // +2 because row 1 is header, index starts at 0
            });

            return this.getReport();
        } catch (error) {
            console.error(`❌ Failed to parse file: ${error.message}`);
            return false;
        }
    }

    /**
     * Generate validation report
     */
    getReport() {
        console.log(`\n📊 Validation Summary:`);
        console.log(`   Total rows: ${this.stats.totalRows}`);
        console.log(`   ✅ Valid: ${this.stats.validRows}`);
        console.log(`   ❌ Errors: ${this.stats.errorRows}`);
        console.log(`   ⚠️  Warnings: ${this.stats.warningRows}`);

        if (this.errors.length > 0) {
            console.log(`\n❌ ERRORS (${this.errors.length}):`);
            this.errors.forEach(err => {
                console.log(`\n   Row ${err.row}: ${err.record.CourseCode} - ${err.record.Section}`);
                err.errors.forEach(e => console.log(`      • ${e}`));
            });
        }

        if (this.warnings.length > 0) {
            console.log(`\n⚠️  WARNINGS (${this.warnings.length}):`);
            this.warnings.forEach(warn => {
                console.log(`\n   Row ${warn.row}: ${warn.record.CourseCode} - ${warn.record.Section}`);
                warn.warnings.forEach(w => console.log(`      • ${w}`));
            });
        }

        if (this.errors.length === 0) {
            console.log(`\n✅ All records passed validation!`);
            return true;
        } else {
            console.log(`\n❌ Validation failed. Please fix errors before proceeding.`);
            return false;
        }
    }

    /**
     * Validate all CSV files in a directory
     */
    validateDirectory(dirPath) {
        console.log(`\n🔍 Scanning directory: ${dirPath}`);

        const files = fs.readdirSync(dirPath)
            .filter(file => file.endsWith('.csv'))
            .map(file => path.join(dirPath, file));

        if (files.length === 0) {
            console.log('⚠️  No CSV files found in directory');
            return false;
        }

        console.log(`Found ${files.length} CSV file(s)`);

        let allValid = true;
        files.forEach(file => {
            const validator = new EnrollmentValidator();
            const isValid = validator.validateFile(file);
            if (!isValid) allValid = false;
        });

        return allValid;
    }
}

// CLI Interface
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: node validate-enrollment.js <file.csv|directory>');
        console.log('\nExamples:');
        console.log('  node validate-enrollment.js enrollment-data.csv');
        console.log('  node validate-enrollment.js ./processed/');
        process.exit(1);
    }

    const target = args[0];
    const validator = new EnrollmentValidator();

    if (fs.statSync(target).isDirectory()) {
        const success = validator.validateDirectory(target);
        process.exit(success ? 0 : 1);
    } else {
        const success = validator.validateFile(target);
        process.exit(success ? 0 : 1);
    }
}

module.exports = EnrollmentValidator;
