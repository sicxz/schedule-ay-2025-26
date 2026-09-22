const fs = require('fs');
const path = require('path');

describe('invite-only database authorization migration', () => {
    const migrationPath = path.resolve(__dirname, '../scripts/add-invite-only-auth.sql');

    test('removes anonymous data access and limits shared writes to admins', () => {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        expect(sql).toMatch(/revoke all.+from public, anon, authenticated/i);
        expect(sql).toMatch(/to authenticated[\s\S]+is_admin/i);
        expect(sql).not.toMatch(/create policy\s+"Public write"/i);
        expect(sql).toMatch(/from pg_policies[\s\S]+drop policy/i);
    });

    test('creates participant profiles for invited users by default', () => {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        expect(sql).toMatch(/create table[^;]+user_profiles/i);
        expect(sql).toMatch(/'participant'/i);
        expect(sql).toMatch(/after insert on auth\.users/i);
        expect(sql).toMatch(/function public\.is_email_only_provider[\s\S]+provider[\s\S]+providers[\s\S]+value\s+<>\s+'email'/i);
        expect(sql).toMatch(/is_email_only_provider\(NEW\.raw_app_meta_data\)/i);
        expect(sql).toMatch(/invited_at\s+is\s+not\s+null/i);
    });

    test('requires an invited application profile for every shared read', () => {
        const sql = fs.readFileSync(migrationPath, 'utf8');

        expect(sql).toMatch(/function public\.has_scheduler_access/i);
        expect(sql).toMatch(/"Authenticated read"[\s\S]+has_scheduler_access/i);
    });
});
