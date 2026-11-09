import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { moduleView } from '../scripts/checker-view.mjs';
const require = createRequire(import.meta.url);
const { modulePrograms } = require('../../audit-tools/audit-module-ast');
const { localCacheWrites } = require('../../audit-tools/payload-local-cache.cjs');
const root = path.resolve(import.meta.dirname, '..');
const names = ['src/features/zto-final-marks.ts', 'src/features/zto-status.ts'];
const originals = Object.fromEntries(names.map(name => [name, moduleView(fs.readFileSync(path.join(root, name), 'utf8'), name)]));
function count(views: Record<string, string>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-cache-'));
    try {
        const source = Object.values(views).join('');
        fs.writeFileSync(path.join(dir, 'audit-module-views.json'), JSON.stringify(views));
        return localCacheWrites(source, modulePrograms(source, path.join(dir, 'app.js'), { ecmaVersion: 2022 }), views).size;
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function change(name: string, before: string, after: string) {
    expect(originals[name].includes(before)).toBe(true);
    return { ...originals, [name]: originals[name].replace(before, after) };
}
describe('ប្រភពកំណត់ត្រា cache ក្នុងឧបករណ៍', () => {
    it('សរសេរបីវាលពីប្រភពពិត', () => expect(count(originals)).toBe(3));
    it('module ខុសមិនទទួលសិទ្ធិពីឈ្មោះ function', () => expect(count({ 'src/features/unrelated.ts': originals[names[0]], [names[1]]: originals[names[1]] })).toBe(2));
    it('Map ពី backend មិនមែន Map ក្នុងឧបករណ៍', () => expect(count(change(names[0], 'const ztoReturnedEvidence = new Map();', 'const ztoReturnedEvidence = backendItems;'))).toBe(2));
    it('អ្នកហៅ resolver ជាមួយ backend object ត្រូវបដិសេធ', () => expect(count(change(names[1], 'resolveZtoPickupSignTime(prior);', 'resolveZtoPickupSignTime(backendItem);'))).toBe(1));
    it('Map.set backend alias ត្រូវបដិសេធ', () => expect(count(change(names[1], 'ztoPickupStatus.set(key, verdict);', 'ztoPickupStatus.set(key, backendItem);'))).toBe(1));
    it('assignment ប្តូរប្រភព parameter ត្រូវបដិសេធ', () => expect(count(change(names[1], 'entry.signedAt = exact', 'entry = backendItem; entry.signedAt = exact'))).toBe(1));
    it('function ឈ្មោះដូចគ្នាក្នុង module ផ្សេងមិនទទួលសិទ្ធិ', () => expect(count({ ...originals, 'src/unrelated.ts': '\nfunction resolveZtoPickupSignTime(entry) { entry.signedAt = 1; }\n' })).toBe(1));
    it('Map ដែល escape ទៅ module ផ្សេងមិនទទួលសិទ្ធិ', () => expect(count({ ...originals, 'src/unrelated.ts': '\nztoPickupStatus.set(key, backendItem);\n' })).toBe(1));
    it('alias របស់ entry ដែល escape ត្រូវបដិសេធ', () => expect(count(change(names[1], 'entry.signedAt = exact', 'const alias = entry; send(alias); entry.signedAt = exact'))).toBe(1));
    it('ប្រភពលទ្ធផលនាឡិកាខុសត្រូវបដិសេធ', () => expect(count(change(names[1], 'const now = getServerNow();', 'const now = backendItem;'))).toBe(1));
    it('វាល local ដែលសរសេរតម្លៃខុសរូបរាងមិនទទួលសិទ្ធិ', () => expect(count(change(names[1], 'entry.signedAt = exact || retained || now;', 'entry.signedAt = backendItem;'))).toBe(2));
    it('parameter shadow ក្នុង callback មិនទទួលសិទ្ធិពី scope ខាងក្រៅ', () => expect(count(change(names[0], '(entry, key) => {\n            if (!clock.current())', '(entry, key, clock) => {\n            if (!clock.current())'))).toBe(2));
    it('clock guard ដែលបាត់មិនត្រូវឆ្លង', () => expect(count(change(names[1], 'if (!clock.current()) return false;', 'if (false) return false;'))).toBe(1));
    it('Map.get ជំនួសដោយ backend មិនមែនប្រភព local', () => expect(count({ ...originals, [names[1]]: originals[names[1]] + '\nztoPickupStatus.get = () => backendItem;\n' })).toBe(1));
    it('Object.assign លើ Map method មិនទទួលសិទ្ធិ', () => expect(count({ ...originals, [names[1]]: originals[names[1]] + '\nObject.assign(ztoPickupStatus.get, backendItem);\n' })).toBe(1));
    it('តម្លៃ cache ដែលបញ្ជូនទៅ Firebase មិនទទួលសិទ្ធិ', () => expect(count(change(names[1], 'if (resolveZtoPickupSignTime(restored)) upgraded = true;', 'if (resolveZtoPickupSignTime(restored)) upgraded = true; fb.set(ref, restored);'))).toBe(1));
    it('alias ដែលបញ្ជូនទៅអ្នកហៅក្រៅត្រូវបដិសេធ', () => expect(count(change(names[1], 'if (resolveZtoPickupSignTime(restored)) upgraded = true;', 'if (resolveZtoPickupSignTime(restored)) upgraded = true; const leak = restored; send(leak);'))).toBe(1));
    it('cache object ដែលរុំក្នុង payload ត្រូវបដិសេធ', () => expect(count(change(names[1], 'if (resolveZtoPickupSignTime(restored)) upgraded = true;', 'if (resolveZtoPickupSignTime(restored)) upgraded = true; send({ value: restored });'))).toBe(1));

    it.each([
        'return prior;',
        'return true ? prior : null;',
        'external.value = (true ? prior : null);',
        'external.value = (0, prior);',
        'send(true ? prior : null);',
        'send((0, prior));',
        'external.value = () => prior;',
        '(() => send(prior))();',
        'function leak() { return prior; } leak();',
        'external.value = [prior];'
    ])('ការប្រើ object ក្រៅ role local ត្រូវបដិសេធ៖ %s', escape => expect(count(change(names[1], 'resolveZtoPickupSignTime(prior);', 'resolveZtoPickupSignTime(prior); ' + escape))).toBe(1));
    it('getter alias មិនអាចបន្ថែមច្រកចេញក្រៅដែលមិនបានវាស់', () => expect(count(change(names[1], 'return latest && latest.at >= bound.at ? latest : bound;', 'send(latest); return latest && latest.at >= bound.at ? latest : bound;'))).toBe(1));

    it('destructuring shadow មិនទទួលប្រភព const ចាស់', () => expect(count(change(names[1], 'resolveZtoPickupSignTime(prior);', '{ const {prior} = backendItem; resolveZtoPickupSignTime(prior); }'))).toBe(1));
    it('destructuring assignment មិនរក្សាប្រភព object ចាស់', () => expect(count(change(names[1], 'resolveZtoPickupSignTime(prior);', '({prior} = backendItem); resolveZtoPickupSignTime(prior);'))).toBe(1));

    it.each(['external.value = true ? entry : null;', 'send((0, entry));', 'external.value = () => entry;', 'return true ? entry : null;'])('writer parameter មិនអាច escape តាម expression ៖ %s', escape => expect(count(change(names[1], 'entry.signedAt = exact || retained || now;', escape + ' entry.signedAt = exact || retained || now;'))).toBe(1));
    it('clock method មិនអាចជំនួសដោយ true', () => expect(count(change(names[1], 'if (!clock.current()) return false;', 'clock.current = () => true; if (!clock.current()) return false;'))).toBe(1));

});
