import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
const { probeObjectShapes } = createRequire(import.meta.url)('../../audit-tools/rules-shape.js');
const rules = { rules: { registry: { '.write': 'auth != null', $key: { '.validate': 'newData.val() === true || newData.hasChildren()', field: { '.validate': true } } }, other: { '.write': 'auth != null', field: { '.validate': true } } } };
async function probe(mutation = '') {
    let control = true;
    return probeObjectShapes({ rules, samples: { $key: 'KEY' }, allowedPrimitives: { '/registry/$key': [true] },
        loadRules: async value => { control = !value.rules.registry.$key['.validate']; return true; }, reset: async () => {},
        write: async (path, value) => ({ denied: !control && !(path === '/registry/KEY' && (value === true && mutation !== 'deny-true' || value === false && mutation === 'allow-false') || path === '/other' && mutation === 'allow-other') }),
        denied: result => result.denied });
}
it('exact registry legacy true arm is positive, all other primitive probes remain negative', async () => {
    expect((await probe()).every(result => result.reachable && result.rejected)).toBe(true);
    for (const mutation of ['deny-true', 'allow-false', 'allow-other'])
        expect((await probe(mutation)).some(result => !result.rejected)).toBe(true);
});
