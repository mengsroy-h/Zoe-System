import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { expect, it } from 'vitest';

for (const checker of ['zto-negative-cache-test.js', 'zto-signed-status-test.js', 'zto-list-sync-test.js']) {
    it(`${checker} ៖ អានឯកសារ ZTO ពិតពី docs និងគោរព tree ដែលបានជ្រើស`, () => {
        const root = path.resolve('..');
        const source = fs.readFileSync(path.join(root, 'tools/audit-tools', checker), 'utf8');
        const reads = [...source.matchAll(/path\.join\(ROOT,\s*[^;\n]*?'ZTO-SETUP-KH\.md'\)/g)];
        expect(reads.length).toBe(checker === 'zto-list-sync-test.js' ? 2 : 1);
        const document = fs.readFileSync(path.join(root, 'docs/zoew/ZTO-SETUP-KH.md'), 'utf8');
        const target = fs.mkdtempSync(path.join(os.tmpdir(), 'zto-doc-target-'));
        try {
            fs.mkdirSync(path.join(target, 'docs/zoew'), { recursive: true });
            fs.writeFileSync(path.join(target, 'docs/zoew/ZTO-SETUP-KH.md'), 'ឯកសារពី tree ដែលបានជ្រើស');
            for (const [expression] of reads) {
                const locate = (ROOT: string) => vm.runInNewContext(expression, { ROOT, path });
                expect(fs.readFileSync(locate(root), 'utf8')).toBe(document);
                expect(fs.readFileSync(locate(target), 'utf8')).toBe('ឯកសារពី tree ដែលបានជ្រើស');
                fs.renameSync(path.join(target, 'docs/zoew/ZTO-SETUP-KH.md'), path.join(target, 'docs/zoew/absent.md'));
                expect(() => fs.readFileSync(locate(target), 'utf8')).toThrow(/ENOENT/);
                fs.renameSync(path.join(target, 'docs/zoew/absent.md'), path.join(target, 'docs/zoew/ZTO-SETUP-KH.md'));
            }
        } finally { fs.rmSync(target, { recursive: true, force: true }); }
    });
}
