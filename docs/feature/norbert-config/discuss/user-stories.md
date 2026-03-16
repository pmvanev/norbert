<!-- markdownlint-disable MD024 -->

# norbert-config User Stories

---

## US-001: Plugin Registration and Tab Navigation

### Problem
Ravi Patel is a Claude Code power user who has agents, hooks, and MCP servers configured across multiple files in `.claude/`. He finds it tedious that Norbert has no way to show him this configuration -- he has to leave Norbert and browse files manually. There is no plugin providing a configuration view.

### Who
- Claude Code power user | Has Norbert installed with plugin system active | Wants a dedicated configuration viewer without additional tooling

### Solution
The norbert-config plugin implements the NorbertPlugin interface, registering a primary view (Configuration Viewer) and a sidebar tab during onLoad. The viewer presents 7 sub-tabs (Agents, Hooks, Skills, Rules, MCP, Plugins, Docs) for browsing all configuration categories. The plugin reads only from the local filesystem and requires no active Claude Code session.

### Domain Examples

#### 1: Happy Path -- Plugin loads and user sees Config tab
Ravi Patel launches Norbert. The plugin system resolves norbert-config (no dependencies on other plugins). During onLoad, the plugin registers a primary view and a sidebar tab labeled "Config." Ravi sees the Config tab icon in the sidebar alongside Sessions and Usage. He clicks it and sees the Configuration Viewer with 7 sub-tabs.

#### 2: Edge Case -- Plugin loads with no .claude/ directory
Elena Vasquez has just installed Norbert on a new machine where `.claude/` does not exist yet. The norbert-config plugin loads successfully (it does not fail on missing directory). The Config tab appears. When she clicks it, each sub-tab shows an empty state explaining what belongs there and how to set it up.

#### 3: Error -- Plugin unload and reload cycle
Marcus Chen disables norbert-config in Norbert settings. The Config tab disappears from the sidebar. He re-enables it. The plugin re-registers all views and the tab. The viewer reloads fresh data from the filesystem with no stale state.

### UAT Scenarios (BDD)

#### Scenario: Plugin registers view and tab on load
Given the Norbert plugin system has loaded the norbert-config manifest
And the manifest declares id "norbert-config" with no dependencies
When the plugin system calls onLoad with the NorbertAPI
Then the plugin registers a primary view "config-viewer" with label "Configuration"
And the plugin registers a sidebar tab "config" with label "Config"

#### Scenario: Configuration Viewer shows 7 sub-tabs
Given norbert-config is loaded and Ravi clicks the Config tab
When the Configuration Viewer renders
Then 7 sub-tabs are visible: Agents, Hooks, Skills, Rules, MCP, Plugins, Docs
And the Agents tab is selected by default

#### Scenario: Config tab loads without active Claude Code session
Given no Claude Code session is currently running
When Ravi clicks the Config tab
Then the Configuration Viewer loads and displays configuration data

#### Scenario: Plugin cleans up on unload
Given norbert-config is loaded with all registrations active
When the plugin system calls onUnload
Then the Config tab disappears from the sidebar
And no stale views remain in the registry

### Acceptance Criteria
- [ ] Plugin implements NorbertPlugin interface with manifest, onLoad, and onUnload
- [ ] onLoad registers 1 primary view and 1 sidebar tab
- [ ] Configuration Viewer renders 7 sub-tabs
- [ ] Agents tab is the default selected sub-tab
- [ ] Plugin loads and functions without an active Claude Code session
- [ ] onUnload removes all registrations cleanly

### Technical Notes
- Must conform to NorbertPlugin interface in src/plugins/types.ts
- View registered via RegisterViewInput with primaryView: true
- Tab registered via RegisterTabInput with appropriate order (after Usage tab)
- Plugin has zero dependencies on other plugins (dependencies: {} in manifest)
- No hook processor needed -- this plugin reads static files, not live events

### Job Story Traceability
- JS-1 (consolidated configuration view), JS-4 (learning and discovery)

### MoSCoW: Must Have

---

## US-002: Agents Tab -- Browse Agent Definitions

