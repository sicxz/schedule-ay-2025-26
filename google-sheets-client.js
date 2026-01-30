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

const INSTRUCTOR_COLORS = {
  'T.Masingale': { red: 0.68, green: 0.85, blue: 0.90 },
  'Masingale': { red: 0.68, green: 0.85, blue: 0.90 },
  'S.Durr': { red: 0.96, green: 0.89, blue: 0.76 },
  'Durr': { red: 0.96, green: 0.89, blue: 0.76 },
  'C.Manikoth': { red: 0.98, green: 0.80, blue: 0.49 },
  'Manikoth': { red: 0.98, green: 0.80, blue: 0.49 },
  'M.Lybbert': { red: 0.80, green: 0.73, blue: 0.85 },
  'Lybbert': { red: 0.80, green: 0.73, blue: 0.85 },
  'S.Mills': { red: 0.85, green: 0.92, blue: 0.83 },
  'Mills': { red: 0.85, green: 0.92, blue: 0.83 },
  'A.Sopu': { red: 0.76, green: 0.88, blue: 0.71 },
  'Sopu': { red: 0.76, green: 0.88, blue: 0.71 },
  'S.Allison': { red: 0.76, green: 0.88, blue: 0.71 },
  'Allison': { red: 0.76, green: 0.88, blue: 0.71 },
  'G.Hustrulid': { red: 0.98, green: 0.80, blue: 0.49 },
  'Hustrulid': { red: 0.98, green: 0.80, blue: 0.49 },
  'E.Norris': { red: 0.68, green: 0.85, blue: 0.90 },
  'Norris': { red: 0.68, green: 0.85, blue: 0.90 },
  'Barton/Pettigrew': { red: 0.80, green: 0.73, blue: 0.85 },
  'TBD': { red: 0.90, green: 0.90, blue: 0.90 }
};

