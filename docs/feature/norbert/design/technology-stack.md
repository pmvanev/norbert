# Technology Stack: Norbert Observatory

**Feature ID**: norbert
**Date**: 2026-03-02
**Decision method**: Quality-attribute-driven. Priority: time-to-market > maintainability > reliability > portability > performance.

---

## Stack Summary

| Layer | Technology | Version | License | Rationale |
|-------|-----------|---------|---------|-----------|
| Runtime | Node.js | 20 LTS | MIT | Cross-platform, largest ecosystem, Claude Code users already have it |
| Language | TypeScript | 5.x | Apache-2.0 | Type safety, discriminated unions for event types, full-stack single language |
| Package Manager | pnpm | 9.x | MIT | Workspace support for monorepo, faster than npm, disk-efficient |
| Build | tsup | 8.x | MIT | Zero-config TypeScript bundler, ESM output, fast |
| Server Framework | Fastify | 5.x | MIT | Fastest Node.js HTTP framework, schema validation built-in, plugin system |
| Database | SQLite via better-sqlite3 | 11.x | MIT | Zero-config, local-first, synchronous API (simpler for single-writer), prebuilt binaries |
| Database Migrations | Custom (lightweight) | -- | -- | Simple version table + SQL files. No ORM overhead for 5-10 tables. |
| WebSocket | ws | 8.x | MIT | Standard Node.js WebSocket library, minimal footprint |
| Dashboard Framework | Svelte 5 + SvelteKit | 5.x / 2.x | MIT | Smallest bundle, fastest runtime, minimal boilerplate, excellent DX for solo dev |
| Dashboard Build | Vite | 6.x | MIT | Fast HMR, native ESM, Svelte integration |
| DAG Visualization | D3.js | 7.x | ISC | Most flexible graph visualization, proven at scale, no framework lock-in |
| Charts | Chart.js | 4.x | MIT | Simple, lightweight, covers cost trends and bar charts |
| CLI Framework | Commander.js | 12.x | MIT | Standard Node.js CLI framework, minimal API, widespread |
| CLI Output | chalk + cli-table3 | 5.x / 0.6.x | MIT | Terminal formatting and table display |
| Testing | Vitest | 2.x | MIT | Native TypeScript, fastest test runner, compatible with Vite |
| Linting | ESLint + typescript-eslint | 9.x | MIT | Standard TypeScript linting |
| Formatting | Prettier | 3.x | MIT | Standard formatting |

---

## Detailed Rationale

### Runtime: Node.js 20 LTS over Bun

**Decision**: Node.js 20 LTS.

| Factor | Node.js | Bun |
|--------|---------|-----|
| Maturity | Production-proven, 14+ years | Newer, occasional edge-case issues |
| Ecosystem | Full npm compatibility guaranteed | 99%+ but occasional gaps |
| better-sqlite3 | Fully supported | Partial (native addon issues reported) |
| Claude Code users | Already have Node.js installed | May not have Bun |
| Performance | Sufficient for local tool | Faster startup, but not a bottleneck |

Bun is appealing for startup speed but Node.js is safer for cross-platform native addons (better-sqlite3). Claude Code requires Node.js, so Norbert adds zero install prerequisites.

See **ADR-003** for full decision record.

### Server: Fastify over Express/Hono/Koa

**Decision**: Fastify 5.

| Factor | Fastify | Express | Hono |
|--------|---------|---------|------|
| Performance | Fastest mainstream | Adequate | Very fast |
| Schema validation | Built-in (JSON Schema) | Manual | Manual |
| Plugin system | Encapsulated, testable | Middleware chain | Middleware |
| TypeScript | First-class | Bolted on | First-class |
| Ecosystem | Large, stable | Largest | Growing |

Fastify's built-in JSON Schema validation is critical for hook event ingress -- validate incoming events without additional dependencies. Plugin system maps well to module architecture.

See **ADR-004** for full decision record.

### Dashboard: Svelte 5 over React/Vue

**Decision**: Svelte 5 with SvelteKit.