### Problem
Ravi Patel is a Claude Code user who has 6 agent definitions in `.claude/agents/` but cannot remember which model each agent uses or what tools are available to each. He finds it annoying to `cat` each `.md` file individually and scroll through long system prompts just to see the agent's model and tool list.

### Who
- Claude Code user | Has multiple agent definitions in .claude/agents/ | Wants quick overview with drill-down capability

### Solution
The Agents tab scans `.claude/agents/` for agent definition files and displays each as a card showing name, model, tool count, and description preview. Clicking a card expands to reveal the full agent definition including system prompt with progressive disclosure.

### Domain Examples

#### 1: Happy Path -- Browsing 3 agents
Ravi Patel has agents "nw-functional-software-crafter" (opus-4, 12 tools), "nw-product-owner" (opus-4, 8 tools), and "nw-solution-architect" (opus-4, 10 tools). He opens the Agents tab and sees 3 cards. Each card shows the agent name derived from the filename, the model, the tool count, and the first line of the description. He clicks "nw-product-owner" and the card expands to show the full system prompt with a "Show All" button for the truncated preview.

#### 2: Edge Case -- Agent file with minimal metadata
Elena Vasquez has an agent file `quick-review.md` that contains only a system prompt with no explicit model or tools declaration. The Agents tab shows the card with name "quick-review" and indicates "Model: default" and "Tools: inherited." The card still expands to show the full prompt.

#### 3: Error -- Agent file is unreadable
Marcus Chen has 4 agent files but one (`broken-agent.md`) has restrictive file permissions. The Agents tab shows 3 agent cards and an error indicator for the unreadable file showing the filename and "Permission denied." The other 3 agents display correctly.

### UAT Scenarios (BDD)

#### Scenario: Agents tab lists all agents with key metadata
Given Ravi Patel has 3 agent definition files in .claude/agents/
When Ravi views the Agents tab
Then 3 agent cards appear
And the "nw-functional-software-crafter" card shows model "opus-4" and "12 tools"
And the "nw-product-owner" card shows model "opus-4" and "8 tools"

#### Scenario: Agent card expands to show full details
Given Ravi sees the agent card for "nw-product-owner"
When Ravi clicks the card
Then the card expands to show the complete agent definition
And the system prompt preview includes a "Show All" control for long content
And the source file path ".claude/agents/nw-product-owner.md" is displayed

#### Scenario: Agent with minimal metadata shows sensible defaults
Given Elena Vasquez has an agent file "quick-review.md" with no model declaration
When she views the Agents tab
Then the "quick-review" card shows model "default" and tools "inherited"

#### Scenario: Unreadable agent file shows error without breaking tab
Given Marcus Chen has 4 agent files where 1 has unreadable permissions
When he views the Agents tab
Then 3 agent cards display correctly
And an error indicator appears for the unreadable file with the filename and error description

#### Scenario: No agents configured shows empty state
Given Elena Vasquez has no files in .claude/agents/
When she views the Agents tab
Then an empty state message explains what agents are
And the message describes where to create agent definition files

### Acceptance Criteria
- [ ] Agents tab scans .claude/agents/ for .md files
- [ ] Each agent card shows name (from filename), model, tool count, and description preview
- [ ] Clicking a card expands to show the full agent definition with system prompt
- [ ] System prompt uses progressive disclosure (preview with expand control)
- [ ] Source file path displayed on expanded card
- [ ] Agent files with missing metadata show sensible defaults
- [ ] Unreadable files show error without breaking other agent cards
- [ ] Empty directory shows explanatory empty state

### Technical Notes
- Agent definition files are Markdown with YAML frontmatter (model, tools) or structured Markdown sections
- Filename minus extension becomes the agent name
- System prompt may be hundreds of lines; preview should show first 3-5 lines
- File read errors should be caught per-file, not fail the entire tab

### Job Story Traceability
- JS-2 (verifying agent configuration correctness), JS-4 (discovering available agents)

### MoSCoW: Must Have

---

## US-003: Hooks Tab -- View Hook Event Bindings

