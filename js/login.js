(function initializeLogin(global, document) {
    'use strict';

    const signInForm = document.getElementById('signInForm');
    const setPasswordForm = document.getElementById('setPasswordForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const query = new URLSearchParams(global.location.search);
    const inviteOrRecoveryFlow = query.has('invited') || query.has('recovery') || /(?:type=invite|type=recovery)/.test(global.location.hash);

    function safeReturnTo() {
        const requested = query.get('returnTo');
        if (!requested) return '/index.html';
        try {
            const target = new URL(requested, global.location.origin);
            if (target.origin !== global.location.origin) return '/index.html';
            return target.href;
        } catch {
            return '/index.html';
        }
    }

    function showOnly(form) {
        [signInForm, setPasswordForm, resetPasswordForm].forEach((candidate) => {
            candidate.hidden = candidate !== form;
        });
        form.querySelector('input')?.focus();
    }

    function setMessage(id, message, isError = false) {
        const element = document.getElementById(id);
        element.textContent = message;
        element.classList.toggle('is-error', isError);
    }

    function setBusy(form, busy) {
        form.querySelectorAll('button, input').forEach((element) => {
            element.disabled = busy;
        });
    }

    signInForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setBusy(signInForm, true);
        setMessage('signInMessage', 'Signing in…');
        try {
            await global.AuthService.signIn(
                document.getElementById('email').value,
                document.getElementById('password').value
            );
            global.location.replace(safeReturnTo());
        } catch (error) {
            setMessage('signInMessage', error.message || 'Sign-in failed.', true);
            setBusy(signInForm, false);
        }
    });

    setPasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const password = document.getElementById('newPassword').value;
        const confirmation = document.getElementById('confirmPassword').value;
        if (password !== confirmation) {
            setMessage('passwordMessage', 'The passwords do not match.', true);
            return;
        }

        setBusy(setPasswordForm, true);
        setMessage('passwordMessage', 'Saving your password…');
        try {
            await global.AuthService.updatePassword(password);
            global.location.replace(safeReturnTo());
        } catch (error) {
            setMessage('passwordMessage', error.message || 'Password could not be saved.', true);
            setBusy(setPasswordForm, false);
        }
    });

    resetPasswordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setBusy(resetPasswordForm, true);
        setMessage('resetMessage', 'Sending reset link…');
        try {
            const redirectTo = `${global.location.origin}/login.html?recovery=1`;
            await global.AuthService.requestPasswordReset(
                document.getElementById('resetEmail').value,
                redirectTo
            );
            setMessage('resetMessage', 'Check your email for a reset link.');
        } catch (error) {
            setMessage('resetMessage', error.message || 'The reset link could not be sent.', true);
        } finally {
            setBusy(resetPasswordForm, false);
        }
    });

    document.getElementById('showResetButton').addEventListener('click', () => {
        document.getElementById('resetEmail').value = document.getElementById('email').value;
        showOnly(resetPasswordForm);
    });
    document.getElementById('backToSignInButton').addEventListener('click', () => showOnly(signInForm));

    Promise.resolve(global.authReady).then((state) => {
        if (inviteOrRecoveryFlow && state.authenticated) {
            showOnly(setPasswordForm);
        } else if (state.authenticated) {
            global.location.replace(safeReturnTo());
        } else {
            showOnly(signInForm);
            if (query.has('timeout')) {
                setMessage('signInMessage', 'Your session ended after a period of inactivity.');
            }
        }
    }).catch(() => {
        setMessage('signInMessage', 'Sign-in is temporarily unavailable.', true);
    });
})(window, document);
