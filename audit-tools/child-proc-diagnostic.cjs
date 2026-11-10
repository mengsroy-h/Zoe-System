'use strict';
const fs = require('node:fs');

// អានតែ metadata មានព្រំដែន; identity មិនអាចផ្ទៀង ➜ មិនបញ្ចេញ snapshot របស់ PID ផ្សេង។
function observeChildProc(pid, live, platform = process.platform, io = fs) {
    let anchor = null;
    const read = (file, size) => {
        if (!live()) throw new Error('unavailable');
        const handle = io.openSync(file, 'r');
        try {
            const buffer = Buffer.alloc(size);
            const bytes = io.readSync(handle, buffer, 0, size, 0);
            if (bytes >= size) throw new Error('bounded');
            return buffer.toString('utf8', 0, bytes);
        } finally { io.closeSync(handle); }
    };
    const identity = () => {
        const value = read('/proc/' + pid + '/stat', 1024);
        if (!value.startsWith(pid + ' (')) throw new Error('unavailable');
        const fields = value.slice(value.lastIndexOf(')') + 2).trim().split(/ +/);
        if (!/^[RSDZTWtXxKPI]$/.test(fields[0]) || !/^[1-9][0-9]{0,19}$/.test(fields[19])) throw new Error('unavailable');
        return { state: fields[0], start: fields[19] };
    };
    if (platform === 'linux' && Number.isSafeInteger(pid) && pid > 0) {
        try { anchor = identity(); } catch (_) {}
    }
    return () => {
        if (platform !== 'linux') return { status: 'non-linux' };
        if (!anchor) return { status: 'unavailable' };
        try {
            const before = identity();
            if (before.start !== anchor.start) return { status: 'identity-changed' };
            const result = { status: 'available', state: before.state, threads: [], threadsStatus: 'unavailable' };
            try {
                const dir = io.opendirSync('/proc/' + pid + '/task', { bufferSize: 16 });
                try {
                    for (let i = 0; i < 16; i++) {
                        const entry = dir.readSync();
                        if (!entry) { result.threadsStatus = 'complete'; break; }
                        result.threadsStatus = 'bounded';
                        if (!/^[1-9][0-9]{0,9}$/.test(entry.name)) continue;
                        const tid = Number(entry.name), base = '/proc/' + pid + '/task/' + entry.name;
                        let name = null, wchan = null;
                        try {
                            const value = read(base + '/comm', 64).replace(/\n$/, '');
                            if (['node', 'nodejs', 'MainThread', 'V8Worker', 'SignalInspector', 'libuv-worker'].includes(value)) name = value;
                        } catch (_) {}
                        try {
                            const value = read(base + '/wchan', 64).trim();
                            if (/^[A-Za-z0-9_]{1,63}$/.test(value)) wchan = value;
                        } catch (_) {}
                        const kind = tid === pid ? 'main' : name === 'V8Worker' ? 'v8-worker'
                            : name === 'SignalInspector' ? 'signal-inspector' : name === 'libuv-worker' ? 'libuv-worker' : 'other';
                        result.threads.push({ tid, name, kind, wchan });
                    }
                } finally { dir.closeSync(); }
            } catch (_) {}
            if (identity().start !== anchor.start) return { status: 'identity-changed' };
            return result;
        } catch (_) { return { status: 'unavailable' }; }
    };
}
module.exports = { observeChildProc };
