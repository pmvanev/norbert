# ADR-025: Notification Sound System -- Web Audio API with Custom Sound Directory

## Status

Accepted

## Context

norbert-notif must play distinct sounds per notification event type, support user-provided custom sounds, provide volume control, and offer sound preview in settings. The sound system must work within the Tauri webview context and support WAV, MP3, and OGG formats.

**Quality attribute drivers**: Maintainability (no external dependencies), time-to-market (use platform capabilities), fault tolerance (graceful fallback).

**Constraints**: Tauri 2.0 webview (Chromium-based). Functional paradigm. Custom sounds stored in `~/.norbert/sounds/`.

## Decision

Use the Web Audio API (built into the webview) for all sound playback. Six built-in sounds bundled as WAV assets. Custom sounds discovered from `~/.norbert/sounds/` via Tauri IPC filesystem scan. Global volume applied as gain multiplier. Missing custom sounds fall back to the event's default sound with a user-visible warning.

## Alternatives Considered

### tauri-plugin-audio or Rust-side audio playback

- What: Play sounds from the Rust backend using rodio or a Tauri audio plugin.
- Expected impact: Better OS-level audio integration, potentially lower latency.
- Why insufficient: Adds Rust dependency (rodio + cpal + system audio bindings). The Tauri webview's Web Audio API already supports the required formats and volume control. Cross-process IPC for each sound play adds latency rather than reducing it. The webview is always active when notifications fire (it renders the UI), so Web Audio is always available.

### HTMLAudioElement (simple audio tag)

- What: Use `new Audio('file.wav').play()` instead of Web Audio API.
- Expected impact: Simpler code, fewer lines.
- Why insufficient: HTMLAudioElement does not support programmatic volume control per-playback (only global element volume). Web Audio API's GainNode enables precise volume control. HTMLAudioElement also has inconsistent behavior across browsers for rapid successive plays. Web Audio API is the correct tool for programmatic audio.

## Consequences

**Positive**:
- Zero additional dependencies (Web Audio API is built into Chromium webview)
- GainNode provides precise volume control (0.0 to 1.0)
- Supports WAV, MP3, OGG natively in Chromium
- Preview and notification playback use the same code path
- No Rust-side audio complexity

**Negative**:
- Webview must be loaded for sound to play (always true when Norbert UI is running)
- Web Audio API requires user gesture for first playback in some browsers (Tauri webview typically does not enforce this restriction)
- Audio buffer decoding is async (mitigated: pre-load built-in sounds on plugin load)
