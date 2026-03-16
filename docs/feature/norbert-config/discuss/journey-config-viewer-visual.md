# Journey: Browse Configuration -- Visual Map

## Journey Overview

```
[Trigger]             [Step 1]            [Step 2]              [Step 3]
User opens Norbert    Navigates to        Browses tab           Inspects individual
or clicks Config tab  Config tab          content list          entity details

Feels: Curious        Feels: Oriented     Feels: Informed       Feels: Confident
       "what do I            "tabs make            "I can see           "I know exactly
        have set up?"         sense"                everything"          what this does"
```

## Emotional Arc

- **Start**: Curious / slightly uncertain ("What have I configured?")
- **Middle**: Oriented and exploring ("Tabs are clear, I can browse each category")
- **End**: Confident and informed ("I know my full setup, nothing is hidden")
- **Pattern**: Discovery Joy (Curious -> Exploring -> Informed)

---

## Step 1: Navigate to Configuration Tab

The user clicks the Configuration tab in the sidebar. The tab loads instantly because it reads local files, not a database or network resource.

```
+-- Norbert -------------------------------------------------------+
|                                                                    |
|  [Sessions]  [Usage]  [Config]                                     |
|                         ^^^^^                                      |
|                         active                                     |
|                                                                    |
|  +-- Configuration Viewer -----------------------------------+     |
|  |                                                           |     |
|  |  Agents | Hooks | Skills | Rules | MCP | Plugins | Docs  |     |
|  |  ^^^^^^                                                   |     |
|  |  active tab                                               |     |
|  |                                                           |     |
|  |  Your configured agents from .claude/agents/              |     |
|  |                                                           |     |
|  |  +-- nw-functional-software-crafter --------+             |     |
|  |  |  Model: opus-4  Tools: 12                |             |     |
|  |  |  "Functional programming specialist..."   |             |     |
|  |  +------------------------------------------+             |     |
|  |                                                           |     |
|  |  +-- nw-product-owner ----------------------+             |     |
|  |  |  Model: opus-4  Tools: 8                 |             |     |
|  |  |  "Experience-driven requirements..."      |             |     |
|  |  +------------------------------------------+             |     |
|  |                                                           |     |
|  |  +-- nw-solution-architect ------------------+            |     |
|  |  |  Model: opus-4  Tools: 10                |             |     |
|  |  |  "Architecture design and technology..."   |            |     |
|  |  +-------------------------------------------+            |     |
|  |                                                           |     |
|  +-----------------------------------------------------------+     |
|                                                                    |
|  [Status Bar]                                                      |
+--------------------------------------------------------------------+
```

---

## Step 2: Browse Different Tabs

The user clicks between tabs to explore each configuration category. Each tab loads its content from the relevant source within `.claude/`.

### Hooks Tab

```
+-- Configuration Viewer -------------------------------------------+
|                                                                    |
|  Agents | Hooks | Skills | Rules | MCP | Plugins | Docs           |
|          ^^^^^                                                     |
|          active                                                    |
|                                                                    |
|  Hook configurations from .claude/settings.json                    |
|                                                                    |
|  +-- Hook: PreToolUse --------------------------------+            |
|  |  Event: PreToolUse                                 |            |
|  |  Command: /path/to/norbert/hook-receiver           |            |
|  |  Matchers:                                         |            |
|  |    Tool: Bash, Write, Edit, MultiEdit              |            |
|  +----------------------------------------------------+            |
|                                                                    |
|  +-- Hook: PostToolUse -------------------------------+            |
|  |  Event: PostToolUse                                |            |
|  |  Command: /path/to/norbert/hook-receiver           |            |
|  |  Matchers:                                         |            |
|  |    Tool: Bash, Write, Edit, MultiEdit              |            |
|  +----------------------------------------------------+            |
|                                                                    |
|  +-- Hook: Notification ------------------------------+            |
|  |  Event: Notification                               |            |
|  |  Command: /path/to/norbert/hook-receiver           |            |
|  |  Matchers: (none)                                  |            |
|  +----------------------------------------------------+            |
|                                                                    |
+--------------------------------------------------------------------+
```

### MCP Servers Tab

```
+-- Configuration Viewer -------------------------------------------+
|                                                                    |
|  Agents | Hooks | Skills | Rules | MCP | Plugins | Docs           |
|                                   ^^^                              |
|                                   active                           |
|                                                                    |
|  MCP server configurations from .claude/settings.json              |
|                                                                    |
|  +-- filesystem-server ---------------------------+                |
|  |  Type: stdio                                   |                |
|  |  Command: npx @anthropic/mcp-filesystem        |                |
|  |  Args: ["/home/user/projects"]                 |                |
|  |  Env: (none)                                   |                |
|  +------------------------------------------------+                |
|                                                                    |
|  +-- github-server -------------------------------+                |
|  |  Type: stdio                                   |                |
|  |  Command: npx @anthropic/mcp-github            |                |
|  |  Args: []                                      |                |
|  |  Env: GITHUB_TOKEN=****                        |                |
|  +------------------------------------------------+                |
|                                                                    |
+--------------------------------------------------------------------+
```

