# Peer Review: Claude Code OTel Integration

```yaml
review_id: "req_rev_20260320_143000"
reviewer: "product-owner (review mode)"
artifact: "docs/feature/claude-otel-integration/discuss/user-stories.md"
iteration: 1

strengths:
  - "All 5 stories use real persona names (Marco Rossi, Ayumi Tanaka) with realistic session IDs and concrete data values"
  - "OTel attribute-to-canonical field mapping is explicitly documented with the rename (cache_read_tokens -> cache_read_input_tokens)"
  - "Dependency chain is clear and acyclic: COI-004 -> COI-005 -> COI-001 -> {COI-002, COI-003}"
  - "Stories are solution-neutral in acceptance criteria -- no technology prescriptions (no 'use protobuf', no 'use opentelemetry-proto crate')"
  - "Fallback story (COI-003) addresses the transition anxiety from Four Forces analysis"
  - "US-COI-002 correctly identifies the cost_usd=0.0 boundary case that could be mishandled"

issues_identified:
  confirmation_bias:
    - issue: "No scenario tests what happens when Claude Code changes its OTel schema (span renamed, attributes reorganized)"
      severity: "medium"
      location: "US-COI-001"
      recommendation: "Add a domain example or technical note about forward-compatible parsing (e.g., log unknown span names, version detection)"

  completeness_gaps:
    - issue: "No NFR for binary size impact of new dependencies"
      severity: "medium"
      location: "Global"
      recommendation: "Add NFR noting binary size budget (<5MB increase from OTLP parsing dependencies) -- already validated in DISCOVER solution-testing, should be formalized"
    - issue: "No story covers the setup wizard (JS-2 job story has no corresponding user story)"
      severity: "low"
      location: "Global"
      recommendation: "Acknowledged as future work. Add a technical note in COI-001 noting that setup wizard is out of scope for initial delivery (env vars are manual for now)"

  clarity_issues: []

  testability_concerns: []

  priority_validation:
    q1_largest_bottleneck: "YES"
    q2_simple_alternatives: "ADEQUATE"
    q3_constraint_prioritization: "CORRECT"
    q4_data_justified: "JUSTIFIED"
    verdict: "PASS"

approval_status: "approved"
critical_issues_count: 0
high_issues_count: 0
```

---

## Resolution of Medium Issues

### Issue 1: Schema Change Resilience (medium)

**Resolution**: Added to US-COI-001 technical notes. The OTLP parser should log unrecognized event names at INFO level for early detection. This is a defensive coding practice, not a new user story. No story change needed.

### Issue 2: Binary Size NFR (medium)

**Resolution**: DISCOVER solution-testing already validated binary size impact at <5MB. This is a constraint for the DESIGN wave to enforce. Added as a note in the handoff package.

### Issue 3: Setup Wizard Not Covered (low)

**Resolution**: Intentionally deferred. The DISCOVER lean-canvas identifies the setup wizard as solution S4, estimated at 1-2 days additional effort. It is a separate user story to be written after the core OTel integration is proven. The norbert-cc-plugin auto-configures the env vars, reducing the urgency of a setup wizard.

---

## Review Verdict

**APPROVED** -- All 5 stories pass DoR, no critical or high issues. Medium issues resolved with notes. Ready for DESIGN wave handoff.

---

## Addendum: 2026-03-23 Research Corrections and Scope Expansion

### Context

Research spike (`docs/research/claude-code-otel-telemetry-actual-emissions.md`) discovered that Claude Code sends **OTel logs, not traces**. All artifacts have been corrected:

- `ExportTraceServiceRequest` -> `ExportLogsServiceRequest`
- `/v1/traces` -> `/v1/logs`
- `resourceSpans/scopeSpans/spans` -> `resourceLogs/scopeLogs/logRecords`
- `session_id` (underscore) -> `session.id` (dot-separated, standard attribute on log records)
- "authoritative cost from Anthropic billing" -> "OTel-reported estimated cost"
- All references to "spans" -> "log records" / "events"

### Scope Expansion

4 new stories added (US-COI-006 through US-COI-009) to cover all 5 Claude Code OTel event types:

| ID | Event Type | Priority | Effort |
|----|-----------|----------|--------|
| US-COI-006 | claude_code.user_prompt | Should Have | 0.5-1 day |
| US-COI-007 | claude_code.tool_result | Should Have | 0.5-1 day |
| US-COI-008 | claude_code.api_error | Should Have | 0.5-1 day |
| US-COI-009 | claude_code.tool_decision | Could Have | 0.5 day |

### Review of New Stories

The 4 new stories follow the same validated pattern as the original 5:
- Real persona names (Marco Rossi, Ayumi Tanaka)
- Concrete data in domain examples
- 3+ domain examples each
- 3-4 UAT scenarios in Given/When/Then
- AC derived from UAT scenarios
- Right-sized (0.5-1 day each)
- Technical notes present
- Dependencies tracked (all depend on US-COI-001 and US-COI-004)

All new stories pass the 8-item DoR hard gate. Total effort increased from 5.5-7.5 days to 7-10 days.

**APPROVED** -- All 9 stories pass DoR. Research corrections applied throughout. Ready for DESIGN wave handoff.
