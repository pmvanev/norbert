import { describe, it, expect, vi } from "vitest";

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

import { registerAndStartHookReceiver } from "../../scripts/postinstall-core.js";

// Pre-computed expected base64 values for installDir = "C:\Users\Phil\.norbert\bin"
// Independently verified using Node.js Buffer UTF-16LE encoding (not the production encoder).
// Registration command: "$action = New-ScheduledTaskAction -Execute 'C:\Users\Phil\.norbert\bin\norbert-hook-receiver.exe'; $trigger = New-ScheduledTaskTrigger -AtLogOn; Register-ScheduledTask -TaskName 'NorbertHookReceiver' -Action $action -Trigger $trigger -Force"
const EXPECTED_REGISTRATION_BASE64 =
  "JABhAGMAdABpAG8AbgAgAD0AIABOAGUAdwAtAFMAYwBoAGUAZAB1AGwAZQBkAFQAYQBzAGsAQQBjAHQAaQBvAG4AIAAtAEUAeABlAGMAdQB0AGUAIAAnAEMAOgBcAFUAcwBlAHIAcwBcAFAAaABpAGwAXAAuAG4AbwByAGIAZQByAHQAXABiAGkAbgBcAG4AbwByAGIAZQByAHQALQBoAG8AbwBrAC0AcgBlAGMAZQBpAHYAZQByAC4AZQB4AGUAJwA7ACAAJAB0AHIAaQBnAGcAZQByACAAPQAgAE4AZQB3AC0AUwBjAGgAZQBkAHUAbABlAGQAVABhAHMAawBUAHIAaQBnAGcAZQByACAALQBBAHQATABvAGcATwBuADsAIABSAGUAZwBpAHMAdABlAHIALQBTAGMAaABlAGQAdQBsAGUAZABUAGEAcwBrACAALQBUAGEAcwBrAE4AYQBtAGUAIAAnAE4AbwByAGIAZQByAHQASABvAG8AawBSAGUAYwBlAGkAdgBlAHIAJwAgAC0AQQBjAHQAaQBvAG4AIAAkAGEAYwB0AGkAbwBuACAALQBUAHIAaQBnAGcAZQByACAAJAB0AHIAaQBnAGcAZQByACAALQBGAG8AcgBjAGUA";
// Start command: "Stop-Process -Name 'norbert-hook-receiver' -ErrorAction SilentlyContinue; Start-Process -FilePath 'C:\Users\Phil\.norbert\bin\norbert-hook-receiver.exe'"
const EXPECTED_START_BASE64 =
  "UwB0AG8AcAAtAFAAcgBvAGMAZQBzAHMAIAAtAE4AYQBtAGUAIAAnAG4AbwByAGIAZQByAHQALQBoAG8AbwBrAC0AcgBlAGMAZQBpAHYAZQByACcAIAAtAEUAcgByAG8AcgBBAGMAdABpAG8AbgAgAFMAaQBsAGUAbgB0AGwAeQBDAG8AbgB0AGkAbgB1AGUAOwAgAFMAdABhAHIAdAAtAFAAcgBvAGMAZQBzAHMAIAAtAEYAaQBsAGUAUABhAHQAaAAgACcAQwA6AFwAVQBzAGUAcgBzAFwAUABoAGkAbABcAC4AbgBvAHIAYgBlAHIAdABcAGIAaQBuAFwAbgBvAHIAYgBlAHIAdAAtAGgAbwBvAGsALQByAGUAYwBlAGkAdgBlAHIALgBlAHgAZQAnAA==";

describe("registerAndStartHookReceiver", () => {
  const installDir = "C:\\Users\\Phil\\.norbert\\bin";

  describe("on Windows (win32) with successful registration", () => {
    it("executes the task registration command via EncodedCommand", () => {
      const executedCommands = [];
      const execCommand = (cmd) => executedCommands.push(cmd);
      const platform = { os: "win32", arch: "x64", extension: ".tar.gz" };

      registerAndStartHookReceiver(installDir, platform, execCommand);

      expect(executedCommands[0]).toBe(
        `powershell -NoProfile -EncodedCommand ${EXPECTED_REGISTRATION_BASE64}`
      );
    });

    it("executes the start receiver command after registration via EncodedCommand", () => {
      const executedCommands = [];
      const execCommand = (cmd) => executedCommands.push(cmd);
      const platform = { os: "win32", arch: "x64", extension: ".tar.gz" };

      registerAndStartHookReceiver(installDir, platform, execCommand);

      expect(executedCommands.length).toBeGreaterThanOrEqual(2);
      expect(executedCommands[1]).toBe(
        `powershell -NoProfile -EncodedCommand ${EXPECTED_START_BASE64}`
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
      let callCount = 0;
      const execCommand = () => {
        callCount++;
        if (callCount === 1) {
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
      let callCount = 0;
      const execCommand = (cmd) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Access denied");
        }
        executedCommands.push(cmd);
      };
      const platform = { os: "win32", arch: "x64", extension: ".tar.gz" };

      registerAndStartHookReceiver(installDir, platform, execCommand);

      expect(executedCommands.length).toBe(1);
      // Verify this is the start command (not registration) by decoding the base64
      const encodedPart = executedCommands[0].split("-EncodedCommand ")[1];
      const decoded = Buffer.from(encodedPart, "base64");
      let decodedStr = "";
      for (let i = 0; i < decoded.length; i += 2) {
        decodedStr += String.fromCharCode(decoded[i]);
      }
      expect(decodedStr).toContain("Start-Process");
    });
  });

  describe("on Windows when start fails", () => {
    it("returns started false with warning message", () => {
      let callCount = 0;
      const execCommand = () => {
        callCount++;
        if (callCount === 2) {
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

  describe("paths with special characters", () => {
    it("safely handles paths containing $ via EncodedCommand", () => {
      const dirWithDollar = "C:\\Users\\$pecialUser\\.norbert\\bin";
      const executedCommands = [];
      const execCommand = (cmd) => executedCommands.push(cmd);
      const platform = { os: "win32", arch: "x64", extension: ".tar.gz" };

      registerAndStartHookReceiver(dirWithDollar, platform, execCommand);

      // EncodedCommand avoids shell interpretation of $ in paths
      expect(executedCommands[0]).toContain("-EncodedCommand");
      expect(executedCommands[0]).not.toContain("$pecialUser");

      // Decoding the base64 should reveal the original path
      const encodedPart = executedCommands[0].split("-EncodedCommand ")[1];
      const decoded = Buffer.from(encodedPart, "base64");
      // UTF-16LE decode: take every other byte
      let decodedStr = "";
      for (let i = 0; i < decoded.length; i += 2) {
        decodedStr += String.fromCharCode(decoded[i]);
      }
      expect(decodedStr).toContain("$pecialUser");
    });
  });
});
