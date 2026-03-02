# ADR-003: Node.js 20 LTS Runtime

## Status
Accepted

## Context
Norbert needs a JavaScript/TypeScript runtime for the server, CLI, and hook scripts. Two viable options: Node.js (mature) and Bun (fast). Norbert must work on macOS, Linux, and Windows. Norbert uses better-sqlite3 (native C bindings) for database access.

## Decision
Node.js 20 LTS.

## Alternatives Considered

### Alternative 1: Bun
- Faster startup (~50ms vs ~200ms). Built-in TypeScript execution. Built-in test runner and bundler.
- Native addon support (better-sqlite3) is less mature. Occasional platform-specific issues reported.
- Claude Code users may not have Bun installed; they always have Node.js.
- Rejection: Native addon risk with better-sqlite3 on Windows. Adding Bun as an install prerequisite when Node.js is already available is unnecessary friction.

### Alternative 2: Deno
- Security-first. Native TypeScript. Standards-aligned.
- Smaller npm compatibility surface. Native addon support differs from Node.js.
- Claude Code ecosystem is Node.js-centric.
- Rejection: Ecosystem friction. npm package compatibility gaps would slow development.

## Consequences
- Positive: Zero additional runtime prerequisites for Claude Code users
- Positive: Mature native addon support (better-sqlite3 prebuilt binaries for all platforms)
- Positive: Largest ecosystem, most debugging resources
- Negative: Slower startup than Bun (~200ms vs ~50ms) -- acceptable for a local tool
- Negative: Requires tsup or similar for TypeScript compilation (Bun runs .ts natively)
