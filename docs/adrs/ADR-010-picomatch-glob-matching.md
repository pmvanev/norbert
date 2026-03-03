# ADR-010: picomatch for Glob Pattern Matching

## Status
Proposed

## Context
Config Explorer's Path Rule Tester feature requires glob pattern matching to test file paths against rule `paths:` frontmatter (e.g., `src/api/**/*.ts`). The matching behavior must be compatible with Claude Code's own glob matching to avoid false positives/negatives. Claude Code uses standard glob syntax documented in official sources. Config Explorer needs a client-side glob matching library that runs in Node.js.

## Decision
Use picomatch 4.x for glob pattern matching.

picomatch is a zero-dependency, high-performance glob matching library. It is the underlying engine used by micromatch, fast-glob, and other popular Node.js glob tools. It supports all standard glob patterns: `**`, `*`, `?`, `{a,b}`, `!negation`, extglob, and POSIX classes.

## Alternatives Considered

### Alternative 1: minimatch (npm standard)
- Pro: npm's default glob matching. Well-tested, actively maintained.
- Con: 2.5x larger bundle size (~10 KB vs ~4 KB). Slower benchmark performance.
- Con: Different API surface -- returns boolean but lacks the compiled matcher pattern that picomatch provides.
- Rejection: picomatch is smaller, faster, and provides the same glob syntax support.

### Alternative 2: micromatch
- Pro: Superset of picomatch with additional features (brace expansion, negation arrays).
- Con: 5x larger (~20 KB). Brings 3 additional dependencies including picomatch itself.
- Con: Additional features (negation arrays, brace expansion) are not needed for rule `paths:` patterns.
- Rejection: Unnecessary weight. picomatch provides all needed functionality.

### Alternative 3: Custom regex-based matching
- Pro: Zero dependencies. Full control over matching behavior.
- Con: Glob-to-regex conversion is notoriously error-prone (edge cases with `**`, trailing slashes, dotfiles, symlinks).
- Con: Maintenance burden: every glob syntax edge case must be handled manually.
- Con: No confidence that custom implementation matches Claude Code's behavior.
- Rejection: Building reliable glob matching from scratch is unjustifiable when proven libraries exist.

## Consequences
- Positive: Smallest glob matching library available (~4 KB)
- Positive: Fastest benchmark performance among glob matchers
- Positive: Same engine used by fast-glob and micromatch (broad ecosystem alignment)
- Positive: MIT licensed, zero dependencies, actively maintained
- Negative: May not be identical to Claude Code's internal glob implementation (documented differences should be noted)
- Negative: New dependency in the monorepo (minimal -- zero transitive deps)
