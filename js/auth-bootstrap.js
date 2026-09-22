(function bootstrapAuthentication(global, document) {
    'use strict';

    const script = document.currentScript;
    const publicPage = script?.dataset?.publicPage === 'true';
    document.documentElement.classList.add('auth-pending');

    const loadingStyle = document.createElement('style');
    loadingStyle.textContent = '.auth-pending body { visibility: hidden; }';
    document.head.appendChild(loadingStyle);

    function loadScript(src, isReady) {
        if (isReady()) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const element = document.createElement('script');
            element.src = src;
            const timeout = global.setTimeout(() => {
                element.remove();
                reject(new Error(`Timed out while loading ${src}`));
            }, 12000);
            element.onload = () => {
                global.clearTimeout(timeout);
                resolve();
            };
            element.onerror = () => {
                global.clearTimeout(timeout);
                reject(new Error(`Could not load ${src}`));
            };
            document.head.appendChild(element);
        });
    }

    function showBootstrapError(error) {
        const render = () => {
            document.documentElement.classList.remove('auth-pending');
            if (!document.querySelector('.auth-fatal')) {
                document.body.innerHTML = `
                    <main class="auth-fatal" role="alert">
                        <h1>Sign-in is unavailable</h1>
                        <p>The scheduler could not load its authentication service.</p>
                        <button type="button" onclick="window.location.reload()">Try again</button>
                    </main>`;
            }
            console.error('Authentication bootstrap failed:', error);
        };
        if (document.body) render();
        else document.addEventListener('DOMContentLoaded', render, { once: true });
    }

    function loadStylesheet(href) {
        if (document.querySelector(`link[href="${href}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    global.authReady = (async () => {
        loadStylesheet('/css/auth.css');
        await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', () => Boolean(global.supabaseJs?.createClient || global.supabase?.createClient));
        await loadScript('/js/supabase-config.js', () => Boolean(global.getSupabaseClient));
        global.getSupabaseClient();
        await loadScript('/js/auth-service.js', () => Boolean(global.AuthService));
        await loadScript('/js/auth-guard.js', () => Boolean(global.AuthGuard));

        if (document.readyState === 'loading') {
            await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
        }
        return global.AuthGuard.initialize({ publicPage });
    })().catch((error) => {
        showBootstrapError(error);
        throw error;
    });
})(window, document);
