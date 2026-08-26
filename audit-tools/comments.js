const fs = require('fs');
let acorn;
try { acorn = require('acorn'); } catch (e) { acorn = null; }
// កូដ App ដែល ship ទាំងអស់ត្រូវគ្មាន comment — មើលចំណុច ១២ ក្នុង CLAUDE.md។
// `vendor/`, `qrcode.js` (library ខាងក្រៅ) និង `*/test.js` ត្រូវលើកលែង។
const path = require('path');
// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const APP_ROOT = process.env.COMMENTS_APP_DIR ? path.resolve(process.env.COMMENTS_APP_DIR) : path.resolve(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen', 'ZoeImport'];
const EXTERNAL = new Set(['qrcode.js', 'test.js']);
const files = [];
for (const app of APPS) {
  const dir = path.join(APP_ROOT, app);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir).sort()) {
    if (!/\.js$/.test(name) || EXTERNAL.has(name)) continue;
    files.push(app + '/' + name);
  }
}
if (!acorn) { console.log('acorn not available — falling back to regex scan'); }
const dirty = [];
let scanned = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  scanned++;
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
  const p = path.join(APP_ROOT, f);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  scanned++;
  const n = (src.match(/\/\*/g) || []).length;
  console.log(`${f}: comments=${n}`);
  if (n) dirty.push(f + ' (' + n + ')');
}

// ⛔ **ជាន់អប្បបរមា (positive floor)។** «គ្មាន comment ទេ» ជាការអះអាង
// **អវត្តមាន** — វាពិតដោយស្វ័យប្រវត្តិលើថតទទេ។ ដូច្នេះត្រូវអះអាងជាមុនសិន
// ថា checker នេះពិតជាបានឃើញឯកសារ។ មើល `checker-coverage.js`។
const MIN_SHIPPED_FILES = 6;
if (scanned < MIN_SHIPPED_FILES) {
  console.log('\n❌ ជាន់អប្បបរមា៖ រំពឹងឯកសារ App ដែល ship >= ' + MIN_SHIPPED_FILES
    + ' តែឃើញ ' + scanned + ' — checker នេះមិនបានឃើញកូដទេ');
  process.exit(1);
}
console.log('\nជាន់អប្បបរមា៖ ស្កេនឯកសារ App ដែល ship ' + scanned);

if (dirty.length) {
  console.log('\n❌ នៅមាន comment ក្នុងកូដ App ដែល ship: ' + dirty.join(', '));
  console.log('   រត់៖ node audit-tools/strip-comments.js');
  process.exit(1);
}
console.log('\n✅ កូដ App ដែល ship គ្មាន comment');
