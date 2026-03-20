# Problem Validation: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Discovery Phase**: 1 -- Problem Validation
**Date**: 2026-03-20
**Status**: VALIDATED

---

## Problem Statement (Customer Words)

"Token usage data arrives 3-9 seconds late because we poll transcript JSONL files every 3 seconds. The charts feel sluggish, and sometimes the file isn't readable because Claude Code is still writing to it."

---

## Evidence: Past Behavior Analysis

Since the "customer" is ourselves (the Norbert development team), evidence comes from direct observation of the running system and codebase analysis rather than external interviews.

### Signal 1: Transcript Polling Latency (Direct Observation)

**What happened**: Token usage data is polled from transcript JSONL files at `POLL_INTERVAL_MS * 3` = 3000ms intervals (`src/App.tsx:322`). Combined with the filesystem write lag from Claude Code, effective latency is 3-9 seconds for token data to appear in charts.

**Impact**: Performance Monitor oscilloscope charts (`OscilloscopeView.tsx`) show stale data. Users see activity in the terminal but Norbert's cost ticker lags visibly behind.

**Severity**: Moderate -- degrades the real-time monitoring value proposition that differentiates Norbert from CLI tools like ccusage.

### Signal 2: Filesystem Access Failures (Direct Observation)

**What happened**: The transcript poller silently catches and ignores read errors (`src/App.tsx:319-321`). The Rust `get_transcript_usage` command opens the file with `std::fs::File::open` (`src-tauri/src/lib.rs:96`), which can fail when Claude Code is actively writing. On Windows, file locking conflicts are common.

**Impact**: Token data is intermittently missing. The `catch(() => {})` silently swallows errors, making debugging impossible. No telemetry on how often this fails.

**Severity**: Moderate -- data gaps in charts, no visibility into failure rate.

### Signal 3: Duplicate Data Architecture (Codebase Analysis)

**What happened**: Token/cost data flows through two independent paths:
1. **Hook receiver** (`hook_receiver.rs`): HTTP server on port 3748 receiving Claude Code hook events (session lifecycle, tool use). Does NOT include token usage.
2. **Transcript poller** (`App.tsx:270-325`): Frontend React effect polling JSONL files for token data, computing deltas, synthesizing fake `tool_call_end` events.

This creates a synthetic event pipeline where the frontend fabricates events (`provider: "transcript"`) to feed the metrics aggregator with token data the hooks don't provide.

**Impact**: Architectural complexity. Two data paths that should be one. The frontend is doing backend work (file I/O via Tauri IPC). Synthetic events pollute the event model.

**Severity**: High -- architectural debt that compounds with every new feature.

### Signal 4: Missing Cost Data in Real-Time (Direct Observation)

**What happened**: Claude Code hooks include `session_id`, `tool`, `cwd`, `transcript_path` but NOT `usage` (input_tokens, output_tokens, cost, model). This is explicitly documented in the codebase: "Claude Code hook payloads do NOT include token usage data" (`src/App.tsx:271`).

**Impact**: The core metric users care about (cost) requires a secondary data source. No real-time cost tracking is possible with hooks alone.

**Severity**: High -- blocks the primary use case without the transcript polling workaround.

### Signal 5: Competitive Disadvantage vs OTel-Based Tools (Research)

**What happened**: The competitive landscape research (2026-03-16) identified AI Observer and claude-code-otel as competitors that ingest Claude Code's native OpenTelemetry data directly, getting real-time token/cost data without filesystem polling. AI Observer receives OTel via HTTP/JSON and HTTP/Protobuf endpoints.

**Impact**: These tools get sub-second token data delivery while Norbert has 3-9 second latency. The polling approach is architecturally inferior to event-push via OTel.

**Severity**: High -- architectural gap vs emerging competition.

---

## Problem Confirmation

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Problem confirmation | >60% | 5/5 signals (100%) | PASS |
| Frequency | Weekly+ | Every active session | PASS |
| Current workaround cost | >$0 | Transcript polling code: ~60 LoC in App.tsx + 80 LoC in lib.rs | PASS |
| Emotional intensity | Frustration evident | Architectural frustration -- synthetic events, silent failures | PASS |

---

## Validated Problem (Customer Words)

"Norbert's token and cost data arrives seconds late because we read transcript files from disk instead of receiving OTel events in real-time. This makes the real-time monitoring feel fake. Claude Code already emits exactly the data we need via OpenTelemetry -- we're just not listening."

---

## Assumptions to Test in Phase 2

| # | Assumption | Risk Score | Category |
|---|-----------|------------|----------|
| A1 | Claude Code OTel exports `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `cost_usd`, `model` in the `claude_code.api_request` event | Impact:3 x3=9, Uncertainty:2 x2=4, Ease:1 x1=1 = **14** | Feasibility |
| A2 | OTel data can be configured to export ONLY to a local endpoint (no data leakage) | Impact:3 x3=9, Uncertainty:2 x2=4, Ease:1 x1=1 = **14** | Viability (privacy) |
| A3 | A Rust OTLP HTTP receiver can be embedded in the Tauri backend without excessive binary size | Impact:2 x3=6, Uncertainty:2 x2=4, Ease:2 x1=2 = **12** | Feasibility |
| A4 | OTel integration fully replaces transcript polling (no data loss) | Impact:3 x3=9, Uncertainty:2 x2=4, Ease:1 x1=1 = **14** | Value |
| A5 | OTel data volume is manageable for local SQLite (not overwhelming) | Impact:2 x3=6, Uncertainty:1 x2=2, Ease:1 x1=1 = **9** | Feasibility |

---

## Gate G1 Evaluation

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| Interviews/signals | 5+ | 5 signals from codebase + system observation | PASS |
| Problem confirmation | >60% | 100% (5/5) | PASS |
| Problem in customer words | Yes | Yes -- documented above | PASS |
| Examples | 3+ | 5 concrete examples with code references | PASS |

**G1 Decision: PROCEED to Phase 2 (Opportunity Mapping)**

---

## Methodological Note

This discovery adapts the standard Mom Test interview process for an infrastructure feature where the team IS the customer. Instead of external interviews, evidence comes from:
- Direct codebase analysis (primary source of truth)
- System behavior observation during development
- Competitive research from the 2026-03-16 landscape study
- Architectural pattern analysis

This is valid under the "past behavior over future intent" principle -- all signals are based on what the system actually does today, not predictions about what users might want.