### Problem
Ravi Patel has hooks configured in `.claude/settings.json` to send events to Norbert's hook receiver, but when a hook does not fire as expected, his first debugging step is verifying the configuration. He finds it error-prone to read nested JSON by eye, especially when matchers are involved -- he has missed typos in tool names and wrong event types.

### Who
- Claude Code user | Has hooks configured in settings.json | Needs to verify hook wiring when debugging

### Solution
The Hooks tab parses the hooks section of `.claude/settings.json` and displays each hook as a card showing event type, command path, and matcher patterns. The structured display makes misconfiguration visually obvious.

### Domain Examples

#### 1: Happy Path -- Viewing 3 hook bindings
Ravi Patel has 3 hooks: PreToolUse and PostToolUse both targeting `/usr/local/bin/norbert-hook` with matchers for Bash, Write, Edit, MultiEdit; and Notification targeting the same command with no matchers. He opens the Hooks tab and sees 3 cards. Each card clearly shows the event type as a header, the command path, and matchers as a tag list.

#### 2: Edge Case -- Hook with complex matcher structure
Elena Vasquez has a hook with matchers that filter by both tool name and file pattern. The Hooks tab displays the full matcher structure so she can verify the filter is correct.

#### 3: Error -- settings.json has invalid JSON in hooks section
Marcus Chen has a syntax error in his settings.json (missing comma in the hooks array). The Hooks tab shows a parse error message identifying the JSON problem. Other tabs that do not depend on the hooks section still function.

### UAT Scenarios (BDD)

#### Scenario: Hooks tab displays hook event bindings
Given Ravi Patel has 3 hooks configured in .claude/settings.json
When Ravi views the Hooks tab
Then 3 hook cards appear
And the "PreToolUse" card shows command "/usr/local/bin/norbert-hook"
And the "PreToolUse" card shows matchers "Bash, Write, Edit, MultiEdit"
And the "Notification" card shows "(no matchers)"

#### Scenario: Hook card shows full matcher details
Given Elena Vasquez has a hook with matchers filtering by tool and file pattern
When she views the Hooks tab and expands the hook card
Then the full matcher structure is displayed including all filter criteria

#### Scenario: Malformed hooks JSON shows parse error
Given Marcus Chen has invalid JSON in the hooks section of settings.json
When he views the Hooks tab
Then a parse error message appears explaining the JSON problem
And the error indicates the approximate location of the syntax error

#### Scenario: No hooks configured shows empty state
Given Elena Vasquez has no hooks in .claude/settings.json
When she views the Hooks tab
Then an empty state explains what hooks are and how to configure them

### Acceptance Criteria
- [ ] Hooks tab parses hooks array from .claude/settings.json
- [ ] Each hook card shows event type, command path, and matcher patterns
- [ ] Matchers displayed as tags or structured list
- [ ] Hooks with no matchers display "(no matchers)"
- [ ] JSON parse errors shown inline without breaking other tabs
- [ ] Empty hooks section shows explanatory empty state

### Technical Notes
- Hook structure: { event: string, command: string, matchers?: object[] }
- settings.json may also be at project level; currently focus on user-level (~/.claude/settings.json)
- Parse settings.json once and share parsed result across Hooks, Rules, and MCP tabs

### Job Story Traceability
- JS-3 (auditing hook setup)

### MoSCoW: Must Have

---

## US-004: MCP Servers Tab -- View Server Configurations

### Problem
Ravi Patel has MCP servers configured for filesystem access and GitHub integration. When a tool call fails with "server not found," he needs to verify that the MCP server name, command, arguments, and environment variables are correct. He finds it risky to read env var values from raw JSON where they sit alongside other configuration in plain text.

### Who
- Claude Code user | Has MCP servers configured in settings.json | Needs to verify server connection details with sensitive value protection

### Solution
The MCP Servers tab parses the mcpServers section of `.claude/settings.json` and displays each server as a card showing name, type (stdio/sse), command, arguments, and environment variables. Env var values are masked by default and revealed on click.

### Domain Examples

