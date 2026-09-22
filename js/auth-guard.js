/**
 * Protects scheduler pages and adds a small, consistent account control.
 */
(function createAuthGuard(global) {
    'use strict';

    if (global.AuthGuard) return;
    let unsubscribeFromAuth = null;

    function currentReturnPath() {
        return `${global.location.pathname}${global.location.search}${global.location.hash}`;
    }

    function redirectToLogin() {
        global.location.replace(`/login.html?returnTo=${encodeURIComponent(currentReturnPath())}`);
    }

    function applyPermissionState() {
        const isAdmin = global.AuthService.isAdmin();
        document.documentElement.dataset.authRole = global.AuthService.getRole();

        document.querySelectorAll('[data-auth-action="write"], [data-auth-role="admin"]').forEach((element) => {
            if (!isAdmin && element.dataset.authRole === 'admin') element.hidden = true;
            if (!isAdmin && element.dataset.authAction === 'write') {
                element.disabled = true;
                element.setAttribute('aria-disabled', 'true');
                element.title = 'Only administrators can save shared changes.';
            }
        });
    }

    function renderAccountControl() {
        document.getElementById('authAccountControl')?.remove();

        const profile = global.AuthService.getProfile();
        const userLabel = profile?.display_name || profile?.email || 'Signed in';
        const role = global.AuthService.getRole();
        const control = document.createElement('aside');
        control.id = 'authAccountControl';
        control.className = 'auth-account-control';
        control.setAttribute('aria-label', 'Account controls');

        const identity = document.createElement('div');
        identity.className = 'auth-account-identity';
        const name = document.createElement('strong');
        name.textContent = userLabel;
        const roleLabel = document.createElement('span');
        roleLabel.textContent = role === 'admin' ? 'Administrator' : 'Participant';
        identity.append(name, roleLabel);
        control.append(identity);

        if (role === 'admin') {
            const usersLink = document.createElement('a');
            usersLink.href = '/pages/user-management.html';
            usersLink.textContent = 'Users';
            control.append(usersLink);
        }

        const signOutButton = document.createElement('button');
        signOutButton.type = 'button';
        signOutButton.textContent = 'Sign out';
        signOutButton.addEventListener('click', async () => {
            signOutButton.disabled = true;
            try {
                await global.AuthService.signOut();
                global.location.replace('/login.html');
            } catch (error) {
                signOutButton.disabled = false;
                console.error('Sign out failed:', error);
            }
        });
        control.append(signOutButton);
        document.body.append(control);
    }

    function reconcileProtectedPage(state) {
        if (!state.authenticated) {
            redirectToLogin();
            return false;
        }
        const requiredRole = document.body?.dataset?.requiresRole;
        if (requiredRole === 'admin' && !global.AuthService.isAdmin()) {
            global.location.replace('/index.html?permission=denied');
            return false;
        }
        renderAccountControl();
        applyPermissionState();
        return true;
    }

    async function initialize({ publicPage = false } = {}) {
        try {
            const state = await global.AuthService.initialize();
            if (!publicPage) {
                if (!reconcileProtectedPage(state)) return state;
                if (!unsubscribeFromAuth) {
                    unsubscribeFromAuth = global.AuthService.subscribe(reconcileProtectedPage);
                }
            }

            document.documentElement.classList.remove('auth-pending');
            global.dispatchEvent(new CustomEvent('auth-ready', { detail: state }));
            return state;
        } catch (error) {
            document.documentElement.classList.remove('auth-pending');
            document.body.innerHTML = `
                <main class="auth-fatal" role="alert">
                    <h1>Sign-in is unavailable</h1>
                    <p>The scheduler could not connect to its authentication service.</p>
                    <button type="button" onclick="window.location.reload()">Try again</button>
                </main>`;
            console.error('Authentication initialization failed:', error);
            throw error;
        }
    }

    global.AuthGuard = Object.freeze({ initialize, applyPermissionState });
})(window);
