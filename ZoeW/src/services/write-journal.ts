export const WRITE_JOURNAL_PREFIX = 'zoew_connection_writes_v1:';
export const WRITE_JOURNAL_MAX_BYTES = 4 * 1024 * 1024;

export function createLocalWriteJournal(storage?) {
    const store = () => { try { return storage === undefined ? window.localStorage : storage; } catch (e) { return null; } };
    const key = (scope, topic, id) => WRITE_JOURNAL_PREFIX + encodeURIComponent(scope) + ':' + encodeURIComponent(topic) + ':' + id;
    return {
        list(scope, topic) {
            const target = store();
            if (!target) throw new Error('Write journal unavailable');
            const prefix = key(scope, topic, '');
            const rows = [];
            for (let i = 0; i < target.length; i++) {
                const name = target.key(i);
                if (!name || !name.startsWith(prefix)) continue;
                const row = JSON.parse(target.getItem(name) || 'null');
                if (!row || row.v !== 1 || row.scope !== scope || row.topic !== topic || !/^[A-Za-z0-9_-]{16,64}$/.test(row.opId)
                    || !Array.isArray(row.ops) || !row.ops.length || !Number.isFinite(row.sentAfter) || row.sentAfter < 0) throw new Error('Write journal invalid');
                rows.push(row);
            }
            return rows.sort((a, b) => (a.queuedAt || a.createdAt || 0) - (b.queuedAt || b.createdAt || 0) || a.opId.localeCompare(b.opId));
        },
        put(row) {
            try {
                const target = store(); const text = JSON.stringify(row);
                if (!target || text.length > WRITE_JOURNAL_MAX_BYTES) return false;
                target.setItem(key(row.scope, row.topic, row.opId), text);
                return true;
            } catch (e) { return false; }
        },
        remove(scope, topic, id) {
            try { const target = store(); if (!target) return false; target.removeItem(key(scope, topic, id)); return true; } catch (e) { return false; }
        }
    };
}
