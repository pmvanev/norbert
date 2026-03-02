# Observability Design: Norbert Observatory

**Feature ID**: norbert
**Architect**: Apex (Platform Architect)
**Date**: 2026-03-02
**Status**: DRAFT -- pending peer review

---

## 1. Observability Context

Norbert is an observability tool that runs on the user's machine. It does not need cloud-scale observability for itself. However, it must be **self-diagnosable**: when something goes wrong, the user (or a bug report) must contain enough information to identify the cause without remote access to the user's machine.

### 1.1 Simplest Solution Check

**Proposed approach**: Structured JSON logs to local file + `norbert status` health command + `norbert doctor` diagnostics command.

#### Rejected Simpler Alternatives

**Alternative 1: No logging, rely on stderr output only**
- What: Errors print to stderr. No persistent log file.
- Expected impact: Meets 40% of requirements (immediate errors visible).
- Why insufficient: Users close terminals. Bug reports have no context. Intermittent issues are unreproducible without historical logs.

**Alternative 2: Unstructured text log file**
- What: `console.log` style messages appended to a log file.
- Expected impact: Meets 70% of requirements (persistent, searchable by grep).
- Why insufficient: Unstructured logs resist programmatic analysis. Cannot correlate events across sessions. Cannot build `norbert doctor` diagnostics without parseable format.

**Selected**: Structured JSON logs with a health check command and diagnostics command. This is the simplest approach that enables both user self-service diagnostics and effective bug reporting.

---

## 2. SLOs for Norbert (Local Tool Context)

These are not SLAs (there is no service contract). They are internal quality targets that drive the design of logging and health checks.

| SLO | Target | Measurement | Rationale |
|-----|--------|-------------|-----------|
| Event capture reliability | 99.5% of hook events captured when server is running | `events_received / hooks_fired` (sampled) | Users expect captured events to appear. Occasional drops during server restart are acceptable. |
| Event processing latency | < 100ms p99 from HTTP POST received to SQLite write | Timestamp delta in log (request received -> write complete) | Norbert must not slow down the hook -> dashboard feedback loop. |
| Dashboard load time | < 2 seconds for 100 sessions | Browser performance timing (manual measurement) | Architecture design specifies this as a quality attribute target. |
| Server startup time | < 3 seconds | Log: server_started - process_started | Quick startup is critical for `norbert init` and `norbert serve` experience. |
| Hook overhead on Claude Code | < 50ms per hook invocation | Hook script execution time (instrumented in hook template) | ADR-007 constraint: hooks must be non-blocking. |

---

## 3. Logging Architecture

### 3.1 Log Format

All logs are structured JSON, one object per line (JSONL format):

```json
{
  "ts": "2026-03-02T14:23:01.456Z",
  "level": "info",
  "module": "server",
  "event": "event_received",
  "session_id": "abc-123",
  "event_type": "PostToolUse",
  "duration_ms": 3,
  "msg": "Event received and persisted"
}
```

### 3.2 Log Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ts` | ISO 8601 string | Yes | Timestamp with millisecond precision |
| `level` | `error` / `warn` / `info` / `debug` | Yes | Log level |
| `module` | string | Yes | Source module: `server`, `cli`, `storage`, `hooks`, `config` |
| `event` | string | Yes | Machine-readable event name (snake_case) |
| `msg` | string | Yes | Human-readable message |
| `session_id` | string | When applicable | Claude Code session ID for correlation |
| `duration_ms` | number | When applicable | Operation duration |
| `error` | string | On errors | Error message |
| `stack` | string | On errors (debug level) | Stack trace |

### 3.3 Log Levels

| Level | Usage | Default Enabled |
|-------|-------|-----------------|
| `error` | Unrecoverable failures, data loss risk | Yes |
| `warn` | Degraded operation, recoverable issues (port conflict, malformed event) | Yes |
| `info` | Significant lifecycle events (server start/stop, session start, config loaded) | Yes |
| `debug` | Detailed operation (every event received, SQL queries, WebSocket messages) | No |

Default level: `info`. Configurable via `~/.norbert/config.json` (`logLevel` field) or `NORBERT_LOG_LEVEL` environment variable.

### 3.4 Log Location and Rotation

- **Path**: `~/.norbert/logs/norbert.log`
- **Rotation**: Daily rotation, keep 7 days. Format: `norbert.log`, `norbert-2026-03-01.log`, etc.
- **Max size**: 10 MB per file. If a single day exceeds 10 MB, rotate to `norbert.log.1`.
- **Total cap**: 70 MB (7 days x 10 MB). Old files auto-deleted.

**Implementation**: Lightweight log rotation built into the logging module (no dependency on external log rotation tools). This keeps the npm package simple.

### 3.5 Logging Rules by Module

