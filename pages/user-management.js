(function initializeUserManagement(global, document) {
    'use strict';

    const tableBody = document.getElementById('usersTableBody');
    const userCount = document.getElementById('userCount');
    const errorBox = document.getElementById('usersError');
    const removeDialog = document.getElementById('removeUserDialog');
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
    let users = [];
    let pendingRemoval = null;
    let usersRequestGeneration = 0;

    function formatDate(value) {
        if (!value) return 'Never';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Never';
        return dateFormatter.format(date);
    }

    function setError(message = '') {
        errorBox.textContent = message;
        errorBox.hidden = !message;
    }

    async function parseResponse(response) {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
        return payload;
    }

    function buildCell(text) {
        const cell = document.createElement('td');
        cell.textContent = text;
        return cell;
    }

    function renderUsers() {
        tableBody.replaceChildren();
        userCount.textContent = `${users.length} ${users.length === 1 ? 'user' : 'users'}`;
        const currentUserId = global.AuthService.getProfile()?.id;

        users.forEach((user) => {
            const row = document.createElement('tr');
            const identityCell = document.createElement('td');
            const email = document.createElement('strong');
            email.textContent = user.email;
            identityCell.append(email);
            if (user.id === currentUserId) {
                const you = document.createElement('span');
                you.className = 'you-label';
                you.textContent = 'You';
                identityCell.append(you);
            }
            row.append(identityCell);

            const status = user.emailConfirmedAt ? 'Active' : 'Invited';
            const statusCell = buildCell(status);
            statusCell.dataset.status = status.toLowerCase();
            row.append(statusCell, buildCell(formatDate(user.lastSignInAt)));

            const roleCell = document.createElement('td');
            const roleSelect = document.createElement('select');
            roleSelect.className = 'role-select';
            roleSelect.setAttribute('aria-label', `Role for ${user.email}`);
            roleSelect.disabled = user.id === currentUserId;
            [['participant', 'Participant'], ['admin', 'Administrator']].forEach(([value, label]) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = label;
                option.selected = value === user.role;
                roleSelect.append(option);
            });
            roleSelect.addEventListener('change', async () => {
                const requestedRole = roleSelect.value;
                roleSelect.disabled = true;
                try {
                    const response = await global.AuthService.authorizedFetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ role: requestedRole })
                    });
                    await parseResponse(response);
                    await loadUsers();
                } catch (error) {
                    roleSelect.value = user.role;
                    setError(error.message);
                } finally {
                    roleSelect.disabled = user.id === currentUserId;
                }
            });
            roleCell.append(roleSelect);
            row.append(roleCell);

            const actionsCell = document.createElement('td');
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'remove-user-button';
            removeButton.textContent = 'Remove';
            removeButton.disabled = user.id === currentUserId;
            removeButton.addEventListener('click', () => {
                pendingRemoval = user;
                removeDialog.returnValue = '';
                document.getElementById('removeUserMessage').textContent = `Remove ${user.email} from the scheduler? Their account will no longer be able to sign in.`;
                removeDialog.showModal();
            });
            actionsCell.append(removeButton);
            row.append(actionsCell);
            tableBody.append(row);
        });
    }

    async function loadUsers() {
        const generation = ++usersRequestGeneration;
        setError();
        userCount.textContent = 'Loading users…';
        try {
            const response = await global.AuthService.authorizedFetch('/api/admin/users');
            const payload = await parseResponse(response);
            if (generation !== usersRequestGeneration) return;
            users = payload.users || [];
            renderUsers();
        } catch (error) {
            if (generation !== usersRequestGeneration) return;
            userCount.textContent = 'Users could not be loaded';
            setError(error.message);
        }
    }

    document.getElementById('inviteForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const message = document.getElementById('inviteMessage');
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        message.textContent = 'Sending invitation…';
        message.classList.remove('is-error');
        try {
            const response = await global.AuthService.authorizedFetch('/api/admin/users/invite', {
                method: 'POST',
                body: JSON.stringify({
                    email: document.getElementById('inviteEmail').value,
                    role: document.getElementById('inviteRole').value
                })
            });
            const payload = await parseResponse(response);
            message.textContent = `Invitation sent to ${payload.user.email}.`;
            form.reset();
            await loadUsers();
        } catch (error) {
            message.textContent = error.message;
            message.classList.add('is-error');
        } finally {
            submit.disabled = false;
        }
    });

    removeDialog.addEventListener('close', async () => {
        const target = pendingRemoval;
        pendingRemoval = null;
        if (removeDialog.returnValue !== 'confirm' || !target) return;
        try {
            const response = await global.AuthService.authorizedFetch(`/api/admin/users/${encodeURIComponent(target.id)}`, {
                method: 'DELETE'
            });
            await parseResponse(response);
            await loadUsers();
        } catch (error) {
            setError(error.message);
        }
    });

    document.getElementById('refreshUsersButton').addEventListener('click', loadUsers);
    Promise.resolve(global.authReady).then(() => {
        if (global.AuthService.isAdmin()) loadUsers();
    });
})(window, document);
