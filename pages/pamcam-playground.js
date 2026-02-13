const PRESET_SCENARIOS = {
    'AY 2024-25 (Design)': {
        t: 8000,
        a: 45,
        f: 150,
        s: 95600,
        n: 129.3,
        p: 8.0,
        rMax: 16.0,
        growthPct: 0
    },
    'AY 2023-24 (Design)': {
        t: 8000,
        a: 45,
        f: 150,
        s: 95600,
        n: 138.4,
        p: 9.0,
        rMax: 16.0,
        growthPct: 0
    },
    'Stress Test (-8% FTES)': {
        t: 8000,
        a: 45,
        f: 150,
        s: 95600,
        n: 129.3,
        p: 8.0,
        rMax: 16.0,
        growthPct: -8
    },
    'Growth Test (+8% FTES)': {
        t: 8000,
        a: 45,
        f: 150,
        s: 95600,
        n: 129.3,
        p: 8.0,
        rMax: 16.0,
        growthPct: 8
    }
};

const AI_MODELS = {
    openai: [
        { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
        { value: 'gpt-4o', label: 'gpt-4o' },
        { value: 'gpt-4.1', label: 'gpt-4.1' }
    ],
    anthropic: [
        { value: 'claude-opus-4-6', label: 'claude-opus-4-6' },
        { value: 'claude-sonnet-4-5', label: 'claude-sonnet-4-5' },
        { value: 'claude-haiku-4-5', label: 'claude-haiku-4-5' }
    ]
};

const HISTORY_STORAGE_KEY = 'pamcam_playground_history_v1';

let chart = null;
let scenarioHistory = [];
let defaultSystemPrompt = '';

function makeId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `pamcam-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function byId(id) {
    return document.getElementById(id);
}

function parseNumber(value, fallback = 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value, decimals = 2) {
    if (!Number.isFinite(value)) return '--';
    return value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatMoney(value) {
    if (!Number.isFinite(value)) return '--';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(value);
}

function readInputs() {
    return {
        t: parseNumber(byId('tuitionInput').value, 8000),
        a: parseNumber(byId('creditsPerStudentInput').value, 45),
        f: parseNumber(byId('stateFundingInput').value, 150),
        s: parseNumber(byId('salaryInput').value, 95000),
        n: Math.max(0, parseNumber(byId('enrollmentInput').value, 129.3)),
        p: Math.max(0.0001, parseNumber(byId('facultyInput').value, 8)),
        rMax: Math.max(0.0001, parseNumber(byId('rMaxInput').value, 16)),
        growthPct: parseNumber(byId('growthPctInput').value, 0)
    };
}

function computePamcam(inputs) {
    const revenuePerFtes = inputs.t + (inputs.a * inputs.f);
    const currentR = inputs.p > 0 ? (inputs.n / inputs.p) : 0;
    const breakEvenR = revenuePerFtes > 0 ? inputs.s / revenuePerFtes : 0;
    const currentMargin = (inputs.n > 0 && currentR > 0)
        ? (revenuePerFtes - (inputs.s / currentR)) * inputs.n
        : 0;

    const nFinal = inputs.n * (1 + (inputs.growthPct / 100));
    const pFinal = nFinal / inputs.rMax;
    const dp = Number.isFinite(pFinal) ? pFinal - inputs.p : 0;
    const projectedR = pFinal > 0 ? (nFinal / pFinal) : 0;
    const projectedMargin = (nFinal > 0 && projectedR > 0)
        ? (revenuePerFtes - (inputs.s / projectedR)) * nFinal
        : 0;
    const deltaMargin = projectedMargin - currentMargin;

    return {
        revenuePerFtes,
        currentR,
        breakEvenR,
        currentMargin,
        nFinal,
        pFinal,
        dp,
        projectedR,
        projectedMargin,
        deltaMargin
    };
}

function metricClassFor(value, goodThreshold, warnThreshold) {
    if (!Number.isFinite(value)) return '';
    if (value >= goodThreshold) return 'good';
    if (value >= warnThreshold) return 'warn';
    return 'danger';
}

function setMetric(id, value, formatter, className = '') {
    const el = byId(id);
    if (!el) return;
    const parent = el.closest('.metric');
    if (parent) {
        parent.classList.remove('good', 'warn', 'danger');
        if (className) parent.classList.add(className);
    }
    el.textContent = formatter(value);
}

function setStatus(text, tone = 'warn') {
    const el = byId('scenarioStatus');
    if (!el) return;
    el.classList.remove('good', 'warn', 'danger');
    if (tone) el.classList.add(tone);
    el.textContent = text;
}

function renderChart(inputs, results) {
    if (!window.Chart) return;
    const canvas = byId('pamcamChart');
    if (!canvas) return;

    const xMin = Math.max(0, Math.min(inputs.n, results.nFinal) * 0.8);
    const xMax = Math.max(inputs.n, results.nFinal) * 1.2;

    const data = {
        datasets: [
            {
                label: 'Current state',
                type: 'scatter',
                data: [{ x: inputs.n, y: results.currentR }],
                backgroundColor: '#0969da',
                borderColor: '#0969da',
                pointRadius: 6
            },
            {
                label: 'Projected state',
                type: 'scatter',
                data: [{ x: results.nFinal, y: results.projectedR }],
                backgroundColor: '#b7142e',
                borderColor: '#b7142e',
                pointRadius: 7
            },
            {
                label: `Rmax (${formatNumber(inputs.rMax, 2)})`,
                type: 'line',
                data: [
                    { x: xMin, y: inputs.rMax },
                    { x: xMax, y: inputs.rMax }
                ],
                borderColor: '#8250df',
                borderWidth: 2,
                borderDash: [6, 5],
                pointRadius: 0
            },
            {
                label: `Break-even R (${formatNumber(results.breakEvenR, 2)})`,
                type: 'line',
                data: [
                    { x: xMin, y: results.breakEvenR },
                    { x: xMax, y: results.breakEvenR }
                ],
                borderColor: '#1a7f37',
                borderWidth: 2,
                borderDash: [3, 4],
                pointRadius: 0
            }
        ]
    };

    const config = {
        data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            const { x, y } = ctx.raw || {};
                            return `${ctx.dataset.label}: FTES ${formatNumber(x, 2)}, SFR ${formatNumber(y, 2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'FTES (n)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Student-Faculty Ratio (R)'
                    }
                }
            }
        }
    };

    if (chart) {
        chart.data = data;
        chart.options = config.options;
        chart.update();
        return;
    }

    chart = new Chart(canvas, config);
}

