import { defineConfig } from "vitest/config";

/**
 * Vitest config scoped for Stryker mutation testing of the config-cross-references
 * resolver module.
 *
 * Includes only the resolver acceptance tests so Stryker has the smallest viable
 * test set per mutant -- keeps the per-mutant runtime low and makes surviving
 * mutants attributable to the resolver test suite alone. Registry mutants are
 * exercised by the sibling stryker.config-cross-references.conf.json run.
 */
export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/acceptance/config-cross-references/resolver.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/.stryker-tmp/**",
    ],
  },
});
