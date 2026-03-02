# Handoff Package: Norbert Observatory -- DISCUSS to DESIGN Wave

**Feature ID**: norbert
**Date**: 2026-03-02
**From**: product-owner (Luna)
**To**: solution-architect (DESIGN wave)
**Status**: DoR PASSED for 8 MVP stories -- ready for architecture and design

---

## Package Contents

| Artifact | File | Description |
|----------|------|-------------|
| JTBD Analysis | `docs/feature/norbert/discuss/jtbd-analysis.md` | 3 personas, 7 job stories, 12 outcome statements, four forces, opportunity scoring |
| Journey Visual | `docs/feature/norbert/discuss/journey-observatory-visual.md` | ASCII flow with emotional arc, 6-step journey, TUI mockups, web dashboard mockups |
| Journey Schema | `docs/feature/norbert/discuss/journey-observatory.yaml` | Machine-readable journey with shared artifacts, integration checkpoints, Gherkin per step |
| Journey Gherkin | `docs/feature/norbert/discuss/journey-observatory.feature` | 24 BDD scenarios covering all journey steps, error paths, and properties |
| Shared Artifacts Registry | `docs/feature/norbert/discuss/shared-artifacts-registry.md` | 14 tracked artifacts with sources, consumers, and integration validation checklist |
| User Stories | `docs/feature/norbert/discuss/user-stories.md` | 8 MVP stories with LeanUX template, domain examples, UAT scenarios, AC, DoR validation |
| This Handoff | `docs/feature/norbert/discuss/handoff-design.md` | Summary, risk assessment, design guidance, open questions |

## Upstream Context (from DISCOVER Wave)

| Artifact | File | Key Insights |
|----------|------|-------------|
| Problem Validation | `docs/feature/norbert/discover/problem-validation.md` | 7/7 pain signals validated |
| Opportunity Tree | `docs/feature/norbert/discover/opportunity-tree.md` | 13 opportunities, top scores 17/17/16 |
| Solution Testing | `docs/feature/norbert/discover/solution-testing.md` | 4 concepts tested, all passing |
| Lean Canvas | `docs/feature/norbert/discover/lean-canvas.md` | GO with conditions |
| MCP Research | `docs/research/mcp-ecosystem-observability-research.md` | 28 sources, hooks validated |
| Extensibility Research | `docs/research/extensibility-visibility-research.md` | 12+ extension points, 34 sources |
| Feature Gap Analysis | `docs/research/feature-gap-analysis.md` | 27 gaps, 6 critical |

---

## Architecture Summary (Validated by Research)

```
Data Capture:
  Claude Code Hooks (7 configured event types)
    --> Async HTTP POST (non-blocking, fire-and-forget)
    --> Norbert Background Server (localhost)
    --> SQLite Local Database (OTel-aligned schema)

Query Interfaces:
  1. Web Dashboard (localhost:${norbert_port}) -- primary interface
     --> SQLite reads via API layer
     --> WebSocket for near-real-time updates

  2. CLI Quick Queries -- secondary interface
     --> Direct SQLite reads
     --> Human-readable + JSON output modes

  3. Norbert-as-MCP-Server (Phase 2) -- tertiary interface
     --> Claude Code can query observability data in-conversation
```

**Key architectural constraint**: Norbert hooks MUST be non-blocking (async HTTP POST). Claude Code operation must never be affected by Norbert server state. If Norbert crashes, Claude Code continues normally.

---

## MVP Scope -- 8 Stories

| # | Story | Days | Scenarios | Priority |
|---|-------|------|-----------|----------|
| US-001 | Walking Skeleton | 3 | 4 | Must Have |
| US-002 | Event Capture Pipeline | 2 | 4 | Must Have |
| US-003 | Dashboard Overview | 3 | 4 | Must Have |
| US-004 | Execution Trace Graph | 3 | 4 | Must Have |
| US-005 | MCP Health Dashboard | 3 | 4 | Must Have |
| US-006 | Token Cost Waterfall | 2 | 4 | Must Have |
| US-007 | Session Comparison | 2 | 3 | Should Have |
| US-008 | Session History | 2 | 4 | Should Have |
| **Total** | | **20 days** | **31 scenarios** | |

---

## Personas Summary

| Persona | Role | Primary Job | Key Metric |
|---------|------|-------------|-----------|
| Rafael Oliveira | Senior dev, daily power user | Cost diagnosis + MCP health | Diagnosis time < 2 min |
| Priya Chakraborty | Framework dev, 15+ CLAUDE.md files | Agent trace debugging + MCP overhead | Trace failure in < 2 min |
| Marcus Chen | Team lead, 4 developers | Budget tracking + team optimization | Weekly cost visibility |