| Module | What to Log | What NOT to Log |
|--------|-------------|-----------------|
| **core** | Nothing. Pure functions do not log. | Everything. Core returns values, it does not side-effect. |
| **server** | Event received, event persisted, server start/stop, WebSocket connect/disconnect, error responses | Event payload contents (privacy), raw SQL queries at info level |
| **storage** | Migration applied, database opened, schema version, write errors | Individual row data, SELECT query results |
| **cli** | Command invoked, config loaded, server started/stopped | User input (privacy) |
| **hooks** | Hook installed, hook fired (debug only), hook error | Hook payload contents |
| **config** | Config loaded, config validation error, defaults applied | Full config contents (may contain user paths) |

### 3.6 No Logging in Pure Core

Per the development paradigm (functional-leaning TypeScript, pure core / effect shell): the `@norbert/core` package contains zero logging. Pure functions return `Result` types for errors. Logging happens at the effect shell boundary (server, CLI, storage) where the Result is inspected and the outcome is logged.

---

## 4. Health Check and Diagnostics

### 4.1 `norbert status` Command

Quick health check for the running Norbert instance:

```
$ norbert status

Norbert Observatory v0.1.0
  Server:       running (PID 12345, uptime 3h 22m)
  Port:         7890
  Database:     ~/.norbert/norbert.db (2.4 MB)
  Events:       1,247 captured (42 today)
  Sessions:     6 today, 89 total
  MCP Servers:  4 seen (github, sentry, postgres, omni-search)
  Last Event:   PostToolUse (Read) -- 12 seconds ago
  Hook Status:  7/7 configured in .claude/settings.json
  Log File:     ~/.norbert/logs/norbert.log (142 KB)
```

**Implementation**: CLI reads from SQLite directly (no server dependency for basic status). Server status checked via HTTP health endpoint.

### 4.2 Health Endpoint (`GET /health`)

HTTP health check for the server process:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime_seconds": 12120,
  "database": {
    "status": "ok",
    "path": "/Users/rafael/.norbert/norbert.db",
    "size_bytes": 2457600,
    "schema_version": 1
  },
  "events": {
    "total": 1247,
    "today": 42,
    "last_received": "2026-03-02T14:22:49.000Z"
  }
}
```

### 4.3 `norbert doctor` Command (Diagnostics)

Comprehensive self-diagnostic for troubleshooting:

```
$ norbert doctor

Norbert Diagnostics
  [PASS] Node.js version: v20.11.0 (>= 20 required)
  [PASS] pnpm available: v9.1.0
  [PASS] Config file: ~/.norbert/config.json (valid)
  [PASS] Database: ~/.norbert/norbert.db (readable, writable)
  [PASS] Schema version: 1 (up to date)
  [PASS] Port 7890: available
  [PASS] Server process: running (PID 12345)
  [PASS] Health endpoint: http://localhost:7890/health responds 200
  [WARN] Hook config: 7/7 hooks configured, but .claude/settings.json
         last modified 14 days ago (hooks may be stale)
  [PASS] Log file: ~/.norbert/logs/norbert.log (writable, 142 KB)
  [PASS] Disk space: 45 GB free (> 100 MB required)
  [INFO] better-sqlite3: native binding loaded (linux-x64)
  [INFO] Last error in logs: none in past 24 hours

  Overall: HEALTHY (1 warning)
