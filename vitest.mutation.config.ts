import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/acceptance/config-env-viewer/**/*.test.{ts,tsx}",
      "tests/acceptance/norbert-config/**/*.test.ts",
      "tests/unit/plugins/norbert-config/**/*.test.ts",
    ],
  },
});
