const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

const results = [];

// Map quarter format from "fall-2022" to Quarter="Fall", AcademicYear="2022-23"
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

fs.createReadStream('/Users/tmasingale/Documents/GitHub/schedule/enrollment-data/corrected-enrollment-data.csv')
  .pipe(csv())
  .on('data', (row) => {
    const { quarter, academicYear } = parseQuarter(row.quarter);
    results.push({
        AcademicYear: academicYear,
        Quarter: quarter,
        CensusDate: '',
        CourseCode: row.course,
        Section: row.section,
        CRN: '',
        Instructor: '',
        Capacity: row.capacity,
        Enrolled: row.enrolled,
        SeatsRemaining: row.remaining,
        Waitlist: '0',
        Campus: '',
        Days: '',
        StartTime: '',
        EndTime: '',
        Credits: '5',
        ScheduleType: '',
        DeliveryMode: '',
        Room: '',
        Building: ''
    });
  })
  .on('end', () => {
    const csvWriter = createObjectCsvWriter({
        path: '/Users/tmasingale/Documents/GitHub/schedule/enrollment-data/processed/corrected-all-quarters.csv',
        header: [
            {id: 'AcademicYear', title: 'AcademicYear'},
            {id: 'Quarter', title: 'Quarter'},
            {id: 'CensusDate', title: 'CensusDate'},
            {id: 'CourseCode', title: 'CourseCode'},
            {id: 'Section', title: 'Section'},
            {id: 'CRN', title: 'CRN'},
            {id: 'Instructor', title: 'Instructor'},
            {id: 'Capacity', title: 'Capacity'},
            {id: 'Enrolled', title: 'Enrolled'},
            {id: 'SeatsRemaining', title: 'SeatsRemaining'},
            {id: 'Waitlist', title: 'Waitlist'},
            {id: 'Campus', title: 'Campus'},
            {id: 'Days', title: 'Days'},
            {id: 'StartTime', title: 'StartTime'},
            {id: 'EndTime', title: 'EndTime'},
            {id: 'Credits', title: 'Credits'},
            {id: 'ScheduleType', title: 'ScheduleType'},
            {id: 'DeliveryMode', title: 'DeliveryMode'},
            {id: 'Room', title: 'Room'},
            {id: 'Building', title: 'Building'}
        ]
    });

    csvWriter.writeRecords(results)
        .then(() => console.log(`✅ Transformed ${results.length} records`));
  });
