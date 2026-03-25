# DESIGN Wave Handoff: hook-receiver-clarity

**From**: product-owner (DISCUSS wave)
**To**: solution-architect (DESIGN wave)
**Date**: 2026-03-25
**Review status**: Conditionally approved — H-01 resolved in iteration 1; all critical issues: 0

---

## Feature Summary

Two-part improvement to `norbert-hook-receiver.exe`:

1. **US-HRC-01** — Embed a distinct Windows VERSIONINFO FileDescription so the hook receiver shows as "Norbert Hook Receiver" in Task Manager (not "Norbert")
2. **US-HRC-02** — Add a system tray icon with hover tooltip (port + event count) and right-click context menu with status and graceful Quit

Both stories are independent and can be designed and implemented in parallel or sequentially.

---

## Artifacts Produced

| Artifact | Path | Purpose |
|----------|------|---------|
| JTBD analysis | `discuss/jtbd-analysis.md` | Job stories, forces, persona, domain glossary |
| Journey visual | `discuss/journey-hook-receiver-clarity-visual.md` | ASCII flow, emotional arc, TUI mockups, integration checkpoints |
| Journey schema | `discuss/journey-hook-receiver-clarity.yaml` | Machine-readable journey with Gherkin per step |
| Gherkin scenarios | `discuss/journey-hook-receiver-clarity.feature` | Acceptance scenarios for DISTILL wave |
| Shared artifacts | `discuss/shared-artifacts-registry.md` | Single sources of truth for all ${variables} |
| User stories | `discuss/user-stories.md` | LeanUX stories with DoR validation |
| Peer review | `discuss/peer-review.md` | Review findings and resolutions |

---

## Persona

**Danielle Reyes** — developer using Norbert on Windows daily. Technically literate; uses Task Manager for debugging; expects Windows idioms (Task Manager labels, system tray) to follow platform conventions. Solo developer persona — no multi-user or team collaboration concern for this feature.

---

## Business Context

The hook receiver auto-starts at login via Windows Startup folder and runs as an invisible background process. Its invisibility causes two problems:

- **Process confusion**: both `norbert.exe` and `norbert-hook-receiver.exe` appear as "Norbert" in Task Manager — Danielle cannot tell them apart
- **Silent failures**: if the hook receiver crashes, Danielle loses telemetry with no indication anything went wrong

This feature addresses both pain points using Windows platform conventions (VERSIONINFO metadata + system tray icon) with zero new external dependencies expected.

---

## Key Design Decisions Deferred to DESIGN Wave

| Decision | Context |
|----------|---------|
| tray-icon crate selection | `tray-icon` available transitively via Tauri; confirm it works in a non-Tauri binary. If not, evaluate `systray` or `tray-item`. |
| SQLite drain timeout value | Defaulted to 2 seconds in requirements; confirm this is safe for largest expected in-flight writes |
| Tooltip refresh strategy | Requirements specify on-demand read (when tooltip opens); confirm this is achievable with chosen tray crate |
| VERSIONINFO embedding approach | build.rs + Windows Resource File is the canonical approach; verify Cargo toolchain support |
| Minimum Windows version | Requirements specify Windows 10 1803+; validate against tray crate support matrix |

---

## Non-Functional Requirements

| NFR | Requirement |
|-----|-------------|
| Tray icon startup latency | Appears within 2 seconds of process start |
| Port release time | Released within 1 second of clean exit |
| Resource usage | Tray icon must not introduce observable CPU or memory overhead to a headless server process |
| Drain timeout | Maximum 2 seconds wait for SQLite writes before forced exit |
| Windows version support | Windows 10 version 1803 or later |

---

## Domain Glossary

See `discuss/jtbd-analysis.md` — Domain Glossary section. Key terms: hook receiver, main GUI, VERSIONINFO, FileDescription, system tray, tray icon, tray tooltip, tray context menu, event count, graceful shutdown.

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| tray-icon crate does not work standalone (without Tauri runtime) | Medium | High | Spike in DESIGN wave; fallback crates identified |
| VERSIONINFO embedding incompatible with current build toolchain | Low | Low | Standard Rust/Windows pattern; well-documented |
| SQLite drain timeout too short for large write batches | Low | Medium | Named constant; adjustable without code change |
| Tray icon not visible due to Windows "hidden icons" overflow | Low | Low | Windows UX behavior; outside product's control; no mitigation needed |

---

## DoR Summary

Both stories passed all 8 Definition of Ready items. No exceptions.

| Story | DoR Status |
|-------|-----------|
| US-HRC-01 | PASSED |
| US-HRC-02 | PASSED |

---

## Scope Boundaries (Explicitly Out of Scope)

- Cross-platform tray support (macOS, Linux)
- Startup shortcut installation / management
- Hook receiver restart / watchdog on crash
- Event count persistence between process restarts
- Multiple concurrent hook receiver instances
