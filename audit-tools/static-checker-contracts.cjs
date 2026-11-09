'use strict';
const path = require('path');
const acorn = require(require.resolve('acorn', { paths: [__dirname, path.join(__dirname, '../ZoeW')] }));
const parse = source => acorn.parse(source, { ecmaVersion: 'latest' });
function canonical(node) {
    if (Array.isArray(node)) return node.map(canonical);
    if (!node || typeof node !== 'object') return node;
    return Object.fromEntries(Object.entries(node).filter(([key]) => !['start', 'end', 'loc', 'raw'].includes(key)).map(([key, value]) => [key, canonical(value)]));
}
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const expression = source => parse('(' + source + ')').body[0].expression;
const statement = source => parse('function fixture() {' + source + '}').body[0].body.body[0];
function walk(node, visit, parents = []) {
    if (!node || typeof node.type !== 'string') return;
    visit(node, parents);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(child => walk(child, visit, [...parents, node]));
        else if (value && typeof value.type === 'string') walk(value, visit, [...parents, node]);
    }
}
function bindingNames(pattern) {
    if (!pattern) return [];
    if (pattern.type === 'Identifier') return [pattern.name];
    if (pattern.type === 'RestElement') return bindingNames(pattern.argument);
    if (pattern.type === 'AssignmentPattern') return bindingNames(pattern.left);
    if (pattern.type === 'ArrayPattern') return pattern.elements.flatMap(bindingNames);
    if (pattern.type === 'ObjectPattern') return pattern.properties.flatMap(property => bindingNames(property.type === 'RestElement' ? property.argument : property.value));
    return [];
}
function cleanupSelection(source) {
    const ast = parse(source); let updater = null;
    walk(ast, node => { if (node.type === 'VariableDeclarator' && node.id.name === 'cleanupUpdater') updater = node.init; });
    if (updater?.type !== 'ArrowFunctionExpression' || updater.body.type !== 'BlockStatement') return false;
    const body = updater.body.body;
    const bounds = body.findIndex(node => same(node, statement('const bounds = getServerClockBounds();')));
    if (bounds < 1 || !same(body[bounds - 1], statement('if (!clock.current()) return;'))
        || !same(body[bounds + 1], statement('if (!bounds) return;'))
        || !same(body[bounds + 2], statement('const ageNow = bounds.lowerMs;'))) return false;
    let selected = 0, complement = 0, wrong = false;
    const outerBindings = ['clock', 'getServerClockBounds', 'barcodeCloseIsRipe', 'claimable', 'collectedAllows'];
    const protectedNames = ['ageNow', 'bounds', ...outerBindings];
    const protectedBindings = new Map([['bounds', 0], ['ageNow', 0]]);
    walk(updater.body, node => {
        if (['FunctionDeclaration', 'ClassDeclaration'].includes(node.type) && protectedNames.includes(node.id?.name)) wrong = true;
        if (node.type === 'CatchClause' && bindingNames(node.param).some(name => protectedNames.includes(name))) wrong = true;
        if (node.type === 'VariableDeclarator') for (const name of bindingNames(node.id)) if (protectedBindings.has(name)) protectedBindings.set(name, protectedBindings.get(name) + 1);
        if (/Function/.test(node.type) && node.params?.some(parameter => bindingNames(parameter).some(name => protectedNames.includes(name)))) wrong = true;
        if (node.type === 'VariableDeclarator' && bindingNames(node.id).some(name => outerBindings.includes(name))) wrong = true;
        if (node.type === 'AssignmentExpression' && (bindingNames(node.left).some(name => protectedNames.includes(name))
            || node.left.type === 'MemberExpression' && ['bounds', 'clock'].includes(node.left.object.name))) wrong = true;
        if (node.type === 'AssignmentExpression') walk(node.left, target => {
            if (target.type === 'MemberExpression' && ['bounds', 'clock'].includes(target.object.name)) wrong = true;
        });
        if (node.type === 'UpdateExpression' && ['ageNow', 'bounds', 'clock'].includes(node.argument.name)) wrong = true;
        if (node.type === 'VariableDeclarator' && node.id.name === 'ripeClosed') {
            selected++;
            if (!same(node.init, expression('currentItem.barcodes.filter(b => barcodeCloseIsRipe(b, ageNow, cleanupMode) && claimable(b) && collectedAllows(currentItem, b))'))) wrong = true;
        }
        if (node.type === 'VariableDeclarator' && node.id.name === 'keptBarcodes') {
            complement++;
            if (!same(node.init, expression('currentItem.barcodes.filter(b => !ripeClosed.includes(b))'))) wrong = true;
        }
        if (node.type === 'CallExpression' && node.callee.name === 'barcodeCloseIsRipe' && node.arguments[0]?.name === 'currentItem') wrong = true;
    });
    return selected === 1 && complement === 1 && [...protectedBindings.values()].every(count => count === 1) && !wrong;
}
function dispatcherContract(source) {
    const ast = parse(source), fn = ast.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'act');
    if (!fn || !same(fn.params, expression('(name, ...args) => {}').params)) return false;
    const body = fn.body.body;
    if (body.length !== 4 || !same(body[0], statement('if (!sessionUserActionAllowed(name)) return;'))
        || !same(body[1], statement('const fn = lookupAction(name);'))
        || !same(body[3], statement('fn(...args);'))) return false;
    const guard = body[2];
    if (guard.type !== 'IfStatement' || guard.alternate || !same(guard.test, expression('!fn')) || guard.consequent.type !== 'BlockStatement') return false;
    const guarded = guard.consequent.body;
    if (guarded.at(-1)?.type !== 'ReturnStatement' || guarded.at(-1).argument) return false;
    // ការរាយការណ៍ក្នុង guard មិនអាចហៅសកម្មភាពមុន return បាន។
    let unsafe = false;
    walk(guard.consequent, node => {
        if (node.type === 'CallExpression' && !same(node.callee, expression('console.warn'))) unsafe = true;
        if (['AssignmentExpression', 'UpdateExpression', 'ThrowStatement'].includes(node.type)) unsafe = true;
    });
    return !unsafe;
}
function guaranteesMissing(test, name) {
    if (test.type === 'UnaryExpression' && test.operator === '!' && test.argument.type === 'Identifier' && test.argument.name === name) return true;
    return test.type === 'LogicalExpression' && test.operator === '||' && (guaranteesMissing(test.left, name) || guaranteesMissing(test.right, name));
}
function returns(node) {
    return node?.type === 'ReturnStatement' || node?.type === 'BlockStatement' && node.body.length === 1 && returns(node.body[0]);
}
function writes(node, name) {
    let found = false;
    walk(node, n => {
        if (['FunctionDeclaration', 'ClassDeclaration'].includes(n.type) && n.id?.name === name
            || n.type === 'VariableDeclarator' && bindingNames(n.id).includes(name)
            || n.type === 'AssignmentExpression' && bindingNames(n.left).includes(name)
            || n.type === 'UpdateExpression' && n.argument.name === name) found = true;
    });
    return found;
}
function onValueGuarded(call, parents) {
    const name = call.arguments[0]?.name;
    for (let i = parents.length - 1; i >= 0; i--) {
        const parent = parents[i], child = parents[i + 1] || call;
        if (['ForStatement', 'ForInStatement', 'ForOfStatement'].includes(parent.type) && writes(parent.init || parent.left, name)) return false;
        if (parent.type === 'CatchClause' && bindingNames(parent.param).includes(name)) return false;
        if (parent.type === 'IfStatement' && parent.consequent === child && parent.test.type === 'Identifier' && parent.test.name === name) return true;
        if (parent.type === 'BlockStatement' || parent.type === 'Program') {
            const at = parent.body.indexOf(child);
            if (at < 0) continue;
            if (parent.body.slice(at).some(statement => statement.type === 'VariableDeclaration' && statement.declarations.some(d => bindingNames(d.id).includes(name)))) return false;
            for (let j = at - 1; j >= 0; j--) {
                const prior = parent.body[j];
                if (prior.type === 'IfStatement' && !prior.alternate && guaranteesMissing(prior.test, name) && returns(prior.consequent)) return true;
                const declarations = prior.type === 'VariableDeclaration' ? prior.declarations : [];
                if (declarations.some(d => d.id.name === name && d.init?.type === 'CallExpression'
                    && d.init.callee.type === 'MemberExpression' && !d.init.callee.computed && d.init.callee.property.name === 'ref'
                    && ['fb', 'sdk'].includes(d.init.callee.object.name))) return true;
                if (writes(prior, name)) return false;
            }
        }
        if (/Function/.test(parent.type)) break;
    }
    return false;
}
module.exports = { bindingNames, cleanupSelection, dispatcherContract, onValueGuarded, walk, parse };

