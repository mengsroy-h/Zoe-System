import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const digest = value => createHash('sha256').update(value).digest('hex');
const inside = (file, root) => { const relative = path.relative(root, file); return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
const typeOnlyAlias = symbol => symbol.declarations?.every(declaration =>
    ts.isExportSpecifier(declaration) && (declaration.isTypeOnly || declaration.parent.parent.isTypeOnly));

// របាយការណ៍តែប៉ុណ្ណោះ៖ candidate មិនមែនជាភស្តុតាងអនុញ្ញាតលុបកូដ។
export function analyzeSourceFunctions({ projectPath, sourceRoot }) {
    const project = path.resolve(projectPath), root = path.resolve(sourceRoot);
    const config = ts.readConfigFile(project, ts.sys.readFile);
    if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(project), undefined, project);
    if (parsed.errors.length) throw new Error(parsed.errors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
    const roots = parsed.fileNames.filter(file => inside(file, root) && /\.[cm]?tsx?$/.test(file));
    if (!roots.length) throw new Error('គ្មាន source ក្នុង profile នេះ; config មានតែ references ត្រូវជ្រើស config កូន។');
    const program = ts.createProgram(roots, parsed.options);
    const checker = program.getTypeChecker();
    const sources = program.getSourceFiles().filter(source => !source.isDeclarationFile && inside(source.fileName, root) && /\.[cm]?tsx?$/.test(source.fileName));
    if (!sources.length) throw new Error('គ្មាន source ដែលអាចវាស់បាន។');
    const relative = file => path.relative(root, file).split(path.sep).join('/');
    const unknown = new Set();
    for (const error of ts.getPreEmitDiagnostics(program)) {
        if (error.category === ts.DiagnosticCategory.Error && ![6133, 6192, 6196].includes(error.code)) {
            unknown.add('compiler:' + error.code + ':' + (error.file ? relative(error.file.fileName) : 'project'));
        }
    }
    const resolve = symbol => symbol && (symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol);
    const nodes = new Map(), owners = new Map(), rootSymbols = new Set();
    for (const source of sources) {
        for (const declaration of source.statements) {
            if (!ts.isFunctionDeclaration(declaration) || !declaration.name || !declaration.body) continue;
            const symbol = resolve(checker.getSymbolAtLocation(declaration.name));
            if (!symbol) { unknown.add('unresolved-function:' + relative(source.fileName)); continue; }
            const start = declaration.getStart(source), position = source.getLineAndCharacterOfPosition(start);
            nodes.set(symbol, { id: relative(source.fileName) + ':' + start, file: relative(source.fileName),
                name: declaration.name.text, line: position.line + 1, edges: new Set(), reasons: new Set() });
            owners.set(declaration, symbol);
            if (!ts.isExternalModule(source)) { rootSymbols.add(symbol); nodes.get(symbol).reasons.add('script-global'); }
        }
    }
    for (const source of sources) {
        const moduleSymbol = checker.getSymbolAtLocation(source);
        if (moduleSymbol) {
            for (const exported of checker.getExportsOfModule(moduleSymbol)) {
                if (typeOnlyAlias(exported)) continue;
                const target = resolve(exported);
                if (nodes.has(target)) { rootSymbols.add(target); nodes.get(target).reasons.add('public-export'); }
            }
        }
        const visit = (node, owner = null) => {
            if (ts.isExpressionWithTypeArguments(node)) {
                const heritage = ts.isHeritageClause(node.parent);
                if (!heritage || node.parent.token === ts.SyntaxKind.ExtendsKeyword
                    && (ts.isClassDeclaration(node.parent.parent) || ts.isClassExpression(node.parent.parent))) visit(node.expression, owner);
                return;
            }
            if (ts.isTypeNode(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
                || ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
            if (owners.has(node)) owner = owners.get(node);
            if (ts.isDecorator(node)) unknown.add('decorator:' + relative(source.fileName));
            if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword
                && !(ts.isPropertyAccessExpression(node.parent) && ['env', 'url', 'hot'].includes(node.parent.name.text))) {
                unknown.add('import-meta-reflection:' + relative(source.fileName));
            }
            if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
                && (!node.arguments[0] || !ts.isStringLiteralLike(node.arguments[0]))) unknown.add('dynamic-import:' + relative(source.fileName));
            if (ts.isPropertyAccessExpression(node) && ['glob', 'globEager'].includes(node.name.text)
                && ts.isMetaProperty(node.expression)) unknown.add('import-glob:' + relative(source.fileName));
            if (ts.isIdentifier(node)) {
                const parent = node.parent;
                const declarationName = (ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent)
                    || ts.isParameter(parent) || ts.isVariableDeclaration(parent) || ts.isClassDeclaration(parent)) && parent.name === node;
                if (!declarationName) {
                    const raw = ts.isShorthandPropertyAssignment(parent) && parent.name === node
                        ? checker.getShorthandAssignmentValueSymbol(parent) : checker.getSymbolAtLocation(node);
                    const symbol = resolve(raw);
                    if (['eval', 'Function'].includes(node.text) && (!symbol || symbol.declarations?.every(declaration => declaration.getSourceFile().isDeclarationFile))) {
                        unknown.add('dynamic-evaluation:' + relative(source.fileName));
                    }
                    if (nodes.has(symbol)) {
                        if (owner) nodes.get(owner).edges.add(symbol);
                        else { rootSymbols.add(symbol); nodes.get(symbol).reasons.add('module-reference'); }
                    }
                }
            }
            ts.forEachChild(node, child => visit(child, owner));
        };
        visit(source);
    }
    const retained = new Set(rootSymbols), queue = [...rootSymbols];
    for (let i = 0; i < queue.length; i++) {
        for (const target of nodes.get(queue[i]).edges) {
            if (!retained.has(target)) { retained.add(target); queue.push(target); }
        }
    }
    const functions = [...nodes].map(([symbol, node]) => ({ id: node.id, file: node.file, name: node.name, line: node.line,
        status: retained.has(symbol) ? 'retained' : unknown.size ? 'unknown' : 'candidate',
        reasons: [...node.reasons].sort(), references: [...node.edges].map(edge => nodes.get(edge).id).sort() }))
        .sort((left, right) => left.id.localeCompare(right.id));
    return { schemaVersion: 1, mode: 'report-only', profile: 'original-typescript-source', deletionSafe: false,
        project, sourceRoot: root, compilerVersion: ts.version, configHash: digest(fs.readFileSync(project)),
        compilerOptionsHash: digest(JSON.stringify(parsed.options)), complete: unknown.size === 0,
        unknownReasons: [...unknown].sort(), sources: sources.map(source => ({ file: relative(source.fileName), hash: digest(source.text) })).sort((a, b) => a.file.localeCompare(b.file)),
        declarationInputs: program.getSourceFiles().filter(source => source.isDeclarationFile && inside(source.fileName, root))
            .map(source => ({ file: relative(source.fileName), hash: digest(source.text) })).sort((a, b) => a.file.localeCompare(b.file)),
        functions, counts: { sources: sources.length, functions: functions.length, retained: functions.filter(row => row.status === 'retained').length,
            candidates: functions.filter(row => row.status === 'candidate').length, unknown: functions.filter(row => row.status === 'unknown').length },
        limitations: ['Public runtime exports ត្រូវរក្សាទុក; មិនមែនភស្តុតាងថាបានរត់។',
            'Candidate គ្របតែ private top-level named function declarations; closures, arrows និង class methods ត្រូវរក្សាទុកដោយប្រុងប្រយ័ត្ន។',
            'រួមបញ្ចូល source modules ក្នុង config; មិនមែនការវាស់ entrypoint ឬ unused exports ទេ។',
            'Dynamic evaluation, compilation ដែលមិនពេញលេញ និង dynamic imports/globs មិនគាំទ្រ បិទការចាត់ candidate។',
            'ភាសាផ្សេង, HTML/classic scripts, generated audit consumers និង backend/device entrypoints មិនត្រូវបានបញ្ជាក់សម្រាប់ការលុបទេ។'] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    try {
        const report = analyzeSourceFunctions({ projectPath: process.argv[2] || path.join(app, 'tsconfig.app.json'), sourceRoot: process.argv[3] || path.join(app, 'src') });
        console.log(JSON.stringify(report, null, 2));
        process.exitCode = report.complete ? 0 : 2;
    } catch (error) { console.error('ការវាស់ source មិនពេញលេញ៖ ' + error.message); process.exitCode = 2; }
}
