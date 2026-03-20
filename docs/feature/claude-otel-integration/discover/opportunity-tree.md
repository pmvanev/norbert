# Opportunity Solution Tree: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Discovery Phase**: 2 -- Opportunity Mapping
**Date**: 2026-03-20
**Status**: COMPLETE

---

## Desired Outcome

**Minimize the time between Claude Code generating token usage data and Norbert displaying it in real-time charts, while maintaining local-first privacy guarantees.**

---

## Job Map (JTBD)

| Step | Current State | Pain Point |
|------|--------------|------------|
| **Define** | Norbert needs token/cost data from Claude Code | Data exists in two places: hooks (no tokens) and transcripts (delayed) |
| **Locate** | Frontend polls transcript JSONL files via Tauri IPC | 3-second poll interval + filesystem write lag = 3-9s latency |
| **Prepare** | Parse JSONL, compute deltas, synthesize fake events | Fragile: silent failures, file locking, synthetic event pollution |
| **Execute** | Feed synthetic events into metrics aggregator | Works but architecturally wrong -- frontend doing backend work |
| **Monitor** | Charts display token/cost rates | Stale data, intermittent gaps from read failures |
| **Modify** | No correction mechanism for missed data | Silent catch swallows errors, no retry, no gap detection |
| **Conclude** | Session ends, final transcript read | May miss final tokens if file locked during shutdown |

---

## Opportunity Solution Tree

```
Desired Outcome: Real-time token/cost data with <1s latency, local-only
  |
  +-- OPP-1: Real-time token data delivery (Score: 18)
  |     +-- SOL-A: Embedded OTLP HTTP receiver in Tauri backend
  |     +-- SOL-B: Sidecar OTel collector process
  |     +-- SOL-C: Named pipe / Unix socket receiver
  |
  +-- OPP-2: Eliminate transcript polling complexity (Score: 16)
  |     +-- SOL-D: Replace transcript poller with OTel receiver (full replacement)
  |     +-- SOL-E: OTel primary + transcript fallback (graceful degradation)
  |
  +-- OPP-3: Privacy-preserving local-only telemetry (Score: 15)
  |     +-- SOL-F: Configure OTEL_EXPORTER_OTLP_ENDPOINT to localhost only
  |     +-- SOL-G: Norbert manages Claude Code env vars at launch
  |
  +-- OPP-4: Richer real-time metrics beyond tokens (Score: 12)
  |     +-- SOL-H: Ingest OTel spans for tool execution timing
  |     +-- SOL-I: Ingest OTel traces for agent orchestration visibility
  |
  +-- OPP-5: Multi-provider OTel ingestion (Score: 10)
  |     +-- SOL-J: Generic OTLP receiver supporting Gemini CLI, Codex CLI
  |     +-- SOL-K: Provider-specific OTel event parsers
  |
  +-- OPP-6: Unified data pipeline (Score: 14)
  |     +-- SOL-L: Single ingestion path: hooks + OTel -> SQLite
  |     +-- SOL-M: OTel-first architecture, deprecate hook-only data
  ```

---

## Opportunity Scoring

**Formula**: Score = Importance + Max(0, Importance - Satisfaction)

| # | Opportunity | Importance (1-10) | Satisfaction (1-10) | Score | Action |
|---|------------|-------------------|--------------------:|------:|--------|
| OPP-1 | Real-time token data delivery | 9 | 0 | **18** | Pursue |
| OPP-2 | Eliminate transcript polling complexity | 8 | 0 | **16** | Pursue |
| OPP-3 | Privacy-preserving local-only telemetry | 9 | 6 | **12** | Pursue |
| OPP-6 | Unified data pipeline | 7 | 0 | **14** | Pursue |
| OPP-4 | Richer real-time metrics beyond tokens | 6 | 0 | **12** | Evaluate |
| OPP-5 | Multi-provider OTel ingestion | 5 | 0 | **10** | Evaluate |

### Scoring Rationale

- **OPP-1 (18)**: Core value proposition. Satisfaction is 0 because current approach (transcript polling) delivers data 3-9s late with gaps. Importance is 9 because real-time monitoring is Norbert's primary differentiator.
- **OPP-2 (16)**: The transcript polling code is architectural debt. 60+ LoC of React effects doing backend file I/O, synthesizing fake events. Satisfaction 0 because current approach is fragile.
- **OPP-3 (12)**: Privacy is table-stakes for local-first. Partially satisfied (6) because current hook system is already local-only, but OTel introduces new privacy surface area.
- **OPP-6 (14)**: Two data paths (hooks + transcripts) should be one. Not satisfied at all today.
- **OPP-4 (12)**: Nice-to-have. OTel spans could provide tool execution timing that hooks don't capture well.
- **OPP-5 (10)**: Strategic but not urgent. Provider abstraction already exists in the codebase.

---

## Top 3 Opportunities (Prioritized)

### 1. OPP-1: Real-time token data delivery (Score: 18)

**Job statement**: Minimize the latency between Claude Code generating token usage data and Norbert displaying it.

**Current state**: 3-9 second latency via transcript JSONL polling.
**Target state**: Sub-second latency via OTel event push.

**Solution candidates to test**:
- **SOL-A (Embedded OTLP HTTP receiver)**: Add an OTLP HTTP endpoint to the existing Tauri backend or hook receiver. Claude Code sends OTel data directly to Norbert. Simplest deployment -- no additional processes.
- **SOL-B (Sidecar OTel collector)**: Run a lightweight OTel collector alongside Norbert. More complex deployment but more flexible routing.
- **SOL-C (Named pipe / Unix socket)**: Lower-overhead IPC. Platform-specific complexity.

**Recommended**: SOL-A -- embed in existing infrastructure. The hook receiver (`hook_receiver.rs`) already runs an axum HTTP server on port 3748. Adding an OTLP HTTP endpoint is incremental.

### 2. OPP-2: Eliminate transcript polling complexity (Score: 16)

**Job statement**: Minimize the code complexity required to get token data into the metrics pipeline.

**Current state**: ~140 LoC across frontend (`App.tsx:270-325`) and backend (`lib.rs:70-156`) with silent error handling, synthetic events, and dual data paths.
**Target state**: OTel events flow directly into the metrics aggregator via the hook bridge, same as hook events.

**Solution candidates**:
- **SOL-D (Full replacement)**: OTel completely replaces transcript polling. Remove transcript poller code.
- **SOL-E (Graceful degradation)**: OTel primary, transcript polling fallback for users who haven't enabled OTel.

**Recommended**: SOL-E initially (backward compatibility), migrate to SOL-D as OTel adoption matures.

### 3. OPP-6: Unified data pipeline (Score: 14)

**Job statement**: Minimize the number of independent data paths feeding the metrics aggregator.

**Current state**: Two paths -- hooks (HTTP POST to port 3748) and transcripts (Tauri IPC file read + synthetic events).
**Target state**: Single ingestion path where hooks and OTel events converge in the backend before reaching the frontend.

**Solution candidates**:
- **SOL-L**: Both hooks and OTel data persist to SQLite. Frontend reads from one source.
- **SOL-M**: OTel becomes the primary data source. Hooks provide session lifecycle only.

**Recommended**: SOL-L -- unify at the storage layer.

---

## Gate G2 Evaluation

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| Opportunities identified | 5+ | 6 distinct opportunities | PASS |
| Top scores | >8 | 18, 16, 14 (top 3) | PASS |
| Job step coverage | 80%+ | 7/7 job steps addressed | PASS |
| Team alignment | Confirmed | Self-directed (team = developer) | PASS |

**G2 Decision: PROCEED to Phase 3 (Solution Testing)**
