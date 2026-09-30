import { SbIncrement, SbNetworkError, SbRpcError, createSupabaseDatabase } from './supabase-rtdb';
import { SB_LOGIN_DOMAIN_DEFAULT, isSupabaseConfig } from './supabase-config';

export { SB_LOGIN_DOMAIN_DEFAULT, isSupabaseConfig };

export const SB_ACCOUNT_BLOCKED_TEXT = {
    none: 'គណនីនេះមិនទាន់ចងនឹងហាងណាមួយទេ — សូមចុះឈ្មោះដោយកូដអញ្ជើញពីអ្នកលក់',
    expired: 'ហាងនេះផុតកំណត់ហើយ — សូមទាក់ទងអ្នកលក់ដើម្បីពន្យារ',
    revoked: 'ហាងនេះត្រូវបានបិទ — សូមទាក់ទងអ្នកលក់'
};

export function loginEmailFor(input, domain) {
    const text = String(input === null || input === undefined ? '' : input).trim().toLowerCase();
    if (!text) return '';
    return text.indexOf('@') !== -1 ? text : text + '@' + (domain || SB_LOGIN_DOMAIN_DEFAULT);
}

export function decodeJwtPayload(token) {
    try {
        const part = String(token || '').split('.')[1] || '';
        const b64 = part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4);
        const json = decodeURIComponent(Array.prototype.map.call(atob(b64), (c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        const out = JSON.parse(json);
        return out && typeof out === 'object' ? out : {};
    } catch (e) {
        return {};
    }
}

export function authTimeMsOf(claims) {
    const amr = Array.isArray(claims && claims.amr) ? claims.amr : [];
    const stamps = amr.map((x) => Number(x && x.timestamp)).filter((n) => Number.isFinite(n) && n > 0);
    if (stamps.length) return Math.max.apply(null, stamps) * 1000;
    const iat = Number(claims && claims.iat);
    return Number.isFinite(iat) && iat > 0 ? iat * 1000 : NaN;
}

export function authErrorMessage(error) {
    const code = String((error && (error.code || error.error_code)) || '');
    const status = Number(error && error.status) || 0;
    if (error instanceof SbNetworkError || /fetch|network|timeout/i.test(String(error && error.message))) {
        return 'ភ្ជាប់ Server មិនបានទេ — សូមពិនិត្យអ៊ីនធឺណិត ហើយសាកម្តងទៀត';
    }
    if (code === 'invalid_credentials' || status === 400) return 'ឈ្មោះគណនី ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ';
    if (code === 'email_not_confirmed') return 'គណនីនេះមិនទាន់បានបញ្ជាក់ — សូមទាក់ទងអ្នកលក់';
    if (code === 'over_request_rate_limit' || status === 429) return 'ព្យាយាមញឹកពេក — សូមរង់ចាំបន្តិច ហើយសាកម្តងទៀត';
    return 'ចូលប្រព័ន្ធមិនបានទេ (' + (code || status || 'unknown') + ')';
}

function makeUser(auth, session) {
    const user: any = {
        uid: session.user.id,
        email: session.user.email || '',
        emailVerified: true,
        isAnonymous: false,
        providerData: [],
        providerId: 'supabase',
        _session: session,
        getIdToken: async () => {
            const token = await auth._transport.accessToken();
            return token || user._session.accessToken;
        }
    };
    return user;
}

function createAuth(app, env) {
    const transport = app._transport;
    const auth: any = { app, currentUser: null, _transport: transport, _listeners: new Set(), _ready: false, _account: null };
    const fire = () => {
        const current = auth.currentUser;
        auth._listeners.forEach((cb) => { try { cb(current); } catch (e) { env.onListenerError(e); } });
    };
    const setUser = (session) => {
        if (!session) {
            auth.currentUser = null;
            auth._account = null;
            try { transport.writeAccount(null); } catch (e) {}
            if (app._db) app._db.setAuthed(false);
            return;
        }
        if (auth.currentUser && auth.currentUser.uid === session.user.id) {
            auth.currentUser._session = session;
        } else {
            auth.currentUser = makeUser(auth, session);
        }
        if (app._db) app._db.setAuthed(true);
    };
    const accountOf = async () => {
        const rows = await transport.rpc('my_account', {}, 20000);
        const row = Array.isArray(rows) ? rows[0] : null;
        return row || null;
    };
    const blockedReason = (row) => (!row ? 'none' : row.status === 'active' ? null : (row.status === 'expired' ? 'expired' : 'revoked'));
    const applyAccount = (row, persist = true) => {
        auth._account = row;
        app._tenantTopic = row && row.tenant_id ? 'zoe:' + row.tenant_id : null;
        if (persist && auth.currentUser) {
            try { transport.writeAccount({ uid: auth.currentUser.uid, row }); } catch (e) {}
        }
        if (app._db) app._db.setTenantTopic(app._tenantTopic);
    };
    auth._verifyAccount = async () => {
        if (!auth.currentUser) return null;
        const uid = auth.currentUser.uid;
        let row;
        try {
            row = await accountOf();
        } catch (e) {
            return null;
        }
        if (!auth.currentUser || auth.currentUser.uid !== uid) return null;
        const reason = blockedReason(row);
        if (reason) {
            env.onAccountBlocked(SB_ACCOUNT_BLOCKED_TEXT[reason]);
            await auth._signOut();
            return reason;
        }
        applyAccount(row);
        return null;
    };
    auth._onChange = (cb) => {
        auth._listeners.add(cb);
        if (auth._ready) Promise.resolve().then(() => { if (auth._listeners.has(cb)) cb(auth.currentUser); });
        return () => auth._listeners.delete(cb);
    };
    auth._signIn = async (email, password) => {
        let session;
        try {
            session = await transport.signIn(loginEmailFor(email, app.options.loginDomain), password);
        } catch (e) {
            throw new Error(authErrorMessage(e));
        }
        let row;
        try {
            row = await accountOf();
        } catch (e) {
            await transport.signOut().catch(() => {});
            throw new Error(authErrorMessage(e));
        }
        const reason = blockedReason(row);
        if (reason) {
            await transport.signOut().catch(() => {});
            throw new Error(SB_ACCOUNT_BLOCKED_TEXT[reason]);
        }
        setUser(session);
        applyAccount(row);
        auth._ready = true;
        fire();
        return { user: auth.currentUser, providerId: 'supabase', operationType: 'signIn' };
    };
    auth._signOut = async () => {
        const had = !!auth.currentUser;
        let failed = null;
        try {
            await transport.signOut();
        } catch (e) {
            failed = e;
        }
        if (app._db) app._db.resetForSignOut();
        setUser(null);
        if (had) fire();
        if (failed) throw failed;
    };
    auth._setPersistence = async (persistence) => {
        transport.setPersistence(persistence && persistence.type === 'SESSION' ? 'session' : 'local');
    };
    transport.onSession((event, session) => {
        if (event === 'SIGNED_OUT' && auth.currentUser) {
            if (app._db) app._db.resetForSignOut();
            setUser(null);
            fire();
            return;
        }
        if ((event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session && auth.currentUser && auth.currentUser.uid === session.user.id) {
            auth.currentUser._session = session;
        }
    });
    transport.restoreSession().then((session) => {
        setUser(session);
        if (session) {
            let cached = null;
            try { cached = transport.readAccount(); } catch (e) { cached = null; }
            if (cached && cached.uid === session.user.id && cached.row && cached.row.tenant_id) applyAccount(cached.row, false);
        }
    }, () => {
        setUser(null);
    }).then(() => {
        auth._ready = true;
        fire();
        if (auth.currentUser) auth._verifyAccount();
    });
    auth._close = () => { auth._listeners.clear(); };
    return auth;
}

export function createSupabaseSdk(makeTransport, env) {
    const apps = [];
    const sdk: any = {
        __supabase: true,
        browserLocalPersistence: { type: 'LOCAL' },
        browserSessionPersistence: { type: 'SESSION' },
        initializeApp(config) {
            const app: any = { name: '[DEFAULT]', options: Object.assign({}, config), _transport: makeTransport(config), _db: null, _auth: null, _tenantTopic: null };
            apps.push(app);
            return app;
        },
        getApps() {
            return apps.slice();
        },
        async deleteApp(app) {
            const i = apps.indexOf(app);
            if (i !== -1) apps.splice(i, 1);
            if (app._auth) app._auth._close();
            if (app._unlisten) { try { app._unlisten(); } catch (e) {} app._unlisten = null; }
            if (app._db) app._db.close('deleted');
            try { app._transport.close(); } catch (e) {}
        },
        getAuth(app) {
            if (!app._auth) app._auth = createAuth(app, env);
            return app._auth;
        },
        onAuthStateChanged(auth, cb) {
            return auth._onChange(cb);
        },
        signInWithEmailAndPassword(auth, email, password) {
            return auth._signIn(email, password);
        },
        signOut(auth) {
            return auth._signOut();
        },
        setPersistence(auth, persistence) {
            return auth._setPersistence(persistence);
        },
        tenantScope(auth) {
            return auth && auth._account && auth._account.tenant_id ? String(auth._account.tenant_id) : '';
        },
        accountOf(auth) {
            return auth && auth._account ? Object.assign({}, auth._account) : null;
        },
        async getIdTokenResult(user) {
            const token = await user.getIdToken();
            const claims = decodeJwtPayload(token);
            const authMs = authTimeMsOf(claims);
            const iso = (sec) => (Number.isFinite(Number(sec)) ? new Date(Number(sec) * 1000).toISOString() : '');
            return {
                token,
                claims,
                authTime: Number.isFinite(authMs) ? new Date(authMs).toISOString() : '',
                issuedAtTime: iso(claims.iat),
                expirationTime: iso(claims.exp),
                signInProvider: 'password',
                signInSecondFactor: null
            };
        },
        getDatabase(app) {
            if (!app._db) {
                app._db = createSupabaseDatabase(app._transport, {
                    onListenerError: env.onListenerError,
                    onSynced: () => { if (app._auth && app._auth.currentUser && !app._tenantTopic) app._auth._verifyAccount(); },
                    onForbidden: () => { if (app._auth && app._auth.currentUser) app._auth._verifyAccount(); },
                    onTxOutcomeUnknown: env.onTxOutcomeUnknown
                }, env.dbOptions);
                app._db.setAuthed(!!(app._auth && app._auth.currentUser));
                if (app._tenantTopic) app._db.setTenantTopic(app._tenantTopic);
                if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
                    const onOnline = () => { if (app._db) app._db.onBrowserOnline(); };
                    const onOffline = () => { if (app._db) app._db.onBrowserOffline(); };
                    const onVisible = () => { if (app._db && typeof document !== 'undefined' && document.visibilityState === 'visible') app._db.onBrowserOnline(); };
                    window.addEventListener('online', onOnline);
                    window.addEventListener('offline', onOffline);
                    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
                    app._unlisten = () => {
                        window.removeEventListener('online', onOnline);
                        window.removeEventListener('offline', onOffline);
                        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
                    };
                }
            }
            return app._db;
        },
        ref(db, path) {
            return db.ref(path);
        },
        onValue(ref, cb, errCb) {
            return ref._db.onValue(ref, cb, errCb);
        },
        off(ref) {
            return ref._db.off(ref);
        },
        get(ref) {
            return ref._db.get(ref);
        },
        set(ref, value) {
            return ref._db.set(ref, value);
        },
        update(ref, values) {
            return ref._db.update(ref, values);
        },
        runTransaction(ref, updateFn) {
            return ref._db.runTransaction(ref, updateFn);
        },
        increment(delta) {
            return new SbIncrement(delta);
        },
        goOnline(db) {
            db.goOnline();
        },
        goOffline(db) {
            db.goOffline();
        },
        async registerAccount(app, body) {
            return app._transport.callFunction('register', body);
        },
        async resetPassword(app, body) {
            return app._transport.callFunction('reset-password', body);
        }
    };
    return sdk;
}

export { SbNetworkError, SbRpcError };
