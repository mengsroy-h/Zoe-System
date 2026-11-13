'use strict';
const { bindingNames } = require('./static-checker-contracts.cjs');

// ការលើកលែងត្រូវដេរីវេពី module និងប្រភព object ពិត មិនមែនឈ្មោះ entry តែប៉ុណ្ណោះ។
function localCacheWrites(source, programs, views) {
    const allowed = new Set();
    const acorn = require(require.resolve('acorn', { paths: [__dirname, require('path').join(__dirname, '../..', 'ZoeW')] }));
    const shape = node => JSON.stringify(node, (key, value) => ['start', 'end', 'loc', 'range', 'raw'].includes(key) ? undefined : value);
    const expressionIs = (node, text) => !!node && shape(node) === shape(acorn.parseExpressionAt(text, 0, { ecmaVersion: 2022 }));
    const ranges = [];
    let cursor = 0;
    for (const [name, text] of Object.entries(views || {})) {
        if (typeof text !== 'string') return allowed;
        if (!text.length) continue;
        const start = source.indexOf(text, cursor);
        if (start < 0) return allowed;
        ranges.push({ name, start, end: start + text.length });
        cursor = start + text.length;
    }
    const walk = (node, visit, parents = []) => {
        if (!node || typeof node.type !== 'string') return;
        visit(node, parents);
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(child => walk(child, visit, [...parents, node]));
            else if (value && typeof value.type === 'string') walk(value, visit, [...parents, node]);
        }
    };
    const id = (node, name) => node?.type === 'Identifier' && node.name === name;
    const member = (node, object, property) => node?.type === 'MemberExpression' && !node.computed && id(node.object, object) && id(node.property, property);
    const call = (node, object, property) => node?.type === 'CallExpression' && member(node.callee, object, property);
    for (const [moduleName, mapName, writerName, fields] of [
        ['src/features/zto-final-marks.ts', 'ztoReturnedEvidence', 'pruneZtoReturnedEvidence', ['noted']],
        ['src/features/zto-status.ts', 'ztoPickupStatus', 'resolveZtoPickupSignTime', ['signedAt', 'signedAtExact']]
    ]) {
        const range = ranges.find(part => part.name === moduleName);
        const ast = range && programs.find(program => program.start === range.start && program.end === range.end);
        if (!ast) continue;
        const nodes = [], parentsByNode = new Map();
        walk(ast, (node, parents) => { nodes.push(node); parentsByNode.set(node, parents); });
        const declarations = nodes.filter(node => node.type === 'VariableDeclarator' && bindingNames(node.id).includes(mapName));
        if (declarations.length !== 1 || declarations[0].init?.type !== 'NewExpression' || !id(declarations[0].init.callee, 'Map')
            || declarations[0].init.arguments.length || !ast.body.some(statement => statement.type === 'VariableDeclaration'
                && statement.kind === 'const' && statement.declarations.includes(declarations[0]))) continue;
        let escapedMap = false;
        for (const program of programs) walk(program, (node, parents) => {
            if (!id(node, mapName)) return;
            const parent = parents.at(-1);
            const use = parents.at(-2);
            const methodCall = parent?.type === 'MemberExpression' && parent.object === node && !parent.computed
                && use?.type === 'CallExpression' && use.callee === parent && ['get', 'set', 'forEach', 'delete', 'clear', 'keys'].includes(parent.property.name);
            const sizeRead = member(parent, mapName, 'size') && !(use?.type === 'AssignmentExpression' && use.left === parent)
                && use?.type !== 'UpdateExpression' && !(use?.type === 'UnaryExpression' && use.operator === 'delete');
            if (program !== ast || !(parent === declarations[0] && parent.id === node || methodCall || sizeRead)) escapedMap = true;
        });
        if (escapedMap) continue;
        const writers = ast.body.filter(node => node.type === 'FunctionDeclaration' && id(node.id, writerName));
        if (writers.length !== 1) continue;
        const writer = writers[0];
        // ទទួលតែ const object literal និង const Map.get; assignment ឬ shadow បំបែកប្រភព។
        const literal = node => node?.type === 'ObjectExpression' && node.properties.every(property => property.type === 'Property'
            || property.type === 'SpreadElement' && property.argument.type === 'ConditionalExpression' && literal(property.argument.consequent) && literal(property.argument.alternate));
        const localOrigin = (argument, owner, allowGet) => {
            if (argument?.type === 'ObjectExpression') return literal(argument);
            if (argument?.type !== 'Identifier') return false;
            const scoped = [];
            walk(owner, node => scoped.push(node));
            const ds = scoped.filter(node => node.type === 'VariableDeclarator' && bindingNames(node.id).includes(argument.name));
            if (ds.length !== 1 || !nodes.some(node => node.type === 'VariableDeclaration' && node.kind === 'const' && node.declarations.includes(ds[0]))) return false;
            if (scoped.some(node => node.type === 'AssignmentExpression' && bindingNames(node.left).includes(argument.name)
                || node.type === 'UpdateExpression' && id(node.argument, argument.name))) return false;
            const declaration = ds[0];
            const lexicalOwner = node => [...(parentsByNode.get(node) || [])].reverse().find(parent => /Function/.test(parent.type));
            const scope = lexicalOwner(declaration);
            const getter = owner.type === 'FunctionDeclaration' && id(owner.id, 'getZtoPickupVerdict') && argument.name === 'legacy';
            const latestExpression = '!legacy || durable.value && durable.value.at >= legacy.at ? durable.value : legacy';
            const getterReturn = 'latest && latest.at >= bound.at ? latest : bound';
            const latestBindings = getter ? scoped.filter(node => node.type === 'VariableDeclarator' && id(node.id, 'latest')) : [];
            const latest = latestBindings.length === 1 && expressionIs(latestBindings[0].init, latestExpression) ? latestBindings[0] : null;
            const validator = ast.body.find(node => node.type === 'FunctionDeclaration' && id(node.id, 'ztoImportLegacyValid'));
            let pureValidator = !!validator && validator.body.body.length === 1 && validator.body.body[0].type === 'ReturnStatement';
            if (validator) walk(validator, node => {
                if (['AssignmentExpression', 'UpdateExpression', 'NewExpression', 'AwaitExpression'].includes(node.type)) pureValidator = false;
                if (node.type === 'CallExpression' && !member(node.callee, 'Number', 'isFinite') && !member(node.callee, 'Array', 'isArray')
                    && !(node.callee.type === 'MemberExpression' && !node.callee.computed && id(node.callee.property, 'includes')
                        && node.callee.object.type === 'ArrayExpression' && node.callee.object.elements.every(value => value.type === 'Literal'))) pureValidator = false;
            });
            const fields = new Set(['closed', 'at', 'signedAt', 'signedAtPending', 'signedAtExact']);
            const safeReference = (node, parents, binding, name) => {
                const parent = parents.at(-1);
                if (parent === binding && parent.id === node) return true;
                if (lexicalOwner(node) !== scope) return false;
                if (parent?.type === 'MemberExpression' && parent.object === node && !parent.computed && fields.has(parent.property.name)) {
                    const use = parents.at(-2);
                    return !(use?.type === 'CallExpression' && use.callee === parent);
                }
                if (parent?.type === 'UnaryExpression' && ['!', 'typeof'].includes(parent.operator)) return true;
                if (parent?.type === 'LogicalExpression' && parent.operator === '&&' && parent.left === node) return true;
                if (parent?.type === 'ConditionalExpression' && parent.test === node) return true;
                if (parent?.type === 'IfStatement' && parent.test === node) return true;
                if (parent?.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(parent.operator)) return true;
                if (parent?.type === 'CallExpression') {
                    if (id(parent.callee, writerName) && parent.arguments.length === 1 && parent.arguments[0] === node) return true;
                    if (call(parent, mapName, 'set') && parent.arguments.length === 2 && parent.arguments[1] === node) return true;
                    if (pureValidator && id(parent.callee, 'ztoImportLegacyValid') && parent.arguments.length === 1 && parent.arguments[0] === node) return true;
                }
                // ច្រកអាន verdict ដែលមានស្រាប់ ត្រូវរក្សារូបរាង exit និង alias ពេញលេញ។
                if (getter && name === 'legacy') {
                    if (parent?.type === 'ReturnStatement' && parent.argument === node) {
                        const guard = parents.at(-2);
                        return guard?.type === 'IfStatement' && guard.consequent === parent && !guard.alternate && expressionIs(guard.test, '!bound');
                    }
                    if (latest && parents.includes(latest) && expressionIs(latest.init, latestExpression)) return true;
                }
                if (getter && name === 'latest') {
                    const returned = [...parents].reverse().find(ancestor => ancestor.type === 'ReturnStatement');
                    if (returned && expressionIs(returned.argument, getterReturn)) return true;
                }
                return false;
            };
            let escaped = false;
            walk(owner, (node, parents) => {
                if (id(node, argument.name) && !safeReference(node, parents, declaration, argument.name)) escaped = true;
                if (latest && id(node, 'latest') && !safeReference(node, parents, latest, 'latest')) escaped = true;
            });
            if (escaped) return false;
            return literal(ds[0].init)
                || allowGet && call(ds[0].init, mapName, 'get');
        };
        const ownerOf = node => [...parentsByNode.get(node)].reverse().find(parent => parent.type === 'FunctionDeclaration') || ast;
        const inserts = nodes.filter(node => call(node, mapName, 'set'));
        if (!inserts.length || inserts.some(node => !localOrigin(node.arguments[1], ownerOf(node), false))) continue;
        // ឈ្មោះអ្នកសរសេរមិនអាច escape ជា callback/alias ឬត្រូវហៅពី module ផ្សេង។
        let invalid = false, calls = 0;
        for (const program of programs) walk(program, (node, parents) => {
            if (!id(node, writerName)) return;
            const parent = parents[parents.length - 1];
            if (parent === writer && parent.id === node) return;
            if (parent?.type !== 'CallExpression' || parent.callee !== node || program !== ast) { invalid = true; return; }
            calls++;
            if (writerName === 'resolveZtoPickupSignTime' && (parent.arguments.length !== 1 || !localOrigin(parent.arguments[0], ownerOf(parent), true))) invalid = true;
        });
        if (invalid || !calls) continue;
        const writerNodes = [];
        walk(writer, node => writerNodes.push(node));
        const entryOwner = writerName === 'resolveZtoPickupSignTime' ? writer : writerNodes.find(node => node.type === 'ArrowFunctionExpression'
            && id(node.params[0], 'entry') && call(parentsByNode.get(node)?.at(-1), mapName, 'forEach'));
        if (!entryOwner) continue;
        const scalarFields = new Set(['notedPending', 'noted', 'at', 'closed', 'signedAtPending', 'signedAt', 'signedAtExact']);
        let escapedEntry = false;
        for (const node of writerNodes) {
            if (!id(node, 'entry')) continue;
            const parents = parentsByNode.get(node), parent = parents.at(-1);
            const lexical = [...parents].reverse().find(ancestor => /Function/.test(ancestor.type));
            if (lexical !== entryOwner) { escapedEntry = true; continue; }
            if (parent === entryOwner && entryOwner.params.includes(node)) continue;
            if (parent.type === 'MemberExpression' && parent.object === node && !parent.computed && scalarFields.has(parent.property.name)
                && !(parents.at(-2)?.type === 'CallExpression' && parents.at(-2).callee === parent)) continue;
            if (parent.type === 'UnaryExpression' && ['!', 'typeof'].includes(parent.operator)) continue;
            if (parent.type === 'LogicalExpression' && parent.operator === '&&' && parent.left === node) continue;
            if (parent.type === 'ConditionalExpression' && parent.test === node) continue;
            if (parent.type === 'IfStatement' && parent.test === node) continue;
            if (parent.type === 'BinaryExpression' && ['===', '!==', '==', '!='].includes(parent.operator)) continue;
            escapedEntry = true;
        }
        if (escapedEntry) continue;
        // ការការពារនាឡិកាត្រូវឈរមុនការសរសេរ; ទទួលតែវាលដែលបានវាស់។
        const clock = writerNodes.find(node => node.type === 'VariableDeclarator' && id(node.id, 'clock') && node.init?.type === 'CallExpression' && id(node.init.callee, 'captureClockOperation'));
        if (!clock) continue;
        let clockEscaped = false;
        for (const node of writerNodes) {
            if (node.type === 'VariableDeclarator' && bindingNames(node.id).some(name => ['captureClockOperation', 'getServerNow', 'ztoSignedTimeMillis'].includes(name))) clockEscaped = true;
            if (!id(node, 'clock')) continue;
            const parents = parentsByNode.get(node), parent = parents.at(-1), use = parents.at(-2);
            if (parent === clock && parent.id === node) continue;
            if (member(parent, 'clock', 'current') && use?.type === 'CallExpression' && use.callee === parent && !use.arguments.length) continue;
            clockEscaped = true;
        }
        if (clockEscaped) continue;
        const bindings = writerNodes.filter(node => node.type === 'VariableDeclarator');
        const bindingIs = (name, text) => {
            const matches = bindings.filter(node => bindingNames(node.id).includes(name));
            return matches.length === 1 && expressionIs(matches[0].init, text)
                && !writerNodes.some(node => node.type === 'AssignmentExpression' && bindingNames(node.left).includes(name));
        };
        if (writerNodes.some(node => /Function/.test(node.type) && node.params?.some(param => bindingNames(param).some(name => ['clock', 'now'].includes(name))))) continue;
        if (!bindingIs('clock', 'captureClockOperation()') || !bindingIs('now', 'getServerNow()')) continue;
        if (writerName === 'resolveZtoPickupSignTime' && (!bindingIs('exact', 'ztoSignedTimeMillis(entry.signedAtPending, now)')
            || !bindingIs('retained', "typeof entry.signedAt === 'number' && isFinite(entry.signedAt) && entry.signedAt > 0 ? entry.signedAt : 0"))) continue;
        for (const node of writerNodes) {
            if (node.type !== 'AssignmentExpression' || node.operator !== '=' || node.left.type !== 'MemberExpression'
                || node.left.computed || !id(node.left.object, 'entry') || !fields.includes(node.left.property.name)) continue;
            const expected = { noted: 'now', signedAt: 'exact || retained || now', signedAtExact: '!!exact || !!retained && entry.signedAtExact === true' };
            if (!expressionIs(node.right, expected[node.left.property.name])) continue;
            const parents = parentsByNode.get(node);
            const body = [...parents].reverse().find(parent => parent.type === 'BlockStatement');
            const scopes = parents.filter(parent => parent.type === 'BlockStatement');
            const guarded = scopes.some(block => block.body.some(statement => statement.end < node.start && statement.type === 'IfStatement'
                && statement.test.type === 'UnaryExpression' && statement.test.operator === '!' && call(statement.test.argument, 'clock', 'current')
                && statement.consequent.type === 'ReturnStatement'));
            if (!body || !guarded) continue;
            if (writerName === 'pruneZtoReturnedEvidence') {
                const callback = [...parents].reverse().find(parent => /Function/.test(parent.type));
                const invocation = callback && parentsByNode.get(callback).at(-1);
                if (callback?.type !== 'ArrowFunctionExpression' || !id(callback.params[0], 'entry') || !call(invocation, mapName, 'forEach') || invocation.arguments[0] !== callback) continue;
            } else if (writer.params.length !== 1 || !id(writer.params[0], 'entry')
                || [...parents].reverse().find(parent => /Function/.test(parent.type)) !== writer) continue;
            allowed.add(node.start);
        }
    }
    return allowed;
}
module.exports = { localCacheWrites };
