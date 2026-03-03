# JTBD Four Forces Analysis: Config Explorer

**Feature ID**: config-explorer
**Phase**: DISCUSS -- Phase 1 (JTBD Analysis)
**Date**: 2026-03-03

---

## Forces Analysis: JS-01 (Understand Overall Config Structure)

### Demand-Generating
- **Push**: Configuration files scattered across 30+ locations in 5 scopes. Newcomers cannot form a mental model. Intermediate users discover files they did not know existed. Signal 5: "The documentation tells me what each piece does, but not how they all fit together."
- **Pull**: A single navigable view showing everything that exists, organized by subsystem and scope, with content preview. The mind map and anatomy views validated at 100% task completion (Phase 3).

### Demand-Reducing
- **Anxiety**: "Will this tool show me accurate information? What if it misses files or shows outdated data?" Static file analysis accuracy concern (CA9 -- 90%+ validated).
- **Habit**: `ls -R ~/.claude/ .claude/` and manual directory browsing work "well enough." IDE file explorer shows the directories. Users have built personal mental maps over time.

### Assessment
- Switch likelihood: **High** for complex configs, **Medium** for simple configs
- Key blocker: Habit -- users with simple configs see limited value (sparse graph insight from Phase 3 testing)
- Key enabler: Push -- 30+ file locations across 5 scopes exceeds working memory for everyone
- Design implication: Value must be immediately visible for complex configs. Missing file indicators serve newcomers. Must show scope coloring and subsystem annotations that `ls` cannot provide.

---

## Forces Analysis: JS-02 (Debug Why Config Not Taking Effect)

### Demand-Generating
- **Push**: "Context file resolution is a black box -- I configure 15 CLAUDE.md files and pray the right one wins." 30+ minute debugging sessions documented. Trial-and-error with `echo` statements to verify context loading. The 5-level settings precedence and 6-level CLAUDE.md precedence are documented but invisible at runtime.
- **Pull**: CSS DevTools-style waterfall showing what "wins" at each scope level with overridden values struck through. Achieved 100% value perception in Phase 3 testing -- the highest of all concepts.

### Demand-Reducing
- **Anxiety**: "Can a static file analyzer accurately represent runtime precedence? What about on-demand CLAUDE.md loading and dynamic skill invocation?" CA9 partially validated -- static analysis covers 90%+ of cases.
- **Habit**: Mental tracing of precedence rules from documentation. Users who have memorized the precedence hierarchy are functional (if slow). Sunk cost in learning the mental model.

### Assessment
- Switch likelihood: **Very High**
- Key blocker: Anxiety about static vs. runtime accuracy (addressed by labeling on-demand items clearly)
- Key enabler: Push is extremely strong -- "I've been debugging this for 2 days" (Phase 3 User 1)
- Design implication: The cascade waterfall is the highest-priority feature to ship. Must clearly distinguish statically-resolved vs. runtime-only items. The CSS DevTools mental model transfers directly -- no learning curve.

---

## Forces Analysis: JS-03 (Explore Config Relationships)

### Demand-Generating
- **Push**: Manual spreadsheets tracking agent-skill relationships. README documentation of configuration maps maintained by hand (~4 hours/week). Plugin components invisible to consumers. No tool shows cross-references between subsystems.
- **Pull**: Interactive force-directed graph with plugin explosion, subsystem filtering, and scope coloring. "This is exactly the spreadsheet I was maintaining manually, but interactive" (Phase 3 User 1). Naming conflict detection for plugin authors.

### Demand-Reducing
- **Anxiety**: "Will the graph be overwhelming for complex configs with 50+ nodes? Will I be able to find what I need?" Phase 3 identified subsystem filtering as essential for complex configs.
- **Habit**: Manual spreadsheets and READMEs work (expensively). Users have invested significant time building these artifacts. The graph replaces a workflow they understand.

### Assessment
- Switch likelihood: **High** for framework devs and plugin authors, **Medium** for power users
- Key blocker: Anxiety about graph complexity (mitigated by mind map alternative + subsystem filtering)
- Key enabler: Pull is the strongest differentiator -- "no tool visualizes Claude Code configuration relationships"
- Design implication: Offer mind map as default overview (less overwhelming) with graph as deep-dive toggle. Subsystem filtering is essential, not optional. Plugin explosion is the highest-delight interaction.

