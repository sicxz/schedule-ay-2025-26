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

export async function createScheduleSpreadsheet(scheduleData, academicYear) {
  const sheets = await getUncachableGoogleSheetClient();
  
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: `EWU Design Schedule ${academicYear}`
      },
      sheets: [
        { properties: { title: 'Fall' } },
        { properties: { title: 'Winter' } },
        { properties: { title: 'Spring' } }
      ]
    }
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;

  for (const quarter of ['fall', 'winter', 'spring']) {
    const sheetTitle = quarter.charAt(0).toUpperCase() + quarter.slice(1);
    const rows = convertQuarterToRows(scheduleData[quarter] || {});
    
    if (rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetTitle}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: rows
        }
      });
    }
  }

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
  };
}

function convertQuarterToRows(quarterData) {
  const rows = [['Day', 'Time', 'Course Code', 'Course Name', 'Instructor', 'Room', 'Credits']];
  
  for (const day of Object.keys(quarterData)) {
    const dayData = quarterData[day];
    if (!dayData) continue;
    
    for (const time of Object.keys(dayData)) {
      const courses = dayData[time];
      if (!Array.isArray(courses)) continue;
      
      for (const course of courses) {
        rows.push([
          day,
          time,
          course.code || '',
          course.name || '',
          course.instructor || '',
          course.room || '',
          course.credits || ''
        ]);
      }
    }
  }
  
  return rows;
}
