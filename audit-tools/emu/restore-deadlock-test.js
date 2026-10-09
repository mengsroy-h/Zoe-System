// ថ្នាក់កំហុស៖ **record ដែលបន្សល់ ចាក់សោធាតុជារៀងរហូត** — ផ្ទៀងផ្ទាត់លើ
// RTDB emulator ពិត ជាមួយ firebase-database.rules.json ពិត។
//
//   java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
//   node audit-tools/emu/restore-deadlock-test.js
//
// អ្វីដែលវាចាក់សោ៖
//
//   ១. `zoew_restore_finalizations/$id` ដែលបន្សល់ (ព្រោះ `clearRestoreFinalization`
//      រត់ក្នុង `.catch(() => {})` ➜ បណ្តាញដាច់ ➜ វាមិនដែលរត់) ត្រូវ **មិនទប់**
//      ការស្តារលើកក្រោយនៃ id ដដែល។ មុនកែ rules មាន `!data.exists()` ➜ ការស្តារ
//      ត្រូវបដិសេធ · finalization ចាស់លុបមិនចេញ (ទាមទារធាតុធុងសំរាមលែងមាន) ·
//      ធាតុធុងសំរាមលុបមិនចេញ (ទាមទារ finalization fence) = **DEADLOCK ៣ ខាង**។
//   ២. ដូចគ្នាសម្រាប់ `zoew_clear_history_finalizations/$id` («លុបទាំងអស់»)។
//   ៣. ⛔ ការការពារ replay និង fence ត្រូវនៅ **ដដែល** — នេះជាខាងទីពីរដែល
//      បើភ្លេច នោះការដក `!data.exists()` ចេញនឹងបើកផ្លូវឲ្យលុយបូកស្ទួន។
//      ការអះអាង «ការស្តារដំណើរការ» តែម្យ៉ាង **មិនគ្រប់គ្រាន់ទេ**។
//   ៤. ធាតុធុងសំរាមដែលមាន `restoreClaim` ងាប់ ត្រូវ purge បាន **ក្រោយដោះ claim**
//      ហើយការ purge ជាក្រុមជា atomic ➜ ធាតុ ១ ដែល claim ជាប់ ធ្វើឲ្យ **ទាំងក្រុម**
//      ធ្លាក់ (នេះជាមូលហេតុដែល `runAutomaticDeletedCleanup` ត្រូវដោះ claim ជាមុន)។
const fs = require('fs');
const path = require('path');
const http = require('http');
const { emuNamespace } = require('./ns.js');

// ថត app អាច override បាន — មើលហេតុផលក្នុង `crud-rules-flow.js`។
const ROOT = process.env.DEADLOCK_APP_DIR ? path.resolve(process.env.DEADLOCK_APP_DIR) : path.join(__dirname, '..', '..');
const BASE = { host: '127.0.0.1', port: 9000 };
const NS = 'ns=' + emuNamespace('demo-zoe-deadlock');
const AUTH = 'auth_variable_override=' + encodeURIComponent(JSON.stringify({ uid: 'userA' }));

let pass = 0, fail = 0;
const check = (c, label, detail) => {
    if (c) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : '')); }
};

function req(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body);
        const r = http.request({ ...BASE, method, path: urlPath, headers: Object.assign(
            { 'Authorization': 'Bearer owner' },
            payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) },
            (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
        r.on('error', reject);
        if (payload) r.write(payload);
        r.end();
    });
}
const asOwner = (m, p, b) => req(m, p + (p.includes('?') ? '&' : '?') + NS, b);
const asUser = (m, p, b) => req(m, p + (p.includes('?') ? '&' : '?') + NS + '&' + AUTH, b);
const denied = (r) => r.status >= 400 || /Permission denied/.test(r.body);

const T0 = 1750000000000;
const SRC = 'id_1750000000000_aaa';
const CID = 'id_1750000000000_bbb';

const trashItem = (id, extra) => Object.assign({
    id, cod: 5, dod: 0, price: 5, count: 1, phone: '098000880',
    scanDate: '2026-08-26', time: 't', createdAt: T0, deletedAt: T0,
    isFromDeletion: true, trashReason: 'delete'
}, extra || {});
const historyItem = (id, extra) => Object.assign({
    id, cod: 5, dod: 0, price: 5, count: 1, phone: '098000880',
    scanDate: '2026-08-26', time: 't', createdAt: T0, isClosed: false, isCalled: false
}, extra || {});

