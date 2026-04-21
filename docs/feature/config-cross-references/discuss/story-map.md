# Story Map: config-cross-references

## User: Ravi Patel (Claude Code power user, from `norbert-config`)

## Goal
Follow references between config items in the Configuration viewer and come back
easily, building a mental map of how agents, commands, skills, hooks, MCP
servers, rules, and plugins compose.

---

## Backbone

| Spot Reference | Peek (Single-click) | Commit (Ctrl+click) | Traverse History | Handle Edge Cases |
|----------------|---------------------|---------------------|------------------|--------------------|
| Detect refs in markdown | Open vertical split | Switch sub-tab + sync list + replace detail | Alt+Left / Alt+Right | Dead refs (strike + tooltip) |
| Style refs as clickable | Preview target in bottom | Reset split on commit | Scope history to Config view | Ambiguous refs (popover) |
| Respect code blocks | Replace bottom on nested click | Handle unresolved click safely | Clear forward stack on new nav | Permission / deleted mid-click |
| Distinguish dead / ambiguous | Close split (Esc / X) | Preserve filter? (OQ-1) | Cap size (LRU 50?) | Unsupported ref type |
| Keyboard focusable | Keyboard: Enter to split | Keyboard: Ctrl+Enter | Handle start/end of stack | Malformed markdown |

---

## Walking Skeleton

The thinnest end-to-end slice that delivers observable value: a user can see a
reference, click it, see the target, and come back.

| Activity | Skeleton task |
|----------|---------------|
| Spot Reference | Detect explicit markdown links to `.claude/...` and known item names in a `Related:` section. Style as subtle underline. |
| Peek | Single-click opens vertical split with preview of the target. |
| Commit | Ctrl+click replaces detail, updates sub-tab + list selection. |
| Traverse History | Alt+Left restores previous snapshot. (Alt+Right optional for skeleton.) |
| Handle Edge Cases | Dead-reference styling (no crash) only. |

Walking skeleton = US-101 + US-102 + US-103 + US-104(partial) + US-107(partial).
Everything in the backbone below the skeleton line layers in subsequent releases.

---

## Release 1: Working navigation (Walking Skeleton)

**Target outcome**: Ravi can follow a reference chain and return in at least 70% of attempts without losing his place.

Stories:
- **US-101** -- Detect references in detail markdown and style as clickable
- **US-102** -- Single-click opens vertical split preview
- **US-103** -- Ctrl+click replaces secondary panel and syncs primary (list + sub-tab)
- **US-104** -- Alt+Left / Alt+Right history traversal (back/forward)
- **US-107** -- Dead reference: visual distinction and no-op click (safety net)

**KPI targeted**: `cross_ref_session_success_rate` -- proportion of cross-reference click attempts that reach a non-error target state, measured >= 70% within 30 days of release.

**Rationale**: This is the minimum slice where the feature exists. Without these five stories, the feature doesn't deliver on its emotional promise ("nothing is ever one-way"). Dead-ref handling is included in R1 (not deferred) because a crash or empty-pane on a dead ref would destroy trust in the whole system.

---

## Release 2: Robustness and refinement

**Target outcome**: Ravi trusts the feature end-to-end across edge cases. Adoption increases beyond curious tryouts into habitual use.

Stories:
- **US-105** -- Close split returns to single-pane view (Esc / X / close button)
- **US-106** -- Single-click inside split replaces bottom pane (max split depth = 2)
- **US-108** -- Ambiguous reference disambiguation popover
- **US-109** -- Deleted-mid-click / permission-error graceful fallback
- **US-110** -- Keyboard-only path (Tab focus, Enter, Ctrl+Enter, Esc, Alt+Left/Right scoped correctly)

**KPI targeted**: `cross_ref_retention_7d` -- proportion of users who used the feature in week 1 who use it again in week 2, target >= 50%.

**Rationale**: Power users don't commit to a feature they've seen break once. These stories close the most-likely frustration paths and unlock keyboard-first workflows (crucial for the Ravi persona).

---

## Release 3: Depth and delight (deferred, possibly out of scope for v1)

**Target outcome**: Heavy users build sophisticated navigation habits that save meaningful time.

Stories:
- **US-111** -- Ref-detection for bare prose mentions (opt-in setting, context-aware heuristic)
- **US-112** -- Ambiguous reference resolution learning (remember user's previous choices within a session)
- **US-113** -- Toolbar Back/Forward buttons (mouse-primary alternative to Alt+Left/Right)
- **US-114** -- Persisted history across Norbert restarts (if user research signals demand)
- **US-115** -- Swap-top-and-bottom keyboard shortcut in split view

**KPI targeted**: `cross_ref_median_chain_length` -- median number of reference follows per session, target >= 3 for regular users.

**Rationale**: These are the power-user delighters. They don't exist in the walking skeleton, they don't close safety gaps. They're worth building only if Releases 1 and 2 prove the feature is valuable.

---

## Priority Rationale

### Why Release 1 in this order

1. **US-101** (detection) comes first because without it nothing else is clickable. It is the gate for every other story.
2. **US-102** (single-click split) before **US-103** (Ctrl+click) because single-click is the lower-stakes interaction that builds user trust in the split metaphor before we ask them to make a committed jump.
3. **US-103** (Ctrl+click) must exist in the skeleton because otherwise there is no way to actually navigate to a new context -- only peek.
4. **US-104** (Alt+Left/Right) in the skeleton because without it, committing via Ctrl+click feels irreversible and destroys the emotional arc (no way back). Back is mandatory; forward could theoretically ship in R2 but shipping Alt+Left without Alt+Right is a weird half-implementation, so both ship together.
5. **US-107** (dead reference handling) in the skeleton, not deferred. If a user's first reference click shows an empty pane or throws, they won't try again. Dead-ref handling is the lowest-effort highest-trust story.

### Why Release 2 exists before power-user features

Release 2 stories are about closing failure modes that would cause Ravi to lose trust:
- Ambiguous references are common in Claude Code (same name across scopes is idiomatic), so US-108 is a likely first-week frustration.
- Keyboard path (US-110) is critical for Ravi's persona (power user, mouse-averse for frequent actions). Without it, adoption stalls for the target audience.

### Why Release 3 is deferred

Release 3 is about delight, not about resolving known pain. Every R3 story adds complexity proportional to usage frequency we can't predict pre-release. Build signal first, build delight second (Walter's hierarchy: Functional -> Reliable -> Usable -> Pleasurable).

---

## Scope Assessment: PASS -- 10 stories, 1 bounded context (norbert-config plugin), estimated 8-12 days total effort

Elephant Carpaccio check:
- Stories: 10 (5 in R1, 5 in R2, 5 deferred to R3) -- within the >10 caution threshold when R3 is deferred.
- Bounded contexts: 1 (norbert-config plugin; this feature is a layer on top of the existing detail pane and list pane).
- Walking skeleton integration points: 5 (reference registry, list pane state, detail pane state, history state, keyboard handlers).
- Estimated effort: R1 ~5 days, R2 ~4 days, R3 deferred.
- User outcomes: R1 and R2 each deliver an independently valuable outcome (R1 = feature exists; R2 = feature feels trustworthy).

**Verdict**: right-sized at the v1 release boundary (R1 + R2 = 10 days total, 10 stories, one plugin). R3 is explicitly deferred until post-release signal. If the user wants v1 to be just R1 (5 stories, 5 days), that is also a viable scope -- the 5 R1 stories deliver end-to-end value on their own.
