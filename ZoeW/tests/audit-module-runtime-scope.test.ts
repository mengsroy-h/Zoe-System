import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, it } from 'vitest';

it('actual module runtime preserves private scopes and rejects invalid public bindings', () => {
    const output = execFileSync(process.execPath, [path.resolve('../audit-tools/module-runtime-scope-test.js')], {
        encoding: 'utf8', env: { ...process.env, NODE_PATH: path.resolve('node_modules') }
    });
    expect(output).toContain('PASS moduleRuntime explicit scopes');
});
