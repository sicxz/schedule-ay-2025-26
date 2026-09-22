const fs = require('fs');
const path = require('path');

describe('authentication bootstrap', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        document.documentElement.innerHTML = '<head></head><body></body>';
        delete window.authReady;
        delete window.AuthGuard;
        delete window.AuthService;
        delete window.getSupabaseClient;
        delete window.supabase;
        delete window.supabaseJs;
    });

    test('shows a visible retry state when an authentication dependency fails to load', async () => {
        const source = fs.readFileSync(path.resolve(__dirname, '../js/auth-bootstrap.js'), 'utf8');
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        window.eval(source);

        const failure = window.authReady.catch((error) => error);
        const sdkScript = document.querySelector('script[src*="supabase-js"]');
        expect(sdkScript).not.toBeNull();
        sdkScript.onerror();

        const error = await failure;
        expect(error.message).toMatch(/could not load/i);
        expect(document.documentElement.classList.contains('auth-pending')).toBe(false);
        expect(document.querySelector('.auth-fatal')).not.toBeNull();
        expect(document.body.textContent).toMatch(/try again/i);
        expect(consoleError).toHaveBeenCalled();
    });
});
