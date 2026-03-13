# ADR-016: Token Pricing Model -- Configurable Lookup Table

## Status

Accepted

## Context

norbert-usage must compute dollar costs from token counts in hook event payloads. Anthropic's model pricing changes over time and varies by model (Opus, Sonnet, Haiku). The pricing mechanism must be accurate, updatable without code changes, and handle mixed-model sessions where different events use different models.

**Quality attribute drivers**: Accuracy (cost must match actual billing), maintainability (pricing changes without code deployment), correctness (per-model pricing in mixed sessions).

**Constraints**: Local-first app (no API calls to fetch pricing). Single developer. Functional paradigm (pricing as pure data + pure function).

## Decision

Configurable pricing lookup table as immutable data, with a pure pricing function.

**Structure**:
- Pricing table: ordered array of `{ modelPattern, inputRate, outputRate, cacheReadRate, cacheCreationRate }`
- Lookup: first entry whose `modelPattern` is a prefix of the event's model string wins
- Last entry is a fallback using the most expensive model's rates (conservative estimate)
- Default table ships with current Anthropic rates; user can override via plugin configuration
- Pricing function is pure: `(tokenUsage, pricingTable) -> CostResult`

**Why prefix matching**: Anthropic model IDs include date suffixes (e.g., `claude-opus-4-20250514`). Prefix matching on `claude-opus-4` covers all date variants without maintaining exact version strings.

## Alternatives Considered

### Alternative 1: Hardcoded pricing constants
- What: Embed current model rates as TypeScript constants
- Tradeoff: Simplest implementation. But requires code change and rebuild when Anthropic changes prices.
- Why rejected: Anthropic has changed pricing multiple times. Rebuild requirement for a data change violates maintainability.

### Alternative 2: Fetch pricing from Anthropic API at startup
- What: Call Anthropic's pricing endpoint on app launch to get current rates
- Tradeoff: Always up-to-date. But requires network access (violates local-first), adds startup latency, fails offline.
- Why rejected: Norbert is local-first. Network dependency for a core function is unacceptable. No Anthropic pricing API exists publicly.

### Alternative 3: Per-event cost from Claude Code payload
- What: If Claude Code includes a `cost` field in hook payloads, use it directly
- Tradeoff: Most accurate (source of truth). But Claude Code hook payloads do not currently include cost fields -- only token counts.
- Why rejected: Not available in current Claude Code hook format. If added in future, this becomes the preferred path and the pricing table becomes a fallback.

## Consequences

- Positive: Pure function with injected data. Fully testable. No side effects.
- Positive: Prefix matching handles model version changes automatically.
- Positive: Conservative fallback (most expensive model) means cost is never under-reported.
- Negative: User must update pricing table when Anthropic changes rates. Mitigated: default table is updated with each Norbert release. App could show a "pricing may be outdated" warning after N months.
- Negative: Cache token pricing adds complexity. Mitigated: cache rates default to zero if absent; users who care about cache cost accuracy can configure.