function updateDerivedReadonlyValue(results) {
    byId('sfrInputReadonly').value = formatNumber(results.currentR, 3);
}

function recalcAndRender() {
    const inputs = readInputs();
    const results = computePamcam(inputs);
    updateDerivedReadonlyValue(results);

    setMetric('currentSfrValue', results.currentR, (v) => formatNumber(v, 3), metricClassFor(results.currentR, inputs.rMax, results.breakEvenR));
    setMetric('breakEvenSfrValue', results.breakEvenR, (v) => formatNumber(v, 3), 'warn');
    setMetric('currentMarginValue', results.currentMargin, formatMoney, metricClassFor(results.currentMargin, 0, -1));
    setMetric('projectedFtesValue', results.nFinal, (v) => formatNumber(v, 2));
    setMetric('dpValue', results.dp, (v) => formatNumber(v, 3), metricClassFor(-results.dp, 0.00001, -0.25));
    setMetric('projectedMarginValue', results.projectedMargin, formatMoney, metricClassFor(results.projectedMargin, 0, -1));

    const marginDelta = results.deltaMargin;
    const marginDirection = marginDelta >= 0 ? 'increase' : 'decrease';
    const marginLabel = `${marginDirection} of ${formatMoney(Math.abs(marginDelta))}`;

    if (results.currentR > inputs.rMax) {
        setStatus(`Current SFR (${formatNumber(results.currentR, 2)}) exceeds Rmax (${formatNumber(inputs.rMax, 2)}). Model indicates dp ${formatNumber(results.dp, 2)} and ${marginLabel}.`, 'warn');
    } else if (results.currentR < results.breakEvenR) {
        setStatus(`Current SFR is below break-even threshold (${formatNumber(results.breakEvenR, 2)}). Margin pressure is high.`, 'danger');
    } else {
        setStatus(`Scenario stable. Change implies ${formatNumber(results.dp, 2)} FTEF and margin ${marginLabel}.`, 'good');
    }

    renderChart(inputs, results);
    return { inputs, results };
}

