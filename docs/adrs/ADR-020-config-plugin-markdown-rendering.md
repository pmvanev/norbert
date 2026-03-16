# ADR-020: Config Plugin Markdown Rendering

## Status: Accepted

## Context

The Docs tab (US-006) must render CLAUDE.md files with Markdown formatting including headings, lists, bold/italic, links, and fenced code blocks with syntax highlighting. A React Markdown rendering solution is needed.

## Decision

Use `react-markdown` (MIT, 13k+ GitHub stars) with `remark-gfm` (MIT) for GitHub Flavored Markdown support. These are the only new frontend dependencies for norbert-config.

Syntax highlighting for code blocks will use `react-syntax-highlighter` (MIT, 4k+ stars) or the lighter built-in code rendering initially, with syntax highlighting deferred if it adds significant bundle weight.

## Alternatives Considered

### Alternative 1: Raw innerHTML with marked.js
- Parse Markdown to HTML with `marked`, render via `dangerouslySetInnerHTML`
- Pros: smaller library; simpler API
- Cons: XSS risk from `dangerouslySetInnerHTML`; requires manual sanitization (DOMPurify); not idiomatic React; breaks React's virtual DOM reconciliation
- Rejected: security risk outweighs simplicity gain

### Alternative 2: Custom Markdown Renderer
- Build a minimal Markdown renderer targeting only headings, lists, code blocks
- Pros: zero dependencies; minimal bundle size
- Cons: significant effort for a read-only feature; edge cases in Markdown parsing are numerous; maintenance burden
- Rejected: effort disproportionate to value; well-maintained OSS exists

## Consequences

- Positive: battle-tested library with active maintenance; React-native component model; no XSS risk
- Positive: GFM support handles tables, task lists, strikethrough that may appear in CLAUDE.md files
- Negative: adds ~40KB gzipped to bundle; acceptable for a desktop app
- Negative: syntax highlighting adds more bundle weight if react-syntax-highlighter is included
