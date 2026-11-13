// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';

for (const checker of ['breadcrumb-redaction-copy.test.ts', 'secret-pem-redaction.test.ts']) {
    it.each(['ZoeW/public', 'ZoeKeyGen'])(`${checker} ៖ អាន error-reporting ពិតរបស់ %s ពី root`, (app) => {
        const file = path.resolve('../tools/audit-tools/zoew/tests', checker);
        const source = fs.readFileSync(file, 'utf8');
        const expression = source.match(/new URL\([^\n]*?\/error-reporting\.js', import\.meta\.url\)/)?.[0];
        expect(expression).toBeDefined();
        const actual = vm.runInNewContext(expression!.replace('import.meta.url', 'sourceUrl'), {
            URL, app, sourceUrl: pathToFileURL(file).href
        });
        expect(actual.href).toBe(pathToFileURL(path.resolve('..', app, 'error-reporting.js')).href);
        expect(fs.readFileSync(actual, 'utf8')).toBe(fs.readFileSync(path.resolve('..', app, 'error-reporting.js'), 'utf8'));
    });
}

it.each(['', '2'])('hang-guard ៖ បង្កើត fixture %s tools/audit-tools នៅក្នុងថតទទេ', (suffix) => {
    const source = fs.readFileSync('../tools/audit-tools/hang-guard.js', 'utf8');
    const start = source.indexOf(`    const fx${suffix}Tools =`);
    const end = source.indexOf(`    const names${suffix} =`, start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-nested-fixture-'));
    try {
        expect(fs.existsSync(path.join(fx, 'tools'))).toBe(false);
        vm.runInNewContext(source.slice(start, end), { fs, path, fx, fx2: fx });
        expect(fs.statSync(path.join(fx, 'tools/audit-tools')).isDirectory()).toBe(true);
    } finally { fs.rmSync(fx, { recursive: true, force: true }); }
});
