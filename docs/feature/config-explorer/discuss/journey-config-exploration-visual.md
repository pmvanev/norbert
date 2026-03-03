# Journey Visualization: Config Exploration

**Feature ID**: config-explorer
**Phase**: DISCUSS -- Phase 2 (Journey Design)
**Date**: 2026-03-03

---

## Journey Overview

Config Explorer serves three primary journeys with distinct emotional arcs:

1. **Orientation Journey** -- "What is configured?" (JS-01, JS-07)
2. **Debugging Journey** -- "Why is my config not working?" (JS-02, JS-04, JS-05)
3. **Exploration Journey** -- "How is everything connected?" (JS-03, JS-08)

---

## Navigation Architecture

```
+============================================================+
|  Norbert Dashboard                                          |
|  [Sessions] [Agents] [MCP] [Config*] [Settings]            |
+============================================================+
                              |
                    Config Explorer Tab
                              |
      +-----------+-----------+-----------+-----------+
      |           |           |           |           |
   Atlas       Mind Map    Galaxy     Cascade    Utilities
   (tree)     (overview)  (graph)   (waterfall)    |
      |           |           |           |      +-----+
   Entry       Default     Deep-       Drill-  | Path |
   Point       View        Dive        Down    | Test |
                                                +-----+
                                                | Srch |
                                                +-----+
```

---

## Journey 1: Orientation ("What is configured?")

**Persona**: Kenji Tanaka, a mid-level developer who joined a project 2 weeks ago. The project has `CLAUDE.md`, `.claude/settings.json`, 4 rules, 2 agents, and a plugin. Kenji has personal `~/.claude/CLAUDE.md` and 2 global rules.

**Emotional Arc**: Overwhelmed -> Curious -> Oriented -> Confident

### Step 1: Open Config Explorer Tab

```
+-- Norbert Dashboard -----------------------------------------------+
|                                                                     |
|  [Sessions] [Agents] [MCP] [ Config ] [Settings]                   |
|                              ^^^^^^^                                |
|                              (active)                               |
|                                                                     |
|  +-- Config Explorer ----------------------------------------+      |
|  |                                                           |      |
|  |  Welcome to Config Explorer                               |      |
|  |  Visualize your Claude Code configuration ecosystem.      |      |
|  |                                                           |      |
|  |  Scanning ~/.claude/ and .claude/ ...                     |      |
|  |  [======================] 100%                            |      |
|  |                                                           |      |
|  |  Found:                                                   |      |
|  |    7 subsystems active  |  3 scopes detected              |      |
|  |    14 config files      |  1 plugin installed             |      |
|  |                                                           |      |
|  |  [View Atlas]  [View Mind Map]  [View Galaxy]             |      |
|  +-----------------------------------------------------------+      |
+---------------------------------------------------------------------+
```

**Emotional State**: Entry: Overwhelmed ("I just joined, where do I start?") -> Exit: Curious ("14 files across 7 subsystems -- I can see the scope now")

### Step 2: Mind Map Overview (Default Visualization)

```
+-- Config Mind Map -----------------------------------------------+
|  [Atlas] [Mind Map*] [Galaxy] [Cascade]  |  [Path Test] [Search] |
|-----------------------------------------------------------+------|
|                                                           |      |
|                    Project: norbert-nwave                  | Info |
|                          |                                | Pane |
|         +------+----+----+----+------+-----+------+      |      |
|         |      |    |    |    |      |     |      |      | Click |
|       Memory  Set  Rules Skl  Agts  Hooks  Plgs  MCP    | a node|
|        (3)   (2)   (6)  (2)  (2)   (4)   (1)   (1)     | to see|
|         |     |     |    |    |      |     |      |      | its   |
|  +------+   +-+-+ +-+-+ +-+  +-+  +-+-+ +-+-+  +-+     | detail|
|  |  |  |   |   | | | | | |  | |  | | | |   |  | |      |      |
|  G  P  L   G   P G P P G P  G P  G P L P   G  P P      |      |
|                                                           |      |
|  Legend: [G]=User(blue) [P]=Project(green) [L]=Local(yellow)     |
|          [M]=Managed(red) [PLG]=Plugin(purple)                   |
+------------------------------------------------------------------+
```

**Emotional State**: Entry: Curious -> Exit: Oriented ("I can see all 7 subsystems and their counts. The project has 6 rules but I have 2 global ones too.")

### Step 3: Drill into Atlas for File Details

