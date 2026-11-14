import { describe, it } from 'vitest';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const { serverCases, clientCases, uiCases } = require('./helpers/sheet-import-protocol.cjs');
type Case = { name: string; run: () => void | Promise<void> };

for (const [group, cases] of [
    ['server', serverCases(root)],
    ['client', clientCases(root)],
    ['UI ownership', uiCases(root)]
] as [string, Case[]][]) {
    describe('Sheet import ' + group, () => {
        it.each(cases.map(({ name, run }) => [name, run] as const))('%s', async (_name, run) => {
            await run();
        });
    });
}
