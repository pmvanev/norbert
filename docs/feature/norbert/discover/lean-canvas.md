# Lean Canvas: Norbert

**Feature ID**: norbert
**Phase**: 4 - Market Viability
**Date**: 2026-03-02
**Status**: VALIDATED -- recommend proceed to build

---

## Lean Canvas

### 1. Problem (Phase 1 Validated -- Updated 2026-03-02)

| # | Problem | Evidence Strength |
|---|---------|-------------------|
| P1 | Token/cost opacity -- users cannot attribute AI costs to specific tasks, agents, or MCP servers | 7/7 signals confirmed |
| P2 | Agent execution blindness -- no visibility into multi-agent workflow behavior | 7/7 signals confirmed |
| P3 | Context file resolution mystery -- users cannot see which CLAUDE.md configurations are active | 4/7 signals confirmed (power users) |
| P6 | **MCP observability gap** -- zero visibility into MCP server connectivity, tool routing, token overhead, and failure states | 7/7 signals + 28-source research confirmed. Silent failures, 67K+ token overhead, routing opacity, ghost tools, config chaos. |

**Existing alternatives**: Manual log grepping, custom bash scripts, Anthropic billing dashboard (aggregated only), community-built partial tools (fragmented, unmaintained), `/mcp` command (snapshot only, no history/metrics), `~/.claude/logs/mcp-debug.log` (unstructured, not user-friendly), MCP Inspector (dev-time, single-server only).

### 2. Customer Segments (by JTBD)

| Segment | Job-to-be-Done | Size Estimate | Priority |
|---------|---------------|---------------|----------|
| **Multi-agent power users** | "Help me understand and optimize my complex Claude Code workflows" | ~15,000-40,000 developers | PRIMARY |
| **Framework developers** | "Help me debug and validate my agent orchestration framework" | ~2,000-5,000 developers | SECONDARY |
| **Team leads / DevEx** | "Help me manage and optimize my team's AI tooling investment" | ~5,000-15,000 leads | TERTIARY (v2) |

**Segment sizing rationale**:
- Claude Code has an estimated 500,000+ active users (based on Anthropic growth trajectory and API usage data as of early 2026)
- Approximately 10-15% are "power users" who regularly use multi-agent patterns (50,000-75,000)
- Of those, approximately 30-50% experience sufficient pain to seek tooling (15,000-40,000)
- Framework developers are a smaller but extremely high-value segment
- Team segment requires multi-user features (defer to v2)

### 3. Unique Value Proposition (Updated 2026-03-02)

**Single clear message**:

> **See inside your agentic workflows. Trace every agent. Monitor every MCP server. Know every token.**

**Supporting statement**: Norbert is the observatory for Claude Code -- the first tool purpose-built to make multi-agent workflows and MCP server interactions visible, debuggable, and cost-optimized. It spans both agent observability and MCP observability in a single local-first dashboard.

**Why "observatory" framing**: Users' primary need is observation, not control. The validated insight from Phase 3 is that seeing what happened is 4x more valuable than steering what happens. "Observatory" positions Norbert correctly and avoids over-promising on orchestration.

**Why MCP observability is P0**: MCP research (28 sources, 14 findings) confirmed a complete competitive vacuum at Norbert's tier. Zero tools exist for local-first, Claude Code-specific MCP observability. Enterprise solutions (Datadog, Grafana) operate at the wrong abstraction level. MCP Inspector serves server authors, not end users. Norbert fills a genuine, documented gap.

### 4. Solution (Phase 3 Validated -- Updated 2026-03-02)

**Pillar 1: Agent Observability**

| Feature | Addresses | Validated |
|---------|-----------|-----------|
| Execution Trace Graph (DAG visualization) | P2: Agent execution blindness | 100% task completion |
| Token Cost Waterfall (per-agent attribution) | P1: Token/cost opacity | 100% task completion, first thing users check |
| Session History (searchable archive) | P1 + P2: Historical analysis | 100% task completion |
| Context Inspector (CLAUDE.md resolution viewer) | P3: Context resolution mystery | 100% for target users |
| CLI Quick Queries (terminal-friendly summaries) | P1 + P2: Quick lookups | Complementary to dashboard |

**Pillar 2: MCP Observability (P0 -- New)**

