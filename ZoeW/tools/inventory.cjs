const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const SRC_ROOT = process.env.SRC_ROOT || require('path').join(__dirname, '..', '.original', 'ZoeW');
const src = fs.readFileSync(path.join(SRC_ROOT, 'app.js'), 'utf8');
const lines = src.split('\n');
const ast = acorn.parse(src, { ecmaVersion: 2023, sourceType: 'script', locations: true });

const fns = [];
const vars = [];
for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration') {
        fns.push({ name: node.id.name, start: node.loc.start.line, end: node.loc.end.line, async: !!node.async });
    } else if (node.type === 'VariableDeclaration') {
        for (const d of node.declarations) {
            const names = [];
            (function collect(p) {
                if (!p) return;
                if (p.type === 'Identifier') names.push(p.name);
                else if (p.type === 'ObjectPattern') p.properties.forEach(pr => collect(pr.value || pr.argument));
                else if (p.type === 'ArrayPattern') p.elements.forEach(collect);
                else if (p.type === 'AssignmentPattern') collect(p.left);
                else if (p.type === 'RestElement') collect(p.argument);
            })(d.id);
            for (const n of names) vars.push({ name: n, kind: node.kind, start: node.loc.start.line, end: node.loc.end.line });
        }
    }
}
const other = ast.body.filter(n => n.type !== 'FunctionDeclaration' && n.type !== 'VariableDeclaration')
    .map(n => ({ type: n.type, start: n.loc.start.line, end: n.loc.end.line }));

console.log('TOTAL LINES', lines.length);
console.log('FUNCTIONS', fns.length, ' VARS', vars.length, ' OTHER TOP-LEVEL', other.length);
console.log('--- OTHER TOP LEVEL STATEMENTS ---');
other.forEach(o => console.log(`  ${o.type} L${o.start}-${o.end}  :: ${lines[o.start-1].trim().slice(0,110)}`));
fs.writeFileSync(require('path').join(__dirname, '_fns.json'), JSON.stringify(fns, null, 1));
fs.writeFileSync(require('path').join(__dirname, '_vars.json'), JSON.stringify(vars, null, 1));
fs.writeFileSync(require('path').join(__dirname, '_other.json'), JSON.stringify(other, null, 1));
