import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@norbert/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@norbert/config': path.resolve(__dirname, 'packages/config/src/index.ts'),
      '@norbert/storage': path.resolve(__dirname, 'packages/storage/src/index.ts'),
      '@norbert/server': path.resolve(__dirname, 'packages/server/src/index.ts'),
      '@norbert/cli': path.resolve(__dirname, 'packages/cli/src/index.ts'),
      '@norbert/dashboard': path.resolve(__dirname, 'packages/dashboard/src/index.ts'),
      '@norbert/hooks': path.resolve(__dirname, 'packages/hooks/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    globals: false,
  },
});