#### 1: Happy Path -- Viewing 2 MCP servers
Ravi Patel has "filesystem-server" (stdio, `npx @anthropic/mcp-filesystem`, args: ["/home/ravi/projects"]) and "github-server" (stdio, `npx @anthropic/mcp-github`, env: GITHUB_TOKEN). He opens the MCP tab and sees 2 cards. The filesystem-server shows its args. The github-server shows GITHUB_TOKEN with value masked as "****."

#### 2: Edge Case -- Revealing masked env var value
Elena Vasquez clicks the masked GITHUB_TOKEN value on the github-server card. The value reveals as "ghp_abc123def456...". She clicks again and it re-masks. The value is never logged to console.

#### 3: Error -- MCP server with missing required fields
Marcus Chen has an MCP server entry that is missing the "command" field. The card shows the server name and type but displays a warning: "Missing required field: command."

### UAT Scenarios (BDD)

#### Scenario: MCP tab displays server connection details
Given Ravi Patel has 2 MCP servers in .claude/settings.json
When Ravi views the MCP Servers tab
Then 2 server cards appear
And "filesystem-server" shows type "stdio", command, and args
And "github-server" shows type "stdio" and env var "GITHUB_TOKEN" with masked value

#### Scenario: Env var value revealed on click
Given Ravi sees "github-server" with GITHUB_TOKEN masked as "****"
When Ravi clicks the masked value
Then the full token value is revealed
And clicking the value again re-masks it

#### Scenario: Server with missing fields shows warning
Given Marcus Chen has an MCP server entry missing the "command" field
When he views the MCP tab
Then the server card shows a warning about the missing required field
And the card still displays available fields (name, type)

#### Scenario: No MCP servers configured shows empty state
Given Elena Vasquez has no mcpServers in .claude/settings.json
When she views the MCP tab
Then an empty state explains what MCP servers are and how to configure them

### Acceptance Criteria
- [ ] MCP tab parses mcpServers object from .claude/settings.json
- [ ] Each server card shows name, type, command, args, and env vars
- [ ] Env var values masked by default (displayed as "****")
- [ ] Click-to-reveal and click-to-mask toggle for env var values
- [ ] Env var values never logged to console
- [ ] Missing required fields show inline warning on the card
- [ ] Empty mcpServers shows explanatory empty state

### Technical Notes
- MCP server structure: { type: "stdio"|"sse", command: string, args?: string[], env?: Record<string, string> }
- Sensitive value masking is a frontend concern (no backend required)
- Same settings.json parse result shared with Hooks and Rules tabs

### Job Story Traceability
- JS-3 (auditing MCP server setup)

### MoSCoW: Must Have

---

## US-005: Skills, Rules, and Plugins Tabs

### Problem
Elena Vasquez is new to Claude Code and does not know what skills (slash commands), rules, or plugins are available in her current project. She finds it overwhelming to figure out where each type of configuration lives -- skills are in `.claude/commands/`, rules are split between `settings.json` and CLAUDE.md, and plugins are in yet another location. She has no way to discover what is available without reading documentation.

### Who
- New or returning Claude Code user | Unfamiliar with project's custom commands and rules | Wants to discover available capabilities

### Solution
Three tabs (Skills, Rules, Plugins) each display their respective configuration entities with names, descriptions, and source annotations. The Skills tab reads `.claude/commands/`, the Rules tab aggregates from `settings.json` and CLAUDE.md files, and the Plugins tab lists installed Claude Code plugins.

### Domain Examples

#### 1: Happy Path -- Discovering 4 skills
Elena Vasquez opens the Skills tab and sees 4 entries: "deploy" (Deploy to staging), "review-pr" (Review a pull request), "run-tests" (Execute test suite), and "migrate-db" (Run database migrations). Each entry shows the skill name and its description from the file's first line. She now knows what slash commands are available.

#### 2: Edge Case -- Rules from two different sources
Ravi Patel views the Rules tab and sees 5 rules: 3 from `.claude/settings.json` (each annotated "Source: settings.json") and 2 from `CLAUDE.md` (annotated "Source: ./CLAUDE.md"). He can see which rules come from which file.