// payload ដដែលបេះបិទនឹង `finalizeClaimedRestore()` ក្នុង ZoeW/app.js
const restoreFinalizeUpdate = (token) => ({
    [`zoew_restore_finalizations/${SRC}`]: { token, targetId: SRC, finalizedAt: T0 + 3000 },
    [`zoew_recently_deleted_cod_dod/${SRC}`]: null,
    [`zoew_scan_history_cod_dod/${SRC}/restoreClaimId`]: null,
    [`zoew_scan_history_cod_dod/${SRC}/restoreClaimToken`]: null
});
// payload ដដែលបេះបិទនឹង `finalizeClaimedHistoryClear()`
const clearFinalizeUpdate = (token) => ({
    [`zoew_clear_history_finalizations/${CID}`]: { token, finalizedAt: T0 + 3000 },
    [`zoew_recently_deleted_cod_dod/${CID}`]: trashItem(CID),
    [`zoew_scan_history_cod_dod/${CID}`]: null
});

async function seedRestoreStuck(withStaleFinalization) {
    await asOwner('PUT', '/.json', null);
    if (withStaleFinalization) {
        await asOwner('PUT', `/zoew_restore_finalizations/${SRC}.json`, { token: 'stale_token', targetId: SRC, finalizedAt: T0 });
    }
    await asOwner('PUT', `/zoew_recently_deleted_cod_dod/${SRC}.json`,
        trashItem(SRC, { restoreClaim: { token: 'live_token', claimedAt: T0 + 1000, targetId: SRC } }));
    await asOwner('PUT', `/zoew_scan_history_cod_dod/${SRC}.json`,
        historyItem(SRC, { restoreClaimId: SRC, restoreClaimToken: 'live_token' }));
}
async function seedClearStuck(withStaleFinalization) {
    await asOwner('PUT', '/.json', null);
    if (withStaleFinalization) {
        await asOwner('PUT', `/zoew_clear_history_finalizations/${CID}.json`, { token: 'stale_c', finalizedAt: T0 });
    }
    await asOwner('PUT', `/zoew_scan_history_cod_dod/${CID}.json`,
        historyItem(CID, { clearClaim: { token: 'live_c', claimedAt: T0 + 1000 } }));
}

