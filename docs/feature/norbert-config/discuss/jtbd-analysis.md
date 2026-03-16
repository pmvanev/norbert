# JTBD Analysis: norbert-config Plugin

## Job Classification

**Job Type:** Build Something New (Greenfield plugin on brownfield codebase)
**Workflow:** discuss -> design -> distill -> baseline -> roadmap -> split -> execute -> review
**Current Phase:** DISCUSS

---

## Job Stories

### JS-1: Understanding My Claude Code Configuration at a Glance

**When** I have agents, hooks, skills, MCP servers, and rules spread across dozens of files and JSON blocks inside my `.claude/` directory,
**I want to** see everything I have configured in one organized place,
**so I can** understand the full scope of my Claude Code setup without hunting through files and remembering where each thing lives.

#### Functional Job
Present all configuration entities (agents, hooks, skills, rules, MCP servers, plugins, CLAUDE.md) from `.claude/` in a structured, browsable interface.

#### Emotional Job
Feel oriented and in control of my Claude Code setup rather than uncertain about what is configured and where.

#### Social Job
Be seen as someone who has a well-organized, intentional Claude Code setup rather than a messy pile of config files.

#### Forces Analysis
- **Push**: Configuration is scattered across `.claude/agents/`, `.claude/commands/`, `.claude/settings.json`, and CLAUDE.md files. No single view exists. Forgetting what agents or hooks are configured leads to duplicated or conflicting work.
- **Pull**: A tabbed viewer that reads the filesystem and presents every configuration entity in a clean, categorized layout. Instant comprehension without terminal commands.
- **Anxiety**: Will the viewer show stale data? Will it misparse my configuration and show incorrect information?
- **Habit**: Currently using `ls`, `cat`, `find`, or opening files in an editor to inspect configuration. Familiar but slow and fragmented.

#### Assessment
- Switch likelihood: **High** -- push is strong (no existing consolidated view)
- Key blocker: Trust in accuracy of displayed data (must match actual files)
- Key enabler: Zero-setup viewer that works without Claude Code running
- Design implication: Read-only, always accurate, no caching that could show stale data. Works offline.

---

### JS-2: Verifying Agent Configuration Correctness

**When** I have created or edited an agent definition in `.claude/agents/` and I want to confirm it looks right before using it,
**I want to** see the agent's name, description, model, available tools, and system prompt in a readable format,
**so I can** verify the agent is configured as intended without re-reading the raw YAML or Markdown source.

#### Functional Job
Display individual agent definitions with all their fields parsed and presented in a structured, human-friendly layout.

#### Emotional Job
Feel confident that my agent is set up correctly before I invoke it in a session.

#### Social Job
Be trusted by teammates who share the same agent definitions -- show that agents are configured intentionally.

#### Forces Analysis
- **Push**: Raw agent definition files are often long Markdown or YAML. System prompts span dozens of lines. Reading them in a text editor requires scrolling and mental parsing. No summary view exists.
- **Pull**: A card or panel showing agent name, description, model, tools list, and a collapsible system prompt preview. Quick visual confirmation.
- **Anxiety**: Will the viewer truncate or misformat the system prompt? Will it miss fields I added?
- **Habit**: Opening the `.md` file in VS Code or `cat`-ing it in a terminal.

#### Assessment
- Switch likelihood: **High**
- Key blocker: Must show all fields accurately, including custom ones
- Key enabler: Structured display that reveals agent composition at a glance
- Design implication: Show key metadata upfront, system prompt behind progressive disclosure (expand/collapse).

---

### JS-3: Auditing Hook and MCP Server Setup

**When** I have configured hooks in `.claude/settings.json` and MCP servers for tool access, and something is not working as expected,
**I want to** see my hook event bindings and MCP server connection details in a clear format,
**so I can** spot misconfigurations (wrong event type, missing matcher, wrong command path, wrong server URL) without parsing raw JSON by eye.

#### Functional Job
Parse and display hook configurations (event type, command, matchers) and MCP server definitions (name, type, command, args, env vars) from settings.json.

#### Emotional Job
Feel relieved when I can quickly verify that hooks and servers are wired correctly, rather than frustrated by debugging invisible misconfigurations.

#### Social Job
Demonstrate technical diligence to teammates who depend on shared hooks and MCP configurations.

