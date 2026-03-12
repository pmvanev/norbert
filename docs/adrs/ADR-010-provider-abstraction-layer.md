# ADR-010: Provider Abstraction Layer for Event Ingestion

## Status

Accepted

## Context

Norbert's walking skeleton receives Claude Code hook events directly: the HTTP endpoint parses Claude Code-specific event type names (PreToolUse, PostToolUse, etc.), extracts session_id from the raw payload, and stores HookEvent structs that carry Claude Code's EventType enum and raw JSON payload. Every layer -- domain types, ports, adapters, IPC commands, frontend -- operates on Claude Code-specific types.

The product spec requires multi-tool extensibility: future providers (Gemini CLI, Codex, OpenCode) must plug in without touching core code, storage, or UI. The architectural rule is explicit: "No code above the provider adapter layer may import or reference Claude Code-specific types, event names, or payload structures."

Phase 2 is the right time to introduce this boundary because it is the first feature that displays event data to users. If events are stored and displayed in Claude Code-specific format now, migrating to canonical format later requires a data migration and widespread refactoring.

**Quality attribute drivers**: Maintainability (add providers without core changes), time-to-market (minimal overhead for Phase 2), testability (providers testable in isolation).

**Constraints**: Solo developer. Only Claude Code provider needed now. Must not over-engineer.

## Decision

Introduce a provider abstraction layer at the adapter boundary. The provider is responsible for receiving tool-specific events and normalizing them into canonical Norbert events before storage.

**Canonical event model**: A tool-agnostic event type enum and event struct replace the current Claude Code-specific types at the domain level. The canonical types are what gets stored in SQLite and what the frontend queries.

**Provider port**: A trait defining the normalization contract -- accepting raw payloads and producing canonical events.

**Claude Code adapter**: The first (and currently only) provider implementation. Maps Claude Code event names and payload shapes to canonical equivalents.

**Canonical event type mapping** (from product spec):

| Claude Code Event | Canonical Event |
|---|---|
| PreToolUse | tool_call_start |
| PostToolUse | tool_call_end |
| SubagentStop | agent_complete |
| Stop | session_end |
| SessionStart | session_start |
| UserPromptSubmit | prompt_submit |

**Hook receiver change**: The HTTP handler calls the Claude Code provider to normalize before writing to the EventStore. The EventStore stores canonical events only.

**Scope control**: Phase 2 implements exactly one provider. No provider registry, no dynamic loading, no plugin discovery. The Claude Code provider is instantiated directly in the composition root. The abstraction exists as a trait boundary, not as runtime plugin infrastructure.

## Alternatives Considered

### Keep Claude Code types throughout, refactor later

- What: Continue storing Claude Code-specific EventType and HookEvent. Migrate to canonical when a second provider arrives.
- Expected impact: Saves ~1 day in Phase 2.
- Why insufficient: The product spec explicitly requires provider abstraction in Phase 2 exit criteria. Deferring creates a harder migration: stored data in Claude Code format, frontend assumptions about event type names, scattered Claude Code references. The cost grows with every feature built on Claude Code-specific types.

### Full provider plugin architecture with dynamic registration

- What: Build the Phase 3 plugin system now to support provider registration.
- Expected impact: Fully extensible from day one.
- Why insufficient: Massive over-engineering for a solo developer with one provider. Phase 3 plugin architecture is months away. A trait boundary achieves the same decoupling without runtime plugin infrastructure. When Phase 3 arrives, the trait becomes the plugin interface -- no wasted work.

### Middleware/interceptor pattern in the HTTP layer

- What: Add axum middleware that normalizes before the handler sees the event.
- Expected impact: Normalization without changing the handler.
- Why insufficient: Couples normalization to HTTP transport. A future provider using file watching or CLI output parsing would bypass the middleware entirely. The provider abstraction must be transport-independent.

## Consequences

**Positive**:
- Canonical types enforce the "no Claude Code above adapter" rule at compile time
- Adding a future provider requires only a new adapter implementing the trait -- no core/storage/UI changes
- Events stored in canonical format from day one -- no future data migration
- Frontend displays tool-agnostic event types, ready for multi-provider scenarios

**Negative**:
- Additional mapping layer between HTTP receipt and storage (minor complexity)
- Two event type enums coexist: Claude Code-specific (in provider adapter only) and canonical (everywhere else)
- Walking skeleton's existing EventType enum and HookEvent struct must be refactored to canonical equivalents
