const fs = require('fs');
for (const a of ['ZoeAdmin','ZoeW','Zoescan','ZoeKeyGen']) {
  const js = fs.readFileSync(`${a}/app.js`,'utf8');
  const html = fs.readFileSync(`${a}/index.html`,'utf8');
  const fns = new Set([...js.matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(/g)].map(m=>m[1]));
  [...js.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:function|\()/g)].forEach(m=>fns.add(m[1]));
  const called = new Set();
  for (const m of html.matchAll(/\son[a-z]+="([^"]*)"/g)) {
    for (const c of m[1].matchAll(/([A-Za-z0-9_$]+)\s*\(/g)) called.add(c[1]);
  }
  const builtins = new Set(['alert','confirm','event','window','document','this','Number','String','parseInt','JSON','setTimeout']);
  const missing = [...called].filter(f=>!fns.has(f) && !builtins.has(f));
  console.log(`=== ${a} === html-inline-calls:${called.size}  NOT DEFINED IN app.js: ${missing.length?missing.join(', '):'(none)'}`);
}
