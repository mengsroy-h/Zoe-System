const fs = require('fs');
const apps = ['ZoeAdmin','ZoeW','Zoescan','ZoeKeyGen'];
for (const a of apps) {
  const js = fs.readFileSync(`${a}/app.js`,'utf8');
  const html = fs.readFileSync(`${a}/index.html`,'utf8');
  const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  const refs = new Map();
  for (const m of js.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)) {
    if (!refs.has(m[1])) refs.set(m[1], 0);
    refs.set(m[1], refs.get(m[1])+1);
  }
  for (const m of js.matchAll(/getElementById\(\s*"([^"]+)"\s*\)/g)) {
    if (!refs.has(m[1])) refs.set(m[1], 0);
    refs.set(m[1], refs.get(m[1])+1);
  }
  const missing = [...refs.keys()].filter(id=>!htmlIds.has(id));
  console.log(`=== ${a} === refs:${refs.size} htmlIds:${htmlIds.size} MISSING: ${missing.length ? missing.join(', ') : '(none)'}`);
  // duplicate ids in html
  const all = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  const dupes = all.filter((v,i)=>all.indexOf(v)!==i);
  if (dupes.length) console.log(`    DUPLICATE HTML IDs: ${[...new Set(dupes)].join(', ')}`);
}
