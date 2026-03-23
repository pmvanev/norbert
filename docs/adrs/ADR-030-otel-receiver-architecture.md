# ADR-030: OTel Receiver Architecture

## Status

Accepted (updated 2026-03-23: corrected route from `/v1/traces` to `/v1/logs` per research findings)

## Context

Claude Code natively exports OpenTelemetry **log/event** data containing per-request token usage, cost, prompt, tool execution, API error, and tool decision information. Norbert currently receives hook events via POST /hooks/:type on port 3748 and separately polls transcript JSONL files for token data (3-9 second latency). Adding an OTLP/HTTP receiver would provide sub-second token/cost delivery via a push model.

**Research correction (2026-03-23)**: Claude Code sends OTel **logs** (`ExportLogsServiceRequest` to `/v1/logs`), not traces (`ExportTraceServiceRequest` to `/v1/traces`). See `docs/research/claude-code-otel-telemetry-actual-emissions.md`.

The question is where to host the OTLP receiver: extend the existing axum server, run a separate process, or use a standard OTel collector.

## Decision

Extend the existing hook receiver (axum on port 3748) with a new `POST /v1/logs` route. No new processes, ports, or binaries.

The `/v1/metrics` route is deferred -- the log/event path provides per-request granular data that is strictly more useful than the aggregated metrics counters.

## Alternatives Considered

### A: Separate OTel Collector process (otel-collector-contrib)
- Full-featured OTLP receiver with filtering, transformation, and export
- **Rejected**: 50MB+ binary, Docker or process management overhead, contradicts local-first single-binary philosophy (ADR-005). Massively over-scoped for extracting attributes from 5 event types.

### B: Separate Rust binary for OTLP
- Dedicated `norbert-otel-receiver` binary alongside `norbert-hook-receiver`
- **Rejected**: Doubles sidecar management complexity. Both binaries need the same SQLite access, same AppState pattern. Port allocation becomes a problem (two processes need two ports, but Claude Code OTel exporter targets one endpoint).

### C: Extend existing hook receiver (selected)
- Add route to existing axum router, share AppState and EventStore
- Single port (3748) serves both hooks and OTLP
- Claude Code sets `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:3748`
- Zero deployment change

## Consequences

- **Positive**: Zero new processes, zero new ports, zero new binaries. Simplest possible deployment. Single port for all Claude Code -> Norbert communication.
- **Positive**: OTLP handler shares existing EventStore and session management. No data synchronization between processes.
- **Negative**: Hook receiver binary grows slightly (OTLP parsing logic). Acceptable given the alternative complexity.
- **Negative**: If OTLP traffic volume grows significantly, it shares resources with hook handling. Mitigated: both are lightweight, local-only HTTP handlers.
