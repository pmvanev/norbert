# ADR-019: Config Plugin Frontend Parsing

## Status: Accepted

## Context

Configuration files in `.claude/` include agent Markdown files (with optional YAML frontmatter), JSON settings, and skill Markdown files. This data must be parsed into structured domain types for display. The question is where parsing occurs: Rust backend or TypeScript frontend.

## Decision

The Rust backend reads raw file contents and returns them as strings. All parsing (Markdown structure extraction, JSON parsing, frontmatter extraction) happens in the TypeScript domain layer as pure functions.

## Alternatives Considered

### Alternative 1: Full Parsing in Rust Backend
- Rust parses agent Markdown, extracts YAML frontmatter, parses settings.json into typed structs
- Pros: single source of truth for parsing; Rust's serde provides strong JSON parsing
- Cons: parsing is presentation-specific (e.g., "extract first paragraph as description"); requires Rust Markdown/YAML parsing crates (new dependencies); harder to iterate on parsing logic; Rust compile cycle slower than TypeScript hot reload
- Rejected: parsing requirements are UI-driven and will evolve with view design; adding Rust Markdown/YAML crates for a read-only viewer is over-engineering

### Alternative 2: Hybrid (JSON in Rust, Markdown in TypeScript)
- Rust parses settings.json into typed structs; TypeScript handles Markdown
- Pros: leverages Rust's serde for JSON; avoids sending raw JSON over IPC
- Cons: splits parsing logic across two languages; harder to test holistically; adds complexity without proportional benefit
- Rejected: inconsistent boundary; all parsing in one layer is simpler

## Consequences

- Positive: All parsing logic in TypeScript is testable with simple string inputs (no filesystem, no Tauri)
- Positive: No new Rust dependencies (no Markdown/YAML crates)
- Positive: Faster iteration on parsing logic during development
- Negative: Raw file contents travel over IPC (slightly larger payload); acceptable for local IPC with small files
- Negative: JSON parse errors discovered in TypeScript rather than Rust; mitigated by discriminated union error types
