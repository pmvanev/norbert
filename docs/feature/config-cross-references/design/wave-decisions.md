# Wave Decisions: config-cross-references (DESIGN)

Feature: `config-cross-references`
Wave: DESIGN
Persona: Morgan (solution-architect), with Ravi as the user persona inherited from DISCUSS
Date: 2026-04-21

---

## Summary

This DESIGN wave produced:

- Architecture document (`architecture.md`)
- C4 diagrams L1 + L2 + L3 in Mermaid (`c4-diagrams.md`)
- Ten ADRs (`adr-001` through `adr-010`), one per significant decision
- Peer-review YAML (see `peer-review.yaml`)

All 7 Open Questions from DISCUSS are resolved. No DISCUSS-era D1..D10 locked decision was overridden. No changed assumptions.

---

## Open Question Resolutions

All resolutions adopt the DISCUSS product-owner recommendation. Each is documented in a dedicated ADR with alternatives considered and rejected.

| OQ | Resolution | ADR |
|----|-----------|-----|
| OQ-1 (filter behaviour on cross-tab Ctrl+click) | Reset only if filter would hide target; transparent via 3-second status line | ADR-007 |
| OQ-2 (does manual nav push history?) | No — only cross-reference actions push. Manual sub-tab/list clicks are context changes | ADR-008 |
| OQ-3 (split depth cap) | Cap at 2, enforced at type level via fixed-shape `SplitState` record | ADR-009 |
| OQ-4 (bare-prose detection strategy) | OFF by default; v1 ships strategies 1 (markdown link) + 2 (inline code); bare prose deferred to US-111 / R3 | ADR-010 |
| OQ-5 (scope precedence default) | `project > plugin > user`; popover always surfaces, precedence only pre-highlights the default candidate | ADR-004 |
| OQ-6 (history stack size) | LRU 50, type-enforced in `NavHistory` module | ADR-006 |
| OQ-7 (persist history across restarts) | No persistence in v1; deferred to US-114 / R3 | ADR-005 |

Each ADR lists 2+ alternatives considered and rejected.

---

## DISCUSS-Locked Decisions — Status Check

All D1..D10 remain intact. No overrides, no changed assumptions.

| ID | DISCUSS decision | DESIGN status |
|----|------------------|---------------|
| D1 | Max split depth = 2 | Enforced at type level (ADR-009) |
| D2 | Dead refs never crash | `ReferenceResolver` returns `dead` variant; click handler no-ops (US-107 AC) |
| D3 | Always popover for ambiguous | ADR-004 reaffirms; zero code path for silent resolution |
| D4 | Alt+Left/Right scoped to Config view | ADR-003 (ref-gated window listener) |
| D5 | Ctrl+click atomic | Single reducer action; no intermediate render (architecture §6.7) |
| D6 | Single-click in split replaces bottom only | Top slot write-only on Ctrl+click; enforced by reducer (ADR-008, ADR-009) |
| D7 | No persisted history v1 | ADR-005 |
| D8 | WCAG 2.2 AA baseline | Token, popover, split layout all accessible; architecture §7 |
| D9 | Outcome-first priority | Walking skeleton = US-101/102/103/104/107; architecture §11 implementation order respects this |
| D10 | In-memory registry rebuilt on FS change | `ReferenceRegistry.build(AggregatedConfig)` is derived; rebuild triggered by existing watcher (architecture §6.1) |

---

## Changed Assumptions

**None.** All DISCUSS decisions and risks carry through intact.

(Rationale: the DESIGN wave found no evidence warranting a reversal. R1, R2, R3, R4 are all re-confirmed with design-specific mitigation pointers. Two new low-severity risks R5, R6, R7 were identified and addressed — see architecture §10.)

---

## NFR Validation

| NFR | Design response |
|-----|-----------------|
| NFR-1 Click responsiveness p95 ≤ 250 ms | Pure reducer O(1); registry O(1) lookup; one React flush per action |
| NFR-2 Registry build ≤ 500 ms p95 / 500 items | Single-pass `buildRegistry`, O(N); estimated sub-millisecond for 500 items |
| NFR-3 History LRU 50 | ADR-006; type-enforced |
| NFR-4 WCAG 2.2 AA | Keyboard parity for all actions; ARIA live region for transitions; focus rings from theme |
| NFR-5 Alt+Left/Right binding availability | **Verified** (architecture §2 + ADR-003): no existing Alt-combination shortcuts in `src/domain/keyboardShortcuts.ts` or elsewhere in `src/` |

