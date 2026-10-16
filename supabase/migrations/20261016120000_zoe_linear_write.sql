alter table public.zoe_tenant_state
    add column bytes bigint not null default 0,
    add column quota_bytes bigint not null default 1073741824 check (quota_bytes > 0);

create function private.zoe_doc_bytes(p_root text, p_key text, p_value jsonb) returns bigint
language sql immutable set search_path = ''
as $$
    select 64 + octet_length(p_root) + octet_length(p_key) + coalesce(octet_length(p_value::text), 0)
$$;

create function private.zoe_op_bytes(p_op_id text, p_result jsonb) returns bigint
language sql immutable set search_path = ''
as $$
    select 64 + octet_length(p_op_id) + coalesce(octet_length(p_result::text), 0)
$$;

create function private.zoe_json_object(p_keys text[], p_vals jsonb[]) returns jsonb
language sql immutable set search_path = ''
as $$
    select ('{' || string_agg(to_json(u.k)::text || ':' || u.v::text, ',') || '}')::jsonb from unnest(p_keys, p_vals) as u(k, v)
$$;

create function private.zoe_json_array(p_items jsonb[]) returns jsonb
language sql immutable set search_path = ''
as $$
    select coalesce(('[' || string_agg(u.x::text, ',' order by u.n) || ']')::jsonb, '[]'::jsonb) from unnest(p_items) with ordinality as u(x, n)
$$;

create or replace function private.zoe_canon(p_value jsonb, p_depth integer default 0) returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
    keys text[] := '{}'::text[];
    vals jsonb[] := '{}'::jsonb[];
    result jsonb := '{}'::jsonb;
    kind text;
    child_key text;
    child jsonb;
    child_kind text;
    entries jsonb;
    i integer;
