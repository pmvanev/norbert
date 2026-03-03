# Component Boundaries: Config Explorer

**Feature ID**: config-explorer
**Date**: 2026-03-03

---

## New Package: `@norbert/config-explorer`

### Responsibility

All Config Explorer domain types and pure transformation functions: file classification, content parsing, YAML frontmatter extraction, cross-reference extraction, precedence resolution, glob matching, search indexing, and naming conflict detection.

### Structure

```
packages/config-explorer/
  src/
    types.ts              -- Discriminated unions: ConfigNode, ConfigEdge, ConfigScope, etc.
    file-classifier.ts    -- Pure function: (filePath, scope) -> ConfigNode
    content-parser.ts     -- Pure functions: parse JSON, Markdown, YAML frontmatter
    cross-ref-extractor.ts -- Pure function: parsedFiles -> ConfigEdge[]
    precedence-resolver.ts -- Pure function: (parsedFiles, subsystem) -> PrecedenceChain
    glob-matcher.ts       -- Adapter: wraps picomatch for path pattern testing
    search-index.ts       -- Pure function: (parsedFiles, query) -> SearchResult[]
    conflict-detector.ts  -- Pure function: configNodes -> NamingConflict[]
    model-assembler.ts    -- Pure function: composes above into full ConfigModel
    index.ts              -- Public API barrel export
  package.json
  tsconfig.json
  vitest.config.ts
```

### Exports

- **Types**: `ConfigNode`, `ConfigEdge`, `ConfigModel`, `ConfigScope`, `ConfigSubsystem`, `PrecedenceChain`, `PrecedenceEntry`, `MatchResult`, `ParsedFile`, `SearchResult`, `NamingConflict`, `FileTree`, `PathTestResult`
- **Pure functions**: `classifyFile`, `parseContent`, `extractCrossReferences`, `resolvePrecedence`, `matchGlob`, `searchFiles`, `detectConflicts`, `assembleConfigModel`

### Imports

- `picomatch` (glob matching) -- sole runtime dependency
- `gray-matter` (YAML frontmatter parsing) -- sole parser dependency
- Nothing from `@norbert/*` packages

### Boundary Rule

Zero imports from any other `@norbert/*` package. Config Explorer types are a distinct domain from runtime event types. The package is independently buildable, testable, and publishable.

### Enforcement

- `package.json` has zero `@norbert/*` workspace dependencies
- TypeScript project references do not include other `@norbert/*` packages
- CI check verifies no `@norbert/*` imports in source files

---

## Extended Package: `@norbert/server`

### New Components

```
packages/server/src/
  api/
    config.ts             -- Fastify route registrations for /api/config/* endpoints
    config-file-reader.ts -- Filesystem adapter: reads ~/.claude/, .claude/, managed paths
```

### New Dependency

- `@norbert/config-explorer` added to `package.json` workspace dependencies

### Boundary Rule

- Config API routes follow the same pattern as existing routes (events, sessions, etc.)
- `config-file-reader.ts` is the ONLY component that touches the filesystem for config reading
- API route handlers call pure functions from `@norbert/config-explorer` with raw file data
- No config-explorer logic leaks into other API routes

---

## Extended Package: `@norbert/dashboard`

### New Components

```
packages/dashboard/src/
  routes/
    config/
      +page.svelte        -- Config Explorer landing/layout with tab navigation
      +page.ts            -- Data loader for config model
  components/
    config/
      ConfigAtlas.svelte   -- Dual-pane tree view with content preview
      ConfigMindMap.svelte -- D3.js tree layout (8 subsystem branches)
      ConfigGalaxy.svelte  -- D3.js force-directed graph
      ConfigCascade.svelte -- Precedence waterfall per subsystem
      ConfigPathTester.svelte -- File path input with match results
      ConfigSearch.svelte  -- Full-text search across config files
      ScopeBadge.svelte    -- Reusable scope color badge
      SubsystemIcon.svelte -- Reusable subsystem type icon
      NodeDetail.svelte    -- Shared detail panel for node inspection
  lib/
    stores/
      config-store.svelte.ts -- Svelte 5 runes store for config model state
    utils/
      config-api.ts        -- API client methods for /api/config/* endpoints
```

### New Dependencies

None. Dashboard has no runtime `@norbert/*` dependencies. Build-time type sharing from `@norbert/config-explorer` for API response typing is optional.

### Boundary Rule

- Dashboard communicates with server via REST API only (same as existing boundary)
- Config components are isolated in `components/config/` directory
- Config store is independent from existing app-store
- Shared components (TabBar, EmptyState, StatusBadge, ScopeBadge) are reused across Config Explorer views
- D3.js usage follows same patterns as existing TraceGraph and charts

---

## Dependency Inversion: Config File Reader

The config file reader is the dependency inversion boundary for Config Explorer:

```
Type: ConfigFileReaderPort = {
  readUserScope:    () => FileDiscoveryResult
  readProjectScope: () -> FileDiscoveryResult
  readLocalScope:   () -> FileDiscoveryResult
  readPluginScope:  () -> FileDiscoveryResult
  readManagedScope: () -> FileDiscoveryResult
}

Type: FileDiscoveryResult = {
  files: { path: string; content: string; scope: ConfigScope }[]
  errors: { path: string; error: string }[]
}
```

- **Consumer** (config API routes) accepts `ConfigFileReaderPort` as parameter
- **Provider** (filesystem adapter) implements the port using `fs.readdirSync` / `fs.readFileSync`
- **Composition root** (server app factory) wires provider to consumer

This enables:
- Testing API routes with synthetic file data (no filesystem needed)
- Cross-platform path resolution isolated in the adapter
- Future file watcher adapter (v2) swappable without changing API routes

---

## Updated Module Dependency Diagram

```
dashboard --[HTTP]--> server --> core <-- storage
                        |
                        +--> config-explorer (pure parsing)
                        |
                        +--> config <-- hooks
                        |
                  cli --+
```

The `config-explorer` package is a leaf node: nothing depends on it except `server`. It has no outbound dependencies to other `@norbert/*` packages.

---

## Architecture Enforcement

### TypeScript Project References

`@norbert/config-explorer` `tsconfig.json` has NO `references` to other packages.

`@norbert/server` `tsconfig.json` adds a reference to `@norbert/config-explorer`.

### Package.json Dependencies

```json
// packages/config-explorer/package.json
{
  "dependencies": {
    "picomatch": "^4.0.0",
    "gray-matter": "^4.0.0"
  }
  // NO @norbert/* dependencies
}
```

### CI Architecture Test Additions

Existing CI checks extended:
1. `@norbert/config-explorer` has zero `@norbert/*` dependencies in package.json
2. `@norbert/config-explorer` source files contain no `@norbert/*` imports
3. `@norbert/dashboard` still has no `@norbert/*` runtime dependencies
4. No circular dependency chains introduced