### CLAUDE.md / Docs Tab

```
+-- Configuration Viewer -------------------------------------------+
|                                                                    |
|  Agents | Hooks | Skills | Rules | MCP | Plugins | Docs           |
|                                                     ^^^^           |
|                                                     active         |
|                                                                    |
|  CLAUDE.md files from project root and .claude/                    |
|                                                                    |
|  +-- Source: ./CLAUDE.md -----------------------+                  |
|  |                                              |                  |
|  |  # Norbert                                   |                  |
|  |                                              |                  |
|  |  Local-first observability and configuration |                  |
|  |  management desktop app for Claude Code      |                  |
|  |  users.                                      |                  |
|  |                                              |                  |
|  |  ## Development Paradigm                     |                  |
|  |                                              |                  |
|  |  This project follows the **functional       |                  |
|  |  programming** paradigm.                     |                  |
|  |                                              |                  |
|  +----------------------------------------------+                  |
|                                                                    |
|  +-- Source: .claude/CLAUDE.md -----------------+                  |
|  |  (file contents rendered with formatting)    |                  |
|  +----------------------------------------------+                  |
|                                                                    |
+--------------------------------------------------------------------+
```

---

## Step 3: Inspect Entity Details

The user clicks on an individual entity (agent, hook, MCP server) to expand its details. Progressive disclosure keeps the overview clean while allowing drill-down.

### Expanded Agent Detail

```
+-- nw-functional-software-crafter (expanded) ---------------------+
|                                                                    |
|  Name:        nw-functional-software-crafter                       |
|  Description: Functional programming specialist for TypeScript...  |
|  Model:       opus-4                                               |
|                                                                    |
|  Tools (12):                                                       |
|    Read, Write, Edit, Glob, Grep, Bash, ...                        |
|                                                                    |
|  System Prompt Preview:                                            |
|  +--------------------------------------------------------------+  |
|  | You are a functional software crafter specializing in         |  |
|  | TypeScript and Rust. You write pure functions, use            |  |
|  | immutable data structures, and follow railway-oriented        |  |
|  | error handling patterns...                                    |  |
|  |                                                    [Show All] |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  Source: .claude/agents/nw-functional-software-crafter.md          |
+--------------------------------------------------------------------+
```

---

## Error States

### No .claude/ Directory Found

```
+-- Configuration Viewer -------------------------------------------+
|                                                                    |
|  Agents | Hooks | Skills | Rules | MCP | Plugins | Docs           |
|                                                                    |
|                                                                    |
|       No .claude/ directory found                                  |
|                                                                    |
|       Norbert looks for configuration in your home                 |
|       directory's .claude/ folder.                                 |
|                                                                    |
|       To get started with Claude Code configuration:               |
|       https://docs.anthropic.com/claude-code/config                |
|                                                                    |
|                                                                    |
+--------------------------------------------------------------------+
```

### Empty Tab (No Entities of This Type)

```
+-- Configuration Viewer -------------------------------------------+
|                                                                    |
|  Agents | Hooks | Skills | Rules | MCP | Plugins | Docs           |
|                   ^^^^^                                            |
|                                                                    |
|                                                                    |
|       No skills configured                                         |
|                                                                    |
|       Skills are custom commands defined in                        |
|       .claude/commands/. Each .md file becomes                     |
|       a slash command you can invoke in Claude Code.               |
|                                                                    |
|                                                                    |
+--------------------------------------------------------------------+
```

---

## Shared Artifacts Across Steps

| Artifact | Source | Displayed In |
|----------|--------|-------------|
| ${agent_name} | `.claude/agents/*.md` filename | Agents tab card title |
| ${agent_description} | First paragraph of agent `.md` file | Agents tab card subtitle |
| ${agent_model} | Agent definition model field | Agents tab card metadata |
| ${hook_event_type} | `.claude/settings.json` hooks[].event | Hooks tab card header |
| ${hook_command} | `.claude/settings.json` hooks[].command | Hooks tab card detail |
| ${mcp_server_name} | `.claude/settings.json` mcpServers key | MCP tab card title |
| ${mcp_server_type} | `.claude/settings.json` mcpServers[].type | MCP tab card metadata |
| ${skill_name} | `.claude/commands/*.md` filename | Skills tab list |
| ${rule_text} | `.claude/settings.json` rules or CLAUDE.md | Rules tab list |
| ${claude_md_content} | `./CLAUDE.md`, `.claude/CLAUDE.md` | Docs tab rendered content |
| ${config_source_path} | Filesystem path | All tabs, source annotation |