begin
    if p_value is null then
        return 'null'::jsonb;
    end if;
    if p_depth > 32 then
        raise exception 'invalid_data' using errcode = '22023', detail = 'depth';
    end if;
    kind := jsonb_typeof(p_value);
    if kind = 'number' then
        if abs((p_value #>> '{}')::numeric) > 1.7976931348623157e308 then
            raise exception 'invalid_data' using errcode = '22023', detail = 'number';
        end if;
        if abs((p_value #>> '{}')::numeric) < 2.2250738585072014e-308 then
            return '0'::jsonb;
        end if;
        return to_jsonb((p_value #>> '{}')::float8);
    end if;
    if kind <> 'object' and kind <> 'array' then
        return p_value;
    end if;
    if kind = 'object' then
        entries := jsonb_path_query_array(p_value, '$.keyvalue()');
    else
        entries := p_value;
    end if;
    for i in 0 .. jsonb_array_length(entries) - 1 loop
        if kind = 'object' then
            child_key := entries -> i ->> 'key';
            child := entries -> i -> 'value';
        else
            child_key := i::text;
            child := entries -> i;
        end if;
        if kind = 'object' and (octet_length(child_key) not between 1 and 768 or child_key ~ '[\]\[.#$/\x01-\x1f\x7f]') then
            raise exception 'invalid_data' using errcode = '22023', detail = 'key';
        end if;
        child_kind := jsonb_typeof(child);
        if p_depth >= 32 or child_kind = 'object' or child_kind = 'array' then
            child := private.zoe_canon(child, p_depth + 1);
        elsif child_kind = 'number' then
            if abs((child #>> '{}')::numeric) > 1.7976931348623157e308 then
                raise exception 'invalid_data' using errcode = '22023', detail = 'number';
            end if;
            if abs((child #>> '{}')::numeric) < 2.2250738585072014e-308 then
                child := '0'::jsonb;
            else
                child := to_jsonb((child #>> '{}')::float8);
            end if;
        end if;
        if child <> 'null'::jsonb then
            keys := array_append(keys, child_key);
            vals := array_append(vals, child);
        end if;
    end loop;
    if cardinality(keys) = 0 then
        return 'null'::jsonb;
    end if;
    if cardinality(keys) > 16 then
        return private.zoe_json_object(keys, vals);
    end if;
    for n in 1 .. cardinality(keys) loop
        result := result || jsonb_build_object(keys[n], vals[n]);
    end loop;
    return result;
end
$$;

create function private.zoe_merge(p_old jsonb, p_subs jsonb[], p_depth integer) returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
    base jsonb := case when jsonb_typeof(p_old) = 'object' then p_old else '{}'::jsonb end;
    leaf jsonb;
    body text;
begin
    select o -> 'v' into leaf from unnest(p_subs) o where jsonb_array_length(o -> 's') = p_depth limit 1;
    if found then
        return leaf;
    end if;
    with touched as materialized (
        select o -> 's' ->> p_depth as k, array_agg(o) as subs from unnest(p_subs) o group by 1
    ), merged as materialized (
        select e.key as k, e.value as v from jsonb_each(base) e
        where not exists (select 1 from touched t where t.k = e.key)
        union all
        select t.k, private.zoe_merge(base -> t.k, t.subs, p_depth + 1) from touched t
    )
    select string_agg(to_json(m.k)::text || ':' || m.v::text, ',') into body from merged m where m.v <> 'null'::jsonb;
    return coalesce(('{' || body || '}')::jsonb, 'null'::jsonb);
end
$$;

create or replace function private.zoe_snap_val(p_snap jsonb, p_ctx jsonb) returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
    snap_path text[] := translate((p_snap -> 'p')::text, '[]', '{}')::text[];
    depth integer := cardinality(snap_path);
    side text := case when (p_snap ->> '$s') = '1' then 'post' else 'pre' end;
    tenant uuid := (p_ctx ->> 't')::uuid;
    doc jsonb;
    doc_key text;
begin
    if depth = 0 then
        with x as materialized (
            select r.root, private.zoe_snap_val(jsonb_build_object('$s', p_snap -> '$s', 'p', jsonb_build_array(r.root)), p_ctx) as v
            from (select distinct z.root from public.zoe_docs z where z.tenant_id = tenant) r
        )
        select coalesce(('{' || string_agg(to_json(x.root)::text || ':' || x.v::text, ',') || '}')::jsonb, 'null'::jsonb) into doc
        from x where x.v <> 'null'::jsonb;
        return doc;
    end if;
    if depth = 1 then
        with d as materialized (
            select z.key,
                case when (p_ctx #> array['touched', z.root || '/' || z.key]) is not null then p_ctx #> array[side, z.root || '/' || z.key]
                     else coalesce(z.value, 'null'::jsonb) end as v
            from public.zoe_docs z
            where z.tenant_id = tenant and z.root = snap_path[1]
        )
        select coalesce(('{' || string_agg(to_json(d.key)::text || ':' || d.v::text, ',') || '}')::jsonb, 'null'::jsonb) into doc
        from d where d.v <> 'null'::jsonb;
        return doc;
    end if;
    doc_key := snap_path[1] || '/' || snap_path[2];
    if (p_ctx #> array['touched', doc_key]) is not null then
        return coalesce(p_ctx #> (array[side, doc_key] || snap_path[3:depth]), 'null'::jsonb);
    end if;
    select z.value #> snap_path[3:depth] into doc
    from public.zoe_docs z
    where z.tenant_id = tenant and z.root = snap_path[1] and z.key = snap_path[2];
    return coalesce(doc, 'null'::jsonb);
end
$$;

create function private.zoe_snap_exists(p_snap jsonb, p_ctx jsonb) returns boolean
language plpgsql stable set search_path = ''
as $$
declare
    depth integer := jsonb_array_length(p_snap -> 'p');
    tenant uuid := (p_ctx ->> 't')::uuid;
begin
    if depth <= 1 and (p_snap ->> '$s') = '1' then
        return exists (
            select 1 from public.zoe_docs z
            where z.tenant_id = tenant and (depth = 0 or z.root = (p_snap -> 'p' ->> 0)) and z.value is not null
        );
    end if;
    return private.zoe_snap_val(p_snap, p_ctx) <> 'null'::jsonb;
end
$$;

create function private.zoe_eval(p_expr jsonb, p_ctx jsonb, p_scope jsonb) returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
    kind text := p_expr ->> 't';
    op text := p_expr ->> 'o';
    left_value jsonb;
    right_value jsonb;
    target jsonb;
    arg jsonb;
    value jsonb;
    item jsonb;
    seg text;
    snap_path jsonb;
    left_type text;
    right_type text;
    same boolean;
    left_num numeric;
    right_num numeric;
begin
    case kind
    when 'l' then
        return p_expr -> 'v';
    when 'v' then
        return p_scope -> 'vars' -> (p_expr ->> 'n');
    when 'now' then
        return to_jsonb((p_ctx ->> 'now')::numeric);
    when 'auth_uid' then
        return coalesce(to_jsonb(auth.uid()::text), 'null'::jsonb);
    when 'auth' then
        return '{}'::jsonb;
    when 'root' then
        return jsonb_build_object('$s', 0, 'p', '[]'::jsonb);
    when 'data' then
        return jsonb_build_object('$s', 0, 'p', p_scope -> 'loc');
    when 'newData' then
        return jsonb_build_object('$s', 1, 'p', p_scope -> 'loc');
    when 'arr' then
        value := '[]'::jsonb;
        for item in select e.value from jsonb_array_elements(p_expr -> 'items') e loop
            arg := private.zoe_eval(item, p_ctx, p_scope);
            if arg is null then
                return null;
            end if;
            value := value || jsonb_build_array(arg);
        end loop;
        return value;
    when '&&', '||' then
        left_value := private.zoe_eval(p_expr -> 'l', p_ctx, p_scope);
        if left_value is null or jsonb_typeof(left_value) <> 'boolean' then
            return null;
        end if;
        if (kind = '&&' and left_value = 'false'::jsonb) or (kind = '||' and left_value = 'true'::jsonb) then
            return left_value;
        end if;
        right_value := private.zoe_eval(p_expr -> 'r', p_ctx, p_scope);
        if right_value is null or jsonb_typeof(right_value) <> 'boolean' then
            return null;
        end if;
        return right_value;
    when 'u' then
        value := private.zoe_eval(p_expr -> 'e', p_ctx, p_scope);
        if value is null or (jsonb_typeof(value) = 'object' and value ? '$s') then
            return null;
        end if;
        if op = '!' then
            if jsonb_typeof(value) <> 'boolean' then
                return null;
            end if;
            return to_jsonb(not (value = 'true'::jsonb));
        end if;
        if op = '-' and jsonb_typeof(value) = 'number' then
            return to_jsonb(-((value #>> '{}')::numeric));
        end if;
        return null;
    when 'b' then
        left_value := private.zoe_eval(p_expr -> 'l', p_ctx, p_scope);
        if left_value is null then
            return null;
        end if;
        if p_expr -> 'r' ->> 't' = 'l' then
            right_value := p_expr -> 'r' -> 'v';
        else
            right_value := private.zoe_eval(p_expr -> 'r', p_ctx, p_scope);
        end if;
        if right_value is null or (jsonb_typeof(left_value) = 'object' and left_value ? '$s')
                or (jsonb_typeof(right_value) = 'object' and right_value ? '$s') then
            return null;
        end if;
        left_type := jsonb_typeof(left_value);
        right_type := jsonb_typeof(right_value);
        if op in ('===', '==', '!==', '!=') then
            if left_type <> right_type then
                same := false;
            elsif left_type in ('object', 'array') then
                return null;
            elsif left_type = 'number' then
                same := (left_value #>> '{}')::numeric = (right_value #>> '{}')::numeric;
            else
                same := left_value = right_value;
            end if;
            return to_jsonb(case when op in ('===', '==') then same else not same end);
        end if;
        if op in ('<', '<=', '>', '>=') then
            if left_type = 'number' and right_type = 'number' then
                left_num := (left_value #>> '{}')::numeric;
                right_num := (right_value #>> '{}')::numeric;
                return to_jsonb(case op when '<' then left_num < right_num when '<=' then left_num <= right_num
                    when '>' then left_num > right_num else left_num >= right_num end);
            end if;
            if left_type = 'string' and right_type = 'string' then
                return to_jsonb(case op
                    when '<' then (left_value #>> '{}') collate "C" < (right_value #>> '{}') collate "C"
                    when '<=' then (left_value #>> '{}') collate "C" <= (right_value #>> '{}') collate "C"
                    when '>' then (left_value #>> '{}') collate "C" > (right_value #>> '{}') collate "C"
                    else (left_value #>> '{}') collate "C" >= (right_value #>> '{}') collate "C" end);
            end if;
            return 'false'::jsonb;
        end if;
        if op = '+' and left_type = 'string' and right_type = 'string' then
            return to_jsonb((left_value #>> '{}') || (right_value #>> '{}'));
        end if;
        if left_type <> 'number' or right_type <> 'number' then
            return null;
        end if;
        left_num := (left_value #>> '{}')::numeric;
        right_num := (right_value #>> '{}')::numeric;
        if op = '+' then
            return to_jsonb(left_num + right_num);
        elsif op = '-' then
            return to_jsonb(left_num - right_num);
        elsif op = '*' then
            return to_jsonb(left_num * right_num);
        elsif op in ('/', '%') then
            if right_num = 0 then
                return null;
            end if;
            return to_jsonb(case when op = '/' then left_num / right_num else left_num % right_num end);
        end if;
        return null;
    when 'p' then
        value := private.zoe_eval(p_expr -> 'o', p_ctx, p_scope);
        if value is null or jsonb_typeof(value) <> 'string' or p_expr ->> 'n' <> 'length' then
            return null;
        end if;
        return to_jsonb(private.zoe_utf16_length(value #>> '{}'));
    when 'm' then
        if p_expr -> 'o' ->> 't' = 'newData' then
            target := jsonb_build_object('$s', 1, 'p', p_scope -> 'loc');
        else
            target := private.zoe_eval(p_expr -> 'o', p_ctx, p_scope);
        end if;
        if target is null or not (jsonb_typeof(target) = 'object' and target ? '$s') then
            return null;
        end if;
        if (target ->> '$s') = '1' and p_scope ? 'nv' and target -> 'p' = p_scope -> 'loc' and p_expr ->> 'n' not in ('child', 'parent') then
            value := p_scope -> 'nv';
            case p_expr ->> 'n'
            when 'val' then
                return value;
            when 'exists' then
                return to_jsonb(value <> 'null'::jsonb);
            when 'isString' then
                return to_jsonb(jsonb_typeof(value) = 'string');
            when 'isNumber' then
                return to_jsonb(jsonb_typeof(value) = 'number');
            when 'isBoolean' then
                return to_jsonb(jsonb_typeof(value) = 'boolean');
            when 'hasChildren' then
                if jsonb_array_length(p_expr -> 'a') = 0 then
                    return to_jsonb(jsonb_typeof(value) = 'object');
                end if;
                arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx, p_scope);
                if arg is null or jsonb_typeof(arg) <> 'array' then
                    return null;
                end if;
                for item in select e.value from jsonb_array_elements(arg) e loop
                    if jsonb_typeof(item) <> 'string' then
                        return null;
                    end if;
                end loop;
                if jsonb_typeof(value) <> 'object' then
                    return 'false'::jsonb;
                end if;
                for item in select e.value from jsonb_array_elements(arg) e loop
                    if not value ? (item #>> '{}') then
                        return 'false'::jsonb;
                    end if;
                end loop;
                return 'true'::jsonb;
            when 'hasChild' then
                arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx, p_scope);
                if arg is null or jsonb_typeof(arg) <> 'string' then
                    return null;
                end if;
                return to_jsonb(jsonb_typeof(value) = 'object' and value ? (arg #>> '{}'));
            else
                return null;
            end case;
        end if;
        case p_expr ->> 'n'
        when 'child' then
            arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx, p_scope);
            if arg is null or jsonb_typeof(arg) <> 'string' then
                return null;
            end if;
            snap_path := target -> 'p';
            for seg in select s from unnest(string_to_array(arg #>> '{}', '/')) s loop
                if seg <> '' then
                    if not private.zoe_key_ok(seg) then
                        return null;
                    end if;
                    snap_path := snap_path || to_jsonb(seg);
                end if;
            end loop;
            if snap_path = target -> 'p' then
                return null;
            end if;
            return jsonb_build_object('$s', target -> '$s', 'p', snap_path);
        when 'parent' then
            if jsonb_array_length(target -> 'p') = 0 then
                return null;
            end if;
            return jsonb_build_object('$s', target -> '$s', 'p', (target -> 'p') - (jsonb_array_length(target -> 'p') - 1));
        when 'val' then
            return private.zoe_snap_val(target, p_ctx);
        when 'exists' then
            return to_jsonb(private.zoe_snap_exists(target, p_ctx));
        when 'isString' then
            if jsonb_array_length(target -> 'p') <= 1 then
                return 'false'::jsonb;
            end if;
            return to_jsonb(jsonb_typeof(private.zoe_snap_val(target, p_ctx)) = 'string');
        when 'isNumber' then
            if jsonb_array_length(target -> 'p') <= 1 then
                return 'false'::jsonb;
            end if;
            return to_jsonb(jsonb_typeof(private.zoe_snap_val(target, p_ctx)) = 'number');
        when 'isBoolean' then
            if jsonb_array_length(target -> 'p') <= 1 then
                return 'false'::jsonb;
            end if;
            return to_jsonb(jsonb_typeof(private.zoe_snap_val(target, p_ctx)) = 'boolean');
        when 'hasChildren' then
            if jsonb_array_length(target -> 'p') <= 1 then
                if jsonb_array_length(p_expr -> 'a') = 0 then
                    return to_jsonb(private.zoe_snap_exists(target, p_ctx));
                end if;
                arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx, p_scope);
                if arg is null or jsonb_typeof(arg) <> 'array' then
                    return null;
                end if;
                for item in select e.value from jsonb_array_elements(arg) e loop
                    if jsonb_typeof(item) <> 'string' then
                        return null;
                    end if;
                end loop;
                if not private.zoe_snap_exists(target, p_ctx) then
                    return 'false'::jsonb;
                end if;
                for item in select e.value from jsonb_array_elements(arg) e loop
                    if not private.zoe_key_ok(item #>> '{}')
                            or not private.zoe_snap_exists(jsonb_build_object('$s', target -> '$s', 'p', (target -> 'p') || item), p_ctx) then
                        return 'false'::jsonb;
                    end if;
                end loop;
                return 'true'::jsonb;
            end if;
            value := private.zoe_snap_val(target, p_ctx);
            if jsonb_array_length(p_expr -> 'a') = 0 then
                return to_jsonb(jsonb_typeof(value) = 'object');
            end if;
            arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx, p_scope);
            if arg is null or jsonb_typeof(arg) <> 'array' then
                return null;
            end if;
            for item in select e.value from jsonb_array_elements(arg) e loop
                if jsonb_typeof(item) <> 'string' then
                    return null;
                end if;
            end loop;
            if jsonb_typeof(value) <> 'object' then
                return 'false'::jsonb;
            end if;
            for item in select e.value from jsonb_array_elements(arg) e loop
                if not value ? (item #>> '{}') then
                    return 'false'::jsonb;
                end if;
            end loop;
            return 'true'::jsonb;
        when 'hasChild' then
            arg := private.zoe_eval(p_expr -> 'a' -> 0, p_ctx, p_scope);
            if arg is null or jsonb_typeof(arg) <> 'string' then
                return null;
            end if;
            if jsonb_array_length(target -> 'p') <= 1 then
                return to_jsonb(private.zoe_key_ok(arg #>> '{}')
                    and private.zoe_snap_exists(jsonb_build_object('$s', target -> '$s', 'p', (target -> 'p') || arg), p_ctx));
            end if;
            value := private.zoe_snap_val(target, p_ctx);
            return to_jsonb(jsonb_typeof(value) = 'object' and value ? (arg #>> '{}'));
        else
            return null;
        end case;
    else
        return null;
    end case;
end
$$;

create or replace function private.zoe_validate_tree(p_node jsonb, p_path text[], p_value jsonb, p_vars jsonb, p_ctx jsonb) returns boolean
language plpgsql stable set search_path = ''
as $$
declare
    children jsonb := coalesce(p_node -> 'c', '{}'::jsonb);
    wild jsonb := p_node -> 'x' -> 'r';
    wild_name text := p_node -> 'x' ->> 'n';
    entries jsonb;
    i integer;
    child_key text;
    child_value jsonb;
    child_node jsonb;
    child_vars jsonb;
    child_path text[];
begin
    entries := jsonb_path_query_array(p_value, '$.keyvalue()');
    for i in 0 .. jsonb_array_length(entries) - 1 loop
        child_key := entries -> i ->> 'key';
        child_value := entries -> i -> 'value';
        if children ? child_key then
            child_node := children -> child_key;
            child_vars := p_vars;
        elsif wild is not null then
            child_node := wild;
            child_vars := p_vars || jsonb_build_object(wild_name, child_key);
        else
            continue;
        end if;
        child_path := p_path || child_key;
        if child_node ? 'v' and coalesce(private.zoe_eval(child_node -> 'v', p_ctx,
                jsonb_build_object('vars', child_vars, 'loc', to_jsonb(child_path), 'nv', child_value)) <> 'true'::jsonb, true) then
            return false;
        end if;
        if jsonb_typeof(child_value) = 'object' and (child_node ? 'c' or child_node ? 'x')
                and not private.zoe_validate_tree(child_node, child_path, child_value, child_vars, p_ctx) then
            return false;
        end if;
    end loop;
    return true;
end
$$;

create or replace function private.zoe_check_location(p_rules jsonb, p_path text[], p_ctx jsonb) returns boolean
language plpgsql stable set search_path = ''
as $$
declare
    node jsonb := p_rules;
    vars jsonb := '{}'::jsonb;
    granted boolean := false;
    depth integer := cardinality(p_path);
    i integer;
    seg text;
    scope jsonb;
    post jsonb;
begin
    for i in 0 .. depth loop
        if i > 0 then
            seg := p_path[i];
            if node -> 'c' ? seg then
                node := node -> 'c' -> seg;
            elsif node ? 'x' then
                vars := vars || jsonb_build_object(node -> 'x' ->> 'n', seg);
                node := node -> 'x' -> 'r';
            else
                node := null;
            end if;
        end if;
        exit when node is null;
        scope := jsonb_build_object('vars', vars, 'loc', to_jsonb(p_path[1:i]));
        if not granted and node ? 'w' then
            granted := coalesce(private.zoe_eval(node -> 'w', p_ctx, scope) = 'true'::jsonb, false);
        end if;
        if node ? 'v' then
            if private.zoe_snap_exists(jsonb_build_object('$s', 1, 'p', to_jsonb(p_path[1:i])), p_ctx)
                    and coalesce(private.zoe_eval(node -> 'v', p_ctx, scope) <> 'true'::jsonb, true) then
                return false;
            end if;
        end if;
        if i = depth and (node ? 'c' or node ? 'x') then
            post := private.zoe_snap_val(jsonb_build_object('$s', 1, 'p', to_jsonb(p_path)), p_ctx);
            if jsonb_typeof(post) = 'object' and not private.zoe_validate_tree(node, p_path, post, vars, p_ctx) then
                return false;
            end if;
        end if;
    end loop;
    return granted;
end
$$;

create or replace function private.zoe_apply(p_tenant uuid, p_op_id text, p_ops jsonb, p_enforce boolean, p_replace boolean) returns jsonb
language plpgsql volatile set search_path = ''
as $$
declare
    tenant uuid := p_tenant;
    now_ms bigint := private.zoe_now_ms();
    head bigint;
    used bigint;
    quota bigint;
    next_seq bigint;
    prior jsonb;
    op jsonb;
    kind text;
    op_path text[];
    doc_key text;
    want_keys text[] := '{}'::text[];
    root_names text[] := '{}'::text[];
    root_vals jsonb[] := '{}'::jsonb[];
    leaf_ops jsonb[] := '{}'::jsonb[];
    locs jsonb[] := '{}'::jsonb[];
    pre jsonb;
    pre_text text;
    pre_seq jsonb;
    pre_rows jsonb;
    work jsonb;
    rules jsonb;
    ctx jsonb;
    loc jsonb;
    loc_path text[];
    current_value jsonb;
    delta float8;
    new_value jsonb;
    changed boolean := false;
    grow bigint := 0;
    freed bigint;
    out_list jsonb[] := '{}'::jsonb[];
    stored_list jsonb[] := '{}'::jsonb[];
    result jsonb;
    ops_count integer;
    overlap boolean;
begin
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    if p_op_id is null or p_op_id !~ '^[A-Za-z0-9_-]{16,64}$' then
        raise exception 'invalid_op' using errcode = '22023';
    end if;
    if jsonb_typeof(p_ops) <> 'array' then
        raise exception 'invalid_op' using errcode = '22023';
    end if;
    ops_count := jsonb_array_length(p_ops);
    if ops_count < 1 or ops_count > 500 then
        raise exception 'invalid_op' using errcode = '22023';
    end if;
    if octet_length(p_ops::text) > 4194304 then
        raise exception 'invalid_data' using errcode = '22023', detail = 'size';
    end if;

    insert into public.zoe_tenant_state (tenant_id) values (tenant) on conflict (tenant_id) do nothing;
    select s.seq, s.bytes, s.quota_bytes into head, used, quota from public.zoe_tenant_state s where s.tenant_id = tenant for update;
    select o.result into prior from public.zoe_ops o where o.tenant_id = tenant and o.op_id = p_op_id;
    if found then
        return prior || jsonb_build_object('replayed', true, 'now', now_ms);
    end if;
    next_seq := head + 1;
    if p_replace then
        select coalesce(sum(octet_length(z.value::text)), 0) into freed from public.zoe_docs z where z.tenant_id = tenant and z.value is not null;
        grow := grow - freed;
        update public.zoe_docs z set value = null, seq = next_seq, updated_at = now()
        where z.tenant_id = tenant and z.value is not null;
        changed := found;
    end if;

    for op in select e.value from jsonb_array_elements(p_ops) e loop
        kind := op ->> 'k';
        if kind is null or kind not in ('set', 'inc', 'cas') then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        if kind = 'cas' and ops_count <> 1 then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        if kind <> 'inc' and not op ? 'v' then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        op_path := private.zoe_path_of(op -> 'p');
        if cardinality(op_path) = 1 and kind = 'inc' then
            raise exception 'invalid_op' using errcode = '22023';
        end if;
        locs := array_append(locs, to_jsonb(op_path));
        if cardinality(op_path) = 1 then
            new_value := private.zoe_canon(op -> 'v');
            if not op_path[1] = any(root_names) then
                root_names := array_append(root_names, op_path[1]);
                root_vals := array_append(root_vals, new_value);
            end if;
            if jsonb_typeof(new_value) = 'object' then
                want_keys := want_keys || array(select op_path[1] || '/' || k from jsonb_object_keys(new_value) k);
            end if;
            continue;
        end if;
        want_keys := array_append(want_keys, op_path[1] || '/' || op_path[2]);
    end loop;

    with wanted as (
        select distinct split_part(w, '/', 1) as r, split_part(w, '/', 2) as k from unnest(want_keys) w
    ), by_root as (
        select z.root as r, z.key as k, z.value as v, z.seq as s from public.zoe_docs z
        where z.tenant_id = tenant and z.root = any(root_names)
        for update
    ), by_key as (
        select z.root as r, z.key as k, z.value as v, z.seq as s from public.zoe_docs z
        join wanted w on z.tenant_id = tenant and z.root = w.r and z.key = w.k
        where not (z.root = any(root_names))
        for update of z
    ), found_rows as (
        select * from by_root
        union all
        select * from by_key
    ), merged as (
        select f.r, f.k, f.v, f.s, true as row_exists from found_rows f
        union all
        select w.r, w.k, null::jsonb, 0::bigint, false from wanted w
        where not exists (select 1 from found_rows f where f.r = w.r and f.k = w.k)
    )
    select string_agg(to_json(m.r || '/' || m.k)::text || ':' || coalesce(m.v, 'null'::jsonb)::text, ','),
           coalesce(jsonb_object_agg(m.r || '/' || m.k, case when m.v is null then 0 else m.s end), '{}'::jsonb),
           coalesce(jsonb_object_agg(m.r || '/' || m.k, m.row_exists), '{}'::jsonb)
        into pre_text, pre_seq, pre_rows
    from merged m;
    if octet_length(pre_text) > 8388608 then
        raise exception 'invalid_data' using errcode = '22023', detail = 'size';
    end if;
    pre := coalesce(('{' || pre_text || '}')::jsonb, '{}'::jsonb);

    select exists (
        select 1 from (
            select t.a, lag(t.a) over (order by t.a) as b
            from (select array(select jsonb_array_elements_text(l)) as a from unnest(locs) l) t
        ) x
        where x.b is not null and cardinality(x.b) <= cardinality(x.a) and x.a[1:cardinality(x.b)] = x.b
    ) into overlap;
    if overlap then
        raise exception 'invalid_op' using errcode = '22023', detail = 'overlap';
    end if;

    for op in select e.value from jsonb_array_elements(p_ops) e loop
        kind := op ->> 'k';
        op_path := private.zoe_path_of(op -> 'p');
        if cardinality(op_path) = 1 then
            if kind = 'cas' then
                current_value := private.zoe_root_value(pre, op_path[1]);
                if current_value <> private.zoe_canon(op -> 'x') then
                    return jsonb_build_object('ok', false, 'conflict', true, 'now', now_ms, 'value', current_value);
                end if;
            end if;
            new_value := root_vals[array_position(root_names, op_path[1])];
            if new_value <> 'null'::jsonb and jsonb_typeof(new_value) <> 'object' then
                raise exception 'invalid_data' using errcode = '22023', detail = 'root';
            end if;
            continue;
        end if;
        doc_key := op_path[1] || '/' || op_path[2];
        if kind = 'set' then
            new_value := private.zoe_canon(op -> 'v');
        elsif kind = 'inc' then
            if jsonb_typeof(op -> 'd') <> 'number' then
                raise exception 'invalid_op' using errcode = '22023';
            end if;
            delta := (op ->> 'd')::float8;
            current_value := coalesce(pre #> (array[doc_key] || op_path[3:]), 'null'::jsonb);
            new_value := private.zoe_canon(to_jsonb(case when jsonb_typeof(current_value) = 'number' then (current_value #>> '{}')::float8 else 0::float8 end + delta));
        else
            current_value := coalesce(pre #> (array[doc_key] || op_path[3:]), 'null'::jsonb);
            if current_value <> private.zoe_canon(op -> 'x') then
                return jsonb_build_object('ok', false, 'conflict', true, 'now', now_ms, 'value', current_value);
            end if;
            new_value := private.zoe_canon(op -> 'v');
        end if;
        leaf_ops := array_append(leaf_ops, jsonb_build_object('d', doc_key, 's', to_jsonb(op_path[3:]), 'v', new_value));
    end loop;

    with leafs as (
        select l ->> 'd' as d, array_agg(l) as subs from unnest(leaf_ops) l group by 1
    ), roots as (
        select u.r, u.v from unnest(root_names, root_vals) as u(r, v)
    )
    select coalesce(('{' || string_agg(to_json(e.key)::text || ':' || (
        case when rt.r is not null then coalesce(rt.v -> split_part(e.key, '/', 2), 'null'::jsonb)
             when lf.d is not null then private.zoe_merge(e.value, lf.subs, 0)
             else e.value end)::text, ',') || '}')::jsonb, '{}'::jsonb)
        into work
    from jsonb_each(pre) e
    left join roots rt on rt.r = split_part(e.key, '/', 1)
    left join leafs lf on lf.d = e.key;

    for doc_key, new_value in select e.key, e.value from jsonb_each(work) e loop
        if octet_length(new_value::text) > 1048576 then
            raise exception 'invalid_data' using errcode = '22023', detail = 'size';
        end if;
        current_value := pre -> doc_key;
        if new_value = current_value then
            out_list := array_append(out_list, jsonb_build_object('r', split_part(doc_key, '/', 1), 'k', split_part(doc_key, '/', 2),
                'v', new_value, 's', (pre_seq ->> doc_key)::bigint));
            continue;
        end if;
        changed := true;
        grow := grow + case when new_value = 'null'::jsonb then 0 else octet_length(new_value::text) end
            - case when current_value = 'null'::jsonb then 0 else octet_length(current_value::text) end
            + case when (pre_rows ->> doc_key)::boolean then 0 else private.zoe_doc_bytes(split_part(doc_key, '/', 1), split_part(doc_key, '/', 2), null) end;
        insert into public.zoe_docs as z (tenant_id, root, key, value, seq, updated_at)
        values (tenant, split_part(doc_key, '/', 1), split_part(doc_key, '/', 2), nullif(new_value, 'null'::jsonb), next_seq, now())
        on conflict (tenant_id, root, key) do update
            set value = excluded.value, seq = excluded.seq, updated_at = excluded.updated_at;
        out_list := array_append(out_list, jsonb_build_object('r', split_part(doc_key, '/', 1), 'k', split_part(doc_key, '/', 2),
            'v', new_value, 's', next_seq));
        stored_list := array_append(stored_list, jsonb_build_object('r', split_part(doc_key, '/', 1), 'k', split_part(doc_key, '/', 2), 's', next_seq));
    end loop;

    if p_enforce then
        rules := private.zoe_rules();
        ctx := jsonb_build_object('t', tenant, 'now', now_ms, 'pre', pre, 'post', work,
            'touched', (select coalesce(jsonb_object_agg(k, true), '{}'::jsonb) from jsonb_object_keys(pre) k));
        foreach loc in array locs loop
            loc_path := array(select jsonb_array_elements_text(loc));
            if not private.zoe_check_location(rules, loc_path, ctx) then
                raise exception 'permission_denied' using errcode = '42501', detail = array_to_string(loc_path, '/');
            end if;
        end loop;
    end if;

    if not changed then
        next_seq := head;
    end if;
    result := jsonb_build_object('ok', true, 'seq', next_seq, 'docs', private.zoe_json_array(stored_list));
    grow := grow + private.zoe_op_bytes(p_op_id, result);
    if p_enforce and grow > 0 and used + grow > quota then
        raise exception 'quota_exceeded' using errcode = '22023', detail = 'bytes';
    end if;
    update public.zoe_tenant_state s set seq = next_seq, bytes = greatest(s.bytes + grow, 0) where s.tenant_id = tenant;
    insert into public.zoe_ops (tenant_id, op_id, result) values (tenant, p_op_id, result);
    if changed and next_seq % 64 = 0 then
        perform private.zoe_housekeeping(tenant);
    end if;
    return jsonb_build_object('ok', true, 'seq', next_seq, 'now', now_ms, 'docs', private.zoe_json_array(out_list));
end
$$;

create or replace function private.zoe_root_value(p_work jsonb, p_root text) returns jsonb
language sql immutable set search_path = ''
as $$
    select coalesce(('{' || string_agg(to_json(substr(e.key, char_length(p_root) + 2))::text || ':' || e.value::text, ',') || '}')::jsonb, 'null'::jsonb)
    from jsonb_each(p_work) e
    where starts_with(e.key, p_root || '/') and e.value <> 'null'::jsonb
$$;

create or replace function private.zoe_housekeeping(p_tenant uuid) returns void
language plpgsql volatile set search_path = ''
as $$
declare
    purged bigint;
    freed_docs bigint;
    freed_ops bigint;
begin
    with gone as (
        delete from public.zoe_docs z
        where z.tenant_id = p_tenant and z.value is null and z.updated_at < now() - interval '7 days'
        returning z.seq, private.zoe_doc_bytes(z.root, z.key, null) as b
    )
    select max(gone.seq), coalesce(sum(gone.b), 0) into purged, freed_docs from gone;
    if purged is not null then
        update public.zoe_tenant_state s set purged_seq = greatest(s.purged_seq, purged) where s.tenant_id = p_tenant;
    end if;
    with gone as (
        delete from public.zoe_ops o where o.tenant_id = p_tenant and o.created_at < now() - interval '2 days'
        returning private.zoe_op_bytes(o.op_id, o.result) as b
    )
    select coalesce(sum(gone.b), 0) into freed_ops from gone;
    if freed_docs + freed_ops > 0 then
        update public.zoe_tenant_state s set bytes = greatest(s.bytes - freed_docs - freed_ops, 0) where s.tenant_id = p_tenant;
    end if;
end
$$;

create or replace function public.zoe_read(p_root text, p_key text default null) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
    tenant uuid := private.current_tenant_id();
    docs jsonb;
begin
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    select coalesce(('[' || string_agg(jsonb_build_object('r', d.root, 'k', d.key, 'v', coalesce(d.value, 'null'::jsonb),
            's', case when d.value is null then 0 else d.seq end)::text, ',') || ']')::jsonb, '[]'::jsonb)
        into docs
    from public.zoe_docs d
    where d.tenant_id = tenant and d.root = p_root and (p_key is null or d.key = p_key) and (p_key is not null or d.value is not null);
    return jsonb_build_object('now', private.zoe_now_ms(), 'docs', docs);
end
$$;

create or replace function public.zoe_pull(p_since bigint, p_limit integer default 2000, p_full_head bigint default null) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
    tenant uuid := private.current_tenant_id();
    head bigint := 0;
    purged bigint := 0;
    since bigint := coalesce(p_since, 0);
    lim integer := least(greatest(coalesce(p_limit, 2000), 1), 5000);
    max_bytes bigint := 2097152;
    full_head bigint := p_full_head;
    tomb_after bigint;
    upper_seq bigint;
    rows_out jsonb;
    more boolean := false;
    full_sync boolean := false;
begin
    if tenant is null then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    select s.seq, s.purged_seq into head, purged from public.zoe_tenant_state s where s.tenant_id = tenant;
    head := coalesce(head, 0);
    purged := coalesce(purged, 0);
    if full_head is not null and (since <= 0 or full_head < purged or full_head > head) then
        full_head := null;
    end if;
    if since < 0 or since > head or (since > 0 and since < purged and full_head is null) then
        since := 0;
    end if;
    full_sync := since = 0;
    if full_sync then
        full_head := head;
    end if;
    tomb_after := case when full_head is null then since else full_head end;
    select max(x.seq) into upper_seq
    from (
        select w.seq, row_number() over o as rn, sum(coalesce(pg_column_size(w.value), 0)) over o as running
        from (
            select d.seq, d.value from public.zoe_docs d
            where d.tenant_id = tenant and d.seq > since and (d.value is not null or d.seq > tomb_after)
            order by d.seq
            limit lim
        ) w
        window o as (order by w.seq rows between unbounded preceding and current row)
    ) x
    where x.rn = 1 or x.running <= max_bytes;
    if upper_seq is null then
        return jsonb_build_object('seq', greatest(since, head), 'more', false, 'reset', full_sync, 'head', head,
            'tenant', tenant, 'now', private.zoe_now_ms(), 'rows', '[]'::jsonb);
    end if;
    select coalesce(('[' || string_agg(jsonb_build_object('r', d.root, 'k', d.key, 'v', coalesce(d.value, 'null'::jsonb), 's', d.seq)::text, ','
            order by d.seq) || ']')::jsonb, '[]'::jsonb)
        into rows_out
    from public.zoe_docs d
    where d.tenant_id = tenant and d.seq > since and d.seq <= upper_seq
        and (d.value is not null or d.seq > tomb_after);
    more := exists (
        select 1 from public.zoe_docs d
        where d.tenant_id = tenant and d.seq > upper_seq
            and (d.value is not null or d.seq > tomb_after)
    );
    return jsonb_build_object('seq', case when more then upper_seq else greatest(upper_seq, head) end, 'more', more, 'reset', full_sync,
        'head', head, 'tenant', tenant, 'now', private.zoe_now_ms(), 'rows', rows_out);
end
$$;

create or replace function public.zoe_admin_export(
    p_tenant uuid,
    p_after_seq bigint default 0,
    p_after_root text default '',
    p_after_key text default '',
    p_tombstones_after bigint default null,
    p_limit integer default 500,
    p_max_bytes integer default 2097152
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
    lim integer := least(greatest(coalesce(p_limit, 500), 1), 2000);
    max_bytes bigint := least(greatest(coalesce(p_max_bytes, 2097152), 65536), 4194304);
    after_seq bigint := greatest(coalesce(p_after_seq, 0), 0);
    after_root text := coalesce(p_after_root, '');
    after_key text := coalesce(p_after_key, '');
    head bigint := 0;
    purged bigint := 0;
    threshold bigint;
    rows_out jsonb;
    taken integer;
    fetched integer;
    last_seq bigint;
    last_root text;
    last_key text;
    more boolean;
begin
    if p_tenant is null or not exists (select 1 from public.tenants t where t.id = p_tenant) then
        raise exception 'tenant-not-found' using errcode = 'P0002';
    end if;
    select s.seq, s.purged_seq into head, purged from public.zoe_tenant_state s where s.tenant_id = p_tenant;
    head := coalesce(head, 0);
    purged := coalesce(purged, 0);
    threshold := greatest(coalesce(p_tombstones_after, head), 0);
    with page as (
        select z.root, z.key, z.value, z.seq,
            row_number() over w as rn,
            sum(coalesce(octet_length(z.value::text), 0) + octet_length(z.root) + octet_length(z.key) + 40) over w as running
        from (
            select z.root, z.key, z.value, z.seq
            from public.zoe_docs z
            where z.tenant_id = p_tenant and z.seq >= after_seq
                and (z.seq, z.root collate "C", z.key collate "C") > (after_seq, after_root collate "C", after_key collate "C")
                and (z.value is not null or z.seq > threshold)
            order by z.seq, z.root collate "C", z.key collate "C"
            limit lim + 1
        ) z
        window w as (order by z.seq, z.root collate "C", z.key collate "C" rows between unbounded preceding and current row)
    ), picked as (
        select p.* from page p
        where p.rn <= lim and (p.rn = 1 or p.running <= max_bytes)
    )
    select coalesce(('[' || string_agg(jsonb_build_object('r', p.root, 'k', p.key, 'v', coalesce(p.value, 'null'::jsonb), 's', p.seq)::text, ','
            order by p.rn) || ']')::jsonb, '[]'::jsonb),
        count(*)::integer,
        (select count(*)::integer from page),
        (array_agg(p.seq order by p.rn desc))[1],
        (array_agg(p.root order by p.rn desc))[1],
        (array_agg(p.key order by p.rn desc))[1]
        into rows_out, taken, fetched, last_seq, last_root, last_key
    from picked p;
    more := fetched > taken;
    return jsonb_build_object('tenant', p_tenant, 'head', head, 'purged', purged, 'tombstones_after', threshold,
        'now', private.zoe_now_ms(), 'rows', rows_out, 'more', more,
        'next', case when more then jsonb_build_object('seq', last_seq, 'root', last_root, 'key', last_key) else 'null'::jsonb end);
end
$$;

drop function private.zoe_rule_true(jsonb, jsonb);
drop function private.zoe_eval(jsonb, jsonb);

update public.zoe_tenant_state s set bytes = coalesce((
    select sum(private.zoe_doc_bytes(z.root, z.key, z.value)) from public.zoe_docs z where z.tenant_id = s.tenant_id
), 0) + coalesce((
    select sum(private.zoe_op_bytes(o.op_id, o.result)) from public.zoe_ops o where o.tenant_id = s.tenant_id
), 0);

revoke all on function private.zoe_doc_bytes(text, text, jsonb), private.zoe_op_bytes(text, jsonb), private.zoe_merge(jsonb, jsonb[], integer),
    private.zoe_json_object(text[], jsonb[]), private.zoe_json_array(jsonb[]),
    private.zoe_snap_exists(jsonb, jsonb), private.zoe_eval(jsonb, jsonb, jsonb)
    from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
