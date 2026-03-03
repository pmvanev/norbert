# ADR-009: Config Explorer as Separate Package

## Status
Proposed

## Context
Config Explorer adds configuration file parsing, cross-reference extraction, precedence resolution, and glob matching to Norbert. These functions operate on a distinct domain (static filesystem files, configuration precedence) from Norbert's existing core domain (runtime hook events, sessions, traces, costs). The question is where to place the Config Explorer domain types and pure functions within the existing 7-package monorepo.

Quality attribute priorities for Config Explorer: usability > maintainability > testability > time-to-market.

## Decision
Create a new `@norbert/config-explorer` package containing all Config Explorer domain types and pure functions. This package has zero dependencies on other `@norbert/*` packages. Only `@norbert/server` imports from it.

Package responsibilities:
- Config domain types (discriminated unions for nodes, edges, scopes, subsystems)
- File classifier (path -> subsystem + scope)
- Content parser (JSON, Markdown, YAML frontmatter)
- Cross-reference extractor (frontmatter fields -> relationship edges)
- Precedence resolver (files per scope -> resolution chain)
- Glob matcher (picomatch wrapper for path rule testing)
- Search index builder and naming conflict detector

## Alternatives Considered

### Alternative 1: Add types and functions to `@norbert/core`
- Pro: Single location for all domain types. No new package overhead.
- Con: `@norbert/core` is specifically for runtime event domain (HookEvent, Session, TraceGraph). Config Explorer operates on a completely different domain (static files, configuration precedence). Adding config types to core violates SRP -- core would have two reasons to change (hook event schema changes AND config ecosystem changes).
- Con: `@norbert/core` has zero dependencies. Config Explorer needs picomatch and gray-matter. Adding these to core breaks its zero-dependency guarantee.
- Rejection: SRP violation and dependency pollution of the core package.

### Alternative 2: Two new packages (`@norbert/config-explorer-types` and `@norbert/config-explorer`)
- Pro: Types package with zero deps, parser package with picomatch/gray-matter.
- Con: Types and parser functions are tightly coupled -- they change together when a new subsystem is added. Splitting them creates two packages with the same reason to change.
- Con: Adds unnecessary configuration overhead (2 package.json files, 2 tsconfig.json files) for zero benefit.
- Rejection: Over-decomposition. The types and functions form a cohesive unit.

### Alternative 3: No new package -- add everything to `@norbert/server`
- Pro: No new package overhead. Server already has filesystem access.
- Con: Mixes pure parsing logic with Fastify route handlers. Parser functions cannot be tested without importing server infrastructure.
- Con: Violates ports-and-adapters: domain logic (parsing) would live in the adapter layer (server).
- Rejection: Testability priority requires pure functions isolated from infrastructure.

## Consequences
- Positive: Config Explorer domain is independently testable with zero infrastructure
- Positive: `@norbert/core` remains focused on runtime events with zero dependencies
- Positive: Adding new config subsystems requires changes in one package only
- Positive: Package boundary prevents accidental coupling between config parsing and runtime event processing
- Negative: 8th package in monorepo adds one more package.json and tsconfig.json
- Negative: Server must declare dependency on config-explorer (one more pnpm workspace dep)