```
+-- Config Atlas (Anatomy View) -----------------------------------+
|  [Atlas*] [Mind Map] [Galaxy] [Cascade]  |  [Path Test] [Search] |
|-----------------------------------------------------------+------|
|  ~/.claude/ (User Scope)       |  Content Preview                |
|  +- CLAUDE.md .............. B |  File: .claude/rules/api.md     |
|  +- settings.json .......... B |  Scope: Project                 |
|  +- rules/                     |  Subsystem: Rules               |
|  |  +- preferences.md ...... B |  --------------------------------|
|  |  +- workflows.md ........ B |  ---                            |
|  +- agents/ (empty) ........ D |  paths:                         |
|  +- skills/ (empty) ........ D |    - "src/api/**/*.ts"          |
|  +- .claude.json ........... B |  ---                            |
|                                |  # API Conventions              |
|  .claude/ (Project Scope)      |                                 |
|  +- CLAUDE.md .............. G |  Use Fastify 5 patterns for     |
|  +- settings.json .......... G |  all API routes. Validate       |
|  +- rules/                     |  request schemas with...        |
|  |  +- api.md .............. G |                                 |
|  |  +- testing.md .......... G |  Path Match Status:             |
|  |  +- typescript.md ....... G |  Applies to: src/api/**/*.ts    |
|  |  +- architecture.md ..... G |  [Test a file path...]          |
|  +- agents/                    |                                 |
|  |  +- code-reviewer.md ... G |                                 |
|  |  +- test-writer.md ..... G |                                 |
|  +- skills/                    |                                 |
|  |  +- api-patterns/           |                                 |
|  |  |  +- SKILL.md ........ G |                                 |
|  |  +- testing/                |                                 |
|  |     +- SKILL.md ........ G |                                 |
|                                |                                 |
|  Plugins (Plugin Scope)        |                                 |
|  +- nw-plugin/                 |                                 |
|     +- skills/ ............. P |                                 |
|     +- agents/ ............. P |                                 |
|     +- hooks/ .............. P |                                 |
|                                |                                 |
|  B=User(blue) G=Project(green) D=Dimmed(missing/empty)          |
|  P=Plugin(purple) Y=Local(yellow) R=Managed(red)                |
+------------------------------------------------------------------+
```

**Emotional State**: Entry: Oriented -> Exit: Confident ("I can see every file, its scope, and its content. The dimmed directories show me what I could configure but haven't yet.")

---

## Journey 2: Debugging ("Why is my config not working?")

**Persona**: Ravi Patel, a senior developer who added a hook to `.claude/settings.json` for `PreToolUse` on `Bash` commands. The hook does not fire. Ravi suspects an override but cannot find it.

**Emotional Arc**: Frustrated -> Hopeful -> Focused -> Relieved

### Step 1: Open Config Cascade for Hooks

```
+-- Config Cascade (Precedence Waterfall) -------------------------+
|  [Atlas] [Mind Map] [Galaxy] [Cascade*]  |  [Path Test] [Search] |
|-----------------------------------------------------------+------|
|  Subsystem: [Memory|Settings|Rules|Skills|Agents|Hooks*|MCP]     |
|                                                                   |
|  Hooks: PreToolUse                                                |
|  ================================================================|
|                                                                   |
|  MANAGED (highest precedence)                                     |
|  +-  (no managed hooks defined)                          [ -- ]   |
|                                                                   |
|  LOCAL (.claude/settings.local.json)                              |
|  +-  PreToolUse / Bash:                                  [ACTIVE] |
|  |   type: command                                                |
|  |   command: "./scripts/lint-bash.sh"                            |
|  |   *** THIS IS THE EFFECTIVE HOOK ***                           |
|                                                                   |
|  PROJECT (.claude/settings.json)                                  |
|  +-  PreToolUse / Bash:                               [OVERRIDDEN]|
|  |   type: command                                    ~~~~~~~~~~~  |
|  |   command: "./scripts/validate-bash.sh"                        |
|  |   Overridden by: LOCAL scope (.claude/settings.local.json)     |
|                                                                   |
|  USER (~/.claude/settings.json)                                   |
|  +-  PreToolUse / Bash:                               [OVERRIDDEN]|
|  |   type: http                                       ~~~~~~~~~~~  |
|  |   url: "http://localhost:8080/hooks"                           |
|  |   Overridden by: PROJECT + LOCAL scopes                        |
|                                                                   |
|  PLUGIN (nw-plugin/hooks/hooks.json)                              |
|  +-  PreToolUse / *:                                  [OVERRIDDEN]|
|  |   type: command                                    ~~~~~~~~~~~  |
|  |   command: "nw-validate"                                       |
|  |   Overridden by: USER + PROJECT + LOCAL scopes                 |
|                                                                   |
+------------------------------------------------------------------+
```

**Emotional State**: Entry: Frustrated ("My hook is not firing!") -> Exit: Relieved ("Someone added a PreToolUse/Bash hook in settings.local.json that overrides my project hook. Now I know.")

