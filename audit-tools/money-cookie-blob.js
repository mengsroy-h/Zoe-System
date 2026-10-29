'use strict';

// App/Function/adapter/rules/ledger ពិត; ជំនួសតែ Netlify Blob SDK និង upstream ZTO/Sheet ខាងក្រៅ។
// ការផ្ទៀងប្រាក់ដែលរំពឹងទុកឯករាជ្យពី isDeducted: បើ flag និង ledger ខុសជាមួយគ្នា ក៏ត្រូវធ្លាក់។
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { invariant, invariantBroken, r2 } = require('./money-multidevice-core.js');
const fx = require('./idtoken-fixture.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cookieFixture(root, { project, supabaseUrl, supabaseKey } = {}) {
    const fn = require(path.join(root, 'ZoeW/netlify/functions/_shared/zto-order-detail-core.cjs'));
    const key = 'synthetic-cookie-money-proxy-key';
    const cookie = 'BOS-MAN-SESSION=synthetic-cookie-money-session; sidebarStatus=1';
    const saved = {};
    const env = { ZTO_PROXY_KEY: key, ZTO_COOKIE: '', ZTO_TOKEN: '', ZTO_AUTHORIZATION: '', ZTO_CACHE_TTL_MS: '0',
        ZTO_PALM_SESSION_SECRET: 'synthetic-money-session-secret-at-least-32-characters',
        ZTO_PALM_SIGN_KEY: 'synthetic-palm-sign-key', ZTO_PALM_PASSWORD_KEY: 'zoew-test-aes-16',
        ZTO_UPSTREAM_RETRIES: '0', ZTO_DETAIL_IDENTITY: 'require', ZTO_DETAIL_BRANCH_PATHS: 'siteCode',
        ZTO_FIELD_SIGNED: 'billStatus', ZTO_SIGNED_VALUES: '5', FIREBASE_PROJECT_IDS: project ? project + ':1' : '',
        SUPABASE_URL: supabaseUrl || '', SUPABASE_PUBLISHABLE_KEY: supabaseKey || '' };
    for (const [k, v] of Object.entries(env)) { saved[k] = process.env[k]; process.env[k] = v; }
    const values = new Map([['cookie', cookie]]);
    const etag = (v) => '"' + crypto.createHash('sha256').update(String(v)).digest('hex') + '"';
    const world = { blobReads: 0, lists: 0, details: 0, palmLists: 0, palmDetails: 0, palmTracks: 0, sheetReads: 0, logins: 0, loginSites: new Map(), palmBlobReads: 0, tokenSites: new Map(), calls: [], parcels: new Map() };
    const store = {
        async get(k) { if (k === 'cookie') world.blobReads++; else if (k.startsWith('palm-session/')) world.palmBlobReads++; return values.get(k) ?? null; },
        async getWithMetadata(k) { const data = await store.get(k); return data === null ? null : { data, etag: etag(data), metadata: { syncedAt: Date.now() } }; },
        async delete(k) { values.delete(k); },
        async set(k, v, opts = {}) {
            if ((opts.onlyIfNew && values.has(k)) || (opts.onlyIfMatch && opts.onlyIfMatch !== etag(values.get(k)))) return { modified: false };
            values.set(k, v); return { modified: true, etag: etag(v) };
        }
    };
    fn.setBlobsModuleForTests({ connectLambda(event) { assert.ok(event.blobs); }, getStore(name) { assert.equal(name, 'zto-auth'); return store; } });
    fn.resetCachesForTests();
    const originalFetch = global.fetch;
    global.fetch = async (url, init) => {
        const href = String(url);
        if (href.includes('www.googleapis.com/robot/v1/metadata/x509/')) return new Response(JSON.stringify({ [fx.TEST_KID]: fx.TEST_CERT_PEM }));
        if (new URL(href).hostname === 'aargus-api.ztoglobal.net') {
            assert.equal(new Headers(init.headers).get('cookie'), null, 'Palm មិនត្រូវប្រើ Cookie');
            const body = JSON.parse(init.body);
            const pathname = new URL(href).pathname;
            if (pathname === '/zto/system/v1/doLogin') {
                const site = String(body.userName).replace(/^palm-/, '');
                assert.match(site, /^\d+$/);
                const token = ['eyJhbGciOiJSUzI1NiJ9', Buffer.from(JSON.stringify({ sub: JSON.stringify({ accessToken: 'synthetic-palm-money-sso-' + site }) })).toString('base64url'), 'signature'].join('.');
                world.logins++; world.loginSites.set(site, (world.loginSites.get(site) || 0) + 1); world.tokenSites.set(token, site);
                return Response.json({ status: true, result: { token, countryCode: 'KH', siteCode: site, siteName: 'សាខាតេស្ត ' + site } });
            }
            const site = world.tokenSites.get(new Headers(init.headers).get('x-token'));
            assert.ok(site, 'Palm ត្រូវប្រើ token ពី Login ពិត');
            if (pathname === '/zto/basic/v1/billInfoQuery') {
                world.palmDetails++;
                const code = String(body.billCode);
                const p = world.parcels.get(code);
                assert.ok(!p || p.site === site, 'Palm lookup មិនត្រូវឃើញ barcode សាខាផ្សេង');
                return Response.json({ status: true, statusCode: 'SYS000', result: p ? {
                    billCode: code, consigneeMobile: p.phone || '0960007345', cod: '10', dod: '2', siteCode: p.site
                } : null });
            }
            if (pathname === '/zto/dispatch/v1/queryDispatchList') {
                world.palmLists++;
                const codes = [...world.parcels].filter(([, p]) => p.site === site && (p.signedAt ? String(body.billStatus) === '5'
                    && p.signedAt >= body.signSiteDateFrom && p.signedAt <= body.signSiteDateTo : String(body.billStatus) === '4')).map(([code]) => code);
                const pageSize = Number(body.pageSize) || 20;
                return Response.json({ status: true, statusCode: 'SYS000', result: { list: codes.slice((body.pageNum - 1) * pageSize, body.pageNum * pageSize)
                    .map((billCode) => ({ billCode, billStatus: world.parcels.get(billCode).signedAt ? '5' : '4', consigneeMobile: world.parcels.get(billCode).phone || '0960007345', cod: '10', dod: '2', dispEmpDate: '2026-10-19 09:00:00' })),
                    pageNum: body.pageNum, pageSize, pages: Math.ceil(codes.length / pageSize), total: codes.length } });
            }
            assert.equal(pathname, '/zto/locus/v1/queryTrackInfo');
            world.palmTracks++;
            const code = String(body.mailNos);
            const p = world.parcels.get(code);
            assert.ok(!p || p.site === site, 'Palm មិនត្រូវឃើញ barcode សាខាផ្សេង');
            return Response.json({ status: true, statusCode: 'SYS000', result: p ? [{ mail: { mailNo: code, isSign: p.signedAt ? 1 : 0 },
                tracks: [...(p.signedAt ? [{ mailNo: code, actionName: 'scan', action: '5', siteCode: site, time: p.signedAt }] : []),
                    { mailNo: code, actionName: 'scan', action: '3', siteCode: site, time: p.arrivedAt || '2026-10-19 09:00:00' }] }] : [] });
        }
        if (new URL(href).hostname !== 'aargus-api.ztoglobal.com') {
            assert.equal(new URL(href).hostname, '127.0.0.1', 'មិនអនុញ្ញាតបណ្តាញក្រៅ lab');
            return originalFetch(url, init);
        }
        const suppliedCookie = new Headers(init.headers).get('cookie');
        const nativeToken = /(?:^|;\s*)PDA_USER_COOKIE_01=([^;]+)/.exec(suppliedCookie || '')?.[1];
        if (nativeToken) {
            const site = world.tokenSites.get(nativeToken);
            assert.ok(site, 'SSO ត្រូវមកពី Login Palm របស់ហាង');
            assert.equal(suppliedCookie, 'PDA_USER_COOKIE_01=' + nativeToken + '; PDA_SSO_COOKIE_01=synthetic-palm-money-sso-' + site);
            if (new URL(href).pathname === '/getUserInfo') {
                assert.equal(init.method, 'GET');
                return Response.json({ success: true, data: { siteCode: site } });
            }
            assert.equal(new URL(href).pathname, '/scan/page/scan');
            const body = JSON.parse(init.body);
            assert.equal(body.condition.scanSiteCode, site);
            assert.equal(body.condition.scanTypeCode, '03');
            const arrival = (p) => p.arrivedAt || '2026-10-19 09:00:00';
            const codes = [...world.parcels].filter(([, p]) => p.site === site && arrival(p) >= body.condition.scanStartTime && arrival(p) <= body.condition.scanEndTime).map(([code]) => code);
            world.palmLists++;
            return Response.json({ success: true, data: { pageNum: body.pageNum, pageSize: body.pageSize, pages: Math.ceil(codes.length / body.pageSize), total: codes.length,
                result: codes.slice((body.pageNum - 1) * body.pageSize, body.pageNum * body.pageSize).map((code) => ({ scanBillCode: code, scanTypeCode: '03', scanSiteCode: site,
                    consigneeMobile: world.parcels.get(code).phone || '0960007345', agentAmount: 10, fcAmount: 2, scanTime: arrival(world.parcels.get(code)) })) } });
        }
        assert.equal(suppliedCookie, cookie, 'Argus ត្រូវទទួល Cookie ពី Blob');
        const body = JSON.parse(init.body);
        if (href.includes('/scan/get/order/detail')) {
            world.details++;
            const p = world.parcels.get(String(body.billCode));
            return Response.json({ success: true, data: p ? { billCode: String(body.billCode), consigneeMobile: p.phone || '855977000111',
                agentAmount: 10, fcAmount: 2, siteCode: p.site, billStatus: p.signedAt ? 5 : 1, signTime: p.signedAt || null } : null });
        }
        assert.ok(body.condition, 'ការហៅ Cookie list ត្រូវប្រើ condition');
        world.lists++;
        const signed = body.condition.scanTypeCode === '05' ? [...world.parcels].filter(([, p]) => p.signedAt
            && p.signedAt >= body.condition.scanStartTime && p.signedAt <= body.condition.scanEndTime
            && p.site === String(body.condition.scanSiteCode)).map(([code, p]) => ({ scanBillCode: code, scanTypeCode: '05',
            scanSiteCode: p.site, scanSite: p.site, scanTime: p.signedAt, consigneeMobile: '855977000111', agentAmount: 10, fcAmount: 2 })) : [];
        const pageSize = Number(body.pageSize) || 100;
        return Response.json({ success: true, data: { pageNum: body.pageNum, pages: Math.ceil(signed.length / pageSize), total: signed.length,
            result: signed.slice((body.pageNum - 1) * pageSize, body.pageNum * pageSize) } });
    };
    return {
        world,
        proxyKey: key,
        config(origin) { return { enabled: true, fastMode: true, headerName: 'X-Zoe-Proxy-Key',
            phoneField: 'phone', codField: 'cod', dodField: 'dod',
            url: origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }; },
        async serve(req, rsp) {
            try {
                const url = new URL(req.url, 'http://127.0.0.1');
                world.calls.push(Object.fromEntries(url.searchParams));
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const out = await fn.handler({ body: Buffer.concat(chunks).toString('utf8'), httpMethod: req.method, headers: req.headers, queryStringParameters: Object.fromEntries(url.searchParams),
                    blobs: Buffer.from(JSON.stringify({ url: 'https://blobs.netlify.test', token: 'synthetic-blob-token' })).toString('base64') });
                rsp.writeHead(out.statusCode, { ...out.headers, 'Content-Type': 'application/json' }); rsp.end(out.body);
            } catch (e) { rsp.writeHead(500); rsp.end(JSON.stringify({ error: String(e.message) })); }
        },
        close() {
            global.fetch = originalFetch;
            fn.setBlobsModuleForTests(null); fn.resetCachesForTests();
            for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
        }
    };
}

