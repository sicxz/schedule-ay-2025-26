const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadScriptModule(relativePath) {
    const filePath = path.resolve(__dirname, '..', relativePath);
    const source = fs.readFileSync(filePath, 'utf8');

    const sandbox = {
        console,
        module: { exports: {} },
        exports: {}
    };

    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: relativePath });
    return sandbox.module.exports;
}

describe('ConflictEngine AY setup integration', () => {
    const ConflictEngine = loadScriptModule('js/conflict-engine.js');

    test('does not flag DESN 368 + DESN 490 as a student pathway conflict', () => {
        const schedule = [
            {
                code: 'DESN 368',
                title: 'Code + Design 1',
                instructor: 'T.Masingale',
                room: '206',
                day: 'MW',
                time: '10:00-12:20',
                credits: 5
            },
            {
                code: 'DESN 490',
                title: 'Capstone',
                instructor: 'C.Manikoth',
                room: '209',
                day: 'MW',
                time: '10:00-12:20',
                credits: 5
            }
        ];

        const constraints = [
            {
                id: 'student-pathway',
                enabled: true,
                constraint_type: 'student_conflict',
                rule_details: { severity: 'critical' }
            }
        ];

        const result = ConflictEngine.evaluate(schedule, constraints);
        expect(result.conflicts).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
    });

    test('detects annual overload and missing AY setup record', () => {
        const scheduleByQuarter = {
            fall: [
                { code: 'DESN 338', title: 'UX 1', instructor: 'M.Lybbert', room: '206', day: 'MW', time: '10:00-12:20', credits: 5 },
                { code: 'DESN 348', title: 'UX 2', instructor: 'M.Lybbert', room: '209', day: 'TR', time: '10:00-12:20', credits: 5 },
                { code: 'DESN 458', title: 'UX 3', instructor: 'M.Lybbert', room: '210', day: 'TR', time: '13:00-15:20', credits: 5 }
            ],
            winter: [
                { code: 'DESN 365', title: 'Motion Design 2', instructor: 'M.Lybbert', room: '206', day: 'MW', time: '13:00-15:20', credits: 5 },
                { code: 'DESN 366', title: 'Production Design', instructor: 'M.Lybbert', room: '209', day: 'TR', time: '13:00-15:20', credits: 5 },
                { code: 'DESN 401', title: 'Imaginary Worlds', instructor: 'M.Lybbert', room: '210', day: 'TR', time: '16:00-18:20', credits: 5 }
            ],
            spring: [
                { code: 'DESN 200', title: 'Visual Thinking', instructor: 'M.Lybbert', room: '206', day: 'MW', time: '16:00-18:20', credits: 5 },
                { code: 'DESN 243', title: 'Typography', instructor: 'M.Lybbert', room: '209', day: 'TR', time: '16:00-18:20', credits: 5 },
                { code: 'DESN 379', title: 'Web Dev 2', instructor: 'M.Lybbert', room: '210', day: 'MW', time: '10:00-12:20', credits: 5 },
                { code: 'DESN 301', title: 'Visual Storytelling', instructor: 'Unmapped Faculty', room: '212', day: 'TR', time: '10:00-12:20', credits: 5 }
            ]
        };

        const aySetupData = {
            adjunctTargets: { fall: 0, winter: 0, spring: 0 },
            faculty: [
                {
                    name: 'M.Lybbert',
                    annualTargetCredits: 36,
                    releaseCredits: 0
                }
            ]
        };

        const constraints = [
            {
                id: 'ay-setup-alignment',
                enabled: true,
                constraint_type: 'ay_setup_alignment',
                rule_details: {}
            }
        ];

        const result = ConflictEngine.evaluate(scheduleByQuarter.spring, constraints, {
            currentQuarter: 'spring',
            academicYear: '2025-26',
            scheduleByQuarter,
            aySetupData
        });

        const allIssues = [...result.conflicts, ...result.warnings];
        expect(allIssues.some((issue) => issue.title.includes('Annual Overload Risk: M.Lybbert'))).toBe(true);
        expect(allIssues.some((issue) => issue.title.includes('Missing AY Setup Record: Unmapped Faculty'))).toBe(true);
    });
});

describe('ConstraintsService fallback data', () => {
    const ConstraintsService = loadScriptModule('js/constraints-service.js');

    test('includes ay_setup_alignment fallback rule', () => {
        const fallback = ConstraintsService.getFallbackConstraints();
        expect(fallback.some((rule) => rule.constraint_type === 'ay_setup_alignment')).toBe(true);
    });
});