#### 3: Error -- No plugins installed
Marcus Chen views the Plugins tab and sees an empty state: "No Claude Code plugins detected." The message explains what plugins are.

### UAT Scenarios (BDD)

#### Scenario: Skills tab lists available slash commands
Given Elena Vasquez has 4 skill files in .claude/commands/
When she views the Skills tab
Then 4 skill entries appear with name and description
And each entry shows the source file path

#### Scenario: Rules tab aggregates from settings.json and CLAUDE.md
Given Ravi Patel has 3 rules in settings.json and 2 rules in CLAUDE.md
When he views the Rules tab
Then 5 rule entries appear
And each entry shows the rule text and its source file annotation

#### Scenario: Plugins tab shows installed plugins
Given Ravi Patel has 2 Claude Code plugins installed
When he views the Plugins tab
Then 2 plugin entries appear with name and version

#### Scenario: Empty Skills tab shows explanatory message
Given Elena Vasquez has no files in .claude/commands/
When she views the Skills tab
Then an empty state explains what skills are
And the message describes where to create skill files

#### Scenario: Empty Plugins tab shows explanatory message
Given Marcus Chen has no Claude Code plugins installed
When he views the Plugins tab
Then an empty state explains what plugins are

### Acceptance Criteria
- [ ] Skills tab scans .claude/commands/ for .md files and displays name + description
- [ ] Rules tab aggregates rules from settings.json and CLAUDE.md with source annotations
- [ ] Plugins tab lists installed Claude Code plugins with name and version
- [ ] Each tab shows an explanatory empty state when no entities exist
- [ ] Source file path annotated on each entry

### Technical Notes
- Skill name derived from filename (minus .md extension)
- Skill description from first heading or first paragraph of the .md file
- Rules in settings.json may be strings or objects with conditions
- Plugin detection mechanism depends on Claude Code's plugin storage format
- SPIKE NEEDED: If plugin storage format is undocumented, a half-day spike (SP-001) should determine the format before US-005 enters DESIGN. This is tracked as a dependency.

### Job Story Traceability
- JS-4 (learning available capabilities)

### MoSCoW: Must Have

---

## US-006: Docs Tab -- Rendered CLAUDE.md View

### Problem
Elena Vasquez has CLAUDE.md files at the project root and inside `.claude/` that contain important instructions for Claude Code. She finds it adequate to read them in her editor, but when she is already in Norbert and wants to check what instructions are active, switching to an editor is an unnecessary context switch. She wants to see the formatted content directly in Norbert.

### Who
- Claude Code user | Has CLAUDE.md files in project root and/or .claude/ | Wants formatted Markdown view without switching to an editor

### Solution
The Docs tab locates CLAUDE.md files from the project root and `.claude/` directory and renders them with Markdown formatting (headings, code blocks, lists, bold/italic). Each file is displayed in its own panel with a source path header.

### Domain Examples

#### 1: Happy Path -- Two CLAUDE.md files rendered
Elena Vasquez has `./CLAUDE.md` (project instructions) and `.claude/CLAUDE.md` (user memory). The Docs tab shows 2 panels. The first renders the project CLAUDE.md with its heading "# Norbert" styled as an h1. The second renders the user CLAUDE.md with heading "# Memory Index."

#### 2: Edge Case -- CLAUDE.md with code blocks
Ravi Patel's CLAUDE.md contains fenced code blocks with TypeScript examples. The Docs tab renders these with syntax highlighting and monospace formatting, preserving the code structure.

#### 3: Error -- No CLAUDE.md files found
Marcus Chen is in a project with no CLAUDE.md files. The Docs tab shows an empty state: "No CLAUDE.md files found" with explanation of where Claude Code looks for them.

### UAT Scenarios (BDD)

#### Scenario: Docs tab renders CLAUDE.md files with formatting
Given a CLAUDE.md file exists at the project root with heading "# Norbert"
And a .claude/CLAUDE.md file exists with heading "# Memory Index"
When Elena views the Docs tab
Then 2 content panels appear
And the first panel header shows "Source: ./CLAUDE.md"
And the content renders with Markdown formatting (styled headings, formatted lists)

