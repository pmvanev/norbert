/**
 * Acceptance tests: Notification Sound System (US-NOTIF-06)
 *
 * Validates sound library resolution: built-in sounds, custom sound
 * discovery, silence option, missing sound fallback, and volume
 * application.
 *
 * Driving ports: resolveSoundLibrary, resolveSound (pure functions)
 * Domain: sound library, sound entries
 *
 * Traces to: US-NOTIF-06 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  resolveSoundLibrary,
  resolveSound,
  type SoundEntry,
} from "../../../src/plugins/norbert-notif/domain/soundLibrary";

// ---------------------------------------------------------------------------
// TEST FIXTURES
// ---------------------------------------------------------------------------

const builtInSounds: readonly SoundEntry[] = [
  { name: "phosphor-ping", source: "built-in", filePath: "assets/sounds/phosphor-ping.wav" },
  { name: "amber-pulse", source: "built-in", filePath: "assets/sounds/amber-pulse.wav" },
  { name: "compaction", source: "built-in", filePath: "assets/sounds/compaction.wav" },
  { name: "session-complete", source: "built-in", filePath: "assets/sounds/session-complete.wav" },
  { name: "des-block", source: "built-in", filePath: "assets/sounds/des-block.wav" },
  { name: "silence", source: "built-in", filePath: null },
];

const customSoundPaths = [
  { name: "client-done", source: "custom" as const, filePath: "~/.norbert/sounds/client-done.wav" },
];

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User selects a sound and it resolves for playback", () => {
  it("sound library merges built-in and custom sounds for selection", () => {
    // Given 6 built-in sounds are available
    // And "client-done.wav" exists in the custom sounds directory

    // When the sound library is resolved
    const library = resolveSoundLibrary(builtInSounds, customSoundPaths);

    // Then the library contains all 6 built-in sounds
    const builtInNames = library
      .filter((s) => s.source === "built-in")
      .map((s) => s.name);
    expect(builtInNames).toHaveLength(6);
    expect(builtInNames).toContain("phosphor-ping");
    expect(builtInNames).toContain("silence");

    // And the library contains the custom sound "client-done"
    const customNames = library
      .filter((s) => s.source === "custom")
      .map((s) => s.name);
    expect(customNames).toContain("client-done");

    // And "phosphor-ping" resolves to a valid sound entry
    const resolved = resolveSound("phosphor-ping", library);
    expect(resolved).toBeDefined();
    expect(resolved!.name).toBe("phosphor-ping");
    expect(resolved!.filePath).toContain("phosphor-ping.wav");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Sound Resolution
// ---------------------------------------------------------------------------

describe.skip("Built-in sound resolved by name from library", () => {
  it("each built-in sound name resolves to its file path", () => {
    // Given the full sound library is resolved
    const library = resolveSoundLibrary(builtInSounds, []);

    // When resolving "des-block"
    const resolved = resolveSound("des-block", library);

    // Then the sound entry has the correct file path
    expect(resolved).toBeDefined();
    expect(resolved!.name).toBe("des-block");
    expect(resolved!.source).toBe("built-in");
    expect(resolved!.filePath).toContain("des-block.wav");
  });
});

describe.skip("Custom sound discovered from user directory", () => {
  it("custom sound appears in library alongside built-in sounds", () => {
    // Given "client-done.wav" is in the custom sounds directory
    const library = resolveSoundLibrary(builtInSounds, customSoundPaths);

    // When resolving "client-done"
    const resolved = resolveSound("client-done", library);

    // Then it resolves as a custom sound
    expect(resolved).toBeDefined();
    expect(resolved!.name).toBe("client-done");
    expect(resolved!.source).toBe("custom");
  });
});

describe.skip("Silence option produces null file path", () => {
  it("selecting silence resolves to a sound entry with no file path", () => {
    // Given the sound library includes the silence option
    const library = resolveSoundLibrary(builtInSounds, []);

    // When resolving "silence"
    const resolved = resolveSound("silence", library);

    // Then the sound entry has null file path
    expect(resolved).toBeDefined();
    expect(resolved!.name).toBe("silence");
    expect(resolved!.filePath).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe.skip("Missing custom sound falls back to default", () => {
  it("returns default sound when requested custom sound is not in library", () => {
    // Given "client-done.wav" has been deleted from the custom sounds directory
    const library = resolveSoundLibrary(builtInSounds, []);

    // When resolving "client-done" (no longer in library)
    const resolved = resolveSound("client-done", library);

    // Then it returns undefined (caller falls back to default)
    expect(resolved).toBeUndefined();

    // And the default sound "phosphor-ping" is still available
    const fallback = resolveSound("phosphor-ping", library);
    expect(fallback).toBeDefined();
  });
});

describe.skip("Global volume applied as multiplier to dispatch instruction volume", () => {
  it("volume in dispatch instruction reflects global volume setting", () => {
    // Given the global volume is set to 50%
    // And an event sound is "phosphor-ping"

    // When producing a dispatch instruction
    // Then the instruction volume is 50 (50% of original)

    // This test validates the volume calculation in the dispatch engine
    // The dispatch engine reads globalVolume from preferences
    // and applies it to each instruction's volume field

    // Verified through dispatch engine tests (cross-reference)
    // Sound library itself does not handle volume -- it only resolves names
    const library = resolveSoundLibrary(builtInSounds, []);
    const resolved = resolveSound("phosphor-ping", library);
    expect(resolved).toBeDefined();
    // Volume application is tested in notification-dispatch.test.ts
  });
});
