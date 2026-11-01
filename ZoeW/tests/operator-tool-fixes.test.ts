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
        for (const clear of [false, true]) it('redactor បដិសេធ output ជា input alias ៖ ' + alias + ' / clear=' + clear, () => {
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
                const run = spawnSync(process.execPath, [path.join(sourceRoot, 'audit-tools/redact-dump.js'), ...(clear ? ['--clear-output'] : []), input, output], { cwd: temp, encoding: 'utf8' });
                expect(run.error).toBeUndefined();
                expect({ exit: run.status, original: fs.readFileSync(input, 'utf8') }).toEqual({ exit: 1, original });
                expect(fs.readFileSync(path.resolve(temp, output), 'utf8')).toBe(original);
            } finally { fs.rmSync(temp, { recursive: true, force: true }); }
        });
    }

    it.each(['present', 'missing', 'dangling', 'directory'])('លុបតែលទ្ធផលដាច់ពី input និងផ្ទៀង absence ៖ %s', (shape) => {
        const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-clear-output-'));
        try {
            const input = path.join(temp, 'dump.json'), output = path.join(temp, 'safe.json');
            fs.writeFileSync(input, '{invalid-json');
            if (shape === 'present') fs.writeFileSync(output, 'stale unsafe copy');
            if (shape === 'dangling') fs.symlinkSync(path.join(temp, 'missing-target'), output);
            if (shape === 'directory') fs.mkdirSync(output);
            const run = spawnSync(process.execPath, [path.join(sourceRoot, 'audit-tools/redact-dump.js'), '--clear-output', input, output], { encoding: 'utf8' });
            expect(run.error).toBeUndefined();
            expect(run.status, run.stdout + run.stderr).toBe(shape === 'directory' ? 1 : 0);
            expect(fs.readFileSync(input, 'utf8')).toBe('{invalid-json');
            if (shape === 'directory') expect(fs.lstatSync(output).isDirectory()).toBe(true);
            else expect(() => fs.lstatSync(output)).toThrow(expect.objectContaining({ code: 'ENOENT' }));
        } finally { fs.rmSync(temp, { recursive: true, force: true }); }
    });

    it('clear output ត្រូវមាន explicit destination មុនប៉ះ file', () => {
        const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-clear-args-'));
        try {
            const input = path.join(temp, 'dump.json');
            fs.writeFileSync(input, '{}');
            const run = spawnSync(process.execPath, [path.join(sourceRoot, 'audit-tools/redact-dump.js'), '--clear-output', input], { encoding: 'utf8' });
            expect(run.status).toBe(2);
            expect(fs.readFileSync(input, 'utf8')).toBe('{}');
        } finally { fs.rmSync(temp, { recursive: true, force: true }); }
    });

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
        const compatibility = launcher.indexOf('findstr /l /x /c:"const clearOutput = process.argv[2] === \'--clear-output\';"');
        expect(compatibility).toBeGreaterThanOrEqual(0);
        expect(compatibility).toBeLessThan(launcher.indexOf('redact-dump.js" --clear-output'));
        expect(launcher.slice(compatibility)).toMatch(/if errorlevel 1 \([\s\S]*?exit \/b 3/);
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
    it('smoke អាន version ពី SideDrawer ពិត ហើយបដិសេធ label ដែលបាត់', async () => {
        const { createElement } = await import('react');
        const { renderToStaticMarkup } = await import('react-dom/server');
        const { SideDrawer } = await import('../src/app/components/SideDrawer');
        const { renderAppVersionLabels } = await import('../src/core/actions');
        const { APP_VERSION } = await import('../src/core/version');
        const infoNode = declaration('info');
        const callback = infoNode.declarations[0].init.argument.arguments[0];
        const measure = code.slice(callback.start, callback.end);
        renderAppVersionLabels();
        document.body.innerHTML = renderToStaticMarkup(createElement(SideDrawer));
        try {
            const context = vm.createContext({ document, window });
            expect(vm.runInContext('(' + measure + ')()', context).versionLabel).toContain(APP_VERSION);
            document.querySelectorAll('[data-app-version]').forEach(el => el.remove());
            expect(vm.runInContext('(' + measure + ')()', context).versionLabel).toBeNull();
        } finally { document.body.innerHTML = ''; }
    });
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