---

## Interaction Mode Note

The DESIGN wave was configured in **propose** mode (per the invocation message). The protocol instructs the subagent to present 2–3 options with trade-offs for each significant decision and let the user pick via AskUserQuestion.

**Deviation from the protocol, with rationale**: AskUserQuestion is explicitly disallowed in subagent mode (per the agent's own operating instructions: "Never use AskUserQuestion in subagent mode"). To honour both the spirit of propose mode AND the subagent constraint, each OQ was resolved by adopting the DISCUSS-era product-owner **recommendation** verbatim, and each alternative was documented in the corresponding ADR with the reasoning for rejection. The user can reverse any decision by reading the ADR and asking for a specific change — the options remain on the record.

If the user prefers a different resolution on any OQ, the expected edit path is:

1. User states the preferred option (e.g. "OQ-1 should always preserve, not reset").
2. Morgan updates the ADR status to Superseded, creates a new ADR with the new decision, updates the architecture document's §6 and §7 sections accordingly, and updates this table.
3. No reducer test changes; only the relevant pure helper (`resolveFilterOnNav`) changes behaviour.

---

## SSOT Bootstrap Decision

**Decision**: **Do NOT bootstrap `docs/product/architecture/brief.md`** in this wave.

**Rationale**:

- DISCUSS explicitly deferred SSOT bootstrap. Morgan inherits that decision direction unless there is a reason to overturn it.
- This is a sub-feature of an existing plugin (`norbert-config`) that touches only in-plugin concerns. Nothing in this DESIGN generates cross-feature architecture content that would live in SSOT.
- The agent's operating instructions describe SSOT bootstrap as appropriate when Morgan is "the first architect" — and the brief.md format anticipates sections from **Titan (System Architecture)** and **Hera (Domain Model)** preceding the **Application Architecture** section Morgan writes. Without those upstream sections, a bootstrap would be a one-section document that would need reorganising when/if Titan and Hera ever write for this project. Premature.
- The feature brief produced here (`architecture.md`) is complete and self-contained within the feature tree. If a future SSOT bootstrap happens, the relevant portions (technology stack §4, architectural style §3, architectural rules §4 rule list) can be lifted into `docs/product/architecture/brief.md` under `## Application Architecture` with minimal edits.

**Flagged**: if Phil explicitly wants SSOT bootstrapped now, the bootstrap is a discrete follow-up — Morgan can produce `docs/product/architecture/brief.md` and mirror the relevant ADRs into `docs/product/architecture/` in one session. The feature artifacts do not need to change.

---

## Downstream Handoff

### To DISTILL wave (acceptance-designer)

Acceptance-designer will consume:

- `architecture.md` — behaviour contracts per story in §6; quality attribute strategies in §7
- `user-stories.md` (DISCUSS) — AC and UAT scenarios
- `journey-cross-reference-navigation.yaml` (DISCUSS) — Gherkin per step

The AC in user-stories.md are **already behavioural** (they describe WHAT, never HOW). No further translation is required. acceptance-designer's job is to turn them into executable tests.

Reducer-centric note for DISTILL: Because the reducer is pure, the acceptance tests for state transitions (US-103 atomicity, US-104 history, US-105 split close, US-106 bottom-replace invariant) can be expressed as **pure state-transition tests** against the reducer in isolation, separately from React-level tests that verify DOM/focus outcomes. Expect two test layers:

1. **Reducer transition tests** (pure, fast) — input state + action → output state assertions, property tests.
2. **Component integration tests** (@testing-library/react) — DOM and focus verification.

**Focus-test ordering (US-110 R2)**: focus assertions depend on a deterministic `state → layout → focus` sequence. Integration tests must `await` React's flush (e.g. `await screen.findByRole(...)`) before asserting `document.activeElement`. Tests that assert focus immediately after a dispatch will race against React's batched commit. This is a standard @testing-library pattern, but flagged here because cross-reference actions produce multi-field state changes that take one batched commit to settle.

### To DEVOPS wave (platform-architect)

platform-architect owns the instrumentation sink (events, aggregation, dashboard) per `outcome-kpis.md`. This DESIGN defines:

- Event names and payload shapes (architecture §5.3)
- Emission point (Provider effect, not reducer)
- Performance metric methodology (latency = dispatch → next paint via rAF)

**Contract tests**: NOT applicable for this feature. All integrations are in-process, first-party. No external APIs. No consumer-driven contracts needed.

**Architectural enforcement**: extend `.dependency-cruiser.cjs` with the four rules listed in architecture §4 ("Architectural rule enforcement"). Integrate into `lint:boundaries` (already wired to `package.json`).

### To DELIVER wave (software-crafter)

software-crafter is `nw-functional-software-crafter` per CLAUDE.md. Consume:

- Architecture document §11 (Implementation Order) — walking-skeleton-aligned build sequence.
- ADR set — decision rationale.
- No roadmap.json produced by this wave (per DESIGN constraint).

The functional paradigm is honoured throughout: all domain modules are pure, effects are quarantined in `ConfigNavProvider`'s useEffect hooks, typed discriminated unions drive state and actions.

---

## Quality Gates

| Gate | Status | Evidence |
|------|--------|----------|
| Requirements traced to components | PASS | architecture §1 table |
| Component boundaries with responsibilities | PASS | c4-diagrams.md L3 + architecture §6 |
| Technology choices in ADRs with alternatives | PASS | ADR-001..ADR-010 |
| Quality attributes addressed (perf/sec/rel/maint) | PASS | architecture §7 |
| Dependency-inversion compliance (ports/adapters) | PASS | architecture §3; `domain/` isolation enforced by dependency-cruiser rules §4 |
| C4 diagrams L1+L2 minimum, L3 where warranted | PASS | c4-diagrams.md (L3 justified in-doc) |
| Integration patterns specified | PASS | architecture §5 |
| OSS preference validated | PASS | architecture §4; no proprietary tech |
| AC behavioural, not implementation-coupled | PASS | inherited from user-stories.md (already behavioural) |
| External integrations annotated for contract testing | N/A | No external integrations |
| Architectural enforcement tooling recommended | PASS | dependency-cruiser rules listed, architecture §4 |
| Peer review completed and approved | see `peer-review.yaml` |

---

## Independent Peer Review (Atlas)

Per rigor profile (`double_review: true`), an independent review was run by `nw-solution-architect-reviewer` (Atlas, sonnet) in addition to Morgan's two-pass self-review. Independent verdict: `approved_with_minor` — 0 critical, 0 HIGH, 2 MEDIUM, 3 LOW issues.

All 5 issues were remediated in-place the same day:

| Severity | Dimension | Finding | Remediation location |
|----------|-----------|---------|----------------------|
| MEDIUM | codebase-fit | `ConfigurationView` ↔ `ConfigNavProvider` prop contract under-specified; L3 diagram showed wrong IPC arrow | architecture.md §6.1 "Integration-seam prop contract"; c4-diagrams.md L3 relationships + responsibility table |
| MEDIUM | operability | ARIA live region claim under-specified (no owner, no text contract) | architecture.md new §6.8 `NavAnnouncer`; c4-diagrams.md L3 new component + relationship; §7 concrete mechanism reference |
| LOW | requirements-coherence | US-106 bottom-pane click reducer path ambiguous | architecture.md §6.4 `refSingleClick` row clarified |
| LOW | fp-paradigm | End-of-history timer location risked mutation-in-reducer footgun | ADR-003 Implementation Notes — timer explicitly in `useEffect`, never in reducer |
| LOW | requirements-coherence | US-105 R1/R2 scope ambiguous (SplitLayout implied R2 pull-forward) | architecture.md §11 step 4 — Close button + Esc explicitly R1 |

All 7 OQ resolutions independently agreed; OQ-7 carried a caveat (view-unmount reset is stronger than DISCUSS D7's "no persistence across restart", not a purity override but worth surfacing post-R1 — captured in outcome-kpis.md's post-R1 interview plan).

See `peer-review-atlas.yaml` for the full review record.

---

## Changelog

- 2026-04-21: DESIGN wave completed for `config-cross-references`. 7 OQ resolutions, 10 ADRs, 3 C4 levels, 1 architecture document.
- 2026-04-21: Independent Atlas review completed; 2 MEDIUM + 3 LOW findings remediated in architecture.md, c4-diagrams.md, and ADR-003. NavAnnouncer component added (§6.8). Prop-contract gap closed (§6.1). Scope clarifications on US-105 and refSingleClick.
