/**
 * ផ្ទៀងវិញ្ញាបនបត្រ sign របស់ APK (output `apksigner verify -v --print-certs`) ធៀបនឹង pin `android/release-cert.sha256`។
 *
 * ⛔ ហេតុអ្វីជាស្គ្រីបដាច់ ៖ workflow ធ្លាប់ `grep 'Signer #1 certificate SHA-256 digest'` ➜ apksigner ថ្មីសរសេរ
 *    `V2 Signer: certificate SHA-256 digest` ➜ អានបាន «គ្មាន» ➜ Release ធ្លាក់ ខណៈវិញ្ញាបនបត្រស្មើ pin បេះបិទ
 *    (វាស់បាន ៖ run Android APK លើ main · 2026-10-01)។ ការស្រង់រស់នៅទីនេះ ➜ `android:check` រត់វាលើ output ពិត
 *    ទាំង ២ ទម្រង់ និងករណីបដិសេធ (signer ២ · digest ផ្សេង · scheme ខុសគ្នា · មិន Verifies)។
 *
 * ការប្រើ ៖ node scripts/apk-cert-check.mjs <apk-certs.txt> <release-cert.sha256>
 *   ជោគជ័យ ➜ បោះពុម្ព digest · exit 0 · បរាជ័យ ➜ មូលហេតុលើ stderr · exit 1
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const CERT_LINE = /^(?:Signer #\d+|V\d+(?:\.\d+)? Signer|Signer)\s*:?\s*certificate SHA-256 digest:\s*([0-9a-fA-F:]+)\s*$/;

export function apkCertVerdict(text, pinText) {
    const lines = String(text || '').split(/\r?\n/).map((l) => l.trim());
    const pin = String(pinText || '').replace(/\s+/g, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(pin)) return { ok: false, why: 'pin មិនមែន SHA-256 (64 hex)' };
    if (!lines.includes('Verifies')) return { ok: false, why: 'apksigner មិនរាយ «Verifies» (ហត្ថលេខាខូច ឬ verify ធ្លាក់)' };
    const signers = lines.map((l) => /^Number of signers:\s*(\d+)$/.exec(l)).filter(Boolean).map((m) => Number(m[1]));
    if (signers.length !== 1 || signers[0] !== 1) return { ok: false, why: 'ចំនួន signer មិនមែន ១ (' + (signers.join(',') || 'គ្មាន') + ')' };
    const digests = [...new Set(lines.map((l) => CERT_LINE.exec(l)).filter(Boolean).map((m) => m[1].replace(/:/g, '').toLowerCase()))];
    if (!digests.length) return { ok: false, why: 'រក «certificate SHA-256 digest» មិនឃើញ' };
    if (digests.length !== 1) return { ok: false, why: 'វិញ្ញាបនបត្រខុសគ្នាតាម scheme (' + digests.map((d) => d.slice(0, 12)).join(' · ') + ')' };
    if (digests[0] !== pin) return { ok: false, why: 'វិញ្ញាបនបត្រ ' + digests[0] + ' មិនស្មើ pin ' + pin, digest: digests[0] };
    return { ok: true, digest: digests[0] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
    const [certsPath, pinPath] = process.argv.slice(2);
    let verdict;
    try {
        verdict = apkCertVerdict(fs.readFileSync(certsPath, 'utf8'), fs.readFileSync(pinPath, 'utf8'));
    } catch (e) {
        verdict = { ok: false, why: 'អានឯកសារមិនបាន ៖ ' + e.message };
    }
    if (verdict.ok) {
        process.stdout.write(verdict.digest + '\n');
    } else {
        process.stderr.write(verdict.why + '\n');
        process.exitCode = 1;
    }
}
