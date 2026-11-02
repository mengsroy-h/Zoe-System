'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), http = require('http'), vm = require('vm');
const { isDeepStrictEqual: equal } = require('util');
const ROOT = path.resolve(process.env.F03_ORDINAL_APP_DIR || process.env.ZOE_REPO_ROOT || path.join(__dirname, '../..'));
const REPO = path.resolve(process.env.ZOE_REPO_ROOT || ROOT);
const T = 'zoew_recently_deleted_cod_dod', R = 'zoew_barcode_registry', P = 'zoew_registry_releases', G = 'zoew_trash_consumptions';
const H = 'zoew_scan_history_cod_dod', F = 'zoew_restore_finalizations', O = 'zoew_scan_operations';
const D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const FIXTURE = 'audit-tools/fixtures/f03-ordinal-prototype.rules.json';
const MAX_BYTES = 4 * 1024 * 1024, WAIT_MS = 15000, PHASE_MS = 90000, RSS_LIMIT = 512 * 1024 * 1024;
const UID = 'ordinal-current-user', ORIGINAL_UID = 'ordinal-original-claim-user', SCOPE = 'f03-isolated-ordinal-prototype';
const clone = value => JSON.parse(JSON.stringify(value));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function memorySample(phase) {const value=process.memoryUsage();return{phase,rss:value.rss,heapUsed:value.heapUsed,osPeakRssBytes:process.resourceUsage().maxRSS*1024};}
function memoryWithinBudget(value) {return [value.rss,value.osPeakRssBytes].every(bytes=>Number.isFinite(bytes)&&bytes>=0&&bytes<=RSS_LIMIT);}
const and = (...parts) => '(' + parts.map(part => '(' + part + ')').join(' && ') + ')';
const or = (...parts) => '(' + parts.map(part => '(' + part + ')').join(' || ') + ')';
const integer = (value, min = 0) => and(value + '.isNumber()', value + '.val() >= ' + min, value + '.val() <= 9007199254740990', value + '.val() % 1 === 0');
const string = (value, max = 2048) => and(value + '.isString()', value + '.val().length > 0', value + '.val().length <= ' + max);
const slotString = value => and(value + '.isString()', value + '.val().matches(/^(0|[1-9][0-9]{0,8})$/)');
const receiptString = value => and(value + '.isString()', value + '.val().matches(/^(release|scan)_[a-f0-9]{32}$/)');
function prototypeRules() {
    const { NATIVE_F03_CANONICAL_GUARD } = require(path.join(ROOT, 'supabase/scripts/rtdb-canonical-key.cjs'));
    const original = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'))).rules;
    const source = "root.child('" + T + "').child($sourceId)";
    const post = 'newData' + '.parent().parent().parent().parent()';
    const consumption = root => root + ".child('" + G + "').child($sourceId)";
    const sourceAbsent = root => '!' + root + ".child('" + T + "').child($sourceId).exists()";
    const fresh = "!root.child('" + G + "').child($sourceId).exists()";
    const incarnation = g => and(g + ".child('sourceId').val() === $sourceId", g + ".child('actorUid').val() === auth.uid",
        g + ".child('generation').val() === " + source + ".child('trashGeneration').val()",
        g + ".child('deletedAt').val() === " + source + ".child('deletedAt').val()", g + ".child('rowBirth').val() === " + source + ".child('createdAt').val()");
    const eligible = and(source + '.exists()', '!' + source + ".child('restoreClaim').exists()", '!' + source + ".child('scanPending').exists()", '!' + source + ".child('pricePending').exists()");
    const anchor = g => {
        const first = g + ".child('order').child('0')", member = g + ".child('members').child(" + first + '.val())';
        return and(slotString(first), source + ".child('barcodes').child(" + first + '.val()).exists()',
            member + ".child('ordinal').val() === 0", receiptString(member + ".child('id')"),
            "!root.child('" + P + "').child(" + member + ".child('id').val()).exists()");
    };
    const purge = (g, root) => and('auth != null', fresh, g + ".child('v').val() === 2", g + ".child('kind').val() === 'purge'",
        incarnation(g), integer(g + ".child('count')", 1), g + ".child('count').val() === " + source + ".child('count').val()", eligible, sourceAbsent(root), anchor(g));
    const g = consumption(post), member = g + ".child('members').child($slot)", ordinal = member + ".child('ordinal').val()";
    const id = member + ".child('id').val()", receipt = post + ".child('" + P + "').child(" + id + ')';
    const successor = g + ".child('order').child((" + ordinal + " + 1) + '')";
    const nextMember = g + ".child('members').child(" + successor + '.val())';
    const slotGate = and('data.exists()', '!newData.exists()', purge(g, post), "$slot.matches(/^(0|[1-9][0-9]{0,8})$/)",
        integer(member + ".child('ordinal')"), ordinal + ' < ' + g + ".child('count').val()",
        g + ".child('order').child(" + ordinal + " + '').val() === $slot", receiptString(member + ".child('id')"),
        "!root.child('" + P + "').child(" + id + ').exists()', receipt + '.exists()', receipt + ".child('id').val() === " + id,
        receipt + ".child('trashId').val() === $sourceId", receipt + ".child('slot').val() === $slot",
        receipt + ".child('generation').val() === " + g + ".child('generation').val()", receipt + ".child('code').val() === data.child('code').val()",
        receipt + ".child('birth').val() === data.child('createdAt').val()", receipt + ".child('releasedBy').val() === auth.uid",
        g + ".child('byKey').child(" + receipt + ".child('registryKey').val()).val() === " + id,
        or(ordinal + ' === ' + g + ".child('count').val() - 1", and(slotString(successor), source + ".child('barcodes').child(" + successor + '.val()).exists()', nextMember + ".child('ordinal').val() === " + ordinal + ' + 1')));
    const metaRoot = 'newData.parent().parent().parent()', metaG = consumption(metaRoot);
    const metaGate = and('data.exists()', '!newData.exists()', purge(metaG, metaRoot));
    const restore = (gc, after) => and('auth != null', fresh, incarnation(gc), gc + ".child('kind').val() === 'restore'", sourceAbsent(after),
        string(gc + ".child('token')"), string(gc + ".child('targetId')", 128),
        source + ".child('restoreClaim').child('token').val() === " + gc + ".child('token').val()",
        source + ".child('restoreClaim').child('targetId').val() === " + gc + ".child('targetId').val()",
        after + ".child('" + F + "').child($sourceId).child('token').val() === " + gc + ".child('token').val()",
        after + ".child('" + F + "').child($sourceId).child('targetId').val() === " + gc + ".child('targetId').val()",
        after + ".child('" + H + "').child(" + gc + ".child('targetId').val()).child('restoreClaimId').val() === $sourceId");
    const rowRoot = 'newData.parent().parent()', rowG = consumption(rowRoot);
    const recordRoot = 'newData.parent().parent()', record = 'newData';
    const recordShape = and("newData.hasChildren(['v','sourceId','generation','kind','actorUid','scope','deletedAt','rowBirth'])", "newData.child('v').val() === 2",
        or(and("newData.child('kind').val() === 'purge'", "newData.hasChildren(['count','order','members','byKey'])", "!newData.child('token').exists()", "!newData.child('targetId').exists()"),
            and("newData.child('kind').val() === 'restore'", "newData.hasChildren(['token','targetId'])", "!newData.child('count').exists()", "!newData.child('order').exists()", "!newData.child('members').exists()", "!newData.child('byKey').exists()")));
    const pRoot = 'newData.parent().parent()', pSourceId = "newData.child('trashId').val()", pSource = "root.child('" + T + "').child(" + pSourceId + ')';
    const pg = pRoot + ".child('" + G + "').child(" + pSourceId + ')', pm = pg + ".child('members').child(newData.child('slot').val())";
    const oldBarcode = pSource + ".child('barcodes').child(newData.child('slot').val())";
    const claim = "root.child('" + R + "').child(newData.child('registryKey').val())", operation = "root.child('" + O + "').child(newData.child('id').val())";
    const legacy = and("newData.child('kind').val() === 'legacy'", "newData.child('actorUid').val() === auth.uid", '!' + oldBarcode + ".child('scanIntent').exists()", or('!' + claim + '.exists()', claim + '.val() === true'));
    const scan = and("newData.child('kind').val() === 'scan'", oldBarcode + ".child('scanIntent').val() === $releaseId", claim + ".child('v').val() === 2", claim + ".child('intent').val() === $releaseId",
        claim + ".child('actorUid').val() === newData.child('actorUid').val()", claim + ".child('birth').val() === newData.child('birth').val()",
        operation + ".child('phase').val() === 'committed'", operation + ".child('actorUid').val() === newData.child('actorUid').val()",
        operation + ".child('code').val() === newData.child('code').val()", operation + ".child('registryKey').val() === newData.child('registryKey').val()", operation + ".child('birth').val() === newData.child('birth').val()");
    const pValid = and("newData.hasChildren(['v','id','kind','actorUid','releasedBy','scope','code','registryKey','birth','trashId','slot','deletedAt','rowBirth','rowCount','generation'])",
        "newData.child('v').val() === 2", "newData.child('id').val() === $releaseId", "$releaseId.matches(/^(release|scan)_[a-f0-9]{32}$/)",
        slotString("newData.child('slot')"), NATIVE_F03_CANONICAL_GUARD, "newData.child('releasedBy').val() === auth.uid",
        "!root.child('" + G + "').child(" + pSourceId + ').exists()', pg + ".child('kind').val() === 'purge'", pg + ".child('actorUid').val() === auth.uid",
        pg + ".child('generation').val() === newData.child('generation').val()", pg + ".child('count').val() === newData.child('rowCount').val()",
        pSource + ".child('trashGeneration').val() === newData.child('generation').val()", pSource + ".child('count').val() === newData.child('rowCount').val()",
        pSource + ".child('deletedAt').val() === newData.child('deletedAt').val()", pSource + ".child('createdAt').val() === newData.child('rowBirth').val()",
        oldBarcode + ".child('code').val() === newData.child('code').val()", oldBarcode + ".child('createdAt').val() === newData.child('birth').val()",
        pm + ".child('id').val() === $releaseId", pg + ".child('order').child(" + pm + ".child('ordinal').val() + '').val() === newData.child('slot').val()",
        pg + ".child('byKey').child(newData.child('registryKey').val()).val() === $releaseId", "newData.child('scope').val() === " + pg + ".child('scope').val()",
        '!' + pRoot + ".child('" + R + "').child(newData.child('registryKey').val()).exists()", '!' + pRoot + ".child('" + T + "').child(" + pSourceId + ').exists()', or(legacy, scan));
    const strings = ['id','kind','actorUid','releasedBy','scope','code','registryKey','trashId','slot'];
    const releaseRules = { '.write': "auth != null && !data.exists() && newData.exists() && newData.child('releasedBy').val() === auth.uid", '.validate': pValid };
    for (const field of strings) releaseRules[field] = { '.validate': string('newData') };
    for (const field of ['birth','deletedAt','rowBirth','rowCount','generation']) releaseRules[field] = { '.validate': integer('newData') };
    releaseRules.v = { '.validate': 'newData.val() === 2' }; releaseRules.$other = { '.validate': false };
    const gRules = { '.write': or(purge(record, recordRoot), restore(record, recordRoot)), '.validate': recordShape };
    for (const field of ['sourceId','kind','actorUid','scope','token','targetId']) gRules[field] = { '.validate': string('newData') };
    for (const field of ['generation','deletedAt','rowBirth']) gRules[field] = { '.validate': integer('newData') };
    gRules.v = { '.validate': 'newData.val() === 2' }; gRules.count = { '.validate': integer('newData', 1) };
    const orderRecord = 'newData.parent().parent()', orderSlot = 'newData.val()', orderMember = orderRecord + ".child('members').child(" + orderSlot + ')';
    gRules.order = { '$ordinal': { '.validate': and(slotString('newData'), integer(orderMember + ".child('ordinal')"), '$ordinal === ' + orderMember + ".child('ordinal').val() + ''", orderMember + ".child('ordinal').val() < " + orderRecord + ".child('count').val()", source + ".child('barcodes').child(" + orderSlot + ').exists()') } };
    const memberRecord = 'newData.parent().parent()';
    gRules.members = { '$slot': { '.validate': and("newData.hasChildren(['ordinal','id'])", "$slot.matches(/^(0|[1-9][0-9]{0,8})$/)", source + ".child('barcodes').child($slot).exists()", memberRecord + ".child('order').child(newData.child('ordinal').val() + '').val() === $slot", receiptString("newData.child('id')")),
        ordinal: { '.validate': integer('newData') }, id: { '.validate': receiptString('newData') }, '$other': { '.validate': false } } };
    const keyRecord = 'newData.parent().parent()', keyPost = 'newData.parent().parent().parent().parent()', keyReceipt = keyPost + ".child('" + P + "').child(newData.val())";
    gRules.byKey = { '$registryKey': { '.validate': and(receiptString('newData'), keyReceipt + ".child('registryKey').val() === $registryKey", keyReceipt + ".child('trashId').val() === $sourceId", keyRecord + ".child('members').child(" + keyReceipt + ".child('slot').val()).child('id').val() === newData.val()") } };
    gRules.$other = { '.validate': false };
    const restoreClaim = { '.write': or(metaGate, and('auth != null', '!data.exists()', 'newData.exists()', "newData.parent().exists()", fresh, "newData.hasChildren(['token','targetId'])")),
        '.validate': "newData.hasChildren(['token','targetId'])", token: { '.validate': string('newData') }, targetId: { '.validate': string('newData', 128) }, '$other': { '.validate': false } };
    const rules = { '.read': false, '.write': false, [T]: { '.read': 'auth != null', '$sourceId': { '.write': restore(rowG, rowRoot), barcodes: { '$slot': { '.write': slotGate } }, restoreClaim, '$metadata': { '.write': metaGate } } },
        [G]: { '.read': 'auth != null', '$sourceId': gRules }, [P]: { '.read': 'auth != null', '$releaseId': releaseRules }, [R]: clone(original[R]) };
    for (const root of [D,M,H,F,O]) rules[root] = { '.read': 'auth != null', '.write': false };
    return { rules };
}

