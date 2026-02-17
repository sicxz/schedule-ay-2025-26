# Item 6 Verification (February 17, 2026)

Scope verified:
- AY setup data drives conflict/assignment checks.
- Annual + quarter conflict flow is active.
- No hard-coded `DESN 368`/`DESN 490` false-positive conflict content.

## 1) Syntax checks

Commands:
- `node --check js/conflict-engine.js`
- `node --check js/constraints-service.js`
- `awk '/<script>/{flag=1;next}/<\\/script>/{if(flag){flag=0}}flag' index.html > /tmp/index-inline.js && node --check /tmp/index-inline.js`

Result:
- Passed (no syntax errors).

## 2) Automated tests

Command:
- `npm run test -- --runInBand`

Result:
- Passed.
- `2` test suites, `5` tests passed.
- Suites:
  - `tests/conflict-engine.ay-setup.test.js`
  - `tests/workload-integration.test.js`
- Coverage warning observed from dependency metadata:
  - `[baseline-browser-mapping] ... data ... over two months old`

## 3) Direct engine assertions

Command:
- Inline `node` assertions executed against:
  - `js/conflict-engine.js`
  - `js/constraints-service.js`

Checks:
- `DESN 368` + `DESN 490` in same slot does **not** trigger `student_conflict`.
- AY setup alignment detects:
  - annual overload
  - missing AY setup record
- Fallback constraints include `ay_setup_alignment`.

Result:
- Passed (`verification:pass`).

## 4) Local smoke run (start/curl/stop)

Command sequence:
- Start server: `PORT=5061 HOST=127.0.0.1 npm start`
- Curl checks:
  - `/` contains annual conflict section markers
  - `/pages/academic-year-setup.html` contains AY setup/header controls
  - `/js/conflict-engine.js` contains AY alignment symbols
- Stop server.

Result:
- `home_hits=2`
- `ay_hits=3`
- `engine_hits=4`

Interpretation:
- Updated conflict panel structure and AY setup page are being served.
- AY constraint logic is present in served engine script.
