/**
 * Acceptance tests: Install terminal output with plugin guidance
 *
 * Validates that the postinstall script output guides users to install
 * the plugin and does not reference the removed settings merge behavior.
 *
 * Driving port: postinstall-core.js functions (the domain logic for install).
 * The actual terminal output is produced by postinstall.js which calls these.
 */

import { describe, it, expect } from "vitest";
import { buildInstallSuccessMessage } from "../../../scripts/postinstall-core.js";

const PLUGIN_INSTALL_COMMAND = "/plugin install norbert@pmvanev-plugins";

describe("Terminal output includes plugin install command after successful install", () => {
  it("output contains 'To connect to Claude Code:' guidance", () => {
    const output = buildInstallSuccessMessage();
    expect(output).toContain("To connect to Claude Code:");
  });

  it("output contains the plugin install command", () => {
    const output = buildInstallSuccessMessage();
    expect(output).toContain(PLUGIN_INSTALL_COMMAND);
  });
});

describe("Terminal output does not mention settings merge or restart", () => {
  it("output does not contain 'settings'", () => {
    const output = buildInstallSuccessMessage();
    expect(output.toLowerCase()).not.toContain("settings");
  });

  it("output does not contain 'Restart Claude Code'", () => {
    const output = buildInstallSuccessMessage();
    expect(output).not.toContain("Restart Claude Code");
  });
});

describe("Terminal output does not reference settings.json", () => {
  it("output does not contain 'settings.json'", () => {
    const output = buildInstallSuccessMessage();
    expect(output).not.toContain("settings.json");
  });

  it("output does not contain '.claude/settings'", () => {
    const output = buildInstallSuccessMessage();
    expect(output).not.toContain(".claude/settings");
  });
});
