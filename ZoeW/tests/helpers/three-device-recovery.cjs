var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert/strict");
const H = "zoew_scan_history_cod_dod", T = "zoew_recently_deleted_cod_dod", D = "zoew_daily_revenue_cod_dod", M = "zoew_monthly_revenue_cod_dod";
const clone = (v) => v === void 0 ? void 0 : JSON.parse(JSON.stringify(v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let store = {}, fault = null, events = [], devices = [];
const get = (p) => clone(p.split("/").filter(Boolean).reduce((v, k) => v?.[k], store) ?? null);
function set(p, v) {
  let a = p.split("/").filter(Boolean), o = store;
  for (const k of a.slice(0, -1)) o = o[k] ??= {};
  if (v == null) delete o[a.at(-1)];
  else o[a.at(-1)] = clone(v);
}
const snap = (p, v) => ({ key: p.split("/").at(-1), val: () => clone(v), exists: () => v != null });
const root = fs.mkdtempSync(path.join(require("os").tmpdir(), "zoe-three-device-"));
const build = require("esbuild");
const bundle = build.buildSync({ stdin: { contents: `export {dataState,firebaseState,uiState} from './src/core/state'; export {getServerNow} from './src/core/clock'; export {readCleanupJournal,resumeCleanupJournalEntry} from './src/domain/cleanup'; export {executeRestoreItem} from './src/features/restore'; export {removeSingleBarcode} from './src/features/barcode-ops'; export {deleteSingleItem} from './src/features/entry-ops'; export {addRevenueToDailyAndMonthlyRecord} from './src/domain/ledger';`, resolveDir: path.resolve(__dirname, "../.."), loader: "ts" }, bundle: true, write: false, format: "iife", globalName: "APP", platform: "browser", define: { __APP_VERSION__: '"test"', __CACHE_VERSION__: '"test"', __FCM_CONFIGURED__: "true", "import.meta.env.VITE_NATIVE_WEB_ORIGIN": '""' } }).outputFiles[0].text;
async function device(name, reset = false) {
  const { Window } = await import(require("url").pathToFileURL(require.resolve("happy-dom")).href);
  const w = new Window({ url: "https://shop.test" });
  const file = path.join(root, name + ".json");
  if (reset) fs.writeFileSync(file, "{}");
  let saved = JSON.parse(fs.readFileSync(file, "utf8"));
  const timers = /* @__PURE__ */ new Set();
  const dev = { name, dead: false, w, delay: 2 };
  const storage = { getItem: (k) => saved[k] ?? null, setItem(k, v) {
    if (dev.dead) throw Error("dead");
    saved[k] = String(v);
    fs.writeFileSync(file, JSON.stringify(saved));
  }, removeItem(k) {
    if (dev.dead) throw Error("dead");
    delete saved[k];
    fs.writeFileSync(file, JSON.stringify(saved));
  }, clear() {
    if (dev.dead) throw Error("dead");
    saved = {};
    fs.writeFileSync(file, "{}");
  }, key: (i) => Object.keys(saved)[i] ?? null, get length() {
    return Object.keys(saved).length;
  } };
  const ctx = { window: w, document: w.document, navigator: w.navigator, localStorage: storage, sessionStorage: w.sessionStorage, location: w.location, console: { ...console, error: (...a) => events.push({ error: String(a[0]), detail: String(a[2] || "") }) }, queueMicrotask(fn) { if (!dev.dead) queueMicrotask(() => { if (!dev.dead) fn(); }); }, URL, URLSearchParams, Response, Request, Headers, TextEncoder, TextDecoder, AbortController, crypto: require("crypto").webcrypto, confirm: () => true, alert: () => {
  }, performance, atob, btoa, Event: w.Event, CustomEvent: w.CustomEvent, HTMLElement: w.HTMLElement, MutationObserver: w.MutationObserver, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {
  }, setInterval: () => 0, clearInterval: () => {
  }, setTimeout(fn, ms) {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!dev.dead) fn();
    }, ms);
    timers.add(t);
    return t;
  }, clearTimeout(t) {
    clearTimeout(t);
    timers.delete(t);
  }, fetch: async (u) => { if (dev.dead) throw Error("dead"); return new Response(JSON.stringify(get(new URL(u).pathname.replace(/^\//, "").replace(/\.json$/, "")))); } };
  w.ZoeErrors = { capture() {
  } };
  ctx.ZoeErrors = w.ZoeErrors;
  w.confirm = ctx.confirm;
  w.alert = ctx.alert;
  Object.defineProperty(w, "localStorage", { value: storage });
  const session = w.sessionStorage;
  const sessionStorage = { getItem: (k) => session.getItem(k), key: (i) => session.key(i), get length() { return session.length; }, setItem(k, v) { if (dev.dead) throw Error("dead"); session.setItem(k, v); }, removeItem(k) { if (dev.dead) throw Error("dead"); session.removeItem(k); }, clear() { if (dev.dead) throw Error("dead"); session.clear(); } };
  ctx.sessionStorage = sessionStorage;
  Object.defineProperty(w, "sessionStorage", { value: sessionStorage });
  w.queueMicrotask = ctx.queueMicrotask;
  w.setTimeout = ctx.setTimeout;
  w.clearTimeout = ctx.clearTimeout;
  w.setInterval = ctx.setInterval;
  w.clearInterval = ctx.clearInterval;
  w.fetch = ctx.fetch;
  dev.context = ctx;
  vm.createContext(ctx);
  vm.runInContext(bundle, ctx);
  dev.app = ctx.APP;
  dev.storage = storage;
  dev.kill = () => {
    dev.dead = true;
    for (const t of timers) clearTimeout(t);
    timers.clear();
  };
  const ref = (db2, p = "") => ({ db: db2, path: p, key: p.split("/").at(-1), toString: () => `https://shop.firebaseio.com/${p}` });
  const hang = () => new Promise(() => {
  });
  async function io(kind, p, fn, values) {
    await sleep(dev.delay);
    if (dev.dead) return hang();
    let f = fault && fault.device === name && fault.match(kind, p, values) ? fault : null;
    if (f && f.when === "pre") {
      fault = null;
      events.push({ name, kind, p, point: f.point });
      f.hit = true;
      if (f.point === "delayed-finalize") setTimeout(() => {
        fn();
        f.lateCommitted = true;
        events.push({ name, point: f.point, committedAfterKill: dev.dead });
      }, 40);
      return hang();
    }
    const result = fn();
    if (f && f.when === "post") {
      fault = null;
      events.push({ name, kind, p, point: f.point });
      f.hit = true;
      return hang();
    }
    return result;
  }
  const fb = { ref, increment: (n) => ({ __inc__: n }), get: (r) => io("get", r.path, () => snap(r.path, get(r.path))), runTransaction: (r, up) => io("tx", r.path, () => {
    let prior = get(r.path), v = up(prior);
    if (v === void 0) return { committed: false, snapshot: snap(r.path, prior) };
    set(r.path, v);
    return { committed: true, snapshot: snap(r.path, v) };
  }), update: (r, updates) => io("update", r.path, () => {
    validateFinalization(r.path, updates);
    for (const [k, val] of Object.entries(updates)) {
      let p = [r.path, k].filter(Boolean).join("/");
      set(p, val && typeof val === "object" && "__inc__" in val ? (Number(get(p)) || 0) + val.__inc__ * (process.env.NEGATIVE_CONTROL === "duplicate-credit" && Object.keys(updates).some((k2) => k2.startsWith("zoew_restore_finalizations/")) ? 2 : 1) : val);
    }
  }, updates), onValue: () => () => {
  }, off() {
  } };
  const s = dev.app.firebaseState, db = { name: "shop" };
  Object.assign(s, { db, fb, firebaseConfig: { databaseURL: "https://shop.firebaseio.com" }, auth: { currentUser: { uid: name, getIdToken: async () => "tok" } }, isDatabaseInitialized: true, isDatabaseConnected: true, serverClockTrusted: true, hasEverConnectedToDatabase: true });
  for (const [key, p] of Object.entries({ History: H, Deleted: T, DailyRevenue: D, MonthlyRevenue: M, DailyPickup: "zoew_daily_pickup_cod_dod", DailyCollected: "zoew_daily_collected_cod_dod" })) s["dbRef" + key] = ref(db, p);
  dev.sync = () => Object.assign(dev.app.dataState, { scanHistory: Object.values(get(H) || {}), deletedItems: Object.values(get(T) || {}), dailyRevenueData: get(D) || {}, monthlyRevenueData: get(M) || {}, dailyPickupData: {}, dailyCollectedData: {} });
  dev.sync();
  devices.push(dev);
  return dev;
}
function seedStore(seed) {
  const day = ["2026-01-31", "2026-02-01", "2026-09-20"][seed % 3], month = day.slice(0, 7), cod = seed * 137 % 4e3 / 100, dod = seed * 71 % 900 / 100;
  const b = { code: "C", time: "08:00:00 (" + day + ")", cod, dod, locker: "N/A", isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: Date.now() - 36e5 };
  const item = { id: "id_1758000000000_aaaa1", phone: "012", scanDate: day, time: b.time, createdAt: b.createdAt, count: 1, cod, dod, price: cod + dod, isClosed: false, isCalled: false, barcode: "C", barcodes: [b] };
  store = { [H]: { [item.id]: item, neighbor: { ...clone(item), id: "neighbor", phone: "099", barcode: "N", barcodes: [{ ...clone(b), code: "N" }] } }, [T]: {}, [D]: { [day]: { codDollar: 1e4, dodDollar: 9e3, totalCount: 100 }, "2025-12-31": { codDollar: 71, dodDollar: 19, totalCount: 8 } }, [M]: { [month]: { codDollar: 1e4, dodDollar: 9e3, totalCount: 100 }, "2025-12": { codDollar: 71, dodDollar: 19, totalCount: 8 } } };
  return { day, month, cod, dod, id: item.id, neighbor: clone(store[H].neighbor) };
}
function money(f, removed) {
  for (const p of [D + "/" + f.day, M + "/" + f.month]) {
    let r = get(p);
    assert.ok(Math.abs(r.codDollar - (1e4 - (removed ? f.cod : 0))) < 1e-7, JSON.stringify({ p, r, f, removed }));
    assert.ok(Math.abs(r.dodDollar - (9e3 - (removed ? f.dod : 0))) < 1e-7);
    assert.equal(r.totalCount, 100 - (removed ? 1 : 0));
  }
  assert.deepEqual(get(H + "/neighbor"), f.neighbor);
  assert.deepEqual(get(D + "/2025-12-31"), { codDollar: 71, dodDollar: 19, totalCount: 8 });
  assert.deepEqual(get(M + "/2025-12"), { codDollar: 71, dodDollar: 19, totalCount: 8 });
}
async function restore(d, id) {
  d.sync();
  d.app.uiState.pendingRestoreId = id;
  await d.app.executeRestoreItem();
}
function validateFinalization(refPath, updates) {
  const entries = Object.entries(updates).map(([key, value]) => [[refPath, key].filter(Boolean).join("/"), value]);
  for (const [entryPath, witness] of entries) {
    const witnessMatch = /^zoew_restore_finalizations\/([^/]+)$/.exec(entryPath);
    if (!witnessMatch) continue;
    const sourceId = witnessMatch[1];
    const source = get(`zoew_recently_deleted_cod_dod/${sourceId}`);
    if (witness === null) {
      if (!get(entryPath) || source) throw new Error("permission_denied: restore witness cleanup");
      continue;
    }
    const claim = source && source.restoreClaim;
    const target = witness && get(`${H}/${witness.targetId}`);
    if (source?.restoreBlocked === true || source?.trashMode === "palm" || !claim || !witness || witness.token !== claim.token || witness.targetId !== claim.targetId || !target || target.restoreClaimId !== sourceId || target.restoreClaimToken !== witness.token || updates[`${T}/${sourceId}`] !== null) {
      throw new Error("permission_denied: restore finalization witness");
    }
  }
  for (const [entryPath, value] of entries) {
    const trashMatch = /^zoew_recently_deleted_cod_dod\/([^/]+)$/.exec(entryPath);
    if (!trashMatch || value !== null) continue;
    const sourceId = trashMatch[1];
    const trash = get(entryPath);
    if (!trash || !trash.restoreClaim) continue;
    const claim = trash.restoreClaim;
    const witness = updates[`zoew_restore_finalizations/${sourceId}`];
    const history = get(`zoew_scan_history_cod_dod/${claim.targetId}`);
    const removesMarkers = updates[`zoew_scan_history_cod_dod/${claim.targetId}/restoreClaimId`] === null && updates[`zoew_scan_history_cod_dod/${claim.targetId}/restoreClaimToken`] === null && updates[`zoew_scan_history_cod_dod/${claim.targetId}/restoreAddedCodes`] === null;
    if (!witness || witness.token !== claim.token || witness.targetId !== claim.targetId || !history || history.restoreClaimId !== sourceId || history.restoreClaimToken !== claim.token || !removesMarkers) {
      throw new Error("permission_denied: restore delete fence");
    }
  }
}
const points = ["pre-history", "post-history", "post-month", "post-day", "pre-finalize", "post-finalize", "post-prepare", "delayed-finalize"];
async function waitHit(f) {
  for (let i = 0; i < 500 && !f.hit; i++) await sleep(2);
  assert.ok(f.hit, "fault not reached " + f.point);
}
async function scenario(seed, point, mode) {
  const f = seedStore(seed);
  let a = await device("A", true), b = await device("B", true), c = await device("C", true);
  if (!process.env.LEGACY_BASELINE) {
    set(D + "/" + f.day, { codDollar: 0, dodDollar: 0, totalCount: 0 });
    set(M + "/" + f.month, { codDollar: 0, dodDollar: 0, totalCount: 0 });
    a.sync();
    const initial = a.app.addRevenueToDailyAndMonthlyRecord(f.day, 1e4, 9e3, 100);
    await Promise.all([initial.dailyServer, initial.monthlyServer]);
    for (const d of [a, b, c]) d.sync();
  }
  money(f, false);
  if (process.env.MISSING_DAILY) { set(D + "/" + f.day, null); a.app.dataState.dailyRevenueData = {}; }
  if (process.env.STALE_DAILY) {
    const r = a.app.dataState.dailyRevenueData[f.day];
    a.app.dataState.dailyRevenueData[f.day] = { codDollar: r.codDollar, dodDollar: r.dodDollar, totalCount: r.totalCount };
  }
  a.delay = 2 + seed % 4;
  b.delay = 1 + seed % 3;
  c.delay = 3;
  assert.notEqual(a.app.dataState, b.app.dataState);
  assert.notEqual(b.app.dataState, c.app.dataState);
  assert.notEqual(a.storage, b.storage);
  let restorePhase = point.includes("finalize") || point === "post-prepare";
  const action = (d) => mode === "remove" ? d.app.removeSingleBarcode(f.id, "C") : d.app.deleteSingleItem(f.id, { confirmed: true, quiet: true });
  const hit = { device: "A", point, when: point.startsWith("pre-") || point === "delayed-finalize" ? "pre" : "post", match: (kind, p, v) => point.includes("finalize") ? kind === "update" && Object.keys(v || {}).some((k) => k.startsWith("zoew_restore_finalizations/")) : point === "post-prepare" ? kind === "tx" && p.startsWith(H + "/") : point === "post-month" ? kind === "tx" && (p === M || p.startsWith(M + "/")) : point === "post-day" ? kind === "tx" && p.startsWith(D + "/") : kind === "tx" && p === H + "/" + f.id };
  let id;
  if (restorePhase) {
    await Promise.all([action(a), action(b), action(c)]);
    money(f, mode === "remove");
    id = Object.keys(get(T))[0];
    fault = hit;
    void restore(a, id);
  } else {
    fault = hit;
    void action(a);
  }
  await waitHit(hit);
  a.kill();
  let durable = fs.readFileSync(path.join(root, "A.json"), "utf8");
  if (process.env.NEGATIVE_CONTROL === "lost-journal") fs.writeFileSync(path.join(root, "A.json"), "{}");
  a = await device("A");
  if (process.env.NEGATIVE_CONTROL !== "lost-journal") assert.equal(fs.readFileSync(path.join(root, "A.json"), "utf8"), durable);
  a.sync();
  if (point === "delayed-finalize") {
    for (let i = 0; i < 100 && !hit.lateCommitted; i++) await sleep(2);
    assert.ok(hit.lateCommitted);
    assert.ok(events.some((e) => e.point === point && e.committedAfterKill));
  }
  if (restorePhase) {
    await Promise.all([restore(a, id), restore(b, id), restore(c, id)]);
    await restore(a, id);
  } else {
    for (const entry of a.app.readCleanupJournal()) await a.app.resumeCleanupJournalEntry(entry.trashItem.id);
    a.sync();
    b.sync();
    c.sync();
    if (get(H + "/" + f.id)) await Promise.all([action(a), action(b), action(c)]);
    if (process.env.LEGACY_BASELINE || process.env.MISSING_DAILY) {
      if (process.env.MISSING_DAILY) assert.equal(get(D + "/" + f.day), null); else assert.equal(get(D + "/" + f.day).codDollar, 1e4);
      assert.ok(Math.abs(get(M + "/" + f.month).codDollar - (1e4 - f.cod)) < 1e-7);
      assert.equal(a.app.readCleanupJournal().length, 1);
      assert.deepEqual(get(H + "/neighbor"), f.neighbor);
      const held = clone(store);
      id = Object.keys(get(T))[0];
      await restore(b, id);
      assert.deepEqual(store, held);
      assert.equal(a.app.readCleanupJournal().length, 1);
      for (const d of devices) d.kill();
      devices = [];
      return { seed, point, mode, expected: "conservative-held-no-proof", journalRetained: true };
    }
    money(f, mode === "remove");
    id = Object.keys(get(T))[0];
    assert.ok(id);
    await Promise.all([restore(a, id), restore(b, id), restore(c, id)]);
  }
  money(f, false);
  assert.equal(Object.keys(get(T) || {}).length, 0);
  let all = Object.values(get(H)).flatMap((x) => x.barcodes || []);
  assert.equal(all.filter((x) => x.code === "C").length, 1);
  for (const d of [a, b, c]) {
    d.sync();
    assert.deepEqual(clone(d.app.dataState.scanHistory), Object.values(get(H)));
    assert.deepEqual(clone(d.app.readCleanupJournal()), []);
    assert.deepEqual(JSON.parse(d.storage.getItem("zoew_restore_intents_v1") || "{}"), {});
  }
  for (const d of devices) d.kill();
  devices = [];
  return { seed, point, mode, delay: [2 + seed % 4, 1 + seed % 3, 3], journalBytes: durable.length };
}
function dispose() {
  for (const d of devices) d.kill();
  devices = [];
  fault = null;
}
function cleanup() {
  dispose();
  fs.rmSync(root, { recursive: true, force: true });
}
async function killedContextIsolation() {
  seedStore(6);
  const old = await device("A", true);
  old.storage.setItem("journal", "old");
  let microtasks = 0;
  old.context.queueMicrotask(() => { microtasks++; });
  old.context.window.queueMicrotask(() => { microtasks++; });
  old.kill();
  const fresh = await device("A");
  fresh.storage.setItem("journal", "restarted");
  for (const storage of [old.storage, old.context.sessionStorage]) {
    assert.throws(() => storage.setItem("journal", "stale"), /dead/);
    assert.throws(() => storage.removeItem("journal"), /dead/);
    assert.throws(() => storage.clear(), /dead/);
  }
  await assert.rejects(old.context.fetch("https://shop.firebaseio.com/probe.json"), /dead/);
  old.context.queueMicrotask(() => { microtasks++; });
  const prior = clone(store);
  void old.app.firebaseState.fb.update(old.app.firebaseState.fb.ref(old.app.firebaseState.db), { probe: "stale" });
  await sleep(10);
  assert.equal(microtasks, 0);
  assert.deepEqual(store, prior);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "A.json"), "utf8")).journal, "restarted");
  assert.equal(fresh.storage.getItem("journal"), "restarted");
}
function witnessCleanupFence() {
  store = { zoew_restore_finalizations: { source: { token: "old", targetId: "target", finalizedAt: 1 } } };
  validateFinalization("", { "zoew_restore_finalizations/source": null });
  set(`${T}/source`, { restoreClaim: { token: "token", targetId: "target" } });
  set(`${H}/target`, { restoreClaimId: "source", restoreClaimToken: "token", restoreAddedCodes: "[]" });
  assert.throws(() => validateFinalization("", { "zoew_restore_finalizations/source": null }), /permission_denied/);
  validateFinalization("", { "zoew_restore_finalizations/source": { token: "token", targetId: "target", finalizedAt: 2 }, [`${T}/source`]: null, [`${H}/target/restoreClaimId`]: null, [`${H}/target/restoreClaimToken`]: null, [`${H}/target/restoreAddedCodes`]: null });
}
module.exports = { scenario, dispose, cleanup, events, killedContextIsolation, witnessCleanupFence };