function clean(value) {
    if (!value || typeof value !== 'object') return value ?? null;
    const entries = Object.entries(value).map(([key, child]) => [key, clean(child)]).filter(([, child]) => child !== null);
    return entries.length ? Object.fromEntries(entries) : null;
}
function at(value, parts) { for (const part of parts) value = value && typeof value === 'object' && Object.hasOwn(value, part) ? value[part] : null; return value ?? null; }
function applyAtomic(before, updates) {
    let after = clone(before);
    for (const [key, value] of Object.entries(updates)) {
        const parts = key.split('/'); let cursor = after;
        for (const part of parts.slice(0,-1)) { if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = {}; cursor = cursor[part]; }
        if (value === null) delete cursor[parts.at(-1)]; else cursor[parts.at(-1)] = clone(value);
    }
    return clean(after) || {};
}
function rulesVerdict(policy, before, updates, uid = UID) {
    const acorn = require(path.join(REPO, 'ZoeW/node_modules/acorn'));
    const pre = clean(before) || {}, post = applyAtomic(pre, updates), parsed = new Map(), errors = [], decisions = [];
    const sentinel = Symbol('native-object-sentinel');
    class Snap {
        constructor(tree, parts) { this.tree = tree; this.parts = parts; }
        child(key) { if (typeof key !== 'string') throw new Error('Non-string child argument'); return new Snap(this.tree, this.parts.concat(key.split('/').filter(Boolean))); }
        parent() { if (!this.parts.length) throw new Error('Root has no parent'); return new Snap(this.tree, this.parts.slice(0,-1)); }
        value() { return at(this.tree, this.parts); }
        val() { const value = this.value(); return value && typeof value === 'object' ? sentinel : value; }
        exists() { return this.value() !== null; }
        isString() { return typeof this.value() === 'string'; }
        isNumber() { return typeof this.value() === 'number' && Number.isFinite(this.value()); }
        isBoolean() { return typeof this.value() === 'boolean'; }
        hasChildren(keys) { const value = this.value(); return !!value && typeof value === 'object' && (keys ? keys.every(key => this.child(key).exists()) : Object.keys(value).length > 0); }
    }
    function resolve(parts) {
        let rule = policy.rules, scope = {};
        for (const part of parts) {
            if (!rule || typeof rule !== 'object') return { rule: null, scope };
            const key = Object.hasOwn(rule, part) ? part : Object.keys(rule).find(key => key.startsWith('$'));
            if (!key) return { rule: null, scope };
            if (key.startsWith('$')) scope[key] = part;
            rule = rule[key];
        }
        return { rule, scope };
    }
    function expression(node, env) {
        if (node.type === 'Literal') {
            if(node.regex&&!['','i'].includes(node.regex.flags))throw new Error('Unsupported native-fixture regex flags');
            return node.regex ? new RegExp(node.regex.pattern, node.regex.flags) : node.value;
        }
        if (node.type === 'Identifier') { if (Object.hasOwn(env, node.name)) return env[node.name]; throw new Error('Unknown identifier ' + node.name); }
        if (node.type === 'ArrayExpression') return node.elements.map(child => expression(child, env));
        if (node.type === 'UnaryExpression') { const value = expression(node.argument, env); if (node.operator === '!') return !value; if (node.operator === '-') return -value; }
        if (node.type === 'LogicalExpression') { const left = expression(node.left, env); return node.operator === '&&' ? left && expression(node.right, env) : left || expression(node.right, env); }
        if (node.type === 'BinaryExpression') {
            const left = expression(node.left, env), right = expression(node.right, env);
            switch (node.operator) {
                case '===': case '==': return left === right; case '!==': case '!=': return left !== right;
                case '+': return left + right; case '-': return left - right; case '%': return left % right;
                case '>': return left > right; case '>=': return left >= right; case '<': return left < right; case '<=': return left <= right;
            }
        }
        if (node.type === 'MemberExpression' && !node.computed) {
            const value = expression(node.object, env), name = node.property.name;
            if (name === 'uid' && value === env.auth) return value.uid;
            if (name === 'length' && typeof value === 'string') return value.length;
            throw new Error('Unsupported property ' + name);
        }
        if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed) {
            const receiver = expression(node.callee.object, env), name = node.callee.property.name, args = node.arguments.map(child => expression(child, env));
            if (receiver instanceof Snap && ['child','parent','val','exists','isString','isNumber','isBoolean','hasChildren'].includes(name)) return receiver[name](...args);
            if (typeof receiver === 'string') {
                if (name === 'matches' && args[0] instanceof RegExp) return args[0].test(receiver);
                if (name === 'replace' && args.length === 2 && args.every(value => typeof value === 'string')) return receiver.split(args[0]).join(args[1]);
                if (name === 'toUpperCase' && args.length === 0) return receiver.toUpperCase();
            }
            throw new Error('Unsupported fixed-fixture method ' + name);
        }
        throw new Error('Unsupported fixed-fixture AST ' + node.type);
    }
    function evaluate(value, parts, scope, type) {
        if (typeof value === 'boolean') return value;
        try {
            if (!parsed.has(value)) parsed.set(value, acorn.parse('('+value+'\n)', { ecmaVersion: 'latest' }).body[0].expression);
            const result = expression(parsed.get(value), { ...scope, auth: uid === null ? null : { uid }, root: new Snap(pre, []), data: new Snap(pre, parts), newData: new Snap(post, parts) });
            decisions.push({ path: parts.join('/'), type, pass: result === true, expressionHash: digest(value) }); return result === true;
        } catch (error) { errors.push({ path: parts.join('/'), type, message: error.message, expressionHash: digest(value) }); return false; }
    }
    let allowed = true;
    const validate = parts => {
        const value = at(post, parts); if (value === null) return true;
        const { rule, scope } = resolve(parts);
        if (rule && Object.hasOwn(rule, '.validate') && !evaluate(rule['.validate'], parts, scope, 'validate')) return false;
        return !value || typeof value !== 'object' || Object.keys(value).every(key => validate(parts.concat(key)));
    };
    for (const key of Object.keys(updates)) {
        const parts = key.split('/'); let granted = false;
        for (let depth = 0; depth <= parts.length; depth++) {
            const prefix = parts.slice(0,depth), { rule, scope } = resolve(prefix);
            if (rule && Object.hasOwn(rule, '.write') && evaluate(rule['.write'], prefix, scope, 'write')) { granted = true; break; }
        }
        if (!granted) { allowed = false; break; }
        for (let depth = 0; depth < parts.length; depth++) {
            const prefix = parts.slice(0,depth), { rule, scope } = resolve(prefix);
            if (at(post,prefix) !== null && rule && Object.hasOwn(rule,'.validate') && !evaluate(rule['.validate'],prefix,scope,'validate')) allowed = false;
        }
        if (!allowed || !validate(parts)) { allowed = false; break; }
    }
    return { allowed: allowed && errors.length === 0, evaluationErrors: errors, decisions, post, model: 'Fixed-fixture AST model only; native semantics UNRUN' };
}
function makeFixture(count = 2, options = {}) {
    const id = 'ordinal_group', slots = options.slots || Array.from({ length: count }, (_, i) => String(i));
    const row = { id, count, cod: count, dod: 0, price: count, phone: '012345678', createdAt: 1700000000000,
        deletedAt: 1790000000000, trashGeneration: 1, barcodes: {} };
    const seed = { [T]: { [id]: row }, [R]: {}, [P]: {}, [G]: {}, [O]: {}, [F]: {},
        [H]: { protected_history: { count: 1, cod: 37, barcode: 'KEEP_HISTORY' } },
        [D]: { '2026-10-01': { codDollar: 37, dodDollar: 5, totalCount: 11 } },
        [M]: { '2026-10': { codDollar: 37, dodDollar: 5, totalCount: 11 } } };
    for (const [i, slot] of slots.entries()) {
        const code = options.longCode ? 'F03_' + String(i).padStart(8,'0') + '_' + 'X'.repeat(243) : 'ORDINAL_CODE_' + slot;
        const registryKey=currentPublicContracts().canonicalBarcodeRegistryKey(code);
        const barcode = { code, cod: 1, dod: 0, createdAt: row.createdAt + i, isClosed: false };
        if (options.originalActor && i === 0) {
            barcode.scanIntent = 'scan_' + digest('original:' + id + ':' + slot).slice(0,32);
            seed[R][registryKey] = { v: 2, intent: barcode.scanIntent, actorUid: ORIGINAL_UID, birth: barcode.createdAt };
            seed[O][barcode.scanIntent] = { id: barcode.scanIntent, actorUid: ORIGINAL_UID, code, registryKey,
                birth: barcode.createdAt, phase: 'committed' };
        } else seed[R][registryKey] = true;
        row.barcodes[slot] = barcode;
    }
    if (options.array) {
        const array = []; for (const [slot,value] of Object.entries(row.barcodes)) array[Number(slot)] = value; row.barcodes = array;
    }
    return { row, seed, uid: options.uid || UID };
}
function makePacket(row, uid = UID) {
    const entries = Object.entries(row.barcodes).filter(([, value]) => value !== null && value !== undefined);
    const generation=row.trashGeneration??0,rowBirth=row.createdAt??0;
    const consumption = { v: 2, sourceId: row.id, generation, kind: 'purge', actorUid: uid, scope: SCOPE,
        deletedAt: row.deletedAt, rowBirth, count: row.count, order: {}, members: {}, byKey: {} };
    const updates = {}, oldOps = [{ k: 'set', p: [T,row.id], v: null }, { k: 'set', p: [G,row.id], v: {
        v: 1, sourceId: row.id, generation, kind: 'purge', actorUid: uid, scope: SCOPE,
        deletedAt: row.deletedAt, rowBirth } }];
    for (const [i,[slot,barcode]] of entries.entries()) {
        const id = barcode.scanIntent || 'release_' + digest(row.id + ':' + slot).slice(0,32);
        const receipt = { v: 2, id, generation, kind: barcode.scanIntent ? 'scan' : 'legacy',
            actorUid: barcode.scanIntent ? ORIGINAL_UID : uid, releasedBy: uid, scope: SCOPE, code: barcode.code, registryKey: currentPublicContracts().canonicalBarcodeRegistryKey(barcode.code),
            birth: barcode.createdAt??0, trashId: row.id, slot, deletedAt: row.deletedAt, rowBirth, rowCount: row.count };
        consumption.order[String(i)] = slot; consumption.members[slot] = { ordinal: i, id }; consumption.byKey[receipt.registryKey] = id;
        updates[T + '/' + row.id + '/barcodes/' + slot] = null;
        updates[R + '/' + receipt.registryKey] = null; updates[P + '/' + id] = receipt;
        oldOps.push({ k: 'set', p: [R,receipt.registryKey], v: null }, { k: 'set', p: [P,id], v: clone(receipt) });
    }
    for (const key of Object.keys(row)) if (key !== 'barcodes') updates[T + '/' + row.id + '/' + key] = null;
    updates[G + '/' + row.id] = consumption;
    return { updates, consumption, oldOps, metadataDeletes: Object.keys(row).length - 1 };
}
function scenarios() {
    const cases = [], add = (id, configure, allowed = false, options = {}) => {
        const value = makeFixture(options.count || 2, options), packet = makePacket(value.row, value.uid);
        if (configure) configure(value, packet);
        cases.push({ id, expectedAllowed: allowed, ...value, packet });
    };
    add('legitimate-1', null, true, { count: 1 }); add('legitimate-2', null, true);
    add('noncontiguous-0-7-15', null, true, { count: 3, slots: ['0','7','15'] });
    add('array-container', null, true, { array: true }); add('cross-original-claim-actor', null, true, { originalActor: true });
    add('unsupported-prior-incarnation-restore-G', (v,p) => {
        v.row.trashGeneration = 2;
        v.seed[G][v.row.id]={v:1,sourceId:v.row.id,generation:1,kind:'restore',actorUid:ORIGINAL_UID,scope:SCOPE,deletedAt:v.row.deletedAt-1000,rowBirth:v.row.createdAt-1000,token:'prior-token',targetId:'prior-target'};
        Object.assign(p,makePacket(v.row,v.uid));
    });
    cases.at(-1).compatibility = 'Current canonical trashSourceUnconsumed permits next generation; prototype fresh-G restriction HOLD';
    add('unsupported-legacy-absent-generation-births', (v,p) => {
        delete v.row.trashGeneration;delete v.row.createdAt;for(const barcode of Object.values(v.row.barcodes))delete barcode.createdAt;
        Object.assign(p,makePacket(v.row,v.uid));
    });
    cases.at(-1).compatibility='Current public legacy zero fallbacks permit absent generation/births; prototype explicit-fields-only HOLD';
    add('unsupported-valid-settled-pricePending', (v,p) => {
        v.row.pricePending={token:'price_'+digest('settled-price').slice(0,32),actorUid:UID,code:v.row.barcodes['0'].code,slot:'0',birth:v.row.barcodes['0'].createdAt,rowBirth:v.row.createdAt,
            scanDate:'2026-10-01',priorCod:1,priorDod:0,wantCod:1,wantDod:0,phase:'settled',outcome:'compensated'};
        Object.assign(p,makePacket(v.row,v.uid));
    });
    cases.at(-1).compatibility='Current valid settled-price marker is not active per rowOperationActive; prototype any-pricePending restriction HOLD (source-read supported)';
    add('omitted-whole-member-and-pair', (v,p) => {
        const member = p.consumption.members['1'], code = v.row.barcodes['1'].code;
        delete p.updates[T+'/'+v.row.id+'/barcodes/1']; delete p.updates[P+'/'+member.id]; delete p.updates[R+'/'+code];
    });
    add('omitted-release-and-registry-pair', (v,p) => { const member = p.consumption.members['1']; delete p.updates[P+'/'+member.id]; delete p.updates[R+'/'+v.row.barcodes['1'].code]; });
    add('count2-actual3-original-shape', (v,p) => {
        v.row.barcodes['2'] = { code: 'ORDINAL_EXTRA', cod: 1, dod: 0, createdAt: v.row.createdAt + 2, isClosed: false }; v.seed[R].ORDINAL_EXTRA = true;
        for (const key of Object.keys(p.updates)) if (key.startsWith(T+'/')) delete p.updates[key]; p.updates[T+'/'+v.row.id] = null;
    });
    add('count2-actual3-new-shape', (v,p) => {
        v.row.barcodes['2'] = { code: 'ORDINAL_EXTRA', cod: 1, dod: 0, createdAt: v.row.createdAt + 2, isClosed: false }; v.seed[R].ORDINAL_EXTRA = true;
        p.updates[T+'/'+v.row.id+'/barcodes/2'] = null;
    });
    add('discontinuous-order', (v,p) => { delete p.consumption.order['1']; });
    add('count3-actual2-consistent-gap', (v,p) => {
        v.row.count=3;p.consumption.count=3;p.consumption.order={'0':'0','2':'1'};p.consumption.members['1'].ordinal=2;
        for(const value of Object.values(p.updates))if(value&&typeof value==='object'&&value.trashId===v.row.id)value.rowCount=3;
    });
    add('cyclic-order', (v,p) => { p.consumption.order['1'] = '0'; });
    add('duplicate-ordinal', (v,p) => { p.consumption.members['1'].ordinal = 0; });
    add('extra-leading-zero-order', (v,p) => { p.consumption.order['01'] = p.consumption.order['1']; });
    add('fake-descendant-successor', (v,p) => { p.consumption.order['1'] = '0/code'; });
    add('duplicate-canonical-key', (v,p) => { v.row.barcodes['1'].code = v.row.barcodes['0'].code; const id=p.consumption.members['1'].id; p.updates[P+'/'+id].code=v.row.barcodes['0'].code; p.updates[P+'/'+id].registryKey=v.row.barcodes['0'].code; });
    add('borrowed-G-without-write', (v,p) => { v.seed[G][v.row.id] = clone(p.consumption); delete p.updates[G+'/'+v.row.id]; });
    add('reused-G-with-write', (v,p) => { v.seed[G][v.row.id] = clone(p.consumption); });
    add('borrowed-nonanchor-P-without-write', (v,p) => { const id=p.consumption.members['1'].id; v.seed[P][id]=clone(p.updates[P+'/'+id]); delete p.updates[P+'/'+id]; });
    add('altered-member-complete-packet', (v,p) => { p.consumption.members['1'].id=p.consumption.members['0'].id; });
    add('altered-byKey-complete-packet', (v,p) => { p.consumption.byKey[v.row.barcodes['0'].code]=p.consumption.members['1'].id; });
    add('cross-actor-intent', (v,p) => { p.consumption.actorUid = 'different-captured-actor'; });
    add('cross-generation', (v,p) => { p.consumption.generation = 2; });
    add('raw-T-root-delete', (v,p) => { for(const key of Object.keys(p.updates))if(key.startsWith(T+'/'))delete p.updates[key];p.updates[T+'/'+v.row.id]=null; });
    add('raw-barcodes-root-delete', (v,p) => { for(const key of Object.keys(p.updates))if(key.startsWith(T+'/'+v.row.id+'/barcodes/'))delete p.updates[key];p.updates[T+'/'+v.row.id+'/barcodes']=null; });
    add('restore-controller-before-admission', (v,p) => {
        v.initialSeed=clone(v.seed);v.row.restoreClaim={token:'held-token',targetId:'restore-target'};
        v.controllerPatch={[T+'/'+v.row.id+'/restoreClaim']:clone(v.row.restoreClaim)};v.controllerType='ordinary-second-authenticated-sdk';
    });
    add('newholder-controller-before-admission', (v,p) => {
        v.initialSeed=clone(v.seed);const intent='scan_'+digest('newholder').slice(0,32),key=v.row.barcodes['0'].code;
        const holder={v:2,intent,actorUid:'newholder',birth:v.row.createdAt+999};
        const operation={id:intent,actorUid:'newholder',birth:holder.birth,code:key,registryKey:key,phase:'committed'};
        v.seed[R][key]=holder;v.seed[O][intent]=operation;v.controllerPatch={[R+'/'+key]:holder,[O+'/'+intent]:operation};v.controllerType='owned-synthetic-holder-fixture';
    });
    add('protected-money-write', (v,p) => { p.updates[D+'/2026-10-01/codDollar']=0; });
    add('protected-history-write', (v,p) => { p.updates[H+'/protected_history']=null; });
    add('missing-metadata-delete', (v,p) => { delete p.updates[T+'/'+v.row.id+'/phone']; });
    add('restore-kind-cannot-borrow-ancestor', (v,p) => { p.consumption.kind='restore'; for(const key of Object.keys(p.updates))if(key.startsWith(T+'/'))delete p.updates[key];p.updates[T+'/'+v.row.id]=null; });
    const restore = makeFixture(2); restore.row.restoreClaim={token:'restore-token',targetId:'restore-target'};
    restore.seed[F][restore.row.id]={token:'restore-token',targetId:'restore-target'};
    restore.seed[H]['restore-target']={restoreClaimId:restore.row.id,count:2};
    const gc={v:2,sourceId:restore.row.id,generation:1,kind:'restore',actorUid:UID,scope:SCOPE,deletedAt:restore.row.deletedAt,rowBirth:restore.row.createdAt,token:'restore-token',targetId:'restore-target'};
    cases.push({id:'strict-restore-exception-control',expectedAllowed:true,...restore,packet:{updates:{[T+'/'+restore.row.id]:null,[G+'/'+restore.row.id]:gc}}});
    for(const count of [249,250,251])add('legitimate-'+count,null,true,{count});
    return cases;
}
function originalJournalGate(storage) {
    if (!storage) return true;
    for(let i=0;i<storage.length;i++)if(String(storage.key(i)).startsWith('zoew_connection_writes_v1:'))return false;
    return true;
}
function packetBytes(packet) {
    const newOps=Object.entries(packet.updates).map(([key,value])=>({k:'set',p:key.split('/'),v:value}));
    return { oldOpsUtf8: packet.oldOps ? Buffer.byteLength(JSON.stringify(packet.oldOps)) : null,
        oldWireUtf8: packet.oldOps ? Buffer.byteLength(JSON.stringify(Object.fromEntries(packet.oldOps.map(op=>[op.p.join('/'),op.v])))) : null,
        newOpsUtf8: Buffer.byteLength(JSON.stringify(newOps)),newWireUtf8:Buffer.byteLength(JSON.stringify(packet.updates)),
        oldOperations:packet.oldOps?.length??null,newOperations:newOps.length,cap:MAX_BYTES,
        newWithinCap:Buffer.byteLength(JSON.stringify(newOps))<=MAX_BYTES&&Buffer.byteLength(JSON.stringify(packet.updates))<=MAX_BYTES };
}
let contracts = null;
function currentPublicContracts() {
    if (contracts) return contracts;
    const ts = require(path.join(REPO,'ZoeW/node_modules/typescript')), modules = new Map();
    const allowed = new Set(['barcode-key','trash-generation','registry-purge-proof']);
    const load = name => {
        name=path.basename(name); if(!allowed.has(name))throw new Error('Unexpected public-contract dependency');
        if(modules.has(name))return modules.get(name).exports;
        const module={exports:{}}; modules.set(name,module);
        const source=fs.readFileSync(path.join(ROOT,'ZoeW/src/domain',name+'.ts'),'utf8');
        const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
        vm.runInNewContext(code,{module,exports:module.exports,require:load,TextEncoder,crypto:crypto.webcrypto},{filename:name+'.ts'});
        return module.exports;
    };
    const priceFile=path.join(ROOT,'ZoeW/src/services/row-operation-lock.ts'),priceSource=ts.createSourceFile(priceFile,fs.readFileSync(priceFile,'utf8'),ts.ScriptTarget.Latest,true);
    const selected=new Set(['immutableKeys','textBound','birthValid','priceValid','priceOperationMarkerValid','rowOperationActive']),parts=[];
    for(const statement of priceSource.statements){
        if(ts.isFunctionDeclaration(statement)&&selected.has(statement.name?.text)||ts.isVariableStatement(statement)&&statement.declarationList.declarations.some(declaration=>selected.has(declaration.name.getText(priceSource))))parts.push(statement.getText(priceSource).replace(/^export\s+/,''));
    }
    const priceModule={exports:{}},priceCode=ts.transpileModule(parts.join('\n')+'\nmodule.exports={priceOperationMarkerValid,rowOperationActive};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
    vm.runInNewContext(priceCode,{module:priceModule,exports:priceModule.exports},{filename:'scoped-current-row-operation-lock.ts'});
    contracts={...load('registry-purge-proof'),...load('trash-generation'),...load('barcode-key'),...priceModule.exports}; return contracts;
}
function budgetStudy() {
    const publicApi=currentPublicContracts(), measured=[];
    const measure=count=>{
        if(!memoryWithinBudget(memorySample('byte-study')))throw new Error('Prototype resource HOLD before budget materialization');
        const fixture=makeFixture(count,{longCode:true}), packet=makePacket(fixture.row), bytes=packetBytes(packet);
        return {count,...bytes,oldAcceptedByCurrentPublicBoundedHelper:!!publicApi.boundedRegistryPurgeIntent(packet.oldOps)};
    };
    for(const count of [249,250,251])measured.push(measure(count));
    let low=1,high=2;
    while(measure(high).oldAcceptedByCurrentPublicBoundedHelper){low=high;high*=2;}
    while(high-low>1){const middle=Math.floor((low+high)/2);if(measure(middle).oldAcceptedByCurrentPublicBoundedHelper)low=middle;else high=middle;}
    const boundary=measure(low), next=measure(high);
    return {status:'SOURCE_ONLY_BYTE_STUDY',capBytes:MAX_BYTES,measured,oldLastAccepted:boundary,oldFirstRejected:next,
        newUnsupportedOldAdmittedSubset:boundary.oldAcceptedByCurrentPublicBoundedHelper&&!boundary.newWithinCap,
        policy:'Same4MiB numeric cap; extra leaf/proof bytes can reject previously admitted groups. No cap raise or arbitrary group-count limit.',
        scope:'Exact UTF8 logical operation and SDK update-data JSON; network envelope, native acceptance and production compatibility unproved'};
}
async function bounded(work, label, ms=WAIT_MS) {
    const started=process.hrtime.bigint();let timer;
    try {const value=await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Deadline: '+label)),ms);})]);
        if(Number(process.hrtime.bigint()-started)/1e6>ms)throw new Error('Deadline: '+label);return value;
    }finally{clearTimeout(timer);}
}
function nativeSettlementWithinDeadline(fulfilled,rejected,elapsedMs) {
    return fulfilled!==rejected&&typeof fulfilled==='boolean'&&typeof rejected==='boolean'&&Number.isFinite(elapsedMs)&&elapsedMs>=0&&elapsedMs<=WAIT_MS;
}
function ownedOrigin(raw) {
    const origin=new URL(raw);
    if(origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||!Number.isInteger(Number(origin.port))||Number(origin.port)<=0)throw new Error('Only explicit owned loopback origin permitted');
    return origin;
}
function prototypeLoadOutcome(result) {
    if(result.status===200)return 'LOADED';
    if(result.status===400&&typeof result.value?.error==='string'&&result.value.error.length>0)return 'DEFINITE_REJECTED';
    return 'UNKNOWN';
}
function ownerHttp(origin, namespace, node='', method='GET', value) {
    ownedOrigin(origin.href);
    const url=new URL(origin.origin+'/'+node.split('/').map(encodeURIComponent).join('/')+'.json');url.searchParams.set('ns',namespace);
    if(!/^demo-f03-ordinal-[a-z0-9-]+$/.test(namespace)||url.origin!==origin.origin)throw new Error('Unowned prototype namespace');
    return new Promise((resolve,reject)=>{
        let settled=false;const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else resolve(result);};
        const request=http.request(url,{method,headers:{Authorization:'Bearer owner','content-type':'application/json'},timeout:WAIT_MS},response=>{
            let text='';response.on('data',chunk=>{text+=chunk;});response.on('error',error=>finish(error));response.on('aborted',()=>finish(new Error('Owned response aborted')));
            response.on('end',()=>{try{finish(null,{status:response.statusCode,value:text?JSON.parse(text):null});}catch(error){finish(error);}});
        });
        const timer=setTimeout(()=>request.destroy(new Error('Owned prototype HTTP deadline')),WAIT_MS);
        request.on('error',error=>finish(error));request.on('timeout',()=>request.destroy(new Error('Owned prototype HTTP deadline')));
        if(value!==undefined)request.write(JSON.stringify(value));request.end();
    });
}
function protectedImage(value) {return Object.fromEntries([D,M,H,F,O].map(root=>[root,clean(value?.[root])||null]));}
async function nativeCase(test, origin, policy, sdk, deadline, checkpoint=()=>{}) {
    const {emuNamespace}=require(path.join(REPO,'audit-tools/emu/ns.js')), namespace=emuNamespace('demo-f03-ordinal');
    const row={id:test.id,namespace,expectedAllowed:test.expectedAllowed,experimental:true,canonicalProof:false,cleanup:false,uncertain:false,
        controller:test.controllerType||null,compatibility:test.compatibility||null,checks:[],resources:{requestsStarted:0,requestsSettled:0,pendingRequests:0,sdkWrites:0,sdkSettled:0,controllerWrites:0,controllerSettled:0,appsStarted:0,appsClosed:0},memory:[]};
    let app=null, controllerApp=null, seeded=false, loaded=false, work=null,beforeSnapshot=null,afterSnapshot=null,outcomeObserved=false;
    const ownedApps=[];
    const sample=phase=>{const memory=memorySample(phase);row.memory.push(memory);if(!memoryWithinBudget(memory))throw new Error('Prototype512MiB observed RSS HOLD');};
    const request=async(node,method,value)=>{
        if(Date.now()>=deadline)throw new Error('Prototype90s phase budget');
        row.resources.requestsStarted++;row.resources.pendingRequests++;
        try{return await ownerHttp(origin,namespace,node,method,value);}catch(error){row.uncertain=true;throw error;}finally{row.resources.requestsSettled++;row.resources.pendingRequests--;}
    };
    const successful=async(node,method,value)=>{const result=await request(node,method,value);if(result.status!==200){row.uncertain=true;throw new Error('Owned prototype HTTP '+result.status);}return result.value;};
    const open=uid=>{
        const value=sdk.app.initializeApp({projectId:'demo-f03-ordinal',databaseURL:origin.origin+'/?ns='+namespace},namespace+'-'+uid);
        const owned={app:value,db:null,closed:false};ownedApps.push(owned);row.resources.appsStarted++;
        owned.db=sdk.database.getDatabase(value);sdk.database.connectDatabaseEmulator(owned.db,'127.0.0.1',Number(origin.port),{mockUserToken:{sub:uid,user_id:uid}});return owned;
    };
    const closeOwned=async value=>{
        if(value.closed)return;let offlineFailure=false;
        try{if(value.db)sdk.database.goOffline(value.db);}catch(error){offlineFailure=true;row.offlineError=error?.message??String(error);}
        await bounded(sdk.app.deleteApp(value.app),'close prototype SDK only');value.closed=true;row.resources.appsClosed++;
        if(offlineFailure)throw new Error('Owned SDK offline transition failed');
    };
    const check=(name,pass)=>{row.checks.push({name,pass:!!pass});if(!pass)throw new Error('Prototype assertion: '+name);};
    try {
        sample('before-load');const freshRoot=await successful('','GET');if(freshRoot!==null)row.uncertain=true;check('fresh-owned-root-empty',freshRoot===null);
        const load=await request('.settings/rules','PUT',policy),loadOutcome=prototypeLoadOutcome(load);row.rulesLoad={httpStatus:load.status,outcome:loadOutcome,policyHash:digest(JSON.stringify(policy)),role:'EXPERIMENTAL_ONLY_NOT_CANONICAL'};
        if(loadOutcome!=='LOADED'){row.rulesLoad.parserResponse=load.value;if(loadOutcome!=='DEFINITE_REJECTED')row.uncertain=true;throw new Error('Experimental policy load rejected '+load.status);}
        loaded=true;await successful('','PUT',test.initialSeed||test.seed);seeded=true;
        if(test.controllerPatch){
            if(test.controllerType==='ordinary-second-authenticated-sdk'){
                if(Date.now()+WAIT_MS>=deadline)throw new Error('Prototype90s phase HOLD before controller intent');
                controllerApp=open('ordinal-second-user');row.resources.controllerWrites++;
                const controlled=Promise.resolve().then(()=>sdk.database.update(sdk.database.ref(controllerApp.db),test.controllerPatch));
                controlled.then(()=>{row.resources.controllerSettled++;},()=>{row.resources.controllerSettled++;});
                try{await bounded(controlled,'ordinary restore controller');}catch(error){if(row.resources.controllerSettled!==row.resources.controllerWrites||!/permission[_-]denied/i.test(error?.code||''))row.uncertain=true;throw error;}
                await closeOwned(controllerApp);controllerApp=null;
            }else await successful('','PATCH',test.controllerPatch);
            check('controlled-intervening-state-exact',equal(clean(await successful('','GET')),clean(test.seed)));
        }
        const before=clean(await successful('','GET'))||{}, expected=rulesVerdict(policy,before,test.packet.updates,test.uid), bytes=packetBytes(test.packet);
        beforeSnapshot=before;
        row.beforeHash=digest(JSON.stringify(before));row.packet=bytes;row.patchHash=digest(JSON.stringify(test.packet.updates));row.modelAllowed=expected.allowed;
        check('source-model-matches-finite-case-without-errors',expected.allowed===test.expectedAllowed&&expected.evaluationErrors.length===0);
        check('original-money-history-sentinels-nonempty',before[D]?.['2026-10-01']?.codDollar===37&&before[M]?.['2026-10']?.totalCount===11&&!!before[H]?.protected_history);
        if(!bytes.newWithinCap){row.status='HOLD_NEW_ENVELOPE';row.compatibility='New packet outside unchanged4MiB envelope';return row;}
        if(Date.now()+WAIT_MS>=deadline)throw new Error('Prototype90s phase HOLD before atomic intent');
        app=open(test.uid);sample('before-sdk-update');row.resources.sdkWrites++;row.startedUtc=new Date().toISOString();const start=process.hrtime.bigint();
        let fulfilled=false,rejected=false,rejection;
        work=Promise.resolve().then(()=>sdk.database.update(sdk.database.ref(app.db),test.packet.updates));
        work.then(()=>{fulfilled=true;row.resources.sdkSettled++;},error=>{rejected=true;rejection=error;row.resources.sdkSettled++;});
        try{await bounded(work,'ordinary prototype atomic15s');}catch(error){if(!rejected||error!==rejection){row.uncertain=true;row.elapsedMs=Number(process.hrtime.bigint()-start)/1e6;throw error;}}
        row.elapsedMs=Number(process.hrtime.bigint()-start)/1e6;sample('after-sdk-settlement');
        if(!nativeSettlementWithinDeadline(fulfilled,rejected,row.elapsedMs)){row.uncertain=true;throw new Error('Prototype measured15s deadline');}
        row.fulfilled=fulfilled;row.rejectionKind=rejection===null?'null':typeof rejection;row.backendCode=typeof rejection?.code==='string'?rejection.code:null;
        if(!fulfilled&&(!rejected||!/permission[_-]denied/i.test(row.backendCode||''))){row.uncertain=true;throw new Error('Unclassified prototype outcome');}
        const after=clean(await successful('','GET'))||{};row.afterHash=digest(JSON.stringify(after));
        afterSnapshot=after;
        row.exactZeroEffects=equal(before,after);row.exactRequestedEffects=equal(after,expected.post);row.moneyHistoryConserved=equal(protectedImage(before),protectedImage(after));
        if(fulfilled&&!row.exactRequestedEffects||!fulfilled&&!row.exactZeroEffects){row.uncertain=true;throw new Error('Prototype mixed effects HOLD');}
        outcomeObserved=true;
        check('ordinary-auth-outcome-matches-case',fulfilled===test.expectedAllowed);
        check('atomic-complete-effects-or-exact-zero-effects',test.expectedAllowed?row.exactRequestedEffects:row.exactZeroEffects);
        check('money-history-operation-sentinels-conserved',row.moneyHistoryConserved);
        row.status='PASS_EXPERIMENTAL_CASE';
    }catch(error){row.status=row.uncertain?'HOLD_UNKNOWN':'FAIL';row.error=error?.message??String(error);
        if(row.resources.sdkWrites&&(!row.resources.sdkSettled||!outcomeObserved))row.uncertain=true;
        if(row.uncertain)row.status='HOLD_UNKNOWN';
        row.retainedOriginal={seed:test.seed,before:beforeSnapshot,after:afterSnapshot,updates:test.packet.updates,legacyJournalReplayed:false,rootEmpty:row.uncertain?'UNPROVEN':'KNOWN_SETTLED_FIXTURE'};
        checkpoint(row);
    }finally{
        for(const value of ownedApps)if(!value.closed){try{await closeOwned(value);}catch(error){row.uncertain=true;row.closeError=error.message;}}
        if(!row.uncertain&&row.resources.sdkWrites===row.resources.sdkSettled&&row.resources.controllerWrites===row.resources.controllerSettled){
            try{
                if(seeded||loaded||row.rulesLoad?.outcome==='DEFINITE_REJECTED'){await successful('.settings/rules','PUT',{rules:{'.read':false,'.write':false}});await successful('','DELETE');check('owned-root-empty-after-known-quiescent-cleanup',await successful('','GET')===null);}
                row.cleanup=true;
            }catch(error){row.uncertain=true;row.cleanupError=error.message;}
        }
        row.canContinue=row.status==='PASS_EXPERIMENTAL_CASE'&&row.cleanup&&!row.uncertain&&row.resources.pendingRequests===0&&row.resources.requestsStarted===row.resources.requestsSettled&&row.resources.appsStarted===row.resources.appsClosed;
        if(row.uncertain){row.status='HOLD_UNKNOWN';row.canContinue=false;}
    }
    return row;
}
async function main() {
    process.exitCode=1;const strict=process.env.CRUD_FLOW_STRICT==='1'||process.env.RUNALL_STRICT==='1', fixturesOnly=process.argv.includes('--fixtures-only');
    const report={status:'INCOMPLETE',experimental:true,canonicalProof:false,productionClosure:false,sourceHash:digest(fs.readFileSync(__filename)),policyHash:null,
        nativeResults:[],nativeStatus:'UNRUN',pure:[],budgets:null,compatibilityHolds:[],deadlines:{writeMs:WAIT_MS,phaseMs:PHASE_MS,ownedOuterMs:300000,outerEnforcement:'Owned CI supervisor required; not established by this source-only run',rssLimit:RSS_LIMIT},sqlReplacement:false};
    const persist=()=>{const file=process.env.F03_ORDINAL_RESULT;if(file)try{fs.writeFileSync(path.resolve(file),JSON.stringify(report,null,2)+'\n');}catch(error){report.checkpointWriteFailure=error.message;}console.log(JSON.stringify(report));};
    try{
        if(fixturesOnly&&strict)throw new Error('Fixture-only cannot satisfy owned CI');
        if(!originalJournalGate(globalThis.window?.localStorage))throw new Error('Legacy UNKNOWN journal retained; prototype dispatch forbidden');
        const policy=JSON.parse(fs.readFileSync(path.join(ROOT,FIXTURE),'utf8'));report.policyHash=digest(JSON.stringify(policy));
        if(!equal(policy,prototypeRules()))throw new Error('Prototype fixture generator freshness failure');
        const cases=scenarios();report.expectedNativeCaseIds=cases.map(test=>test.id);for(const test of cases){const verdict=rulesVerdict(policy,test.seed,test.packet.updates,test.uid);report.pure.push({id:test.id,pass:verdict.allowed===test.expectedAllowed&&verdict.evaluationErrors.length===0,errors:verdict.evaluationErrors});}
        if(report.pure.some(row=>!row.pass))throw new Error('Fixed-fixture model failed');
        const current=currentPublicContracts();
        for(const prior of cases.filter(test=>test.compatibility)){
            const consumption=prior.seed[G]?.[prior.row.id]??null;
            const supported=current.trashSourceUnconsumed(prior.row,consumption)&&!!current.boundedRegistryPurgeIntent(prior.packet.oldOps)
                &&(!prior.row.pricePending||current.priceOperationMarkerValid(prior.row.pricePending)&&!current.rowOperationActive(prior.row));
            if(!supported)throw new Error('Compatibility control not in current public source contract: '+prior.id);
            report.compatibilityHolds.push({id:prior.id,reason:prior.compatibility,currentPublicSourceContract:true,nativeProductionAdmission:'UNRUN'});
        }
        report.budgets=budgetStudy();
        if(!report.budgets.newUnsupportedOldAdmittedSubset)throw new Error('Near4MiB added-byte compatibility control missing');
        report.compatibilityHolds.push({id:'unchanged4MiB-added-bytes',reason:report.budgets.policy});
        if(fixturesOnly){report.status='SOURCE_ONLY_NATIVE_UNRUN';process.exitCode=0;return;}
        if(!strict&&process.env.F03_ORDINAL_RUN_NATIVE!=='1'){console.log('SKIP — ordinal prototype native runtime not opted in');report.status='UNRUN';process.exitCode=0;return;}
        const origin=ownedOrigin(process.env.F03_ORDINAL_EMULATOR_URL||(strict?'http://127.0.0.1:9000':''));
        const sdk={app:require(path.join(REPO,'ZoeW/node_modules/firebase/app')),database:require(path.join(REPO,'ZoeW/node_modules/firebase/database'))};
        const deadline=Date.now()+PHASE_MS;report.nativeStatus='INCOMPLETE';
        for(const test of cases){
            if(Date.now()+WAIT_MS>=deadline)throw new Error('Prototype90s phase HOLD before new intent');
            const row=await nativeCase(test,origin,policy,sdk,deadline,active=>{report.activeNativeCheckpoint=active;persist();});report.activeNativeCheckpoint=null;report.nativeResults.push(row);persist();
            if(!row.canContinue)throw new Error('Prototype stopped after '+test.id+': '+row.status);
        }
        report.nativeStatus='EXECUTED_EXPERIMENTAL_CASES';report.status='PASS_EXPERIMENTAL_WITH_COMPATIBILITY_HOLDS';process.exitCode=0;
    }catch(error){report.status='FAIL_OR_HOLD_EXPERIMENTAL';report.error=error?.message??String(error);process.exitCode=1;}
    finally{report.unrunNativeCases=(report.expectedNativeCaseIds||[]).filter(id=>!report.nativeResults.some(row=>row.id===id));report.memory=memorySample('final');report.rssEnforcement='Observed Linux RSS+OS high-water mark; owned CI hard memory limit is externally required';persist();}
}

module.exports = { prototypeRules, rulesVerdict, applyAtomic, clean, makeFixture, makePacket, scenarios, originalJournalGate, packetBytes,
    currentPublicContracts,budgetStudy,nativeCase,ownedOrigin,bounded,nativeSettlementWithinDeadline,prototypeLoadOutcome,memorySample,memoryWithinBudget,
    constants: { T,R,P,G,H,F,O,D,M,MAX_BYTES,WAIT_MS,PHASE_MS,RSS_LIMIT,UID,ORIGINAL_UID,SCOPE,FIXTURE } };
if(require.main===module)main();