function sharedClockContract(clockModule, zoewFunction, keygenFunction) {
    const vm = require('vm'), assert = require('assert/strict');
    try {
        const ast = parse(clockModule), declarations = ast.body.filter(n => n.type === 'FunctionDeclaration' && n.id.name === 'getServerNow');
        if (declarations.length !== 1 || !same(declarations[0], parse(zoewFunction).body[0])) return false;
        let wall = 2000, monotonic = 100;
        const state = { db: {}, auth: null, serverTimeOffsetMs: 0, serverClockTrusted: false, sessionExpiryCheck: 'live', isDatabaseConnected: true };
        const context = { firebaseState: state, Date: { now: () => wall }, performance: { now: () => monotonic }, console };
        for (const key of Object.keys(state)) Object.defineProperty(context, key, { configurable: true, get: () => state[key], set: value => { state[key] = value; } });
        vm.createContext(context);
        vm.runInContext(clockModule, context);
        const sample = Object.freeze({ epochMs: 100000, estimateEpochMs: 100050, uncertaintyMs: 100, wallMs: wall, monotonicMs: monotonic });
        assert.equal(context.acceptServerClockOffset(98000, sample, false), true);
        assert.equal(context.getServerNow(), 100050);
        wall += 10; monotonic += 10.5;
        assert.equal(context.getServerNow(), 100060);
        assert.equal(context.serverClockIsTrustworthy(), true);
        monotonic = 99;
        assert.equal(context.getServerNow(), 100050);
        assert.equal(state.serverClockTrusted, false);
        context.resetServerClock(); state.serverTimeOffsetMs = 37;
        assert.equal(context.getServerNow(), wall + 37);
        let calls = 0;
        const keygen = { window: { ZoeLicense: { getServerNow: () => { calls++; return 7654321; } } }, Date: { now: () => 2000 }, serverTimeOffsetMs: 37 };
        vm.createContext(keygen); vm.runInContext(keygenFunction, keygen);
        assert.equal(keygen.getServerNow(), 7654321); assert.equal(calls, 1);
        keygen.window.ZoeLicense = null;
        assert.equal(keygen.getServerNow(), 2037);
        return true;
    } catch (_) { return false; }
}
module.exports.sharedClockContract = sharedClockContract;