### Step 2: Navigate to Atlas to Inspect the Override File

```
+-- Config Atlas -- .claude/settings.local.json --------------------+
|                                                                   |
|  File: .claude/settings.local.json                                |
|  Scope: Local (gitignored, personal project override)             |
|  Precedence: Overrides project settings                           |
|                                                                   |
|  {                                                                |
|    "hooks": {                                                     |
|      "PreToolUse": [                                              |
|        {                                                          |
|          "matcher": "Bash",         <-- matches same event        |
|          "hooks": [{                                              |
|            "type": "command",                                     |
|            "command": "./scripts/lint-bash.sh"                    |
|          }]                                                       |
|        }                                                          |
|      ]                                                            |
|    }                                                              |
|  }                                                                |
|                                                                   |
|  [!] This file overrides .claude/settings.json hooks for          |
|      PreToolUse/Bash. Consider removing or coordinating.          |
+------------------------------------------------------------------+
```

**Emotional State**: Exit: Confident and relieved. The cascade showed the override, the atlas showed the specific file content.

### Step 2b: Path Rule Tester (Alternative debugging path for JS-04)

**Persona**: Mei-Lin Chen, a developer whose rule for TypeScript API files does not seem to apply.

```
+-- Path Rule Tester -----------------------------------------------+
|  [Atlas] [Mind Map] [Galaxy] [Cascade]  |  [Path Test*] [Search]  |
|------------------------------------------------------------+------|
|                                                            |      |
|  Enter a file path to test rule matching:                  |      |
|  [src/api/routes/users.ts________________] [Test]          |      |
|                                                            |      |
|  Results for: src/api/routes/users.ts                      |      |
|  ============================================================     |
|                                                            |      |
|  MATCHING RULES (3):                                       | Rule |
|  +----------------------------------------------------------+ Det |
|  | .claude/rules/api.md            (Project)         [MATCH]|ails |
|  |   Pattern: src/api/**/*.ts                        -------|     |
|  |   Match:   src/api/routes/users.ts  <=== YES      [view]|     |
|  +----------------------------------------------------------+     |
|  | .claude/rules/typescript.md     (Project)         [MATCH]|     |
|  |   Pattern: **/*.ts                                       |     |
|  |   Match:   src/api/routes/users.ts  <=== YES             |     |
|  +----------------------------------------------------------+     |
|  | ~/.claude/rules/preferences.md  (User)            [MATCH]|     |
|  |   (no paths: frontmatter -- loads unconditionally)       |     |
|  +----------------------------------------------------------+     |
|                                                            |      |
|  NON-MATCHING RULES (2):                                   |      |
|  +----------------------------------------------------------+     |
|  | .claude/rules/testing.md        (Project)       [NO MATCH]|    |
|  |   Pattern: **/*.test.ts                                   |    |
|  |   Reason:  "users.ts" does not end with ".test.ts"        |    |
|  +----------------------------------------------------------+     |
|  | .claude/rules/architecture.md   (Project)       [NO MATCH]|    |
|  |   Pattern: docs/**/*.md                                   |    |
|  |   Reason:  "src/api/routes/users.ts" is not under "docs/" |    |
|  +----------------------------------------------------------+     |
|                                                            |      |
+------------------------------------------------------------------+
```

**Emotional State**: Entry: Confused ("Why is my rule not applying?") -> Exit: Enlightened ("The pattern does not match because it targets docs, not src.")

---

## Journey 3: Exploration ("How is everything connected?")

**Persona**: Sofia Hernandez, a framework developer building nwave-ai. She has 10 skills, 5 agents, a plugin, custom hooks, and 3 MCP servers. She needs to understand the full dependency web.

**Emotional Arc**: Curious -> Exploring -> Delighted -> Informed

### Step 1: Open Mind Map for Structural Overview

```
+-- Config Mind Map -----------------------------------------------+
|                                                                   |
|              nwave-ai Project                                     |
|                  |                                                 |
|  +------+-----+-+--+------+-----+-----+------+                   |
|  |      |     |    |      |     |     |      |                   |
| Mem   Set   Rules Skls  Agts  Hooks  Plgs  MCP                  |
| (4)   (3)   (8)  (10)  (5)   (12)  (1)   (3)                   |
|                                                                   |
|  Total: 46 configuration elements across 4 scopes                |
|  Relationships: 23 cross-references detected                     |
|                                                                   |
|  [Switch to Galaxy View for relationship details]                |
+------------------------------------------------------------------+
```

### Step 2: Switch to Galaxy (Relationship Graph)

