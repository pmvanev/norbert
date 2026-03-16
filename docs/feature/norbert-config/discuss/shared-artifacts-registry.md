# Shared Artifacts Registry: norbert-config

## Artifact Registry

### agent_definitions

- **Source of truth**: `.claude/agents/*.md` files (one file per agent)
- **Consumers**: Agents tab card list, agent detail expanded view
- **Owner**: norbert-config plugin filesystem reader
- **Integration risk**: MEDIUM -- agent file format may vary; parser must handle missing optional fields
- **Validation**: Agent name derived from filename matches displayed name; all parsed fields match file content

### hook_configurations

- **Source of truth**: `.claude/settings.json` `hooks` array
- **Consumers**: Hooks tab card list
- **Owner**: norbert-config plugin settings.json parser
- **Integration risk**: HIGH -- hooks structure is nested JSON; malformed JSON blocks all hook data
- **Validation**: Number of displayed hooks matches number of entries in settings.json hooks array; event types, commands, and matchers match source

### mcp_server_configurations

- **Source of truth**: `.claude/settings.json` `mcpServers` object
- **Consumers**: MCP Servers tab card list
- **Owner**: norbert-config plugin settings.json parser
- **Integration risk**: HIGH -- MCP server config includes env vars with sensitive values; must mask by default
- **Validation**: Server names match keys in mcpServers object; type, command, args, env all match source

### skill_definitions

- **Source of truth**: `.claude/commands/*.md` files (one file per skill)
- **Consumers**: Skills tab list
- **Owner**: norbert-config plugin filesystem reader
- **Integration risk**: LOW -- simple file listing with name extraction from filename
- **Validation**: Skill count matches file count in .claude/commands/

### rule_entries

- **Source of truth**: `.claude/settings.json` `rules` section AND `CLAUDE.md` files
- **Consumers**: Rules tab list
- **Owner**: norbert-config plugin (dual source aggregation)
- **Integration risk**: MEDIUM -- rules come from two different sources; must show source attribution per rule
- **Validation**: Each rule shows correct source file; total count equals sum from both sources

### claude_md_files

- **Source of truth**: `./CLAUDE.md` and `.claude/CLAUDE.md` (project-level and user-level)
- **Consumers**: Docs tab content panels
- **Owner**: norbert-config plugin filesystem reader
- **Integration risk**: LOW -- direct file read with Markdown rendering
- **Validation**: Content displayed matches raw file content; Markdown headings render as styled headings

### config_source_path

- **Source of truth**: Filesystem path where each entity was read from
- **Consumers**: All tabs (source annotation on every entity card)
- **Owner**: norbert-config plugin filesystem reader
- **Integration risk**: LOW -- path is a string carried through from read operation
- **Validation**: Displayed path is a valid filesystem path; clicking or hovering confirms the source

### config_tab_registration

- **Source of truth**: norbert-config plugin manifest and onLoad registration
- **Consumers**: Norbert sidebar tab list
- **Owner**: norbert-config plugin
- **Integration risk**: LOW -- standard plugin registration via api.ui.registerTab
- **Validation**: Config tab appears in sidebar; clicking it loads the Configuration Viewer

## Integration Checkpoints

### Checkpoint 1: Plugin loads and tab appears
- norbert-config plugin loads via standard lifecycle
- Config tab appears in sidebar alongside Sessions and Usage tabs
- No dependency on active Claude Code session or network access

### Checkpoint 2: Filesystem data accuracy
- Every displayed value traces to an actual file in `.claude/`
- No caching layer that could show stale data (read on tab activation or pull-to-refresh)
- Parse errors shown inline without breaking other tabs

### Checkpoint 3: Cross-tab consistency
- settings.json is parsed once and shared across Hooks, Rules, and MCP tabs
- If settings.json is malformed, all tabs consuming it show the same error
- Agent and skill counts match actual file counts in their directories

### Checkpoint 4: Sensitive data handling
- MCP server env var values masked by default
- No sensitive data logged to console
- Reveal-on-click interaction for masked values
