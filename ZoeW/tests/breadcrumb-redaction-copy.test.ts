// @vitest-environment node
// X5 (deep audit 8): Sentry console breadcrumbs carry the live arguments of `console.*`. `beforeBreadcrumb` redacted them in
// place, so a logged app object lost its fields (`auth` · `token` ➜ '[redacted]', a URL's `key=` rewritten) for the App
// itself. A breadcrumb is redacted on a copy (copy on the first change); the event path keeps its own redaction.
import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

for (const app of ['ZoeW/public', 'ZoeKeyGen']) describe(app + ' ៖ breadcrumb ត្រូវលាក់លើច្បាប់ចម្លង មិនកែវត្ថុរស់របស់ App', () => {
    it('the breadcrumb is redacted · the logged objects keep their values', async () => {
        const source = fs.readFileSync(new URL('../../' + app + '/error-reporting.js', import.meta.url), 'utf8');
        let options: any = null;
        const window: any = { Sentry: { onLoad: (fn: () => void) => fn(), init: (o: any) => { options = o; }, setTag: () => {} } };
        const context = vm.createContext({ window, setTimeout, clearTimeout, console, document: { querySelector: () => null, createElement: () => ({}), head: { appendChild: () => {} } }, localStorage: { getItem: () => null, setItem: () => {} } });
        vm.runInContext(source, context);
        await Promise.resolve(window.ZoeErrors.init('zoew', '0.0.0')).catch(() => {});
        expect(typeof options?.beforeBreadcrumb).toBe('function');
        const err: any = new Error('lookup failed'); err.lookupReason = 'https://script.google.com/macros/s/x/exec?key=SHEETKEY123';
        const live = { auth: 'Bearer abc.def', url: 'https://x.test/api?token=TKN987', count: 3, nested: { secret: 'S1' } };
        const crumb = { category: 'console', message: 'x', data: { arguments: [live, err] } };
        const out = options.beforeBreadcrumb(crumb);
        expect(JSON.stringify(out)).not.toContain('TKN987');
        expect(JSON.stringify(out)).not.toContain('Bearer abc.def');
        expect({ auth: live.auth, url: live.url, secret: live.nested.secret, reason: err.lookupReason, args: crumb.data.arguments[0] === live })
            .toEqual({ auth: 'Bearer abc.def', url: 'https://x.test/api?token=TKN987', secret: 'S1', reason: 'https://script.google.com/macros/s/x/exec?key=SHEETKEY123', args: true });
    });
});
