import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(ROOT, 'src') } },
    define: {
        __APP_VERSION__: JSON.stringify('test'),
        __CACHE_VERSION__: JSON.stringify('test')
    },
    test: {
        environment: 'happy-dom',
        include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        restoreMocks: true
    }
});