| Feature | Addresses | Validated |
|---------|-----------|-----------|
| MCP Server Health Dashboard (connectivity, uptime, alerts) | P6: MCP silent failures | 100% task completion (Concept D) |
| MCP Tool Call Routing Explorer (server attribution) | P6: MCP routing opacity | 100% task completion (Concept D) |
| MCP Token Overhead Analyzer (per-server token cost) | P1 + P6: MCP token overhead | 100% task completion (Concept D) |
| MCP Error Timeline (chronological failure view) | P6: MCP diagnostics gap | 100% task completion (Concept D) |
| Norbert-as-MCP-server (in-conversation queries) | P2 + P6: Seamless observability | High value for power users (Phase 2) |

**Data Capture Architecture** (Validated by MCP research Finding 9):
```
Claude Code Hooks --> HTTP POST --> Norbert Server --> SQLite --> Dashboard (WebSocket)
                                                              --> MCP Server (query tools)
                                                              --> CLI (direct SQLite reads)
```

### 5. Channels

| Channel | Viability | Cost | Rationale |
|---------|-----------|------|-----------|
| **Claude Code community / Discord** | HIGH | $0 | Direct access to target users. Word-of-mouth in tight community. |
| **GitHub / npm distribution** | HIGH | $0 | Developer tools live here. Open source core enables discovery. |
| **Dev tool content (blog, Twitter/X)** | HIGH | Low | Claude Code power users are active content consumers. Topics like "How I saved $500/mo on Claude Code" are highly shareable. |
| **Anthropic marketplace / partner** | MEDIUM | Unknown | If Anthropic supports third-party integrations, this is the highest-leverage channel. Dependency risk. |
| **Hacker News / Product Hunt** | MEDIUM | $0 | Good for launch spike. Developer tools do well here. |
| **Conference talks (AI Eng, DevTools)** | LOW-MEDIUM | Travel | Longer-term brand building. |

**Primary channel strategy**: Open source core on GitHub + content marketing ("I built an observatory for Claude Code") + community seeding in Claude Code Discord/forums. This matches developer tool adoption patterns: developers discover tools through peers, content, and package managers, not ads.

### 6. Revenue Streams

| Model | Description | Estimated Price | Confidence |
|-------|-------------|----------------|------------|
| **Open Source Core + Paid Pro** | Free: local dashboard, 30-day history, single user. Pro: unlimited history, team features, advanced analytics, export. | $19-29/mo individual, $49-99/mo team | MEDIUM |
| **Usage-based (sessions tracked)** | Free tier: 100 sessions/mo. Paid: unlimited. | $0.01-0.05/session | LOW |
| **Enterprise license** | Self-hosted, SSO, audit logs, team management | $500-2,000/mo per team | LOW (v2+) |

**Recommended model**: Open Source Core + Paid Pro (freemium). Rationale:
- Developer tools require trust before purchase -- open source builds trust
- Free tier drives adoption and community contributions
- Pro tier monetizes power users who already spend $100+/mo on Claude Code (price anchoring: Norbert is 10-20% of their Claude Code spend)
- Team/enterprise is a v2 play after individual adoption proves out

**Revenue projections (conservative)**:
- Year 1: 5,000 free users, 500 paid ($19/mo) = ~$114,000 ARR
- Year 2: 20,000 free users, 2,000 paid ($24/mo avg) = ~$576,000 ARR
- Year 3: 50,000 free users, 5,000 paid + 100 teams ($49/mo) = ~$2M ARR

### 7. Cost Structure

| Cost Category | Estimate | Notes |
|---------------|----------|-------|
| Development (founder + 1 contributor) | $0-150,000/yr | Bootstrap or funded |
| Infrastructure (if any cloud component) | $500-2,000/mo | Minimal -- tool is primarily local |
| Distribution (GitHub, npm) | $0 | |
| Content marketing | $0-500/mo | Blog, social, community |
| Cloud dashboard (team features, v2) | $2,000-10,000/mo | Scaled with paid users |

**Key insight**: Because Norbert runs locally (localhost dashboard), infrastructure costs are near zero for the free tier. Users host their own compute. This is a highly capital-efficient model.

### 8. Key Metrics