| Factor | Svelte 5 | React | Vue |
|--------|----------|-------|-----|
| Bundle size | ~2 KB runtime | ~40 KB (React + ReactDOM) | ~30 KB |
| Boilerplate | Minimal | More (hooks, JSX) | Moderate |
| Learning curve | Gentle | Moderate | Moderate |
| Solo dev DX | Excellent (less code) | Good | Good |
| Reactivity | Compiler-based (runes) | Runtime (hooks) | Runtime (ref/reactive) |

Svelte produces the smallest bundles (critical for local tool -- instant load). Runes in Svelte 5 provide fine-grained reactivity with less code. Solo developer benefits from writing less boilerplate. SvelteKit provides routing, SSR capability, and build tooling.

See **ADR-005** for full decision record.

### Database: SQLite via better-sqlite3 over sql.js/Drizzle ORM

**Decision**: SQLite via better-sqlite3, no ORM.

| Factor | better-sqlite3 | sql.js | Drizzle ORM |
|--------|---------------|--------|-------------|
| Performance | Native C bindings, fastest | Pure JS, slower | Adds query builder overhead |
| API | Synchronous (simpler for single-writer) | Synchronous | Async (unnecessary complexity) |
| WAL mode | Full support | Limited | Depends on driver |
| Cross-platform | Prebuilt binaries (mac/linux/win) | Pure JS (works everywhere) | N/A (needs driver) |
| Complexity | Low (raw SQL + prepared statements) | Low | Medium (schema definitions, migrations) |

For 5-10 tables with well-known queries, raw SQL with prepared statements is simpler and faster than an ORM. better-sqlite3's synchronous API simplifies the single-writer pattern. Fallback plan: if native binding issues arise on a platform, sql.js (pure JS SQLite) can substitute.

### DAG Visualization: D3.js over Cytoscape/Mermaid/Dagre

**Decision**: D3.js for execution trace graph.

| Factor | D3.js | Cytoscape.js | Mermaid | Dagre |
|--------|-------|-------------|---------|-------|
| Flexibility | Maximum | High | Low | Medium |
| Interactive | Full (zoom, click, expand) | Full | None (static) | Layout only |
| Node expansion | Custom (click to expand tool calls) | Plugin-based | Not supported | Not supported |
| Bundle size | ~250 KB | ~400 KB | ~1 MB | ~50 KB |
| Learning curve | Steep but already needed for charts | Moderate | Easy | Easy |

D3.js provides the interactive node expansion needed for the execution trace graph (click agent node to see tool calls). Mermaid is static only. Cytoscape is viable but heavier. D3 is already partially needed for custom charts, so no additional dependency weight.

### CLI: Commander.js over yargs/oclif/clipanion

**Decision**: Commander.js.

| Factor | Commander.js | yargs | oclif |
|--------|-------------|-------|-------|
| Footprint | Minimal | Moderate | Heavy (framework) |
| TypeScript | Good | Good | Excellent |
| Complexity | Low | Low | High (plugin system) |
| Adoption | Most popular | Popular | Salesforce ecosystem |

Commander.js is the simplest choice for a CLI with 10-15 commands. oclif is overkill (framework for CLI apps with plugin systems). Yargs is comparable but Commander has slightly cleaner API for subcommands.

---

## Monorepo Structure

```
norbert/
  package.json          -- root workspace config
  pnpm-workspace.yaml   -- workspace definition
  tsconfig.base.json    -- shared TypeScript config
  packages/
    core/               -- Pure domain logic (zero deps)
    server/             -- Fastify server
    storage/            -- Storage port + SQLite adapter
    cli/                -- Commander.js CLI
    dashboard/          -- SvelteKit app
    hooks/              -- Hook script templates
    config/             -- Configuration management
```

**Why pnpm workspaces**: Enforces module boundaries at the package manager level. Cross-module imports must be declared as workspace dependencies. This makes architectural violations visible as missing dependencies.

---

## License Compliance

All selected technologies use permissive licenses (MIT, Apache-2.0, ISC). No GPL, AGPL, or proprietary dependencies. Norbert can be distributed under any license without restriction.
