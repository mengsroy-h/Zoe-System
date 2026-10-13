export function withFirebaseAuthOwnership(sdk) {
    if (!sdk || typeof sdk.beforeAuthStateChanged !== 'function' || sdk.__authOwnershipResolved) return sdk;
    const owners = new WeakMap();
    const ownerFor = (auth) => {
        let owner = owners.get(auth);
        if (!owner) { owner = { generation: 0, tail: Promise.resolve() }; owners.set(auth, owner); }
        return owner as { generation: number; tail: Promise<void> };
    };
    const ended = () => Object.assign(new Error('Authentication operation ended'), { code: 'auth/session-ended' });
    return Object.assign({}, sdk, {
        __authOwnershipResolved: true,
        signInWithEmailAndPassword(auth, email, password) {
            const owner = ownerFor(auth);
            const epoch = ++owner.generation;
            const task = owner.tail.then(async () => {
                if (epoch !== owner.generation) throw ended();
                const off = sdk.beforeAuthStateChanged(auth, (user) => {
                    if (user && epoch !== owner.generation) throw ended();
                });
                try {
                    return await sdk.signInWithEmailAndPassword(auth, email, password);
                } finally {
                    off();
                }
            });
            owner.tail = task.then(() => {}, () => {});
            return task;
        },
        signOut(auth) {
            ownerFor(auth).generation++;
            return sdk.signOut(auth);
        }
    });
}
