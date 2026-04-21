# Wave Decisions: config-cross-references (DISCUSS)

Feature: `config-cross-references`
Wave: DISCUSS
Persona: Ravi Patel (inherited from parent feature `norbert-config`)
Date: 2026-04-21

---

## Summary

This DISCUSS wave produced:

- Visual journey (`journey-cross-reference-navigation-visual.md`)
- Journey YAML with per-step Gherkin (`journey-cross-reference-navigation.yaml`)
- Shared artifacts registry (`shared-artifacts-registry.md`)
- Story map with priority rationale (`story-map.md`)
- 10 LeanUX user stories (`user-stories.md`) -- 5 for R1 (walking skeleton), 5 for R2 (robustness)
- Outcome KPIs (`outcome-kpis.md`) -- 6 KPIs covering primary success, retention, chain length, and three guardrails (reliability, trust, responsiveness)
- DoR validation (`dor-validation.md`) -- all 10 stories PASSED (with one trivial US-107 scenario split applied in user-stories.md)

All stories trace to at least one outcome KPI. No orphan stories. Scope is right-sized (10 stories, 1 bounded context, ~10 days estimated effort).

---

## Risks Noted

### R1: No DIVERGE / no DISCOVER wave for this sub-feature

**Impact**: The job statement driving this feature (JS-5 style) was inferred from the feature brief and parent `norbert-config` context, not validated via interviews or ODI. If Ravi and similar users do not actually experience the "lose my place" pain the feature assumes, this entire feature could be building something users do not want at the frequency assumed.

**Probability**: LOW-MEDIUM. The parent feature's JS-1..JS-4 analysis establishes that navigating between configs is a known pain point. The cross-reference extension is a plausible derivative. But it is an inference, not an observed need.

**Mitigation**:
- The R1 walking skeleton is small enough (~5 days) that a kill-switch after week-1 telemetry is feasible.
- KPI #2 (week-1 to week-2 retention >= 50%) is explicitly a validation gate: if users try it and don't return, the R3 deferral becomes a permanent cancellation.
- Schedule a post-R1 user interview cycle before committing to R2.

**Owner**: Luna (product-owner) flags; user decides whether to defer the feature pending DISCOVER input, or proceed with R1 as a lightweight validation.

### R2: Ambiguity in bare-prose reference detection (OQ-4)

**Impact**: If we ship bare-prose detection too aggressively, we create false positives where a common English word happens to match an item name. If we ship it too conservatively (only curated "Related:" sections), power users complain that obvious references aren't linkified.

**Probability**: MEDIUM.

**Mitigation**: v1 defaults bare-prose detection OFF. Inline code and explicit markdown links cover the high-value cases. R3 story US-111 handles this as an opt-in heuristic.

**Owner**: DESIGN wave validates the pipeline; if bare-prose becomes a sticking point, a spike is appropriate before committing a story.

### R3: State coordination between ConfigListPanel and ConfigDetailPanel

**Impact**: US-103 (Ctrl+click) requires atomic coordination of sub-tab + list selection + detail + split state. The existing `norbert-config` plugin has these as independent controlled states in separate panel components. The DESIGN wave must choose a state-container shape that keeps them coordinated without over-coupling.

