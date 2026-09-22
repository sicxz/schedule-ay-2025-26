/**
 * Browser Supabase configuration.
 * The publishable/anon key is safe to expose; authorization is enforced by RLS.
 */
(function configureSupabase(global) {
    'use strict';

    const projectUrl = 'https://ohnrhjxcjkrdtudpzjgn.supabase.co';
    const publishableKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obnJoanhjamtyZHR1ZHB6amduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NDQ2NzAsImV4cCI6MjA4MDUyMDY3MH0.XN1CC0xC5dizIhF4cIEkv90TApJHXRBYTC7a6AXPvtU';

    if (global.supabase?.createClient) global.supabaseJs = global.supabase;

    global.SUPABASE_URL = projectUrl;
    global.SUPABASE_ANON_KEY = publishableKey;
    global.CURRENT_DEPARTMENT_CODE = global.CURRENT_DEPARTMENT_CODE || 'DESN';

    global.isSupabaseConfigured = function isSupabaseConfigured() {
        return Boolean(
            global.SUPABASE_URL &&
            global.SUPABASE_ANON_KEY &&
            global.SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL' &&
            global.SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY'
        );
    };

    global.initSupabase = function initSupabase() {
        if (global.supabaseClient) {
            global.supabase = global.supabaseClient;
            return global.supabaseClient;
        }
        if (!global.isSupabaseConfigured()) {
            console.warn('Supabase is not configured.');
            return null;
        }
        const sdk = global.supabaseJs || global.supabase;
        if (!sdk?.createClient) {
            console.error('Supabase JS has not loaded.');
            return null;
        }

        global.supabaseClient = sdk.createClient(
            global.SUPABASE_URL,
            global.SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );
        global.supabase = global.supabaseClient;
        return global.supabaseClient;
    };

    global.getSupabaseClient = function getSupabaseClient() {
        return global.supabaseClient || global.initSupabase();
    };

    global.supabaseClient = global.supabaseClient || null;
    if (global.supabaseJs?.createClient) global.initSupabase();
})(window);
