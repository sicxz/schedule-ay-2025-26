-- Invite-only authentication and role-based access for the scheduler.
-- Run this migration in the Supabase SQL editor after the base schema.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('admin', 'participant')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_email_only_provider(app_metadata JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(app_metadata ->> 'provider', '') = 'email'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        COALESCE(app_metadata -> 'providers', '["email"]'::JSONB)
      ) AS provider_entry(value)
      WHERE value <> 'email'
    );
$$;

REVOKE ALL ON FUNCTION public.is_email_only_provider(JSONB) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.has_scheduler_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles profile
    JOIN auth.users auth_user ON auth_user.id = profile.id
    WHERE profile.id = auth.uid()
      AND public.is_email_only_provider(auth_user.raw_app_meta_data)
  );
$$;

REVOKE ALL ON FUNCTION public.has_scheduler_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_scheduler_access() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles profile
    JOIN auth.users auth_user ON auth_user.id = profile.id
    WHERE profile.id = auth.uid()
      AND profile.role = 'admin'
      AND public.is_email_only_provider(auth_user.raw_app_meta_data)
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_email_only_provider(NEW.raw_app_meta_data)
     OR NEW.invited_at IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name'),
    'participant'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(public.user_profiles.display_name, EXCLUDED.display_name),
        updated_at = NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

INSERT INTO public.user_profiles (id, email, display_name, role)
SELECT
  id,
  COALESCE(email, ''),
  COALESCE(raw_user_meta_data ->> 'display_name', raw_user_meta_data ->> 'full_name'),
  'participant'
FROM auth.users
WHERE public.is_email_only_provider(raw_app_meta_data)
  AND invited_at IS NOT NULL
ON CONFLICT (id) DO NOTHING;

DELETE FROM public.user_profiles profile
USING auth.users auth_user
WHERE profile.id = auth_user.id
  AND NOT public.is_email_only_provider(auth_user.raw_app_meta_data);

REVOKE ALL ON TABLE public.user_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_profiles TO authenticated;

DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
  LOOP
    EXECUTE FORMAT('DROP POLICY IF EXISTS %I ON public.user_profiles', policy_name);
  END LOOP;
END;
$$;

CREATE POLICY "Users read own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (public.has_scheduler_access() AND (id = auth.uid() OR public.is_admin()));

-- An exposed SECURITY DEFINER schedule sync could bypass table RLS. The app
-- has a client-side diff fallback, so revoke direct client execution for every
-- overload of this legacy helper.
DO $$
DECLARE
  function_signature REGPROCEDURE;
BEGIN
  FOR function_signature IN
    SELECT p.oid::REGPROCEDURE
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'sync_scheduled_courses_for_academic_year'
  LOOP
    EXECUTE FORMAT('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', function_signature);
  END LOOP;
END;
$$;

-- Remove the permissive starter policies and replace them with authenticated
-- reads plus admin-only writes. Grants allow the operation; RLS decides which
-- signed-in users may perform it.
DO $$
DECLARE
  table_name TEXT;
  policy_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'departments',
    'academic_years',
    'rooms',
    'courses',
    'faculty',
    'scheduled_courses',
    'faculty_preferences',
    'scheduling_constraints',
    'release_time'
  ]
  LOOP
    EXECUTE FORMAT('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    FOR policy_name IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
    LOOP
      EXECUTE FORMAT('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
    END LOOP;

    EXECUTE FORMAT('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE FORMAT('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', table_name);

    EXECUTE FORMAT(
      'CREATE POLICY "Authenticated read" ON public.%I FOR SELECT TO authenticated USING (public.has_scheduler_access())',
      table_name
    );
    EXECUTE FORMAT(
      'CREATE POLICY "Admins insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin())',
      table_name
    );
    EXECUTE FORMAT(
      'CREATE POLICY "Admins update" ON public.%I FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      table_name
    );
    EXECUTE FORMAT(
      'CREATE POLICY "Admins delete" ON public.%I FOR DELETE TO authenticated USING (public.is_admin())',
      table_name
    );
  END LOOP;
END;
$$;

COMMIT;

-- Bootstrap one trusted email account as administrator. Replace the email and
-- run this statement separately after the migration:
-- INSERT INTO public.user_profiles (id, email, display_name, role)
-- SELECT id, email, raw_user_meta_data ->> 'display_name', 'admin'
-- FROM auth.users
-- WHERE email = 'you@example.edu'
--   AND public.is_email_only_provider(raw_app_meta_data)
-- ON CONFLICT (id) DO UPDATE SET role = 'admin', updated_at = NOW();
