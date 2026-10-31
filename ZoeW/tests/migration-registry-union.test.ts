import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { validateTree } = require('../../tools/supabase-migrate/migrate.js');
const rules = JSON.parse(fs.readFileSync(path.resolve('../firebase-database.rules.json'), 'utf8')).rules;
const registry = 'zoew_barcode_registry';
const errors = (value: unknown, selected = rules, root = registry) => validateTree({ [root]: { PARCEL_A: value } }, selected).problems.filter((p: any) => p.level === 'error');
const custom = (expression: string) => ({ [registry]: { $barcodeKey: { '.validate': expression, v: { '.validate': 'newData.val() === 2' } } } });

describe('ការផ្ទេរ registry៖ legacy true និង owned object មិនច្រឡំគ្នា', () => {
    it('ទទួល legacy true តាម union ក្នុង rules ពិត និងរក្សា owned object', () => {
        expect(errors(true)).toEqual([]);
        expect(errors({ v: 2, intent: 'scan_' + 'a'.repeat(32), actorUid: 'actor', birth: 17 })).toEqual([]);
    });
    it.each([false, 'true', 'item-id', 1, 0])('មិនបើក primitive ផ្សេង %s', (value) => expect(errors(value).length).toBeGreaterThan(0));
    it('មិនបើក root ផ្សេង និង root scalar', () => {
        expect(errors(true, rules, 'zoew_scan_history_cod_dod').length).toBeGreaterThan(0);
        expect(validateTree({ [registry]: true }, rules).problems.some((p: any) => p.level === 'error')).toBe(true);
    });
    it.each([
        'newData.val() === true || newData.hasChildren([\'v\'])',
        '(true === newData.val()) || (auth.uid === \'quoted || ( )\')',
        '((newData.val() === true) && true) || newData.hasChildren([\'v\'])',
        'newData.hasChildren([\'escaped \\\' || )\']) || newData.val() === true',
    ])('ទទួលតែ proof ជាក់លាក់ %s', (expression) => expect(errors(true, custom(expression))).toEqual([]));
    it.each([
        '(newData.val() === true || newData.hasChildren([\'v\'])) && false',
        '(newData.val() === true) && auth != null',
        '!(auth == null)',
        '(auth == null) === false',
        'auth.uid === \'newData.val() === true ||\'',
        'newData.val() === false',
        '(newData.val() === true) ||',
        '(newData.val() === true',
        'newData.val() === true || bogus()',
        'newData.val() === true; false',
        'true || auth.uid === \'unterminated',
    ])('ខ្វះ proof ឬ syntax ខូច ត្រូវបដិសេធ %s', (expression) => expect(errors(true, custom(expression)).length).toBeGreaterThan(0));
    it('cache រូបរាង rules មិនអនុញ្ញាតបន្តពេល expression ប្រែ', () => {
        const selected = custom('newData.val() === true || newData.hasChildren([\'v\'])');
        expect(errors(true, selected)).toEqual([]);
        selected[registry].$barcodeKey['.validate'] = 'false && newData.hasChildren([\'v\'])';
        expect(errors(true, selected).length).toBeGreaterThan(0);
    });
    it('កំណត់ទំហំ និងជម្រៅ expression', () => {
        expect(errors(true, custom('true || ' + '('.repeat(80) + 'auth != null' + ')'.repeat(80))).length).toBeGreaterThan(0);
        expect(errors(true, custom('true || ' + 'false || '.repeat(5000) + 'false')).length).toBeGreaterThan(0);
    });
});
