# Lean Canvas: Claude Config Explorer

**Feature ID**: config-explorer
**Phase**: 4 - Market Viability
**Date**: 2026-03-03
**Status**: VALIDATED -- recommend proceed to build

---

## Lean Canvas

### 1. Problem (Phase 1 Validated)

| # | Problem | Evidence Strength |
|---|---------|-------------------|
| CP1 | Configuration resolution opacity -- users cannot determine which configuration is active across 7 subsystems and 5 scopes | 7/7 signals confirmed. Direct extension of validated Norbert P3. |
| CP2 | Cross-reference blindness -- agents reference skills, plugins bundle components, hooks defined in 6 locations, no tool shows these relationships | 5/7 signals confirmed (framework devs, plugin authors, power users). Manual spreadsheets as workaround. |
| CP3 | Path-scoped rule opacity -- rules with glob patterns load silently or don't load, no diagnostic path | 3/7 signals confirmed (specific to rule-heavy users). 20-minute debugging sessions documented. |
| CP4 | Ecosystem comprehension barrier -- 7 subsystems, 5 scopes, 30+ file locations, multiple formats overwhelm new and intermediate users | 7/7 signals confirmed. 676-line research document IS the evidence. |

**Existing alternatives**: File explorer / `ls -R`, `grep -r` across config directories, manual README documentation, spreadsheets tracking agent-skill relationships, trial-and-error debugging, reading 600+ lines of official documentation across multiple pages.

### 2. Customer Segments (by JTBD)

| Segment | Job-to-be-Done | Size Estimate | Priority |
|---------|---------------|---------------|----------|
| **Multi-agent framework developers** | "Help me understand and debug the configuration relationships in my complex Claude Code setup" | ~2,000-5,000 developers | PRIMARY |
| **Claude Code power users (complex config)** | "Help me see what configuration is active and why" | ~15,000-30,000 developers | PRIMARY |
| **Plugin authors** | "Help me verify what my plugin contributes and detect conflicts" | ~1,000-3,000 developers | SECONDARY |
| **Team leads / DevEx** | "Help me audit and standardize team Claude Code configuration" | ~5,000-10,000 leads | TERTIARY (v2) |
| **Claude Code newcomers** | "Help me understand what configuration is possible and how it fits together" | ~100,000+ developers | ASPIRATIONAL (highest volume, lowest per-user value) |

**Segment sizing rationale**:
- Claude Code has an estimated 500,000+ active users (early 2026)
- Approximately 5-10% use complex configurations (3+ subsystems, 5+ config files) = 25,000-50,000
- Of those, approximately 30-50% experience sufficient pain to seek tooling = ~10,000-25,000
- Plugin authoring is emerging -- growing with the Plugin marketplace launch
- Newcomer segment is large but has the weakest per-user pain (they don't yet know what they're missing)

**Key insight**: Config Explorer has a **broader but shallower** market than Norbert's core runtime observatory. More users have configuration than run multi-agent workflows. But the pain per user is lower -- configuration confusion is annoying, not costly like token waste. The feature works best as a **stickiness amplifier** for existing Norbert users, not a standalone acquisition driver.

### 3. Unique Value Proposition

**Single clear message**:

> **See your Claude Code configuration as a living map. Navigate every file. Trace every relationship. Understand every override.**

**Supporting statement**: Config Explorer is the first tool that visualizes the complete .claude configuration ecosystem -- 7 subsystems, 5 scopes, all relationships and precedence rules -- as an interactive graph, mind map, and cascade waterfall. Stop swimming through folders and text files. See the whole picture.

**Why "living map" framing**: The configuration ecosystem is a complex, layered, cross-referenced structure. Users currently hold it in their heads (framework developers) or don't understand it at all (newcomers). A "living map" conveys: dynamic, navigable, comprehensive, and always current.

**Relationship to Norbert UVP**: Norbert's core UVP is "See inside your agentic workflows." Config Explorer extends this to "See inside your agentic configuration." Together: Norbert shows what happened at runtime; Config Explorer shows what was configured when it happened. The observatory metaphor extends naturally: an observatory observes both the sky (runtime) and its own instruments (configuration).

### 4. Solution (Phase 3 Validated)