(async () => {
    console.log('restore-deadlock — record ដែលបន្សល់ ធៀបនឹង firebase rules ពិត (RTDB emulator)\n');
    const strictMode = process.env.CRUD_FLOW_STRICT === '1';
    let load;
    try {
        load = await asOwner('PUT', '/.settings/rules.json',
            JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8')));
    } catch (connectError) {
        console.log((strictMode ? 'FAIL' : 'SKIP') + ' — តភ្ជាប់ទៅ emulator មិនបាន (127.0.0.1:9000): ' + connectError.message);
        process.exit(strictMode ? 1 : 0);
    }
    if (!/"status"\s*:\s*"ok"/.test(load.body)) {
        console.log('FAIL — rules មិនបាន load ➜ លទ្ធផលទាំងអស់ជា false pass\n' + load.body.slice(0, 200));
        process.exit(1);
    }

    console.log('-- ១. finalization ស្តារដែលបន្សល់ មិនត្រូវចាក់សោធាតុ --');
    await seedRestoreStuck(true);
    check(!denied(await asUser('PATCH', '/.json', restoreFinalizeUpdate('live_token'))),
        'ការស្តារដំណើរការ ទោះ finalization ចាស់បន្សល់');

    console.log('-- ២. finalization «លុបទាំងអស់» ដែលបន្សល់ --');
    await seedClearStuck(true);
    check(!denied(await asUser('PATCH', '/.json', clearFinalizeUpdate('live_c'))),
        'ការលុបទាំងអស់ដំណើរការ ទោះ finalization ចាស់បន្សល់');

    console.log('-- ៣. ⛔ fence ប្រឆាំង replay ត្រូវនៅដដែល --');
    await seedRestoreStuck(false);
    await asUser('PATCH', '/.json', restoreFinalizeUpdate('live_token'));
    check(denied(await asUser('PATCH', '/.json', restoreFinalizeUpdate('live_token'))),
        'ស្តារ replay ភ្លាមៗលើកទី ២ ត្រូវបដិសេធ (បើអត់ ➜ លុយបូកស្ទួន)');

    await seedRestoreStuck(false);
    check(denied(await asUser('PATCH', '/.json', restoreFinalizeUpdate('wrong_token'))),
        'ស្តារដោយ token ដែលមិនត្រូវនឹង claim ត្រូវបដិសេធ');

    await seedRestoreStuck(false);
    const noTrashDelete = restoreFinalizeUpdate('live_token');
    delete noTrashDelete[`zoew_recently_deleted_cod_dod/${SRC}`];
    check(denied(await asUser('PATCH', '/.json', noTrashDelete)),
        'ស្តារដោយមិនលុបធាតុធុងសំរាមក្នុង update ដដែល ត្រូវបដិសេធ');

    await seedRestoreStuck(false);
    const noMarkerClear = restoreFinalizeUpdate('live_token');
    delete noMarkerClear[`zoew_scan_history_cod_dod/${SRC}/restoreClaimId`];
    check(denied(await asUser('PATCH', '/.json', noMarkerClear)),
        'ស្តារដោយបន្សល់ restoreClaimId ក្នុងប្រវត្តិ ត្រូវបដិសេធ');

    await seedClearStuck(false);
    await asUser('PATCH', '/.json', clearFinalizeUpdate('live_c'));
    check(denied(await asUser('PATCH', '/.json', clearFinalizeUpdate('live_c'))),
        'លុបទាំងអស់ replay ភ្លាមៗលើកទី ២ ត្រូវបដិសេធ');

    await seedClearStuck(false);
    check(denied(await asUser('PATCH', '/.json', clearFinalizeUpdate('wrong_c'))),
        'លុបទាំងអស់ដោយ token ដែលមិនត្រូវនឹង clearClaim ត្រូវបដិសេធ');

    console.log('-- ៤. purge ធាតុធុងសំរាមដែល restoreClaim ងាប់ --');
    const PID = 'id_1750000000000_ccc';
    await asOwner('PUT', '/.json', null);
    await asOwner('PUT', `/zoew_recently_deleted_cod_dod/${PID}.json`,
        trashItem(PID, { restoreClaim: { token: 'dead', claimedAt: T0, targetId: PID } }));
    check(denied(await asUser('PATCH', '/.json', { [`zoew_recently_deleted_cod_dod/${PID}`]: null })),
        'ការលុបផ្ទាល់ ខណៈ restoreClaim ជាប់ ត្រូវបដិសេធ (ដូច្នេះការដោះ claim ជាមុនជាការចាំបាច់)');
    check(!denied(await asUser('PUT', `/zoew_recently_deleted_cod_dod/${PID}.json`, trashItem(PID))),
        'releaseStaleRestoreClaimForPurge ដោះ claim បាន');
    check(!denied(await asUser('PATCH', '/.json', { [`zoew_recently_deleted_cod_dod/${PID}`]: null })),
        'ក្រោយដោះ claim ➜ purge បាន');

    await asOwner('PUT', '/.json', null);
    await asOwner('PUT', '/zoew_recently_deleted_cod_dod/id_1750000000000_ok.json', trashItem('id_1750000000000_ok'));
    await asOwner('PUT', '/zoew_recently_deleted_cod_dod/id_1750000000000_bad.json',
        trashItem('id_1750000000000_bad', { restoreClaim: { token: 'dead', claimedAt: T0, targetId: 'id_1750000000000_bad' } }));
    await asUser('PATCH', '/.json', {
        'zoew_recently_deleted_cod_dod/id_1750000000000_ok': null,
        'zoew_recently_deleted_cod_dod/id_1750000000000_bad': null
    });
    const after = JSON.parse((await asOwner('GET', '/zoew_recently_deleted_cod_dod.json')).body || 'null') || {};
    check(!!after['id_1750000000000_ok'],
        'ការ purge ជាក្រុមជា atomic ➜ ធាតុ ១ ដែល claim ជាប់ ធ្វើឲ្យធាតុស្អាតជាប់ដែរ',
        Object.keys(after).join(','));

    console.log(`\n${fail ? '❌' : '✅'} pass=${pass} fail=${fail}`);
    if (fail) console.log('  namespace: ' + NS);
    else await asOwner('PUT', '/.json', null);
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
