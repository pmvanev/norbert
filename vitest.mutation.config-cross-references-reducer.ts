import { defineConfig } from "vitest/config";

/**
 * Vitest config scoped for Stryker mutation testing of the config-cross-references
 * ConfigNavReducer module.
 *
 * Includes only the reducer acceptance tests so Stryker has the smallest viable
 * test set per mutant -- keeps the per-mutant runtime low and makes surviving
 * mutants attributable to the reducer test suite alone. Registry, resolver and
 * history mutants are exercised by their sibling stryker configs.
 */
export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/acceptance/config-cross-references/reducer.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/.stryker-tmp/**",
      "**/.stryker-tmp-reducer/**",
    ],
  },
});