const DEFAULT_COLOR = { red: 0.95, green: 0.95, blue: 0.95 };
const HEADER_COLOR = { red: 0.85, green: 0.85, blue: 0.85 };

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

  const allFormatData = {};

  for (const [key, quarterName] of Object.entries(quarters)) {
    const sheetId = key === 'fall' ? 0 : key === 'winter' ? 1 : 2;
    const courses = scheduleData[key] || [];
    const { rows, formatData } = buildScheduleGridWithFormat(courses, quarterName, today);
    allFormatData[sheetId] = formatData;
    
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

  await applyFormatting(sheets, spreadsheetId, allFormatData);

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

function buildScheduleGridWithFormat(courses, quarterName, updateDate) {
  const rows = [];
  const formatData = {
    titleRow: 0,
    headerRows: [],
    courseBlocks: []
  };
  
  rows.push([quarterName, '', '', '', '', '', '', '', 'updated ' + updateDate]);
  rows.push(['']);
  
  const mwStartRow = rows.length;
  const mwResult = buildDaySection('MONDAY & WEDNESDAY', ['MW', 'M', 'W'], courses, mwStartRow);
  formatData.headerRows.push(mwStartRow);
  rows.push(...mwResult.rows);
  mwResult.courseBlocks.forEach(block => {
    block.row += mwStartRow; // block.row is relative to section, add section start to make absolute
    formatData.courseBlocks.push(block);
  });
  
  rows.push(['']);
  
  const trStartRow = rows.length;
  const trResult = buildDaySection('TUESDAY & THURSDAY', ['TR', 'T', 'R', 'TTh'], courses, trStartRow);
  formatData.headerRows.push(trStartRow);
  rows.push(...trResult.rows);
  trResult.courseBlocks.forEach(block => {
    block.row += trStartRow; // block.row is relative to section, add section start to make absolute
    formatData.courseBlocks.push(block);
  });
  
  rows.push(['']);
  
  const onlineStartRow = rows.length;
  const onlineResult = buildOnlineSection(courses, onlineStartRow);
  if (onlineResult.rows.length > 0) {
    formatData.headerRows.push(onlineStartRow);
    rows.push(...onlineResult.rows);
    onlineResult.courseBlocks.forEach(block => {
      block.row += onlineStartRow; // block.row is relative to section, add section start to make absolute
      formatData.courseBlocks.push(block);
    });
  }
  
  return { rows, formatData };
}

function buildDaySection(dayLabel, dayPatterns, courses, startRowOffset) {
  const rows = [];
  const courseBlocks = [];
  const occupiedCells = new Set();
  
  const headerRow = [dayLabel, ...ROOMS];
  rows.push(headerRow);
  
  for (let timeIdx = 0; timeIdx < TIME_SLOTS.length; timeIdx++) {
    const timeSlot = TIME_SLOTS[timeIdx];
    const row = [timeSlot];
    
    for (let colIdx = 0; colIdx < ROOMS.length; colIdx++) {
      const room = ROOMS[colIdx];
      const cellKey = `${timeIdx}-${colIdx}`;
      
      if (!room || occupiedCells.has(cellKey)) {
        row.push('');
        continue;
      }
      
      const course = findCourseForSlot(courses, dayPatterns, timeSlot, room);
      if (course) {
        const duration = getCourseDuration(course.time);
        row.push(formatCourseCell(course));
        
        for (let d = 1; d < duration && timeIdx + d < TIME_SLOTS.length; d++) {
          occupiedCells.add(`${timeIdx + d}-${colIdx}`);
        }
        
        courseBlocks.push({
          row: timeIdx + 1,
          col: colIdx + 1,
          duration: duration,
          color: getInstructorColor(course.instructor)
        });
      } else {
        row.push('');
      }
    }
    
    rows.push(row);
  }
  
  return { rows, courseBlocks };
}

function buildOnlineSection(courses, startRowOffset) {
  const rows = [];
  const courseBlocks = [];
  
  const onlineCourses = courses.filter(c => 
    (c.room || '').toUpperCase() === 'ONLINE' || 
    (c.day || '').toUpperCase() === 'ONLINE'
  );
  
  if (onlineCourses.length === 0) {
    return { rows: [], courseBlocks: [] };
  }
  
  rows.push(['ONLINE', ...ROOMS.map(() => '')]);
  
  const row = ['async'];
  for (let i = 0; i < ROOMS.length; i++) {
    if (i < onlineCourses.length) {
      const course = onlineCourses[i];
      row.push(formatCourseCell(course));
      courseBlocks.push({
        row: 1,
        col: i + 1,
        duration: 1,
        color: getInstructorColor(course.instructor)
      });
    } else {
      row.push('');
    }
  }
  rows.push(row);
  
  return { rows, courseBlocks };
}

function findCourseForSlot(courses, dayPatterns, timeSlot, room) {
  const targetHour = parseTimeToHour(timeSlot);
  const roomCode = room.split(' ')[0];
  
  for (const course of courses) {
    const courseDay = course.day || '';
    if (courseDay.toUpperCase() === 'ONLINE') continue;
    
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
      console.log(`MATCH: ${course.code} @ slot ${timeSlot}(${targetHour}) course time ${courseTime}(${courseHour}) room ${room}`);
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

function getCourseDuration(timeString) {
  if (!timeString) return 3; // Default 2h 20min = 3 hourly slots
  
  const match = timeString.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) {
    console.log('Duration: no match for', timeString, '-> defaulting to 3');
    return 3;
  }
  
  let startHour = parseInt(match[1]);
  const startMin = parseInt(match[2]);
  let endHour = parseInt(match[3]);
  const endMin = parseInt(match[4]);
  
  if (startHour < 7) startHour += 12;
  if (endHour < 7) endHour += 12;
  if (endHour <= startHour) endHour += 12;
  
  // Calculate duration in minutes, then convert to hourly slots
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  // 2h 20min = 140 min -> 3 hourly slots, 2h = 120 min -> 2 slots
  const duration = Math.ceil(totalMinutes / 60);
  const result = Math.max(1, Math.min(duration, 4));
  console.log('Duration:', timeString, '-> totalMin:', totalMinutes, 'slots:', result);
  return result;
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

function getInstructorColor(instructor) {
  if (!instructor) return DEFAULT_COLOR;
  
  for (const [key, color] of Object.entries(INSTRUCTOR_COLORS)) {
    if (instructor.includes(key) || key.includes(instructor)) {
      return color;
    }
  }
  
  return DEFAULT_COLOR;
}

async function applyFormatting(sheets, spreadsheetId, allFormatData) {
  const requests = [];
  
  for (let sheetId = 0; sheetId < 3; sheetId++) {
    requests.push({
      repeatCell: {
        range: { sheetId },
        cell: {
          userEnteredFormat: {
            wrapStrategy: 'WRAP',
            verticalAlignment: 'TOP',
            textFormat: { fontFamily: 'Arial', fontSize: 10 }
          }
        },
        fields: 'userEnteredFormat(wrapStrategy,verticalAlignment,textFormat)'
      }
    });
    
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 24 },
            horizontalAlignment: 'CENTER'
          }
        },
        fields: 'userEnteredFormat(textFormat,horizontalAlignment)'
      }
    });
    
    requests.push({
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6 },
        mergeType: 'MERGE_ALL'
      }
    });
    
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 8, endColumnIndex: 9 },
        cell: {
          userEnteredFormat: {
            textFormat: { fontSize: 10 },
            horizontalAlignment: 'RIGHT'
          }
        },
        fields: 'userEnteredFormat(textFormat,horizontalAlignment)'
      }
    });
    
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 80 },
        fields: 'pixelSize'
      }
    });
    
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 9 },
        properties: { pixelSize: 110 },
        fields: 'pixelSize'
      }
    });
    
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 50 },
        properties: { pixelSize: 60 },
        fields: 'pixelSize'
      }
    });
    
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 40 },
        fields: 'pixelSize'
      }
    });
    
    const formatData = allFormatData[sheetId];
    if (!formatData) continue;
    
    for (const headerRow of formatData.headerRows) {
      requests.push({
        repeatCell: {
          range: { 
            sheetId, 
            startRowIndex: headerRow, 
            endRowIndex: headerRow + 1, 
            startColumnIndex: 0, 
            endColumnIndex: 9 
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: HEADER_COLOR,
              textFormat: { bold: true, fontSize: 11 },
              horizontalAlignment: 'CENTER'
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
        }
      });
    }
    
    const processedMerges = new Set();
    
    for (const block of formatData.courseBlocks) {
      // block.row is already an absolute row index (adjusted during buildScheduleGridWithFormat)
      const baseRow = block.row;
      const mergeKey = `${baseRow}-${block.col}`;
      
      if (processedMerges.has(mergeKey)) continue;
      processedMerges.add(mergeKey);
      
      requests.push({
        repeatCell: {
          range: { 
            sheetId, 
            startRowIndex: baseRow, 
            endRowIndex: baseRow + block.duration,
            startColumnIndex: block.col, 
            endColumnIndex: block.col + 1 
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: block.color,
              verticalAlignment: 'TOP'
            }
          },
          fields: 'userEnteredFormat(backgroundColor,verticalAlignment)'
        }
      });
      
      if (block.duration > 1) {
        requests.push({
          mergeCells: {
            range: { 
              sheetId, 
              startRowIndex: baseRow, 
              endRowIndex: baseRow + block.duration,
              startColumnIndex: block.col, 
              endColumnIndex: block.col + 1 
            },
            mergeType: 'MERGE_ALL'
          }
        });
      }
    }
  }
  
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });
  } catch (err) {
    console.warn('Could not apply formatting:', err.message);
  }
}
