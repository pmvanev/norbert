# ADR-033: Authoritative Cost Bypass

## Status

Accepted

## Context

Norbert estimates API call costs using a local pricing table (`pricingModel.ts`) with per-model rates. These rates can drift from Anthropic's actual pricing when models are updated or new models launch. OTel spans from Claude Code include `cost_usd` -- the authoritative per-request cost calculated by Anthropic's billing system.

The question is how to integrate authoritative cost data without breaking the existing pricing model fallback for non-OTel sessions.

## Decision

When processing an `api_request` event in `metricsAggregator.ts`, check for `cost_usd` in the payload. If present and numeric, use it directly as the total cost for that event. If absent, fall back to `calculateCost(usage, pricingTable)` as before.

`pricingModel.ts` is unchanged. The bypass happens in the aggregator's event handler for `api_request`, not in the pricing model itself.

## Alternatives Considered

### A: Modify pricingModel.ts to accept optional cost_usd
- Add `cost_usd` parameter to `calculateCost()`; return it directly when present
- **Rejected**: Conflates two responsibilities. `calculateCost` is a pure estimation function. Adding a "just return this value" path makes it a conditional passthrough, not a calculator. Violates single responsibility.

### B: Separate cost extraction module
- New `costExtractor.ts` that decides between authoritative and estimated cost
- **Rejected**: Over-engineering. The conditional is a single `if` check in the aggregator. A new module for one conditional adds indirection without value.

### C: Bypass in aggregator (selected)
- `metricsAggregator.ts` checks `cost_usd` before calling `calculateCost`
- Clean separation: aggregator decides which cost source; pricing model calculates when needed

## Consequences

- **Positive**: Authoritative cost data used when available. Zero change to pricing model. Transcript-polled events continue using estimated costs.
- **Positive**: `cost_usd = 0.0` is treated as valid (zero cost for fully cached response), not as missing.
- **Negative**: Cost accuracy depends on Claude Code correctly reporting `cost_usd`. If Claude Code has billing bugs, Norbert inherits them. Mitigated: Anthropic's billing is the ground truth; if it's wrong, the user's bill is also wrong.
