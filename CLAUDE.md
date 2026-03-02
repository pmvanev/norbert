# Norbert -- The Agentic Workflow Observatory for Claude Code

## Project Overview

Local-first observability tool for Claude Code. Captures agentic workflow data via Claude Code hooks, stores in SQLite, presents through web dashboard and CLI.

## Development Paradigm

**Functional-leaning TypeScript** with pure core / effect shell.

- Types-first: discriminated unions for domain models before implementation
- Pure core: event processing, cost calculation, trace building are pure functions
- Effect shell: HTTP server, SQLite, filesystem at adapter boundaries only
- Function-signature ports: storage port defined as record of function types
- Result types for domain errors (not thrown exceptions)
- No class inheritance; composition over inheritance
- Immutable domain: all types readonly, processing produces new values

## Architecture

Modular monolith with dependency inversion (ports-and-adapters). Seven packages in pnpm workspace:

| Package | Role | Dependencies |
|---------|------|-------------|
| `@norbert/core` | Pure domain types and functions | None (zero deps) |
| `@norbert/config` | Configuration loading | None |
| `@norbert/storage` | Storage port + SQLite adapter | core |
| `@norbert/server` | Fastify HTTP server, API, WebSocket | core, storage, config |
| `@norbert/cli` | Commander.js CLI | core, storage, config |
| `@norbert/dashboard` | Svelte 5 SPA | None (HTTP-only boundary) |
| `@norbert/hooks` | Hook script templates | config |

**Dependency rule**: All dependencies point inward toward core. Core imports nothing.

## Tech Stack

- Runtime: Node.js 20 LTS
- Language: TypeScript 5.x
- Package manager: pnpm (workspaces)
- Server: Fastify 5
- Database: SQLite via better-sqlite3 (WAL mode)
- Dashboard: Svelte 5 + SvelteKit + D3.js + Chart.js
- CLI: Commander.js
- Testing: Vitest
- Build: tsup (server/cli), Vite (dashboard)

## Key Constraints

- Local-first: everything runs on localhost, no cloud dependency
- Non-blocking: hooks are async fire-and-forget, never slow Claude Code
- Cross-platform: macOS, Linux, Windows
- SQLite single-writer: server is sole writer, CLI reads only

## Architecture Documents

- `docs/feature/norbert/design/architecture-design.md` -- Full architecture with C4 diagrams
- `docs/feature/norbert/design/technology-stack.md` -- Tech stack rationale
- `docs/feature/norbert/design/component-boundaries.md` -- Module boundaries
- `docs/feature/norbert/design/data-models.md` -- SQLite schema, domain types, API contracts
- `docs/adrs/ADR-001-*.md` through `ADR-007-*.md` -- Architecture Decision Records
- `docs/feature/norbert/design/roadmap.json` -- Implementation roadmap
