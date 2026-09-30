-- ចម្លងពី https://raw.githubusercontent.com/supabase/auth/master/migrations/20220224000811_update_auth_functions.up.sql
--      និង https://raw.githubusercontent.com/supabase/auth/master/migrations/20220531120530_add_auth_jwt_function.up.sql
-- អាជ្ញាប័ណ្ណ ៖ MIT · Copyright (c) 2021-2025 Supabase ➜ អត្ថបទពេញ LICENSES/MIT-supabase-auth.txt
-- ⛔ ការប្តូរតែមួយ ៖ {{ index .Options "Namespace" }} ➜ auth (GoTrue ជំនួសវាពេល migrate)
-- update auth functions

create or replace function auth.uid() 
returns uuid 
language sql stable
as $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() 
returns text 
language sql stable
as $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create or replace function auth.email() 
returns text 
language sql stable
as $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;
-- add auth.jwt function

comment on function auth.uid() is 'Deprecated. Use auth.jwt() -> ''sub'' instead.';
comment on function auth.role() is 'Deprecated. Use auth.jwt() -> ''role'' instead.';
comment on function auth.email() is 'Deprecated. Use auth.jwt() -> ''email'' instead.';

create or replace function auth.jwt()
returns jsonb
language sql stable
as $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;