---

## Forces Analysis: JS-04 (Debug Path-Scoped Rule Loading)

### Demand-Generating
- **Push**: Path-scoped rules fail silently. Wrong glob pattern = rule never loads, no error, no log, no indication. 20-minute debugging sessions for a single glob pattern mismatch. Users avoid path-scoped rules because they cannot verify they work.
- **Pull**: Enter a file path, instantly see which rules match and which do not (with reason: "pattern `src/web/**/*.tsx` does not match `src/api/routes/users.ts`"). 100% task completion in Phase 3 testing.

### Demand-Reducing
- **Anxiety**: "Will the glob matching implementation match Claude Code's actual matching behavior? What if there are edge cases?" Glob pattern semantics documented in Research Finding 5.
- **Habit**: Avoiding path-scoped rules entirely. Users who have been burned default to unconditional rules (less precision, more reliability). Giving up specificity for predictability.

### Assessment
- Switch likelihood: **High** (strong push + clear pull)
- Key blocker: Anxiety about glob matching fidelity (must use same glob library as Claude Code or document differences)
- Key enabler: Push -- silent failure is the worst possible UX. Any diagnostic is better than none.
- Design implication: The Path Rule Tester must clearly show match/no-match with the specific pattern that failed and why. Must support the exact glob syntax that Claude Code uses (Research Finding 5: `**/*.ts`, `*.{ts,tsx}`).

---

## Forces Analysis: JS-05 (Verify Plugin Contributions)

### Demand-Generating
- **Push**: "When someone installs my plugin and says 'it's not working,' I have no diagnostic tool. I have to ask them to manually check 6 different files." Support overhead of ~5 hours/week for popular plugin authors. Naming conflicts between plugin and user agents detected only through user bug reports.
- **Pull**: Plugin inventory panel showing all contributed components with namespacing. Naming conflict detector highlighting collisions. "The name collision detection alone is worth it" (Phase 3 User 3).

### Demand-Reducing
- **Anxiety**: "Will this tool correctly parse my plugin's directory structure? What about plugins installed from different sources (npm, git, local)?" Plugin structure documented in Research Finding 9.
- **Habit**: Manual testing by installing plugins and inspecting each component individually. Plugin authors have built internal testing scripts. Users trust their existing (slow) verification process.

### Assessment
- Switch likelihood: **High** for plugin authors, **Medium** for plugin consumers
- Key blocker: Habit -- plugin authors have invested in custom testing workflows
- Key enabler: Push is very strong for popular plugin authors (support burden)
- Design implication: Plugin explosion in the graph view (click to expand all components) is the key interaction. Naming conflict detection must be visually prominent (red edges in graph). Show both plugin namespace (`my-plugin:skill-name`) and any user/project conflicts.

---

## Forces Analysis: JS-06 (Audit Team Config Compliance)

### Demand-Generating
- **Push**: Cannot audit what each developer's effective configuration actually is. Wiki maintenance (~2 hours/week), PR reviews for config changes (~3 hours/week), debugging configuration mismatches (~2 hours/week). Managed settings may be inadvertently overridden.
- **Pull**: Side-by-side view showing what personal configuration adds or overrides relative to project standard. Scope coloring immediately reveals user-scope dependencies in project configuration.

### Demand-Reducing
- **Anxiety**: "This would require access to each developer's `~/.claude/` directory, which is personal. Privacy concerns. Also, this tool runs on my machine -- I can only see my own user config."
- **Habit**: PR reviews and wiki documentation are established team processes. Team leads are comfortable with manual auditing.

### Assessment
- Switch likelihood: **Medium** (strong push but significant anxiety and habit barriers)
- Key blocker: Anxiety about privacy and access limitations (each instance only sees its own user config)
- Key enabler: Push is real but narrow (team leads only)
- Design implication: v2 feature. For v1, show the user's own effective config (project + user scopes combined). Team-wide auditing requires each developer running Config Explorer locally and sharing screenshots or exports.

