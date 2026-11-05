'use strict';
// ⛔ កិច្ចសន្យា exit របស់ `run-all.sh` ៖ «`process.exitCode = 1` នៅខាងលើ · តែសេចក្តីសង្ខេបទេដែលបន្ថយវា»។
// `runall_exec` preload ឯកសារនេះ (`node --require <ឯកសារនេះ> …`) ទៅ checker `node` គ្រប់ job ហើយដាក់ env
// `ZOE_RUNALL_EXIT_GUARD=1` ➜ checker ចាប់ផ្តើមដោយ exit code «មិនទាន់សម្រេច»។ checker ដែល `await` promise ដែល
// មិនដែល settle ធ្វើឲ្យ event loop ហូរអស់ ហើយ Node ចេញ 0 ដោយការអះអាងដែលនៅសល់មិនដែលរត់ ➜ ឥឡូវ exit 1
// ព្រោះសេចក្តីសង្ខេប (ដែលសម្រេច `process.exitCode = 0` ឬ `process.exit(0)`) មិនដែលមកដល់។
// ⛔ env ត្រូវដកចេញភ្លាម ៖ កូន (`fork` ទទួល `--require` តាម execArgv · `spawn` ទទួល env) មិនត្រូវទទួលកិច្ចសន្យានេះ
//    ទេ (vitest · tsc · emulator · checker កូនរបស់ meta-checker វិនិច្ឆ័យដោយម្ចាស់វា)។
// ⛔ សញ្ញាសម្គាល់ ≠ 1 ៖ checker ដែលកំណត់ `process.exitCode = 1` ខ្លួនឯង (ការធ្លាក់ពិត) មិនទទួលសារ «គ្មានការសម្រេច» ទេ។
const UNDECIDED = 86;
if (process.env.ZOE_RUNALL_EXIT_GUARD === '1') {
    delete process.env.ZOE_RUNALL_EXIT_GUARD;
    process.exitCode = UNDECIDED;
    process.on('exit', () => {
        if (process.exitCode !== UNDECIDED) return;
        process.exitCode = 1;
        try {
            process.stderr.write('\n  FAIL  ZOE_RUNALL_EXIT_GUARD ៖ checker ចប់ដោយមិនបានសម្រេច exit code — សេចក្តីសង្ខេបមិនដែលរត់'
                + ' (promise ដែលមិនដែល settle ធ្វើឲ្យ event loop ហូរអស់?) ឬសេចក្តីសង្ខេបមិនកំណត់ `process.exitCode = 0`'
                + ' / `process.exit(0)` ➜ exit 1\n');
        } catch (e) {}
    });
}
