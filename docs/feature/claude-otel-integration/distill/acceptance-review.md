# Acceptance Test Review: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Review ID**: accept_rev_20260323
**Reviewer**: Quinn (acceptance-designer, review mode)
**Date**: 2026-03-23

---

## Peer Review (Critique Dimensions)

### Dimension 1: Happy Path Bias

**Result**: PASS

- Total scenarios: 33
- Happy path: 11 (33%)
- Error path: 4 (12%)
- Edge/boundary: 18 (55%)
- Error + edge combined: 22/33 = 67% (exceeds 40% target)

Error coverage includes: missing required attributes, missing session identity, malformed JSON, tool execution failures. Edge cases include: zero values, string-to-typed parsing, forward compatibility, MCP metadata, optional attributes, multiple records per request.

### Dimension 2: GWT Format Compliance

**Result**: PASS

- All 33 scenarios follow Given-When-Then structure
- No scenario has multiple When actions
- All scenarios have concrete Given context, single When trigger, observable Then outcome
- Background used for shared Given steps only

### Dimension 3: Business Language Purity

**Result**: PASS

Terms verified absent from Gherkin: database, SQL, SQLite, HTTP, REST, JSON, controller, handler, service, status code (numeric codes appear as domain attributes like "status_code 429" which is a domain concept per the data model), endpoint (replaced with "ingestion endpoint" -- domain term), serde, axum, deserialized, parsed.

Technical terms that appear intentionally as domain language: "OTel" (domain term per ubiquitous language), "session.id" (domain attribute name), "log record" (domain concept), "cost_usd" (domain attribute).

### Dimension 4: Coverage Completeness

**Result**: PASS

All 9 user stories mapped to scenarios. Coverage matrix shows:
- US-COI-001: 11 scenarios (core ingestion, heavily tested)
- US-COI-002: 3 scenarios (cost bypass, zero cost, fallback)
- US-COI-003: 4 scenarios (suppression, non-OTel, mixed, detection)
- US-COI-004: 2 scenarios (round-trip, regression)
- US-COI-005: 3 scenarios (unification, OTel-first, missing)
- US-COI-006: 2 scenarios (length, opt-in content)
- US-COI-007: 3 scenarios (success, failure, MCP)
- US-COI-008: 2 scenarios (rate limit, timeout)
- US-COI-009: 3 scenarios (allow, deny, forward-compat)

All acceptance criteria from each user story have at least one corresponding scenario.

### Dimension 5: Walking Skeleton User-Centricity

**Result**: PASS

Three walking skeletons evaluated against litmus test:

1. "Developer receives token usage from OTel-enabled session"
   - Title describes user goal: YES (developer receives data)
   - Then describes user observation: YES (stored event with specific values)
   - Non-technical stakeholder confirms: YES ("Marco can see his token usage")

2. "Developer sees OTel-reported cost instead of estimated cost"
   - Title describes user goal: YES (developer sees accurate cost)
   - Then describes user observation: YES (cost increases by exact amount)
   - Non-technical stakeholder confirms: YES ("cost display uses the provider's number")

3. "OTel-active session stops duplicate transcript polling"
   - Title describes user goal: YES (no duplicate data)
   - Then describes user observation: YES (polling skipped, counts not duplicated)
   - Non-technical stakeholder confirms: YES ("Marco's numbers are accurate, not doubled")

### Dimension 6: Priority Validation

**Result**: PASS

- Primary bottleneck addressed: token data delivery latency (3-9s polling vs sub-second OTel)
- Cost accuracy improvement: provider-reported cost vs local estimate
- Data duplication prevention: polling suppression for OTel-active sessions
- All Must Have stories (US-COI-001, 003, 004, 005) have highest scenario counts
- Should Have stories (US-COI-002, 006, 007, 008) have appropriate coverage
- Could Have story (US-COI-009) has minimal but sufficient coverage

---

## Mandate Compliance Evidence

### CM-A: Hexagonal Boundary Enforcement

Backend scenarios invoke exclusively through:
- `POST /v1/logs` HTTP endpoint (driving port in `hook_receiver.rs`)
- `EventStore.write_event()` / `EventStore.get_events_for_session()` (driven port for verification)

Frontend scenarios invoke exclusively through:
- `aggregateEvent()` (driving port in `metricsAggregator.ts`)
- Transcript polling effect boundary (driving port in `App.tsx`)

Zero direct imports of internal components: no `otlp_parser`, no `event_extractors`, no `attribute_mapper`, no `tokenExtractor`, no `pricingModel` in step definitions.

### CM-B: Business Language Purity

Gherkin verified free of: database, SQL, HTTP, REST, JSON, controller, handler, router, middleware, serialize, deserialize, struct, enum, function, import, module, crate, repository, adapter.

Step method naming convention (prescribed): `given_session_sending_otel_data`, `when_log_record_ingested`, `then_event_stored_for_session` -- all business terms.

### CM-C: Walking Skeleton and Focused Scenario Counts

- Walking skeletons: 3 (within 2-5 recommended range)
- Focused scenarios: 30 (within 15-20+ range for 9 stories)
- Total: 33
- Error + edge ratio: 67% (exceeds 40% target)

---

## Approval Status

**APPROVED**

All 6 critique dimensions pass. All 3 mandates satisfied with evidence. Ready for handoff to software-crafter.

---

## Handoff Package for nw-functional-software-crafter

### What to Implement

1. **Test scenarios document**: `docs/feature/claude-otel-integration/distill/test-scenarios.md`
   - 33 scenarios organized by roadmap phase
   - Implementation sequence defined (enable one at a time)
   - Driving port mapping for each scenario

2. **Roadmap phases**:
   - Phase 01 (Backend/Rust): Scenarios 1-26 (steps 01-01, 01-02, 01-03)
   - Phase 02 (Frontend/TypeScript): Scenarios 27-33 (steps 02-01, 02-02)

### Implementation Sequence

Follow the numbered sequence in the "Implementation Sequence" section of test-scenarios.md. Each scenario should be:
1. Enabled (remove skip/ignore)
2. Run (verify it fails for the right reason)
3. Implemented (inner TDD loop)
4. Verified passing
5. Committed

### Architecture Context

- **Backend driving port**: `POST /v1/logs` handler in `hook_receiver.rs`
- **Backend pure modules**: `adapters/otel/` (parser, extractors, mapper)
- **Frontend driving port**: `aggregateEvent()` in `metricsAggregator.ts`
- **Domain types**: `EventType` enum in `domain/mod.rs` (add 5 variants)
- **No schema changes**: SQLite stores event_type as TEXT

### Key Design Constraints

- All attribute values arrive as `stringValue` (parser must convert to typed values)
- `session.id` (dot-separated) from log record attributes, NOT resource attributes
- `cache_read_tokens` renamed to `cache_read_input_tokens` in canonical payload
- No `#[serde(deny_unknown_fields)]` -- must ignore unknown fields
- `cost_usd = 0.0` is valid (not missing)
- Non-Claude events return 200 OK with no persistence
- Missing required fields drop record with warning, return 200 OK

### Verified Data Models

Authoritative source: `docs/feature/claude-otel-integration/design/data-models.md`
Verified against live Claude Code v2.1.81 spike output.

### Property-Based Test Signals

Scenarios tagged `@property` (4, 27) should be implemented as property-based tests with generators, not single-example assertions. Use `fast-check` (TypeScript) or `proptest` (Rust).
