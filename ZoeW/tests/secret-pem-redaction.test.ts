// @vitest-environment node
import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

for (const app of ['ZoeW/public', 'ZoeKeyGen']) describe(app + ' ៖ PEM ឯកជនមិនចេញតាម telemetry', () => {
    const source = fs.readFileSync(new URL('../../' + app + '/error-reporting.js', import.meta.url), 'utf8');
    const context = vm.createContext({ window: {}, setTimeout, clearTimeout, console });
    vm.runInContext(source, context);
    const api = context.window.ZoeErrors;
    for (const kind of ['', 'RSA ', 'EC ', 'OPENSSH ', 'ENCRYPTED ']) {
        for (const newline of ['\n', '\r\n', '\\n']) it(kind + 'PRIVATE KEY · ' + JSON.stringify(newline), () => {
            const pem = '-----BEGIN ' + kind + 'PRIVATE KEY-----' + newline + 'U1lOVEhFVElDX1BSSVZBVEVfS0VZ' + newline + '-----END ' + kind + 'PRIVATE KEY-----';
            const event = { message: 'Import failed: ' + pem, extra: { value: pem, barcode: '000000000000' } };
            const safe = api.redactEvent(event);
            expect(JSON.stringify(safe)).not.toContain('U1lOVEhFVElDX1BSSVZBVEVfS0VZ');
            expect(safe.extra.barcode).toBe('000000000000');
            expect(safe.message).toContain('Import failed:');
        });
    }
    it('PEM ដែលកាត់ខ្លី និង PEM ក្នុង JSON string នៅតែលាក់', () => {
        const raw = '-----BEGIN ' + 'PRIVATE KEY-----\nU1lOVEhFVElDX1BSSVZBVEVfS0VZ';
        expect(api.redactUrl(raw)).toBe('[redacted]');
        expect(api.redactUrl(JSON.stringify({ message: raw + '\n-----END PRIVATE KEY-----', count: 7 }))).not.toContain('U1lOVEhFVElDX1BSSVZBVEVfS0VZ');
    });
    it('public PEM និងសារធម្មតានៅអានបាន', () => {
        const value = '-----BEGIN PUBLIC KEY-----\nU1lOVEhFVElDX1BVQkxJQw==\n-----END PUBLIC KEY-----';
        expect(api.redactUrl(value)).toBe(value);
        expect(api.redactUrl('network permission_denied')).toBe('network permission_denied');
    });
});
