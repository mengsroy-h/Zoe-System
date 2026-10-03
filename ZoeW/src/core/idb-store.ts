export function openIdbStore(name, storeName, getFactory, armDeadline) {
    return new Promise((resolve) => {
        let settled = false;
        const done = (value) => { if (!settled) { settled = true; resolve(value); } };
        if (!armDeadline(done)) { done(null); return; }
        try {
            const factory = getFactory();
            if (!factory) { done(null); return; }
            const req = factory.open(name, 1);
            req.onupgradeneeded = () => {
                try {
                    const db = req.result;
                    if (db && !db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
                } catch (e) { done(null); }
            };
            req.onsuccess = () => {
                if (settled) {
                    try { req.result.close(); } catch (e) { }
                    return;
                }
                done(req.result || null);
            };
            req.onerror = () => done(null);
            req.onblocked = () => done(null);
        } catch (e) {
            done(null);
        }
    });
}