#### Scenario: Code blocks render with syntax highlighting
Given CLAUDE.md contains a fenced TypeScript code block
When Ravi views the Docs tab
Then the code block renders in monospace with syntax highlighting

#### Scenario: No CLAUDE.md files shows empty state
Given no CLAUDE.md files exist in the project root or .claude/
When Marcus views the Docs tab
Then an empty state explains where CLAUDE.md files should be placed

### Acceptance Criteria
- [ ] Docs tab locates CLAUDE.md files from project root and .claude/ directory
- [ ] Each file rendered in its own panel with source path header
- [ ] Markdown formatting applied (headings, lists, bold, italic, links)
- [ ] Fenced code blocks render with syntax highlighting
- [ ] Empty state shown when no CLAUDE.md files found

### Technical Notes
- Markdown rendering can use an existing React Markdown library (e.g., react-markdown)
- Syntax highlighting for code blocks (e.g., highlight.js or prism.js integration)
- Files are read-only; no editing capability
- File paths relative to the project root (Tauri can resolve these)

### Job Story Traceability
- JS-1 (seeing configuration in one place), JS-4 (learning and discovery)

### MoSCoW: Should Have

---

## US-007: Filesystem Reader -- .claude/ Directory Parsing

### Problem
Ravi Patel's `.claude/` directory contains agents, commands, and settings spread across subdirectories and JSON files. All 6 tabs in the Configuration Viewer depend on correctly reading and parsing these files. Without a reliable reader, every tab shows nothing or shows incorrect data, making the entire plugin useless.

### Who
- Claude Code user | Has .claude/ directory with mixed file types | Needs reliable, per-file error-resilient parsing

### Solution
A filesystem reader module scans `.claude/` and parses its contents: directory listings for agents/ and commands/, JSON parsing for settings.json, and raw file reads for CLAUDE.md. The reader handles per-file errors gracefully (one bad file does not break the rest) and provides parsed data to all tabs.

### Domain Examples

#### 1: Happy Path -- Full .claude/ directory parsed
Ravi Patel has `.claude/agents/` (3 files), `.claude/commands/` (4 files), `.claude/settings.json` (hooks, mcpServers, rules), `./CLAUDE.md`, and `.claude/CLAUDE.md`. The reader returns all entities correctly parsed. All tabs populate.

#### 2: Edge Case -- Partial directory (only some subdirectories exist)
Elena Vasquez has `.claude/settings.json` but no `.claude/agents/` or `.claude/commands/` directories. The reader returns empty lists for agents and commands but successfully parses settings.json. Hooks and MCP tabs populate; Agents and Skills tabs show empty states.

#### 3: Error -- settings.json is malformed
Marcus Chen has a syntax error in `.claude/settings.json`. The reader returns a parse error for settings.json. Tabs consuming agents and commands (filesystem-based) still work. Tabs consuming settings.json (Hooks, MCP, Rules) show the parse error.

### UAT Scenarios (BDD)

#### Scenario: Full .claude/ directory parsed successfully
Given Ravi Patel has .claude/ with agents/ (3 files), commands/ (4 files), and settings.json
When the filesystem reader scans .claude/
Then it returns 3 agent definitions, 4 skill definitions, and parsed settings.json content

#### Scenario: Missing subdirectories return empty lists
Given Elena Vasquez has .claude/settings.json but no agents/ or commands/ directories
When the filesystem reader scans .claude/
Then agents list is empty and skills list is empty
And settings.json is parsed successfully

#### Scenario: Malformed settings.json returns parse error
Given Marcus Chen has invalid JSON in .claude/settings.json
When the filesystem reader attempts to parse settings.json
Then a parse error result is returned with error details
And agents and skills from filesystem directories are still returned successfully

#### Scenario: Per-file read errors isolated
Given Ravi Patel has 3 agent files where 1 is unreadable
When the filesystem reader scans .claude/agents/
Then 2 agent definitions are returned successfully
And 1 error result is returned for the unreadable file

