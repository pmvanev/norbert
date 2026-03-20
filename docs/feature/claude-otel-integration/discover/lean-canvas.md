# Lean Canvas: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Discovery Phase**: 4 -- Market Viability
**Date**: 2026-03-20
**Status**: COMPLETE

---

## Lean Canvas

### 1. Problem (Phase 1 Validated)

| # | Problem | Evidence |
|---|---------|----------|
| P1 | Token/cost data arrives 3-9 seconds late due to transcript file polling | Direct measurement: POLL_INTERVAL_MS * 3 = 3000ms + filesystem lag |
| P2 | Transcript file reads fail silently on Windows due to file locking | Silent catch in App.tsx:319-321, no error telemetry |
| P3 | Dual data paths (hooks + transcripts) create architectural complexity | ~140 LoC of synthetic event generation bridging two independent paths |

### 2. Customer Segments (by JTBD)

| Segment | Job | Size |
|---------|-----|------|
| **Primary**: Norbert users (Claude Code developers) | Monitor real-time token usage and cost while coding | All Norbert users |
| **Secondary**: Multi-agent orchestration users | Track costs across parallel Claude Code sessions | Power users running 2-5 agents |
| **Future**: Multi-provider users | Monitor Gemini CLI, Codex CLI via same OTel pipeline | Norbert's multi-provider roadmap |

### 3. Unique Value Proposition

**Real-time, sub-second token and cost visibility for Claude Code sessions -- delivered via native OTel telemetry, not fragile file polling. With authoritative cost data direct from Anthropic's pricing, not estimates.**

### 4. Solution (Phase 3 Validated)

| # | Feature | Addresses |
|---|---------|-----------|
| S1 | OTLP/HTTP receiver embedded in hook receiver (axum route on port 3748) | P1 -- sub-second delivery |
| S2 | OTel-aware session detection with transcript polling fallback | P2 -- no more file locking failures |
| S3 | Unified event pipeline: hooks + OTel -> single EventStore | P3 -- eliminates dual data paths |
| S4 | Setup wizard for OTel enablement (env var configuration) | Adoption -- reduce friction |

### 5. Channels

| Channel | Mechanism |
|---------|-----------|
| In-app setup wizard | Norbert detects missing OTel config, prompts user to enable |
| Documentation | Setup guide in Norbert docs and README |
| Plugin marketplace | Feature announcement via nWave marketplace update |

### 6. Revenue Streams

Not applicable -- Norbert is an open-source tool. Value is measured in:
- Reduced development time (eliminate transcript polling maintenance)
- Improved user experience (real-time data)
- Competitive positioning (architectural parity with AI Observer)

### 7. Cost Structure

| Cost | Estimate | Type |
|------|----------|------|
| Development: OTLP receiver in Rust | 3-5 days | One-time |
| Development: Frontend integration + fallback logic | 2-3 days | One-time |
| Development: Setup wizard UI | 1-2 days | One-time |
| Testing: Integration tests, Windows file locking verification | 1-2 days | One-time |
| New dependency: `opentelemetry-proto` or manual OTLP JSON parsing | ~2MB binary size | Ongoing |
| Maintenance: Schema changes if Claude Code updates OTel format | <1 day/quarter estimated | Ongoing |

**Total estimated effort**: 7-12 days

### 8. Key Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Token data latency | 3-9 seconds | <500ms | Timestamp delta: OTel event received_at vs chart update |
| Data gap rate (missed samples) | Unknown (errors silently swallowed) | 0% | Count of expected vs received OTel events per session |
| Transcript polling LoC | ~140 lines | 0 lines (after full migration) | Code count |
| Cost accuracy | Estimated via local pricing table | Exact (from `cost_usd` attribute) | Compare Norbert cost vs Anthropic billing |

### 9. Unfair Advantage

