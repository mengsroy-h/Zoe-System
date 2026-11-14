import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const req = createRequire(import.meta.url);
const { shortenWildcardChildPaths, assertWildcardChildPathsEquivalent } = req('./helpers/rules-boolean-grouping.cjs');
it.each(['root', 'data', 'newData'])('path របស់ wildcard string %s រក្សា expanded AST', base => {
    const before = `${base}.child('business').child($id).child('claim/token').val() === 'intent'`;
    const after = shortenWildcardChildPaths(before, ['$id']);
    expect(after).toBe(`${base}.child('business/'+$id+'/claim/token').val() === 'intent'`);
    expect(() => assertWildcardChildPathsEquivalent(before, after, ['$id'])).not.toThrow();
});
it.each(["data.child('key').val()", 'null', '0', 'true'])('dynamic argument %s មិនត្រូវបម្លែងទៅ string', argument => {
    const expression = `root.child('business').child(${argument}).child('value').exists()`;
    expect(shortenWildcardChildPaths(expression, [])).toBe(expression);
});
it('path ឬ wildcard ផ្សេងគ្នាត្រូវបានចាប់ដោយ controlled mutation', () => {
    expect(() => assertWildcardChildPathsEquivalent("root.child('business').child($id).child('value').exists()",
        "root.child('business/'+$id+'/other').exists()", ['$id'])).toThrow();
});
