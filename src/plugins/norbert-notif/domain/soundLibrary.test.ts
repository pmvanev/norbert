/// Unit tests for soundLibrary domain module.
///
/// Tests pure functions: resolveSoundLibrary and resolveSound.
/// No IO, no side effects.

import { describe, it, expect } from "vitest";
import {
  resolveSoundLibrary,
  resolveSound,
  type SoundEntry,
} from "./soundLibrary";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const builtInSounds: readonly SoundEntry[] = [
  { name: "phosphor-ping", source: "built-in", filePath: "assets/sounds/phosphor-ping.wav" },
  { name: "amber-pulse", source: "built-in", filePath: "assets/sounds/amber-pulse.wav" },
  { name: "compaction", source: "built-in", filePath: "assets/sounds/compaction.wav" },
  { name: "session-complete", source: "built-in", filePath: "assets/sounds/session-complete.wav" },
  { name: "des-block", source: "built-in", filePath: "assets/sounds/des-block.wav" },
  { name: "silence", source: "built-in", filePath: null },
];

const customSounds: readonly SoundEntry[] = [
  { name: "my-chime", source: "custom", filePath: "~/.norbert/sounds/my-chime.wav" },
  { name: "alert-tone", source: "custom", filePath: "~/.norbert/sounds/alert-tone.wav" },
];

// ---------------------------------------------------------------------------
// resolveSoundLibrary
// ---------------------------------------------------------------------------

describe("resolveSoundLibrary", () => {
  it("returns all built-in sounds when no custom sounds provided", () => {
    const library = resolveSoundLibrary(builtInSounds, []);

    expect(library).toHaveLength(6);
    expect(library.every((s) => s.source === "built-in")).toBe(true);
  });

  it("merges custom sounds after built-in sounds", () => {
    const library = resolveSoundLibrary(builtInSounds, customSounds);

    expect(library).toHaveLength(8);

    const names = library.map((s) => s.name);
    expect(names).toContain("phosphor-ping");
    expect(names).toContain("my-chime");
    expect(names).toContain("alert-tone");
  });

  it("preserves source designation for each entry", () => {
    const library = resolveSoundLibrary(builtInSounds, customSounds);

    const builtInEntries = library.filter((s) => s.source === "built-in");
    const customEntries = library.filter((s) => s.source === "custom");

    expect(builtInEntries).toHaveLength(6);
    expect(customEntries).toHaveLength(2);
  });

  it("returns empty array when both inputs are empty", () => {
    const library = resolveSoundLibrary([], []);
    expect(library).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// resolveSound
// ---------------------------------------------------------------------------

describe("resolveSound", () => {
  const library = resolveSoundLibrary(builtInSounds, customSounds);

  it("resolves a built-in sound by name", () => {
    const result = resolveSound("des-block", library);

    expect(result).toBeDefined();
    expect(result!.name).toBe("des-block");
    expect(result!.source).toBe("built-in");
    expect(result!.filePath).toContain("des-block.wav");
  });

  it("resolves a custom sound by name", () => {
    const result = resolveSound("my-chime", library);

    expect(result).toBeDefined();
    expect(result!.name).toBe("my-chime");
    expect(result!.source).toBe("custom");
  });

  it("returns undefined for unknown sound name", () => {
    const result = resolveSound("nonexistent", library);
    expect(result).toBeUndefined();
  });

  it("resolves silence with null file path", () => {
    const result = resolveSound("silence", library);

    expect(result).toBeDefined();
    expect(result!.name).toBe("silence");
    expect(result!.filePath).toBeNull();
  });
});
