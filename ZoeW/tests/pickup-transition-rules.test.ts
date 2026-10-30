import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileRules, rulesSql } from '../../supabase/scripts/rtdb-rules.mjs';

const repo = path.resolve(__dirname, '../..');
const rulesFile = JSON.parse(readFileSync(path.join(repo, 'firebase-database.rules.json'), 'utf8'));
const roots = ['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod'];
const maxInteger = 9007199254740990;
const stringBounds = { intent: 128, actorUid: 2048, scope: 2048, scanDate: 10, itemId: 128, code: 2048 };
const marker = () => ({ intent: 'pk_fixture_001', actorUid: 'actor-A', scope: 'https://shop.invalid', scanDate: '2026-10-30',
    itemId: 'item-A', code: 'PARCEL-A', epoch: 3, birth: 1700000000000, restored: 0, closed: true, closedAt: 1700000001000, changes: 1 });
const barcode = (receipt: any = marker()) => ({ code: 'PARCEL-A', createdAt: 1700000000000, isClosed: true, closedAt: 1700000001000,
    cod: 12.5, dod: 0, ...(receipt === undefined ? {} : { pickupTransition: receipt }) });

function snapshot(tree: any, parts: string[]): any {
    const value = parts.reduce((node, key) => node?.[key], tree) ?? null;
    return { val: () => value, exists: () => value !== null, isString: () => typeof value === 'string',
        isNumber: () => typeof value === 'number' && Number.isFinite(value), isBoolean: () => typeof value === 'boolean',
        hasChildren: (keys?: string[]) => value !== null && typeof value === 'object'
            && (keys ? keys.every(key => value[key] != null) : Object.keys(value).length > 0),
        child: (key: string) => snapshot(tree, [...parts, ...String(key).split('/')]), parent: () => snapshot(tree, parts.slice(0, -1)) };
}

function validate(root: string, next: any, previous: any = null) {
    const location = [root, 'item-A', 'barcodes', '0'];
    const tree = { [root]: { 'item-A': { barcodes: { 0: next } } } };
    const oldTree = { [root]: { 'item-A': { barcodes: { 0: previous } } } };
    function walk(rule: any, parts: string[]): boolean {
        const data = snapshot(tree, parts);
        if (!data.exists()) return true;
        const expression = rule['.validate'];
        if (expression !== undefined) {
            const accepted = typeof expression === 'boolean' ? expression
                : new Function('newData', 'data', 'root', 'auth', 'now', 'return (' + expression + ');')(
                    data, snapshot(oldTree, parts), snapshot(oldTree, []), { uid: 'actor-B' }, 1700000002000);
            if (!accepted) return false;
        }
        const value = data.val();
        return typeof value !== 'object' || Object.keys(value).every(key => {
            const child = rule[key] || rule.$other;
            return !child || walk(child, [...parts, key]);
        });
    }
    return walk(rulesFile.rules[root].$itemId.barcodes.$idx, location);
}

// វាស់តែ .validate ពិត; មិនជំនួស emulator សម្រាប់ .write ឬ PostgreSQL/RLS ទេ។
for (const root of roots) describe(root + ' pickupTransition', () => {
    it('ទទួល receipt បិទ និងបើកដែលមានអត្តសញ្ញាណពេញ', () => {
        expect(validate(root, barcode())).toBe(true);
        expect(validate(root, { ...barcode({ ...marker(), closed: false, closedAt: 0 }), isClosed: false, closedAt: 0 })).toBe(true);
    });
    it('រក្សាកំណត់ត្រាចាស់គ្មាន receipt និងការលុប receipt របស់ client ចាស់', () => {
        const legacy = { code: 'LEGACY', isClosed: true, cod: 2, dod: 0 };
        expect(validate(root, legacy)).toBe(true);
        expect(validate(root, legacy, barcode())).toBe(true);
        expect(validate(root, null, barcode())).toBe(true);
    });
    it('ចម្លង receipt ដោយ actor ផ្សេង និងទុក lifecycle ចាស់ឱ្យ recovery ពិនិត្យ មិនបិទការកែធម្មតា', () => {
        const previous = barcode();
        expect(validate(root, { ...previous, locker: 'B-2' }, previous)).toBe(true);
        expect(validate(root, { ...previous, createdAt: 1700000002000, restoredAt: 1700000003000 }, previous)).toBe(true);
    });
    it.each(Object.keys(marker()))('បដិសេធ receipt បាត់វាល %s', field => {
        const invalid: any = marker(); delete invalid[field];
        expect(validate(root, barcode(invalid))).toBe(false);
    });
    it.each([true, 1, 'receipt', { ...marker(), unknown: 'x' }, [marker()]])('បដិសេធរូបរាង ឬវាលលើស %#', invalid => {
        expect(validate(root, barcode(invalid))).toBe(false);
    });
    for (const [field, max] of Object.entries(stringBounds)) {
        it.each(['', 4, false, 'x'.repeat(max + 1)])('បដិសេធ string ' + field + ' ខុសព្រំដែន %#', value => {
            expect(validate(root, barcode({ ...marker(), [field]: value }))).toBe(false);
        });
        it('ទទួល string ' + field + ' នៅព្រំដែន', () => {
            expect(validate(root, barcode({ ...marker(), [field]: 'x'.repeat(max) }))).toBe(true);
        });
    }
    it('scanDate ត្រូវមានប្រវែង ១០', () => {
        expect(validate(root, barcode({ ...marker(), scanDate: '2026-1-1' }))).toBe(false);
    });
    for (const field of ['epoch', 'birth', 'restored', 'closedAt', 'changes']) {
        it.each([-1, 1.5, '1', true, maxInteger + 1])('បដិសេធចំនួន ' + field + ' ខុសព្រំដែន %#', value => {
            expect(validate(root, barcode({ ...marker(), [field]: value }))).toBe(false);
        });
        it('ទទួលចំនួន ' + field + ' នៅព្រំដែន', () => {
            expect(validate(root, barcode({ ...marker(), [field]: maxInteger }))).toBe(true);
        });
    }
    it.each(['birth', 'changes'])('បដិសេធសូន្យ %s', field => {
        expect(validate(root, barcode({ ...marker(), [field]: 0 }))).toBe(false);
    });
    it.each([0, 1, 'true'])('closed ត្រូវជា boolean %#', value => {
        expect(validate(root, barcode({ ...marker(), closed: value }))).toBe(false);
    });
});

it('migration ចុងក្រោយស្មើ compiler របស់ rules ទាំងមូល', () => {
    const dir = path.join(repo, 'supabase/migrations');
    const latest = readdirSync(dir).filter(name => /^\d{14}_zoe_rules\.sql$/.test(name)).sort().at(-1)!;
    expect(readFileSync(path.join(dir, latest), 'utf8')).toBe(rulesSql(compileRules(rulesFile)));
});