| Metric | What It Measures | Target |
|--------|-----------------|--------|
| Weekly active dashboards | Engagement / stickiness | >30% of installs |
| Sessions traced per user per week | Usage depth | >10 sessions/user/week |
| Free to paid conversion | Monetization | >10% within 90 days |
| Time to first insight | Activation quality | <5 minutes from install |
| NPS / recommendation rate | Product-market fit | >50 NPS |
| Token savings attributed | Value delivered | >$50/mo per user |

### 9. Unfair Advantage (Updated 2026-03-02)

| Advantage | Defensibility |
|-----------|--------------|
| **Deep Claude Code architecture knowledge** | Built by people who understand CLAUDE.md resolution, Task tool patterns, MCP integration, and hook-based data capture. Competitors would need to reverse-engineer. |
| **nwave-ai framework integration** | Norbert can integrate deeply with nwave-ai's multi-agent patterns. First-mover advantage within this ecosystem. |
| **Community-driven development** | Open source core means community contributes integrations, bug reports, and features. Network effects. |
| **Context Inspector has zero competition** | No other tool solves CLAUDE.md resolution visibility. This is a unique capability. |
| **MCP Observatory occupies a complete competitive vacuum** | MCP research (28 sources) confirms zero tools exist at Norbert's tier for Claude Code-specific MCP observability. Enterprise tools serve DevOps teams. MCP Inspector serves server authors. Norbert is the only local-first, user-facing MCP observatory. |
| **Dual-pillar observation (agent + MCP) in single tool** | No competitor combines agent workflow observability with MCP connectivity visualization. Closest tools address one or the other, never both. |

**What is NOT an unfair advantage**: Being first to market (easily copied), having a dashboard (commodity), token counting (many tools do this). The advantage is in the specificity of the Claude Code integration, the depth of the agent-level abstraction, and the unique combination of agent + MCP observability in a single local-first tool.

---

## Four Big Risks Assessment

### Risk 1: Value -- Will customers want this?

| Factor | Assessment | Evidence |
|--------|-----------|----------|
| Problem exists | CONFIRMED | Phase 1: 6/6 signals, 100% confirmation |
| Solution resonates | CONFIRMED | Phase 3: 80% "would use", 100% task completion |
| Willingness to pay | PROBABLE | Inferred from: users already spend $100+/mo on Claude Code, existing willingness to pay for dev tools, LLM observability market has paying customers |
| Frequency of use | CONFIRMED | Daily for power users, multiple times/week for moderate |

**Value Risk: GREEN** -- Strong evidence that users want this. Willingness to pay is the remaining sub-risk, addressable with freemium model.

### Risk 2: Usability -- Can customers use this?

| Factor | Assessment | Evidence |
|--------|-----------|----------|
| Comprehension | CONFIRMED | Phase 3: "Chrome DevTools for agents" analogy emerged spontaneously |
| Task completion | CONFIRMED | Phase 3: >80% across all user types |
| Installation friction | MEDIUM RISK | Developer tools have high install-drop-off. Must be `npm install -g norbert && norbert serve` simple. |
| Learning curve | LOW RISK | Familiar patterns (DAG, timeline, cost table) |

**Usability Risk: GREEN** -- Concept maps to known mental models. Installation simplicity is the key sub-risk.

### Risk 3: Feasibility -- Can we build this? (Updated 2026-03-02)

| Factor | Assessment | Evidence | Risk Level |
|--------|-----------|----------|------------|
| Data access | ~~HIGH RISK~~ **MEDIUM RISK** | MCP research Finding 9 proves Claude Code hooks capture both agent events AND MCP-specific data (server name, tool name, inputs, outputs, errors). disler project + 3 forks demonstrate working implementation. | ~~RED~~ **YELLOW** |
| Token counting accuracy | MEDIUM RISK | Can estimate via tiktoken or track from API responses if accessible. MCP tool description tokens can be measured precisely (known strings). | YELLOW |
| Real-time capability | ~~MEDIUM RISK~~ **LOW RISK** | Hooks fire on each event, enabling near-real-time dashboard updates via WebSocket. disler project demonstrates this working pattern. | ~~YELLOW~~ **GREEN** |
| DAG visualization | LOW RISK | Well-understood tech (D3.js, Mermaid, Cytoscape). Many open source libraries available. | GREEN |
| Local web server | LOW RISK | Standard Node.js/Python web server. Proven pattern (Vite, Storybook, etc.). | GREEN |
| Session storage | LOW RISK | SQLite is sufficient. Well-understood, zero-config. Aligns with disler project's architecture. | GREEN |
| MCP server isolation | LOW RISK | MCP research Finding 12 confirms Norbert-as-MCP-server cannot observe other servers directly. Hooks bypass this limitation -- they operate outside MCP isolation boundary. | GREEN |
| Hook API stability | MEDIUM RISK | Knowledge Gap 1 from research: official hook API specification not fully documented. Community projects rely on discovered behavior. | YELLOW |