| Feature | Addresses | Validated |
|---------|-----------|-----------|
| Configuration Anatomy (Atlas) | CP4: Ecosystem comprehension | 100% task completion. Entry point / landing page. |
| Configuration Mind Map | CP4 + CP2: Structure overview and relationships | 100% task completion. Best for newcomers and overview. |
| Configuration Relationship Graph (Galaxy) | CP2: Cross-reference blindness | 100% task completion. Best for experts and complex configs. |
| Precedence Cascade (Waterfall) | CP1: Resolution opacity | 100% task completion, **100% value perception** (highest of all concepts). |
| Path Rule Tester | CP3: Path-scoped rule opacity | 100% task completion. Diagnostic tool for rule debugging. |
| Full-Text Configuration Search | CP1 + CP2: Find where things are defined | Utility feature. Supports all primary features. |

**Architecture summary**:
```
~/.claude/ + .claude/ (filesystem)
  --> File Discovery & Parse (Markdown, JSON, YAML frontmatter)
  --> Configuration Model (nodes, edges, scopes, precedence)
  --> Svelte 5 UI Components
       |-- Anatomy View (tree + content preview)
       |-- Mind Map (D3.js tree layout)
       |-- Relationship Graph (D3.js force simulation)
       |-- Precedence Cascade (Svelte component)
       |-- Path Rule Tester (glob match engine)
       |-- Search (full-text index)
```

**Integration with Norbert core**:
- New "Config" tab in existing Norbert dashboard (Svelte 5 SPA)
- Shares Fastify server, served from same localhost
- Optional runtime correlation: link to Norbert's hook-captured session data
- Shares design system (colors, typography, layout patterns)

### 5. Channels

| Channel | Viability | Cost | Rationale |
|---------|-----------|------|-----------|
| **Existing Norbert users** | HIGH | $0 | Config Explorer ships as part of Norbert. Existing users discover it via new tab. Zero acquisition cost. |
| **Claude Code community / Discord** | HIGH | $0 | "I built a visual map of the .claude ecosystem" is highly shareable content. |
| **GitHub / npm (Norbert distribution)** | HIGH | $0 | Config Explorer increases Norbert's value proposition, driving more installs. |
| **Dev tool content** | HIGH | Low | Tutorials: "Visualize your Claude Code configuration," "Debug path-scoped rules visually." Screenshots of the graph are inherently shareable. |
| **Claude Code official docs / plugins page** | MEDIUM | Unknown | If Anthropic links to ecosystem tools, Config Explorer is a natural recommendation. |

**Primary channel strategy**: Config Explorer is a **feature of Norbert**, not a standalone product. Its primary channel is the existing Norbert install base + the organic growth of Norbert itself. Secondarily, the visual nature of Config Explorer (graphs, mind maps, cascade waterfalls) produces screenshots that are inherently shareable -- this drives organic social sharing.

### 6. Revenue Streams

Config Explorer is a **feature of Norbert**, not a separately monetized product. Its revenue contribution is indirect:

| Contribution | Mechanism | Estimated Impact |
|-------------|-----------|-----------------|
| **Increased free-to-paid conversion** | Config Explorer makes Norbert more valuable, pushing more users past the free tier limits | +2-5% conversion uplift |
| **Reduced churn** | Config Explorer is used between debugging sessions (new usage pattern), making Norbert stickier | -5-10% monthly churn reduction |
| **Broader acquisition** | Config Explorer appeals to users who don't yet run multi-agent workflows but have complex configurations | +10-20% wider top-of-funnel |
| **Pro tier feature potential** | Advanced features (team config audit, config diff over time, export) can be Pro-tier gated | Direct Pro revenue |

