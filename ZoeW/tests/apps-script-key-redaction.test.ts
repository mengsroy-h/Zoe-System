// @vitest-environment node
// Re-audit ៖ the Apps Script `key` is attached to the lookup URL at send time (`lookupUrlWithKey()`). `encodeURIComponent` leaves
// ' ( ) * ! ~ as they are, and the Sentry redactor ends a query value at «'» (a URL quoted in an error message) ➜ the part of a key
// after an apostrophe reached Sentry (`…&key=[redacted]'sKey2026!`). The key is percent-encoded completely.
import fs from 'node:fs';
import vm from 'node:vm';
import { expect, it } from 'vitest';
import { lookupUrlWithKey } from '../src/services/setup-lookup';

const source = fs.readFileSync(new URL('../public/error-reporting.js', import.meta.url), 'utf8');
const context: any = vm.createContext({ window: {}, setTimeout, clearTimeout, console });
vm.runInContext(source, context);
const api = context.window.ZoeErrors;

it("an Apps Script key holding ' ( ) * ! ~ never reaches Sentry in part", () => {
    const key = "Boss'sKey(2026)*!~x";
    const url = lookupUrlWithKey('https://script.google.com/macros/s/AKfy/exec?barcode=ZT1', key);
    expect(new URL(url).searchParams.get('key')).toBe(key);
    for (const text of ['Failed to fetch ' + url, "fetch '" + url + "' failed", 'GET ' + url + ' 500']) {
        const safe = api.redactEvent({ message: text, breadcrumbs: [{ data: { url } }] });
        expect(JSON.stringify(safe), text).not.toMatch(/sKey|2026|Boss/);
    }
});
