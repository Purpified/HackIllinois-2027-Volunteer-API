import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    pool: 'forks',
    restoreMocks: true,
    testTimeout: 20_000,
    hookTimeout: 90_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/server.ts', 'src/seed.ts'],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
    },
  },
});
