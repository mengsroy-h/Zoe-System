create or replace function private.zoe_housekeeping(p_tenant uuid) returns void
language plpgsql volatile set search_path = ''
as $$
declare
    purged bigint;
    freed_docs bigint;
    freed_ops bigint;
    prior_raw text := current_setting('zoe.raw_docs', true);
begin
    perform set_config('zoe.raw_docs', 'on', true);
    with gone as (
        delete from public.zoe_docs z
        where z.tenant_id = p_tenant and z.value is null and z.updated_at < now() - interval '7 days'
        returning z.seq, private.zoe_doc_bytes(z.root, z.key, null) as b
    )
    select max(gone.seq), coalesce(sum(gone.b), 0) into purged, freed_docs from gone;
    perform set_config('zoe.raw_docs', coalesce(prior_raw, ''), true);
    if purged is not null then
        update public.zoe_tenant_state s set purged_seq = greatest(s.purged_seq, purged) where s.tenant_id = p_tenant;
    end if;
    with gone as (
        delete from public.zoe_ops o where o.tenant_id = p_tenant and o.created_at < now() - interval '2 days'
            and not coalesce(o.result -> 'ok' = 'true'::jsonb
                and private.zoe_pickup_reset_receipt_v1(o.result -> 'reset')
                and o.result #>> '{reset,proof}' = 'operation'
                and o.result #>> '{reset,tenant}' = o.tenant_id::text
                and o.result #>> '{reset,attemptId}' = o.op_id
                and o.result #>> '{reset,actorUid}' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$', false)
        returning private.zoe_op_bytes(o.op_id, o.result) as b
    )
    select coalesce(sum(gone.b), 0) into freed_ops from gone;
    if freed_docs + freed_ops > 0 then
        update public.zoe_tenant_state s set bytes = greatest(s.bytes - freed_docs - freed_ops, 0) where s.tenant_id = p_tenant;
    end if;
end
$$;

revoke all on function private.zoe_housekeeping(uuid) from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
