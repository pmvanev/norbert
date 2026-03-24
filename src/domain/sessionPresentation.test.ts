import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  deriveStatusLabel,
  deriveStatusClass,
  deriveSessionRowClass,
  deriveSessionDotClass,
  mapTerminalType,
  formatClaudeVersion,
  formatPlatform,
} from "./sessionPresentation";

describe("deriveStatusLabel", () => {
  it("returns 'Active' when session is active", () => {
    expect(deriveStatusLabel(true)).toBe("Active");
  });

  it("returns 'Completed' when session is not active", () => {
    expect(deriveStatusLabel(false)).toBe("Completed");
  });
});

describe("deriveStatusClass", () => {
  it("returns 'status-active' when session is active", () => {
    expect(deriveStatusClass(true)).toBe("status-active");
  });

  it("returns 'status-completed' when session is not active", () => {
    expect(deriveStatusClass(false)).toBe("status-completed");
  });
});

describe("deriveSessionRowClass", () => {
  it("returns 'srow live-s' when session is active", () => {
    expect(deriveSessionRowClass(true)).toBe("srow live-s");
  });

  it("returns 'srow' when session is not active", () => {
    expect(deriveSessionRowClass(false)).toBe("srow");
  });
});

describe("deriveSessionDotClass", () => {
  it("returns 'sdot live' when session is active", () => {
    expect(deriveSessionDotClass(true)).toBe("sdot live");
  });

  it("returns 'sdot done' when session is not active", () => {
    expect(deriveSessionDotClass(false)).toBe("sdot done");
  });
});

describe("mapTerminalType", () => {
  it("maps known terminal types to human-readable IDE badges", () => {
    expect(mapTerminalType("vscode")).toBe("VS Code");
    expect(mapTerminalType("cursor")).toBe("Cursor");
    expect(mapTerminalType("iTerm.app")).toBe("iTerm");
    expect(mapTerminalType("tmux")).toBe("tmux");
    expect(mapTerminalType("xterm")).toBe("xterm");
    expect(mapTerminalType("xterm-256color")).toBe("Terminal");
    expect(mapTerminalType("alacritty")).toBe("Alacritty");
    expect(mapTerminalType("WezTerm")).toBe("WezTerm");
    expect(mapTerminalType("windsurf")).toBe("Windsurf");
  });

  it("returns null for null input", () => {
    expect(mapTerminalType(null)).toBeNull();
  });

  it("returns null for unknown terminal types", () => {
    expect(mapTerminalType("some-unknown-terminal")).toBeNull();
  });
});

describe("formatClaudeVersion", () => {
  it("formats version string with Claude Code prefix", () => {
    expect(formatClaudeVersion("2.1.81")).toBe("Claude Code 2.1.81");
  });

  it("returns null for null input", () => {
    expect(formatClaudeVersion(null)).toBeNull();
  });

  it("@property non-null input always produces 'Claude Code ' prefix", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (version) => {
        const result = formatClaudeVersion(version);
        expect(result).not.toBeNull();
        expect(result!.startsWith("Claude Code ")).toBe(true);
      }),
    );
  });
});

describe("formatPlatform", () => {
  it("combines OS type and architecture", () => {
    expect(formatPlatform("windows", "amd64")).toBe("Windows amd64");
    expect(formatPlatform("linux", "arm64")).toBe("Linux arm64");
    expect(formatPlatform("darwin", "amd64")).toBe("macOS amd64");
  });

  it("returns OS only when arch is null", () => {
    expect(formatPlatform("windows", null)).toBe("Windows");
  });

  it("returns arch only when OS is null", () => {
    expect(formatPlatform(null, "amd64")).toBe("amd64");
  });

  it("returns null when both OS and arch are null", () => {
    expect(formatPlatform(null, null)).toBeNull();
  });
});
