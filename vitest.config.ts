import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    // Alcuni test giocano stagioni intere.
    testTimeout: 60_000,
    environment: 'node',
  },
});
