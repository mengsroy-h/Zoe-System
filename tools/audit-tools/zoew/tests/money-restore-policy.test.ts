import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';

const require = createRequire(import.meta.url);
const source = readFileSync(require.resolve('../../money-cookie-blob.js'), 'utf8');
const declarations: Record<string, string> = {};
simple(parse(source, { ecmaVersion: 'latest' }), {
    VariableDeclarator(node: any) {
        if (!node.init) return;
        const expression = source.slice(node.init.start, node.init.end);
        if (node.id.name === 'finalTrash') declarations.cleanup = expression;
        if (node.id.name === 'blocked' && expression.includes('scenario.signed')) declarations.manual = expression;
        if (node.id.name === 'lockedFlow') declarations.lookupOff = expression;
        if (node.id.name === 'flowNames') declarations.flows = expression;
        if (node.id.name === 'sourceId' && expression.includes('sign_race_')) declarations.raceId = expression;
        if (node.id.name === 'code' && expression.includes('900 + index * 10')) declarations.raceCode = expression;
        if (node.id.name === 'phone' && expression.includes('097700061')) declarations.racePhone = expression;
    },
    IfStatement(node: any) {
        if (source.slice(node.consequent.start, node.consequent.end).includes("'sign_race_'")) {
            declarations.signRace = source.slice(node.test.start, node.test.end);
        }
    }
});

it.each(['sheet', 'cookie', 'palm'] as const)('%s៖ manual restore matrix បែងចែក unsigned ពី Sign ពិត', authMode => {
    expect(declarations.manual).toBeTypeOf('string');
    for (const signed of [false, true]) {
        expect(runInNewContext(declarations.manual, { authMode, scenario: { signed } }), 'Sign គឺមូលហេតុហាម មិនមែន auth mode').toBe(signed);
    }
});

it.each(['sheet', 'cookie', 'palm'] as const)('%s៖ cleanup matrix ហាម Palm pickup និង Sign តែអនុញ្ញាត unsigned manual/age cleanup', authMode => {
    expect(declarations.cleanup).toBeTypeOf('string');
    for (const movement of ['delete', 'remove', 'pickup2h', 'abandon8d']) for (const signedTrash of [false, true]) {
        const unsignedPolicy = {
            sheet: { delete: false, remove: false, pickup2h: false, abandon8d: false },
            cookie: { delete: false, remove: false, pickup2h: false, abandon8d: false },
            palm: { delete: false, remove: false, pickup2h: true, abandon8d: false }
        };
        const expected = signedTrash || unsignedPolicy[authMode][movement];
        expect(runInNewContext(declarations.cleanup, { authMode, movement, signedTrash }), movement + '/signed=' + signedTrash).toBe(expected);
    }
});

it.each(['cookie', 'palm'] as const)('%s៖ lookup-off negative ត្រូវជ្រើស signed delete ជំនួស unsigned delete', authMode => {
    const flows = runInNewContext(declarations.flows, {});
    const selected = runInNewContext(declarations.lookupOff, { authMode });
    expect(flows[selected]).toBe('delete-signed');
});


it.each(['cookie', 'palm'] as const)('%s៖ browser money matrix ត្រូវចាក់ Sign ក្រោយ claim និង prepare', authMode => {
    expect(declarations.signRace).toBeTypeOf('string');
    expect(runInNewContext(declarations.signRace, { authMode })).toBe(true);
});

it('Sign race fixtures ត្រូវបំបែក source/barcode/phone រវាង Palm និង Cookie ក្នុង DB ដដែល', () => {
    for (const name of ['raceId', 'raceCode', 'racePhone']) {
        const context = { tag: 'shared-backend', phase: 'prepared', site: '1', index: 0 };
        const cookie = runInNewContext(declarations[name], { ...context, authMode: 'cookie' });
        const palm = runInNewContext(declarations[name], { ...context, authMode: 'palm' });
        expect(palm, name + ' មិនត្រូវយក lifecycle ដែល test មុនបានប្រើ').not.toBe(cookie);
    }
});
