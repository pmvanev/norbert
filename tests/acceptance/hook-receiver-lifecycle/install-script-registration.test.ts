/**
 * Acceptance tests: Install scripts integrate hook receiver registration (US-HRIL-01, Step 01-03)
 *
 * Validates that the standalone install scripts (install.ps1, install.sh) include
 * hook receiver task registration, process lifecycle management, and non-fatal
 * error handling -- without requiring Node.js at runtime.
 *
 * Testing approach: Static content verification of script files. The domain logic
 * (command building, registration) is tested via postinstall-core.js unit tests.
 * These tests verify the scripts contain the correct integration of that logic.
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

const TASK_NAME = "NorbertHookReceiver";

describe("install.ps1 registers hook receiver task and starts receiver", () => {
  it("registers a scheduled task named NorbertHookReceiver", () => {
    expect(INSTALL_PS1).toContain("Register-ScheduledTask");
    expect(INSTALL_PS1).toContain(TASK_NAME);
  });

  it("uses AtLogOn trigger for automatic startup", () => {
    expect(INSTALL_PS1).toContain("New-ScheduledTaskTrigger");
    expect(INSTALL_PS1).toContain("-AtLogOn");
  });

  it("uses Force flag for idempotent re-registration", () => {
    expect(INSTALL_PS1).toContain("-Force");
  });

  it("stops existing receiver before binary extraction", () => {
    const stopIndex = INSTALL_PS1.indexOf("Stop-Process");
    const extractIndex = INSTALL_PS1.indexOf("tar -xzf");
    expect(stopIndex).toBeGreaterThan(-1);
    expect(extractIndex).toBeGreaterThan(-1);
    expect(stopIndex).toBeLessThan(extractIndex);
  });

  it("starts new receiver after extraction and registration", () => {
    const extractIndex = INSTALL_PS1.indexOf("tar -xzf");
    const registerIndex = INSTALL_PS1.indexOf("Register-ScheduledTask");
    const startIndex = INSTALL_PS1.indexOf("Start-Process");
    expect(startIndex).toBeGreaterThan(extractIndex);
    expect(startIndex).toBeGreaterThan(registerIndex);
  });

  it("handles registration failure as non-fatal warning", () => {
    // The catch block after Register-ScheduledTask should contain a Warning
    const registerIndex = INSTALL_PS1.indexOf("Register-ScheduledTask");
    expect(registerIndex).toBeGreaterThan(-1);

    const warningIndex = INSTALL_PS1.indexOf("Warning", registerIndex);
    expect(warningIndex).toBeGreaterThan(registerIndex);
  });
});

describe("install.sh registers hook receiver on Windows (win32 platform)", () => {
  it("registers a scheduled task named NorbertHookReceiver via powershell.exe", () => {
    expect(INSTALL_SH).toContain("Register-ScheduledTask");
    expect(INSTALL_SH).toContain(TASK_NAME);
    expect(INSTALL_SH).toContain("powershell.exe");
  });

  it("uses AtLogOn trigger for automatic startup", () => {
    expect(INSTALL_SH).toContain("New-ScheduledTaskTrigger");
    expect(INSTALL_SH).toContain("-AtLogOn");
  });

  it("uses Force flag for idempotent re-registration", () => {
    // Check -Force appears in the registration context
    expect(INSTALL_SH).toContain("-Force");
  });

  it("only runs registration on win32 platform", () => {
    // Registration should be inside a win32-* case block
    expect(INSTALL_SH).toMatch(/win32-\*\)[\s\S]*Register-ScheduledTask/);
  });

  it("stops existing receiver before binary extraction", () => {
    const stopIndex = INSTALL_SH.indexOf("Stop-Process");
    const extractIndex = INSTALL_SH.indexOf("tar -xzf");
    expect(stopIndex).toBeGreaterThan(-1);
    expect(extractIndex).toBeGreaterThan(-1);
    expect(stopIndex).toBeLessThan(extractIndex);
  });

  it("starts new receiver after extraction and registration", () => {
    const extractIndex = INSTALL_SH.indexOf("tar -xzf");
    const registerIndex = INSTALL_SH.indexOf("Register-ScheduledTask");
    const startIndex = INSTALL_SH.indexOf("Start-Process -FilePath");
    expect(startIndex).toBeGreaterThan(extractIndex);
    expect(startIndex).toBeGreaterThan(registerIndex);
  });

  it("handles registration failure as non-fatal warning", () => {
    expect(INSTALL_SH).toMatch(/[Ww]arning.*[Cc]ould not register/i);
  });
});