function fillInputs(values) {
    byId('tuitionInput').value = values.t;
    byId('creditsPerStudentInput').value = values.a;
    byId('stateFundingInput').value = values.f;
    byId('salaryInput').value = values.s;
    byId('enrollmentInput').value = values.n;
    byId('facultyInput').value = values.p;
    byId('rMaxInput').value = values.rMax;
    byId('growthPctInput').value = values.growthPct;
}

function applyPreset(name) {
    const preset = PRESET_SCENARIOS[name];
    if (!preset) return;
    fillInputs(preset);
    recalcAndRender();
}

function initializePresetPicker() {
    const select = byId('baselinePreset');
    select.innerHTML = Object.keys(PRESET_SCENARIOS)
        .map((name) => `<option value="${name}">${name}</option>`)
        .join('');
    select.value = 'AY 2024-25 (Design)';
}

function nudgeInput(inputId, delta) {
    const input = byId(inputId);
    if (!input) return;
    const current = parseNumber(input.value, 0);
    const next = current + delta;
    input.value = String(Math.max(0, Math.round(next * 1000) / 1000));
    recalcAndRender();
}

function loadScenarioHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
        scenarioHistory = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(scenarioHistory)) scenarioHistory = [];
    } catch {
        scenarioHistory = [];
    }
}

function saveScenarioHistory() {
    try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(scenarioHistory));
    } catch {
        // no-op
    }
}

function renderScenarioHistory() {
    const body = byId('scenarioHistoryBody');
    if (!body) return;

    if (!scenarioHistory.length) {
        body.innerHTML = '<tr><td colspan="8" class="output-empty">No scenario snapshots yet.</td></tr>';
        return;
    }

    body.innerHTML = scenarioHistory
        .slice()
        .reverse()
        .map((item) => `
            <tr>
                <td>${item.timeLabel}</td>
                <td>${formatNumber(item.inputs.n, 2)}</td>
                <td>${formatNumber(item.inputs.p, 2)}</td>
                <td>${formatNumber(item.inputs.rMax, 2)}</td>
                <td>${formatNumber(item.results.dp, 3)}</td>
                <td>${formatMoney(item.results.currentMargin)}</td>
                <td>${formatMoney(item.results.projectedMargin)}</td>
                <td>${formatMoney(item.results.deltaMargin)}</td>
            </tr>
        `)
        .join('');
}

function saveScenarioSnapshot() {
    const snapshot = recalcAndRender();
    scenarioHistory.push({
        id: makeId(),
        timestamp: new Date().toISOString(),
        timeLabel: new Date().toLocaleTimeString(),
        inputs: snapshot.inputs,
        results: snapshot.results
    });
    scenarioHistory = scenarioHistory.slice(-40);
    saveScenarioHistory();
    renderScenarioHistory();
}

function clearScenarioSnapshots() {
    scenarioHistory = [];
    saveScenarioHistory();
    renderScenarioHistory();
}

function updateAiStatus(message, tone = 'warn') {
    const line = byId('aiStatusLine');
    if (!line) return;
    line.classList.remove('good', 'warn', 'danger');
    line.classList.add(tone);
    line.textContent = message;
}

