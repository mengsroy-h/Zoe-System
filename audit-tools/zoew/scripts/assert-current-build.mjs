import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';

export function assertCurrentBuild(root, dist) {
    try {
        const sourceVersion = (file, name) => {
            const text = fs.readFileSync(path.join(root, file), 'utf8');
            const match = text.match(new RegExp('\\bexport\\s+const\\s+' + name + '\\s*=\\s*([\'"`])([^\'"`]+)\\1'));
            if (!match) throw new Error('missing source ' + name);
            return match[2];
        };
        const appVersion = sourceVersion('src/core/version.ts', 'APP_VERSION');
        const cacheVersion = sourceVersion('src/sw/cache-version.ts', 'CACHE_VERSION');
        const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
        if (manifest.version !== appVersion) throw new Error('manifest version ' + String(manifest.version) + ' does not match source ' + appVersion);
        const worker = parse(fs.readFileSync(path.join(dist, 'sw.js'), 'utf8'), { ecmaVersion: 'latest' });
        const versions = new Set();
        const remember = (value) => { if (typeof value === 'string' && /^zoew-v\d+$/.test(value)) versions.add(value); };
        simple(worker, {
            Literal: (node) => remember(node.value),
            TemplateLiteral: (node) => { if (!node.expressions.length) remember(node.quasis[0].value.cooked); }
        });
        if (versions.size !== 1 || !versions.has(cacheVersion)) throw new Error('worker cache versions ' + JSON.stringify([...versions]) + ' do not match source ' + cacheVersion);
        return { appVersion, cacheVersion };
    } catch (error) {
        throw new Error('Stale build at ' + dist + ': ' + error.message + '. Run npm run build in ZoeW; for DIST_DIR, rebuild that directory before checking it.', { cause: error });
    }
}
