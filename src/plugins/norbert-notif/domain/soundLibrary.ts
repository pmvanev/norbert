/// Sound library resolution for norbert-notif.
///
/// Pure functions to merge built-in and custom sounds into a unified library,
/// and resolve individual sounds by name.
///
/// No side effects, no IO imports. Sound discovery (filesystem) is handled
/// by adapters; this module operates on already-discovered SoundEntry values.

import type { SoundEntry } from "./types";

// Re-export SoundEntry for convenience (acceptance tests import from here)
export type { SoundEntry } from "./types";

// ---------------------------------------------------------------------------
// Sound Library Resolution
// ---------------------------------------------------------------------------

/// Merge built-in sounds with custom sounds into a single library.
/// Built-in sounds appear first, followed by custom sounds.
export const resolveSoundLibrary = (
  builtInSounds: readonly SoundEntry[],
  customSounds: readonly SoundEntry[]
): readonly SoundEntry[] => [...builtInSounds, ...customSounds];

// ---------------------------------------------------------------------------
// Sound Lookup
// ---------------------------------------------------------------------------

/// Resolve a sound by name from the library.
/// Returns the matching SoundEntry, or undefined if not found.
export const resolveSound = (
  name: string,
  library: readonly SoundEntry[]
): SoundEntry | undefined => library.find((entry) => entry.name === name);