**Feasibility Risk: YELLOW (improved from trending-RED -- data access de-risked)**

MCP research significantly improved the feasibility assessment. The key change: **Claude Code hooks are now the recommended primary data capture mechanism**, replacing the previous uncertainty about data access options.

**Data Access Deep Dive (Assumption A3) -- Updated 2026-03-02**:

*~~Option A: Log file parsing~~ --> DEMOTED to fallback*
- Still feasible for post-hoc analysis but inferior to hooks
- Hooks provide richer, real-time data with MCP-specific fields

*Option B: MCP Server integration --> VALIDATED as query interface (not data capture)*
- MCP research Finding 12 confirms Norbert-as-MCP-server is feasible
- Cannot observe other MCP servers (isolation) but can serve queries from local data store
- Use case: in-conversation queries, not data collection

*~~Option C: CLI wrapper/proxy~~ --> REJECTED*
- Hooks provide the same data with better UX and no fragility

*Option D: Anthropic partnership / official API --> STILL DESIRED but not required*
- Hooks provide sufficient data for MVP without Anthropic cooperation
- Partnership would improve stability guarantees and data richness

***Option E: Claude Code Hooks --> NEW PRIMARY APPROACH (validated by research)***
- disler/claude-code-hooks-multi-agent-observability proves hooks capture:
  - Agent lifecycle events (12 hook types including PreToolUse, PostToolUse, PostToolUseFailure)
  - MCP-specific fields: `mcp_server`, `mcp_tool_name`
  - Tool call inputs, outputs, errors
- Architecture: Claude Agents --> Hook Scripts --> HTTP POST --> Server --> SQLite --> WebSocket --> UI
- Multiple independent forks validate the approach
- **This resolves the highest feasibility risk and moves data access from RED to YELLOW**
- Remaining YELLOW risk: hook API stability -- Anthropic has not published formal stability guarantees

**Recommended approach (updated)**: Start with Option E (hooks) for MVP, add Option B (MCP server) for in-conversation queries in Phase 2, and pursue Option D (partnership) in parallel for long-term stability.

**Feasibility Risk: YELLOW** -- Significantly improved. Hook-based data capture is proven and working. Remaining risks are hook API stability (Anthropic could change hook behavior) and token counting precision (estimation vs. exact).

### Risk 4: Viability -- Does the business model work?

| Factor | Assessment | Evidence |
|--------|-----------|----------|
| Market size | SUFFICIENT | 15,000-40,000 addressable users, growing with Claude Code adoption |
| Revenue model | VIABLE | Freemium with $19-29/mo Pro tier. Conservative $114K ARR Y1. |
| Unit economics | FAVORABLE | Near-zero marginal cost (local tool). LTV/CAC > 3x achievable with organic/content channels. |
| Competitive moat | MEDIUM | Claude Code specificity is a moat but also a ceiling. Anthropic's own moves are the wildcard. |
| Market timing | GOOD | Multi-agent adoption is accelerating. Observability need grows with complexity. 2026 is the right time. |

**Competitive landscape (Updated 2026-03-02 with MCP research)**:

