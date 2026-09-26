const fs = require('fs');
let acorn;
try { acorn = require('acorn'); } catch (e) { acorn = null; }
// កូដ App ដែល ship ទាំងអស់ត្រូវគ្មាន comment — មើលចំណុច ១២ ក្នុង CLAUDE.md។
// `vendor/`, `qrcode.js` (library ខាងក្រៅ) និង `*/test.js` ត្រូវលើកលែង។
const path = require('path');
// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const APP_ROOT = process.env.COMMENTS_APP_DIR ? path.resolve(process.env.COMMENTS_APP_DIR) : path.resolve(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];
const EXTERNAL = new Set(['qrcode.js', 'test.js']);
const files = [];
for (const app of APPS) {
  // ZoeW React (ប្រភព) ៖ ឯកសារដែល ship ដដែលៗ រស់នៅ `public/` (src ឆ្លង build ដែលលុប comment)
  const base = fs.existsSync(path.join(APP_ROOT, app, 'src', 'main.tsx')) ? app + '/public' : app;
  const dir = path.join(APP_ROOT, base);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir).sort()) {
    if (!/\.js$/.test(name) || EXTERNAL.has(name)) continue;
    files.push(base + '/' + name);
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

// ZoeW React ៖ ប្រភព `src/**` · Netlify Function · config ក៏ត្រូវគ្មាន comment ដែរ (សំណើម្ចាស់គម្រោង)។
// ⛔ root វាស់ (`ZoeW/dist-audit/measure-root`) មិនផ្ទុក `src/` ទេ ➜ ប្រភពដេរីវេពីទីតាំង root វាស់ខ្លួនឯង
//    (`<ប្រភព>/ZoeW/dist-audit/measure-root`) ➜ ដើរទាំង tree បច្ចុប្បន្ន ទាំង baseline ដោយគ្មាន env។
// ⛔ root វាស់ (`audit-source-files.json`) ដែលរកប្រភពមិនឃើញ = FAIL (មិនមែនរំលងស្ងាត់)។
const tsComments = require('./ts-comments');
const MEASURE_SUFFIX = path.join('ZoeW', 'dist-audit', 'measure-root');
function reactSourceDir() {
  if (fs.existsSync(path.join(APP_ROOT, 'ZoeW', 'src', 'main.tsx'))) return path.join(APP_ROOT, 'ZoeW');
  if (APP_ROOT.endsWith(path.sep + MEASURE_SUFFIX)) {
    const src = path.join(APP_ROOT.slice(0, -MEASURE_SUFFIX.length), 'ZoeW');
    if (fs.existsSync(path.join(src, 'src', 'main.tsx'))) return src;
  }
  return null;
}
const isMeasureTree = fs.existsSync(path.join(APP_ROOT, 'ZoeW', 'audit-source-files.json'));
const reactDir = reactSourceDir();
let reactScanned = 0;
if (isMeasureTree && !reactDir) {
  console.log('\n❌ root វាស់របស់ ZoeW React តែរកប្រភព `ZoeW/src` មិនឃើញ — comment ក្នុង React វាស់មិនបាន');
  process.exit(1);
}
if (reactDir) {
  if (!tsComments.available()) {
    console.log('\n❌ ត្រូវការ typescript + esbuild ដើម្បីវាស់ comment ក្នុង ZoeW React (npm ci --prefix ZoeW)');
    process.exit(1);
  }
  for (const file of tsComments.reactShippedFiles(reactDir)) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = 'ZoeW/' + path.relative(reactDir, file).split(path.sep).join('/');
    let n;
    try { n = tsComments.countComments(src, file); } catch (e) { console.log(`${rel}: PARSE ERROR ${e.message}`); dirty.push(rel + ' (parse)'); continue; }
    scanned++;
    reactScanned++;
    if (n) { console.log(`${rel}: comments=${n}`); dirty.push(rel + ' (' + n + ')'); }
  }
  console.log(`ZoeW React ៖ ស្កេន ${reactScanned} ឯកសារ`);
  const MIN_REACT_FILES = 50;
  if (reactScanned < MIN_REACT_FILES) {
    console.log('\n❌ ជាន់អប្បបរមា React ៖ រំពឹង >= ' + MIN_REACT_FILES + ' តែឃើញ ' + reactScanned);
    process.exit(1);
  }
}

// HTML ដែល ship (`index.html` ប្រភព · `guide.html` · ZoeKeyGen) ៖ `<!-- … -->` ចេញដល់ browser ដដែល
// ⛔ `index.html` ក្នុង root វាស់ជាលទ្ធផល prerender របស់ React (វាអាចមាន `<!-- -->` ជាសញ្ញាបំបែក text) ➜ វាស់ប្រភព
const htmlFiles = [];
if (reactDir) {
  htmlFiles.push(path.join(reactDir, 'index.html'));
  const pub = path.join(reactDir, 'public');
  if (fs.existsSync(pub)) for (const name of fs.readdirSync(pub).sort()) if (/\.html$/.test(name)) htmlFiles.push(path.join(pub, name));
}
const keygenDir = path.join(APP_ROOT, 'ZoeKeyGen');
if (fs.existsSync(keygenDir)) for (const name of fs.readdirSync(keygenDir).sort()) if (/\.html$/.test(name)) htmlFiles.push(path.join(keygenDir, name));
for (const file of htmlFiles) {
  if (!fs.existsSync(file)) continue;
  const n = (fs.readFileSync(file, 'utf8').match(/<!--/g) || []).length;
  scanned++;
  const rel = path.relative(reactDir && file.startsWith(reactDir) ? path.dirname(reactDir) : APP_ROOT, file).split(path.sep).join('/');
  if (n) { console.log(`${rel}: html-comments=${n}`); dirty.push(rel + ' (' + n + ')'); }
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
