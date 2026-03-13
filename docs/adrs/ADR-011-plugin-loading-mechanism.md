# ADR-011: Plugin Loading Mechanism -- Bundled First-Party with npm Global Scan

## Status

Accepted

## Context

Phase 3 introduces Norbert's plugin architecture. Plugins are Node.js packages exporting the NorbertPlugin interface. The loading mechanism must support: (1) first-party plugins bundled with Norbert, (2) third-party plugins installed by users, (3) dependency resolution with semver range checking.

**Quality attribute drivers**: Maintainability (clean plugin boundary), time-to-market (solo developer), reliability (no silent failures).

**Constraints**: Solo developer. Node.js runtime already required for React tooling. Plugin packages are npm modules.

## Decision

Hybrid loading: first-party plugins bundled inside Norbert's install directory and loaded first; third-party plugins discovered via npm global scan (`npm ls -g --json`). Both use the same NorbertPlugin interface.

**Loading sequence**:
1. Scan bundled plugin directory (`~/.norbert/plugins/bundled/`)
2. Scan npm global packages for those exporting NorbertPlugin
3. Merge into unified manifest set
4. Resolve dependency graph (topological sort)
5. Load in dependency order, calling onLoad(api) for each
6. Report load results (loaded, degraded, failed)

**First-party plugin in Phase 3**: `norbert-session` only. Bundled with Norbert install.

## Alternatives Considered

### npm Global Scan Only (no bundled distinction)

- What: All plugins including first-party installed as global npm packages.
- Expected impact: Simpler loader (one scan path). User could accidentally uninstall core plugins.
- Why insufficient: First-party plugins must be present and not accidentally removable. Bundling ensures norbert-session is always available without requiring users to run npm install.

### Dynamic Import from Filesystem Paths

- What: Plugins as directories in `~/.norbert/plugins/` loaded via dynamic import.
- Expected impact: No npm dependency. Simpler install story.
- Why insufficient: Loses npm's dependency management, version resolution, and update mechanism. Manual dependency tracking is error-prone. The product spec explicitly specifies npm packages as the distribution format.

### Tauri Sidecar Plugin Processes

- What: Each plugin runs as a separate sidecar process communicating via IPC.
- Expected impact: True process-level isolation and sandboxing.
- Why insufficient: Massive overhead for a single-user desktop app. Each plugin process adds memory, startup time, and IPC complexity. API-layer sandboxing is sufficient for the threat model (plugins are installed by the user, not downloaded from untrusted sources at runtime).

## Consequences

**Positive**:
- First-party plugins guaranteed present; user cannot accidentally remove them
- Third-party plugins use familiar npm ecosystem (install, update, version)
- Single NorbertPlugin interface for all plugins regardless of loading path
- Dependency resolution uses established semver conventions

**Negative**:
- Two scan paths (bundled + global) adds minor loader complexity
- npm global scan may be slow on systems with many global packages (mitigated: scan at startup only, cache results)
- Node.js runtime must be available (already present for React build tooling)
