do $zoe_move$
declare
    sig text;
begin
    foreach sig in array array[
        'my_account()',
        'admin_create_tenant(text, text, timestamptz)',
        'admin_update_tenant(uuid, text, text, timestamptz, boolean)',
        'admin_issue_invite(uuid, text, integer, integer)',
        'admin_revoke_invite(text)',
        'admin_issue_reset_code(text, integer)',
        'zoe_write(text, jsonb)'
    ] loop
        if exists (select 1 from pg_catalog.pg_proc p where p.oid = to_regprocedure('public.' || sig) and p.prosecdef) then
            if to_regprocedure('private.' || sig) is not null then
                raise exception 'private.% already exists', sig;
            end if;
            execute 'alter function public.' || sig || ' set schema private';
        end if;
    end loop;
end
$zoe_move$;

create or replace function public.my_account()
returns table (
    username text,
    role text,
    tenant_id uuid,
    tenant_name text,
    branch_code text,
    expires_at timestamptz,
    status text
)
language sql stable security invoker set search_path = ''
as $$
    select a.username, a.role, a.tenant_id, a.tenant_name, a.branch_code, a.expires_at, a.status
    from private.my_account() a
$$;

create or replace function public.admin_create_tenant(p_name text, p_branch_code text, p_expires_at timestamptz)
returns public.tenants
language sql volatile security invoker set search_path = ''
as $$
    select * from private.admin_create_tenant(p_name, p_branch_code, p_expires_at)
$$;

create or replace function public.admin_update_tenant(
    p_tenant_id uuid,
    p_name text default null,
    p_branch_code text default null,
    p_expires_at timestamptz default null,
    p_revoked boolean default null
)
returns public.tenants
language sql volatile security invoker set search_path = ''
as $$
    select * from private.admin_update_tenant(p_tenant_id, p_name, p_branch_code, p_expires_at, p_revoked)
$$;

create or replace function public.admin_issue_invite(
    p_tenant_id uuid,
    p_role text default 'member',
    p_max_uses integer default 1,
    p_valid_hours integer default 72
)
returns table (code text, expires_at timestamptz)
language sql volatile security invoker set search_path = ''
as $$
    select i.code, i.expires_at from private.admin_issue_invite(p_tenant_id, p_role, p_max_uses, p_valid_hours) i
$$;

create or replace function public.admin_revoke_invite(p_code_hash text)
returns boolean
language sql volatile security invoker set search_path = ''
as $$
    select private.admin_revoke_invite(p_code_hash)
$$;

create or replace function public.admin_issue_reset_code(p_username text, p_valid_hours integer default 24)
returns table (code text, expires_at timestamptz)
language sql volatile security invoker set search_path = ''
as $$
    select r.code, r.expires_at from private.admin_issue_reset_code(p_username, p_valid_hours) r
$$;

create or replace function public.zoe_write(p_op_id text, p_ops jsonb)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$
    select private.zoe_write(p_op_id, p_ops)
$$;

revoke all on function private.my_account(),
    private.admin_create_tenant(text, text, timestamptz),
    private.admin_update_tenant(uuid, text, text, timestamptz, boolean),
    private.admin_issue_invite(uuid, text, integer, integer),
    private.admin_revoke_invite(text),
    private.admin_issue_reset_code(text, integer),
    private.zoe_write(text, jsonb)
    from public, anon, authenticated, service_role;
grant execute on function private.my_account(),
    private.admin_create_tenant(text, text, timestamptz),
    private.admin_update_tenant(uuid, text, text, timestamptz, boolean),
    private.admin_issue_invite(uuid, text, integer, integer),
    private.admin_revoke_invite(text),
    private.admin_issue_reset_code(text, integer),
    private.zoe_write(text, jsonb)
    to authenticated;

revoke all on function public.my_account(),
    public.admin_create_tenant(text, text, timestamptz),
    public.admin_update_tenant(uuid, text, text, timestamptz, boolean),
    public.admin_issue_invite(uuid, text, integer, integer),
    public.admin_revoke_invite(text),
    public.admin_issue_reset_code(text, integer),
    public.zoe_write(text, jsonb)
    from public, anon, authenticated, service_role;
grant execute on function public.my_account(),
    public.admin_create_tenant(text, text, timestamptz),
    public.admin_update_tenant(uuid, text, text, timestamptz, boolean),
    public.admin_issue_invite(uuid, text, integer, integer),
    public.admin_revoke_invite(text),
    public.admin_issue_reset_code(text, integer),
    public.zoe_write(text, jsonb)
    to authenticated;

notify pgrst, 'reload schema';
