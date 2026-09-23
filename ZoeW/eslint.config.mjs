import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
    { ignores: ['dist', 'dist-audit', 'node_modules', 'public', 'src/_generated-state.json'] },

    /* ── កូដ React និងកូដថ្មី ៖ វិន័យពេញ ──────────────────────────────── */
    {
        files: ['src/app/**/*.{ts,tsx}', 'src/main.tsx', 'src/core/store.ts', 'src/core/dom.ts', 'src/core/lifecycle.ts', 'tests/**/*.{ts,tsx}'],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: { ecmaVersion: 2023, globals: globals.browser },
        plugins: { 'react-hooks': reactHooks },
        rules: {
            ...reactHooks.configs.recommended.rules,
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
        }
    },

    /*
     * ── កូដដែលផ្ទេរពី `app.js` ៖ វិន័យទន់ ────────────────────────────
     * ⛔ ហេតុផល ៖ ឯកសារទាំងនេះជា **ការផ្ទេរ ១:១** ។ ការ «សម្អាត» វាតាម
     *    lint ជាការកែឥរិយាបថដោយគ្មានអ្នកវាស់ — ហើយ `docs/PARITY.md`
     *    ពឹងលើការពិតដែលថាតួ function មិនប្រែ។ ច្បាប់ដែលបើកទុក គឺច្បាប់
     *    ដែលចាប់ **កំហុសពិត** (អថេរស្ទួន · case ធ្លាក់ · `debugger`)។
     */
    {
        files: ['src/core/**/*.ts', 'src/domain/**/*.ts', 'src/features/**/*.ts', 'src/services/**/*.ts', 'src/ui/**/*.ts', 'src/boot/**/*.ts'],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ZoeErrors: 'readonly', ZoeLicense: 'readonly', XLSX: 'readonly', ZXingWASM: 'readonly', Sentry: 'readonly', BarcodeDetector: 'readonly' } },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            'no-empty': 'off',
            'no-cond-assign': 'off',
            'no-control-regex': 'off',
            'no-useless-escape': 'off',
            'prefer-const': 'off',
            'no-var': 'off',
            'prefer-spread': 'off',
            'prefer-rest-params': 'off',
            'no-redeclare': 'error',
            'no-dupe-keys': 'error',
            'no-fallthrough': 'error',
            'no-debugger': 'error',
            'no-unreachable': 'error'
        }
    },

    /* ── Service worker ─────────────────────────────────────────────── */
    {
        files: ['src/sw/**/*.ts'],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: { ecmaVersion: 2023, globals: globals.serviceworker },
        rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-empty': 'off', '@typescript-eslint/no-unused-vars': 'off' }
    },

    /* ── Script របស់ Node ៖ ខ្លះចាក់កូដចូល browser (Playwright) ─────── */
    {
        files: ['scripts/**/*.mjs'],
        extends: [js.configs.recommended],
        languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
        rules: { 'no-empty': 'off', 'no-useless-escape': 'off', 'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }] }
    },

    /* ── Codemod (CommonJS) ─────────────────────────────────────────── */
    {
        files: ['tools/**/*.cjs'],
        extends: [js.configs.recommended],
        languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
        linterOptions: { reportUnusedDisableDirectives: false },
        rules: { 'no-empty': 'off', 'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }] }
    },

    /* ── Config របស់ build ──────────────────────────────────────────── */
    {
        files: ['vite.config.mts', 'vitest.config.mts'],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
        rules: { '@typescript-eslint/no-explicit-any': 'off' }
    }
);
