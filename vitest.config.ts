import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const sourceRoot = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': sourceRoot
    }
  },
  test: {
    environment: 'node',
    include: [
      'tests/unit/**/*.test.{ts,tsx}',
      'tests/component/**/*.test.{ts,tsx}',
      'tests/integration/**/*.test.{ts,tsx}',
      'tests/contracts/**/*.test.{ts,tsx}'
    ],
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/lib/**/*.ts',
        'src/stores/**/*.ts',
        'src/app/api/**/*.ts'
      ],
      exclude: [
        'src/lib/db.ts',
        'src/lib/redis.ts',
        'src/lib/r2.ts',
        'src/lib/realtime.ts',
        'src/lib/realtimeServer.ts'
      ],
      thresholds: {
        lines: 18,
        functions: 24,
        statements: 17,
        branches: 13
      }
    }
  }
});
