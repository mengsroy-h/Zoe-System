const fs = require('fs');
function extract(file, indent) {
  const src = fs.readFileSync(file,'utf8').split('\n');
  const out = {};
  const re = new RegExp('^' + ' '.repeat(indent) + '(?:async )?function ([A-Za-z0-9_$]+)\\s*\\(');
  const close = ' '.repeat(indent) + '}';
  let cur = null, buf = [];
  for (const line of src) {
    const m = line.match(re);
    if (m) { if (cur) out[cur] = buf.join('\n'); cur = m[1]; buf = [line]; continue; }
    if (cur) {
      buf.push(line);
      if (line === close) { out[cur] = buf.join('\n'); cur = null; buf = []; }
    }
  }
  if (cur) out[cur] = buf.join('\n');
  return out;
}
const A = extract('ZoeAdmin/app.js', 4);
const W = extract('ZoeW/app.js', 4);
const dir = process.argv[2];
fs.mkdirSync(dir+'/A',{recursive:true}); fs.mkdirSync(dir+'/W',{recursive:true});
const shared = Object.keys(A).filter(k=>W[k]);
for (const k of shared) { fs.writeFileSync(`${dir}/A/${k}.js`, A[k]); fs.writeFileSync(`${dir}/W/${k}.js`, W[k]); }
const same = [], diff = [];
for (const k of shared) (A[k]===W[k] ? same : diff).push(k);
console.log('SHARED:', shared.length, ' identical:', same.length, ' different:', diff.length);
console.log('\nONLY IN ZoeAdmin:', Object.keys(A).filter(k=>!W[k]).join(', '));
console.log('\nONLY IN ZoeW:', Object.keys(W).filter(k=>!A[k]).join(', '));
console.log('\nDIFFERENT (need review):');
for (const k of diff) {
  const la = A[k].split('\n').length, lw = W[k].split('\n').length;
  console.log(`  ${k}  (Admin ${la} lines / W ${lw} lines)`);
}
