/**
 * Acceptance tests: Install scripts integrate hook receiver startup (US-HRIL-01, Step 01-03)
 *
 * Validates that the standalone install scripts (install.ps1, install.sh) include
 * hook receiver startup shortcut creation, process lifecycle management, and
 * non-fatal error handling -- without requiring Node.js at runtime.
 *
 * Testing approach: Static content verification of script files.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const INSTALL_PS1 = readFileSync(
  path.join(PROJECT_ROOT, "install.ps1"),
  "utf-8"
);
const INSTALL_SH = readFileSync(
  path.join(PROJECT_ROOT, "install.sh"),
  "utf-8"
);

const SHORTCUT_NAME = "NorbertHookReceiver.lnk";

describe("install.ps1 creates startup shortcut and starts receiver", () => {
  it("creates a startup shortcut named NorbertHookReceiver.lnk", () => {
    expect(INSTALL_PS1).toContain("CreateShortcut");
    expect(INSTALL_PS1).toContain(SHORTCUT_NAME);
  });

  it("places shortcut in the Windows Startup folder", () => {
    expect(INSTALL_PS1).toContain("Startup");
    expect(INSTALL_PS1).toContain(SHORTCUT_NAME);
  });

  it("uses hidden window style for the shortcut", () => {
    expect(INSTALL_PS1).toContain("WindowStyle");
  });

  it("stops existing receiver before binary extraction", () => {
    const stopIndex = INSTALL_PS1.indexOf("Stop-Process");
    const extractIndex = INSTALL_PS1.indexOf("tar -xzf");
    expect(stopIndex).toBeGreaterThan(-1);
    expect(extractIndex).toBeGreaterThan(-1);
    expect(stopIndex).toBeLessThan(extractIndex);
  });

  it("starts new receiver after extraction", () => {
    const extractIndex = INSTALL_PS1.indexOf("tar -xzf");
    const startIndex = INSTALL_PS1.indexOf("Start-Process");
    expect(startIndex).toBeGreaterThan(extractIndex);
  });

  it("handles shortcut creation failure as non-fatal warning", () => {
    const shortcutIndex = INSTALL_PS1.indexOf("startup shortcut");
    expect(shortcutIndex).toBeGreaterThan(-1);

    const warningIndex = INSTALL_PS1.indexOf("Warning", shortcutIndex);
    expect(warningIndex).toBeGreaterThan(shortcutIndex);
  });
});

describe("install.sh creates startup shortcut on Windows (win32 platform)", () => {
  it("creates a startup shortcut via powershell.exe", () => {
    expect(INSTALL_SH).toContain("CreateShortcut");
    expect(INSTALL_SH).toContain(SHORTCUT_NAME);
    expect(INSTALL_SH).toContain("powershell.exe");
  });

  it("places shortcut in the Windows Startup folder", () => {
    expect(INSTALL_SH).toContain("Startup");
    expect(INSTALL_SH).toContain(SHORTCUT_NAME);
  });

  it("uses hidden window style for the shortcut", () => {
    expect(INSTALL_SH).toContain("WindowStyle");
  });

  it("only runs shortcut creation on win32 platform", () => {
    expect(INSTALL_SH).toMatch(/win32-\*\)[\s\S]*CreateShortcut/);
  });

  it("stops existing receiver before binary extraction", () => {
    const stopIndex = INSTALL_SH.indexOf("Stop-Process");
    const extractIndex = INSTALL_SH.indexOf("tar -xzf");
    expect(stopIndex).toBeGreaterThan(-1);
    expect(extractIndex).toBeGreaterThan(-1);
    expect(stopIndex).toBeLessThan(extractIndex);
  });

  it("starts new receiver after extraction", () => {
    const extractIndex = INSTALL_SH.indexOf("tar -xzf");
    const startIndex = INSTALL_SH.indexOf("Start-Process -FilePath");
    expect(startIndex).toBeGreaterThan(extractIndex);
  });

  it("handles shortcut creation failure as non-fatal warning", () => {
    expect(INSTALL_SH).toMatch(/[Ww]arning.*[Cc]ould not create startup shortcut/i);
  });
});
