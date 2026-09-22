/**
 * Invite-only authentication and application permissions.
 *
 * Accounts are created by an administrator through the server API. This
 * client intentionally exposes password sign-in only: there is no sign-up or
 * OAuth entry point.
 */
(function initializeAuthService(global) {
    'use strict';

    if (global.AuthService) return;

    const READ_ACTIONS = new Set(['read', 'interact', 'export']);
    const listeners = new Set();
    let currentSession = null;
    let currentUser = null;
    let currentProfile = null;
    let initializePromise = null;
    let authSubscription = null;
    let sessionGeneration = 0;
    let latestSessionUpdate = Promise.resolve();

    function getClient() {
        const client = global.getSupabaseClient?.();
        if (!client?.auth) {
            throw new Error('Authentication is unavailable because Supabase is not configured.');
        }
        return client;
    }

    function normalizeRole(role) {
        return role === 'admin' ? 'admin' : 'participant';
    }

    function snapshot() {
        return Object.freeze({
            session: currentSession,
            user: currentUser,
            profile: currentProfile,
            role: normalizeRole(currentProfile?.role),
            authenticated: Boolean(currentUser && currentProfile)
        });
    }

    function notify() {
        const state = snapshot();
        listeners.forEach((listener) => {
            try {
                listener(state);
            } catch (error) {
                console.error('Authentication listener failed:', error);
            }
        });
        global.dispatchEvent?.(new CustomEvent('auth-state-changed', { detail: state }));
    }

    async function loadProfile(user) {
        if (!user?.id) return null;

        const { data, error } = await getClient()
            .from('user_profiles')
            .select('id, email, display_name, role, created_at, updated_at')
            .eq('id', user.id)
            .single();

        if (error?.code === 'PGRST116') return null;
        if (error) throw error;

        return { ...data, role: normalizeRole(data?.role) };
    }

    function applySession(session) {
        const generation = ++sessionGeneration;
        const nextSession = session || null;
        const nextUser = session?.user || null;
        const update = (async () => {
            const nextProfile = nextUser ? await loadProfile(nextUser) : null;
            if (generation !== sessionGeneration) return latestSessionUpdate;
            currentSession = nextSession;
            currentUser = nextUser;
            currentProfile = nextProfile;
            notify();
            return snapshot();
        })();
        latestSessionUpdate = update;
        return update;
    }

    async function initialize() {
        if (initializePromise) return initializePromise;

        initializePromise = (async () => {
            const client = getClient();
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            await applySession(data?.session || null);

            if (!authSubscription) {
                const result = client.auth.onAuthStateChange((_event, session) => {
                    Promise.resolve().then(() => applySession(session)).catch((authError) => {
                        console.error('Could not refresh the signed-in user:', authError);
                    });
                });
                authSubscription = result?.data?.subscription || null;
            }

            return snapshot();
        })().catch((error) => {
            initializePromise = null;
            throw error;
        });

        return initializePromise;
    }

    async function signIn(email, password) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        if (!normalizedEmail || !password) {
            throw new Error('Enter your email address and password.');
        }

        const { data, error } = await getClient().auth.signInWithPassword({
            email: normalizedEmail,
            password
        });
        if (error) throw error;
        const state = await applySession(data?.session || null);
        if (!state.authenticated) {
            await getClient().auth.signOut();
            await applySession(null);
            throw new Error('This account has not been invited to the scheduler.');
        }
        return state;
    }

    async function updatePassword(password) {
        if (typeof password !== 'string' || password.length < 12) {
            throw new Error('Use a password with at least 12 characters.');
        }
        const { data, error } = await getClient().auth.updateUser({ password });
        if (error) throw error;
        if (data?.user) currentUser = data.user;
        notify();
        return snapshot();
    }

    async function requestPasswordReset(email, redirectTo) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        if (!normalizedEmail) throw new Error('Enter your email address.');

        const options = redirectTo ? { redirectTo } : undefined;
        const { error } = await getClient().auth.resetPasswordForEmail(normalizedEmail, options);
        if (error) throw error;
    }

    async function signOut() {
        const { error } = await getClient().auth.signOut();
        if (error) throw error;
        initializePromise = null;
        await applySession(null);
    }

    function can(action) {
        if (!currentUser || !currentProfile) return false;
        if (READ_ACTIONS.has(action)) return true;
        return normalizeRole(currentProfile?.role) === 'admin';
    }

    async function authorizedFetch(url, options = {}) {
        await initialize();
        if (!currentSession?.access_token) {
            throw new Error('Your session has expired. Sign in again.');
        }

        const headers = new Headers(options.headers || {});
        headers.set('Authorization', `Bearer ${currentSession.access_token}`);
        if (options.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        const response = await global.fetch(url, { ...options, headers });
        if (response.status === 401) {
            initializePromise = null;
        }
        return response;
    }

    function subscribe(listener) {
        if (typeof listener !== 'function') return () => {};
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    global.AuthService = Object.freeze({
        initialize,
        signIn,
        signOut,
        updatePassword,
        requestPasswordReset,
        authorizedFetch,
        subscribe,
        can,
        getSession: () => currentSession,
        getUser: async () => currentUser,
        getProfile: () => currentProfile,
        getRole: () => normalizeRole(currentProfile?.role),
        isAuthenticated: () => Boolean(currentUser && currentProfile),
        isAdmin: () => Boolean(currentUser && currentProfile) && normalizeRole(currentProfile?.role) === 'admin'
    });
})(window);
