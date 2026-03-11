import { describe, it, expect } from "vitest";
import {
  detectPlatform,
  buildDownloadUrl,
  getInstallDirectory,
  buildAssetFilename,
  TASK_NAME,
  buildTaskRegistrationCommand,
  buildStartReceiverCommand,
} from "../../scripts/postinstall-core.js";

describe("postinstall core logic", () => {
  describe("detectPlatform", () => {
    it("returns platform info for win32-x64", () => {
      const result = detectPlatform("win32", "x64");

      expect(result.ok).toBe(true);
      expect(result.value).toEqual({
        os: "win32",
        arch: "x64",
        extension: ".tar.gz",
      });
    });

    it("returns error for unsupported platform", () => {
      const result = detectPlatform("freebsd", "arm");

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Unsupported platform");
    });
  });

  describe("buildAssetFilename", () => {
    it("constructs correct filename for win32-x64", () => {
      const platform = { os: "win32", arch: "x64", extension: ".tar.gz" };
      const filename = buildAssetFilename("0.1.0", platform);

      expect(filename).toBe("norbert-v0.1.0-win32-x64.tar.gz");
    });
  });

  describe("buildDownloadUrl", () => {
    it("constructs GitHub release URL for version and platform", () => {
      const platform = { os: "win32", arch: "x64", extension: ".tar.gz" };
      const url = buildDownloadUrl("0.1.0", platform);

      expect(url).toBe(
        "https://github.com/pmvanev/norbert/releases/download/v0.1.0/norbert-v0.1.0-win32-x64.tar.gz"
      );
    });
  });

  describe("getInstallDirectory", () => {
    it("returns ~/.norbert/bin/ path using provided home directory", () => {
      const installDir = getInstallDirectory("/home/user");

      expect(installDir).toMatch(/\.norbert[/\\]bin$/);
      expect(installDir).toMatch(/^[/\\]home[/\\]user/);
    });

    it("handles Windows-style home directory", () => {
      const installDir = getInstallDirectory("C:\\Users\\dev");

      expect(installDir).toMatch(/\.norbert[/\\]bin$/);
    });
  });
});

describe("TASK_NAME constant", () => {
  it("is NorbertHookReceiver", () => {
    expect(TASK_NAME).toBe("NorbertHookReceiver");
  });
});

describe("buildTaskRegistrationCommand", () => {
  const installDir = "C:\\Users\\Phil\\.norbert\\bin";

  it("includes the task name in the command", () => {
    const command = buildTaskRegistrationCommand(installDir);
    expect(command).toContain("NorbertHookReceiver");
  });

  it("targets the hook receiver binary in the install directory", () => {
    const command = buildTaskRegistrationCommand(installDir);
    expect(command).toContain(
      "C:\\Users\\Phil\\.norbert\\bin\\norbert-hook-receiver.exe"
    );
  });

  it("uses a logon trigger for automatic startup", () => {
    const command = buildTaskRegistrationCommand(installDir);
    expect(command).toContain("New-ScheduledTaskTrigger");
    expect(command).toContain("-AtLogOn");
  });

  it("uses Force flag for idempotent registration", () => {
    const command = buildTaskRegistrationCommand(installDir);
    expect(command).toContain("-Force");
  });

  it("properly quotes paths containing spaces", () => {
    const dirWithSpaces = "C:\\Users\\Phil Van Every\\.norbert\\bin";
    const command = buildTaskRegistrationCommand(dirWithSpaces);

    // The binary path must be quoted in the PowerShell command
    expect(command).toContain(
      "'C:\\Users\\Phil Van Every\\.norbert\\bin\\norbert-hook-receiver.exe'"
    );
  });
});

describe("buildStartReceiverCommand", () => {
  const installDir = "C:\\Users\\Phil\\.norbert\\bin";

  it("stops any prior instance before starting", () => {
    const command = buildStartReceiverCommand(installDir);
    expect(command).toContain("Stop-Process");
    expect(command).toContain("norbert-hook-receiver");
  });

  it("starts the hook receiver binary", () => {
    const command = buildStartReceiverCommand(installDir);
    expect(command).toContain("Start-Process");
    expect(command).toContain("norbert-hook-receiver.exe");
  });
});

describe("error handling", () => {
  it("detectPlatform returns error with platform details in message", () => {
    const result = detectPlatform("sunos", "sparc");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("sunos");
    expect(result.error).toContain("sparc");
  });
});