### Acceptance Criteria
- [ ] Reader scans .claude/agents/ and .claude/commands/ directories for .md files
- [ ] Reader parses .claude/settings.json for hooks, mcpServers, and rules
- [ ] Reader locates ./CLAUDE.md and .claude/CLAUDE.md
- [ ] Missing directories return empty lists (not errors)
- [ ] Per-file read errors are isolated (one bad file does not fail the scan)
- [ ] JSON parse errors include error details (message, approximate location)
- [ ] Parsed data is returned as immutable data structures

### Technical Notes
- Uses Tauri's fs API for filesystem access (Rust backend)
- settings.json parsed once per Configuration Viewer render, shared across tabs
- Path resolution must handle both user-level (~/.claude/) and project-level (./.claude/) configurations
- When both user-level and project-level configs exist for the same category, display both with clear source annotations (e.g., "User: ~/.claude/settings.json" vs "Project: ./.claude/settings.json")
- Project-level settings override user-level settings in Claude Code; the viewer should display both but visually indicate override precedence
- File encoding assumed UTF-8; other encodings produce a read error per-file

### Job Story Traceability
- JS-1, JS-2, JS-3, JS-4 (all jobs depend on reliable filesystem reading)

### MoSCoW: Must Have

---

## Definition of Ready Validation

### US-001: Plugin Registration and Tab Navigation

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "Norbert has no way to show configuration -- has to browse files manually" |
| User/persona identified | PASS | Ravi Patel, Claude Code power user with agents/hooks/MCP configured |
| 3+ domain examples | PASS | Plugin loads (happy), no .claude/ dir (edge), disable/enable cycle (error) |
| UAT scenarios (3-7) | PASS | 4 scenarios |
| AC derived from UAT | PASS | 6 acceptance criteria covering all scenarios |
| Right-sized (1-3 days) | PASS | ~1 day -- plugin skeleton with registrations and tab shell |
| Technical notes | PASS | NorbertPlugin interface, RegisterViewInput, RegisterTabInput, zero dependencies |
| Dependencies tracked | PASS | No plugin dependencies; depends on Norbert core plugin system (complete) |

### DoR Status: PASSED

---

### US-002: Agents Tab

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "cannot remember which model each agent uses; has to cat each file" |
| User/persona identified | PASS | Ravi Patel, 6 agent definitions, wants overview with drill-down |
| 3+ domain examples | PASS | 3 agents browsed (happy), minimal metadata (edge), unreadable file (error) |
| UAT scenarios (3-7) | PASS | 5 scenarios |
| AC derived from UAT | PASS | 8 acceptance criteria |
| Right-sized (1-3 days) | PASS | ~2 days -- file scanning, parsing, card UI, expand/collapse |
| Technical notes | PASS | Markdown+YAML frontmatter format, filename as name, preview truncation |
| Dependencies tracked | PASS | Depends on US-001 (plugin registration) and US-007 (filesystem reader) |

### DoR Status: PASSED

---

### US-003: Hooks Tab

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "error-prone to read nested JSON by eye; missed typos in tool names" |
| User/persona identified | PASS | Ravi Patel, hooks configured in settings.json, debugging hook failures |
| 3+ domain examples | PASS | 3 hooks viewed (happy), complex matchers (edge), malformed JSON (error) |
| UAT scenarios (3-7) | PASS | 4 scenarios |
| AC derived from UAT | PASS | 6 acceptance criteria |
| Right-sized (1-3 days) | PASS | ~1 day -- settings.json parsing (shared) + hook card UI |
| Technical notes | PASS | Hook structure documented, settings.json shared parse, project vs user level |
| Dependencies tracked | PASS | Depends on US-001 and US-007 |

### DoR Status: PASSED

---

