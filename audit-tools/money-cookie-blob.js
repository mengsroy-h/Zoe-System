'use strict';

// App/Function/adapter/rules/ledger ពិត; ជំនួសតែ Netlify Blob SDK និង Argus ខាងក្រៅ។
// ការផ្ទៀងប្រាក់ដែលរំពឹងទុកឯករាជ្យពី isDeducted: បើ flag និង ledger ខុសជាមួយគ្នា ក៏ត្រូវធ្លាក់។
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { invariant, invariantBroken, r2 } = require('./money-multidevice-core.js');
const fx = require('./idtoken-fixture.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cookieFixture(root, { project, supabaseUrl, supabaseKey } = {}) {
    const fn = require(path.join(root, 'ZoeW/netlify/functions/zto-order-detail.js'));
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
    const world = { blobReads: 0, lists: 0, details: 0, palmLists: 0, palmTracks: 0, logins: 0, loginSites: new Map(), palmBlobReads: 0, tokenSites: new Map(), calls: [], parcels: new Map() };
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
                const token = 'synthetic-palm-money-token-' + site;
                world.logins++; world.loginSites.set(site, (world.loginSites.get(site) || 0) + 1); world.tokenSites.set(token, site);
                return Response.json({ status: true, result: { token, countryCode: 'KH', siteCode: site, siteName: 'សាខាតេស្ត ' + site } });
            }
            const site = world.tokenSites.get(new Headers(init.headers).get('x-token'));
            assert.ok(site, 'Palm ត្រូវប្រើ token ពី Login ពិត');
            if (pathname === '/zto/dispatch/v1/queryDispatchList') {
                world.palmLists++;
                const codes = [...world.parcels].filter(([, p]) => p.site === site && String(body.billStatus) === '4').map(([code]) => code);
                const pageSize = Number(body.pageSize) || 20;
                return Response.json({ status: true, statusCode: 'SYS000', result: { list: codes.slice((body.pageNum - 1) * pageSize, body.pageNum * pageSize)
                    .map((billCode) => ({ billCode, billStatus: '4', consigneeMobile: '0960007345', cod: '10', dod: '2', dispEmpDate: '2026-10-19 09:00:00' })),
                    pageNum: body.pageNum, pageSize, pages: Math.ceil(codes.length / pageSize), total: codes.length } });
            }
            assert.equal(pathname, '/zto/locus/v1/queryTrackInfo');
            world.palmTracks++;
            const code = String(body.mailNos);
            const p = world.parcels.get(code);
            assert.ok(!p || p.site === site, 'Palm មិនត្រូវឃើញ barcode សាខាផ្សេង');
            return Response.json({ status: true, statusCode: 'SYS000', result: p ? [{ mail: { mailNo: code, isSign: 0 },
                tracks: [{ mailNo: code, actionName: 'scan', action: '3', siteCode: site, time: '2026-10-19 09:00:00' }] }] : [] });
        }
        if (new URL(href).hostname !== 'aargus-api.ztoglobal.com') {
            assert.equal(new URL(href).hostname, '127.0.0.1', 'មិនអនុញ្ញាតបណ្តាញក្រៅ lab');
            return originalFetch(url, init);
        }
        assert.equal(new Headers(init.headers).get('cookie'), cookie, 'Argus ត្រូវទទួល Cookie ពី Blob');
        const body = JSON.parse(init.body);
        if (href.includes('/scan/get/order/detail')) {
            world.details++;
            const p = world.parcels.get(String(body.billCode));
            return Response.json({ success: true, data: p ? { billCode: String(body.billCode), consigneeMobile: '855977000111',
                agentAmount: 10, fcAmount: 2, siteCode: p.site, billStatus: 1 } : null });
        }
        assert.ok(body.condition, 'ការហៅ Cookie list ត្រូវប្រើ condition');
        world.lists++;
        return Response.json({ success: true, data: { pageNum: body.pageNum, pages: 1, total: 0, result: [] } });
    };
    return {
        world,
        config(origin) { return { enabled: true, fastMode: true, headerName: 'X-Zoe-Proxy-Key', headerValue: key,
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
    const state = { mode: '', hits: 0, releases: [], responseIds: new Set(), closed: false };
    const hold = () => new Promise((resolve) => state.releases.push(resolve));
    const moving = (p) => /^zoew_(?:scan_history|recently_deleted)_cod_dod(?:\/|$)/.test(p);
    const before = async () => {
        if (!state.mode) return;
        if (state.mode === 'before') { state.hits++; await hold(); }
        if (state.mode === 'slow') { state.hits++; await sleep(500); }
    };
    if (backend === 'supabase') {
        await ctx.route(/\/rest\/v1\/rpc\/zoe_write$/, async (route) => {
            const body = route.request().postDataJSON();
            if (!(body.p_ops || []).some((op) => moving(op.p.join('/')))) return route.continue();
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
                if (d && ['p', 'm'].includes(d.a) && (moving(String(d.b.p || '').replace(/^\//, '')) || Object.keys(d.b.d || {}).some(moving))) {
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
        arm(mode) { assert.equal(state.releases.length, 0); state.mode = mode; state.hits = 0; state.closed = false; },
        async hit() { const until = Date.now() + 8000; while (!state.hits && Date.now() < until) await sleep(30); assert.ok(state.hits, 'ការចាក់បណ្តាញត្រូវបាញ់ write ពិត (' + state.mode + ')'); },
        release(closed = false) { state.closed = closed; state.mode = ''; state.responseIds.clear(); state.releases.splice(0).forEach((r) => r()); },
        get hits() { return state.hits; }
    };
}

async function restoreFlows({ devices, read, write, dateKey, monthKey, knownCodes, fixture, origin, site, tag, backend, authMode = 'cookie' }) {
    assert.ok(devices.length >= 2, 'flow នេះត្រូវការ devices យ៉ាងតិច ២');
    assert.ok(['cookie', 'palm'].includes(authMode));
    const labelMode = authMode === 'palm' ? 'Palm' : 'Cookie';
    const gates = devices.map((d) => d.gate);
    const initial = await read();
    const baseline = initial.zoew_daily_revenue_cod_dod[dateKey];
    let cod = baseline.codDollar, dod = baseline.dodDollar, count = baseline.totalCount;
    let steps = 0, duplicateCalls = 0, interruptions = 0;
    const flowNames = ['delete', 'remove', 'pickup2h', 'abandon8d'];
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
                    journal: JSON.parse(localStorage.getItem('zoew_cleanup_journal_v1') || '[]'),
                    live: window.cleanupJournalLive ? [...window.cleanupJournalLive.keys()] : null, resuming: window.cleanupResumeInFlight,
                    history: window.scanHistory, trash: window.deletedItems
                })).catch((e) => ({ error: String(e.message) }))));
                assert.fail('មិនស្ងប់: ' + JSON.stringify(st) + '\n' + JSON.stringify(details));
            }
            await sleep(100);
        }
        const tree = await read();
        const shape = (hist, trash) => Object.entries({ history: hist, trash }).flatMap(([root, bag]) => Object.values(bag || {}).flatMap((it) => Object.values(it.barcodes || {}).map((b) => [root, it.id, b.code, b.isDeducted === true, b.isClosed === true, b.createdAt || 0, b.closedAt || 0, b.restoredAt || 0].join('|')))).sort();
        const want = shape(tree.zoew_scan_history_cod_dod, tree.zoew_recently_deleted_cod_dod);
        const untilViews = Date.now() + 10000;
        for (;;) {
            const views = await Promise.all(devices.map((d) => d.page.evaluate(() => [window.scanHistory, window.deletedItems])));
            if (views.every(([hist, trash]) => JSON.stringify(shape(hist, trash)) === JSON.stringify(want))) break;
            assert.ok(Date.now() < untilViews, 'ទិដ្ឋភាពមិនដូច server: ' + JSON.stringify({ want, views: views.map(([h, t]) => shape(h, t)) }));
            await Promise.all(devices.map((d) => d.page.evaluate(() => fb.goOnline(db)))); await sleep(100);
        }
    };
    const verify = async (label, code, where, deducted) => {
        await sync();
        const t = await read();
        const inv = invariant(t, dateKey, monthKey, knownCodes);
        assert.equal(invariantBroken(inv), null, label + ': ' + JSON.stringify(inv));
        assert.equal(inv.gotCod, r2(cod), label + ': COD'); assert.equal(inv.gotDod, r2(dod), label + ': DOD'); assert.equal(inv.gotCount, count, label + ': count');
        const matches = [];
        for (const [root, bag] of [['history', t.zoew_scan_history_cod_dod], ['trash', t.zoew_recently_deleted_cod_dod]]) {
            for (const item of Object.values(bag || {})) for (const b of Object.values(item.barcodes || {})) if (b.code === code) matches.push({ root, deducted: b.isDeducted === true });
        }
        assert.deepEqual(matches, [{ root: where, deducted }], label + ': barcode');
        steps++;
        console.log('    ' + labelMode + ' ' + tag + ' ' + label + ' · COD=' + inv.gotCod + ' DOD=' + inv.gotDod + ' count=' + inv.gotCount + ' · ' + where + (deducted ? ' deducted' : ' counted'));
    };
    for (const d of devices) {
        await d.page.evaluate((cfg) => localStorage.setItem('zoew_lookup_api_config', JSON.stringify(cfg)), fixture.config(origin));
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
    for (let f = 0; f < flowNames.length; f++) {
        const flow = flowNames[f];
        const id = authMode + '_flow_' + tag + '_' + f;
        const code = String(900000000000000 + Number(site) * 100 + (authMode === 'palm' ? 20 : 0) + f);
        fixture.world.parcels.set(code, { site }); knownCodes.push(code);
        const now = Date.now();
        const item = { id, phone: (authMode === 'palm' ? '097700021' : '097700011') + f, scanDate: dateKey, createdAt: now, isClosed: false, isCalled: false,
            time: '09:00:00 (' + dateKey + ')', count: 1, barcode: code, cod: 10, dod: 2, price: 12,
            barcodes: [{ code, cod: 10, dod: 2, locker: 'A1', createdAt: now, isClosed: false, isDeducted: false }] };
        cod += 10; dod += 2; count++;
        await write([{ k: 'set', p: ['zoew_scan_history_cod_dod', id], v: item }, { k: 'set', p: ['zoew_barcode_registry', code], v: true },
            { k: 'set', p: ['zoew_daily_revenue_cod_dod', dateKey], v: { codDollar: r2(cod), dodDollar: r2(dod), totalCount: count } },
            { k: 'set', p: ['zoew_monthly_revenue_cod_dod', monthKey], v: { codDollar: r2(cod), dodDollar: r2(dod), totalCount: count } }]);
        await verify(flow + '/seed', code, 'history', false);
        for (const mode of modes) {
            const target = { id, code };
            if (flow === 'pickup2h' || flow === 'abandon8d') {
                if (flow === 'pickup2h') {
                    await devices[0].page.evaluate((target) => {
                        const item = window.scanHistory.find((it) => it.id === target.id);
                        if (item && !item.isClosed) window.__startOp({ wanted: 'closeOrder', pick: 0, target });
                    }, target); await sync();
                }

            }
            // កុំចាក់ completeAt ឬកែ verdict ដើម្បីឱ្យ cleanup ឆ្លង។ ត្រូវឆ្លង signed list ពី Cookie ពិត។
            await Promise.all(devices.map((d) => d.page.evaluate(() => window.runZtoStatusSweep(true))));
            await sync();
            for (const stage of ['move', 'restore']) {
                const wanted = stage === 'restore' ? 'restore' : flow === 'delete' ? 'deleteItem' : flow === 'remove' ? 'removeBarcode' : 'sweep';
                const dev = devices[0];
                if (mode === 'offline-online') {
                    await dev.page.evaluate(() => fb.goOffline(db)); await dev.ctx.setOffline(true);
                } else if (mode === 'slow') gates[0].arm('slow');
                else if (mode.startsWith('close-')) gates[0].arm(mode === 'close-before-write' ? 'before' : 'after');
                if (stage === 'move' && (flow === 'pickup2h' || flow === 'abandon8d')) {
                    await Promise.all(devices.slice(1).map((d) => d.page.evaluate(() => fb.goOffline(db))));
                const t = await read();
                const old = structuredClone(t.zoew_scan_history_cod_dod[id]);
                old.barcodes = Object.values(old.barcodes || {});
                if (flow === 'pickup2h') { old.closedAt = Date.now() - 3 * 3600000; old.barcodes.forEach((b) => { b.closedAt = old.closedAt; }); }
                else { old.createdAt = Date.now() - 9 * 86400000; old.barcodes.forEach((b) => { b.createdAt = old.createdAt; delete b.restoredAt; }); delete old.restoredAt; }
                await write([{ k: 'set', p: ['zoew_scan_history_cod_dod', id], v: old }]);
                    if (mode !== 'offline-online') await dev.page.evaluate(() => fb.goOnline(db));
                    if (mode !== 'offline-online') await dev.page.waitForFunction(({ id, flow }) => {
                        const it = window.scanHistory.find((x) => x.id === id);
                        return !it || (flow === 'pickup2h' ? it.closedAt < Date.now() - 2 * 3600000 : it.createdAt < Date.now() - 8 * 86400000);
                    }, { id, flow });
                }
                const start = (d) => d.page.evaluate((args) => [window.__startOp(args), window.__startOp(args)], { wanted, pick: 0, target });
                await start(dev); duplicateCalls += 2;
                if (mode === 'offline-online') {
                    await sleep(250);
                    const t = await read(); const rev = t.zoew_daily_revenue_cod_dod[dateKey];
                    assert.equal(rev.codDollar, r2(cod), 'offline មិនទាន់ដក/បូក');
                    await dev.ctx.setOffline(false); await dev.page.evaluate(() => fb.goOnline(db));
                    if (stage === 'move' && (flow === 'pickup2h' || flow === 'abandon8d')) await dev.page.waitForFunction(({ id, flow }) => {
                        const it = window.scanHistory.find((x) => x.id === id);
                        return !it || (flow === 'pickup2h' ? it.closedAt < Date.now() - 2 * 3600000 : it.createdAt < Date.now() - 8 * 86400000);
                    }, { id, flow });
                } else if (mode.startsWith('close-')) {
                    await gates[0].hit();
                    const closing = dev.page.close(); gates[0].release(true); await closing; gates[0].release(); interruptions++;
                    await dev.reopen();
                    await dev.page.evaluate(() => window.runZtoStatusSweep(true));
                }
                await Promise.all(devices.slice(1).map((d) => d.page.evaluate(() => fb.goOnline(db))));
                await Promise.all(devices.map(start)); duplicateCalls += devices.length * 2;
                if (mode === 'slow') { await gates[0].hit(); gates[0].release(); }
                const deducted = stage === 'move' && (flow === 'remove' || flow === 'abandon8d');
                if (flow === 'remove' || flow === 'abandon8d') { const sign = stage === 'move' ? -1 : 1; cod += sign * 10; dod += sign * 2; count += sign; }
                await verify(flow + '/' + mode + '/' + stage, code, stage === 'move' ? 'trash' : 'history', deducted);
            }
        }
    }
    if (authMode === 'cookie') {
    assert.ok(fixture.world.blobReads > before.blobReads && fixture.world.lists > before.lists && fixture.world.details > before.details, 'ត្រូវអាន Blob + Cookie list + detail ពិត');
    assert.ok(fixture.world.calls.slice(firstCall).some((q) => q.list === '1' && q.signed === '1' && q.exact === '1'), 'ត្រូវអាន Cookie signed list ពេញលេញ');
    } else {
        assert.ok(fixture.world.palmBlobReads > before.palmBlobReads && fixture.world.palmLists > before.palmLists && fixture.world.palmTracks > before.palmTracks,
            'ត្រូវអាន Palm session Blob + Palm list + track ពិត');
        assert.ok(fixture.world.calls.slice(firstCall).some((q) => q.palm === '1' && q.list === '1' && q.signed === '1' && q.exact === '1'), 'ត្រូវអាន Palm signed list ពេញលេញ');
    }
    assert.equal(interruptions, flowNames.length * 4);
    console.log('  ok ' + labelMode + ' ' + backend + ' ' + tag + ': ' + steps + ' server checkpoints · ' + duplicateCalls + ' repeated calls · ' + interruptions + ' page closes mid-write · ' + labelMode + ' Blob/list/detail verified');
    for (const d of devices) await d.page.evaluate(() => localStorage.removeItem('zoew_lookup_api_config'));
    return { steps, duplicateCalls, interruptions };
}

module.exports = { cookieFixture, networkGate, restoreFlows };
