# Component Boundaries: Norbert Observatory

**Feature ID**: norbert
**Date**: 2026-03-02

---

## Module Boundary Definitions

### `@norbert/core` -- Pure Domain

**Responsibility**: All domain types, event processing, cost calculation, trace building, MCP analysis. Zero side effects. Zero dependencies.

**Exports**:
- Domain types: HookEvent, Session, AgentNode, McpServerHealth, CostBreakdown, TraceGraph, etc.
- Event type discriminated unions (all 7 hook event types)
- Pure transformation functions: raw event -> domain event
- Cost calculation functions: tokens + model -> estimated cost
- Trace building functions: event list -> agent DAG
- MCP analysis functions: event list -> server health, error timeline, token overhead

**Imports**: Nothing. This is the innermost module.

**Boundary rule**: No imports from any other `@norbert/*` package. No imports from Node.js built-ins. No imports from npm packages. Pure TypeScript only.

**Enforcement**: TypeScript project references + CI check that `core/package.json` has zero `dependencies`.

---

### `@norbert/config` -- Configuration

**Responsibility**: Load, validate, and provide configuration from `~/.norbert/config.json`. Provide defaults. Resolve paths cross-platform.

**Exports**:
- Configuration type definition
- Config loading function (reads file, merges defaults, validates)
- Default values

**Imports**: Nothing from other `@norbert/*` packages.

**Boundary rule**: Independent module. Other modules depend on config, not the reverse.

---

### `@norbert/storage` -- Storage Port + SQLite Adapter

**Responsibility**: Define the storage port (function-signature interface for persistence) and provide the SQLite implementation.

**Structure**:
- `port.ts`: Function-signature types for all storage operations (write events, read sessions, query traces, etc.)
- `sqlite-adapter.ts`: SQLite implementation using better-sqlite3
- `migrations/`: SQL migration files, versioned

**Exports**:
- Storage port type definitions (function signatures)
- SQLite adapter factory function
- Migration runner

**Imports**: `@norbert/core` (domain types only)

**Boundary rule**: Port definitions use only core types. Adapter imports better-sqlite3. No consumer should import the adapter directly -- they import the port type and receive the adapter via dependency injection (function parameter).

---

### `@norbert/server` -- HTTP Server

**Responsibility**: HTTP event ingress (receives hook events), REST API (serves dashboard data), WebSocket management (pushes real-time updates), static asset serving (dashboard SPA).

**Structure**:
- `ingress/`: POST /api/events handler -- validates, normalizes, persists
- `api/`: GET endpoints for sessions, traces, costs, MCP health
- `ws/`: WebSocket connection manager, event broadcasting
- `app.ts`: Fastify app composition, plugin registration

**Exports**:
- Server factory function (accepts storage port + config)
- Server start/stop functions

**Imports**: `@norbert/core`, `@norbert/storage` (port type only), `@norbert/config`

**Boundary rule**: Server depends on storage port type, never on SQLite adapter directly. Adapter is injected at composition root (entry point).

---

### `@norbert/cli` -- Command-Line Interface

**Responsibility**: Terminal commands for server management (`init`, `serve`, `status`) and quick data queries (`cost`, `trace`, `mcp`, `session`).

**Structure**:
- `commands/`: One file per command group (init, serve, status, cost, trace, mcp, session)
- `formatters/`: Terminal output formatting (tables, colors, JSON mode)
- `index.ts`: Commander.js program definition

**Exports**:
- CLI entry point (main function)

**Imports**: `@norbert/core`, `@norbert/storage` (port type), `@norbert/config`

**Boundary rule**: CLI reads from storage port directly (no server dependency for reads). CLI can start/stop the server process for `norbert serve` and `norbert init`.

---

### `@norbert/dashboard` -- Web Dashboard

**Responsibility**: SvelteKit single-page application. Visualization components for sessions, traces, costs, MCP health.

**Structure**:
- `routes/`: SvelteKit pages (overview, session detail, MCP panel, history)
- `components/`: Reusable Svelte components (summary cards, DAG graph, cost waterfall, MCP health table, charts)
- `lib/`: API client, WebSocket client, shared utilities
- `stores/`: Svelte stores for reactive state

**Exports**: Built SPA assets (HTML, JS, CSS) served by Norbert Server.

**Imports**: No `@norbert/*` packages at runtime. Dashboard communicates with server via HTTP REST API and WebSocket only. At build time, may share type definitions from `@norbert/core` for API response typing.

**Boundary rule**: Dashboard is a completely independent deployable. It has no runtime dependency on any other Norbert package. Communication is exclusively via HTTP/WebSocket. This ensures the dashboard can be rebuilt, swapped, or tested independently.

---

### `@norbert/hooks` -- Hook Script Templates

**Responsibility**: Generate and manage Claude Code hook scripts installed into `.claude/settings.json`.

**Structure**:
- `templates/`: Hook script templates for each event type
- `installer.ts`: Reads existing settings.json, appends hook entries, writes atomically

**Exports**:
- Hook installer function (additive, non-destructive)
- Hook uninstaller function (removes only Norbert hooks)
- Hook script content generators

**Imports**: `@norbert/config` (for server URL and port)

**Boundary rule**: Hook scripts themselves run outside Node.js context (they are shell/node one-liners that POST to the server). The templates module generates the script content. Hook scripts have no dependency on Norbert packages at runtime.

---

## Dependency Inversion: Storage Port

The storage port is the primary dependency inversion boundary. It is defined as function-signature types in `@norbert/storage/port.ts`:

```
Type: StoragePort = {
  writeEvent: (event: DomainEvent) => WriteResult
  getSession: (id: SessionId) => Session | null
  getSessions: (filter: SessionFilter) => Session[]
  getEventsForSession: (id: SessionId) => DomainEvent[]
  getMcpHealth: (filter: TimeFilter) => McpServerHealth[]
  getTokenUsage: (sessionId: SessionId) => TokenUsageBreakdown
  ...
}
```

**Consumers** (server, cli) accept `StoragePort` as a function parameter.
**Providers** (sqlite-adapter) return `StoragePort` from a factory function.
**Composition root** (entry point in cli or server) wires provider to consumers.

This enables:
- Testing with in-memory storage (no SQLite needed in tests)
- Future database swaps (e.g., DuckDB for analytics)
- CLI and server sharing the same port without coupling to SQLite

---

## Module Dependency Matrix

```
                core  config  storage  server  cli  dashboard  hooks
core             -      -       -        -      -       -        -
config           -      -       -        -      -       -        -
storage          R      -       -        -      -       -        -
server           R      R       R        -      -       -        -
cli              R      R       R        -      -       -        -
dashboard        -      -       -        -      -       -        -
hooks            -      R       -        -      -       -        -

R = runtime dependency (import)
```

**Key observations**:
- `core` and `config` have zero inbound arrows from each other (independent)
- `dashboard` has zero runtime dependencies on other packages (HTTP-only boundary)
- No circular dependencies exist
- Maximum dependency depth: 2 (server -> storage -> core)

---

## Architecture Enforcement

### TypeScript Project References

Each package has its own `tsconfig.json` with `references` pointing only to allowed dependencies. TypeScript compiler enforces the boundary -- importing an undeclared reference is a compile error.

### Package.json Dependencies

pnpm workspace dependencies explicitly declare allowed imports. An unlisted `@norbert/*` dependency causes import failure.

### CI Architecture Test

A CI step verifies:
1. `@norbert/core` has zero `dependencies` in package.json
2. `@norbert/dashboard` has no `@norbert/*` runtime dependencies
3. No circular dependency chains exist across packages
4. Import paths in each package only reference declared dependencies
