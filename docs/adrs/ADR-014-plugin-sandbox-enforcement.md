# ADR-014: Plugin Sandbox Enforcement -- API-Layer Scoping

## Status

Accepted

## Context

Phase 3 plugins receive a NorbertAPI object with access to SQLite, hooks, UI registration, and configuration. Plugins must be prevented from: (1) writing to core Norbert tables, (2) modifying hook configuration, (3) accessing the OS keychain, (4) writing to filesystem outside their plugin directory. The enforcement mechanism must balance security with implementation cost for a solo developer.

**Quality attribute drivers**: Security (data integrity), maintainability (simple enforcement model), time-to-market (solo developer).

**Constraints**: Solo developer. Plugins run in the same Node.js process as the plugin host. No separate process per plugin.

## Decision

API-layer enforcement. The NorbertAPI Factory creates per-plugin API instances that enforce scoping rules at the API boundary. No OS-level or process-level sandboxing.

**Enforcement rules**:

| Rule | Enforcement Point |
|---|---|
| Plugin db writes scoped to `plugin_{id}_*` tables | api.db wrapper validates table name prefix |
| Core tables (sessions, events) are read-only for plugins | api.db wrapper rejects INSERT/UPDATE/DELETE on core tables |
| Plugin config scoped to `~/.norbert/plugins/{id}/` | api.config wrapper enforces directory prefix |
| Hooks read-only (plugins register handlers, cannot modify hook config) | api.hooks provides register() only, no modify/delete |
| api.plugins.get() only returns declared dependencies | API Factory checks manifest.dependencies before returning |
| No OS keychain access | api object does not expose keychain methods |

**Trust model**: Plugins are installed by the user (npm install). This is the same trust model as VS Code extensions -- the user chooses to install them. The sandbox prevents accidental data corruption, not malicious code execution.

## Alternatives Considered

### Process-Level Isolation (Separate Node.js Process per Plugin)

- What: Each plugin runs in its own Node.js child process. Communication via IPC.
- Expected impact: True OS-level isolation. Plugin crash does not affect core.
- Why insufficient: Massive overhead for a single-user desktop app. Each process adds 30-50MB memory, inter-process serialization latency, and complex lifecycle management. VS Code runs extensions in a single extension host process for exactly this reason -- the overhead of per-extension processes is not justified for a trust model where the user installs extensions.

### V8 Isolates (vm module)

- What: Run each plugin in a Node.js `vm.createContext()` sandbox.
- Expected impact: Memory isolation without process overhead.
- Why insufficient: Node.js vm module is explicitly documented as "not a security mechanism." It prevents accidental global pollution but does not prevent access to Node.js built-ins (require, process, fs). Real sandboxing via vm2 was deprecated due to security vulnerabilities. The effort to achieve meaningful isolation via V8 isolates exceeds the benefit for the trust model.

### WASM-Based Plugin Runtime

- What: Plugins compiled to WebAssembly, run in a WASM runtime with capability-based security.
- Expected impact: Strong sandboxing. Language-agnostic plugins.
- Why insufficient: Requires plugins to be compiled to WASM (eliminates npm ecosystem, React components, existing TypeScript code). Massive ecosystem mismatch. The product spec explicitly defines plugins as Node.js packages with React view components. WASM sandboxing solves a problem Norbert does not have at this scale.

## Consequences

**Positive**:
- Simple implementation (wrapper functions around existing APIs)
- No per-plugin process overhead
- Plugins can use full npm ecosystem including React components
- Enforcement rules are explicit, testable, and documented
- Same trust model as VS Code extensions (proven at scale)

**Negative**:
- A determined malicious plugin could bypass API-layer enforcement (e.g., require('fs') directly). This is accepted under the trust model.
- Plugin crash in shared process crashes the plugin host (mitigated: onLoad wrapped in try-catch; failed plugins are isolated from other plugins' load sequence)
- No memory or CPU limits per plugin (mitigated: single-user desktop app; user notices misbehaving plugins)
