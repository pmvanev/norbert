import { defineConfig } from "vitest/config";

/**
 * Vitest config scoped for Stryker mutation testing of the config-cross-references
 * NavHistory module.
 *
 * Includes only the history acceptance tests so Stryker has the smallest viable
 * test set per mutant -- keeps the per-mutant runtime low and makes surviving
 * mutants attributable to the history test suite alone. Registry and resolver
 * mutants are exercised by their sibling stryker configs.
 */
export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/acceptance/config-cross-references/history.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/.stryker-tmp/**",
      "**/.stryker-tmp-history/**",
    ],
  },
});
