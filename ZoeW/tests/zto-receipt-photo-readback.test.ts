// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('ផ្ទៀងផ្ទាត់រូបដូចដើមដោយប្រើតែទិន្នន័យសាកល្បង និងបិទពេលមិនប្រាកដ', () => {
    const output = execFileSync(process.execPath, ['--test', fileURLToPath(new URL('./zto-receipt-photo-readback.node.cjs', import.meta.url))], { encoding: 'utf8', timeout: 10000 });
    expect(output).toMatch(/(?:#|ℹ) fail 0/);
    expect(output).toMatch(/(?:#|ℹ) skipped 0/);
});
