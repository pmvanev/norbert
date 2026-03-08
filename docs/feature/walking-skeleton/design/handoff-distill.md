# DESIGN Wave Handoff: Walking Skeleton

## Handoff Package for Acceptance Designer (DISTILL Wave)

### Feature Summary

**Feature ID**: walking-skeleton
**Stories**: US-WS-000, US-WS-001, US-WS-002, US-WS-003
**Architecture**: Modular monolith with ports-and-adapters (Tauri 2.0 + React + SQLite)
**Paradigm**: Functional-leaning (Rust traits, React hooks, pure transformations)

### Artifacts Produced

| Artifact | Path | Description |
|----------|------|-------------|
| Architecture Document | `docs/feature/walking-skeleton/design/architecture.md` | C4 diagrams (L1+L2+L3), component boundaries, data model, integration patterns, quality strategies |
| Component Boundaries | `docs/feature/walking-skeleton/design/component-boundaries.md` | Module map, responsibility matrix, boundary rules, future extraction points |
| Peer Review | `docs/feature/walking-skeleton/design/peer-review.md` | Self-review with critique dimensions, issues addressed |
| ADR-001 | `docs/adrs/ADR-001-architectural-style.md` | Modular monolith with ports-and-adapters |
| ADR-002 | `docs/adrs/ADR-002-technology-stack.md` | Tauri, Rust, React, SQLite, Vite |
| ADR-003 | `docs/adrs/ADR-003-database-design.md` | SQLite WAL, minimal schema, JSON payload storage |
| ADR-004 | `docs/adrs/ADR-004-development-paradigm.md` | Functional-leaning for Rust and TypeScript |
| ADR-005 | `docs/adrs/ADR-005-distribution-strategy.md` | npx from GitHub with postinstall binary download |
| ADR-006 | `docs/adrs/ADR-006-settings-merge-strategy.md` | Surgical JSON merge with backup |
| Handoff | `docs/feature/walking-skeleton/design/handoff-distill.md` | This document |

### Key Architecture Decisions for Downstream Consumers

1. **Ports-and-adapters**: Acceptance tests should exercise behavior through driving ports (HTTP endpoints, Tauri IPC commands) and verify outcomes through observable state (SQLite records, UI display). Do not test internal module structure.

2. **Data model**: Two tables (sessions, events). Events store full JSON payload. Session has denormalized event_count. Acceptance criteria should verify observable outcomes (event count, session timestamp) not schema details.

3. **Shared artifact constants**: HOOK_PORT (3748), DB_PATH, HOOK_EVENT_TYPES are single-source constants. Tests should use these constants, not hardcoded values.

4. **Settings merge safety**: The backup-first, validate-before-write, idempotent merge is the highest-risk component. Acceptance tests should cover: existing config preserved, missing file handled, malformed JSON handled, idempotent re-run.

5. **UI updates**: Frontend receives Tauri events for real-time updates. Acceptance criteria for "event count updates within 1 second" should account for this event-driven mechanism.

### Quality Gates Passed

- [x] Requirements traced to components
- [x] Component boundaries with clear responsibilities
- [x] Technology choices in ADRs with 2+ alternatives each
- [x] Quality attributes addressed (reliability, usability, maintainability, performance, installability, security)
- [x] Dependency-inversion compliance (ports/adapters, traits, dependencies inward)
- [x] C4 diagrams (L1+L2+L3, Mermaid)
- [x] Integration patterns specified
- [x] OSS preference validated (all MIT/Apache-2.0/Public Domain)
- [x] AC behavioral, not implementation-coupled
- [x] Peer review completed (self-review, 0 critical, 0 high, 1 medium addressed)

### Story Dependency Order (unchanged from DISCUSS)

```
US-WS-000 (CI/CD Pipeline)
    |
    v
US-WS-001 (App Shell) --> US-WS-002 (Data Pipeline) --> US-WS-003 (End-to-End)
```

### What the Acceptance Designer Needs to Know

- The walking skeleton has 17 scenarios from the DISCUSS wave (in `journey-walking-skeleton.feature`)
- Architecture supports all scenarios without modification
- Key integration checkpoints are documented in the shared artifacts registry
- The data model is intentionally minimal -- payload stored as JSON blob, not normalized
- Testing strategy: acceptance tests through HTTP endpoints and Tauri IPC commands
- Platform: Windows 11 x64 only for walking skeleton
