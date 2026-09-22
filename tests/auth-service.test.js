const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createQuery(result) {
    const query = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        single: jest.fn(async () => result)
    };
    return query;
}

function loadAuthService({ role = 'participant', sessionUser = null, profileMissing = false } = {}) {
    const source = fs.readFileSync(path.resolve(__dirname, '../js/auth-service.js'), 'utf8');
    const user = sessionUser || { id: 'user-1', email: 'person@example.edu' };
    const profileQuery = createQuery(profileMissing
        ? { data: null, error: { code: 'PGRST116' } }
        : { data: { id: user.id, email: user.email, role }, error: null });
    const auth = {
        getSession: jest.fn(async () => ({ data: { session: { user, access_token: 'token-1' } }, error: null })),
        getUser: jest.fn(async () => ({ data: { user }, error: null })),
        signInWithPassword: jest.fn(async () => ({ data: { user, session: { user, access_token: 'token-1' } }, error: null })),
        signOut: jest.fn(async () => ({ error: null })),
        updateUser: jest.fn(async () => ({ data: { user }, error: null })),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }))
    };
    const client = {
        auth,
        from: jest.fn(() => profileQuery)
    };
    const windowObject = {
        getSupabaseClient: jest.fn(() => client),
        fetch: jest.fn()
    };
    const sandbox = {
        window: windowObject,
        document: { addEventListener: jest.fn() },
        console,
        CustomEvent: function CustomEvent(type, options) {
            return { type, detail: options?.detail };
        }
    };
    windowObject.window = windowObject;
    windowObject.document = sandbox.document;
    windowObject.dispatchEvent = jest.fn();

    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: 'js/auth-service.js' });

    return { AuthService: windowObject.AuthService, auth };
}

describe('AuthService invite-only access', () => {
    test('participants can read and interact locally but cannot write shared data', async () => {
        const { AuthService } = loadAuthService({ role: 'participant' });
        await AuthService.initialize();

        expect(AuthService.can('read', 'schedule')).toBe(true);
        expect(AuthService.can('interact', 'schedule')).toBe(true);
        expect(AuthService.can('write', 'schedule')).toBe(false);
        expect(AuthService.can('manage', 'accounts')).toBe(false);
    });

    test('admins can write shared data and manage accounts', async () => {
        const { AuthService } = loadAuthService({ role: 'admin' });
        await AuthService.initialize();

        expect(AuthService.can('write', 'schedule')).toBe(true);
        expect(AuthService.can('manage', 'accounts')).toBe(true);
    });

    test('sign-in uses email and password without exposing sign-up or social auth', async () => {
        const { AuthService, auth } = loadAuthService({ role: 'participant' });
        await AuthService.signIn('person@example.edu', 'correct horse battery staple');

        expect(auth.signInWithPassword).toHaveBeenCalledWith({
            email: 'person@example.edu',
            password: 'correct horse battery staple'
        });
        expect(AuthService.signUp).toBeUndefined();
        expect(AuthService.signInWithOAuth).toBeUndefined();
    });

    test('a valid Supabase session without an invited profile gets no application access', async () => {
        const { AuthService, auth } = loadAuthService({ profileMissing: true });

        await expect(AuthService.signIn('social@example.edu', 'password123456')).rejects.toThrow(/invited/i);
        expect(auth.signOut).toHaveBeenCalled();
        expect(AuthService.isAuthenticated()).toBe(false);
    });
});
