# Invite-only user management setup

The scheduler uses Supabase Auth for password-based accounts, a `user_profiles` table for application roles, and the Node server for privileged account administration. Participants can read shared data and work with browser-local drafts. Only administrators can write shared database data or manage accounts.

> **Existing project status (2026-09-22):** `scripts/add-invite-only-auth.sql` has already been applied to the `ewu-schedule` production Supabase project (`ohnrhjxcjkrdtudpzjgn`). Do not rerun it there. The first administrator has been bootstrapped. Local sign-in, invite/role-change/removal, participant reads, and database denial of anonymous reads and participant inserts/updates were verified. Temporary test accounts were removed. The application changes are still local and uncommitted. The migration step below is for a new project or a deliberately planned reapplication after reviewing its policy changes.

## 1. Apply the database migration

Run [`scripts/add-invite-only-auth.sql`](../scripts/add-invite-only-auth.sql) in the Supabase SQL editor after the base schema and seed data. The migration:

- creates `user_profiles` with `participant` and `admin` roles;
- gives every newly invited account the `participant` role by default;
- removes anonymous table access;
- allows signed-in users to read scheduler data;
- allows shared inserts, updates, and deletes only when `is_admin()` is true; and
- removes client access to the legacy schedule-sync function so it cannot bypass row-level security.

The migration replaces every existing RLS policy on the scheduler tables. It also removes application profiles for accounts linked to a non-email provider. If this project already has custom policies or user profiles, export them before running the migration and review the affected accounts first.

After the migration, verify that the legacy sync function is no longer executable by either browser role:

```sql
SELECT
  p.oid::REGPROCEDURE AS function_name,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'sync_scheduled_courses_for_academic_year';
```

Both privilege columns must be `false` for every returned overload.

## 2. Make the first administrator

Create or invite the first trusted email account in **Supabase → Authentication → Users**, then run:

```sql
INSERT INTO public.user_profiles (id, email, display_name, role)
SELECT id, email, raw_user_meta_data ->> 'display_name', 'admin'
FROM auth.users
WHERE email = 'your-email@ewu.edu'
  AND public.is_email_only_provider(raw_app_meta_data)
ON CONFLICT (id) DO UPDATE
SET role = 'admin', updated_at = NOW();
```

Once that administrator can sign in, use **Users** inside the scheduler for later invitations and role changes.

## 3. Enforce invite-only authentication

In **Supabase → Authentication → Providers**:

1. Keep **Email** enabled.
2. Turn off public email sign-ups. The setting may be labeled **Allow new users to sign up** or **Enable sign ups**, depending on the current dashboard.
3. Leave Google, Apple, and every other social provider disabled.

The application contains no sign-up or OAuth method, but disabling these settings in Supabase is the security boundary that prevents someone from bypassing the interface with the public project key.

In **Authentication → URL Configuration**, set **Site URL** to the origin of the deployed Node application, not `http://localhost:3000`. Add the deployed login route to **Redirect URLs**. Use an exact production route, for example:

```text
https://scheduler.example.edu/login.html
```

Keep `http://127.0.0.1:5055/**` as an additional redirect only while local testing is needed. The production server's `APP_URL` must use the same deployed origin as the Site URL. Supabase falls back to Site URL when a redirect is omitted or not allowlisted, so the default localhost value would break those email links for other users. A static GitHub Pages deployment cannot serve this application's `/api/admin/users` endpoints; use the Node-hosted deployment URL for production invitations.

## 4. Configure the Node server

Set these secrets in Replit or the production environment. Start from [`.env.example`](../.env.example).

```text
APP_URL=https://scheduler.example.edu
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_replace_me
```

Use the Supabase secret key, or the legacy `service_role` key through `SUPABASE_SERVICE_ROLE_KEY`. Never put either key in browser JavaScript. `APP_URL` controls where invitation links return after the recipient accepts them.

Restart `node api-server.js` after adding the variables.

## 5. Verify both roles

1. Sign in as an administrator and open **Users**.
2. Invite a participant account.
3. Accept the email invitation and create a password of at least 12 characters.
4. Confirm the participant can open dashboards, adjust a local schedule, and save a local draft.
5. Confirm shared save and account-management controls are unavailable.
6. Confirm direct insert, update, and delete requests made with the participant session are rejected by Supabase.
7. Change the account to Administrator and confirm shared save becomes available after signing in again or refreshing the page.

Invitation delivery depends on the Supabase project’s email configuration. For regular use, configure custom SMTP in Supabase so invitations come from an address your users recognize.