```
+-- Config Galaxy (Relationship Graph) ----------------------------+
|  [Atlas] [Mind Map] [Galaxy*] [Cascade]  |  [Path Test] [Search] |
|-----------------------------------------------------------+------|
|  Filter: [All] [Agents+Skills] [Plugins] [Hooks] [Rules]  |     |
|                                                            | Node |
|       (B)pref          (G)api-conv                         | Info |
|          \             /       \                           |      |
|    (B)wkflow---(G)sol-arch====(G)api-patterns              | Name:|
|                  |    \\                                   | sol- |
|           (G)code-rev  \\===(G)testing                     | arch |
|             |    \\      \                                  | Type:|
|      (P*)nw-plg   \\    (G)test-writer                    | Agent|
|       /  |  \  \   \\                                      | Scope|
|     sk  ag  hk mcp  \\=(B)code-review-skill                | Proj |
|                        \                                    |      |
|                   (G)typescript-rules                       | Skills|
|                                                            | - api-|
|  Legend:                                                   | patt |
|  (B)=User  (G)=Project  (P*)=Plugin  ===cross-ref         | - test|
|  hexagon=agent  circle=skill  square=rule                  | - code|
|  diamond=hook  star=plugin  pentagon=MCP                   | review|
|                                                            |      |
|  [Click node for details]  [Click plugin to expand]        |      |
+------------------------------------------------------------------+
```

### Step 3: Expand Plugin ("Plugin Explosion")

```
+-- Config Galaxy -- Plugin Expanded -------------------------------+
|                                                                   |
|                     (P*) nw-plugin                                |
|                    /    |    |    \                               |
|                  /      |    |      \                             |
|           (P)sk-a  (P)sk-b (P)ag-x  (P)hk-pre                   |
|              |        |       |           |                       |
|         nw-plugin: nw-plugin: code-     PreToolUse               |
|         format    lint      reviewer     /Bash                   |
|                               |                                   |
|                         [!] CONFLICT                              |
|                          with (G)code-reviewer                   |
|                          (Project scope wins)                     |
|                                                                   |
|  Plugin: nw-plugin v1.2.0                                        |
|  Components: 2 skills, 1 agent, 1 hook, 0 MCP                   |
|  Naming conflicts: 1 (code-reviewer agent)                       |
+------------------------------------------------------------------+
```

**Emotional State**: Entry: Curious -> Exit: Delighted ("I can see every relationship. The plugin explosion is exactly the spreadsheet I maintained manually, but interactive. And it found a naming conflict I did not know about.")

---

## Journey Integration Points

### View-to-View Navigation

| From | To | Trigger | Data Passed |
|------|----|---------|-------------|
| Mind Map | Galaxy | "Switch to Galaxy View" button | Selected subsystem filter |
| Mind Map | Cascade | Click any node | Node identity (subsystem + scope + file) |
| Galaxy | Cascade | Click any node | Node identity |
| Galaxy | Atlas | Click node -> "View file" | File path |
| Atlas | Cascade | Click file -> "View precedence" | File path + subsystem |
| Atlas | Path Rule Tester | Click rule -> "Test path" | Rule file pre-selected |
| Path Rule Tester | Atlas | Click matching rule -> "View file" | File path |
| Search | Any view | Click search result | File path + view selection |
| Cascade | Atlas | Click scope entry -> "View file" | File path |

### Shared UI Elements Across All Views

```
+-- Shared Header --------------------------------------------------+
|  [Atlas] [Mind Map] [Galaxy] [Cascade]  |  [Path Test] [Search]   |
|-----------------------------------------------------------+-------|
|  Scope Legend: [U=Blue] [P=Green] [L=Yellow] [Plg=Purple] [M=Red]|
+-------------------------------------------------------------------+
```

- Tab bar with 4 primary views + 2 utility views
- Consistent scope coloring across all views
- Side panel for node details (shows on click in any view)
- Breadcrumb showing: Config Explorer > {View Name} > {Selected Element}

---

## Emotional Arc Summary

| Journey | Start | Middle | End | Pattern |
|---------|-------|--------|-----|---------|
| Orientation | Overwhelmed | Curious / Exploring | Confident | Discovery Joy |
| Debugging | Frustrated | Hopeful / Focused | Relieved | Problem Relief |
| Exploration | Curious | Exploring / Delighted | Informed | Discovery Joy |

### Transition Design

- **Overwhelmed -> Curious**: Achieved by showing aggregate counts immediately (7 subsystems, 14 files). Numbers replace vague anxiety with concrete scope.
- **Frustrated -> Hopeful**: Achieved by the cascade waterfall showing all scope levels at once. The frustrated user sees the answer before scrolling down.
- **Curious -> Delighted**: Achieved by the plugin explosion interaction and the graph's visual representation of relationships the user previously tracked manually.
- **No negative transitions**: Every view-to-view navigation adds information, never removes it. The user can always return to the previous view.
