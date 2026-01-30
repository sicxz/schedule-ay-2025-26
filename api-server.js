import http from 'http';
import fs from 'fs';
import path from 'path';
import { createScheduleSpreadsheet } from './google-sheets-client.js';

const PORT = 5000;
const HOST = '0.0.0.0';

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.txt': 'text/plain'
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'POST' && req.url === '/api/export-to-sheets') {
    try {
      const body = await parseBody(req);
      const { scheduleData, academicYear } = body;
      
      console.log('Export request received for year:', academicYear);
      console.log('Fall courses:', (scheduleData.fall || []).length);
      console.log('Winter courses:', (scheduleData.winter || []).length);
      console.log('Spring courses:', (scheduleData.spring || []).length);
      
      if (scheduleData.fall && scheduleData.fall.length > 0) {
        console.log('Sample fall course:', JSON.stringify(scheduleData.fall[0]));
      }
      
      const result = await createScheduleSpreadsheet(scheduleData, academicYear || '2025-26');
      
      console.log('Export successful:', result.spreadsheetUrl);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (error) {
      console.error('Export error:', error);
      console.error('Error stack:', error.stack);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
    return;
  }

  let filePath = '.' + decodeURIComponent(req.url);
  if (filePath === './') {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + error.code, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});