function escapeHtml(text) {
    return String(text || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function renderMarkdown(container, markdownText) {
    if (!container) return;
    const text = String(markdownText || '').trim();
    if (!text) {
        container.innerHTML = '<div class="output-empty">No response.</div>';
        return;
    }

    if (window.marked && typeof window.marked.parse === 'function') {
        window.marked.setOptions({
            gfm: true,
            breaks: true,
            headerIds: false,
            mangle: false
        });
        const rawHtml = window.marked.parse(text);
        const safeHtml = window.DOMPurify && typeof window.DOMPurify.sanitize === 'function'
            ? window.DOMPurify.sanitize(rawHtml)
            : escapeHtml(text).replace(/\n/g, '<br>');
        container.innerHTML = `<div class="markdown-output">${safeHtml}</div>`;
        return;
    }

    container.innerHTML = `<div class="markdown-output">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
}

function extractBetween(sourceText, startMarker, endMarker, fallbackLength = 1500) {
    if (!sourceText) return '';
    const start = sourceText.indexOf(startMarker);
    if (start === -1) {
        return sourceText.slice(0, fallbackLength).trim();
    }
    const searchStart = start + startMarker.length;
    const end = sourceText.indexOf(endMarker, searchStart);
    if (end === -1) {
        return sourceText.slice(start, start + fallbackLength).trim();
    }
    return sourceText.slice(start, end).trim();
}

async function fetchTextSafe(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            return '';
        }
        return await response.text();
    } catch {
        return '';
    }
}

async function buildSystemPromptFromSources() {
    const manualText = await fetchTextSafe('../pamcam/pamcam-manual-fall-2025.txt');
    const analysisText = await fetchTextSafe('../docs/pamcam-analysis-design-AY2026.md');
    const reviewText = await fetchTextSafe('../docs/pamcam-critical-review-AY2026.md');

    const manualContribution = extractBetween(
        manualText,
        '3. Contribution Margin',
        '5. Change in Faculty',
        2200
    );
    const manualFacultyChange = extractBetween(
        manualText,
        '5. Change in Faculty',
        '7. Graphical User Interface',
        1700
    );
    const manualInputGuidance = extractBetween(
        manualText,
        'B. Students and Faculty',
        'F. Sharing Results',
        1500
    );
    const analysisSummary = extractBetween(
        analysisText,
        '## Executive Summary',
        '## 1. PAMCAM Model Overview',
        2200
    );
    const reviewPriority = extractBetween(
        reviewText,
        '## 5. Verification Checklist',
        '## 6. Recommended Report Revisions',
        1700
    );

    return `You are Program Command's PAMCAM analyst for EWU Design.

Authoritative manual source (required):
- File: /pamcam/User Manual_PAMCAM Fall 2025.pdf
- Extraction file used to build this prompt: /pamcam/pamcam-manual-fall-2025.txt

Core equation rules from the manual (do not alter):
1) Contribution margin: m = (t + a*f - s/R) * n
2) Faculty change to top boundary: dp = n_final / R_max - p_initial
3) FTES/FTEF and SFR terms must be interpreted exactly as defined in the manual.

Manual excerpt - contribution and design envelope:
${manualContribution}

Manual excerpt - faculty change:
${manualFacultyChange}

Manual excerpt - input consistency guidance:
${manualInputGuidance}

Local EWU Design analysis context:
${analysisSummary}

Data verification cautions to keep explicit in every answer:
${reviewPriority}