### US-004: MCP Servers Tab

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "risky to read env var values from raw JSON in plain text" |
| User/persona identified | PASS | Ravi Patel, MCP servers for filesystem and GitHub, debugging tool failures |
| 3+ domain examples | PASS | 2 servers viewed (happy), reveal masked value (edge), missing field (error) |
| UAT scenarios (3-7) | PASS | 4 scenarios |
| AC derived from UAT | PASS | 7 acceptance criteria |
| Right-sized (1-3 days) | PASS | ~1 day -- MCP parsing (shared settings.json) + card UI + masking |
| Technical notes | PASS | MCP structure documented, sensitive value masking, shared parse |
| Dependencies tracked | PASS | Depends on US-001 and US-007 |

### DoR Status: PASSED

---

### US-005: Skills, Rules, and Plugins Tabs

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "overwhelming to figure out where each type of configuration lives" |
| User/persona identified | PASS | Elena Vasquez, new Claude Code user, discovering capabilities |
| 3+ domain examples | PASS | 4 skills discovered (happy), rules from 2 sources (edge), no plugins (error) |
| UAT scenarios (3-7) | PASS | 5 scenarios |
| AC derived from UAT | PASS | 5 acceptance criteria |
| Right-sized (1-3 days) | PASS | ~2 days -- 3 simpler tabs with list UIs and empty states |
| Technical notes | PASS | Skill naming, rule aggregation, plugin detection noted; spike flagged for plugin format |
| Dependencies tracked | PASS | Depends on US-001 and US-007; plugin detection may need a spike |

### DoR Status: PASSED

---

### US-006: Docs Tab

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "switching to an editor is an unnecessary context switch" |
| User/persona identified | PASS | Elena Vasquez, has CLAUDE.md files, wants formatted view in Norbert |
| 3+ domain examples | PASS | 2 CLAUDE.md files (happy), code blocks (edge), no files (error) |
| UAT scenarios (3-7) | PASS | 3 scenarios |
| AC derived from UAT | PASS | 5 acceptance criteria |
| Right-sized (1-3 days) | PASS | ~1 day -- Markdown rendering with existing library |
| Technical notes | PASS | react-markdown, syntax highlighting, read-only, Tauri path resolution |
| Dependencies tracked | PASS | Depends on US-001 and US-007 |

### DoR Status: PASSED

---

### US-007: Filesystem Reader

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "All tabs depend on correctly reading and parsing these files" |
| User/persona identified | PASS | All personas -- reader is shared infrastructure for the plugin |
| 3+ domain examples | PASS | Full directory (happy), partial directory (edge), malformed JSON (error) |
| UAT scenarios (3-7) | PASS | 4 scenarios |
| AC derived from UAT | PASS | 7 acceptance criteria |
| Right-sized (1-3 days) | PASS | ~2 days -- directory scanning, JSON parsing, per-file error isolation |
| Technical notes | PASS | Tauri fs API, shared parse, path resolution (user vs project), UTF-8 assumption |
| Dependencies tracked | PASS | Depends on US-001; depends on Tauri fs API (available) |

### DoR Status: PASSED

---

## Story Dependency Graph

```
US-001 Plugin Registration & Tab Navigation
   |
   v
US-007 Filesystem Reader (.claude/ Directory Parsing)
   |
   +------+------+------+------+------+
   |      |      |      |      |      |
   v      v      v      v      v      v
US-002 US-003 US-004 US-005 US-006
Agents Hooks  MCP    Skills/ Docs
Tab    Tab    Tab    Rules/  Tab
                     Plugins
```

## Story Summary

| ID | Title | Size | Scenarios | MoSCoW | Job Stories |
|----|-------|------|-----------|--------|-------------|
| US-001 | Plugin Registration & Tab Navigation | 1 day | 4 | Must Have | JS-1, JS-4 |
| US-002 | Agents Tab | 2 days | 5 | Must Have | JS-2, JS-4 |
| US-003 | Hooks Tab | 1 day | 4 | Must Have | JS-3 |
| US-004 | MCP Servers Tab | 1 day | 4 | Must Have | JS-3 |
| US-005 | Skills, Rules, Plugins Tabs | 2 days | 5 | Must Have | JS-4 |
| US-006 | Docs Tab | 1 day | 3 | Should Have | JS-1, JS-4 |
| US-007 | Filesystem Reader | 2 days | 4 | Must Have | JS-1-4 |
