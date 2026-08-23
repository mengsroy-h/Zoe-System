const fs = require('fs');
let acorn;
try { acorn = require('acorn'); } catch (e) { acorn = null; }
const files = ['ZoeW/app.js','ZoeKeyGen/app.js',
               'ZoeW/license-verify.js','ZoeKeyGen/license-verify.js'];
if (!acorn) { console.log('acorn not available — falling back to regex scan'); }
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  if (acorn) {
    const comments = [];
    try {
      acorn.parse(src, { ecmaVersion: 2022, onComment: comments, locations: true });
    } catch (e) { console.log(`${f}: PARSE ERROR ${e.message}`); continue; }
    console.log(`${f}: comments=${comments.length}` + (comments.length ? ' -> ' + comments.slice(0,5).map(c=>`L${c.loc.start.line}`).join(',') : ''));
  }
  const lines = src.split('\n');
  const trail = lines.map((l,i)=>[i+1,l]).filter(([,l])=>/[ \t]+$/.test(l)).map(([n])=>n);
  const blanks = [];
  let run = 0;
  lines.forEach((l,i)=>{ if(l.trim()===''){run++;} else {if(run>=2) blanks.push(`L${i-run+1}-${i}`); run=0;} });
  if (trail.length) console.log(`   trailing-ws lines: ${trail.slice(0,10).join(',')}${trail.length>10?' ...(+'+(trail.length-10)+')':''}`);
  if (blanks.length) console.log(`   consecutive-blank runs: ${blanks.join(', ')}`);
}
