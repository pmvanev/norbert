import { defineConfig } from "vitest/config";

/**
 * Vitest config scoped for Stryker mutation testing of the config-cross-references
 * Detection Pipeline subsystem (detection/types.ts, inlineCodeStrategy.ts,
 * markdownLinkStrategy.ts, pipeline.ts, remarkPlugin.ts).
 *
 * Includes only the detection acceptance tests so Stryker has the smallest
 * viable test set per mutant -- keeps the per-mutant runtime low and makes
 * surviving mutants attributable to the detection test suite alone. Registry,
 * resolver, history and reducer mutants are exercised by their sibling stryker
 * configs.
 */
export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/acceptance/config-cross-references/detection.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/.stryker-tmp/**",
      "**/.stryker-tmp-detection/**",
    ],
  },
});
