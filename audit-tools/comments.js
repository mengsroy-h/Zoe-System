const fs = require('fs');
let acorn;
try { acorn = require('acorn'); } catch (e) { acorn = null; }
// កូដ App ដែល ship ទាំងអស់ត្រូវគ្មាន comment — មើលចំណុច ១២ ក្នុង CLAUDE.md។
// `vendor/`, `qrcode.js` (library ខាងក្រៅ) និង `*/test.js` ត្រូវលើកលែង។
const path = require('path');
const APPS = ['ZoeW', 'ZoeKeyGen', 'ZoeImport'];
const EXTERNAL = new Set(['qrcode.js', 'test.js']);
const files = [];
for (const app of APPS) {
  const dir = path.join(__dirname, '..', app);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir).sort()) {
    if (!/\.js$/.test(name) || EXTERNAL.has(name)) continue;
    files.push(app + '/' + name);
  }
}
if (!acorn) { console.log('acorn not available — falling back to regex scan'); }
const dirty = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  if (acorn) {
    const comments = [];
    try {
      try { acorn.parse(src, { ecmaVersion: 2022, onComment: comments, locations: true, sourceType: 'script' }); }
      catch (e) { comments.length = 0; acorn.parse(src, { ecmaVersion: 2022, onComment: comments, locations: true, sourceType: 'module' }); }
    } catch (e) { console.log(`${f}: PARSE ERROR ${e.message}`); continue; }
    console.log(`${f}: comments=${comments.length}` + (comments.length ? ' -> ' + comments.slice(0,5).map(c=>`L${c.loc.start.line}`).join(',') : ''));
    if (comments.length) dirty.push(f + ' (' + comments.length + ')');
  }
  const lines = src.split('\n');
  const trail = lines.map((l,i)=>[i+1,l]).filter(([,l])=>/[ \t]+$/.test(l)).map(([n])=>n);
  const blanks = [];
  let run = 0;
  lines.forEach((l,i)=>{ if(l.trim()===''){run++;} else {if(run>=2) blanks.push(`L${i-run+1}-${i}`); run=0;} });
  if (trail.length) console.log(`   trailing-ws lines: ${trail.slice(0,10).join(',')}${trail.length>10?' ...(+'+(trail.length-10)+')':''}`);
  if (blanks.length) console.log(`   consecutive-blank runs: ${blanks.join(', ')}`);
}

// CSS ដែល ship ក៏ត្រូវគ្មាន comment ដែរ
for (const app of APPS) {
  const f = app + '/style.css';
  const p = path.join(__dirname, '..', f);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  const n = (src.match(/\/\*/g) || []).length;
  console.log(`${f}: comments=${n}`);
  if (n) dirty.push(f + ' (' + n + ')');
}

if (dirty.length) {
  console.log('\n❌ នៅមាន comment ក្នុងកូដ App ដែល ship: ' + dirty.join(', '));
  console.log('   រត់៖ node audit-tools/strip-comments.js');
  process.exit(1);
}
console.log('\n✅ កូដ App ដែល ship គ្មាន comment');
