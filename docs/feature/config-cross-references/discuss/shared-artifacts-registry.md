# Shared Artifacts Registry: config-cross-references

Tracks every `${variable}` and data token that crosses step boundaries in the
Cross-Reference Navigation journey. Every entry has a single source of truth
and documented consumers.

---

## reference_registry

- **Source of truth**: plugin-maintained in-memory index, rebuilt on filesystem change events. Keyed by `(type, scope, name) -> item`. Also supports reverse lookup by `filePath`.
- **Consumers**:
  - Detail pane renderer (to style clickable tokens)
  - Click handler (to resolve click target)
  - Disambiguation popover (to list candidates)
  - Dead-reference tooltip (to explain searched scopes)
- **Owner**: norbert-config plugin (extended by this feature)
- **Integration risk**: **HIGH** -- if render-time and click-time views of the registry disagree, users click tokens that 'vanish'. Must be snapshot-consistent per render or accept soft-failure (show the tooltip, not crash).
- **Validation**: Unit: registry lookup returns identical results given identical input. Integration: reference rendered as live remains live through at least the next 500ms, barring a genuine filesystem change event.

## reference_token_style

- **Source of truth**: design tokens (to be defined in DESIGN wave). Proposed token names: `--config-ref-color-default`, `--config-ref-underline-default`, `--config-ref-color-hover`, `--config-ref-color-dead`, `--config-ref-color-ambiguous`.
- **Consumers**: detail pane top, detail pane bottom (split preview), disambiguation popover chips.
- **Owner**: norbert-config plugin theme file (extends Norbert's existing design tokens).
- **Integration risk**: **MEDIUM** -- style inconsistency across panes would confuse users ('why is this underlined differently?').
- **Validation**: Visual snapshot tests per pane.

## nav_history_stack

- **Source of truth**: Configuration-view-scoped in-memory state (React context or store limited to the Configuration view mount).
- **Schema**: `Array<{ subTab, listItemId, splitState, at: timestamp }>` plus `headIndex: number`.
- **Consumers**:
  - Alt+Left/Right keyboard handlers
  - Optional toolbar Back/Forward buttons (DESIGN wave may add)
  - History restore machinery
- **Owner**: this feature (new state container).
- **Integration risk**: **HIGH** -- stale or desync'd history leads to broken back navigation, which destroys the 'nothing is ever one-way' emotional promise.
- **Validation**: Property test -- for every sequence of navigation actions, Alt+Left N times followed by Alt+Right N times returns to the original state.

## active_sub_tab

- **Source of truth**: `ConfigListPanel` controlled state (pre-existing).
- **Consumers**: list pane header, list pane contents, history stack entries, Ctrl+click handler.
- **Owner**: norbert-config plugin (pre-existing; this feature WRITES to it on Ctrl+click and on Alt+Left/Right).
- **Integration risk**: **MEDIUM** -- if Ctrl+click writes it but the list pane doesn't react, the pane shows one thing and the list another.
- **Validation**: Integration test: Ctrl+click across sub-tabs results in the new sub-tab being visually selected in the tab strip.

## selected_list_item

- **Source of truth**: `ConfigListPanel` controlled state (pre-existing).
- **Consumers**: list pane row highlight, detail pane input, history stack entries.
- **Owner**: norbert-config plugin (pre-existing; this feature WRITES to it on Ctrl+click and on Alt+Left/Right).
- **Integration risk**: **HIGH** -- primary touch point. If Ctrl+click switches sub-tab but list selection doesn't follow, user sees wrong row highlighted and detail showing a third thing.
- **Validation**: Integration test: after Ctrl+click the list row is highlighted AND scrolled into view AND the detail pane input matches.

## split_state

- **Source of truth**: `ConfigDetailPanel` controlled state (new -- added by this feature).
- **Schema**: `null | { topRef: ConfigItemRef, bottomRef: ConfigItemRef, dividerRatio: number }`.
- **Consumers**: detail pane layout, history stack entries.
- **Owner**: this feature.
- **Integration risk**: **MEDIUM** -- must be kept in sync with what top pane is showing; must reset to null on Ctrl+click.
- **Validation**: Invariant check -- whenever split_state is not null, `topRef.id === selected_list_item.id`. Broken invariant = bug.

## scope_resolution_order

- **Source of truth**: constant in the feature's domain module (proposed: `['project', 'plugin', 'user']`).
- **Consumers**: disambiguation popover default selection, Ctrl+click on ambiguous reference fallback.
- **Owner**: this feature.
- **Integration risk**: **LOW** (single constant) but **HIGH** semantic risk -- silently changing this would surprise users. Document in user stories and cover in tests.
- **Validation**: Unit test: given a specific ambiguous lookup, the winner matches the documented order.

---

## Integration Validation Matrix

| Artifact                     | Steps (from journey.yaml) | Consistency rule                                                  |
|------------------------------|---------------------------|-------------------------------------------------------------------|
| reference_registry           | 1, 2, 3, 5, 6             | Registry snapshot at render == registry at click (barring fs events) |
| reference_token_style        | 1, 2, 5, 6                | Same tokens across all panes; dead and ambiguous variants distinct |
| nav_history_stack            | 2, 3, 4                   | Push per nav action; Alt+Left/Right bit-for-bit restore            |
| active_sub_tab + selected_list_item + split_state (tuple) | 3, 4 | Ctrl+click updates all three atomically; Alt+Left restores all three |
| scope_resolution_order       | 6                         | Same constant everywhere; disambiguation default selection matches |

---

## Cross-Feature Impacts

This registry extends `docs/feature/norbert-config/discuss/shared-artifacts-registry.md`.
Pre-existing artifacts (`agent_definitions`, `command_definitions`, `hook_configurations`, etc.)
become **inputs** to the new `reference_registry`. No changes to their sources of truth;
this feature adds a new derived index over them.

## Changelog

- 2026-04-21: Initial registry for cross-reference navigation.
