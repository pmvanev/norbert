import { describe, it, expect, vi } from "vitest";
import {
  buildTaskRegistrationCommand,
  buildStartReceiverCommand,
} from "../../scripts/postinstall-core.js";

/**
 * Unit tests for hook receiver registration integration in postinstall.js.
 *
 * Step 01-02: postinstall.js calls registration and start after binary
 * extraction. Registration failure is non-fatal (try/catch, exit 0).
 *
 * The function under test: registerAndStartHookReceiver(installDir, platform, execCommand)
 * - execCommand is injected (dependency injection via function parameter)
 * - Returns { registered: boolean, started: boolean, warnings: string[] }
 */

// We will import the function once it exists in postinstall-core.js or postinstall.js.
// For now, we import from postinstall-core.js where domain logic lives.
// The orchestration function to be created:
import { registerAndStartHookReceiver } from "../../scripts/postinstall-core.js";

describe("registerAndStartHookReceiver", () => {
  const installDir = "C:\\Users\\Phil\\.norbert\\bin";

  describe("on Windows (win32) with successful registration", () => {
    it("executes the task registration command", () => {
      const executedCommands = [];
      const execCommand = (cmd) => executedCommands.push(cmd);
      const platform = { os: "win32", arch: "x64", extension: ".tar.gz" };

      registerAndStartHookReceiver(installDir, platform, execCommand);

      const registrationCmd = buildTaskRegistrationCommand(installDir);
      expect(executedCommands[0]).toContain("Register-ScheduledTask");
      expect(executedCommands[0]).toBe(
        `powershell -NoProfile -Command "${registrationCmd}"`
      );
    });

    it("executes the start receiver command after registration", () => {
      const executedCommands = [];
      const execCommand = (cmd) => executedCommands.push(cmd);
      const platform = { os: "win32", arch: "x64", extension: ".tar.gz" };

      registerAndStartHookReceiver(installDir, platform, execCommand);

      const startCmd = buildStartReceiverCommand(installDir);
      expect(executedCommands.length).toBeGreaterThanOrEqual(2);
      expect(executedCommands[1]).toBe(
        `powershell -NoProfile -Command "${startCmd}"`
      );
    });

    it("returns registered and started as true on success", () => {
      const execCommand = () => {};
      const platform = { os: "win32", arch: "x64", extension: ".tar.gz" };

      const result = registerAndStartHookReceiver(installDir, platform, execCommand);

      expect(result.registered).toBe(true);
      expect(result.started).toBe(true);
      expect(result.warnings).toEqual([]);
    });
  });

  describe("on Windows when registration fails", () => {
    it("returns registered false with warning message", () => {
      const execCommand = (cmd) => {
        if (cmd.includes("Register-ScheduledTask")) {
          throw new Error("Access denied");
        }
      };
      const platform = { os: "win32", arch: "x64", extension: ".tar.gz" };

      const result = registerAndStartHookReceiver(installDir, platform, execCommand);

      expect(result.registered).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("Could not register startup task");
    });

    it("still attempts to start receiver even if registration fails", () => {
      const executedCommands = [];
      const execCommand = (cmd) => {
        if (cmd.includes("Register-ScheduledTask")) {
          throw new Error("Access denied");
        }
        executedCommands.push(cmd);
      };
      const platform = { os: "win32", arch: "x64", extension: ".tar.gz" };

      registerAndStartHookReceiver(installDir, platform, execCommand);

      expect(executedCommands.length).toBe(1);
      expect(executedCommands[0]).toContain("Start-Process");
    });
  });

  describe("on Windows when start fails", () => {
    it("returns started false with warning message", () => {
      const execCommand = (cmd) => {
        if (cmd.includes("Start-Process")) {
          throw new Error("Process not found");
        }
      };
      const platform = { os: "win32", arch: "x64", extension: ".tar.gz" };

      const result = registerAndStartHookReceiver(installDir, platform, execCommand);

      expect(result.registered).toBe(true);
      expect(result.started).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("Could not start hook receiver");
    });
  });

  describe("on non-Windows platform", () => {
    it("skips registration and returns not applicable", () => {
      const executedCommands = [];
      const execCommand = (cmd) => executedCommands.push(cmd);
      const platform = { os: "darwin", arch: "arm64", extension: ".tar.gz" };

      const result = registerAndStartHookReceiver(installDir, platform, execCommand);

      expect(executedCommands).toEqual([]);
      expect(result.registered).toBe(false);
      expect(result.started).toBe(false);
      expect(result.warnings).toEqual([]);
    });
  });
});
