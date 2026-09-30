import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileRules, rulesSql } from './rtdb-rules.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const target = path.join(repo, 'supabase', 'migrations', process.argv[2] || '20261001000100_zoe_rules.sql');
const rules = JSON.parse(fs.readFileSync(path.join(repo, 'firebase-database.rules.json'), 'utf8'));
fs.writeFileSync(target, rulesSql(compileRules(rules)));
console.log('wrote ' + path.relative(repo, target));
