import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    root: path.resolve(ROOT, '../../ZoeW'),
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(ROOT, '../../ZoeW/src') } },
    define: {
        __APP_VERSION__: JSON.stringify('test'),
        __CACHE_VERSION__: JSON.stringify('test'),
        __FCM_CONFIGURED__: JSON.stringify(true)
    },
    test: {
        environment: 'happy-dom',
        include: ['../audit-tools/zoew/tests/**/*.test.ts', '../audit-tools/zoew/tests/**/*.test.tsx'],
        globals: true,
        setupFiles: ['../audit-tools/zoew/tests/setup.ts'],
        restoreMocks: true
    }
});
