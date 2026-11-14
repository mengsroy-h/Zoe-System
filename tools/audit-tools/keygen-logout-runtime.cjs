const { createRequire } = require('node:module');
const path = require('node:path');
const acorn = createRequire(path.join(__dirname, '../../ZoeW/package.json'))('acorn');

function keygenLogoutRuntime(source) {
    const names = new Set(['LOCAL_LOGOUT_INTENT_PREFIX', 'createLocalLogoutIntentStore', 'localLogoutIntent', 'acceptedLogoutIntents', 'initialAuthLogoutIntents', 'captureInitialAuthLogoutIntent', 'keygenLogoutOwner', 'keygenAuthScope', 'keygenSessionIntentCurrent']);
    const declarations = [];
    for (const node of acorn.parse(source, { ecmaVersion: 'latest' }).body) {
        if (node.type === 'FunctionDeclaration' && names.has(node.id.name)) declarations.push(source.slice(node.start, node.end));
        if (node.type === 'VariableDeclaration' && node.declarations.some(d => d.id.type === 'Identifier' && names.has(d.id.name))) declarations.push(source.slice(node.start, node.end));
    }
    return declarations.join('\n');
}

module.exports = { keygenLogoutRuntime };