Output requirements:
- Use markdown.
- Section 1: Executive readout (3-6 bullets).
- Section 2: Numeric implications (show formulas and computed values).
- Section 3: FTEF recommendation (state dp and staffing direction).
- Section 4: Risk and data caveats (verified vs assumed).
- Section 5: Next best what-if to run (1-3 concrete scenarios).
- Never hide uncertainty. Label assumptions clearly.
- If user asks for decisions, provide both neutral calculation and policy tradeoff framing.`;
}

function selectedProvider() {
    const value = byId('aiProviderSelect').value;
    if (value === 'openai' || value === 'anthropic') return value;
    return null;
}

function populateModelSelect() {
    const provider = selectedProvider() || 'openai';
    const select = byId('aiModelSelect');
    const models = AI_MODELS[provider] || AI_MODELS.openai;
    select.innerHTML = models
        .map((model) => `<option value="${model.value}">${model.label}</option>`)
        .join('');

    const preferred = typeof ClaudeService !== 'undefined'
        ? ClaudeService.getModelPreference?.(provider) || ClaudeService.getCurrentDefaultModel?.()
        : null;
    const hasPreferred = models.some((model) => model.value === preferred);
    select.value = hasPreferred ? preferred : models[0].value;
}

function hydrateAiKeyInput() {
    if (typeof ClaudeService === 'undefined') {
        updateAiStatus('AI service is unavailable on this page.', 'danger');
        return;
    }
    if (ClaudeService.hasApiKey()) {
        byId('aiKeyInput').placeholder = ClaudeService.maskApiKey(ClaudeService.getApiKey());
        updateAiStatus('Stored API key detected.', 'good');
    } else {
        updateAiStatus('No stored API key found in browser storage. Server .env keys can still work.', 'warn');
    }
}

function saveAiKey() {
    if (typeof ClaudeService === 'undefined') {
        updateAiStatus('Cannot save key: AI service unavailable.', 'danger');
        return;
    }
    const raw = byId('aiKeyInput').value.trim();
    if (!raw) {
        updateAiStatus('Enter a key or rely on server .env keys.', 'warn');
        return;
    }
    if (!raw.startsWith('sk-')) {
        updateAiStatus('Invalid key format. Key must start with "sk-".', 'danger');
        return;
    }

    ClaudeService.setApiKey(raw);
    const provider = selectedProvider();
    if (provider) {
        ClaudeService.setProviderPreference(provider);
    }
    const model = byId('aiModelSelect').value;
    ClaudeService.setModelPreference(model, provider || ClaudeService.getCurrentProvider());
    byId('aiKeyInput').value = '';
    byId('aiKeyInput').placeholder = ClaudeService.maskApiKey(ClaudeService.getApiKey());
    updateAiStatus('API key saved for this browser.', 'good');
}

function clearAiKey() {
    if (typeof ClaudeService === 'undefined') {
        updateAiStatus('AI service unavailable.', 'danger');
        return;
    }
    ClaudeService.clearApiKey();
    byId('aiKeyInput').value = '';
    byId('aiKeyInput').placeholder = 'sk-... or sk-ant-...';
    updateAiStatus('API key cleared from browser storage.', 'warn');
}

async function testAiConnection() {
    if (typeof ClaudeService === 'undefined') {
        updateAiStatus('AI service unavailable.', 'danger');
        return;
    }

    const inputKey = byId('aiKeyInput').value.trim();
    if (inputKey.startsWith('sk-')) {
        ClaudeService.setApiKey(inputKey);
    }
    const provider = selectedProvider();
    const model = byId('aiModelSelect').value;
    ClaudeService.setProviderPreference(provider);
    ClaudeService.setModelPreference(model, provider || ClaudeService.getCurrentProvider());
    updateAiStatus('Testing connection...', 'warn');

    const result = await ClaudeService.testConnection(model, provider || undefined);
    if (result.success) {
        const providerLabel = result.provider === 'anthropic' ? 'Anthropic' : 'OpenAI';
        updateAiStatus(`Connected. Provider: ${providerLabel}, model: ${result.model}.`, 'good');
    } else {
        updateAiStatus(`Connection failed: ${result.error}`, 'danger');
    }
}

function buildScenarioContextPayload() {
    const snapshot = recalcAndRender();
    return {
        equationReference: {
            contributionMargin: 'm = (t + a*f - s/R) * n',
            facultyChange: 'dp = n_final / R_max - p_initial'
        },
        inputs: snapshot.inputs,
        computed: {
            currentSfr: snapshot.results.currentR,
            breakEvenSfr: snapshot.results.breakEvenR,
            currentMargin: snapshot.results.currentMargin,
            projectedFtes: snapshot.results.nFinal,
            projectedFtef: snapshot.results.pFinal,
            projectedSfr: snapshot.results.projectedR,
            projectedMargin: snapshot.results.projectedMargin,
            deltaMargin: snapshot.results.deltaMargin,
            dp: snapshot.results.dp
        },
        recentScenarios: scenarioHistory.slice(-5).map((item) => ({
            timestamp: item.timestamp,
            n: item.inputs.n,
            p: item.inputs.p,
            rMax: item.inputs.rMax,
            dp: item.results.dp,
            deltaMargin: item.results.deltaMargin
        }))
    };
}

async function runPamcamPrompt() {
    if (typeof ClaudeService === 'undefined') {
        updateAiStatus('AI service unavailable.', 'danger');
        return;
    }

    const output = byId('aiOutput');
    const userPrompt = byId('userPromptInput').value.trim();
    if (!userPrompt) {
        renderMarkdown(output, 'Please enter a what-if question first.');
        return;
    }

    const systemPrompt = byId('systemPromptInput').value.trim() || defaultSystemPrompt;
    const provider = selectedProvider();
    const model = byId('aiModelSelect').value;
    const key = byId('aiKeyInput').value.trim();
    if (key.startsWith('sk-')) {
        ClaudeService.setApiKey(key);
    }
    ClaudeService.setProviderPreference(provider);
    ClaudeService.setModelPreference(model, provider || ClaudeService.getCurrentProvider());

    const contextPayload = buildScenarioContextPayload();
    const prompt = `${userPrompt}