function infoListenerRecoveryContract(source) {
    const fn = parse(source).body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'attachInfoListeners');
    const result = { pending: false, connected: false, offset: false };
    if (!fn) return result;
    const harmless = node => node.type === 'EmptyStatement' || node.type === 'ExpressionStatement'
        && node.expression.type === 'UnaryExpression' && node.expression.operator === 'void' && node.expression.argument.type === 'Literal';
    const body = fn.body.body.filter(node => !harmless(node));
    const protectedNames = new Set(['fb', 'dbRefConnected', 'dbRefServerTimeOffset', 'infoListenerFailedPaths',
        'handleInfoListenerError', 'INFO_LISTENER_KEY_CONNECTED', 'INFO_LISTENER_KEY_OFFSET']);
    let shadowed = false;
    walk(fn, node => {
        const patterns = node.type === 'VariableDeclarator' ? [node.id]
            : /Function/.test(node.type) ? [node.id, ...(node.params || [])]
                : node.type === 'ClassDeclaration' ? [node.id] : node.type === 'CatchClause' ? [node.param]
                    : node.type === 'AssignmentExpression' ? [node.left] : node.type === 'UpdateExpression' ? [node.argument] : [];
        if (patterns.flatMap(bindingNames).some(name => protectedNames.has(name))) shadowed = true;
    });
    if (shadowed) return result;
    const registrations = body.filter(node => node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression'
        && same(node.expression.callee, expression('fb.onValue')));
    const first = body.indexOf(registrations[0]);
    const clear = body.findIndex(node => same(node, statement('infoListenerFailedPaths.clear();')));
    const tail = body.slice(body.indexOf(registrations[1]) + 1);
    result.pending = registrations.length === 2 && ['dbRefConnected', 'dbRefServerTimeOffset'].every(name => registrations.some(node => node.expression.arguments[0]?.name === name))
        && !body.slice(0, first).some(node => ['ReturnStatement', 'ThrowStatement'].includes(node.type))
        && tail.length > 0 && same(tail.at(-1), statement('return true;'))
        && tail.every(node => same(node, statement('return true;')) || same(node, statement('if (native) observeNativeTime();')))
        && clear >= 0 && first === clear + 3
        && body.indexOf(registrations[1]) === first + 1
        && same(body[clear + 1], statement('infoListenerFailedPaths.add(INFO_LISTENER_KEY_CONNECTED);'))
        && same(body[clear + 2], statement('infoListenerFailedPaths.add(INFO_LISTENER_KEY_OFFSET);'));
    const currentBindings = body.flatMap(node => node.type === 'VariableDeclaration' ? node.declarations : [])
        .filter(node => node.id.name === 'current');
    let currentRebound = false;
    walk(fn, node => {
        if (node.type === 'AssignmentExpression' && bindingNames(node.left).includes('current')
            || node.type === 'UpdateExpression' && bindingNames(node.argument).includes('current')) currentRebound = true;
    });
    const currentIsOwned = !currentRebound && currentBindings.length === 1 && same(currentBindings[0].init,
        expression('() => listenerGeneration === infoListenerGeneration && database === db && sdk === fb'));
    for (const [key, ref, flag] of [['connected', 'dbRefConnected', 'INFO_LISTENER_KEY_CONNECTED'], ['offset', 'dbRefServerTimeOffset', 'INFO_LISTENER_KEY_OFFSET']]) {
        const matching = registrations.filter(node => node.expression.arguments[0]?.name === ref);
        if (matching.length !== 1) continue;
        const callback = matching[0].expression.arguments[2];
        if (!callback || !['ArrowFunctionExpression', 'FunctionExpression'].includes(callback.type)
            || callback.params.length !== 1 || callback.params[0].type !== 'Identifier' || callback.body.type !== 'BlockStatement') continue;
        const ownerNames = new Set(['current', 'listenerGeneration', 'infoListenerGeneration']);
        if ([callback.id?.name, callback.params[0].name].some(name => ownerNames.has(name))) continue;
        const statements = callback.body.body.filter(node => !harmless(node));
        result[key] = statements.length === 2
            && (currentIsOwned && same(statements[0], statement('if (!current()) return;'))
                || same(statements[0], statement('if (listenerGeneration !== infoListenerGeneration) return;')))
            && same(statements[1], statement('handleInfoListenerError(' + callback.params[0].name + ', ' + flag + ');'));
    }
    return result;
}
module.exports.infoListenerRecoveryContract = infoListenerRecoveryContract;