**Revenue impact estimate (conservative)**:
- If Config Explorer increases Norbert's conversion rate from 10% to 12% and reduces churn by 5%:
  - Year 1 incremental ARR: ~$15,000-25,000 (from Norbert's projected $114K base)
  - Year 2 incremental ARR: ~$50,000-80,000 (from Norbert's projected $576K base)

### 7. Cost Structure

| Cost Category | Estimate | Notes |
|---------------|----------|-------|
| Development (initial) | 3-5 weeks engineering | D3.js graphs, Svelte 5 components, file parser. Fits within existing Norbert dev cadence. |
| Ongoing maintenance | ~5% of Norbert dev effort | Config ecosystem changes infrequently. Main cost: tracking Anthropic's config format changes. |
| Infrastructure | $0 incremental | Runs on existing Norbert localhost server. No cloud component. |
| Dependencies | D3.js (already in Norbert stack), glob matching library | Minimal new dependencies. |

**Key cost insight**: Config Explorer is a **low-cost, high-leverage** feature. It uses Norbert's existing tech stack (Svelte 5, D3.js, Fastify), runs on the same localhost server, and requires no new infrastructure. The primary cost is engineering time for the file parser and visualization components.

### 8. Key Metrics

| Metric | What It Measures | Target |
|--------|-----------------|--------|
| Config tab visits per week | Feature engagement | >20% of Norbert WAU visit Config tab |
| Time spent in Config Explorer | Depth of engagement | >2 minutes average per visit |
| Graph/mind map interactions | Visualization value | >5 node interactions per visit |
| Cascade drill-downs | Debugging value | >1 cascade view per visit among users with multi-scope config |
| Config Explorer as Norbert entry point | Acquisition pathway | >10% of new users arrive via Config Explorer content |
| Feature retention | Stickiness impact | Config Explorer users retain at 2x rate vs. non-users |

### 9. Unfair Advantage

| Advantage | Defensibility |
|-----------|--------------|
| **Deep understanding of .claude ecosystem architecture** | Built from 12-source, 676-line research document covering all 7 subsystems and 5 scopes. Competitors would need equivalent research depth. |
| **Integrated with Norbert runtime observatory** | Config Explorer + runtime observability = complete picture. Competitors building only config visualization miss the runtime correlation. |
| **First mover in .claude visualization** | Zero tools exist for visualizing Claude Code configuration relationships. First to market with graph, mind map, and cascade views. |
| **D3.js + Svelte 5 already in stack** | No new technology adoption required. Existing skill set applies directly. Development cost is low. |
| **Research-documented precedence rules** | The precedence resolution logic is documented from official sources. Accuracy advantage over tools guessing at resolution order. |

**What is NOT an unfair advantage**: File browsing (any file explorer does this), JSON parsing (commodity), tree views (standard UI pattern). The advantage is in the specific combination of: relationship graph + precedence cascade + path rule tester + scope-aware visualization, built with deep knowledge of the .claude ecosystem architecture.

---

## Four Big Risks Assessment

### Risk 1: Value -- Will customers want this?

| Factor | Assessment | Evidence |
|--------|-----------|----------|
| Problem exists | CONFIRMED | Phase 1: 7/7 signals, 100% confirmation. Structural complexity is factual and measurable. |
| Solution resonates | CONFIRMED | Phase 3: 80-100% "would use" across concepts. Cascade achieved 100%. |
| Differentiation | CONFIRMED | Zero tools exist for .claude configuration visualization. |
| Frequency of use | PROBABLE | Phase 3 identified "between sessions" usage pattern. Estimated weekly+ for complex configs. |

**Value Risk: GREEN** -- Strong evidence that the problem is real and the solution resonates. The "between sessions" usage pattern extends Norbert's value beyond debugging into ongoing configuration management.

**Nuance**: Config Explorer has broader but shallower pain than Norbert's core runtime observatory. It will not drive adoption as strongly as token cost visibility or agent tracing. Its primary value is as a stickiness amplifier and acquisition broadener.

### Risk 2: Usability -- Can customers use this?

| Factor | Assessment | Evidence |
|--------|-----------|----------|
| Comprehension | CONFIRMED | Phase 3: 80-100% comprehension across all concepts. Mind map and cascade achieved 100%. |
| Task completion | CONFIRMED | Phase 3: 100% task completion across all 4 concepts. |
| Mental model transfer | CONFIRMED | Strong analogies: CSS DevTools (cascade), npm dependency graph, VS Code file explorer |
| Visualization complexity | MEDIUM RISK | Force-directed graph may overwhelm for very complex configs (50+ nodes). Mitigated by subsystem filtering and mind map alternative. |

**Usability Risk: GREEN** -- All concepts validated with high comprehension and task completion. The multi-view approach (mind map for overview, graph for deep-dive, cascade for debugging) means users can choose the view that matches their need and complexity level.

### Risk 3: Feasibility -- Can we build this?

| Factor | Assessment | Evidence | Risk Level |
|--------|-----------|----------|------------|
| File system access | LOW RISK | `~/.claude/` and `.claude/` are standard user-readable directories. Node.js `fs` module is sufficient. | GREEN |
| Configuration parsing | LOW RISK | JSON (settings, MCP, plugins) and Markdown with YAML frontmatter (rules, skills, agents) are standard formats. Libraries exist. | GREEN |
| Precedence derivation | MEDIUM RISK | Research documents deterministic rules. Edge cases: on-demand CLAUDE.md loading, dynamic skill invocation, `claudeMdExcludes`. Static analysis covers ~90%. | YELLOW |
| D3.js graph visualization | LOW RISK | Force-directed graphs and tree layouts are well-documented D3.js patterns. Already in Norbert tech stack. | GREEN |
| Cross-platform paths | LOW RISK | `~/.claude/` resolves correctly on macOS/Linux. Windows uses `%USERPROFILE%\.claude\`. Node.js `os.homedir()` handles this. | GREEN |
| Managed settings access | MEDIUM RISK | Platform-specific paths may require elevated permissions. Graceful degradation if unreadable. | YELLOW |
| Performance (large configs) | LOW RISK | Even complex configs have <100 nodes. D3.js handles 100s of nodes easily. File parsing is milliseconds. | GREEN |

**Feasibility Risk: GREEN** -- This is primarily a file parsing + visualization feature. All technologies are proven and already in Norbert's stack. The only YELLOW risk is precedence derivation edge cases and managed settings access, both of which can gracefully degrade.

**Comparison to Norbert core feasibility**: Config Explorer has significantly lower feasibility risk than Norbert's runtime observatory. There is no dependency on Claude Code hooks, no real-time data capture, no hook API stability concerns. This is pure filesystem analysis + visualization.

### Risk 4: Viability -- Does the business model work?

| Factor | Assessment | Evidence |
|--------|-----------|----------|
| Development cost | LOW | 3-5 weeks engineering using existing tech stack. No new infrastructure. |
| Maintenance cost | LOW | .claude ecosystem changes infrequently. Main maintenance: tracking config format changes. |
| Revenue contribution | INDIRECT | Stickiness amplifier + acquisition broadener + Pro tier feature candidate. |
| Strategic fit | HIGH | Extends Norbert from "runtime observatory" to "configuration observatory." Natural evolution. |
| Market timing | GOOD | .claude ecosystem is actively growing (plugins launched recently, skills replaced commands). Configuration complexity is increasing. |
| Competitive risk | LOW | Anthropic building a native visual config explorer is unlikely -- they focus on CLI and core model. If they build a simpler version (`/config` command), Norbert's visualization depth remains differentiated. |

**Viability Risk: GREEN** -- Low cost, strategic fit, indirect but real revenue contribution. This is a feature that makes Norbert more valuable as a product, not a standalone business case. The investment is small relative to the strategic benefit.

### Risk Summary

| Risk | Status | Key Issue | Mitigation |
|------|--------|-----------|------------|
| Value | GREEN | Broader but shallower pain than core Norbert | Position as stickiness amplifier, not standalone |
| Usability | GREEN | Graph complexity for large configs | Multi-view approach (mind map + graph + cascade) |
| Feasibility | GREEN | Precedence edge cases, managed settings access | Graceful degradation, ~90% static accuracy |
| Viability | GREEN | Indirect revenue contribution | Low development cost justifies indirect returns |

**All 4 risks: GREEN. Proceed.**

---

## Go-to-Market Strategy

### Phase 0: Configuration Parser Spike (Week 1)
- Build the configuration file discovery and parsing pipeline
- Parse `~/.claude/` and `.claude/` directories for all 7 subsystems
- Extract cross-references from YAML frontmatter (agent->skill, plugin->components)
- Implement precedence resolution logic from research document (Finding 12)
- Validate CA9 (precedence derivability) with real-world config directories
- Confirm: parse accuracy, cross-reference extraction completeness, edge case handling

### Phase 1: MVP Launch (Week 2-4)
- **Configuration Anatomy View**: Navigable tree with scope coloring, content preview, missing file indicators
- **Configuration Mind Map**: D3.js tree layout with subsystem branches, scope coloring, expand/collapse
- **Precedence Cascade**: Per-subsystem resolution waterfall with effective value highlighting
- **Path Rule Tester**: File path input with matching rule display
- Shipped as new "Config" tab in existing Norbert dashboard
- Target: 30% of existing Norbert WAU visit Config tab within first 2 weeks

### Phase 2: Relationship Graph (Week 5-7)
- **Configuration Relationship Graph**: Force-directed graph with cross-reference edges, plugin explosion, subsystem filtering
- **Full-text search** across all config files
- **Plugin contribution viewer** with naming conflict detection
- Launch content: "Visualize your Claude Code configuration as an interactive graph"
- Target: Config tab engagement increases to 40%+ of Norbert WAU

### Phase 3: Runtime Integration (Week 8-10)
- Link Config Explorer to Norbert's hook-captured session data
- "Show me what configuration was active during this session" drill-through
- Configuration change detection (file watcher for live updates)
- Export graph/mind map as SVG/PNG for documentation
- Target: Config Explorer users retain at 2x rate vs. non-users

### Phase 4: Pro Features (Week 11+)
- Team configuration audit (compare effective configs across developers)
- Configuration diff over time (git-aware: how config changed between commits)
- Configuration health check / linting (unused rules, orphaned skills)
- Pro tier gating for advanced features

---

## Gate G4 Evaluation

| G4 Criterion | Threshold | Result | Verdict |
|-------------|-----------|--------|---------|
| Four big risks | All green/yellow | Value: GREEN, Usability: GREEN, Feasibility: GREEN, Viability: GREEN | PASS |
| Lean Canvas complete | All 9 boxes | Complete with evidence backing | PASS |
| Channel validated | 1+ viable | Existing Norbert install base + community + content (3+ viable) | PASS |
| Unit economics | LTV > 3x CAC | Zero incremental acquisition cost (ships as Norbert feature). Infinite LTV/CAC for this feature. | PASS |
| Stakeholder sign-off | Required | Founder alignment pending | CONDITIONAL |

**G4 Decision: PROCEED to Build (conditional on config parser spike confirming precedence derivability)**

---

## Go / No-Go Recommendation

### GO -- with conditions

**Recommendation**: Proceed to build. Config Explorer is a low-cost, high-leverage feature that extends Norbert's value proposition from runtime observatory to configuration observatory. All four risks are GREEN. Development uses existing tech stack with no new infrastructure. The feature broadens Norbert's appeal to users who have complex configurations but may not yet run multi-agent workflows.

**Conditions**:
1. **Config parser spike first** (1 week): Validate that filesystem parsing + YAML frontmatter extraction + precedence resolution logic produces accurate results for real-world `.claude/` directories. If parsing accuracy is below 85%, reassess scope.
2. **Ship as part of Norbert, not standalone**: Config Explorer's value is amplified by integration with Norbert's runtime observatory. Do not build or market it as a separate product.
3. **MVP is Anatomy + Mind Map + Cascade** (3 weeks): The relationship graph (force-directed) is the highest-differentiation feature but also the most complex to build. Ship the anatomy view, mind map, and cascade waterfall first. Add the relationship graph in Phase 2.
4. **Monitor Anthropic's config tooling roadmap**: If Anthropic ships a `/config` command or visual configuration viewer, accelerate differentiation features (relationship graph, runtime correlation) that go beyond what a CLI command can show.

**Kill criteria**:
- Config parser spike reveals that precedence rules are non-deterministic or require running Claude Code to resolve (below 85% static accuracy)
- After 4 weeks in production, fewer than 15% of Norbert WAU visit the Config tab (insufficient interest)
- Anthropic ships a comprehensive configuration viewer that covers 80%+ of Config Explorer's value

---

## Discovery Summary

| Phase | Status | Key Finding |
|-------|--------|-------------|
| 1: Problem | VALIDATED | 7/7 signals confirm configuration complexity is a real, growing pain. 7 subsystems, 5 scopes, 30+ file locations. Extends validated Norbert P3. |
| 2: Opportunity | VALIDATED | 8 opportunities identified. Top scores: 17 (Precedence Resolution, Cross-Reference Mapping). Strong differentiation at top of tree. |
| 3: Solution | VALIDATED | 4 concepts tested, all passing. Multi-view architecture: Anatomy + Mind Map + Graph + Cascade. Cascade achieved 100% value perception. |
| 4: Viability | VALIDATED (conditional) | All risks GREEN. Low development cost (3-5 weeks). Strategic fit as Norbert stickiness amplifier. Zero competition for .claude visualization. |

**The single most important insight from this discovery**: Config Explorer's highest-value feature is the **Precedence Cascade** (100% value perception), not the relationship graph. The cascade answers the question every user has: "what is actually active and why?" The relationship graph is the highest-differentiation feature, but the cascade is the highest-utility feature. Ship the cascade first, graph second.

**The strategic insight**: Config Explorer transforms Norbert from a tool you open "when something goes wrong" (debugging) to a tool you open "to understand your setup" (orientation). This creates a new usage pattern -- between-session engagement -- that makes Norbert stickier and justifies the development investment even with indirect revenue contribution.
