-- Keep the Supabase project active by exposing a minimal read-only RPC.
-- Run this in the Supabase SQL Editor before enabling the GitHub workflow.

create or replace function public.keep_alive()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select now();
$$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon;