---

## Risk Assessment

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Anthropic builds native observability | Medium | High | Speed to market, community building, depth features they will not build |
| Market too small for power users only | Low | Medium | MCP adoption growing (97M+ monthly SDK downloads); expand to moderate users via Phase 2 |
| Users unwilling to pay | Medium | Medium | Freemium model; free tier proves value before monetization |

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Hook API instability (A3/A8) | Medium | High | Phase 0 spike validates hook reliability; monitor Claude Code changelogs |
| Token counting inaccuracy | Medium | Medium | Display as "estimates" with footnote; improve accuracy iteratively |
| Hook event data insufficient | Low | Medium | disler project validates data richness; 3+ forks confirm |
| WebSocket real-time performance | Low | Low | Standard technology; degrade gracefully to polling |

### Project Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Scope creep into Phase 2 features | Medium | Medium | Clear Phase 1/2 boundary; context pressure and MCP overhead analyzer explicitly Phase 2 |
| Dashboard UX complexity | Medium | Medium | Progressive disclosure; "Chrome DevTools for agents" mental model |

---

## Design Guidance (Solution-Neutral Observations)

### Observation-First Framing
Norbert is an **observatory**, not a dashboard or orchestrator. Users want to SEE what happened (post-hoc dominates). Design should prioritize clarity of observation over real-time monitoring. The primary use case is: "I just finished a session -- show me what happened."

### Progressive Complexity
- **Overview page**: answers "what happened today?" in 5 seconds
- **Session detail**: answers "what went wrong in this session?" in 2 minutes
- **MCP panel**: answers "why did my MCP server fail?" in 1 minute
- **Comparison**: answers "did my optimization work?" in 30 seconds

### CLI/Dashboard Parity
Both interfaces must show the same data. The CLI is for quick checks (cost, status, trace summary). The dashboard is for visual exploration (DAGs, charts, heatmaps). Neither should have exclusive features -- only different representations.

### Walking Skeleton First
US-001 must be built and validated before any other story begins. It proves the architecture. If hooks do not work, everything else is moot. This is the Phase 0 spike.

---

## Open Design Questions for Solution Architect

1. **Web framework choice**: React, Vue, Svelte, or other? Must be lightweight (local-first tool).
2. **DAG visualization library**: D3.js, Cytoscape.js, Mermaid, or custom? Must handle 20+ agent nodes.
3. **SQLite access pattern**: Direct file access for CLI, API layer for dashboard, or both?
4. **Background server technology**: Bun (fast, minimal) vs. Node.js (mature, ecosystem)?
5. **Hook script language**: Shell script calling curl, or Node.js script for richer error handling?
6. **WebSocket vs polling**: Real-time dashboard updates via WebSocket (disler pattern) or simpler polling?
7. **Cost estimation model**: Static rate table vs. dynamic Anthropic API pricing lookup?
8. **Data retention**: SQLite row-level TTL or periodic batch cleanup?
9. **Context window size detection**: How to determine model's context window size from hook data?
10. **Token counting**: tiktoken estimation from payloads, or extract from API response metadata if available?

---

## Acceptance Test Handoff for DISTILL Wave

The following artifacts are ready for the acceptance-designer (Quinn):

| Artifact | Location | Content |
|----------|----------|---------|
| Journey Gherkin | `journey-observatory.feature` | 24 scenarios with concrete data |
| Story UAT scenarios | `user-stories.md` (embedded) | 31 scenarios across 8 stories |
| Shared artifacts | `shared-artifacts-registry.md` | 14 tracked artifacts for integration testing |
| Integration checkpoints | `journey-observatory.yaml` (per step) | 6 validation points |

Total testable scenarios: 55 (24 journey + 31 story-level)

---

## Definition of Ready -- Final Confirmation

All 8 MVP stories pass the 8-item DoR checklist:

| DoR Item | US-001 | US-002 | US-003 | US-004 | US-005 | US-006 | US-007 | US-008 |
|----------|--------|--------|--------|--------|--------|--------|--------|--------|
| 1. Problem clear | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 2. Persona identified | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 3. 3+ examples | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 4. UAT (3-7) | PASS (4) | PASS (4) | PASS (4) | PASS (4) | PASS (4) | PASS (4) | PASS (3) | PASS (4) |
| 5. AC from UAT | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 6. Right-sized | PASS (3d) | PASS (2d) | PASS (3d) | PASS (3d) | PASS (3d) | PASS (2d) | PASS (2d) | PASS (2d) |
| 7. Tech notes | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| 8. Dependencies | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

**DoR Status: ALL PASSED. Ready for DESIGN wave.**