---

## Forces Analysis: JS-07 (Discover Available Config Options)

### Demand-Generating
- **Push**: Opportunity cost -- newcomers avoid advanced features because "I don't understand how they all fit together." 600+ lines of documentation across multiple pages. Configuration features are individually documented but the whole system is not visualized.
- **Pull**: Missing file indicators showing what is available but not yet configured. Mind map showing all 8 subsystem branches with counts. "This is like a checklist of configuration I haven't explored yet" (Phase 3 User 4).

### Demand-Reducing
- **Anxiety**: "Am I ready for advanced configuration? Will adding agents/skills/hooks break my simple setup?" Newcomer hesitation to increase complexity.
- **Habit**: Reading documentation sequentially. Newcomers are in learning mode and may prefer structured docs over exploratory visualization.

### Assessment
- Switch likelihood: **Medium** (push is opportunity cost rather than acute pain)
- Key blocker: Habit -- documentation reading is the established learning pattern
- Key enabler: Pull -- visual discovery is more engaging than text documentation
- Design implication: Missing file indicators with descriptions and doc links. The mind map as educational tool (shows subsystem taxonomy at a glance). Do not replace documentation -- complement it with visual entry points.

---

## Forces Analysis: JS-08 (Search Across All Configuration)

### Demand-Generating
- **Push**: Custom CLI scripts to search configuration directories. `grep -r` across `~/.claude/` and `.claude/` requires knowing all the paths. Configuration scattered across 30+ locations in multiple formats (JSON, Markdown, YAML frontmatter).
- **Pull**: Single search box querying all configuration files with results showing scope, subsystem, and matching content.

### Demand-Reducing
- **Anxiety**: Minimal -- search is a familiar pattern.
- **Habit**: `grep -r` works for power users who know the directory structure.

### Assessment
- Switch likelihood: **Medium-High** (low anxiety, low habit resistance, moderate push)
- Key blocker: None significant
- Key enabler: Pull -- unified search is strictly better than multi-directory grep
- Design implication: Utility feature. Search results should navigate to the relevant view (click a search result opens that file in Config Atlas, or navigates to that node in Config Galaxy).

---

## Forces Summary

| Job | Push | Pull | Anxiety | Habit | Switch Likelihood |
|-----|------|------|---------|-------|-------------------|
| JS-01 | High (30+ locations) | High (navigable overview) | Low-Medium (accuracy) | Medium (ls/IDE) | High |
| JS-02 | Very High (black box) | Very High (100% value perception) | Medium (static vs. runtime) | Low-Medium (mental tracing) | Very High |
| JS-03 | High (manual spreadsheets) | Very High (zero competition) | Medium (graph complexity) | Medium (spreadsheets work) | High |
| JS-04 | Very High (silent failures) | High (instant diagnostics) | Medium (glob fidelity) | Low (avoidance as habit) | High |
| JS-05 | High (support burden) | High (conflict detection) | Low (structure documented) | Medium (manual testing) | High |
| JS-06 | Medium-High (team drift) | Medium (scope comparison) | High (privacy, access) | High (PR reviews) | Medium |
| JS-07 | Medium (opportunity cost) | Medium-High (discovery) | Medium (complexity fear) | Medium (docs reading) | Medium |
| JS-08 | Medium (grep workaround) | Medium-High (unified search) | Low | Low (grep works) | Medium-High |

### Key Design Implications from Forces Analysis

1. **Ship the Cascade first** -- JS-02 has the strongest push + pull combination and the highest validated value perception (100%).
2. **Graph needs subsystem filtering** -- JS-03 anxiety about complexity is real. Mind map as default, graph as deep-dive toggle.
3. **Path Rule Tester must show WHY** -- JS-04 push is strong because failures are silent. The diagnostic must show the specific pattern mismatch reason.
4. **Team auditing is v2** -- JS-06 has significant anxiety barriers (privacy) that cannot be resolved in v1 single-user architecture.
5. **Missing file indicators serve newcomers** -- JS-07 has moderate forces but missing file indicators are low-cost and high-educational-value.
