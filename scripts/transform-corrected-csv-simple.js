const fs = require('fs');

// Read the corrected CSV
const csvData = fs.readFileSync('/Users/tmasingale/Documents/GitHub/schedule/enrollment-data/corrected-enrollment-data.csv', 'utf8');
const lines = csvData.trim().split('\n');
const header = lines[0].split(',');

// Parse quarter format from "fall-2022" to Quarter="Fall", AcademicYear="2022-23"
function parseQuarter(quarterStr) {
    const [season, year] = quarterStr.split('-');
    const seasonCap = season.charAt(0).toUpperCase() + season.slice(1);

    // Map to academic year (Fall YYYY -> YYYY-YY+1, Winter/Spring YYYY -> YYYY-1-YYYY)
    let academicYear;
    if (seasonCap === 'Fall') {
        academicYear = `${year}-${(parseInt(year) + 1).toString().slice(-2)}`;
    } else {
        academicYear = `${parseInt(year) - 1}-${year.slice(-2)}`;
    }

    return { quarter: seasonCap, academicYear };
}

// Build output CSV
const outputLines = [
    'AcademicYear,Quarter,CensusDate,CourseCode,Section,CRN,Instructor,Capacity,Enrolled,SeatsRemaining,Waitlist,Campus,Days,StartTime,EndTime,Credits,ScheduleType,DeliveryMode,Room,Building'
];

for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {
        quarter: values[0],
        course: values[1],
        section: values[2],
        capacity: values[3],
        remaining: values[4],
        enrolled: values[5]
    };

    const { quarter, academicYear } = parseQuarter(row.quarter);

    outputLines.push([
        academicYear,
        quarter,
        '',  // CensusDate
        row.course,
        row.section,
        '',  // CRN
        '',  // Instructor
        row.capacity,
        row.enrolled,
        row.remaining,
        '0',  // Waitlist
        '',  // Campus
        '',  // Days
        '',  // StartTime
        '',  // EndTime
        '5',  // Credits
        '',  // ScheduleType
        '',  // DeliveryMode
        '',  // Room
        ''   // Building
    ].join(','));
}

fs.writeFileSync(
    '/Users/tmasingale/Documents/GitHub/schedule/enrollment-data/processed/corrected-all-quarters.csv',
    outputLines.join('\n')
);

console.log(`✅ Transformed ${outputLines.length - 1} records`);
