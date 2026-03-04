/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  mutate: [
    'packages/config-explorer/src/**/*.ts',
    '!packages/config-explorer/src/**/*.test.ts',
    '!packages/config-explorer/src/__tests__/**',
    '!packages/config-explorer/src/types/**',
    '!packages/config-explorer/src/index.ts',
    '!packages/config-explorer/src/parsers/index.ts',
    '!packages/config-explorer/src/ports.ts',
  ],
  testRunner: 'vitest',
  checkers: [],
  reporters: ['clear-text', 'progress'],
  concurrency: 4,
  timeoutMS: 30000,
  thresholds: {
    high: 90,
    low: 80,
    break: 80,
  },
};

export default config;
