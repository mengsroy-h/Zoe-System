import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const sandbox = { require, module: { exports: {} as any } };
runInNewContext(readFileSync(resolve('../audit-tools/react-view.js'), 'utf8'), sandbox);
const { wrappedTransactionCallSites } = sandbox.module.exports;
const count = (source: string) => wrappedTransactionCallSites([source]).length;

describe('transaction audit ៖ រាប់តែ SDK wrapped និង const alias ដែលមាន lexical binding', () => {
    it('រាប់ការហៅផ្ទាល់ និង alias នៅក្នុង scope ពិត', () => {
        expect(count('fb.runTransaction(r, f); function work(){ const sdk = fb; sdk.runTransaction(r, f); const api = sdk; return () => api.runTransaction(r, f); }')).toBe(3);
        expect(count('function work(){const sdk = firebaseState.fb; sdk["runTransaction"](r, f);}')).toBe(1);
    });
    it('មិនរាប់ comment/string/property reference ជាការហៅ', () => {
        expect(count('// fb.runTransaction(r,f)\n const label = "fb.runTransaction(r,f)"; const value = fb.runTransaction;')).toBe(0);
    });
    it('មិនរាប់ SDK ផ្សេង និង alias ដែលអាចប្ដូរ', () => {
        expect(count('const sdk = rawFb; sdk.runTransaction(r,f); let mutable = fb; mutable = other; mutable.runTransaction(r,f); var old = fb; old.runTransaction(r,f);')).toBe(0);
    });
    it('parameter និង block binding មិនអាចលួច provenance ពី scope ខាងក្រៅ', () => {
        expect(count('function work(fb){const sdk=fb;sdk.runTransaction(r,f);} function outer(){const sdk=fb;{const sdk=other;sdk.runTransaction(r,f);}sdk.runTransaction(r,f);}')).toBe(1);
        expect(count('function work(firebaseState){const sdk=firebaseState.fb;sdk.runTransaction(r,f);}')).toBe(0);
        expect(count('function work({fb}){fb.runTransaction(r,f);}')).toBe(0);
    });
    it('var shadow ក្នុង block ត្រូវបាំង function ទាំងមូល', () => {
        expect(count('function work(){fb.runTransaction(r,f); if (x){var fb=other;}}')).toBe(0);
    });
    it('catch និង private bindings នៅ module ផ្សេងគ្នាមិនលាយ scope', () => {
        expect(count('try{}catch(fb){fb.runTransaction(r,f);}fb.runTransaction(r,f);')).toBe(1);
        expect(wrappedTransactionCallSites(['const sdk=fb;sdk.runTransaction(r,f);', 'const sdk=other;sdk.runTransaction(r,f);'])).toHaveLength(1);
    });
    it.each(['of', 'in'])('for-%s lexical bindings preserve the trusted outer SDK', (operator) => {
        expect(count(`for(const fb ${operator} list){fb.runTransaction(r,f);} fb.runTransaction(r,f);`)).toBe(1);
        expect(count(`const sdk=fb; for(let sdk ${operator} list){sdk.runTransaction(r,f);} sdk.runTransaction(r,f);`)).toBe(1);
        expect(count(`for(const {fb} ${operator} list){fb.runTransaction(r,f);} fb.runTransaction(r,f);`)).toBe(1);
        expect(count(`for(const firebaseState ${operator} list){firebaseState.fb.runTransaction(r,f);} firebaseState.fb.runTransaction(r,f);`)).toBe(1);
    });
    it('for-let scope ends at loop, while var is hoisted into the containing function', () => {
        expect(count('for(let fb=other; condition; fb++){fb.runTransaction(r,f);} fb.runTransaction(r,f);')).toBe(1);
        expect(count('for(const sdk=fb; condition; step()){sdk.runTransaction(r,f);} fb.runTransaction(r,f);')).toBe(2);
        expect(count('function work(){fb.runTransaction(r,f); for(var fb of list){fb.runTransaction(r,f);} fb.runTransaction(r,f);}fb.runTransaction(r,f);')).toBe(1);
        expect(count('function work(){for(var fb=other; condition; step()){fb.runTransaction(r,f);}fb.runTransaction(r,f);}')).toBe(0);
    });
    it.each(['of', 'in'])('for-%s bare assignment invalidates the existing binding rather than creating a new scope', (operator) => {
        expect(count(`fb.runTransaction(r,f); for(fb ${operator} list){fb.runTransaction(r,f);} fb.runTransaction(r,f);`)).toBe(1);
        expect(count(`const sdk=fb; for(fb ${operator} list){sdk.runTransaction(r,f);} sdk.runTransaction(r,f);`)).toBe(2);
        expect(count(`for({fb} ${operator} list){fb.runTransaction(r,f);} fb.runTransaction(r,f);`)).toBe(0);
        expect(count(`{for(fb ${operator} list){}} fb.runTransaction(r,f);`)).toBe(0);
    });
    it('for assignment initializer is not a lexical declaration', () => {
        expect(count('for(fb=other; condition; step()){fb.runTransaction(r,f);}fb.runTransaction(r,f);')).toBe(0);
        expect(count('const sdk=fb; {fb=other;} sdk.runTransaction(r,f);fb.runTransaction(r,f);')).toBe(1);
    });
    it('class declarations prebind their name and never earn wrapped-SDK credit', () => {
        expect(count('function work(){class fb{static runTransaction(){}};fb.runTransaction(r,f);}')).toBe(0);
        expect(count('{fb.runTransaction(r,f);class fb{}}fb.runTransaction(r,f);')).toBe(1);
        expect(count('function work(){class firebaseState{static fb=other;}firebaseState.fb.runTransaction(r,f);}')).toBe(0);
    });
    it('named class expressions bind privately, including methods, without hiding outer SDK', () => {
        expect(count('const C=class fb{static runTransaction(){} method(){fb.runTransaction(r,f);}};fb.runTransaction(r,f);')).toBe(1);
        expect(count('const C=class firebaseState{method(){firebaseState.fb.runTransaction(r,f);}};firebaseState.fb.runTransaction(r,f);')).toBe(1);
        expect(count('class C{static {var fb=other;fb.runTransaction(r,f);}}fb.runTransaction(r,f);')).toBe(1);
        expect(count('class C{static {fb.runTransaction(r,f);if(x){var fb=other;}} method(){fb.runTransaction(r,f);}}fb.runTransaction(r,f);')).toBe(2);
        expect(count('const C=class fb{};const sdk=fb;sdk.runTransaction(r,f);')).toBe(1);
    });
    it('switch cases share one class lexical scope while the discriminant and outside remain outer', () => {
        expect(count('switch(fb.runTransaction(r,f)){case 0:fb.runTransaction(r,f);break;case 1:class fb{};fb.runTransaction(r,f);}fb.runTransaction(r,f);')).toBe(2);
        expect(count('switch(x){case 0:class firebaseState{};case 1:firebaseState.fb.runTransaction(r,f);}firebaseState.fb.runTransaction(r,f);')).toBe(1);
    });
    it('កូដខូចនៅតែធ្លាក់ មិនប្រើ parser បន្ធូរ', () => {
        expect(() => count('const sdk = ; sdk.runTransaction(r,f);')).toThrow();
    });
});
