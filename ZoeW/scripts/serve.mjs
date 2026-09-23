import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.map': 'application/json'
};

export function serveDir(root) {
    return new Promise((resolve) => {
        const server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url, 'http://localhost');
                let file = path.join(root, decodeURIComponent(url.pathname));
                let info = await stat(file).catch(() => null);
                if (info && info.isDirectory()) { file = path.join(file, 'index.html'); info = await stat(file).catch(() => null); }
                if (!info) { file = path.join(root, 'index.html'); info = await stat(file).catch(() => null); }
                if (!info) { res.writeHead(404); res.end('not found'); return; }
                const body = await readFile(file);
                res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
                res.end(body);
            } catch (e) {
                res.writeHead(500); res.end(String(e));
            }
        });
        server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
}
