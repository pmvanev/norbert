# ADR-033: OTel-Reported Cost Bypass

## Status

Accepted (updated 2026-03-23: clarified that `cost_usd` is "estimated" per Anthropic docs, not authoritative billing data)

## Context

Norbert estimates API call costs using a local pricing table (`pricingModel.ts`) with per-model rates. These rates can drift from Anthropic's actual pricing when models are updated or new models launch. OTel log records from Claude Code include `cost_usd` -- described by Anthropic as "Estimated cost in USD." While not authoritative billing data, it is calculated by Anthropic's systems and is closer to actual pricing than Norbert's local table.

The question is how to integrate OTel-reported cost data without breaking the existing pricing model fallback for non-OTel sessions.

## Decision

When processing an `api_request` event in `metricsAggregator.ts`, check for `cost_usd` in the payload. If present and numeric, use it directly as the total cost for that event. If absent, fall back to `calculateCost(usage, pricingTable)` as before.

`pricingModel.ts` is unchanged. The bypass happens in the aggregator's event handler for `api_request`, not in the pricing model itself.

## Alternatives Considered

### A: Modify pricingModel.ts to accept optional cost_usd
- Add `cost_usd` parameter to `calculateCost()`; return it directly when present
- **Rejected**: Conflates two responsibilities. `calculateCost` is a pure estimation function. Adding a "just return this value" path makes it a conditional passthrough, not a calculator. Violates single responsibility.

### B: Separate cost extraction module
- New `costExtractor.ts` that decides between OTel-reported and estimated cost
- **Rejected**: Over-engineering. The conditional is a single `if` check in the aggregator. A new module for one conditional adds indirection without value.

### C: Bypass in aggregator (selected)
- `metricsAggregator.ts` checks `cost_usd` before calling `calculateCost`
- Clean separation: aggregator decides which cost source; pricing model calculates when needed

## Consequences

- **Positive**: OTel-reported cost used when available. Zero change to pricing model. Transcript-polled events continue using estimated costs.
- **Positive**: `cost_usd = 0.0` is treated as valid (zero cost for fully cached response), not as missing.
- **Negative**: Cost accuracy depends on Claude Code correctly reporting `cost_usd`. Since Anthropic describes it as "estimated," there may be minor discrepancies with actual billing. Accepted: Anthropic's estimate is still closer to truth than Norbert's local pricing table.
