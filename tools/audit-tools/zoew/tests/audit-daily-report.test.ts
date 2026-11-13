import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import cp from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../../../..');
const source = fs.readFileSync(path.join(root, 'tools/audit-tools/supabase-datastore-test.js'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/audit.yml'), 'utf8');
const start = source.indexOf('        const canonicalProducer =');
const report = source.slice(start, source.indexOf('\n    } finally', start));

function emit({ filename = 'supabase-datastore-test.js', writeFails = false, outputFails = false, github = true, main = true } = {}) {
    const events: string[][] = [];
    const canonical = {};
    const run = () => vm.runInNewContext(report, {
        ROOT: '/measure', path, JSON, sizes: [{ count: 300, oldBytes: 100, newBytes: 1 }],
        __filename: '/measure/tools/audit-tools/' + filename, __dirname: '/measure/tools/audit-tools',
        module: canonical, require: { main: main ? canonical : {} },
        process: { env: github ? { GITHUB_OUTPUT: '/job-output' } : {} },
        fs: {
            realpathSync: (x: string) => path.resolve(x),
            writeFileSync: (file: string, data: string) => {
                events.push(['write', file, data]);
                if (writeFails) throw Error('write failed');
            },
            appendFileSync: (file: string, data: string) => {
                events.push(['output', file, data]);
                if (outputFails) throw Error('output failed');
            },
        },
    });
    return { run, events };
}

describe('របាយការណ៍ daily delta របស់អ្នករត់ canonical', () => {
    it('សរសេររបាយការណ៍មុនប្រកាស receipt', () => {
        expect(start).toBeGreaterThan(-1);
        const h = emit(); h.run();
        expect(h.events.map(x => x[0])).toEqual(['write', 'output']);
        expect(h.events[0][1]).toBe(path.join('/measure', 'supabase-datastore-daily-bytes.json'));
        expect(h.events[1][2]).toBe('daily_bytes=supabase-datastore-daily-bytes.json\n');
    });
    it('សរសេរបរាជ័យមិនប្រកាសជោគជ័យ ហើយ receipt បរាជ័យមិនបាត់កំហុស', () => {
        const h = emit({ writeFails: true });
        expect(h.run).toThrow('write failed');
        expect(h.events).toHaveLength(1);
        expect(emit({ outputFails: true }).run).toThrow('output failed');
    });
    it.each([{ filename: '.tmp-poison-supabase-datastore-test.js' }, { main: false }])('shadow/import មិនបោះពុម្ព artifact ឬ receipt', options => {
        const h = emit(options); h.run(); expect(h.events).toEqual([]);
    });
    it('local មិនមាន GitHub output នៅតែសរសេររបាយការណ៍', () => {
        const h = emit({ github: false }); h.run(); expect(h.events).toHaveLength(1);
    });
    it('workflow ប្រមូលតាម receipt ពិត មិនកំណត់ shard ហើយបដិសេធឯកសារបាត់ឬខូច', () => {
        const collect = workflow.match(/ {6}- name: បង្ហាញការវាស់ទំហំ daily delta\n(?:.*\n)*?(?= {6}- name:)/)?.[0];
        expect(collect).toBeDefined();
        expect(collect).toContain("steps.audit.outputs.daily_bytes == 'supabase-datastore-daily-bytes.json'");
        expect(collect).not.toContain('matrix.shard ==');
        expect(workflow).toContain('id: audit');
        expect(workflow).toContain('name: supabase-datastore-daily-bytes-${{ matrix.shard }}');
        expect(workflow).toContain('if-no-files-found: error');
        const script = collect!.split('        run: |\n')[1].split('\n').filter(x => x.startsWith('          ')).map(x => x.slice(10)).join('\n');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-report-'));
        try {
            const file = path.join(dir, 'ZoeW/dist-audit/measure-root/supabase-datastore-daily-bytes.json');
            fs.mkdirSync(path.dirname(file), { recursive: true });
            const run = () => cp.spawnSync('bash', ['-c', script], { cwd: dir }).status;
            expect(run()).not.toBe(0);
            fs.writeFileSync(file, 'not JSON'); expect(run()).not.toBe(0);
            fs.writeFileSync(file, '[{"count":300}]\n'); expect(run()).toBe(0);
        } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    });
});
