import { existsSync, lstatSync, realpathSync, symlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(root, '../../ZoeW/node_modules');
const target = path.join(root, 'node_modules');
if (!existsSync(source)) throw new Error('Run npm ci --prefix ZoeW before using audit tools.');
let stat;
try { stat = lstatSync(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (stat) {
    if (!stat.isSymbolicLink() || realpathSync(target) !== realpathSync(source)) {
        throw new Error('audit-tools/zoew/node_modules must link to ZoeW/node_modules; existing content was not changed.');
    }
} else {
    try {
        symlinkSync(process.platform === 'win32' ? source : path.relative(root, source), target, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
        if (error.code !== 'EEXIST' || realpathSync(target) !== realpathSync(source)) throw error;
    }
}
