const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.DEVGUARD_APP_DIR || path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(cond, label, got) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (got !== undefined ? '  ➜ ' + JSON.stringify(got) : '')); }
}

const src = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen', 'app.js'), 'utf8');

// slice the real guard: from the baseline/threshold code through checkDevTools's closing brace
const start = src.indexOf('    const isMobile =');
const endMark = src.indexOf('setInterval(checkDevTools, 1000);');
if (start === -1 || endMark === -1) { console.log('FAIL — រកកូដ guard មិនឃើញ'); process.exit(1); }
const guardSrc = src.slice(start, endMark);

function run(scenario) {
    let kicked = false;
    const win = {
        outerWidth: scenario.outerW, innerWidth: scenario.innerW,
        outerHeight: scenario.outerH, innerHeight: scenario.innerH
    };
    const ctx = {
        window: win,
        document: { addEventListener: () => {} },
        navigator: { userAgent: scenario.mobile ? 'iPhone' : 'Mozilla/5.0 (Windows NT 10.0) Chrome/120' },
        kickUserOut: () => { kicked = true; },
        console
    };
    vm.createContext(ctx);
    vm.runInContext(guardSrc, ctx);
    // whatever the user then does
    Object.assign(win, scenario.then || {});
    for (let i = 0; i < 5; i++) ctx.checkDevTools();
    return kicked;
}

const W = 1280, H = 800;

console.log('\n=== ការបណ្តេញខុស ត្រូវតែឈប់កើត ===');
ok(!run({ outerW: W, innerW: W - 16, outerH: H, innerH: H - 90 }),
    'window ធម្មតា ➜ មិនបណ្តេញ');
// browser zoom shrinks BOTH inner dimensions; outer* stay put
ok(!run({ outerW: W, innerW: W - 16, outerH: H, innerH: H - 90,
          then: { innerWidth: Math.round(W / 2), innerHeight: Math.round(H / 2) } }),
    'zoom ចូល 200% ក្រោយ load ➜ មិនបណ្តេញ');
ok(!run({ outerW: W, innerW: Math.round(W / 2), outerH: H, innerH: Math.round(H / 2) }),
    'បើក App ខណៈ zoom កំណត់រួច ➜ មិនបណ្តេញ');
ok(!run({ outerW: 500, innerW: 320, outerH: 640, innerH: 640 }),
    'window តូច / viewport បង្ខំ ➜ មិនបណ្តេញ (ករណីដែលបានវាស់ក្នុង browser ពិត)');
ok(!run({ outerW: W, innerW: W - 16, outerH: H, innerH: H - 90,
          then: { innerWidth: W - 16 - 40, innerHeight: H - 90 - 40 } }),
    'ផ្លាស់ទំហំ window បន្តិច ➜ មិនបណ្តេញ');

console.log('\n=== ការការពារពិត ត្រូវតែនៅដដែល ===');
ok(run({ outerW: W, innerW: W - 16, outerH: H, innerH: H - 90,
         then: { innerWidth: W - 16 - 400 } }),
    'DevTools docked ខាងស្តាំ ➜ បណ្តេញ');
ok(run({ outerW: W, innerW: W - 16, outerH: H, innerH: H - 90,
         then: { innerHeight: H - 90 - 300 } }),
    'DevTools docked ខាងក្រោម ➜ បណ្តេញ');
ok(!run({ mobile: true, outerW: 400, innerW: 400, outerH: 800, innerH: 800,
          then: { innerWidth: 100 } }),
    'ទូរស័ព្ទ ➜ រំលងការត្រួតពិនិត្យដដែល (ឥរិយាបថដើម)');

console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