| Competitor | Overlap | Differentiation | MCP Observability |
|-----------|---------|-----------------|-------------------|
| LangSmith (LangChain) | LLM tracing | LangChain-specific, not Claude Code native | None |
| Langfuse | LLM observability | API-level, not agent-level. No Claude Code integration. | None |
| Helicone | LLM cost tracking | API proxy model. No agent topology. No context inspection. | None |
| Braintrust | LLM evaluation | Focused on eval/testing, not runtime observability | None |
| Datadog LLM Obs | Enterprise LLM monitoring | Enterprise-grade, expensive, no Claude Code specificity | Yes -- but infrastructure-level, requires SDK instrumentation |
| Grafana Cloud | Enterprise MCP observability | Cloud-based, requires OTel setup, enterprise pricing | Yes -- but enterprise tier, not individual developer |
| Anthropic Console | Token usage | Billing-level only. No per-task, no agent tracing. | None |
| MCP Inspector | MCP server testing | Dev-time, single-server, not runtime monitoring | Dev-time only -- not user-facing runtime observability |
| MCPcat | MCP server analytics | Server-author analytics, not user-facing | Server-author side only -- opposite perspective from Norbert |
| MetaMCP | MCP aggregation | Docker-deployed, multi-tenant infrastructure | File logging only -- no structured observability layer |
| MCP Gateways (MintMCP, etc.) | Enterprise MCP management | SOC2, audit logs, rate limiting -- enterprise security tier | Enterprise compliance -- not individual developer observability |
| disler hooks project | Agent + MCP events | Individual developer project, narrow scope, basic UI | Partial -- captures data but minimal visualization |

**Key competitive insight (updated)**: Norbert uniquely combines agent-level workflow observability with MCP server observability in a single local-first tool designed for individual Claude Code developers. No competitor addresses both dimensions. The MCP observability gap is particularly stark -- the competitive landscape map shows zero tools at Norbert's tier (local-first, Claude Code-specific) serving MCP user-facing observability.

**Anthropic Risk (A8) Assessment**:
- Anthropic WILL likely build some observability into Claude Code over time
- However: Anthropic historically focuses on the model and core CLI, not ecosystem tooling
- Analogy: VS Code exists but thousands of extensions thrive because Microsoft cannot serve every niche
- Mitigation: Move fast, build community, establish Norbert as the de facto standard before Anthropic fills the gap
- If Anthropic builds native observability, Norbert can pivot to a power-user layer on top (deeper analysis, team features, cross-session insights)

**Viability Risk: GREEN** -- Viable with manageable risks. Anthropic's potential entry is the key monitor-and-adapt risk.

### Risk Summary (Updated 2026-03-02)

| Risk | Status | Key Issue | Mitigation |
|------|--------|-----------|------------|
| Value | GREEN | WTP unconfirmed | Freemium reduces risk. MCP research adds evidence of strong demand (28 sources). |
| Usability | GREEN | Install friction | One-command install |
| Feasibility | YELLOW (improved) | ~~Data access from Claude Code~~ Hook API stability | Hooks proven for data capture (de-risked from trending-RED). Remaining: hook API stability. |
| Viability | GREEN | Anthropic competition | Speed, community, power-user depth. MCP gap confirmed to have zero competition at Norbert's tier. |

**All 4 risks: GREEN/YELLOW -- no RED. Proceed.** MCP research improved Feasibility from trending-RED to stable YELLOW.

---

## Go-to-Market Strategy (Updated 2026-03-02)

### Phase 0: Technical Spike (Week 1-2)
- **Primary**: Validate hook-based data capture -- deploy Claude Code hooks, capture agent + MCP events, store in SQLite
- **Secondary**: Prototype Norbert-as-MCP-server with 2-3 query tools
- Confirm: hook event fields, MCP data richness, real-time WebSocket feasibility
- This resolves the remaining YELLOW feasibility risk (hook API reliability) before building the full product

### Phase 1: MVP Launch (Week 3-8) -- TWO PILLARS
*Agent Observability*:
- Execution trace graph + token cost waterfall + session history
- Local web dashboard + CLI quick queries

*MCP Observability (P0)*:
- MCP server health dashboard (connectivity, uptime, silent failure detection)
- MCP tool call routing explorer (server attribution)
- MCP token overhead analyzer (per-server breakdown)
- MCP error timeline (chronological failure view)

- Open source on GitHub, npm package
- Target: 100 installs, 30 WAU
- **MCP-specific launch content**: "I built the missing network tab for Claude Code MCP servers"

