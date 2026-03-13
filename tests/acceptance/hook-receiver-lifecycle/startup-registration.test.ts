/**
 * Acceptance tests: Hook Receiver Startup Registration (US-HRIL-01)
 *
 * Validates that the install process creates a startup shortcut for the hook
 * receiver for automatic startup at user logon, idempotently, with non-fatal
 * failure handling.
 *
 * Driving ports: postinstall-core.js domain functions
 * (getInstallDirectory, buildStartupShortcutCommand, registerAndStartHookReceiver).
 *
 * External dependencies (filesystem, PowerShell) are mocked.
 * Internal components are never tested directly.
 */

import { describe, it, expect } from "vitest";
import {
  getInstallDirectory,
  STARTUP_SHORTCUT_NAME,
  buildStartupShortcutCommand,
  registerAndStartHookReceiver,
} from "../../../scripts/postinstall-core.js";

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("Install creates startup shortcut and confirms to user", () => {
  it("startup shortcut targets the hook receiver binary in the install directory", () => {
    const homeDir = "C:\\Users\\Phil";
    const installDir = getInstallDirectory(homeDir);
    const appDataDir = "C:\\Users\\Phil\\AppData\\Roaming";
    const command = buildStartupShortcutCommand(installDir, appDataDir);

    expect(command).toContain(
      "C:\\Users\\Phil\\.norbert\\bin\\norbert-hook-receiver.exe"
    );
  });

  it("startup shortcut is placed in the Windows Startup folder", () => {
    const homeDir = "C:\\Users\\Phil";
    const installDir = getInstallDirectory(homeDir);
    const appDataDir = "C:\\Users\\Phil\\AppData\\Roaming";
    const command = buildStartupShortcutCommand(installDir, appDataDir);

    expect(command).toContain("Startup");
    expect(command).toContain(STARTUP_SHORTCUT_NAME);
  });

  it.skip("install output confirms 'Startup shortcut created'", () => {
    // Driving port: buildInstallSuccessMessage() updated to include
    // startup shortcut confirmation.
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Shortcut Parameters
// ---------------------------------------------------------------------------

describe("Shortcut command builds correct parameters from install directory", () => {
  it("shortcut name is 'NorbertHookReceiver.lnk' in the command", () => {
    const installDir = "C:\\Users\\Phil\\.norbert\\bin";
    const appDataDir = "C:\\Users\\Phil\\AppData\\Roaming";
    const command = buildStartupShortcutCommand(installDir, appDataDir);

    expect(command).toContain("NorbertHookReceiver.lnk");
  });

  it("shortcut target path matches the hook receiver binary in the install directory", () => {
    const installDir = "C:\\Users\\Phil\\.norbert\\bin";
    const appDataDir = "C:\\Users\\Phil\\AppData\\Roaming";
    const command = buildStartupShortcutCommand(installDir, appDataDir);

    expect(command).toContain(
      "C:\\Users\\Phil\\.norbert\\bin\\norbert-hook-receiver.exe"
    );
  });
});

describe("Shortcut creation is idempotent on reinstall", () => {
  it("shortcut command uses WScript.Shell CreateShortcut (overwrites existing)", () => {
    const installDir = "C:\\Users\\Phil\\.norbert\\bin";
    const appDataDir = "C:\\Users\\Phil\\AppData\\Roaming";
    const command = buildStartupShortcutCommand(installDir, appDataDir);

    expect(command).toContain("CreateShortcut");
    expect(command).toContain("WScript.Shell");
  });
});

describe("Install output confirms startup shortcut creation", () => {
  it.skip("output includes 'Startup shortcut created' on successful creation", () => {
    // Driving port: updated buildInstallSuccessMessage() from postinstall-core.js
  });
});

describe("Install success message guides user to start receiver or reboot", () => {
  it.skip("output includes guidance to start the hook receiver manually", () => {
    // Driving port: buildInstallSuccessMessage() from postinstall-core.js
  });

  it.skip("output mentions automatic startup on reboot", () => {
    // Driving port: buildInstallSuccessMessage() from postinstall-core.js
  });
});

// @property
describe("Shortcut target path always matches the install directory binary", () => {
  it("for any valid install directory, the shortcut targets the hook receiver binary", () => {
    const appDataDir = "C:\\Users\\Phil\\AppData\\Roaming";
    const sampleDirs = [
      "C:\\Users\\Phil\\.norbert\\bin",
      "C:\\Users\\Another User\\.norbert\\bin",
      "D:\\custom\\.norbert\\bin",
    ];

    for (const installDir of sampleDirs) {
      const command = buildStartupShortcutCommand(installDir, appDataDir);
      expect(command).toContain("norbert-hook-receiver.exe");
    }
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS
// ---------------------------------------------------------------------------

describe("Shortcut creation failure is non-fatal and install completes", () => {
  it("install output includes non-fatal warning on creation failure", () => {
    const installDir = "C:\\Users\\Phil\\.norbert\\bin";
    const platform = { os: "win32", arch: "x64", extension: ".tar.gz" };
    const appDataDir = "C:\\Users\\Phil\\AppData\\Roaming";
    let callCount = 0;
    const execCommand = () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Access denied");
      }
    };

    const result = registerAndStartHookReceiver(installDir, platform, execCommand, appDataDir);

    expect(result.warnings).toContain("Could not create startup shortcut (non-fatal).");
    expect(result.started).toBe(true);
  });
});

describe("Registration on unsupported platform is skipped", () => {
  it("startup registration is skipped without error on non-Windows platform", () => {
    const installDir = "/home/user/.norbert/bin";
    const platform = { os: "darwin", arch: "arm64", extension: ".tar.gz" };
    const executedCommands: string[] = [];
    const execCommand = (cmd: string) => executedCommands.push(cmd);

    const result = registerAndStartHookReceiver(installDir, platform, execCommand);

    expect(executedCommands).toEqual([]);
    expect(result.registered).toBe(false);
    expect(result.started).toBe(false);
    expect(result.warnings).toEqual([]);
  });
});

describe("Registration with missing binary path produces clear feedback", () => {
  it.skip("install output warns about the missing binary", () => {
    // INTEGRATION: requires real filesystem to validate binary existence check.
  });
});

describe("Shortcut handles special characters in home directory path", () => {
  it("shortcut target path is properly quoted for paths with spaces", () => {
    const installDir = "C:\\Users\\Phil Van Every\\.norbert\\bin";
    const appDataDir = "C:\\Users\\Phil Van Every\\AppData\\Roaming";
    const command = buildStartupShortcutCommand(installDir, appDataDir);

    expect(command).toContain(
      "'C:\\Users\\Phil Van Every\\.norbert\\bin\\norbert-hook-receiver.exe'"
    );
  });
});
