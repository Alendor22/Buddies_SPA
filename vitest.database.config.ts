import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const sourceRoot = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': sourceRoot
    }
  },
  test: {
    environment: 'node',
    include: ['tests/database/**/*.test.ts'],
    setupFiles: ['./tests/setup/database.setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000
  }
});
