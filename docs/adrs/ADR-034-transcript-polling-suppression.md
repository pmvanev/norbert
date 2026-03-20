# ADR-034: Transcript Polling Suppression for OTel-Active Sessions

## Status

Accepted

## Context

When both OTel and transcript polling are active for the same session, token data is counted twice -- once from OTel `api_request` events and once from transcript JSONL parsing. This inflates apparent token usage and cost.

Suppression must be per-session (not global) because some sessions may use OTel while others do not (mixed environment).

## Decision

Derive OTel-active status from event data: if a session has received any `api_request` events, it is OTel-active and transcript polling is skipped for that session.

Detection is computed at polling time, not stored as a persistent flag. The transcript polling effect in `App.tsx` checks the session's events (already available via the IPC-polled event list) for the presence of `api_request` event types.

## Alternatives Considered

### A: Global toggle (disable all transcript polling when any OTel event received)
- Simple boolean flag
- **Rejected**: Breaks mixed sessions. If user has two Claude Code sessions and only one has OTel enabled, the other loses transcript data.

### B: Persistent otelActive flag in SQLite sessions table
- Add boolean column to sessions table, set on first ApiRequest event
- **Rejected**: Requires database migration. Adds write overhead. The information is already derivable from event data (count of api_request events > 0). Derived state is simpler and avoids schema coupling.

### C: Derived detection from event data (selected)
- Count `api_request` events for the session. Count > 0 = OTel-active.
- Computed at each polling interval, no persistent state needed.

## Consequences

- **Positive**: No database schema change. No migration. No new IPC command.
- **Positive**: Per-session granularity supports mixed OTel/transcript environments.
- **Positive**: One-way transition: once a session receives OTel data, it stays OTel-active. No complex fallback logic.
- **Negative**: If OTel stops mid-session (Claude Code crash), the session retains OTel-active status and does not fall back to transcript polling. Accepted: this is the documented behavior (see journey step 6). Partial sessions with a gap are preferable to duplicate data.
