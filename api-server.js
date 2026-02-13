import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = __dirname;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT_DIR, '.env'));
loadEnvFile(path.join(ROOT_DIR, '.env.local'));

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const DEFAULT_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
let createScheduleSpreadsheet = null;

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

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function inferProviderFromKey(apiKey) {
  if (typeof apiKey !== 'string') {
    return 'openai';
  }
  if (apiKey.startsWith('sk-ant-')) {
    return 'anthropic';
  }
  return 'openai';
}

function getApiCredential(req, preferredProvider = null) {
  const headerKey =
    req.headers['x-ai-api-key'] ||
    req.headers['x-openai-api-key'] ||
    req.headers['x-api-key'];

  if (typeof headerKey === 'string' && headerKey.trim()) {
    const key = headerKey.trim();
    const provider = preferredProvider || inferProviderFromKey(key);
    return { key, provider };
  }

  if (preferredProvider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    return { key: process.env.ANTHROPIC_API_KEY, provider: 'anthropic' };
  }
  if (preferredProvider === 'openai' && process.env.OPENAI_API_KEY) {
    return { key: process.env.OPENAI_API_KEY, provider: 'openai' };
  }

  if (process.env.OPENAI_API_KEY) {
    return { key: process.env.OPENAI_API_KEY, provider: 'openai' };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { key: process.env.ANTHROPIC_API_KEY, provider: 'anthropic' };
  }

  return null;
}

function normalizeModelForProvider(provider, requestedModel) {
  if (!requestedModel || typeof requestedModel !== 'string') {
    return provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL;
  }

  const model = requestedModel.trim();
  if (!model) {
    return provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL;
  }

  if (provider === 'anthropic' && model.startsWith('gpt-')) {
    return DEFAULT_ANTHROPIC_MODEL;
  }
  if (provider === 'openai' && model.startsWith('claude-')) {
    return DEFAULT_OPENAI_MODEL;
  }

  return model;
}

async function callOpenAiChat({ apiKey, messages, model, maxTokens, temperature, responseFormat }) {
  const payload = {
    model: normalizeModelForProvider('openai', model),
    messages,
    temperature: typeof temperature === 'number' ? temperature : 0.3,
    max_tokens: Number.isFinite(maxTokens) ? maxTokens : 1200
  };

  if (responseFormat === 'json_object') {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `OpenAI request failed (${response.status})`;
    throw new Error(message);
  }

  const text = data?.choices?.[0]?.message?.content || '';
  return {
    text,
    usage: data.usage || null,
    model: data.model || payload.model,
    provider: 'openai',
    raw: data
  };
}

function normalizeAnthropicMessages(messages) {
  return (messages || []).map((message) => {
    if (typeof message.content === 'string') {
      return { role: message.role, content: message.content };
    }
    return message;
  });
}

