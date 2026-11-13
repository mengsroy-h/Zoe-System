import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.map': 'application/json'
};

export async function serveDir(root) {
    const base = await realpath(root);
    const contained = (file) => {
        const relative = path.relative(base, file);
        return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
    };
    return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            const reply = (status, text) => { res.writeHead(status); res.end(text); };
            let pathname;
            try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
            catch (e) { reply(400, 'bad request'); return; }
            if (pathname.includes('\0') || pathname.includes('\\')) { reply(400, 'bad request'); return; }
            try {
                const infoOf = (file) => stat(file).catch((error) => { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null; throw error; });
                let file = path.resolve(base, '.' + pathname);
                if (!contained(file)) { reply(403, 'forbidden'); return; }
                let info = await infoOf(file);
                if (info && info.isDirectory()) { file = path.join(file, 'index.html'); info = await infoOf(file); }
                if (!info && !path.extname(pathname)) { file = path.join(base, 'index.html'); info = await infoOf(file); }
                if (!info || !info.isFile()) { reply(404, 'not found'); return; }
                file = await realpath(file);
                if (!contained(file)) { reply(403, 'forbidden'); return; }
                const body = await readFile(file);
                res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
                res.end(body);
            } catch (e) {
                reply(e.code === 'ENOENT' || e.code === 'ENOTDIR' ? 404 : 500, e.code === 'ENOENT' || e.code === 'ENOTDIR' ? 'not found' : 'server error');
            }
        });
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
}
