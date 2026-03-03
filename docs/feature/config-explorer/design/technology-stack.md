# Technology Stack: Config Explorer

**Feature ID**: config-explorer
**Date**: 2026-03-03
**Decision method**: Quality-attribute-driven. Priority: usability > maintainability > testability > time-to-market > performance.

---

## Stack Summary

Config Explorer inherits Norbert's existing tech stack. Only two new dependencies are introduced.

| Layer | Technology | Version | License | New? | Rationale |
|-------|-----------|---------|---------|------|-----------|
| Runtime | Node.js | 20 LTS | MIT | No | Existing Norbert runtime |
| Language | TypeScript | 5.x | Apache-2.0 | No | Existing. Discriminated unions for config model types. |
| Package Manager | pnpm | 9.x | MIT | No | Existing workspace. New package added. |
| Server Framework | Fastify | 5.x | MIT | No | Existing. New `/api/config/*` routes registered. |
| Dashboard Framework | Svelte 5 + SvelteKit | 5.x / 2.x | MIT | No | Existing. New `/config` route added. |
| Graph Visualization | D3.js | 7.x | ISC | No | Existing in Norbert for trace graph. Used for Galaxy (force simulation) and Mind Map (tree layout). |
| Glob Matching | picomatch | 4.x | MIT | **Yes** | Glob pattern matching for path-scoped rule testing |
| YAML Frontmatter | gray-matter | 4.x | MIT | **Yes** | Parse YAML frontmatter from Markdown files (rules, skills, agents) |
| Build | tsup | 8.x | MIT | No | Existing. Builds new config-explorer package. |
| Testing | Vitest | 2.x | MIT | No | Existing. Tests for parser pure functions. |

---

## New Dependency Rationale

### Glob Matching: picomatch over minimatch/micromatch

**Decision**: picomatch 4.x

| Factor | picomatch | minimatch | micromatch |
|--------|-----------|-----------|------------|
| Bundle size | ~4 KB | ~10 KB | ~20 KB |
| Performance | Fastest (benchmark leader) | Slower | Fast (wraps picomatch) |
| Glob compatibility | Full glob syntax | Full | Full (superset) |
| Claude Code ecosystem | Used by micromatch which is used by fast-glob | npm/Node.js standard | Wraps picomatch |
| Zero dependencies | Yes | Yes | 3 dependencies |
| Maintenance | Active, regular releases | Active | Active |

picomatch is the glob matching engine used by micromatch, fast-glob, and other tools in the Node.js ecosystem. It provides the smallest bundle with the best performance. Claude Code's glob matching for `paths:` frontmatter uses standard glob syntax that picomatch supports fully.

See **ADR-010** for full decision record.

### YAML Frontmatter Parsing: gray-matter over js-yaml/custom regex

**Decision**: gray-matter 4.x

| Factor | gray-matter | js-yaml + custom regex | Hand-written parser |
|--------|-------------|----------------------|-------------------|
| YAML frontmatter extraction | Built-in (Markdown with `---` delimiters) | Manual: regex split + js-yaml parse | Full manual implementation |
| Reliability | Battle-tested (51M+ weekly downloads) | Composition of two tools | Error-prone for edge cases |
| Excerpt extraction | Built-in | Manual | Manual |
| Data + content separation | Returns `{ data, content }` | Manual | Manual |
| Dependencies | 1 (js-yaml internally) | 1 (js-yaml) | 0 |

gray-matter is the standard library for parsing YAML frontmatter from Markdown files. It handles edge cases (missing frontmatter, invalid YAML, empty files) that a custom regex would miss. Skills, agents, and rules all use YAML frontmatter, making this a critical parser component.

See **ADR-011** for full decision record.

---

## Existing Stack Reuse Analysis

| Existing Component | Config Explorer Usage | Modification Needed |
|-------------------|-----------------------|--------------------|
| Fastify server (`packages/server/src/app.ts`) | Register new config routes | Add `registerConfigRoutes()` call |
| SvelteKit routing (`packages/dashboard/src/routes/`) | Add `/config` route with sub-views | New route directory |
| D3.js (already in dashboard) | Force simulation (Galaxy), tree layout (Mind Map) | None -- different D3 modules, same library |
| Svelte stores (`packages/dashboard/src/lib/stores/`) | Config model store for cross-view state | New store file |
| API client (`packages/dashboard/src/lib/api-client.ts`) | Add config endpoint methods | Extend existing client |
| Shared components (TabBar, EmptyState, StatusBadge) | Reuse in Config Explorer views | None |
| CSS custom properties (scope colors) | Add scope color variables | Extend existing theme |
| pnpm workspace | Add `@norbert/config-explorer` package | Add to `pnpm-workspace.yaml` |
| tsup build | Build new package | New `tsconfig.json` for config-explorer |
| Vitest | Test parser pure functions | Test files in new package |

---

## Monorepo Structure Update

```
norbert/
  packages/
    core/               -- Pure domain logic (hook events) -- UNCHANGED
    config/             -- Configuration loading -- UNCHANGED
    config-explorer/    -- NEW: Config Explorer domain types and pure parsers
    storage/            -- Storage port + SQLite adapter -- UNCHANGED
    server/             -- Fastify server -- EXTENDED with /api/config/* routes
    cli/                -- Commander.js CLI -- UNCHANGED
    dashboard/          -- SvelteKit app -- EXTENDED with /config route
    hooks/              -- Hook script templates -- UNCHANGED
```

---

## License Compliance

All dependencies (existing and new) use permissive licenses:
- picomatch: MIT
- gray-matter: MIT

No GPL, AGPL, or proprietary dependencies introduced.
