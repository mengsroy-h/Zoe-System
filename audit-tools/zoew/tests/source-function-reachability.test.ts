import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeSourceFunctions } from '../scripts/source-function-reachability.mjs';

const folders: string[] = [];
function fixture(files: Record<string, string>, config: Record<string, unknown> = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-source-functions-'));
    folders.push(root);
    fs.mkdirSync(path.join(root, 'src'));
    for (const [file, source] of Object.entries(files)) fs.writeFileSync(path.join(root, 'src', file), source);
    fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', skipLibCheck: true, types: [], noEmit: true }, include: ['src'], ...config }));
    return { projectPath: path.join(root, 'tsconfig.json'), sourceRoot: path.join(root, 'src') };
}
const report = (files: Record<string, string>) => analyzeSourceFunctions(fixture(files));
const candidates = (value: ReturnType<typeof report>) => value.functions.filter(row => row.status === 'candidate').map(row => row.file + ':' + row.name).sort();
afterEach(() => { folders.splice(0).forEach(folder => fs.rmSync(folder, { recursive: true, force: true })); });

describe('source graph៖ binding ពិត និង report-only', () => {
    it('ស្គាល់ self/mutual recursion ដែលគ្មាន root', () => {
        const result = report({ 'a.ts': 'export {}; function a(){b()} function b(){a()} function lone(){lone()}' });
        expect(result.complete).toBe(true);
        expect(candidates(result)).toEqual(['a.ts:a', 'a.ts:b', 'a.ts:lone']);
        expect(result.deletionSafe).toBe(false);
    });
    it('rooted recursion និង callbacks នៅតែ retained', () => {
        expect(candidates(report({ 'a.ts': 'export {}; function a(){b()} function b(){a()} a(); function callback(){} const registry={callback};' }))).toEqual([]);
    });
    it('aliases និង re-export មិនបាត់ public API', () => {
        const result = report({ 'provider.ts': 'function helper(){} export function api(){helper()}', 'bridge.ts': 'export {api as call} from "./provider";', 'consumer.ts': 'import {call as run} from "./bridge";run();' });
        expect(result.complete).toBe(true);
        expect(candidates(result)).toEqual([]);
    });
    it('export default expression ជា evaluation root', () => {
        expect(candidates(report({ 'a.ts': 'function build(){} export default build();' }))).toEqual([]);
    });
    it('ឈ្មោះដូចគ្នាក្នុង module ផ្សេង មិនបញ្ចូលគ្នា', () => {
        expect(candidates(report({ 'a.ts': 'export {};function helper(){helper()}', 'b.ts': 'export {};function helper(){} helper();' }))).toEqual(['a.ts:helper']);
    });
    it('parameter shadow មិនធ្វើឲ្យ private declaration retained', () => {
        expect(candidates(report({ 'a.ts': 'export {}; function helper(){} function root(helper:()=>void){helper()} root(()=>{});' }))).toEqual(['a.ts:helper']);
    });
    it('type references និង type-only exports មិនមែន runtime roots', () => {
        expect(candidates(report({ 'a.ts': 'function helper(){} type T=typeof helper; export type {helper,T};' }))).toEqual(['a.ts:helper']);
    });
    it('exported arrow និង method wrapper រក្សា private callee', () => {
        expect(candidates(report({ 'a.ts': 'function helper(){} export const cb=()=>helper(); export const object={method(){helper()}};' }))).toEqual([]);
    });
    it('default parameter នៅក្រោម function owner', () => {
        expect(candidates(report({ 'a.ts': 'export {}; function helper(){} function dead(cb=helper){return cb}'}))).toEqual(['a.ts:dead', 'a.ts:helper']);
    });
    it('overload signatures មិនបំបែក implementation symbol', () => {
        expect(candidates(report({ 'a.ts': 'export {}; function helper(x:string):string; function helper(x:string){return x} helper("x");' }))).toEqual([]);
    });
    it.each(['eval("helper()")', 'const e=eval;e("helper()")', 'new Function("helper()")', 'const name="./other";void import(name)', 'void import.meta.glob("./*.ts")'])('dynamic scope បង្កើត unknown ៖ %s', source => {
        const result = report({ 'a.ts': 'export {}; function helper(){} ' + source });
        expect(result.complete).toBe(false);
        expect(candidates(result)).toEqual([]);
        expect(result.functions.find(row => row.name === 'helper')?.status).toBe('unknown');
    });
    it('missing import និង parse error មិនបង្កើត candidate ភស្តុតាងក្លែង', () => {
        for (const source of ['import {missing} from "./missing"; function dead(){} missing();', 'export {}; function dead(){} const broken = ;']) {
            const result = report({ 'a.ts': source });
            expect(result.complete).toBe(false);
            expect(candidates(result)).toEqual([]);
        }
    });
    it('references-only config និង wrong source root មិនបៃតងទទេ', () => {
        const options = fixture({ 'a.ts': 'export function api(){}' }, { files: [], include: [], references: [{ path: './child' }] });
        expect(() => analyzeSourceFunctions(options)).toThrow();
        expect(() => analyzeSourceFunctions({ ...fixture({ 'a.ts': 'export {};' }), sourceRoot: '/missing-source-root' })).toThrow();
    });
    it.each([
        'function factory(){return class {}} class C extends factory() {} new C();',
        'function helper(){} function factory(callback:()=>void){callback();return class {}} const C=class extends factory(helper) {}; new C();',
        'function helper<T>(){} const callback=helper<string>;callback();'
    ])('runtime heritage/instantiation មិនមែន type-only ៖ %s', body => {
        const result = report({ 'a.ts': 'export {};'+body });
        expect(result.complete).toBe(true);
        expect(candidates(result)).toEqual([]);
    });
    it.each(['import.meta["glob"]("./*.ts")', 'const {glob}=import.meta;glob("./*.ts")'])('glob alias នៅតែ unknown ៖ %s', body => {
        const result = report({ 'globals.d.ts': 'interface ImportMeta {glob(path:string):unknown}', 'a.ts': 'export {};function helper(){}'+body });
        expect(result.complete).toBe(false);
        expect(candidates(result)).toEqual([]);
    });
    it('ambient declarations ក្នុង config នៅតែជាផ្នែក compiler input', () => {
        const result = report({ 'globals.d.ts': 'declare const externalRoot: (callback:()=>void)=>void;', 'a.ts': 'export {};function helper(){}externalRoot(helper);' });
        expect(result.complete).toBe(true);
        expect(candidates(result)).toEqual([]);
    });
    it('source edit ផ្លាស់ hash និងលទ្ធផល ដោយមិនប្រើ stale artifact', () => {
        const options = fixture({ 'a.ts': 'export {};function helper(){}' });
        const first = analyzeSourceFunctions(options);
        fs.appendFileSync(path.join(options.sourceRoot, 'a.ts'), '\nhelper();');
        const second = analyzeSourceFunctions(options);
        expect(candidates(first)).toEqual(['a.ts:helper']);
        expect(candidates(second)).toEqual([]);
        expect(first.sources[0].hash).not.toEqual(second.sources[0].hash);
    });
    it('CLI report-only បែងចែក candidate និង unknown ដោយ exit code ពិត', () => {
        for (const [body, exit] of [['export {};function helper(){}', 0], ['export {};function helper(){}eval("helper()");', 2]] as const) {
            const options = fixture({ 'a.ts': body });
            const child = spawnSync(process.execPath, ['../audit-tools/zoew/scripts/source-function-reachability.mjs', options.projectPath, options.sourceRoot], { encoding: 'utf8' });
            expect(child.status).toBe(exit);
            const output = JSON.parse(child.stdout);
            expect(output.mode).toBe('report-only');
            expect(output.deletionSafe).toBe(false);
            expect(output.counts[exit ? 'unknown' : 'candidates']).toBe(1);
        }
    });
    it('moduleView ពិតបាត់ export តែ source graph រក្សា root', async () => {
        const { moduleView, overrideFunction } = await import('../scripts/checker-view.mjs');
        const source = 'export function api(){helper()} function helper(){}';
        const viewed = moduleView(source, '/fixture/a.ts');
        expect(viewed).not.toContain('export function');
        const originals: string[] = [];
        const replaced = overrideFunction(viewed, 'api', 'function api(){}', originals);
        expect(replaced).not.toContain('api(){helper()}');
        expect(candidates(report({ 'a.ts': source }))).toEqual([]);
    });
});