### Phase 2: Differentiation (Week 9-14)
- Context Inspector (CLAUDE.md resolution viewer)
- Norbert-as-MCP-server (in-conversation observability queries)
- MCP data flow inspector (detailed input/output viewer)
- MCP tool name collision detection
- Target: 500 installs, 150 WAU

### Phase 3: Monetization (Week 15-20)
- Pro tier: unlimited history, advanced analytics, export
- Content marketing: "How Norbert saved me $X/month on Claude Code" + "How Norbert caught my silent MCP failure before it cost me an hour"
- Target: 1,000 installs, 50 paid users

### Phase 4: Team/Scale (Month 6+)
- Team dashboard, multi-user support
- Enterprise features (SSO, audit, budgets)
- OTel export for power users who want Datadog/Grafana integration
- Anthropic marketplace integration (if available)

---

## Gate G4 Evaluation

| G4 Criterion | Threshold | Result | Verdict |
|-------------|-----------|--------|---------|
| Four big risks | All green/yellow | Value: GREEN, Usability: GREEN, Feasibility: YELLOW, Viability: GREEN | PASS |
| Lean Canvas complete | All 9 boxes | Complete with evidence backing | PASS |
| Channel validated | 1+ viable | GitHub + community + content (3 viable) | PASS |
| Unit economics | LTV > 3x CAC | Near-zero marginal cost, organic acquisition = highly favorable | PASS |
| Stakeholder sign-off | Required | Founder alignment pending | CONDITIONAL |

**G4 Decision: PROCEED to Build (conditional on technical spike confirming feasibility)**

---

## Go / No-Go Recommendation (Updated 2026-03-02)

### GO -- with conditions (strengthened by MCP research)

**Recommendation**: Proceed to build. The evidence supports a viable product with genuine differentiation, clear customer pain, and favorable economics. MCP research significantly strengthened the case by: (1) de-risking feasibility (hooks proven), (2) confirming zero competition at Norbert's tier for MCP observability, and (3) validating MCP observability as P0 core feature.

**Conditions**:
1. **Technical spike first** (1-2 weeks): Validate hook-based data capture for both agent events and MCP events. Confirm hook API reliability, event field completeness, and real-time WebSocket feasibility. If hooks fail to capture sufficient MCP data, fall back to log parsing for agent observability and defer MCP features.
2. **Validate A2 (willingness to pay) with real users**: Ship free MVP, measure engagement, test pricing page before building Pro tier.
3. **Monitor Anthropic's roadmap**: If Anthropic announces native observability, accelerate community building and differentiation features.

**Kill criteria**:
- Technical spike reveals Claude Code hooks are fundamentally unreliable or about to be deprecated
- After 500 installs, fewer than 10% return after first use (no stickiness)
- Anthropic ships native observability that covers 80%+ of Norbert's value (including MCP observability)

---

## Discovery Summary (Updated 2026-03-02)

| Phase | Status | Key Finding |
|-------|--------|-------------|
| 1: Problem | VALIDATED | 7/7 signals confirm observability gap is real, painful, and frequent. MCP observability gap (P6) validated by 28-source research. |
| 2: Opportunity | VALIDATED | 13 opportunities identified (8 original + 5 MCP). Top scores: 17, 17, 16, 15, 15, 15, 15. MCP Server Health tied for #1. |
| 3: Solution | VALIDATED | Two-pillar observatory: agent observability + MCP observability. 4 concepts tested, all passing. Hook-based architecture validated. |
| 4: Viability | VALIDATED (conditional) | Viable business model. Feasibility improved from trending-RED to stable YELLOW (hooks de-risked data access). Zero competition at Norbert's tier for MCP observability. |

**The single most important insight from this discovery**: Norbert should be an **observation tool, not an orchestration tool**, spanning **both agent workflows AND MCP server interactions**. The evidence overwhelmingly supports "help me see what happened" over "help me control what happens." Name it an observatory. Build the trace graph. Show the cost waterfall. Show the MCP server health. Show the tool routing. The control features can come later, if ever.

**The MCP research insight**: MCP observability is not a nice-to-have add-on -- it is a P0 core feature that occupies a complete competitive vacuum and shares the same data capture infrastructure (hooks) as agent observability. Delivering both pillars in the MVP positions Norbert as the comprehensive observatory for Claude Code, not just a trace viewer.
