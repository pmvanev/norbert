# Outcome KPIs: config-cross-references

## Feature: Cross-Reference Navigation in Configuration Viewer

### Objective
Within 60 days of release, Claude Code power users who use the Configuration viewer regularly follow reference chains end-to-end to build a mental map of how their configs compose, without losing their place -- replacing the current habit of opening individual config files in a text editor.

---

## Outcome KPIs

| # | Who | Does What | By How Much | Baseline | Measured By | Type |
|---|-----|-----------|-------------|----------|-------------|------|
| 1 | Configuration-viewer users who encounter a clickable reference | Successfully follow the reference to its target (single-click or Ctrl+click, no error state) | >= 70% of reference-click attempts reach a successful target render within 30 days of release | 0% (feature does not exist) | Instrumentation: `cross_ref_click` event with `{result: success | dead | error | ambiguous_resolved | ambiguous_cancelled}` | Leading (primary) |
| 2 | Power users who tried the feature in week 1 | Return and use it in week 2 | >= 50% week-1 to week-2 retention among users with >=1 click event | 0% | Weekly cohort retention on `cross_ref_click` event | Leading (primary) |
| 3 | Power users in a Configuration viewing session | Follow a reference chain of length >= 2 (i.e. click a ref, then click another ref from the resulting view) | Median chain length >= 3 per engaged session within 60 days | 0 | Session-level: count of consecutive `cross_ref_click` events within same config session | Leading (secondary) |
| 4 | All users who press Alt+Left or Alt+Right | Successfully return to the expected previous/next state | >= 98% of Alt+Left/Right events result in a state restoration that matches the history snapshot | N/A (new) | Instrumentation: `nav_history_restore` event with `{matched_snapshot: boolean}` | Guardrail (reliability) |
| 5 | All reference clicks against an ambiguous reference | Result in a user-confirmed choice (not a silent precedence pick) | 100% of ambiguous clicks surface the disambiguation popover | N/A (new) | Instrumentation: `ambiguous_ref_resolve` event with `{method: popover | silent_precedence}` | Guardrail (trust) |
| 6 | All reference clicks | Complete target render within 250ms (perceived responsiveness) | >= 95% at p95 | N/A (new) | Instrumentation: click-to-render-complete timing histogram | Guardrail (performance) |

---

## Metric Hierarchy

- **North Star**: KPI #1 -- cross-reference click success rate. If users click references and the feature works, the rest follows.
- **Leading indicators of north star**:
  - KPI #2 (retention) predicts long-term adoption.
  - KPI #3 (chain length) predicts whether the feature is actually solving the "build a mental map" job (one click is not a map; three clicks suggests exploration).
- **Guardrail metrics** (must NOT degrade):
  - KPI #4 (history reliability) -- if this drops, the emotional promise breaks.
  - KPI #5 (ambiguity trust) -- silent precedence picks erode trust.
  - KPI #6 (perceived responsiveness) -- a sluggish click kills flow.

---

## Measurement Plan

| KPI | Data Source | Collection Method | Frequency | Owner |
|-----|-------------|-------------------|-----------|-------|
| 1 (success rate) | `cross_ref_click` events in Norbert telemetry | Event emission on every click, aggregated ratio per day | Daily rolling, 30-day horizon | platform-architect (DEVOPS) |
| 2 (retention) | Same event stream | Cohort analysis: users with click in week N who click in week N+1 | Weekly | platform-architect |
| 3 (chain length) | Same event stream | Session-grouped sequence analysis | Weekly | platform-architect |
| 4 (history reliability) | `nav_history_restore` events with snapshot-match flag | Ratio of matched / total | Daily | platform-architect |
| 5 (ambiguity trust) | `ambiguous_ref_resolve` events | Distribution of resolution methods | Per-release check | product-owner |
| 6 (responsiveness) | Client-side timing: click timestamp to render complete | p50/p95/p99 histogram | Daily | platform-architect |

**Baselines**: All baselines are 0 / N-A because the feature does not exist. First-week data collection establishes baseline; 30-day and 60-day targets measured relative to that.

**Instrumentation requirements for DEVOPS**:
- New event: `cross_ref_click` with fields `{source_item_id, source_item_type, target_item_id, target_item_type, target_scope, interaction: single_click | ctrl_click | keyboard_enter | keyboard_ctrl_enter, result: success | dead | error | ambiguous_resolved | ambiguous_cancelled | permission_denied, latency_ms}`.
- New event: `nav_history_restore` with fields `{direction: back | forward, matched_snapshot: boolean, stack_depth}`.
- New event: `ambiguous_ref_resolve` with fields `{candidate_count, chosen_scope, method: popover | silent_precedence}`.
- No new dashboard needed initially; share existing Norbert telemetry dashboard with an added "Config Cross-Reference" panel.

---

## Hypothesis

We believe that **click-based cross-reference navigation with split-preview and synced primary-panel selection**, for **Claude Code power users browsing their configuration**, will achieve **>= 70% successful reference-follow rate and >= 3 median chain length per engaged session**.

We will know this is true when **70% of reference-click attempts reach a successful target render within 30 days**, and **regular users follow reference chains of length 3+ within 60 days**.

We will know this is false if:
- Click success rate stays below 50% after 30 days (detection or resolution is broken), OR
- Median chain length stays at 1 after 60 days (users peek once but never build a chain -- suggests the split metaphor isn't serving the mental-map job), OR
- Week-1 to week-2 retention stays below 25% (users try it and don't come back).

---

## Glossary

- **Cross-reference click**: any user action (mouse click, keyboard Enter, keyboard Ctrl+Enter, or confirmation through the disambiguation popover) that attempts to navigate from one config item to another via a reference token.
- **Cross-reference session**: the span from the first cross-reference click that opens a split OR triggers Ctrl+click, through any chain of subsequent cross-reference clicks, until EITHER (a) the user closes the split AND performs no new cross-reference click for 60 seconds, OR (b) the user leaves the Configuration view. Sessions are used for chain-length measurement (KPI #3).
- **Engaged session**: a user session in which the user performs at least one cross-reference click. Opposite: a session where the user only passively reads detail panes.
- **Reference chain**: an ordered sequence of cross-reference clicks within a single cross-reference session.
- **Live / dead / ambiguous / unsupported**: the four reference-token variants produced by the detection pipeline (US-101).

---

## Orphan-Story Check

Every story in `user-stories.md` must trace to at least one KPI above. Cross-check:

| Story | KPI traced |
|-------|-----------|
| US-101 Reference detection and styling | KPI #1 (prerequisite) |
| US-102 Single-click split preview | KPI #1, KPI #3 |
| US-103 Ctrl+click commit + sync | KPI #1, KPI #3 |
| US-104 Alt+Left/Right history | KPI #4 |
| US-105 Close split | KPI #2 (reliability of the overall flow) |
| US-106 Nested click in split | KPI #3 (chain length within split) |
| US-107 Dead reference | KPI #1 (safety net), KPI #5 |
| US-108 Ambiguous disambiguation | KPI #5 |
| US-109 Deleted-mid-click / permission | KPI #1 (error result rate), KPI #6 |
| US-110 Keyboard-only path | KPI #2 (power-user retention) |

All stories trace. No orphans.