```

**Checks performed**:
1. Node.js version >= 20
2. Config file exists and is valid JSON
3. Database file exists, is readable and writable
4. Schema version matches expected
5. Configured port is available (or server is running on it)
6. Server health endpoint responds
7. Hook configuration in `.claude/settings.json`
8. Log file writable
9. Disk space sufficient
10. `better-sqlite3` native binding loaded successfully
11. Recent errors in log file

### 4.4 Error Reporting (Future Consideration)

Deferred to post-MVP. When implemented:
- Opt-in only (explicit user consent)
- Anonymized (no session data, no file paths)
- Structured error reports: error type, stack trace (anonymized), platform, Node.js version, Norbert version
- Submission to a simple error collection endpoint (or GitHub Issues template auto-fill)

---

## 5. Key Log Events

### 5.1 Server Lifecycle

| Event Name | Level | When | Key Fields |
|-----------|-------|------|------------|
| `server_starting` | info | Server process begins | port, config_path |
| `server_started` | info | Server ready to accept connections | port, startup_duration_ms |
| `server_stopping` | info | Graceful shutdown initiated | reason |
| `server_stopped` | info | Server fully stopped | uptime_seconds |
| `server_error` | error | Unhandled server error | error, stack |

### 5.2 Event Ingress

| Event Name | Level | When | Key Fields |
|-----------|-------|------|------------|
| `event_received` | debug | HTTP POST received at /api/events | session_id, event_type |
| `event_persisted` | debug | Event written to SQLite | session_id, event_type, duration_ms |
| `event_rejected` | warn | Malformed event (400 response) | error, raw_size_bytes |
| `event_broadcast` | debug | WebSocket push sent | session_id, connected_clients |

### 5.3 Storage

| Event Name | Level | When | Key Fields |
|-----------|-------|------|------------|
| `database_opened` | info | SQLite connection established | path, schema_version |
| `migration_applied` | info | Schema migration executed | from_version, to_version, duration_ms |
| `database_error` | error | SQLite operation failed | operation, error |
| `retention_cleanup` | info | Old data purged | deleted_events, deleted_before_date |

### 5.4 CLI

| Event Name | Level | When | Key Fields |
|-----------|-------|------|------------|
| `command_invoked` | info | CLI command starts | command, args (sanitized) |
| `hooks_installed` | info | `norbert init` writes hooks | hook_count, settings_path |
| `config_loaded` | info | Configuration file read | config_path, port |

---

## 6. Dashboard Observability

The dashboard (Svelte SPA running in the user's browser) has limited observability needs:

### 6.1 Browser Console

- Development mode: Svelte dev warnings, API call logging
- Production mode: Errors only (no verbose console logging shipped)

### 6.2 API Error Display

When the dashboard cannot reach the Norbert server:

```
Connection lost to Norbert server (localhost:7890).
The server may have stopped. Run "norbert serve" to restart.
[Retry] [Dismiss]
```

Displayed as a non-blocking banner. Dashboard shows cached/stale data when possible.

### 6.3 WebSocket Reconnection

- Auto-reconnect with exponential backoff: 1s, 2s, 4s, 8s, max 30s
- Connection status indicator in dashboard footer: green dot (connected), yellow dot (reconnecting), red dot (disconnected)

---

## 7. Metrics (Lightweight, No External Dependencies)

Norbert does not export metrics to Prometheus, Grafana, or any external system. Metrics are computed on-demand from SQLite data and log files.

### 7.1 Internal Metrics (Queryable via CLI and API)

| Metric | Computation | Access |
|--------|-------------|--------|
| Events per day | `SELECT COUNT(*) FROM events WHERE date(timestamp) = date('now')` | `norbert status`, `/api/summary/today` |
| Sessions per day | `SELECT COUNT(*) FROM sessions WHERE date(start_time) = date('now')` | `norbert status`, `/api/summary/today` |
| Database size | File system stat on `norbert.db` | `norbert status`, `norbert doctor` |
| Server uptime | Process start time vs current time | `/health`, `norbert status` |
| Event processing latency | Logged `duration_ms` in `event_persisted` events | Log file analysis (debug level) |
| MCP error rate | `SELECT COUNT(*) FROM mcp_events WHERE status = 'error' / total` | `/api/mcp/health` |

### 7.2 No External Observability Stack

Norbert does not need Prometheus, Grafana, ELK, or Datadog. It is a local tool. Adding external observability would contradict the "local-first, no cloud dependency" architecture principle. The structured JSON logs and `norbert doctor` command provide sufficient observability for a tool that runs on localhost.

If future needs arise (e.g., opt-in telemetry for the Norbert project team), this would be implemented as:
- OpenTelemetry SDK exporting to a configurable endpoint
- Disabled by default, enabled via explicit opt-in (`norbert config set telemetry true`)
- Covered by a separate ADR

---

## 8. Bug Report Template

When users file issues, `norbert doctor` output provides structured diagnostics. A GitHub Issue template will collect:

```markdown
## Bug Report

### norbert doctor output
<!-- Paste output of `norbert doctor` here -->

### Recent log entries
<!-- Paste last 20 lines of ~/.norbert/logs/norbert.log here -->
<!-- Redact any file paths you prefer to keep private -->

### Steps to reproduce
1. ...
2. ...

### Expected behavior
...

### Actual behavior
...

### Environment
- OS: [e.g., macOS 14.3, Windows 11, Ubuntu 22.04]
- Node.js version: [output of `node --version`]
- Norbert version: [output of `norbert --version`]
```

---

## 9. Requirements Traceability

| Observability Requirement | Source | Implementation |
|--------------------------|--------|----------------|
| Structured JSON logs locally | Configuration input | Section 3 (Logging Architecture) |
| `norbert status` health check | Configuration input | Section 4.1 |
| Defer external monitoring | Configuration input | Section 7.2 (explicit exclusion) |
| Silent hook failure | architecture-design (section 9.1) | Hooks log to debug level only, never block |
| Cross-platform log paths | architecture-design (portability) | `~/.norbert/logs/` resolved via Node.js `os.homedir()` |
| Dashboard < 2s load time | architecture-design (quality attributes) | Section 2 (SLO) |
| Non-blocking hooks < 50ms | ADR-007 | Section 2 (SLO) |
