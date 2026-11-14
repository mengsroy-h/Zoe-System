import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseExpression } = require('../../../../supabase/scripts/rtdb-expression.cjs');

it('compiles only the two owned session witnesses used by the shared Rules', () => {
    expect(parseExpression('auth.token.session_id', [])).toEqual({ t: 'auth_claim', n: 'session_id' });
    expect(parseExpression('auth.token.auth_time', [])).toEqual({ t: 'auth_claim', n: 'auth_time' });
    expect(parseExpression('auth.token.auth_time * 1000', []).t).toBe('b');
    expect(parseExpression('auth.token.session_id.length', []).t).toBe('p');
});

it('rejects incomplete token objects, methods and unsupported claims instead of emitting an unevaluable AST', () => {
    for (const value of ['auth.token', 'auth.token === null', 'auth.token.val()', 'auth.token.length', 'auth.token.role', 'auth.token.admin', 'auth.token.auth_time.other']) {
        expect(() => parseExpression(value, [])).toThrow();
    }
});
