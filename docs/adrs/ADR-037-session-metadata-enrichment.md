# ADR-037: Session Metadata Enrichment Storage

## Status
Proposed

## Context
OTLP payloads contain resource attributes (service.version, os.type, host.arch) and standard attributes (terminal.type) that identify the environment of a Claude Code session. These attributes are stable within a session -- the first observation is sufficient. We need to decide where and how to store this enrichment data.

## Decision
Dedicated `session_metadata` table with `session_id` as primary key. Populated via `INSERT OR IGNORE` on first OTLP payload per session (either log or metric). All enrichment columns are nullable for graceful degradation when attributes are missing.

## Alternatives Considered

### Alternative 1: Add Columns to Existing Sessions Table
- **What**: Add terminal_type, service_version, os_type, host_arch columns to the `sessions` table
- **Expected Impact**: 100% functionally equivalent
- **Why Rejected**: Sessions table is managed by SqliteEventStore with its own schema migration path. Adding columns requires modifying the existing Session domain type and all its consumers. The sessions table is also populated by the hook path which has no OTLP attributes. Separate table maintains separation of concerns between hook-originated sessions and OTel-originated metadata.

### Alternative 2: Store in Event Payload JSON
- **What**: Include resource attributes in the payload JSON of each event
- **Expected Impact**: 80% -- data available but denormalized
- **Why Rejected**: Resource attributes are identical across all events in a session. Storing them in every event payload wastes ~200 bytes per event x 500+ events = 100KB+ redundant data per session. Also requires scanning events to find the enrichment data rather than a direct lookup.

## Consequences
- **Positive**: Clean separation. Session enrichment is a lookup by session_id. No modification to existing Session type or EventStore.
- **Positive**: First-write-wins semantics via INSERT OR IGNORE -- no race conditions if both log and metric handlers try to enrich the same session.
- **Negative**: Additional table and IPC command. Acceptable for the clean separation benefit.
- **Negative**: Enrichment data only available for OTel sessions, not hook-only sessions. Acceptable because hook sessions don't have this data.