- **Existing hook infrastructure**: axum HTTP server already running on port 3748, SQLite event store, canonical event types -- adding OTLP is incremental, not greenfield.
- **Provider abstraction layer**: `EventProvider` trait already normalizes raw events. Adding an OTel provider follows the established pattern.
- **Desktop app UX**: AI Observer requires Docker. claude-code-otel requires Grafana stack. Norbert embeds everything in a single desktop app with zero infrastructure.

---

## 4 Big Risks Assessment

### Value Risk: Will users want this?

| Signal | Evidence | Verdict |
|--------|----------|---------|
| Real-time monitoring is Norbert's core differentiator | Product spec, competitive matrix | Strong value |
| Current 3-9s latency undermines "real-time" claim | Direct measurement | Pain is real |
| Competitors already use OTel (AI Observer, claude-code-otel) | Competitive landscape research | Market validation |
| Authoritative cost_usd eliminates pricing table drift | OTel field analysis | Bonus value |

**Verdict: GREEN** -- this directly improves the primary use case.

### Usability Risk: Can users set this up?

| Signal | Evidence | Verdict |
|--------|----------|---------|
| Requires setting 2 env vars | Claude Code documentation | Simple but manual |
| Setup wizard reduces to 1-click | Solution testing (Hypothesis 3) | Mitigated |
| Backward compatible with transcript fallback | Migration strategy (SOL-E) | No breaking change |

**Verdict: GREEN** -- setup wizard + fallback ensure usability.

### Feasibility Risk: Can we build this?

| Signal | Evidence | Verdict |
|--------|----------|---------|
| axum already handles HTTP routes | Existing hook_receiver.rs | Proven |
| OTLP JSON parseable with existing serde_json | Dependency analysis | No new deps required for MVP |
| EventStore handles arbitrary event types | Existing architecture | Extensible |
| AI Observer proves this architecture works | Competitive analysis | Validated externally |
| Binary size impact <5MB | serde_json already included | Acceptable |

**Verdict: GREEN** -- incremental extension of proven infrastructure.

### Viability Risk: Does this work for the business?

| Signal | Evidence | Verdict |
|--------|----------|---------|
| 7-12 days development effort | Estimate based on codebase familiarity | Reasonable |
| Eliminates transcript polling maintenance burden | ~140 LoC removed long-term | Net negative maintenance |
| Opens multi-provider future (Gemini CLI, Codex CLI) | OTel is a standard protocol | Strategic alignment |
| No external service dependencies | Local-only architecture | Consistent with Norbert values |

**Verdict: GREEN** -- positive ROI, strategically aligned.

---

## Gate G4 Evaluation

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| Lean Canvas complete | Yes | All 9 sections filled with validated evidence | PASS |
| Value risk | Green/Yellow | GREEN | PASS |
| Usability risk | Green/Yellow | GREEN | PASS |
| Feasibility risk | Green/Yellow | GREEN | PASS |
| Viability risk | Green/Yellow | GREEN | PASS |
| Channel validated | 1+ viable | In-app setup wizard + documentation | PASS |
| Stakeholder signoff | Required | Self-directed (sole developer) | PASS |

**G4 Decision: PROCEED to handoff**

---

## Go/No-Go Summary

**DECISION: GO**

| Factor | Assessment |
|--------|-----------|
| Problem validated? | Yes -- 5/5 signals confirm real pain with current architecture |
| Opportunity clear? | Yes -- top 3 opportunities score 14-18 (well above >8 threshold) |
| Solution tested? | Yes -- all feasibility tests pass, architecture incrementally extends existing infrastructure |
| Risks acceptable? | Yes -- all 4 big risks GREEN |
| Effort justified? | Yes -- 7-12 days for sub-second latency, eliminated polling, authoritative cost data, multi-provider foundation |

**Recommended implementation order**:
1. Add OTLP/HTTP route to hook receiver (SOL-A)
2. Add `ApiRequest` event type and OTel-to-canonical mapper
3. Frontend: detect OTel events, suppress transcript polling per-session
4. Setup wizard for OTel enablement
5. (Later) Remove transcript polling code entirely
