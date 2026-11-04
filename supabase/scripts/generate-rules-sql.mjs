import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { compileRules, rulesSql } from './rtdb-rules.mjs';

const { minifyRulesText, rulesArtifactProblems } = createRequire(import.meta.url)('./rtdb-rules-artifact.cjs');

const MIGRATION_RE = /^\d{14}_[a-z0-9_]+\.sql$/;
const RULES_RE = /_zoe_rules\.sql$/;

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const dir = path.join(repo, 'supabase', 'migrations');
const rulesText = fs.readFileSync(path.join(repo, 'firebase-database.rules.json'), 'utf8');
const rules = JSON.parse(rulesText);
const artifactPath = path.join(repo, 'firebase-database.rules.min.json');
const artifact = minifyRulesText(rulesText);
const artifactProblems = rulesArtifactProblems(rulesText, artifact);
if (artifactProblems.length) throw new Error('rules publish artifact ៖ ' + artifactProblems.join(' · '));
if (rulesSql(compileRules(JSON.parse(artifact))) !== rulesSql(compileRules(rules))) throw new Error('rules publish artifact compiles to other SQL');
if (!fs.existsSync(artifactPath) || fs.readFileSync(artifactPath, 'utf8') !== artifact) {
    fs.writeFileSync(artifactPath, artifact);
    console.log('wrote ' + path.relative(repo, artifactPath) + ' (' + Buffer.byteLength(artifact, 'utf8') + ' bytes)');
}
const sql = rulesSql(compileRules(rules));
const files = fs.readdirSync(dir).filter((f) => MIGRATION_RE.test(f)).sort();
const latestRules = files.filter((f) => RULES_RE.test(f)).pop();

if (latestRules && fs.readFileSync(path.join(dir, latestRules), 'utf8') === sql) {
    console.log('unchanged ' + path.relative(repo, path.join(dir, latestRules)));
    process.exit(0);
}

const stamp = (ms) => new Date(ms).toISOString().replace(/\D/g, '').slice(0, 14);
const versionMs = (v) => Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +v.slice(8, 10), +v.slice(10, 12), +v.slice(12, 14));
const lastVersion = files.length ? files[files.length - 1].slice(0, 14) : '';
let ms = Date.now();
if (lastVersion && stamp(ms) <= lastVersion) ms = versionMs(lastVersion) + 1000;
const target = path.join(dir, stamp(ms) + '_zoe_rules.sql');
fs.writeFileSync(target, sql);
console.log('wrote ' + path.relative(repo, target));
