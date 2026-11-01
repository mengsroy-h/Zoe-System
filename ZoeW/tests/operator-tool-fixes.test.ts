import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'acorn';

const sourceRoot = process.env.ZOE_TOOLS_SOURCE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = (relative: string) => fs.readFileSync(path.join(sourceRoot, relative), 'utf8');

describe('ឧបករណ៍ ៖ រក្សាឯកសារដើម និងរាយកំហុសពិត', () => {
    for (const alias of ['same', 'relative', 'hardlink', 'symlink']) {
        it('redactor បដិសេធ output ជា input alias ៖ ' + alias, () => {
            const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-redact-alias-'));
            try {
                const input = path.join(temp, 'dump.json');
                const original = JSON.stringify({ zoew_history: { row: { phone: '081234567', barcodes: [{ code: 'ZTO12345', cod: 3, dod: 2 }] } } });
                fs.writeFileSync(input, original);
                let output = input;
                if (alias === 'relative') output = './dump.json';
                if (alias === 'hardlink' || alias === 'symlink') {
                    output = path.join(temp, 'alias.json');
                    if (alias === 'hardlink') fs.linkSync(input, output);
                    else fs.symlinkSync(input, output);
                }
                const run = spawnSync(process.execPath, [path.join(sourceRoot, 'audit-tools/redact-dump.js'), input, output], { cwd: temp, encoding: 'utf8' });
                expect(run.error).toBeUndefined();
                expect({ exit: run.status, original: fs.readFileSync(input, 'utf8') }).toEqual({ exit: 1, original });
                expect(fs.readFileSync(path.resolve(temp, output), 'utf8')).toBe(original);
            } finally { fs.rmSync(temp, { recursive: true, force: true }); }
        });
    }

    it('redactor output ដាច់ពី input ៖ សម្អាតបាន និងរក្សា input ដដែល', () => {
        const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-redact-distinct-'));
        try {
            const input = path.join(temp, 'dump.json');
            const output = path.join(temp, 'safe.json');
            const original = JSON.stringify({ zoew_history: { row: { phone: '081234567', barcodes: [{ code: 'ZTO12345', cod: 3, dod: 2 }] } } });
            fs.writeFileSync(input, original);
            fs.writeFileSync(output, 'previous safe copy');
            const run = spawnSync(process.execPath, [path.join(sourceRoot, 'audit-tools/redact-dump.js'), input, output], { encoding: 'utf8' });
            expect(run.status, run.stdout + run.stderr).toBe(0);
            expect(fs.readFileSync(input, 'utf8')).toBe(original);
            const cleaned = fs.readFileSync(output, 'utf8');
            expect(cleaned).not.toContain('081234567');
            expect(cleaned).not.toContain('ZTO12345');
            expect(JSON.parse(cleaned).zoew_history.row.barcodes[0].cod).toBe(3);
        } finally { fs.rmSync(temp, { recursive: true, force: true }); }
    });

    it('launcher មិនលុប SAFE មុន ឬក្រោយ redactor បដិសេធ input alias', () => {
        const launcher = source('tools/money-check-windows/check-money.cmd');
        expect(launcher).toMatch(/redact-dump\.js/);
        expect(launcher).not.toMatch(/\bdel\s+[^\r\n]*%SAFE%/i);
    });

    it('static server ទប់ traversal/symlink និងបែងចែក malformed/missing ពី SPA route', async () => {
        const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-serve-root-'));
        const root = path.join(temp, 'public');
        fs.mkdirSync(root);
        fs.writeFileSync(path.join(root, 'index.html'), '<h1>public fixture</h1>');
        fs.writeFileSync(path.join(root, 'app.js'), 'public asset');
        fs.writeFileSync(path.join(root, 'has space.txt'), 'decoded asset');
        fs.writeFileSync(path.join(temp, 'outside.txt'), 'outside fixture');
        fs.symlinkSync(path.join(temp, 'outside.txt'), path.join(root, 'linked.txt'));
        fs.symlinkSync(path.join(root, 'app.js'), path.join(root, 'allowed.js'));
        const moduleUrl = pathToFileURL(path.join(sourceRoot, 'ZoeW/scripts/serve.mjs')).href;
        const { serveDir } = await import(/* @vite-ignore */ moduleUrl);
        const { server, port } = await serveDir(root);
        const get = (route: string) => new Promise<{ status: number; text: string }>((resolve, reject) => {
            http.get({ host: '127.0.0.1', port, path: route }, (res) => {
                let text = '';
                res.setEncoding('utf8');
                res.on('data', (part) => { text += part; });
                res.on('end', () => resolve({ status: res.statusCode || 0, text }));
            }).on('error', reject);
        });
        try {
            expect(await get('/app.js')).toEqual({ status: 200, text: 'public asset' });
            expect(await get('/allowed.js')).toEqual({ status: 200, text: 'public asset' });
            expect(await get('/has%20space.txt')).toEqual({ status: 200, text: 'decoded asset' });
            expect(await get('/some/client-route')).toEqual({ status: 200, text: '<h1>public fixture</h1>' });
            const rows = await Promise.all(['/%2e%2e%2foutside.txt', '/linked.txt', '/%', '/%00', '/missing.js'].map(get));
            expect(rows.map((row) => row.status)).toEqual([403, 403, 400, 400, 404]);
            expect(rows.every((row) => !row.text.includes('outside fixture'))).toBe(true);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
            fs.rmSync(temp, { recursive: true, force: true });
        }
    });
});

