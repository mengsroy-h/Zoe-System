create or replace function private.zoe_eval(p_expr jsonb, p_ctx jsonb, p_scope jsonb) returns jsonb
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
            return to_jsonb(left_num::float8 + right_num::float8);
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
