/**
 * Acceptance tests: Hook Receiver Startup Registration (US-HRIL-01)
 *
 * Validates that the install process registers the hook receiver for
 * automatic startup at user logon, idempotently, with non-fatal failure.
 *
 * Driving ports: postinstall-core.js domain functions
 * (getInstallDirectory, buildInstallSuccessMessage, and the new
 * task registration functions to be implemented).
 *
 * External dependencies (Task Scheduler, filesystem) are mocked.
 * Internal components are never tested directly.
 */

import { describe, it, expect } from "vitest";
import {
  getInstallDirectory,
  TASK_NAME,
  buildTaskRegistrationCommand,
  registerAndStartHookReceiver,
} from "../../../scripts/postinstall-core.js";

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("Install registers startup task and confirms to user", () => {
  it("startup task targets the hook receiver binary in the install directory", () => {
    const homeDir = "C:\\Users\\Phil";
    const installDir = getInstallDirectory(homeDir);
    const command = buildTaskRegistrationCommand(installDir);

    // Assert the complete expected path appears in the registration command
    expect(command).toContain(
      "C:\\Users\\Phil\\.norbert\\bin\\norbert-hook-receiver.exe"
    );
  });

  it("startup task is configured to run at user logon", () => {
    // GIVEN: Phil installs Norbert on a fresh Windows machine
    const homeDir = "C:\\Users\\Phil";
    const installDir = getInstallDirectory(homeDir);

    // WHEN: the installer registers the hook receiver for automatic startup
    const command = buildTaskRegistrationCommand(installDir);

    // THEN: the startup task is configured to run at user logon
    expect(command).toContain("New-ScheduledTaskTrigger");
    expect(command).toContain("-AtLogOn");
    expect(command).toContain(TASK_NAME);
  });

  // PENDING: requires buildInstallSuccessMessage() to include registration confirmation
  it.skip("install output confirms 'Startup task registered'", () => {
    // Driving port: buildInstallSuccessMessage() updated to include
    // startup registration confirmation.
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Registration Parameters
// ---------------------------------------------------------------------------

describe("Registration builds correct task parameters from install directory", () => {
  it("task name is 'NorbertHookReceiver' in the registration command", () => {
    const installDir = "C:\\Users\\Phil\\.norbert\\bin";
    const command = buildTaskRegistrationCommand(installDir);

    expect(command).toContain("NorbertHookReceiver");
  });

  it("task target path matches the hook receiver binary in the install directory", () => {
    const installDir = "C:\\Users\\Phil\\.norbert\\bin";
    const command = buildTaskRegistrationCommand(installDir);

    expect(command).toContain(
      "C:\\Users\\Phil\\.norbert\\bin\\norbert-hook-receiver.exe"
    );
  });
});

describe("Registration is idempotent on reinstall", () => {
  it("registration command uses -Force for idempotent re-registration", () => {
    const installDir = "C:\\Users\\Phil\\.norbert\\bin";
    const command = buildTaskRegistrationCommand(installDir);

    // -Force overwrites any existing task, ensuring idempotency
    expect(command).toContain("-Force");
    expect(command).toContain("Register-ScheduledTask");
  });
});

describe("Install output confirms startup task registration", () => {
  it.skip("output includes 'Startup task registered' on successful registration", () => {
    // GIVEN: the installer has successfully registered the startup task
    // WHEN: the install success message is generated
    // THEN: the output includes "Startup task registered"
    //
    // Driving port: updated buildInstallSuccessMessage() from postinstall-core.js
  });
});

describe("Install success message guides user to start receiver or reboot", () => {
  it.skip("output includes guidance to start the hook receiver manually", () => {
    // WHEN: the install success message is generated
    // THEN: the output includes guidance to start the hook receiver manually
    //
    // Driving port: buildInstallSuccessMessage() from postinstall-core.js
  });

  it.skip("output mentions automatic startup on reboot", () => {
    // WHEN: the install success message is generated
    // THEN: the output mentions automatic startup on reboot
    //
    // Driving port: buildInstallSuccessMessage() from postinstall-core.js
  });
});

describe("Task registration command specifies user logon trigger", () => {
  it("command includes a logon trigger for the current user", () => {
    const installDir = "C:\\Users\\Phil\\.norbert\\bin";
    const command = buildTaskRegistrationCommand(installDir);

    expect(command).toContain("New-ScheduledTaskTrigger");
    expect(command).toContain("-AtLogOn");
  });
});

// @property
describe("Task target path always matches the install directory binary", () => {
  it("for any valid install directory, the task target ends with the hook receiver binary", () => {
    const sampleDirs = [
      "C:\\Users\\Phil\\.norbert\\bin",
      "C:\\Users\\Another User\\.norbert\\bin",
      "D:\\custom\\.norbert\\bin",
      "/home/user/.norbert/bin",
    ];

    for (const installDir of sampleDirs) {
      const command = buildTaskRegistrationCommand(installDir);
      expect(command).toContain("norbert-hook-receiver.exe");
    }
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS
// ---------------------------------------------------------------------------

describe("Registration failure is non-fatal and install completes", () => {
  it("install output includes non-fatal warning on registration failure", () => {
    const installDir = "C:\\Users\\Phil\\.norbert\\bin";
    const platform = { os: "win32", arch: "x64", extension: ".tar.gz" };
    let callCount = 0;
    const execCommand = () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Access denied");
      }
    };

    const result = registerAndStartHookReceiver(installDir, platform, execCommand);

    expect(result.warnings).toContain("Could not register startup task (non-fatal).");
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
  // INTEGRATION: requires real Task Scheduler and filesystem to validate
  // binary existence check before registration attempt.
  it.skip("install output warns about the missing binary", () => {
    // GIVEN: the Norbert install directory does not contain the hook receiver binary
    // WHEN: the installer attempts to register the startup task
    // THEN: the install output warns about the missing binary
    // AND: the install completes without crashing
  });
});

describe("Registration handles special characters in home directory path", () => {
  it("task target path is properly quoted for paths with spaces", () => {
    const installDir = "C:\\Users\\Phil Van Every\\.norbert\\bin";
    const command = buildTaskRegistrationCommand(installDir);

    expect(command).toContain(
      "'C:\\Users\\Phil Van Every\\.norbert\\bin\\norbert-hook-receiver.exe'"
    );
  });
});
