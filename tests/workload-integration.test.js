const WorkloadIntegration = require('../js/workload-integration.js');

describe('WorkloadIntegration', () => {
    beforeEach(() => {
        localStorage.clear();
        global.getYearData = (workloadData, year) => {
            if (year === 'all') {
                return { all: {}, fullTime: {}, adjunct: {}, former: {} };
            }
            return { all: {}, fullTime: {}, adjunct: {}, former: {} };
        };
    });

    afterEach(() => {
        delete global.getYearData;
        localStorage.clear();
    });

    test('builds integrated faculty workload from AY setup + schedule + detail entries', () => {
        localStorage.setItem('programCommandAySetup', JSON.stringify({
            '2025-26': {
                adjunctTargets: { fall: 0, winter: 0, spring: 0 },
                faculty: [
                    {
                        name: 'Travis Masingale',
                        role: 'Tenure/Tenure-track',
                        annualTargetCredits: 36,
                        releaseCredits: 6
                    }
                ]
            }
        }));

        localStorage.setItem('designSchedulerData_2025-26', JSON.stringify({
            fall: {
                MW: {
                    '10:00-12:20': [
                        { code: 'DESN 368', name: 'Code + Design 1', instructor: 'Travis Masingale', credits: 5, room: '206' },
                        { code: 'DESN 378', name: 'Code + Design 2', instructor: 'Travis Masingale', credits: 5, room: '209' }
                    ]
                }
            },
            winter: {},
            spring: {}
        }));

        WorkloadIntegration.saveFacultyWorkloadDetailEntries(
            '2025-26',
            'Travis Masingale',
            [
                {
                    id: 'entry_1',
                    quarter: 'Fall',
                    courseCode: 'DESN 499',
                    studentCredits: 5,
                    workloadRate: 0.2,
                    notes: 'Independent study supervision'
                }
            ],
            'Travis Masingale'
        );

        const integrated = WorkloadIntegration.buildIntegratedWorkloadYearData({}, '2025-26');
        const faculty = integrated.all['Travis Masingale'];

        expect(faculty).toBeDefined();
        expect(faculty.scheduledCredits).toBe(10);
        expect(faculty.appliedLearningCredits).toBe(5);
        expect(faculty.totalWorkloadCredits).toBe(11);
        expect(faculty.maxWorkload).toBe(30);
        expect(faculty.appliedLearning['DESN 499'].workload).toBe(1);
    });

    test('persists and reads faculty detail entries by year', () => {
        const saved = WorkloadIntegration.saveFacultyWorkloadDetailEntries(
            '2026-27',
            'Mindy Breen',
            [
                {
                    id: 'entry_2',
                    quarter: 'Winter',
                    courseCode: 'DESN 491',
                    studentCredits: 10,
                    workloadRate: 0.2,
                    notes: 'Senior project mentoring'
                }
            ],
            'Mindy Breen'
        );

        expect(saved).toBe(true);

        const entries = WorkloadIntegration.getFacultyWorkloadDetailEntries('2026-27', 'Mindy Breen');
        expect(entries).toHaveLength(1);
        expect(entries[0].courseCode).toBe('DESN 491');
        expect(entries[0].workloadCredits).toBe(2);
    });
});
