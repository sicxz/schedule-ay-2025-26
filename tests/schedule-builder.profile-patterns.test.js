const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeStubElement() {
    return {
        value: '2026-27',
        checked: false,
        textContent: '',
        innerHTML: '',
        style: {},
        dataset: {},
        classList: {
            add: jest.fn(),
            remove: jest.fn(),
            toggle: jest.fn()
        },
        addEventListener: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        appendChild: jest.fn(),
        removeChild: jest.fn()
    };
}

function loadScheduleBuilderWindow({ profileScheduler } = {}) {
    const filePath = path.resolve(__dirname, '..', 'pages/schedule-builder.js');
    const source = fs.readFileSync(filePath, 'utf8');
    const elements = new Map();

    const documentObject = {
        addEventListener: jest.fn((event, handler) => {
            if (event === 'DOMContentLoaded') {
                documentObject.__domReadyHandler = handler;
            }
        }),
        getElementById: jest.fn((id) => {
            if (!elements.has(id)) elements.set(id, makeStubElement());
            return elements.get(id);
        }),
        querySelector: jest.fn(() => null),
        createElement: jest.fn(() => makeStubElement())
    };

    const localStore = {};
    const localStorageObject = {
        getItem: jest.fn((key) => (Object.prototype.hasOwnProperty.call(localStore, key) ? localStore[key] : null)),
        setItem: jest.fn((key, value) => {
            localStore[key] = String(value);
        }),
        removeItem: jest.fn((key) => {
            delete localStore[key];
        })
    };

    const windowObject = {
        document: documentObject,
        DepartmentProfileManager: {
            initialize: jest.fn(async () => ({
                profile: {
                    scheduler: profileScheduler || {
                        storageKeyPrefix: 'designSchedulerData_',
                        dayPatterns: [
                            { id: 'MW', label: 'Monday / Wednesday' },
                            { id: 'TR', label: 'Tuesday / Thursday' }
                        ],
                        timeSlots: [
                            { id: '10:00-12:20', label: '10:00-12:20', startMinutes: 10 * 60, endMinutes: (12 * 60) + 20 },
                            { id: '13:00-15:20', label: '13:00-15:20', startMinutes: 13 * 60, endMinutes: (15 * 60) + 20 },
                            { id: '16:00-18:20', label: '16:00-18:20', startMinutes: 16 * 60, endMinutes: (18 * 60) + 20 }
                        ]
                    }
                }
            })),
            getCurrentProfile: jest.fn(() => null),
            getDefaultProfile: jest.fn(() => null)
        },
        localStorage: localStorageObject
    };

    const sandbox = {
        window: windowObject,
        document: documentObject,
        localStorage: localStorageObject,
        fetch: jest.fn(async () => ({ ok: false, json: async () => ({}) })),
        setTimeout,
        clearTimeout,
        console
    };

    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: 'pages/schedule-builder.js' });

    return { windowObject, documentObject, sandbox };
}

describe('Schedule Builder profile-driven patterns', () => {
    test('uses profile storage prefix and minute-based slot buckets', async () => {
        const profileScheduler = {
            storageKeyPrefix: 'customPrefix_',
            dayPatterns: [{ id: 'MW', label: 'Mon/Wed' }],
            timeSlots: [
                { id: '08:00-09:00', label: '8-9 AM', startMinutes: 8 * 60, endMinutes: 9 * 60 },
                { id: '13:00-14:00', label: '1-2 PM', startMinutes: 13 * 60, endMinutes: 14 * 60 },
                { id: '17:00-18:00', label: '5-6 PM', startMinutes: 17 * 60, endMinutes: 18 * 60 }
            ]
        };

        const { documentObject, sandbox } = loadScheduleBuilderWindow({ profileScheduler });
        await documentObject.__domReadyHandler();

        expect(sandbox.getProgramCommandScheduleStorageKey('2026-27')).toBe('customPrefix_2026-27');
        expect(sandbox.getTimeBucketForKey('08:00-09:00')).toBe('morning');
        expect(sandbox.getTimeBucketForKey('13:00-14:00')).toBe('afternoon');
        expect(sandbox.getTimeBucketForKey('17:00-18:00')).toBe('evening');
    });
});