async function callAnthropicChat({ apiKey, messages, model, maxTokens, temperature, systemPrompt }) {
  const payload = {
    model: normalizeModelForProvider('anthropic', model),
    max_tokens: Number.isFinite(maxTokens) ? maxTokens : 1200,
    temperature: typeof temperature === 'number' ? temperature : 0.3,
    messages: normalizeAnthropicMessages(messages)
  };

  if (typeof systemPrompt === 'string' && systemPrompt.trim()) {
    payload.system = systemPrompt.trim();
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Anthropic request failed (${response.status})`;
    throw new Error(message);
  }

  const text = Array.isArray(data?.content)
    ? data.content.filter((entry) => entry.type === 'text').map((entry) => entry.text).join('\n').trim()
    : '';

  return {
    text,
    usage: data.usage || null,
    model: data.model || payload.model,
    provider: 'anthropic',
    raw: data
  };
}

async function getCreateScheduleSpreadsheet() {
  if (createScheduleSpreadsheet) {
    return createScheduleSpreadsheet;
  }
  const module = await import('./google-sheets-client.js');
  if (!module?.createScheduleSpreadsheet) {
    throw new Error('Google Sheets export module is not available.');
  }
  createScheduleSpreadsheet = module.createScheduleSpreadsheet;
  return createScheduleSpreadsheet;
}

function toMessages({ prompt, messages, systemPrompt }) {
  if (Array.isArray(messages) && messages.length > 0) {
    return messages;
  }
  const normalized = [];
  if (typeof systemPrompt === 'string' && systemPrompt.trim()) {
    normalized.push({ role: 'system', content: systemPrompt.trim() });
  }
  if (typeof prompt === 'string' && prompt.trim()) {
    normalized.push({ role: 'user', content: prompt.trim() });
  }
  return normalized;
}

async function callAiProvider({
  provider,
  apiKey,
  messages,
  model,
  maxTokens,
  temperature,
  responseFormat,
  systemPrompt
}) {
  if (provider === 'anthropic') {
    const anthroMessages = [];
    let derivedSystemPrompt = typeof systemPrompt === 'string' ? systemPrompt : null;

    for (const message of messages || []) {
      if (message.role === 'system') {
        if (!derivedSystemPrompt && typeof message.content === 'string') {
          derivedSystemPrompt = message.content;
        }
        continue;
      }
      anthroMessages.push(message);
    }

    return callAnthropicChat({
      apiKey,
      messages: anthroMessages,
      model,
      maxTokens,
      temperature,
      systemPrompt: derivedSystemPrompt
    });
  }

  return callOpenAiChat({
    apiKey,
    messages,
    model,
    maxTokens,
    temperature,
    responseFormat
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  if (req.method === 'POST' && pathname === '/api/export-to-sheets') {
    try {
      const body = await parseBody(req);
      const { scheduleData = {}, academicYear } = body;

      console.log('Export request received for year:', academicYear);
      console.log('Fall courses:', (scheduleData.fall || []).length);
      console.log('Winter courses:', (scheduleData.winter || []).length);
      console.log('Spring courses:', (scheduleData.spring || []).length);

      if (scheduleData.fall && scheduleData.fall.length > 0) {
        console.log('All fall courses:');
        scheduleData.fall.forEach((course) => {
          console.log(`  ${course.code} | ${course.day} | ${course.time} | Room: ${course.room}`);
        });
      }

      const exportFn = await getCreateScheduleSpreadsheet();
      const result = await exportFn(scheduleData, academicYear || '2025-26');
      console.log('Export successful:', result.spreadsheetUrl);
      sendJson(res, 200, { success: true, ...result });
    } catch (error) {
      console.error('Export error:', error);
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/ai/test') {
    try {
      const body = await parseBody(req);
      const preferredProvider = body.provider === 'anthropic' || body.provider === 'openai' ? body.provider : null;
      const credential = getApiCredential(req, preferredProvider);
      if (!credential) {
        sendJson(res, 400, {
          success: false,
          error: 'No AI API key found. Set OPENAI_API_KEY/ANTHROPIC_API_KEY or save a key in app settings.'
        });
        return;
      }

      const model = normalizeModelForProvider(credential.provider, body.model);
      const result = await callAiProvider({
        provider: credential.provider,
        apiKey: credential.key,
        model,
        maxTokens: 20,
        temperature: 0,
        messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
        systemPrompt: null,
        responseFormat: null
      });

      sendJson(res, 200, {
        success: true,
        provider: result.provider,
        model: result.model,
        message: result.text.trim() || 'OK'
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/ai/chat') {
    try {
      const body = await parseBody(req);
      const preferredProvider = body.provider === 'anthropic' || body.provider === 'openai' ? body.provider : null;
      const credential = getApiCredential(req, preferredProvider);
      if (!credential) {
        sendJson(res, 400, {
          success: false,
          error: 'No AI API key found. Set OPENAI_API_KEY/ANTHROPIC_API_KEY or save a key in app settings.'
        });
        return;
      }

      const messages = toMessages(body);
      if (!messages.length) {
        sendJson(res, 400, { success: false, error: 'Request must include `prompt` or non-empty `messages`.' });
        return;
      }

      const result = await callAiProvider({
        provider: credential.provider,
        apiKey: credential.key,
        messages,
        model: normalizeModelForProvider(credential.provider, body.model),
        maxTokens: Number(body.maxTokens || body.max_tokens) || 1200,
        temperature: typeof body.temperature === 'number' ? body.temperature : 0.3,
        responseFormat: body.responseFormat,
        systemPrompt: typeof body.systemPrompt === 'string' ? body.systemPrompt : null
      });

      sendJson(res, 200, {
        success: true,
        provider: result.provider,
        text: result.text,
        usage: result.usage,
        model: result.model
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: error.message });
    }
    return;
  }

  const normalizedPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(normalizedPath).replace(/^(\.\.[/\\])+/, '');
  const relativePath = safePath.replace(/^[/\\]+/, '');
  const resolvedPath = path.join(ROOT_DIR, relativePath);

  if (!resolvedPath.startsWith(ROOT_DIR)) {
    sendJson(res, 403, { success: false, error: 'Access denied' });
    return;
  }

  fs.readFile(resolvedPath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
      return;
    }

    const extname = String(path.extname(resolvedPath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content, 'utf-8');
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});