// បង្អាក់ write មុនទៅដល់ server ឬបង្អាក់ ACK ក្រោយ server commit។ មិនជំនួស DB/transaction/លុយឡើយ។
async function networkGate(ctx, backend) {
    const state = { mode: '', hits: 0, releases: [], responseIds: new Set(), closed: false, match: null };
    const hold = () => new Promise((resolve) => state.releases.push(resolve));
    const moving = (p) => /^zoew_(?:scan_history|recently_deleted)_cod_dod(?:\/|$)/.test(p);
    const matches = (ops) => ops.some((op) => moving(op.path) && (!state.match || state.match(op)));
    const before = async () => {
        if (!state.mode) return;
        if (state.mode === 'before') { state.hits++; await hold(); }
        if (state.mode === 'slow') { state.hits++; await sleep(500); }
    };
    if (backend === 'supabase') {
        await ctx.route(/\/rest\/v1\/rpc\/zoe_write$/, async (route) => {
            const body = route.request().postDataJSON();
            if (!matches((body.p_ops || []).map((op) => ({ path: op.p.join('/'), value: op.v })))) return route.continue();
            await before();
            if (state.closed) return route.abort().catch(() => {});
            if (state.mode === 'after') {
                const out = await route.fetch();
                if ((await out.json()).ok === true) { state.hits++; await hold(); }
                return route.fulfill({ response: out }).catch(() => {});
            }
            return route.continue().catch(() => {});
        });
    } else {
        await ctx.routeWebSocket(/127\.0\.0\.1:9000\/\.ws/, (socket) => {
            const server = socket.connectToServer();
            socket.onMessage(async (message) => {
                let data; try { data = JSON.parse(String(message)); } catch (_) {}
                const d = data && data.d;
                const base = d && String(d.b && d.b.p || '').replace(/^\//, '');
                const ops = d && (d.a === 'm' || !base) ? Object.entries(d.b.d || {}).map(([key, value]) => ({ path: [base, key].filter(Boolean).join('/'), value }))
                    : [{ path: base || '', value: d && d.b && d.b.d }];
                if (d && ['p', 'm'].includes(d.a) && matches(ops)) {
                    await before();
                    if (state.mode === 'after') state.responseIds.add(d.r);
                }
                try { server.send(message); } catch (_) {}
            });
            server.onMessage(async (message) => {
                let data; try { data = JSON.parse(String(message)); } catch (_) {}
                if (data && data.d && state.responseIds.delete(data.d.r) && data.d.b && data.d.b.s === 'ok') { state.hits++; await hold(); }
                try { socket.send(message); } catch (_) {}
            });
        });
    }
    return {
        arm(mode, match = null) { assert.equal(state.releases.length, 0); state.mode = mode; state.hits = 0; state.closed = false; state.match = match; },
        async hit() { const until = Date.now() + 8000; while (!state.hits && Date.now() < until) await sleep(30); assert.ok(state.hits, 'ការចាក់បណ្តាញត្រូវបាញ់ write ពិត (' + state.mode + ')'); },
        release(closed = false) { state.closed = closed; state.mode = ''; state.match = null; state.responseIds.clear(); state.releases.splice(0).forEach((r) => r()); },
        get hits() { return state.hits; }
    };
}

async function confirmWithClockWindow() {
    const wallNow = Date.now;
    let before = Infinity, after = -Infinity;
    // RPC អាចកែ offset កណ្ដាល confirm; កត់ពេលដែល App អាចអាន ដោយមិនប្ដូរតម្លៃនាឡិកា។
    Date.now = () => {
        const now = wallNow();
        const serverNow = now + window.serverTimeOffsetMs;
        before = Math.min(before, serverNow); after = Math.max(after, serverNow);
        return now;
    };
    try {
        Date.now(); await window.confirmPhone(); Date.now();
        return { before, after };
    } finally { Date.now = wallNow; }
}

function scanDayForCheckpoint(item, bounds) {
    assert.ok(item && Number.isFinite(item.createdAt), 'scan ត្រូវមាន server timestamp');
    assert.ok(Number.isFinite(bounds.before) && Number.isFinite(bounds.after), 'ព្រំដែនពេល confirm ត្រូវមាន');
    assert.ok(item.createdAt >= Math.min(bounds.before, bounds.after) && item.createdAt <= Math.max(bounds.before, bounds.after), 'timestamp ត្រូវនៅក្នុងបង្អួច confirm: ' + JSON.stringify({ createdAt: item.createdAt, before: bounds.before, after: bounds.after }));
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(item.createdAt);
    assert.equal(item.scanDate, day, 'scanDate ត្រូវតាម Cambodia និង server timestamp');
    return day;
}

// Baseline អានម្តង; delta ទាំងអស់មកពីសកម្មភាពដែលសាក មិនយកលុយ actual មកធ្វើ expected។
function createRevenueExpectation(initial) {
    const amounts = row => ({ codDollar: r2(Number(row?.codDollar) || 0), dodDollar: r2(Number(row?.dodDollar) || 0), totalCount: Number(row?.totalCount) || 0 });
    const daily = new Map(Object.entries(initial.zoew_daily_revenue_cod_dod || {}).map(([day, row]) => [day, amounts(row)]));
    const monthly = new Map(Object.entries(initial.zoew_monthly_revenue_cod_dod || {}).map(([month, row]) => [month, amounts(row)]));
    const get = (map, key) => ({ ...(map.get(key) || { codDollar: 0, dodDollar: 0, totalCount: 0 }) });
    const change = (map, key, cod, dod, count) => {
        const old = get(map, key);
        map.set(key, { codDollar: r2(old.codDollar + cod), dodDollar: r2(old.dodDollar + dod), totalCount: old.totalCount + count });
    };
    return {
        day: key => get(daily, key),
        month: key => get(monthly, key),
        adjust(day, cod, dod, count) {
            assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
            assert.ok(Number.isFinite(cod) && Number.isFinite(dod) && Number.isInteger(count));
            change(daily, day, cod, dod, count); change(monthly, day.slice(0, 7), cod, dod, count);
        },
        verify(tree, knownCodes, label) {
            const days = new Set([...daily.keys(), ...Object.keys(tree.zoew_daily_revenue_cod_dod || {}),
                ...Object.values(tree.zoew_scan_history_cod_dod || {}).map(item => item.scanDate),
                ...Object.values(tree.zoew_recently_deleted_cod_dod || {}).map(item => item.scanDate)]);
            const months = new Set([...monthly.keys(), ...Object.keys(tree.zoew_monthly_revenue_cod_dod || {})]);
            for (const day of days) {
                assert.match(day, /^\d{4}-\d{2}-\d{2}$/); months.add(day.slice(0, 7));
                const inv = invariant(tree, day, day.slice(0, 7), knownCodes), expected = get(daily, day);
                assert.equal(invariantBroken(inv), null, label + '/' + day + ': ' + JSON.stringify(inv));
                assert.equal(inv.gotCod, expected.codDollar, label + '/' + day + ': COD');
                assert.equal(inv.gotDod, expected.dodDollar, label + '/' + day + ': DOD');
                assert.equal(inv.gotCount, expected.totalCount, label + '/' + day + ': count');
            }
            for (const month of months) {
                assert.deepEqual(amounts(tree.zoew_monthly_revenue_cod_dod?.[month]), get(monthly, month), label + '/' + month + ': monthly COD/DOD/count');
            }
        }
    };
}

// Lookup off through the App's own path (`storeLookupApiConfig()` ➜ `withdrawZtoTrashMode()`): every device withdraws the
// shop-wide trash-mode stamp it wrote. Clearing the stored Config alone left the Cookie/Palm stamps for `ZTO_TRASH_MODE_ACTIVE_MS`,
// so every later device without a ZTO Lookup ran under the Palm policy and refused every restore (deep audit 9, M6).
async function lookupOff(devices, read) {
    for (const d of devices) await d.page.evaluate(() => {
        const cfg = JSON.parse(localStorage.getItem('zoew_lookup_api_config') || 'null');
        if (cfg) window.storeLookupApiConfig({ ...cfg, enabled: false });
        localStorage.removeItem('zoew_lookup_api_config');
    });
    const until = Date.now() + 20000;
    for (;;) {
        const marks = (((await read()) || {}).zoew_settings || {}).zto_trash_mode || {};
        if (!Object.keys(marks.palm || {}).length && !Object.keys(marks.cookie || {}).length) return;
        assert.ok(Date.now() < until, 'Lookup បិទ ➜ ឧបករណ៍នីមួយៗត្រូវដកត្រារបៀបធុងសំរាមរបស់ខ្លួនពី server ៖ ' + JSON.stringify(marks));
        await sleep(100);
    }
}

async function restoreFlows({ devices, read, write, dateKey, monthKey, knownCodes, fixture, origin, site, tag, backend, authMode = 'cookie', onCheckpoint }) {
    assert.ok(devices.length >= 2, 'flow នេះត្រូវការ devices យ៉ាងតិច ២');
    assert.ok(['sheet', 'cookie', 'palm'].includes(authMode));
    const labelMode = authMode === 'sheet' ? 'Sheet' : authMode === 'palm' ? 'Palm' : 'Cookie';
    const gates = devices.map((d) => d.gate);
    const initial = await read();
    const revenue = createRevenueExpectation(initial);
    const scanDays = new Map();
    let steps = 0, duplicateCalls = 0, interruptions = 0;
    const flowNames = ['delete', 'remove', 'pickup2h', 'abandon8d', 'delete-signed', 'remove-signed', 'pickup2h-signed'];
    const modes = ['duplicate', 'offline-online', 'slow', 'close-before-write', 'close-after-commit'];
    const sync = async () => {
        await Promise.all(devices.map((d) => d.page.evaluate(() => fb.goOnline(db))));
        const until = Date.now() + 30000;
        for (;;) {
            const st = await Promise.all(devices.map((d) => d.state()));
            const done = await Promise.all(devices.map((d) => d.page.evaluate(() => window.__settled())));
            if (st.every((s, i) => done[i] && s.phase === 'ready' && s.pending === 0 && s.rows === 0 && s.blocked === 0 && !s.cleanupJournal && !s.pickupJournal)) break;
            if (Date.now() >= until) {
                const details = await Promise.all(devices.map((d) => d.page.evaluate(() => ({
                    journals: window.__journals(),
                    live: window.cleanupJournalLive ? [...window.cleanupJournalLive.keys()] : null, resuming: window.cleanupResumeInFlight,
                    history: window.scanHistory, trash: window.deletedItems
                })).catch((e) => ({ error: String(e.message) }))));
                assert.fail('មិនស្ងប់: ' + JSON.stringify(st) + '\n' + JSON.stringify(details));
            }
            await sleep(100);
        }
        const shape = (hist, trash) => Object.entries({ history: hist, trash }).flatMap(([root, bag]) => Object.values(bag || {}).flatMap((it) => Object.values(it.barcodes || {}).map((b) => [root, it.id, b.code, b.isDeducted === true, b.isClosed === true, b.createdAt || 0, b.closedAt || 0, b.restoredAt || 0].join('|')))).sort();
        const untilViews = Date.now() + 10000;
        for (;;) {
            const tree = await read();
            const want = shape(tree.zoew_scan_history_cod_dod, tree.zoew_recently_deleted_cod_dod);
            const views = await Promise.all(devices.map((d) => d.page.evaluate(() => [window.scanHistory, window.deletedItems])));
            if (views.every(([hist, trash]) => JSON.stringify(shape(hist, trash)) === JSON.stringify(want))) break;
            assert.ok(Date.now() < untilViews, 'ទិដ្ឋភាពមិនដូច server: ' + JSON.stringify({ want, views: views.map(([h, t]) => shape(h, t)) }));
            await Promise.all(devices.map((d) => d.page.evaluate(() => fb.goOnline(db)))); await sleep(100);
        }
    };
    const verify = async (label, code, where, deducted) => {
        await sync();
        const t = await read();
        revenue.verify(t, knownCodes, label);
        const day = scanDays.get(code) || dateKey;
        const inv = invariant(t, day, day.slice(0, 7), knownCodes);
        const matches = [];
        for (const [root, bag] of [['history', t.zoew_scan_history_cod_dod], ['trash', t.zoew_recently_deleted_cod_dod]]) {
            for (const item of Object.values(bag || {})) for (const b of Object.values(item.barcodes || {})) if (b.code === code) matches.push({ root, deducted: b.isDeducted === true, day: item.scanDate });
        }
        let diagnostic = '';
        if (JSON.stringify(matches) !== JSON.stringify([{ root: where, deducted, day }])) {
            const targetRows = (bag) => Object.values(bag || {}).filter((it) => Object.values(it.barcodes || {}).some((b) => b.code === code)).slice(0, 2)
                .map((it) => ({ id: it.id, scanDate: it.scanDate, isClosed: it.isClosed, closedAt: it.closedAt,
                    barcodes: Object.values(it.barcodes || {}).filter((b) => b.code === code).map(({ code, isClosed, closedAt, isDeducted, ztoSignedAt, createdAt, restoredAt }) => ({ code, isClosed, closedAt, isDeducted, ztoSignedAt, createdAt, restoredAt })) }));
            const views = await Promise.all(devices.map((d) => Promise.race([
                d.page.evaluate((code) => {
                    const targetRows = (bag) => Object.values(bag || {}).filter((it) => Object.values(it.barcodes || {}).some((b) => b.code === code)).slice(0, 2)
                        .map((it) => ({ id: it.id, scanDate: it.scanDate, isClosed: it.isClosed, closedAt: it.closedAt,
                            cleanupHeld: window.cleanupInFlight?.has(it.id),
                            barcodes: Object.values(it.barcodes || {}).filter((b) => b.code === code).map(({ code, isClosed, closedAt, isDeducted, ztoSignedAt, createdAt, restoredAt }) => ({ code, isClosed, closedAt, isDeducted, ztoSignedAt, createdAt, restoredAt })) }));
                    const verdict = window.ztoPickupStatus?.get(code);
                    return { online: navigator.onLine, connected: window.isDatabaseConnected, mode: window.getShopZtoTrashMode?.(),
                        clock: { local: Date.now(), server: window.getServerNow?.(), trusted: window.serverClockTrusted, offset: window.serverTimeOffsetMs, cleanupAllowed: window.cleanupClockIsTrustworthy?.() },
                        status: { busy: window.ztoStatusInFlight, lastSweep: window.ztoStatusLastSweepAt, failures: window.ztoStatusFailStreak, cursor: window.ztoStatusSweepCursor,
                            marksBusy: window.ztoFinalInFlight, marksRefusedAt: window.ztoFinalRefusedAt, lookupBusy: window.autoLookupInFlight?.size },
                        verdict: verdict && { closed: verdict.closed, signedAt: verdict.signedAt, signedAtExact: verdict.signedAtExact, at: verdict.at },
                        history: targetRows(window.scanHistory), trash: targetRows(window.deletedItems),
                        sweeps: (window.__moneySweepResults || []).filter((row) => row.code === code).slice(-4) };
                }, code).catch((error) => ({ error: String(error.message).slice(0, 300) })),
                sleep(2000).then(() => ({ diagnosticTimeout: true }))
            ])));
            const parcel = fixture.world.parcels.get(code);
            diagnostic = '\n' + JSON.stringify({ backend, authMode, code, views,
                server: { history: targetRows(t.zoew_scan_history_cod_dod), trash: targetRows(t.zoew_recently_deleted_cod_dod) },
                upstream: parcel && { site: parcel.site, arrivedAt: parcel.arrivedAt, signedAt: parcel.signedAt },
                calls: fixture.world.calls.slice(-8).map(({ barcode, list, palm, signed, exact, restore }) => ({ barcode, list, palm, signed, exact, restore })) });
        }
        assert.deepEqual(matches, [{ root: where, deducted, day }], label + ': barcode' + diagnostic);
        if (onCheckpoint) await onCheckpoint(labelMode + '/' + label);
        steps++;
        console.log('    ' + labelMode + ' ' + tag + ' ' + label + ' · ' + day + ' · COD=' + inv.gotCod + ' DOD=' + inv.gotDod + ' count=' + inv.gotCount + ' · ' + where + (deducted ? ' deducted' : ' counted'));
    };
    // ស្តារពិតបើកធុងសំរាមវិញ; ចេញតាមទ្វារ UI មុនស្កេនបន្ទាប់។ មិនបង្ខំ isModalOpen ឬបិទប្រអប់ផ្សេង។
    const leaveRestoreDialogs = async () => {
        const views = await Promise.all(devices.map((d) => d.page.evaluate(() => {
            if (window.restoreInFlight.size) throw new Error('មិនអាចបិទប្រអប់មុនស្តារចប់');
            if (window.modalIsOpen('restoreWarningModal')) window.cancelRestoreItem();
            if (window.modalIsOpen('recentlyDeletedModal')) window.closeRecentlyDeletedModal();
            return { modalOpen: window.isModalOpen, active: window.openModalIds() };
        })));
        assert.ok(views.every((view) => !view.modalOpen && view.active.length === 0),
            labelMode + ': ត្រូវចេញពីប្រអប់ស្តារ មុនចាប់ផ្តើមស្កេនថ្មី ' + JSON.stringify(views));
    };
    const sheetUrl = 'https://script.google.com/macros/s/zoe-money-lifecycle/exec';
    const sheetRoute = async (route) => {
        const url = new URL(route.request().url());
        const code = url.searchParams.get('code');
        const parcel = fixture.world.parcels.get(code);
        const headers = route.request().headers();
        assert.equal(headers['x-zoe-id-token'], undefined, 'Sheet មិនទទួល ID token');
        assert.equal(headers['x-zoe-proxy-key'], undefined, 'Sheet មិនទទួល proxy key');
        if (parcel) { assert.equal(parcel.site, site); fixture.world.sheetReads++; }
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(parcel ? { success: true, found: true, barcode: code, phone: parcel.phone, cod: 10, dod: 2 } : { rows: [] }) });
    };
    for (const d of devices) {
        if (authMode === 'sheet') await d.ctx.route(sheetUrl + '**', sheetRoute);
        // សោភ្ជាប់ ZTO រស់នៅតែអ៊ិនគ្រីបក្រោម PIN (`headerValueEnc`) ➜ ទុកសោ PIN ក្នុង IndexedDB (បើកទំព័រឡើងវិញស្តារវា) មុនបិទសោភ្ជាប់
        await d.page.evaluate(async ({ cfg, proxyKey }) => {
            if (proxyKey) {
                lookupSecretKey = await deriveLookupSecretKey('246810');
                if (!await rememberLookupSecretKey(lookupSecretKey)) throw new Error('PIN key មិនទុកបាន');
                cfg = { ...cfg, headerValueEnc: await encryptLookupSecret(proxyKey) };
                if (!cfg.headerValueEnc) throw new Error('សោភ្ជាប់អ៊ិនគ្រីបមិនបាន');
            }
            localStorage.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
        }, authMode === 'sheet'
            ? { cfg: { enabled: true, url: sheetUrl + '?code={barcode}', phoneField: 'phone', codField: 'cod', dodField: 'dod' }, proxyKey: '' }
            : { cfg: fixture.config(origin), proxyKey: fixture.proxyKey });
    }
    const before = { ...fixture.world };
    if (authMode === 'palm') {
        const loginsBefore = fixture.world.loginSites.get(site) || 0;
        for (let i = 0; i < devices.length; i++) {
            const d = devices[i];
            await d.page.evaluate(async () => {
                lookupSecretKey = await deriveLookupSecretKey('246810');
                if (!await rememberLookupSecretKey(lookupSecretKey)) throw new Error('PIN key មិនទុកបាន');
                openLookupApiConfigModal();
            });
            await d.page.locator('#lookupApiConfigModal summary').click();
            await d.page.waitForSelector('#ztoPalmUsernameInput', { state: 'visible' });
            if (i === 0) {
                await d.page.fill('#ztoPalmUsernameInput', 'palm-' + site);
                await d.page.fill('#ztoPalmPasswordInput', 'synthetic-palm-password');
                await d.page.evaluate(() => submitZtoPalmLogin());
            } else await d.page.evaluate(() => connectSharedZtoPalm());
            const cfg = await d.page.evaluate(() => JSON.parse(localStorage.getItem('zoew_lookup_api_config')));
            assert.equal(cfg.palmShared, true, 'Login/ប្រើ session ហាងត្រូវបានជោគជ័យ: ' + JSON.stringify(cfg));
            assert.equal(cfg.palmAccount.siteCode, site);
            for (const name of ['palmTokenEnc', 'palmRefreshTokenEnc', 'palmExpiresAt', 'headerValue']) assert.equal(cfg[name], undefined);
            assert.ok(!JSON.stringify(cfg).includes('synthetic-palm-password'));
            await d.page.evaluate(() => closeModal('lookupApiConfigModal'));
        }
        assert.equal(fixture.world.loginSites.get(site) - loginsBefore, 1, 'ឧបករណ៍ ៣ ត្រូវ Login តែម្តង');
    }
    const firstCall = fixture.world.calls.length;
    const upstreamStamp = (ms) => new Date(ms + 7 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
    const observeSign = (dev, code) => dev.page.evaluate(async (code) => {
        const answer = await window.checkZtoStatusForBarcode(window.getLookupApiConfig(), code);
        if (!answer || answer.closed !== true) throw new Error('ZTO detail ត្រូវបញ្ជាក់ Sign ពិត: ' + JSON.stringify(answer));
        window.setZtoPickupVerdict(code, answer.closed, answer.signedAt);
        return answer;
    }, code);
    // លំដាប់លើ barcode ដដែល៖ Lookup/Scan ➜ Remove ➜ Restore ➜ Delete ➜ Restore។
    // ទ្វារស្តារពិតនៅដដែល៖ Palm/Sign បដិសេធ; Sheet ត្រូវមាន shop mode local ពិត។
    const lookupConfigs = await Promise.all(devices.map((d) => d.page.evaluate(() => {
        const cfg = JSON.parse(localStorage.getItem('zoew_lookup_api_config'));
        localStorage.setItem('zoew_lookup_api_config', JSON.stringify({ ...cfg, autoSubmit: false, fastMode: false }));
        return cfg;
    })));
    const sequences = [{ signed: false, first: 'removeBarcode' }];
    if (authMode === 'palm') sequences.push({ signed: false, first: 'deleteItem' });
    if (authMode === 'cookie') sequences.push({ signed: true, first: 'removeBarcode' }, { signed: true, first: 'deleteItem' });
    for (let s = 0; s < sequences.length; s++) {
        const scenario = sequences[s];
        const blocked = authMode === 'palm' || scenario.signed;
        const code = String(910000000000000 + Number(site) * 1000 + ['sheet', 'cookie', 'palm'].indexOf(authMode) * 100 + s);
        const label = 'sequence/' + (scenario.signed ? 'signed/' : 'unsigned/') + scenario.first;
        fixture.world.parcels.set(code, { site, phone: '0977' + String(10000 + ['sheet', 'cookie', 'palm'].indexOf(authMode) * 100 + s),
            arrivedAt: upstreamStamp(Date.now() - 4 * 3600000) });
        const dev = devices[0];
        assert.equal(await dev.page.evaluate(() => window.getShopZtoTrashMode()), authMode === 'sheet' ? 'local' : authMode,
            labelMode + ': ទ្វាររបៀបហាងពិត');
        await leaveRestoreDialogs();
        await dev.page.evaluate((code) => window.triggerScanAction(code), code);
        try {
            await dev.page.waitForFunction((code) => document.getElementById('modalBarcodeText')?.innerText === code
                && document.getElementById('modalPhoneInput')?.value
                && Number(document.getElementById('modalCodInput')?.value) === 10
                && Number(document.getElementById('modalDodInput')?.value) === 2, code, { timeout: 15000 });
        } catch (error) {
            const ui = await dev.page.evaluate(() => ({ modalOpen: window.isModalOpen, active: window.openModalIds(),
                pendingBarcode: window.pendingBarcode, entryScanMode: window.entryScanMode,
                barcode: document.getElementById('modalBarcodeText')?.innerText,
                phone: document.getElementById('modalPhoneInput')?.value,
                cod: document.getElementById('modalCodInput')?.value, dod: document.getElementById('modalDodInput')?.value,
                lookup: document.getElementById('lookupStatus')?.textContent, online: navigator.onLine }));
            const calls = fixture.world.calls.slice(-6).map(({ barcode, list, palm, restore }) => ({ barcode, list, palm, restore }));
            throw new Error(labelMode + ' scan ' + code + ': ' + String(error.message) + '\n' + JSON.stringify({ ui, calls,
                details: fixture.world.details, palmDetails: fixture.world.palmDetails, palmTracks: fixture.world.palmTracks, sheetReads: fixture.world.sheetReads }));
        }
        const scanBounds = await dev.page.evaluate(confirmWithClockWindow);
        await sync();
        const afterScan = await read();
        const scannedItem = Object.values(afterScan.zoew_scan_history_cod_dod || {}).find((it) => Object.values(it.barcodes || {}).some((b) => b.code === code));
        const scanDay = scanDayForCheckpoint(scannedItem, scanBounds);
        assert.equal(Object.values(scannedItem.barcodes).length, 1, label + ': លំដាប់នេះត្រូវមានតែមួយ barcode ក្នុងជួរ ដើម្បី Remove/Delete មិនប៉ះកញ្ចប់ផ្សេង');
        scanDays.set(code, scanDay); knownCodes.push(code); revenue.adjust(scanDay, 10, 2, 1);
        await verify(label + '/scan', code, 'history', false);
        await dev.page.evaluate((code) => { window.triggerScanAction(code); window.triggerScanAction(code); }, code);
        duplicateCalls += 2;
        await verify(label + '/scan-repeat', code, 'history', false);
        assert.deepEqual((await read()).zoew_daily_revenue_cod_dod, afterScan.zoew_daily_revenue_cod_dod, label + ': ស្កេនស្ទួនមិនបូកប្រាក់');
        if (scenario.signed) {
            fixture.world.parcels.get(code).signedAt = upstreamStamp(Date.now() - 10000);
            await Promise.all(devices.map((d) => observeSign(d, code)));
            await Promise.all(devices.map((d) => d.page.evaluate(() => window.syncZtoFinalMarks())));
            await sync();
        }
        const actions = scenario.first === 'removeBarcode' ? ['removeBarcode', 'restore', 'deleteItem', 'restore'] : ['deleteItem', 'restore'];
        let where = 'history', deducted = false;
        for (let a = 0; a < actions.length; a++) {
            const wanted = actions[a];
            const beforeAction = await read();
            if (wanted === 'removeBarcode') { where = 'trash'; deducted = true; revenue.adjust(scanDay, -10, -2, -1); }
            else if (wanted === 'deleteItem' && where === 'history') where = 'trash';
            else if (wanted === 'restore' && !blocked) {
                where = 'history';
                if (deducted) { revenue.adjust(scanDay, 10, 2, 1); deducted = false; }
            }
            for (let repeat = 0; repeat < 2; repeat++) {
                await Promise.all(devices.map((d) => d.page.evaluate((args) => {
                    window.__startOp(args); window.__startOp(args);
                }, { wanted, pick: 0, target: { code } })));
                duplicateCalls += devices.length * 2;
                await verify(label + '/' + a + '-' + wanted + '/' + repeat, code, where, deducted);
            }
            if (wanted === 'restore' && blocked) {
                const after = await read();
                assert.deepEqual(after.zoew_restore_finalizations || {}, beforeAction.zoew_restore_finalizations || {}, label + ': បដិសេធមិន finalize');
                assert.deepEqual(after.zoew_daily_revenue_cod_dod, beforeAction.zoew_daily_revenue_cod_dod, label + ': បដិសេធមិនបូក/ដកប្រាក់');
                const trash = Object.values(after.zoew_recently_deleted_cod_dod).find((it) => Object.values(it.barcodes || {}).some((b) => b.code === code));
                assert.ok(trash && !trash.restoreClaim, label + ': បដិសេធមិនសល់ claim');
            }
        }
    }
    for (let i = 0; i < devices.length; i++) await devices[i].page.evaluate((cfg) => localStorage.setItem('zoew_lookup_api_config', JSON.stringify(cfg)), lookupConfigs[i]);
    if (authMode === 'sheet') assert.ok(fixture.world.sheetReads > before.sheetReads, 'Sheet ត្រូវអាន API boundary ពិត មិនប្រើតែ seed');
    // Sheet (ហាងគ្មាន ZTO ➜ របៀប local) រត់លំហូរ លុប · ដក · សម្អាត ២ ម៉ោង/ថ្ងៃទី ៨ ➜ ស្តារ ក្រោមការរំខានដូចគ្នា (គ្មាន Sign ➜ គ្មានលំហូរ -signed · ស្តារបានទាំងអស់)
    const runFlowNames = authMode === 'sheet' ? flowNames.filter((name) => !name.endsWith('-signed')) : flowNames;
    const codeBase = { cookie: 0, palm: 100, sheet: 200 }[authMode];
    const phoneBase = { cookie: '097700011', palm: '097700021', sheet: '097700031' }[authMode];
    let expectedInterruptions = 0;
    let deniedRestores = 0;
    for (let f = 0; f < runFlowNames.length; f++) {
        const flow = runFlowNames[f];
        const movement = flow.replace('-signed', '');
        const signedTrash = flow.endsWith('-signed');
        const finalTrash = authMode === 'palm' || signedTrash;
        for (let m = 0; m < modes.length; m++) {
            const mode = modes[m];
            const id = authMode + '_flow_' + tag + '_' + f + '_' + m;
            const code = String(900000000000000 + Number(site) * 1000 + codeBase + f * 10 + m);
            const target = { id, code };
            fixture.world.parcels.set(code, { site, arrivedAt: upstreamStamp(Date.now() - 4 * 3600000) }); knownCodes.push(code);
            const now = Date.now();
            const item = { id, phone: phoneBase + f, scanDate: dateKey, createdAt: now, isClosed: false, isCalled: false,
                time: '09:00:00 (' + dateKey + ')', count: 1, barcode: code, cod: 10, dod: 2, price: 12,
                barcodes: [{ code, cod: 10, dod: 2, locker: 'A1', createdAt: now, isClosed: false, isDeducted: false }] };
            revenue.adjust(dateKey, 10, 2, 1);
            await write([{ k: 'set', p: ['zoew_scan_history_cod_dod', id], v: item }, { k: 'set', p: ['zoew_barcode_registry', code], v: true },
                { k: 'set', p: ['zoew_daily_revenue_cod_dod', dateKey], v: revenue.day(dateKey) },
                { k: 'set', p: ['zoew_monthly_revenue_cod_dod', monthKey], v: revenue.month(monthKey) }]);
            await verify(flow + '/' + mode + '/seed', code, 'history', false);
            if (movement === 'pickup2h' || signedTrash) {
                await devices[0].page.evaluate((target) => window.__startOp({ wanted: 'closeOrder', pick: 0, target }), target);
                await sync();
            }
            await Promise.all(devices.map((d) => d.page.evaluate(() => window.runZtoStatusSweep(true))));
            await sync();
            if (movement === 'pickup2h') {
                const t = await read();
                const old = structuredClone(t.zoew_scan_history_cod_dod[id]);
                old.closedAt = Date.now() - (authMode === 'palm' ? 3 : 1) * 3600000;
                Object.values(old.barcodes).forEach((b) => { b.closedAt = old.closedAt; });
                await write([{ k: 'set', p: ['zoew_scan_history_cod_dod', id], v: old }]);
                await sync();
                await Promise.all(devices.map((d) => d.page.evaluate(() => window.runAutomaticCleanupRules())));
                await verify(flow + '/' + mode + '/before-cleanup-boundary', code, 'history', false);
            }
            for (const stage of ['move', 'restore']) {
                const blocked = stage === 'restore' && finalTrash;
                if (stage === 'restore' && signedTrash) {
                    fixture.world.parcels.get(code).signedAt = upstreamStamp(Date.now() - 10000);
                    await Promise.all(devices.map((d) => observeSign(d, code)));
                    await Promise.all(devices.map((d) => d.page.evaluate(() => window.syncZtoFinalMarks())));
                    await sync();
                    const trash = Object.values((await read()).zoew_recently_deleted_cod_dod || {}).find((it) => Object.values(it.barcodes || {}).some((b) => b.code === code));
                    assert.ok(trash && Object.values(trash.barcodes || {}).some((b) => b.code === code && b.ztoSignedAt > 0), 'signed trash ត្រូវមានត្រាពី sweep ពិត');
                }
                const beforeStage = await read();
                const wanted = stage === 'restore' ? 'restore' : movement === 'delete' ? 'deleteItem' : movement === 'remove' ? 'removeBarcode' : 'sweep';
                const dev = devices[0];
                const waitForGate = async () => {
                    try { await gates[0].hit(); }
                    catch (error) {
                        const state = await dev.page.evaluate((code) => ({
                            online: navigator.onLine, statusBusy: window.ztoStatusInFlight, marksBusy: window.ztoFinalInFlight,
                            lookupBusy: window.autoLookupInFlight?.size, verdict: window.ztoPickupStatus?.get(code),
                            history: window.scanHistory.filter((it) => Object.values(it.barcodes || {}).some((b) => b.code === code)),
                            operations: window.__opResults
                        }), code).catch((e) => ({ error: String(e.message) }));
                        throw new Error(error.message + '\n' + JSON.stringify({ flow, mode, stage, state, upstream: fixture.world.calls.slice(-5) }));
                    }
                };
                if (mode === 'offline-online') {
                    await dev.page.evaluate(() => fb.goOffline(db)); await dev.ctx.setOffline(true);
                } else if (!blocked && mode === 'slow') gates[0].arm('slow');
                else if (!blocked && mode.startsWith('close-')) gates[0].arm(mode === 'close-before-write' ? 'before' : 'after');
                if (stage === 'move' && movement === 'pickup2h') {
                    await Promise.all(devices.slice(1).map((d) => d.page.evaluate(() => fb.goOffline(db))));
                    if (authMode === 'palm' || signedTrash) fixture.world.parcels.get(code).signedAt = upstreamStamp(Date.now() - (authMode === 'palm' ? 3 * 3600000 : 10000));
                    if (authMode !== 'palm') {
                        const old = structuredClone(beforeStage.zoew_scan_history_cod_dod[id]);
                        old.closedAt = Date.now() - 3 * 3600000;
                        Object.values(old.barcodes).forEach((b) => { b.closedAt = old.closedAt; });
                        await write([{ k: 'set', p: ['zoew_scan_history_cod_dod', id], v: old }]);
                        if (mode !== 'offline-online') await dev.page.evaluate(() => fb.goOnline(db));
                    }
                }
                if (stage === 'move' && movement === 'abandon8d') {
                    await Promise.all(devices.slice(1).map((d) => d.page.evaluate(() => fb.goOffline(db))));
                    const old = structuredClone(beforeStage.zoew_scan_history_cod_dod[id]);
                    old.createdAt = Date.now() - 9 * 86400000;
                    Object.values(old.barcodes || {}).forEach((b) => { b.createdAt = old.createdAt; delete b.restoredAt; });
                    delete old.restoredAt;
                    await write([{ k: 'set', p: ['zoew_scan_history_cod_dod', id], v: old }]);
                    if (mode !== 'offline-online') await dev.page.evaluate(() => fb.goOnline(db));
                }
                const expectedSignedAt = stage === 'move' && movement === 'pickup2h' && authMode === 'palm'
                    ? Date.parse(fixture.world.parcels.get(code).signedAt.replace(' ', 'T') + '+07:00') : 0;
                if (stage === 'move' && movement === 'pickup2h' && authMode === 'palm') assert.ok(Number.isFinite(expectedSignedAt) && expectedSignedAt > 0, 'fixture ត្រូវមានពេល Sign ពិត');
                const start = (d) => d.page.evaluate((args) => {
                    if (args.wanted === 'sweep') window.__ops.push((async () => {
                        const started = Date.now();
                        let attempts = 0;
                        const deadline = Date.now() + 15000;
                        const signedReady = () => {
                            const verdict = window.ztoPickupStatus?.get(args.target.code);
                            return verdict?.closed === true && (!args.expectedSignedAt
                                || verdict.signedAtExact === true && verdict.signedAt === args.expectedSignedAt);
                        };
                        const settled = async () => {
                            while (window.ztoStatusInFlight || window.autoLookupInFlight?.size) {
                                if (Date.now() >= deadline) throw new Error('ZTO sweep មុននេះមិនទាន់ស្ងប់');
                                await new Promise((resolve) => setTimeout(resolve, 20));
                            }
                        };
                        do {
                            await settled();
                            attempts++;
                            await window.runZtoStatusSweep(true);
                            if (args.expectSigned && !signedReady() && Date.now() < deadline) {
                                await new Promise((resolve) => setTimeout(resolve, 20));
                            }
                        } while (args.expectSigned && !signedReady() && Date.now() < deadline);
                        const verdict = window.ztoPickupStatus?.get(args.target.code);
                        window.__moneySweepResults = [...(window.__moneySweepResults || []).slice(-7), {
                            code: args.target.code, expectSigned: args.expectSigned, expectedSignedAt: args.expectedSignedAt, attempts, elapsed: Date.now() - started,
                            closed: verdict?.closed, signedAt: verdict?.signedAt, signedAtExact: verdict?.signedAtExact, statusBusy: window.ztoStatusInFlight
                        }];
                        if (args.expectSigned && !signedReady()) throw new Error('ZTO Sign មិនទាន់បញ្ជាក់ក្នុង 15s: ' + JSON.stringify(window.__moneySweepResults.at(-1)));
                        await window.syncZtoFinalMarks();
                        window.runAutomaticCleanupRules();
                    })());
                    return [window.__startOp(args), window.__startOp(args)];
                }, { wanted, pick: 0, target, expectedSignedAt, expectSigned: stage === 'move' && movement === 'pickup2h' && (authMode === 'palm' || signedTrash) });
                await start(dev); duplicateCalls += 2;
                if (mode === 'offline-online') {
                    await sleep(250);
                    const t = await read(); const rev = t.zoew_daily_revenue_cod_dod[dateKey];
                    assert.equal(r2(rev.codDollar), revenue.day(dateKey).codDollar, 'offline មិនទាន់ដក/បូក');
                    assert.equal(r2(rev.dodDollar), revenue.day(dateKey).dodDollar, 'offline មិនទាន់ដក/បូក DOD');
                    assert.equal(rev.totalCount, revenue.day(dateKey).totalCount, 'offline មិនទាន់ដក/បូកចំនួន');
                    await dev.ctx.setOffline(false); await dev.page.evaluate(() => fb.goOnline(db));
                } else if (mode.startsWith('close-')) {
                    if (!blocked) { await waitForGate(); expectedInterruptions++; }
                    const closing = dev.page.close(); gates[0].release(true); await closing; gates[0].release();
                    if (!blocked) interruptions++;
                    await dev.reopen();
                    await dev.page.evaluate(() => window.runZtoStatusSweep(true));
                }
                if (!blocked && mode === 'slow') { await waitForGate(); gates[0].release(); }
                await Promise.all(devices.slice(1).map((d) => d.page.evaluate(() => fb.goOnline(db))));
                await Promise.all(devices.map(start)); duplicateCalls += devices.length * 2;
                if (wanted === 'sweep') {
                    await sync();
                    await Promise.all(devices.map((d) => d.page.evaluate(() => window.runZtoStatusSweep(true))));
                    await Promise.all(devices.map((d) => d.page.evaluate(() => window.syncZtoFinalMarks())));
                    await Promise.all(devices.map((d) => d.page.evaluate(() => window.runAutomaticCleanupRules())));
                }
                const removed = movement === 'remove' || movement === 'abandon8d';
                const deducted = removed && (stage === 'move' || blocked);
                if (removed && !blocked) { const sign = stage === 'move' ? -1 : 1; revenue.adjust(dateKey, sign * 10, sign * 2, sign); }
                await verify(flow + '/' + mode + '/' + (blocked ? 'restore-blocked' : stage), code, stage === 'move' || blocked ? 'trash' : 'history', deducted);
                if (blocked) {
                    const after = await read();
                    assert.deepEqual(after.zoew_restore_finalizations || {}, beforeStage.zoew_restore_finalizations || {}, 'restore បដិសេធមិនសរសេរ finalization');
                    const trash = Object.values(after.zoew_recently_deleted_cod_dod || {}).find((it) => Object.values(it.barcodes || {}).some((b) => b.code === code));
                    assert.ok(trash && !trash.restoreClaim, 'restore បដិសេធមិនសល់ claim');
                    deniedRestores++;
                }
            }
        }
    }
    if (authMode === 'cookie') {
        assert.ok(fixture.world.blobReads > before.blobReads && fixture.world.lists > before.lists && fixture.world.details > before.details, 'ត្រូវអាន Blob + Cookie list + detail ពិត');
        assert.ok(fixture.world.calls.slice(firstCall).some((q) => q.list === '1' && q.signed === '1' && q.exact === '1'), 'ត្រូវអាន Cookie signed list ពេញលេញ');
    } else if (authMode === 'palm') {
        assert.ok(fixture.world.palmBlobReads > before.palmBlobReads && fixture.world.palmLists > before.palmLists
            && fixture.world.palmDetails > before.palmDetails && fixture.world.palmTracks > before.palmTracks,
            'ត្រូវអាន Palm session Blob + Palm list + bill lookup + track ពិត');
        assert.ok(fixture.world.calls.slice(firstCall).some((q) => q.palm === '1' && q.list === '1' && q.signed === '1' && q.exact === '1'), 'ត្រូវអាន Palm signed list ពេញលេញ');
    }
    assert.equal(interruptions, expectedInterruptions);
    assert.equal(deniedRestores, runFlowNames.filter((name) => authMode === 'palm' || name.endsWith('-signed')).length * modes.length);
    if (authMode === 'sheet') {
        assert.equal(interruptions, runFlowNames.length * 4, 'Sheet ៖ ការបិទទំព័រពាក់កណ្តាលសរសេរត្រូវបាញ់ពិតគ្រប់លំហូរ (ផ្លាស់ទី + ស្តារ × មុន/ក្រោយ commit)');
        await leaveRestoreDialogs();
        await lookupOff(devices, read);
        for (const d of devices) await d.ctx.unroute(sheetUrl + '**', sheetRoute);
        console.log('  ok Sheet ' + backend + ' ' + tag + ': ' + steps + ' server checkpoints · ' + duplicateCalls + ' repeated calls · ' + interruptions
            + ' page closes mid-write · Remove→Restore→Delete→Restore · ' + runFlowNames.join('/') + ' ➜ restore');
        return { steps, duplicateCalls, interruptions };
    }
    if (authMode === 'cookie') {
        for (const [index, phase] of ['claim', 'prepared'].entries()) {
            const sourceId = 'sign_race_' + tag + '_' + phase;
            const targetId = sourceId + '_neighbor';
            const code = String(900000000000000 + Number(site) * 1000 + 900 + index * 10);
            const neighborCode = String(Number(code) + 1);
            const now = Date.now();
            const phone = '097700061' + index;
            const makeItem = (id, parcel, amount, fee) => ({ id, phone, scanDate: dateKey, createdAt: now, isClosed: false, isCalled: false,
                time: '09:00:00 (' + dateKey + ')', count: 1, barcode: parcel, cod: amount, dod: fee, price: amount + fee,
                barcodes: [{ code: parcel, cod: amount, dod: fee, locker: 'A1', createdAt: now, isClosed: false, isDeducted: false }] });
            const source = makeItem(sourceId, code, 10, 2);
            const neighbor = makeItem(targetId, neighborCode, 3, 1);
            for (const parcel of [code, neighborCode]) {
                knownCodes.push(parcel);
                fixture.world.parcels.set(parcel, { site, arrivedAt: upstreamStamp(now - 4 * 3600000) });
            }
            revenue.adjust(dateKey, 13, 3, 2);
            await write([{ k: 'set', p: ['zoew_scan_history_cod_dod', sourceId], v: source },
                { k: 'set', p: ['zoew_scan_history_cod_dod', targetId], v: neighbor },
                ...[code, neighborCode].map((parcel) => ({ k: 'set', p: ['zoew_barcode_registry', parcel], v: true })),
                { k: 'set', p: ['zoew_daily_revenue_cod_dod', dateKey], v: revenue.day(dateKey) },
                { k: 'set', p: ['zoew_monthly_revenue_cod_dod', monthKey], v: revenue.month(monthKey) }]);
            await verify('sign-after-' + phase + '/seed', code, 'history', false);
            const args = { wanted: 'removeBarcode', pick: 0, target: { code } };
            await devices[0].page.evaluate((args) => window.__startOp(args), args);
            revenue.adjust(dateKey, -10, -2, -1);
            await verify('sign-after-' + phase + '/removed', code, 'trash', true);
            const before = await read();
            const [trashId] = Object.entries(before.zoew_recently_deleted_cod_dod).find(([, it]) => Object.values(it.barcodes || {}).some((b) => b.code === code));
            const originalNeighbor = before.zoew_scan_history_cod_dod[targetId];
            await Promise.all(devices.slice(1).map((d) => d.page.evaluate(() => fb.goOffline(db))));
            gates[0].arm('after', (op) => phase === 'claim'
                ? op.path === 'zoew_recently_deleted_cod_dod/' + trashId && !!op.value?.restoreClaim
                : op.path === 'zoew_scan_history_cod_dod/' + targetId && op.value?.restoreClaimId === trashId);
            args.wanted = 'restore';
            await devices[0].page.evaluate((args) => window.__startOp(args), args);
            await gates[0].hit();
            const claimed = await read();
            assert.equal(claimed.zoew_recently_deleted_cod_dod[trashId].restoreClaim.targetId, targetId, 'restore ត្រូវប្រើ target លេខទូរស័ព្ទដដែល');
            assert.equal(r2(claimed.zoew_daily_revenue_cod_dod[dateKey].codDollar), revenue.day(dateKey).codDollar, 'មុន finalize មិនត្រូវបូក COD');
            assert.equal(r2(claimed.zoew_daily_revenue_cod_dod[dateKey].dodDollar), revenue.day(dateKey).dodDollar, 'មុន finalize មិនត្រូវបូក DOD');
            assert.equal(claimed.zoew_daily_revenue_cod_dod[dateKey].totalCount, revenue.day(dateKey).totalCount, 'មុន finalize មិនត្រូវបូកចំនួន');
            if (phase === 'prepared') {
                const prepared = claimed.zoew_scan_history_cod_dod[targetId];
                assert.equal(prepared.restoreClaimId, trashId, 'gate ត្រូវចាប់ history prepare ពិត');
                assert.deepEqual(Object.values(prepared.barcodes).map((b) => b.code).sort(), [code, neighborCode].sort());
            } else assert.deepEqual(claimed.zoew_scan_history_cod_dod[targetId], originalNeighbor);
            fixture.world.parcels.get(code).signedAt = upstreamStamp(Date.now() - 10000);
            await observeSign(devices[0], code);
            gates[0].release();
            await verify('sign-after-' + phase + '/cancelled', code, 'trash', true);
            const cancelled = await read();
            const frozen = cancelled.zoew_recently_deleted_cod_dod[trashId];
            assert.equal(frozen.restoreBlocked, true, 'ការបដិសេធ Sign ត្រូវរក្សាទុកលើ server');
            assert.ok(!frozen.restoreClaim, 'ការបដិសេធ Sign មិនត្រូវសល់ claim');
            assert.deepEqual(cancelled.zoew_scan_history_cod_dod[targetId], originalNeighbor, 'cancel មិនត្រូវប៉ះ barcode ដើមក្នុង target');
            assert.deepEqual(cancelled.zoew_restore_finalizations || {}, before.zoew_restore_finalizations || {}, 'cancel មិនត្រូវ finalize');
            for (const d of devices.slice(1)) {
                assert.equal(await d.page.evaluate((code) => window.ztoPickupStatus.get(code)?.closed === true, code), false, 'ឧបករណ៍សាកឡើងវិញត្រូវគ្មាន verdict Sign');
                await d.page.evaluate((args) => { window.__startOp(args); window.__startOp(args); }, args);
                duplicateCalls += 2;
            }
            await verify('sign-after-' + phase + '/restore-blocked', code, 'trash', true);
            const retried = await read();
            assert.ok(!retried.zoew_recently_deleted_cod_dod[trashId].restoreClaim);
            assert.deepEqual(retried.zoew_scan_history_cod_dod[targetId], originalNeighbor);
            assert.deepEqual(retried.zoew_restore_finalizations || {}, before.zoew_restore_finalizations || {});
            deniedRestores++;
        }
    }
    await lookupOff(devices, read);
    const lockedFlow = authMode === 'palm' ? 0 : 4;
    const lockedCode = String(900000000000000 + Number(site) * 1000 + codeBase + lockedFlow * 10);
    await Promise.all(devices.map((d) => d.page.evaluate((code) => {
        const args = { wanted: 'restore', pick: 0, target: { code } };
        window.__startOp(args); window.__startOp(args);
    }, lockedCode)));
    duplicateCalls += devices.length * 2;
    await verify('lookup-off/restore-blocked', lockedCode, 'trash', false);
    deniedRestores++;
    await leaveRestoreDialogs();
    console.log('  ok ' + labelMode + ' ' + backend + ' ' + tag + ': ' + steps + ' server checkpoints · ' + duplicateCalls + ' repeated calls · ' + interruptions + ' page closes mid-write · ' + deniedRestores + ' denied restores · ' + labelMode + ' Blob/list/detail verified');
    return { steps, duplicateCalls, interruptions };
}

module.exports = { cookieFixture, networkGate, restoreFlows, createRevenueExpectation, scanDayForCheckpoint, confirmWithClockWindow };
