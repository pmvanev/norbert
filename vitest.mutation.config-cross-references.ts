import { defineConfig } from "vitest/config";

/**
 * Vitest config scoped for Stryker mutation testing of the config-cross-references
 * registry module.
 *
 * Includes only the registry acceptance tests so Stryker has the smallest viable
 * test set per mutant — keeps the per-mutant runtime low and makes surviving
 * mutants attributable to the registry test suite alone.
 */
export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/acceptance/config-cross-references/registry.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/.stryker-tmp/**",
    ],
  },
});
