import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { moduleView } from '../scripts/checker-view.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const require = createRequire(import.meta.url);
const { parse, walk } = require('../../static-checker-contracts.cjs');
const cleanup = moduleView(fs.readFileSync(path.join(ROOT, 'ZoeW/src/domain/cleanup.ts'), 'utf8'), 'src/domain/cleanup.ts');
const fn = parse(cleanup).body.find((node: any) => node.type === 'FunctionDeclaration' && node.id.name === 'runAutomaticDeletedCleanup');
const purgeBody = cleanup.slice(fn.start, fn.end);
const current = parse(cleanup).body.find((node: any) => node.type === 'FunctionDeclaration' && node.id.name === 'deletedCleanupCurrent');
const purgeCurrentBody = cleanup.slice(current.start, current.end);

async function checker(source: string, currentSource = purgeCurrentBody) {
    const checkerSource = fs.readFileSync(path.join(ROOT, 'tools/audit-tools/write-stall-guard-test.js'), 'utf8');
    const ast = parse(checkerSource);
    let expression = '';
    walk(ast, (node: any) => {
        if (node.type === 'CallExpression' && node.callee.name === 'ok'
            && node.arguments[0]?.value === 'សម្អាតស្វ័យប្រវត្តិប្រើ atomic purge ជាមួយម្ចាស់ដដែល') {
            expression = checkerSource.slice(node.arguments[1].start, node.arguments[1].end);
        }
    });
    expect(expression).not.toBe('');
    const helperPath = path.join(ROOT, 'tools/audit-tools/cleanup-purge-checker-contract.cjs');
    const context = { purgeBody: source, purgeCurrentBody: currentSource, ...(fs.existsSync(helperPath) ? require(helperPath) : {}) };
    return await vm.runInNewContext('(async () => (' + expression + '))()', context);
}

it('checker ពិតទទួល callback ដែលរក្សាម្ចាស់ដើម និងព្រំអាយុ រួមទាំងការហៅម្ដងទៀត', async () => {
    expect(await checker(purgeBody)).toBe(true);
});

it.each([
    ['ម្ចាស់ត្រូវបានរំលង', 'candidateCurrent = () => current() &&', 'candidateCurrent = () => true &&'],
    ['ម្ចាស់វគ្គត្រូវបានរំលង', 'deletedCleanupCurrent(owner)', 'true'],
    ['ព្រំអាយុត្រូវបានរំលង', 'purgeTrashWithRegistry(candidate.source, candidateCurrent)', 'purgeTrashWithRegistry(candidate.source, current)'],
    ['callback ត្រូវបានរំលង', 'purgeTrashWithRegistry(candidate.source, candidateCurrent)', 'purgeTrashWithRegistry(candidate.source)'],
    ['source មិនមែនធាតុដើម', 'purgeTrashWithRegistry(candidate.source, candidateCurrent)', 'purgeTrashWithRegistry({}, candidateCurrent)'],
    ['ការហៅលើកទី២បាត់ callback', 'done = await purgeTrashWithRegistry(candidate.source, candidateCurrent)', 'done = await purgeTrashWithRegistry(candidate.source, () => true)'],
    ['ព្រំអាយុស្មើគ្នាត្រូវបានទទួល', '> trashRetentionMs(candidate.source)', '>= trashRetentionMs(candidate.source)']
])('ទិសផ្ទុយ៖ %s', async (_label, before, after) => {
    expect(purgeBody).toContain(before);
    expect(await checker(purgeBody.replaceAll(before, after))).toBe(false);
});

it.each(['db', 'sdk', 'generation', 'uid', 'scope'])('ទិសផ្ទុយ៖ ម្ចាស់ពិតមិនអាចរំលង %s', async field => {
    const parts: Record<string, string> = {
        db: 'owner.db === firebaseState.db', sdk: 'owner.sdk === firebaseState.fb',
        generation: 'owner.generation === firebaseState.authGeneration',
        uid: 'owner.uid === firebaseState.auth?.currentUser?.uid', scope: 'owner.scope === liveShopScope()'
    };
    expect(purgeCurrentBody).toContain(parts[field]);
    expect(await checker(purgeBody, purgeCurrentBody.replace(parts[field], 'true'))).toBe(false);
});
