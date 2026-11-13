import js from '@eslint/js';
import { fileURLToPath } from 'node:url';

import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const REPO = fileURLToPath(new URL('../', import.meta.url));

export default tseslint.config(
    { ignores: ['**/dist/**', '**/dist-audit/**', '**/node_modules/**', '**/public/**', '**/android/**', '**/src/_generated-state.json'] },

    {
        basePath: REPO,
        files: ['ZoeW/src/app/**/*.{ts,tsx}', 'ZoeW/src/platform/**/*.ts', 'ZoeW/src/main.tsx', 'ZoeW/src/core/store.ts', 'ZoeW/src/core/dom.ts', 'ZoeW/src/core/lifecycle.ts', 'tools/audit-tools/zoew/tests/**/*.{ts,tsx}'],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ZoeErrors: 'readonly', XLSX: 'readonly' } },
        plugins: { 'react-hooks': reactHooks },
        rules: {
            ...reactHooks.configs.recommended.rules,
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-empty': ['error', { allowEmptyCatch: true }]
        }
    },

    {
        basePath: REPO,
        files: ['ZoeW/src/core/**/*.ts', 'ZoeW/src/domain/**/*.ts', 'ZoeW/src/features/**/*.ts', 'ZoeW/src/services/**/*.ts', 'ZoeW/src/ui/**/*.ts'],
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
            'no-useless-assignment': 'off',
            'preserve-caught-error': 'off',
            'no-redeclare': 'error',
            'no-dupe-keys': 'error',
            'no-fallthrough': 'error',
            'no-debugger': 'error',
            'no-unreachable': 'error'
        }
    },

    {
        basePath: REPO,
        files: ['ZoeW/src/app/components/history/HistoryTableBody.tsx'],
        rules: { 'react-hooks/incompatible-library': 'off' }
    },

    {
        basePath: REPO,
        files: ['ZoeW/src/app/behaviors/**/*.ts'],
        languageOptions: { globals: { ZoeLicense: 'readonly' } },
        rules: { 'no-empty': 'off', 'prefer-const': 'off', '@typescript-eslint/no-unused-vars': 'off' }
    },

    {
        basePath: REPO,
        files: ['ZoeW/src/sw/**/*.ts'],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: { ecmaVersion: 2023, globals: globals.serviceworker },
        rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-empty': 'off', '@typescript-eslint/no-unused-vars': 'off' }
    },

    {
        basePath: REPO,
        files: ['ZoeW/scripts/**/*.mjs', 'tools/audit-tools/zoew/scripts/**/*.mjs', 'tools/audit-tools/zoew/prepare-dependencies.mjs'],
        extends: [js.configs.recommended],
        languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
        rules: { 'no-empty': 'off', 'no-useless-escape': 'off', 'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }] }
    },

    {
        basePath: REPO,
        files: ['ZoeW/tools/**/*.cjs'],
        extends: [js.configs.recommended],
        languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
        linterOptions: { reportUnusedDisableDirectives: false },
        rules: { 'no-empty': 'off', 'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }] }
    },

    {
        basePath: REPO,
        files: ['ZoeW/vite.config.mts', 'tools/audit-tools/zoew/vitest.config.mts', 'ZoeW/capacitor.config.ts'],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
        rules: { '@typescript-eslint/no-explicit-any': 'off' }
    }
);