PAMCAM SCENARIO DATA (JSON)
${JSON.stringify(contextPayload, null, 2)}

Instruction:
Use the provided equations and scenario data exactly. Show calculations clearly and flag assumptions.`;

    renderMarkdown(output, '_Running PAMCAM analysis..._');
    updateAiStatus('Running what-if request...', 'warn');

    try {
        const response = await ClaudeService.analyze(prompt, {
            provider: provider || undefined,
            model,
            systemPrompt,
            maxTokens: 1800,
            temperature: 0.2
        });

        const text = response?.text?.trim() || 'No response returned.';
        renderMarkdown(output, text);
        updateAiStatus('What-if response generated.', 'good');
    } catch (error) {
        renderMarkdown(output, `### Request failed\n\n${escapeHtml(error.message || 'Unknown error')}`);
        updateAiStatus(`What-if request failed: ${error.message}`, 'danger');
    }
}

async function rebuildSystemPromptFromSources() {
    updateAiStatus('Rebuilding system prompt from manual and docs...', 'warn');
    defaultSystemPrompt = await buildSystemPromptFromSources();
    byId('systemPromptInput').value = defaultSystemPrompt;
    updateAiStatus('System prompt rebuilt from /pamcam and /docs sources.', 'good');
}

function resetSystemPromptToDefault() {
    byId('systemPromptInput').value = defaultSystemPrompt || '';
    updateAiStatus('System prompt reset to default.', 'good');
}

function registerEvents() {
    byId('baselinePreset').addEventListener('change', (event) => applyPreset(event.target.value));
    byId('recalcBtn').addEventListener('click', recalcAndRender);
    byId('saveScenarioBtn').addEventListener('click', saveScenarioSnapshot);
    byId('clearHistoryBtn').addEventListener('click', clearScenarioSnapshots);

    ['tuitionInput', 'creditsPerStudentInput', 'stateFundingInput', 'salaryInput', 'enrollmentInput', 'facultyInput', 'rMaxInput', 'growthPctInput']
        .forEach((id) => byId(id).addEventListener('input', recalcAndRender));

    document.querySelectorAll('.nudge-btn').forEach((button) => {
        button.addEventListener('click', () => {
            nudgeInput(button.dataset.target, parseNumber(button.dataset.delta, 0));
        });
    });

    byId('aiProviderSelect').addEventListener('change', () => {
        populateModelSelect();
        recalcAndRender();
    });
    byId('saveKeyBtn').addEventListener('click', saveAiKey);
    byId('testKeyBtn').addEventListener('click', testAiConnection);
    byId('clearKeyBtn').addEventListener('click', clearAiKey);
    byId('runPamcamPromptBtn').addEventListener('click', runPamcamPrompt);
    byId('refreshSystemPromptBtn').addEventListener('click', rebuildSystemPromptFromSources);
    byId('resetSystemPromptBtn').addEventListener('click', resetSystemPromptToDefault);
}

async function init() {
    initializePresetPicker();
    registerEvents();
    loadScenarioHistory();
    renderScenarioHistory();
    applyPreset('AY 2024-25 (Design)');
    populateModelSelect();
    hydrateAiKeyInput();
    defaultSystemPrompt = await buildSystemPromptFromSources();
    byId('systemPromptInput').value = defaultSystemPrompt;
}

document.addEventListener('DOMContentLoaded', init);
