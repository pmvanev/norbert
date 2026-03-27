# Peer Review: OTel-First Metrics Pipeline Requirements

```yaml
review_id: "req_rev_20260327_001"
reviewer: "product-owner (review mode)"
artifact: "docs/feature/otel-first-metrics/discuss/user-stories.md"
iteration: 1

strengths:
  - "All 5 stories trace directly to job stories with concrete Four Forces analysis"
  - "Domain examples use real persona names (Kai Nakamura, Priya) with realistic data ($0.42, 1500 tokens, claude-sonnet-4-20250514)"
  - "Backward compatibility is explicitly covered in every story -- hook-only sessions are not broken"
  - "Technical notes identify breaking changes (WarningClusterData type, hookEventCount rename) without prescribing solutions"
  - "Stories are properly sized: 1-2 days each, 3-4 scenarios each, total 17 scenarios across 5 stories"
  - "Shared artifact registry documents all cross-cutting data with sources, consumers, and risk levels"

issues_identified:
  confirmation_bias:
    - issue: "No scenario tests what happens if OTel detection flips mid-session (events arrive that change isOtelActive from false to true)"
      severity: "medium"
      location: "US-OFM-01"
      recommendation: "Add scenario: session starts hook-only, then first api_request arrives. Verify cost is not retroactively adjusted but going-forward cost uses OTel-only."

  completeness_gaps:
    - issue: "US-OFM-03 apiErrorRate denominator definition is inconsistent -- story says 'apiErrorCount / (apiErrorCount + api_request count)' but the Gherkin says 'approximately 0.27' for 3 errors and 8 requests which is 3/11, implying denominator includes both"
      severity: "high"
      location: "US-OFM-03, AC and UAT"
      recommendation: "Clarify: apiErrorRate = apiErrorCount / (apiErrorCount + apiRequestCount). Document this formula explicitly in AC. The 3/11 = 0.27 example is correct if denominator is total interactions."

    - issue: "No explicit NFR for cost accuracy tolerance -- 'matches billing' is vague"
      severity: "medium"
      location: "US-OFM-01"
      recommendation: "Add property: cost_usd sum must equal sessionCost within floating-point tolerance (epsilon 0.001). This is testable."

  clarity_issues:
    - issue: "US-OFM-04 staleness threshold '60 seconds' appears in YAML journey but is stated as 'configurable' in AC without specifying the default in the story itself"
      severity: "low"
      location: "US-OFM-04, AC"
      recommendation: "State default explicitly in AC: 'Staleness threshold defaults to 60 seconds'"

  testability_concerns: []

  priority_validation:
    q1_largest_bottleneck: "YES"
    q2_simple_alternatives: "ADEQUATE"
    q3_constraint_prioritization: "CORRECT"
    q4_data_justified: "JUSTIFIED"
    verdict: "PASS"

approval_status: "conditionally_approved"
critical_issues_count: 0
high_issues_count: 1
```

## Remediation Actions

### H1: apiErrorRate formula clarity (HIGH)

Add to US-OFM-03 AC: "apiErrorRate equals apiErrorCount divided by (apiErrorCount + apiRequestCount), where apiRequestCount tracks total api_request events processed"

### M1: Mid-session OTel activation (MEDIUM)

Add scenario to US-OFM-01: "Given a session starts with hook-only events contributing $1.20 to cost / And the first api_request event arrives making the session OTel-active / When subsequent prompt_submit events arrive / Then the $1.20 from before OTel activation remains in sessionCost / And subsequent hook token data is suppressed"

### M2: Cost accuracy tolerance (MEDIUM)

Add to US-OFM-01 AC: "sessionCost equals sum of api_request cost_usd values within floating-point tolerance of $0.001"

### L1: Staleness default (LOW)

Already implicit in AC "configurable (default 60 seconds)" -- acceptable as-is.

## Review Verdict

All critical/high issues have clear remediation. The high-severity formula clarity issue is editorial, not structural. The requirements package is sound and ready for handoff after applying H1 remediation.

### Status: APPROVED (with H1 remediation applied)
