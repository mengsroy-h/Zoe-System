import fs from 'node:fs';
import path from 'node:path';

/**
 * ទីតាំងរបស់ **ZoeW ដើម** (កំណែ vanilla JS) ដែលការវាស់ parity ប្រៀបធៀបជាមួយ។
 *
 * ⛔ វាជា **អ្នកសម្រេច** ៖ ការវាស់ប្រៀបធៀបនឹង App ចាស់ដែលកំពុងរត់ពិតៗ មិនមែននឹង
 *    ការរំពឹងទុកដែលសរសេរដោយដៃ។ ក្នុង repo ថ្ត `ZoeW/` ខ្លួនវាជា App React ➜
 *    ដើមត្រូវទាញពី git ៖ `npm run original:fetch` (➜ `.original/ZoeW`)។
 *
 * ⛔⛔ **ការប្រៀបធៀប App ជាមួយខ្លួនវា = បៃតងក្លែងក្លាយ** ៖ បើផ្លូវចង្អុលទៅ App React
 *    (មាន `src/main.tsx`) ការវាស់គ្រប់ជាន់នឹងរាយ ១០០% ដោយគ្មានអ្វីត្រូវវាស់ ➜ បដិសេធ។
 */
export function resolveOldRoot(here) {
    const project = path.join(here, '..');
    const root = process.env.OLD_APP_DIR || path.join(project, '.original', 'ZoeW');
    const selfLike = fs.existsSync(path.join(root, 'src', 'main.tsx')) || path.resolve(root) === path.resolve(project);
    if (selfLike) {
        console.error('⛔ OLD_APP_DIR ចង្អុលទៅ App React ខ្លួនវា (' + root + ') — ការប្រៀបធៀបជាមួយខ្លួនឯង');
        console.error('   នឹងបៃតងដោយគ្មានអ្វីត្រូវវាស់។ សូមប្រើ ZoeW ដើម ៖  npm run original:fetch');
        process.exit(2);
    }
    if (fs.existsSync(path.join(root, 'app.js'))) return root;
    console.error('');
    console.error('⛔ រក ZoeW ដើមមិនឃើញ ៖ ' + path.join(root, 'app.js'));
    console.error('');
    console.error('   ការវាស់ parity ប្រៀបធៀបនឹង **ZoeW ដើម** (vanilla JS) ➜ វាត្រូវការថតនោះ។');
    console.error('');
    console.error('   ដំណោះស្រាយ ៖');
    console.error('     npm run original:fetch              # ទាញពី git (origin/main ➜ .original/ZoeW)');
    console.error('     OLD_APP_DIR=/path/to/ZoeW npm run parity');
    console.error('');
    console.error('   បើអ្នកគ្រាន់តែចង់ build និងសាក App ៖');
    console.error('     npm run typecheck && npm run lint && npm test && npm run build');
    console.error('');
    process.exit(2);
}
