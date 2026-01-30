import { google } from 'googleapis';

let connectionSettings = null;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

export async function getUncachableGoogleSheetClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

const ROOMS = ['206 UX Lab', '207 Media Lab', '209 Mac Lab', '210 Mac Lab', '212 Project Lab', '', 'CEB 102', 'CEB 104'];
const TIME_SLOTS = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'];

export async function createScheduleSpreadsheet(scheduleData, academicYear) {
  const sheets = await getUncachableGoogleSheetClient();
  
  const quarters = getQuarterNames(academicYear);
  
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: `EWU Design Schedule ${academicYear}`
      },
      sheets: [
        { properties: { title: quarters.fall, sheetId: 0 } },
        { properties: { title: quarters.winter, sheetId: 1 } },
        { properties: { title: quarters.spring, sheetId: 2 } }
      ]
    }
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;
  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });

  for (const [key, quarterName] of Object.entries(quarters)) {
    const courses = scheduleData[key] || [];
    const rows = buildScheduleGrid(courses, quarterName, today);
    
    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${quarterName}'!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: rows
        }
      });
    }
  }

  await applyFormatting(sheets, spreadsheetId);

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
  };
}

function getQuarterNames(academicYear) {
  const [startYear, endYear] = academicYear.split('-');
  const fullStartYear = startYear.length === 2 ? '20' + startYear : startYear;
  const fullEndYear = endYear.length === 2 ? '20' + endYear : endYear;
  
  return {
    fall: `Fall ${fullStartYear}`,
    winter: `Winter ${fullEndYear}`,
    spring: `Spring ${fullEndYear}`
  };
}

function buildScheduleGrid(courses, quarterName, updateDate) {
  const rows = [];
  
  rows.push(...buildDaySection('MONDAY & WEDNESDAY', ['MW', 'M', 'W'], courses, quarterName, updateDate));
  rows.push(['']);
  rows.push(...buildDaySection('TUESDAY & THURSDAY', ['TR', 'T', 'R', 'TTh'], courses, null, null));
  
  return rows;
}

function buildDaySection(dayLabel, dayPatterns, courses, quarterName, updateDate) {
  const rows = [];
  
  const headerRow = [dayLabel];
  ROOMS.forEach((room, idx) => {
    if (idx === 0 && quarterName) {
      headerRow.push(quarterName + '\n' + room);
    } else if (idx === 6 && updateDate) {
      headerRow.push('updated ' + updateDate + '\n' + room);
    } else {
      headerRow.push(room);
    }
  });
  rows.push(headerRow);
  
  for (const timeSlot of TIME_SLOTS) {
    const row = [timeSlot];
    
    for (const room of ROOMS) {
      if (!room) {
        row.push('');
        continue;
      }
      
      const course = findCourseForSlot(courses, dayPatterns, timeSlot, room);
      if (course) {
        row.push(formatCourseCell(course));
      } else {
        row.push('');
      }
    }
    
    rows.push(row);
  }
  
  return rows;
}

function findCourseForSlot(courses, dayPatterns, timeSlot, room) {
  const targetHour = parseTimeToHour(timeSlot);
  const roomCode = room.split(' ')[0];
  
  for (const course of courses) {
    const courseDay = course.day || '';
    const matchesDay = dayPatterns.some(pattern => 
      courseDay.toUpperCase().includes(pattern.toUpperCase()) ||
      pattern.toUpperCase().includes(courseDay.toUpperCase())
    );
    
    if (!matchesDay) continue;
    
    const courseRoom = (course.room || '').toString();
    const matchesRoom = courseRoom === roomCode || 
                        courseRoom === room ||
                        room.startsWith(courseRoom);
    
    if (!matchesRoom) continue;
    
    const courseTime = course.time || '';
    const courseHour = parseCourseTimeToHour(courseTime);
    
    if (courseHour === targetHour) {
      return course;
    }
  }
  
  return null;
}

function parseTimeToHour(timeSlot) {
  const match = timeSlot.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return -1;
  
  let hour = parseInt(match[1]);
  const isPM = match[3].toUpperCase() === 'PM';
  
  if (isPM && hour !== 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;
  
  return hour;
}

function parseCourseTimeToHour(courseTime) {
  const cleaned = courseTime.replace(/\s+/g, '');
  
  let match = cleaned.match(/(\d{1,2}):?(\d{2})?\s*-/);
  if (match) {
    let hour = parseInt(match[1]);
    if (hour < 7) hour += 12;
    return hour;
  }
  
  match = cleaned.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
  if (match) {
    let hour = parseInt(match[1]);
    const period = match[3];
    
    if (period) {
      if (period.toUpperCase() === 'PM' && hour !== 12) hour += 12;
      if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;
    } else {
      if (hour < 7) hour += 12;
    }
    return hour;
  }
  
  return -1;
}

function formatCourseCell(course) {
  const parts = [];
  
  if (course.code) parts.push(course.code);
  if (course.title || course.name) parts.push(course.title || course.name);
  if (course.instructor) parts.push(course.instructor);
  
  const credits = course.credits || 5;
  parts.push(`${credits} credits`);
  
  return parts.join('\n');
}

async function applyFormatting(sheets, spreadsheetId) {
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId: 0 },
              cell: {
                userEnteredFormat: {
                  wrapStrategy: 'WRAP',
                  verticalAlignment: 'TOP'
                }
              },
              fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)'
            }
          },
          {
            repeatCell: {
              range: { sheetId: 1 },
              cell: {
                userEnteredFormat: {
                  wrapStrategy: 'WRAP',
                  verticalAlignment: 'TOP'
                }
              },
              fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)'
            }
          },
          {
            repeatCell: {
              range: { sheetId: 2 },
              cell: {
                userEnteredFormat: {
                  wrapStrategy: 'WRAP',
                  verticalAlignment: 'TOP'
                }
              },
              fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)'
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 1, endIndex: 9 },
              properties: { pixelSize: 120 },
              fields: 'pixelSize'
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 1, dimension: 'COLUMNS', startIndex: 1, endIndex: 9 },
              properties: { pixelSize: 120 },
              fields: 'pixelSize'
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 2, dimension: 'COLUMNS', startIndex: 1, endIndex: 9 },
              properties: { pixelSize: 120 },
              fields: 'pixelSize'
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'ROWS', startIndex: 0, endIndex: 30 },
              properties: { pixelSize: 80 },
              fields: 'pixelSize'
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 1, dimension: 'ROWS', startIndex: 0, endIndex: 30 },
              properties: { pixelSize: 80 },
              fields: 'pixelSize'
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 2, dimension: 'ROWS', startIndex: 0, endIndex: 30 },
              properties: { pixelSize: 80 },
              fields: 'pixelSize'
            }
          }
        ]
      }
    });
  } catch (err) {
    console.warn('Could not apply formatting:', err.message);
  }
}