#### Forces Analysis
- **Push**: `settings.json` hooks blocks are nested JSON that is hard to scan. MCP server configuration combines command, args, and env vars in a structure that is easy to misconfigure. Debugging "why isn't my hook firing?" starts with verifying configuration, which is tedious in raw JSON.
- **Pull**: A tabular or card display showing each hook with its event type, command, and matchers. MCP servers showing name, type, and connection details. Structural errors become visually obvious.
- **Anxiety**: Will the viewer parse my settings.json correctly if I have comments or unusual formatting?
- **Habit**: `cat .claude/settings.json | jq '.hooks'` or opening in VS Code with JSON folding.

#### Assessment
- Switch likelihood: **High**
- Key blocker: Correct parsing of settings.json structure
- Key enabler: Tabular display making misconfiguration visually obvious
- Design implication: Each hook and MCP server as a distinct visual unit. Show event types as tags. Show commands with full paths.

---

### JS-4: Learning What Claude Code Capabilities Are Available

**When** I am new to Claude Code or returning after a break, and I am unsure what skills, commands, rules, and plugins are available in my current project,
**I want to** browse a catalog of everything that is configured and discoverable,
**so I can** learn what capabilities I have access to and discover features I did not know existed.

#### Functional Job
List skills from `.claude/commands/`, rules from `.claude/settings.json` and CLAUDE.md, and installed plugins -- all in one browsable interface.

#### Emotional Job
Feel curious and empowered rather than overwhelmed or ignorant about available capabilities.

#### Social Job
Be the team member who knows what Claude Code can do because the tooling makes it discoverable.

#### Forces Analysis
- **Push**: New users do not know where to look. Skills are in `.claude/commands/`, rules are split across files, plugins are undiscoverable without documentation. The mental model of "where does Claude Code look for what?" is not obvious.
- **Pull**: A configuration viewer that doubles as a learning tool. Browse tabs, discover entities, read descriptions. The viewer teaches the user about Claude Code's configuration surface.
- **Anxiety**: Will this be too much information for a beginner? Will I understand what each thing does?
- **Habit**: Asking a colleague or reading documentation instead of browsing configuration directly.

#### Assessment
- Switch likelihood: **Medium-High** -- strongest for new users
- Key blocker: Information density overwhelming beginners
- Key enabler: Clean tab structure with clear labels and descriptions
- Design implication: Each tab should have a brief header explaining what the category is and where the data comes from. Progressive disclosure -- show names and descriptions first, details on demand.

---

## Opportunity Scoring

| # | Outcome Statement | Imp. (%) | Sat. (%) | Score | Priority |
|---|-------------------|----------|----------|-------|----------|
| 1 | Minimize the time to determine what agents are configured | 85 | 15 | 15.5 | Extremely Underserved |
| 2 | Minimize the time to verify hook event bindings are correct | 80 | 10 | 14.0 | Underserved |
| 3 | Minimize the time to see all MCP server connection details | 78 | 12 | 14.4 | Underserved |
| 4 | Minimize the likelihood of overlooking a misconfigured hook | 82 | 10 | 15.4 | Extremely Underserved |
| 5 | Minimize the time to discover available skills and commands | 72 | 8 | 13.6 | Underserved |
| 6 | Minimize the time to review CLAUDE.md instructions in formatted view | 70 | 30 | 11.0 | Appropriately Served |
| 7 | Minimize the time to see entire Claude Code configuration in one place | 88 | 5 | 17.1 | Extremely Underserved |
| 8 | Minimize the likelihood of duplicate or conflicting agent definitions | 65 | 15 | 11.5 | Appropriately Served |

### Scoring Method
- Importance: estimated % of Claude Code users rating 4+ on 5-point scale
- Satisfaction: estimated % satisfied with current approach (near zero -- no consolidated viewer exists)
- Score: Importance + max(0, Importance - Satisfaction)
- Source: product spec analysis + domain knowledge (team estimate, not user survey)

### Top Opportunities (Score >= 14)
1. Consolidated configuration view -- Score: 17.1 -- Maps to JS-1
2. Agent configuration visibility -- Score: 15.5 -- Maps to JS-2
3. Hook misconfiguration detection -- Score: 15.4 -- Maps to JS-3
4. MCP server details -- Score: 14.4 -- Maps to JS-3
5. Hook event binding verification -- Score: 14.0 -- Maps to JS-3

### Appropriately Served Areas (Score 10-12)
1. CLAUDE.md review -- Score: 11.0 -- Users can already read CLAUDE.md in editors with Markdown preview
2. Duplicate agent detection -- Score: 11.5 -- Edge case, not primary pain

### Data Quality Notes
- Source: team estimates based on product spec analysis and Claude Code user patterns
- Confidence: Medium (no direct user survey; directional signal from spec)