**Probability**: LOW (it's a known pattern -- Redux/Zustand/React Context), but warrants deliberate design.

**Mitigation**: Lift state coordination into a Configuration-view-scoped store. DESIGN wave task.

**Owner**: solution-architect (DESIGN wave).

### R4: Performance of reference detection on large markdown bodies

**Impact**: Some skill/command markdown bodies are thousands of lines. Running detection on every re-render could be slow.

**Probability**: LOW, but monitor.

**Mitigation**: Memoise detection by `(content, registry-version)` tuple. DESIGN wave captures as NFR.

**Owner**: solution-architect.

---

## Open Questions for DESIGN Wave

Carried over from the journey YAML `open_questions` block. The user should weigh in on these during or before DESIGN; each has a recommendation from product-owner.

### OQ-1: Filter-bar behaviour on Ctrl+click that crosses sub-tabs
- **Question**: Preserve filter, reset filter, or reset only if it would hide the target?
- **Recommendation**: Reset only if the current filter would hide the target.
- **Who decides**: User + DESIGN wave.

### OQ-2: Does manual navigation push history?
- **Question**: Should list-row selection and sub-tab switching (without a reference click) push history entries?
- **Recommendation**: NO -- only cross-reference actions push history. Keeps Alt+Left focused on the reference-chain timeline, which is the feature's core value.
- **Who decides**: User + DESIGN wave.

### OQ-3: Max split depth
- **Question**: Is the 2-pane cap correct, or should arbitrary nesting be supported?
- **Recommendation**: Cap at 2 for v1. Add a swap shortcut later if asked.
- **Who decides**: User + DESIGN wave.

### OQ-4: Reference detection pipeline
- **Question**: What strategies contribute to detection, and in what priority?
- **Recommendation**: (1) explicit markdown links, (2) inline code matching known names, (3) bare prose OFF by default. A spike may be appropriate if bare-prose becomes a hot topic.
- **Who decides**: User + DESIGN wave; possible spike.

### OQ-5: Scope precedence for disambiguation default
- **Question**: project > plugin > user (most-local), or a different order?
- **Recommendation**: project > plugin > user (matches Claude Code resolution order), BUT always show the popover -- never silently resolve.
- **Who decides**: User + DESIGN wave.

### OQ-6: History stack size
- **Question**: Unbounded, fixed cap, or configurable?
- **Recommendation**: LRU 50 per Configuration view session.
- **Who decides**: DESIGN wave.

### OQ-7: Persisted history across Norbert restarts
- **Question**: Should history survive restart?
- **Recommendation**: NO for v1, in-memory only. Revisit post-R2 signal.
- **Who decides**: DESIGN wave.

---

## Decisions Already Made (Not Open)

These were judgment calls made during DISCUSS that should be treated as settled unless explicitly re-opened.

### D1: Max split depth = 2 (top + bottom)
Locked in US-106. Enforced as an invariant. Opens door to OQ-3 only if user wants arbitrary nesting instead.

### D2: Dead references never crash, always explain via tooltip
Locked in US-107. Non-negotiable safety floor.

### D3: Ambiguous references ALWAYS surface the popover (no silent precedence resolution)
Locked in US-108. KPI #5 is a guardrail on this.

### D4: Alt+Left / Alt+Right are scoped to the Configuration view only
Locked in US-104. Must not intercept when another Norbert view is active.

### D5: Ctrl+click is atomic: sub-tab + list + detail + split-reset all in one update
Locked in US-103. Partial updates are bugs, not edge cases.

### D6: Single-click in split replaces bottom pane (never creates a third)
Locked in US-106.

### D7: No persisted history for v1
Locked via scope decision; R3 story US-114 is the option for later.

### D8: WCAG 2.2 AA is the accessibility baseline
Locked in System Constraint #8 and US-110.

### D9: Story-map priority is outcome-first, not effort-first
Walking skeleton = US-101 + US-102 + US-103 + US-104 + US-107 (5 stories). R2 is trust-and-keyboard closure. R3 is deferred delighters.

### D10: In-memory reference registry rebuilt on filesystem change
Inherited from parent norbert-config. This feature adds a derived index but does not introduce caching with staleness risk.

---

## Non-Functional Requirements (NFRs) Carried to DESIGN

- **NFR-1 Click responsiveness**: click-to-render-complete p95 <= 250ms for references resolving within the in-memory registry. (Global KPI #6 guardrail; mirrored in US-102 and US-103 AC.)
- **NFR-2 Reference-registry build time**: initial registry build completes within 500ms p95 for configurations of up to 500 items (total across agents, commands, skills, hooks, MCP servers, rules, plugins). DESIGN wave confirms or adjusts based on prototyping.
- **NFR-3 History memory usage**: history stack capped at LRU 50. Each snapshot is small (sub-tab id + item id + split state + timestamp ~ 200 bytes). Worst-case memory ~ 10 KB. Negligible.
- **NFR-4 Accessibility baseline**: WCAG 2.2 AA for all new UI. Keyboard-only path end-to-end (US-110).
- **NFR-5 Keyboard-binding availability**: Alt+Left / Alt+Right are not known to conflict with existing Norbert shortcuts but this must be verified in DESIGN wave kickoff. If a conflict is found, either the existing binding or this feature's binding changes; this feature's binding change takes priority over the reuse if the existing binding is higher-frequency.

---

## Alternatives Considered and Rejected

### ALT-1: No-split design (reference click replaces detail, no peek)
Rejected because it loses the "anchor while peeking" value proposition -- the core emotional promise of the feature is that the user can follow a reference without losing their place. A no-split design becomes equivalent to Ctrl+click only, which is a strictly worse version of the proposed feature.

### ALT-2: Arbitrary split nesting (3+ panes)
Rejected. Captured as OQ-3. Max split depth = 2 matches most IDE diff views; more nesting creates visual chaos disproportionate to the rare use case of simultaneous 3-way comparison.

### ALT-3: Persisted history across Norbert restarts
Deferred to R3. Captured as OQ-7 and as story US-114. In-memory only for v1.

### ALT-4: Bare-prose reference detection by default
Deferred to R3 with opt-in setting. Captured as OQ-4 and as story US-111. False-positive risk too high to enable by default in v1.

### ALT-5: Silent scope-precedence resolution for ambiguous references
Rejected. Would save the user a click but destroys the core trust property -- the user would sometimes navigate to an unexpected scope without realising there was ambiguity. KPI #5 is a guardrail against this.

---

## Downstream Handoff Checklist

### To DESIGN wave (solution-architect)
- [x] Journey visual + YAML complete
- [x] Shared artifacts registry complete
- [x] Story map with priority and walking skeleton complete
- [x] 10 user stories with full AC and UAT complete
- [x] DoR validation passed
- [x] Outcome KPIs defined and measurable
- [x] 7 open questions surfaced with recommendations
- [x] Risks documented
- [ ] Peer review (see peer-review.yaml -- to be produced)

### To DEVOPS wave (platform-architect)
- [x] Outcome KPIs specify events, fields, and aggregation methods
- [x] Instrumentation requirements listed (3 new events: `cross_ref_click`, `nav_history_restore`, `ambiguous_ref_resolve`)
- [x] Guardrail thresholds defined

### To DISTILL wave (acceptance-designer)
- [x] Journey YAML includes embedded Gherkin per step
- [x] User stories include embedded AC per story (no standalone acceptance-criteria.md needed)
- [x] Failure modes enumerated per step
- [x] Error paths documented in journey YAML

---

## SSOT Bootstrap Decision

**Decision**: Do NOT bootstrap `docs/product/` SSOT in this wave.

**Rationale**:
- SSOT bootstrap is a meaningful decision that affects all future feature work.
- This feature is a delta on an existing feature (norbert-config); the natural place for its journey to live long-term is ambiguous (SSOT? Parent? This feature dir?).
- Absent a clear signal from the user that SSOT bootstrap is wanted now, deferring avoids a premature structural commitment.

**What this implies for the next feature**: if the user explicitly wants an SSOT structure (e.g. to start consolidating journeys across features), that bootstrap is a discrete, one-time task best done in a dedicated session or as part of a larger housekeeping story.

**Flagged as decision**: if the user wants SSOT bootstrap included in this wave, Luna can produce `docs/product/journeys/cross-reference-navigation.yaml` and `docs/product/jobs.yaml` as a follow-up without rework -- the journey YAML is already structured to move.

---

## Changelog

- 2026-04-21: DISCUSS wave completed for `config-cross-references`.