describe('smoke ៖ runtime pageerror និង boot ដែលមិនទាន់រួច ត្រូវធ្វើឲ្យ gate ក្រហម', () => {
    const code = source('ZoeW/scripts/smoke.mjs');
    const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module' }) as any;
    const callbacks = ast.body.filter((node: any) => node.type === 'ExpressionStatement' && node.expression?.callee?.object?.name === 'page' && node.expression.callee.property.name === 'on');
    const helpers = ast.body.filter((node: any) => node.type === 'FunctionDeclaration' && ['smokeBootOk', 'isExpectedConsoleNetworkError'].includes(node.id.name)).map((node: any) => code.slice(node.start, node.end)).join('\n');
    const declaration = (name: string) => ast.body.find((node: any) => node.type === 'VariableDeclaration' && node.declarations.some((decl: any) => decl.id.name === name));
    const exit = ast.body.find((node: any) => node.type === 'ExpressionStatement' && node.expression?.callee?.object?.name === 'process' && node.expression.callee.property.name === 'exit');
    const healthy = { root: true, navbar: true, pages: true, modals: 4, drawerGroups: 4, versionLabel: 'ZoeW', rejections: [] };
    function verdict(event: string, text: string, info: any = healthy, resourceUrl = 'https://external.invalid/font.woff2') {
        const handlers: Record<string, any> = {};
        const context = vm.createContext({ errors: [], info, bridgeOk: true, syntaxOk: true, swSplitOk: true, tokenOk: true, sdkGateOk: true, page: { on: (name: string, fn: any) => { handlers[name] = fn; } } });
        vm.runInContext(helpers + '\n' + callbacks.map((node: any) => code.slice(node.start, node.end)).join('\n'), context);
        if (event === 'pageerror') handlers.pageerror(new Error(text));
        if (event === 'console') handlers.console({ type: () => 'error', text: () => text, location: () => ({ url: resourceUrl }) });
        for (const name of ['noisy', 'bootOk']) {
            const node = declaration(name);
            if (node) vm.runInContext(code.slice(node.start, node.end), context);
        }
        return vm.runInContext(code.slice(exit.expression.arguments[0].start, exit.expression.arguments[0].end), context);
    }
    it('boot រួច និង console network abort ដែលស្គាល់ ៖ control បៃតង', () => {
        expect(verdict('', '')).toBe(0);
        expect(verdict('console', 'Failed to load resource: net::ERR_INTERNET_DISCONNECTED')).toBe(0);
    });
    for (const message of ['ordinary failure', 'ERR_RUNTIME_BUG', 'sentry parser crashed', 'favicon handler threw']) {
        it('pageerror ត្រូវរក្សាទុក ៖ ' + message, () => expect(verdict('pageerror', message)).toBe(1));
    }
    it('console runtime error មិនមែន known network noise ត្រូវក្រហម', () => expect(verdict('console', 'ERR_RUNTIME_BUG')).toBe(1));
    for (const resourceUrl of ['', 'http://127.0.0.1:1234/app.js']) {
        it('console network error គ្មាន external resource ពិត ត្រូវក្រហម ៖ ' + resourceUrl, () => expect(verdict('console', 'Failed to load resource: net::ERR_INTERNET_DISCONNECTED', healthy, resourceUrl)).toBe(1));
    }
    for (const missing of ['root', 'navbar', 'pages', 'modals', 'drawerGroups', 'versionLabel']) {
        it('boot ខ្វះ ' + missing + ' ត្រូវក្រហម', () => expect(verdict('', '', { ...healthy, [missing]: null })).toBe(1));
    }
    it('unhandled rejection ត្រូវក្រហម ទោះគ្មាន pageerror', () => expect(verdict('', '', { ...healthy, rejections: ['synthetic rejection'] })).toBe(1));
});
