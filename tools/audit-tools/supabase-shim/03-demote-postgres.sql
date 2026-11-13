-- ចម្លងបេះបិទពី https://raw.githubusercontent.com/supabase/postgres/develop/migrations/db/migrations/10000000000000_demote-postgres.sql
-- អាជ្ញាប័ណ្ណ ៖ The PostgreSQL License · Copyright (c) 2020, Supabase ➜ អត្ថបទពេញ LICENSES/PostgreSQL-supabase-postgres.txt
-- migrate:up

-- demote postgres user
GRANT ALL ON DATABASE postgres TO postgres;
GRANT ALL ON SCHEMA auth TO postgres;
GRANT ALL ON SCHEMA extensions TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA extensions TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA extensions TO postgres;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO postgres;
GRANT ALL ON ALL ROUTINES IN SCHEMA extensions TO postgres;
do $$
begin
  if exists (select from pg_namespace where nspname = 'storage') then
    GRANT ALL ON SCHEMA storage TO postgres;
    GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres;
    GRANT ALL ON ALL ROUTINES IN SCHEMA storage TO postgres;
  end if;
end $$;
ALTER ROLE postgres NOSUPERUSER CREATEDB CREATEROLE LOGIN REPLICATION BYPASSRLS;

-- migrate:down

-- ចម្លងបេះបិទពី https://raw.githubusercontent.com/supabase/postgres/develop/migrations/db/migrations/20230201083204_grant_auth_roles_to_postgres.sql
-- migrate:up
grant anon, authenticated, service_role to postgres;

-- migrate:down


-- ពី https://raw.githubusercontent.com/supabase/postgres/develop/migrations/db/migrations/20220609081115_grant-supabase-auth-admin-and-supabase-storage-admin-to-postgres.sql
-- ⛔ រំលង supabase_storage_admin ៖ shim នេះមិនដំឡើង storage schema (00000000000002) ទេ
grant supabase_auth_admin to postgres;
