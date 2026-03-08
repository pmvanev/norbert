# DISCUSS Wave Handoff: Walking Skeleton

## Handoff Package for Solution Architect (DESIGN Wave)

### Feature Scope

**Feature ID**: walking-skeleton
**Feature Name**: Norbert Walking Skeleton -- Install to First Confirmed Data
**Maps to product spec**: Phase 0 (CI/CD Pipeline) + Phase 1 (Vertical Slice MVP)

### Business Context

Norbert is a greenfield local-first observability desktop app for Claude Code users. The walking skeleton proves the full data pipeline: from Claude Code HTTP hook events, through an HTTP receiver, into SQLite storage, and displayed in a Tauri desktop UI. This is the thinnest possible slice that exercises every architectural layer and confirms the system works end-to-end.

**Why a walking skeleton**: No code exists. Every subsequent feature (live session visualizer, cost tracking, agent diagrams, plugin architecture) depends on this data pipeline working. Building features before proving the pipeline is building on assumptions.

### Persona

**Priya Chandrasekaran**: Claude Code power user, runs multi-agent sessions daily on Windows 11, spends $15-30/week on API costs with no visibility into session activity. Has existing Claude Code configuration (MCP servers, permissions) she does not want broken.

### Job Stories Addressed

1. **Install and Receive Data**: "When I have decided to try Norbert, I want to install it with a single command and have it start receiving data immediately, so I can confirm it works without manual configuration."

2. **Know That Data Is Flowing**: "When I have installed Norbert and started a Claude Code session, I want to see clear confirmation that events are being captured, so I can trust the system."

3. **Confirm the Full Path**: "When I have run a session with Norbert active, I want to open the window and see a session record with real data, so I have confidence the entire pipeline works."

### Stories (4 total, all DoR PASSED)

| Story ID | Title | Effort | Scenarios | Dependencies |
|----------|-------|--------|-----------|--------------|
| US-WS-000 | CI/CD Pipeline | 2-3 days | 3 | None |
| US-WS-001 | Tauri App Shell with System Tray and Status Window | 1-2 days | 4 | None |
| US-WS-002 | Settings Merge, Hook Server, and Database Initialization | 2-3 days | 5 | US-WS-001 |
| US-WS-003 | End-to-End Pipeline Confirmation | 1-2 days | 5 | US-WS-002 |

**Total effort**: 6-10 days
**Total scenarios**: 17

### Artifacts Produced

| Artifact | Path | Description |
|----------|------|-------------|
| JTBD Analysis | `docs/feature/walking-skeleton/discuss/jtbd-analysis.md` | Job stories, forces analysis, opportunity scoring, job map |
| Journey Visual | `docs/feature/walking-skeleton/discuss/journey-walking-skeleton-visual.md` | ASCII flow diagram with emotional arc and UI mockups |
| Journey Schema | `docs/feature/walking-skeleton/discuss/journey-walking-skeleton.yaml` | Structured YAML journey definition |
| Gherkin Scenarios | `docs/feature/walking-skeleton/discuss/journey-walking-skeleton.feature` | 17 acceptance scenarios across the full journey |
| Shared Artifacts | `docs/feature/walking-skeleton/discuss/shared-artifacts-registry.md` | 7 tracked shared artifacts with integration checkpoints |
| User Stories | `docs/feature/walking-skeleton/discuss/user-stories.md` | 4 LeanUX stories with examples, UAT, and AC |
| DoR Validation | `docs/feature/walking-skeleton/discuss/dor-validation.md` | All 4 stories validated against 8-item DoR |
| Handoff | `docs/feature/walking-skeleton/discuss/handoff-design.md` | This document |

### Key Design Constraints (for solution architect)

1. **Tauri 2.0 with React**: Non-negotiable per product spec. Native system tray, WebView2 on Windows 11, lightweight footprint.

2. **SQLite WAL mode**: Required for concurrent read/write during hook event bursts. Single database at `~/.norbert/norbert.db`.

3. **Settings merge must be surgical**: JSON merge that preserves existing user configuration. Backup before modification. Never replace the entire file.

4. **Hook events are async**: All hooks registered with `async: true` so Claude Code performance is unaffected.

5. **Port 3748**: Default hook receiver port. Must handle port-in-use errors gracefully.

6. **Windows 11 initial target**: macOS and Linux deferred. Build pipeline starts with single platform.

7. **Local-first**: All data stays on the machine. No network calls except optional Anthropic API (not in walking skeleton).

### Shared Artifacts Requiring Architectural Attention

| Artifact | Risk | Design Concern |
|----------|------|----------------|
| `hook_port` | HIGH | Single constant must be used for HTTP bind, settings.json URLs, and UI display |
| `hook_event_types` | HIGH | List registered in settings.json must exactly match HTTP server routes |
| `database_path` | HIGH | Writer (HTTP server) and reader (UI) must use identical path |
| `version` | HIGH | Window display must match package.json at build time |

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Tauri 2.0 Windows system tray API instability | Low | High | Tauri 2.0 is stable; system tray is well-supported on Windows |
| settings.json merge corrupts user config | Low | Critical | Backup before merge; byte-identical backup; parse-validate-merge pattern |
| Port 3748 conflict with other tools | Medium | Medium | Detect and report clearly; future: configurable port |
| SQLite concurrent write performance | Low | Medium | WAL mode handles this; event volumes are modest |
| WebView2 availability on Windows 11 | Very Low | High | Ships with Windows 11; no additional install needed |

### Non-Functional Requirements

- **Install time**: Under 30 seconds on broadband connection
- **Startup time**: Under 3 seconds from command to tray icon visible
- **Event processing**: Handle 100+ events/second without dropping (multi-agent burst scenario)
- **Memory footprint**: Under 100MB RSS when idle
- **Binary size**: Under 15MB (Tauri advantage)
- **Data durability**: No silent event drops -- every received event persists to SQLite

### Exit Criteria (from product spec)

**Phase 0**: A tagged commit triggers the pipeline, the Windows binary appears on the GitHub Release, and `npx github:pmvanev/norbert-cc` installs and launches on a Windows 11 machine with no manual steps.

**Phase 1**: Install Norbert via npx, run Claude Code, trigger any action, and confirm via the UI that the hook event was captured. The app looks minimal but the entire data path is proven working.

### What Comes After the Walking Skeleton

The walking skeleton unlocks Phase 2 ("Does Something"):
- Session list view with clickable sessions
- Raw hook event display per session
- The moment Norbert becomes genuinely useful

And subsequently Phase 3 (Plugin Architecture) and Phase 4+ (Plugin Delivery), where the 19+ features described in the product spec are implemented as first-party and third-party plugins.

---

### Peer Review

**Review status**: Self-reviewed (single-developer project, no second reviewer available)

**Self-review checklist**:
- [x] All stories trace to job stories in JTBD analysis
- [x] All stories have 3+ domain examples with real persona data
- [x] All UAT scenarios use concrete data (Priya Chandrasekaran, specific numbers)
- [x] No technical AC -- all AC describe observable outcomes
- [x] No Implement-X anti-pattern -- all stories start from user pain
- [x] Shared artifacts tracked with single source of truth
- [x] Emotional arc documented and coherent
- [x] Error paths documented for high-anxiety steps (settings merge)
- [x] Stories right-sized (1-3 days, 3-5 scenarios each)
- [x] Dependencies explicitly tracked

**Known gaps**:
- Opportunity scoring uses team estimates, not user data (acceptable for greenfield)
- No second reviewer for peer review gate (escalated: single-developer context)
- Auto-launch on boot deferred to future story
