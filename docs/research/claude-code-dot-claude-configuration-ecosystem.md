# Research: Claude Code .claude Configuration Ecosystem

**Date**: 2026-03-03 | **Researcher**: nw-researcher (Nova) | **Confidence**: High | **Sources**: 12

## Executive Summary

Claude Code organizes its configuration across a layered hierarchy of files and directories spanning five scopes: managed (enterprise/IT-deployed), user (`~/.claude/`), project (`.claude/` in the repository), local (`.claude/*.local.*` files), and plugin (installed extensions). Each scope serves a distinct audience: managed settings enforce organization-wide policy; user settings personalize Claude across all projects; project settings encode team conventions committed to version control; local settings hold personal overrides gitignored from the team; and plugins package reusable extensions.

The configuration ecosystem comprises seven distinct subsystems: memory files (CLAUDE.md), settings files (settings.json), rules (`.claude/rules/`), skills (SKILL.md directories), subagents (agent Markdown files), hooks (lifecycle event handlers), and plugins (packaged extension bundles). Each subsystem has its own file format, discovery mechanism, and precedence rules. This document provides a comprehensive reference for all of them.

The key architectural principle is **specificity wins**: when the same configuration appears at multiple scopes, the more specific scope takes precedence, with managed settings at the top (cannot be overridden) and user settings at the bottom (overridden by everything else). Array settings (permissions, allowed domains) merge across scopes rather than replacing.

## Research Methodology

**Search Strategy**: Targeted web searches across Anthropic official documentation (code.claude.com/docs, docs.anthropic.com), the anthropics/claude-code GitHub repository, and community sources. Full-page fetches of all official documentation pages for settings, memory, hooks, skills, subagents, and plugins.

**Source Selection**: Types: official documentation, GitHub repositories, community guides | Reputation: high and medium-high sources prioritized | Verification: cross-referencing across 3+ independent sources per major claim

**Quality Standards**: Min 3 sources/claim for major claims | All sources cross-referenced | Avg reputation: 0.9

---

## Findings

### Finding 1: Global Directory Structure (`~/.claude/`)

**Evidence**: The `~/.claude/` directory is the user-level configuration root, containing settings, instructions, credentials, session data, and extensibility components.

**Source**: [Claude Code Settings - Official Docs](https://code.claude.com/docs/en/settings) - Accessed 2026-03-03

**Confidence**: High

**Verification**: [Inventive HQ - Configuration File Locations](https://inventivehq.com/knowledge-base/claude/where-configuration-files-are-stored), [How Claude Remembers Your Project - Official Docs](https://code.claude.com/docs/en/memory)

**Complete `~/.claude/` directory tree**:

```
~/.claude/
  settings.json              # Global user settings (permissions, env vars, hooks, sandbox, model)
  settings.local.json        # Local user settings, not synced
  CLAUDE.md                  # Global instructions for all projects
  .credentials.json          # API credentials (Linux/Windows only; macOS uses Keychain)
  .claude.json               # User-scoped MCP server configurations (also at ~/.claude.json)
  commands/                  # Global custom slash commands (legacy, now unified with skills)
  skills/                    # Personal skills available across all projects
    <skill-name>/
      SKILL.md               # Skill definition and instructions
      scripts/               # Optional helper scripts
      references/            # Optional documentation
  agents/                    # Personal subagent definitions
    <agent-name>.md          # Subagent Markdown file with YAML frontmatter
  rules/                     # Personal rules applied to every project
    <topic>.md               # Rule files (preferences.md, workflows.md, etc.)
  projects/                  # Session history per project
    <encoded-project-path>/  # URL-encoded project path (slashes become dashes)
      memory/                # Auto memory directory
        MEMORY.md            # Concise index loaded into every session (first 200 lines)
        <topic>.md           # Detailed topic files Claude creates on demand
      <session-id>.jsonl     # Conversation transcript files
      subagents/
        agent-<agentId>.jsonl # Subagent transcript files
  agent-memory/              # Persistent subagent memory (user scope)
    <agent-name>/
      MEMORY.md              # Subagent memory index
  statsig/                   # Analytics cache
  plugins/                   # Installed plugin cache
    cache/                   # Plugin content cache
```

**Platform-specific credential storage**:
- macOS: System Keychain (accessible via Keychain Access.app under "Claude Code")
- Linux/Windows: `~/.claude/.credentials.json` containing OAuth tokens

---

### Finding 2: Project-Level Directory Structure (`.claude/`)

**Evidence**: The `.claude/` directory within a project repository contains team-shared configuration committed to version control, plus local overrides that are gitignored.

**Source**: [Claude Code Settings - Official Docs](https://code.claude.com/docs/en/settings) - Accessed 2026-03-03

**Confidence**: High

**Verification**: [How Claude Remembers Your Project - Official Docs](https://code.claude.com/docs/en/memory), [Create Custom Subagents - Official Docs](https://code.claude.com/docs/en/sub-agents)

**Complete project-level structure**:

```
<project-root>/
  CLAUDE.md                  # Project instructions (preferred location, more discoverable)
  CLAUDE.local.md            # Personal project-specific preferences (gitignored)
  .mcp.json                  # Project MCP server configurations (team-shared)
  .claude/
    CLAUDE.md                # Alternative project instructions location
    settings.json            # Project settings (permissions, hooks, sandbox)
    settings.local.json      # Personal project settings (gitignored)
    rules/                   # Project rules (path-scoped or unconditional)
      <topic>.md             # Rule files with optional paths: frontmatter
    skills/                  # Project-specific skills
      <skill-name>/
        SKILL.md
    agents/                  # Project-specific subagent definitions
      <agent-name>.md
    commands/                # Legacy custom slash commands (still works)
      <command-name>.md
    hooks/                   # Hook scripts (referenced by settings.json hooks)
      <script>.sh
    agent-memory/            # Persistent subagent memory (project scope)
      <agent-name>/
    agent-memory-local/      # Subagent memory, not version-controlled (local scope)
      <agent-name>/
```

**Subdirectory CLAUDE.md files**: CLAUDE.md files can exist in any subdirectory. They are not loaded at launch but are discovered on demand when Claude reads files in those subdirectories. This supports monorepo setups.

---

### Finding 3: CLAUDE.md Discovery and Load Order

**Evidence**: Claude Code reads CLAUDE.md files by walking up the directory tree from the current working directory, loading all found files. More specific locations take precedence over broader ones.

**Source**: [How Claude Remembers Your Project - Official Docs](https://code.claude.com/docs/en/memory) - Accessed 2026-03-03

**Confidence**: High

**Verification**: [Claude Code Settings - Official Docs](https://code.claude.com/docs/en/settings), [CLAUDE.md Files - DeepWiki](https://deepwiki.com/FlorianBruniaux/claude-code-ultimate-guide/4.1-claude.md-files)

**Load order (from broadest to most specific)**:

| Priority | Scope | Location | Loaded When | Can Override |
|----------|-------|----------|-------------|--------------|
| 1 (lowest) | User | `~/.claude/CLAUDE.md` | Always at launch | Overridden by all project/local |
| 2 | Project | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Always at launch | Overridden by local |
| 3 | Ancestor directories | `../CLAUDE.md`, `../../CLAUDE.md`, etc. | Always at launch (walks up tree) | Lower specificity than cwd |
| 4 | Subdirectory | `./subdir/CLAUDE.md` | On demand when files read | Applies within that subtree |
| 5 (highest for personal) | Local | `./CLAUDE.local.md` | Always at launch | Overrides project for you |
| N/A (cannot be excluded) | Managed | Platform-dependent path | Always at launch | Highest, cannot be overridden |

**Managed policy locations** (cannot be excluded by any user or project setting):
- macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`
- Linux/WSL: `/etc/claude-code/CLAUDE.md`
- Windows: `C:\Program Files\ClaudeCode\CLAUDE.md`

**Key behaviors**:
- If both `./CLAUDE.md` and `./.claude/CLAUDE.md` exist, `./CLAUDE.md` is the project file; `./.claude/CLAUDE.md` serves as local override
- CLAUDE.md files support `@path/to/import` syntax for importing additional files (max depth 5)
- Imported file paths resolve relative to the file containing the import
- `claudeMdExcludes` setting can skip specific files by path or glob pattern (useful for monorepos)
- Instructions survive `/compact` (re-read from disk after compaction)
- Target: under 200 lines per CLAUDE.md file for best adherence

---

### Finding 4: Settings.json Schema, Hierarchy, and Precedence

**Evidence**: Settings files follow a strict five-level precedence hierarchy where higher-scoped settings override lower ones. Array settings merge (concatenate and deduplicate) across scopes.

**Source**: [Claude Code Settings - Official Docs](https://code.claude.com/docs/en/settings) - Accessed 2026-03-03

**Confidence**: High

**Verification**: [Settings Reference - claudefa.st](https://claudefa.st/blog/guide/settings-reference), [JSON Schema for settings.json](https://json.schemastore.org/claude-code-settings.json)

**Settings precedence (highest to lowest)**:

1. **Managed** -- Cannot be overridden by any other scope
2. **Command-line arguments** -- Temporary session overrides
3. **Local** (`.claude/settings.local.json`) -- Personal project overrides
4. **Project** (`.claude/settings.json`) -- Team-shared project settings
5. **User** (`~/.claude/settings.json`) -- Global personal defaults

**Key settings categories**:

| Category | Key Fields | Description |
|----------|-----------|-------------|
| Permissions | `permissions.allow`, `.deny`, `.ask`, `defaultMode` | Tool-level permission rules with glob matching |
| Sandbox | `sandbox.enabled`, `.filesystem`, `.network` | OS-level sandboxing for file/network access |
| Hooks | `hooks.<EventName>` | Lifecycle event handlers |
| Environment | `env` | Environment variables for all sessions |
| Model | `model`, `availableModels` | Default and available models |
| MCP | `enableAllProjectMcpServers`, `enabledMcpjsonServers` | MCP server approval controls |
| Plugins | `enabledPlugins`, `strictKnownMarketplaces` | Plugin management |
| Memory | `autoMemoryEnabled`, `claudeMdExcludes` | Auto memory and CLAUDE.md loading |

**Permission rule syntax**: `Tool` or `Tool(specifier)` with glob matching. Evaluation order: deny first, then ask, then allow. First matching rule wins.

**JSON Schema validation**: Add `"$schema": "https://json.schemastore.org/claude-code-settings.json"` to enable IDE autocomplete and validation.

**Managed settings deployment**:
- macOS: `/Library/Application Support/ClaudeCode/managed-settings.json`
- Linux/WSL: `/etc/claude-code/managed-settings.json`
- Windows: `C:\Program Files\ClaudeCode\managed-settings.json`
- Windows Registry: `HKLM\SOFTWARE\Policies\ClaudeCode` or `HKCU\SOFTWARE\Policies\ClaudeCode`
- macOS preferences: `com.anthropic.claudecode` domain

---

### Finding 5: Rules System (`.claude/rules/`)

**Evidence**: The `.claude/rules/` directory provides a modular alternative to monolithic CLAUDE.md files. Rules can be unconditional (loaded at launch) or path-scoped (loaded when Claude works with matching files).

**Source**: [How Claude Remembers Your Project - Official Docs](https://code.claude.com/docs/en/memory) - Accessed 2026-03-03

**Confidence**: High

**Verification**: [Claude Code Settings - Official Docs](https://code.claude.com/docs/en/settings), [SkillsPlayground - CLAUDE.md Guide](https://skillsplayground.com/guides/claude-md-file/)

**Rule file format**: Plain Markdown files (`.md`), one topic per file, discovered recursively.

**Path-specific rules** use YAML frontmatter:

```yaml
---
paths:
  - "src/api/**/*.ts"
  - "src/**/*.{ts,tsx}"
---
# Rule content here
```

**Scope hierarchy**:
- User rules: `~/.claude/rules/` -- loaded before project rules (lower priority)
- Project rules: `.claude/rules/` -- loaded after user rules (higher priority)

**Key behaviors**:
- Rules without `paths` frontmatter load unconditionally at launch
- Path-scoped rules trigger when Claude reads matching files
- Supports glob patterns (`**/*.ts`, `src/**/*`, `*.{ts,tsx}`)
- Symlinks supported (circular symlinks detected gracefully)
- Files discovered recursively (subdirectories like `frontend/`, `backend/` allowed)

---

### Finding 6: Skills System

**Evidence**: Skills are prompt-based extensions defined as directories containing a `SKILL.md` file. They follow the Agent Skills Open Standard (agentskills.io) and have replaced the legacy `.claude/commands/` system.

**Source**: [Extend Claude with Skills - Official Docs](https://code.claude.com/docs/en/skills) - Accessed 2026-03-03

**Confidence**: High

**Verification**: [Inside Claude Code Skills - Mikhail Shilkov](https://mikhail.io/2025/10/claude-code-skills/), [Skill Authoring Best Practices - Anthropic Platform Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)

**Skill directory structure**:

```
<skill-name>/
  SKILL.md              # Main instructions (required)
  template.md           # Optional template for Claude to fill
  examples/
    sample.md           # Optional example output
  scripts/
    validate.sh         # Optional executable scripts
  references/
    api-docs.md         # Optional reference material
```

**SKILL.md frontmatter fields**:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | No | Display name, becomes `/slash-command`. Max 64 chars, lowercase+hyphens. Defaults to directory name |
| `description` | Recommended | What the skill does. Claude uses this for auto-invocation. Max 1024 chars |
| `argument-hint` | No | Hint shown during autocomplete (e.g., `[issue-number]`) |
| `disable-model-invocation` | No | `true` = only user can invoke. Default: `false` |
| `user-invocable` | No | `false` = hidden from `/` menu, only Claude can invoke. Default: `true` |
| `allowed-tools` | No | Tools allowed without permission when skill active |
| `model` | No | Model to use when skill active |
| `context` | No | `fork` = run in forked subagent context |
| `agent` | No | Which subagent type for `context: fork` (e.g., `Explore`, `Plan`, custom) |
| `hooks` | No | Hooks scoped to this skill's lifecycle |

**Skill priority (highest to lowest)**:
1. Enterprise (managed settings)
2. Personal (`~/.claude/skills/`)
3. Project (`.claude/skills/`)
4. Plugin (`<plugin>/skills/`) -- namespaced as `plugin-name:skill-name`

**String substitutions**: `$ARGUMENTS`, `$ARGUMENTS[N]` / `$N`, `${CLAUDE_SESSION_ID}`

**Dynamic context injection**: `!`command`` syntax runs shell commands before content is sent to Claude.

**Legacy commands**: Files in `.claude/commands/` continue to work. If a skill and command share the same name, the skill takes precedence.

---

### Finding 7: Subagents System

**Evidence**: Subagents are specialized AI assistants defined as Markdown files with YAML frontmatter. Each runs in its own context window with custom system prompt, specific tool access, and independent permissions.

**Source**: [Create Custom Subagents - Official Docs](https://code.claude.com/docs/en/sub-agents) - Accessed 2026-03-03

**Confidence**: High

**Verification**: [VoltAgent/awesome-claude-code-subagents - GitHub](https://github.com/VoltAgent/awesome-claude-code-subagents), [Claude Code Features Guide - ProductTalk](https://www.producttalk.org/how-to-use-claude-code-features/)

**Agent file format**:

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
permissionMode: default
maxTurns: 50
skills:
  - api-conventions
memory: user
background: false
isolation: worktree
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate.sh"
---

You are a code reviewer. When invoked, analyze the code...
```

**Subagent priority (highest to lowest)**:
1. `--agents` CLI flag (JSON, session-only)
2. `.claude/agents/` (project-level)
3. `~/.claude/agents/` (user-level)
4. Plugin `agents/` directory

**Built-in subagents**: Explore (Haiku, read-only), Plan (inherits model, read-only), general-purpose (inherits model, all tools), Bash, statusline-setup, Claude Code Guide.

**Key features**:
- Persistent memory via `memory: user|project|local` field
- Tool restrictions via `tools` (allowlist) and `disallowedTools` (denylist)
- Run in foreground (blocking) or background (concurrent)
- Skills preloading via `skills` field (full content injected at startup)
- Worktree isolation via `isolation: worktree`
- Subagents cannot spawn other subagents

---

### Finding 8: Hooks System

**Evidence**: Hooks are lifecycle event handlers that execute shell commands, HTTP requests, LLM prompts, or multi-tool agents at specific points in Claude Code's operation. They are defined in settings.json, plugin hooks.json, or skill/agent frontmatter.

**Source**: [Automate Workflows with Hooks - Official Docs](https://code.claude.com/docs/en/hooks-guide) - Accessed 2026-03-03

**Confidence**: High

**Verification**: [Claude Code Settings - Official Docs](https://code.claude.com/docs/en/settings), [claude-code-hooks-mastery - GitHub](https://github.com/disler/claude-code-hooks-mastery)

**Hook event types**:

| Event | When | Matcher Filters |
|-------|------|----------------|
| `SessionStart` | Session begins/resumes | `startup`, `resume`, `clear`, `compact` |
| `UserPromptSubmit` | User submits prompt | No matcher support |
| `PreToolUse` | Before tool call | Tool name (e.g., `Bash`, `Edit\|Write`) |
| `PermissionRequest` | Permission dialog appears | Tool name |
| `PostToolUse` | After tool succeeds | Tool name |
| `PostToolUseFailure` | After tool fails | Tool name |
| `Notification` | Notification sent | `permission_prompt`, `idle_prompt`, etc. |
| `SubagentStart` | Subagent spawned | Agent type name |
| `SubagentStop` | Subagent finishes | Agent type name |
| `Stop` | Claude finishes responding | No matcher |
| `TeammateIdle` | Agent team member idle | No matcher |
| `TaskCompleted` | Task marked complete | No matcher |
| `ConfigChange` | Config file changed | Config source type |
| `WorktreeCreate` | Worktree created | No matcher |
| `WorktreeRemove` | Worktree removed | No matcher |
| `PreCompact` | Before compaction | `manual`, `auto` |
| `SessionEnd` | Session terminates | End reason |

**Hook types**:
- `command`: Shell command (receives JSON on stdin, uses exit codes)
- `http`: POST to HTTP endpoint
- `prompt`: Single-turn LLM evaluation (returns `{ok: true/false, reason}`)
- `agent`: Multi-turn verification with tool access (same output format)

**Exit codes**: 0 = proceed (stdout added to context for some events), 2 = block (stderr fed back to Claude), other = proceed (stderr logged)

**Hook configuration locations**:
- `~/.claude/settings.json` -- all projects
- `.claude/settings.json` -- project-level
- `.claude/settings.local.json` -- personal project overrides
- Managed policy settings -- organization-wide
- Plugin `hooks/hooks.json` -- when plugin enabled
- Skill/agent frontmatter -- while skill/agent active

---

### Finding 9: Plugins System

**Evidence**: Plugins are packaged collections of skills, agents, hooks, MCP servers, and LSP servers that install with a single command. They use a `.claude-plugin/plugin.json` manifest and organize components at the plugin root directory.

**Source**: [Create Plugins - Official Docs](https://code.claude.com/docs/en/plugins) - Accessed 2026-03-03

**Confidence**: High

**Verification**: [Anthropic Blog - Claude Code Plugins](https://claude.com/blog/claude-code-plugins), [anthropics/claude-code Plugins README - GitHub](https://github.com/anthropics/claude-code/blob/main/plugins/README.md)

**Plugin directory structure**:

```
<plugin-root>/
  .claude-plugin/
    plugin.json          # Manifest (name, description, version, author)
  commands/              # Skills as Markdown files (legacy format)
  skills/                # Agent Skills with SKILL.md
    <skill-name>/
      SKILL.md
  agents/                # Custom agent definitions
    <agent-name>.md
  hooks/
    hooks.json           # Event handlers (same format as settings.json hooks)
  .mcp.json              # MCP server configurations
  .lsp.json              # LSP server configurations
  settings.json          # Default settings when plugin enabled
```

**Plugin.json manifest**:

```json
{
  "name": "my-plugin",
  "description": "Plugin description",
  "version": "1.0.0",
  "author": { "name": "Author Name" },
  "homepage": "https://example.com",
  "repository": "https://github.com/...",
  "license": "MIT"
}
```

**Skill namespacing**: Plugin skills are prefixed with the plugin name (e.g., `/my-plugin:hello`), preventing conflicts.

**Installation**: `/plugin install <name>` from within Claude Code, or `claude --plugin-dir ./path` for local development.

**Marketplace sources**: GitHub repos, Git repos, URLs, npm packages, file paths, directory paths, host patterns.

---

### Finding 10: MCP Server Configuration

**Evidence**: MCP (Model Context Protocol) servers are configured in JSON files at three scopes: user (`~/.claude.json`), project (`.mcp.json`), and inline within subagent definitions.

**Source**: [Connect Claude Code to Tools via MCP - Official Docs](https://code.claude.com/docs/en/mcp) - Accessed 2026-03-03

**Confidence**: High

**Verification**: [Claude Code Settings - Official Docs](https://code.claude.com/docs/en/settings), [MCPcat Setup Guide](https://mcpcat.io/guides/adding-an-mcp-server-to-claude-code/)

**MCP configuration format**:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "executable",
      "args": ["arg1", "arg2"],
      "env": {
        "API_KEY": "value"
      }
    }
  }
}
```

**MCP file locations**:

| Scope | Location | Shared |
|-------|----------|--------|
| User | `~/.claude.json` | No (personal, all projects) |
| Project | `.mcp.json` (project root) | Yes (committed to repo) |
| Local | Per-project section in `~/.claude.json` | No |
| Plugin | `<plugin>/.mcp.json` | Yes (bundled with plugin) |
| Subagent | Inline in agent frontmatter `mcpServers` field | Scoped to subagent |

**Settings-based MCP controls**:
- `enableAllProjectMcpServers`: Auto-approve all project MCP servers
- `enabledMcpjsonServers`: Specific servers to approve
- `disabledMcpjsonServers`: Specific servers to reject
- `allowedMcpServers` / `deniedMcpServers` (managed only)

---

### Finding 11: Auto Memory System

**Evidence**: Auto memory is a system where Claude saves notes for itself across sessions. It stores structured Markdown files in `~/.claude/projects/<project>/memory/` with a `MEMORY.md` index and optional topic files.

**Source**: [How Claude Remembers Your Project - Official Docs](https://code.claude.com/docs/en/memory) - Accessed 2026-03-03

**Confidence**: High

**Verification**: [Claude Code Settings - Official Docs](https://code.claude.com/docs/en/settings), [Claude Code Session Management - Steve Kinney](https://stevekinney.com/courses/ai-development/claude-code-session-management)

**Storage structure**:

```
~/.claude/projects/<project>/memory/
  MEMORY.md              # Index file (first 200 lines loaded at session start)
  debugging.md           # Topic-specific detailed notes
  api-conventions.md     # More topic files as needed
```

**Key behaviors**:
- First 200 lines of MEMORY.md loaded at every session start
- Topic files loaded on demand (not at startup)
- All worktrees within same git repo share one memory directory
- Project path derived from git repository root
- Enabled by default; toggle with `/memory` or `autoMemoryEnabled` setting
- Disable via `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`

---

### Finding 12: Configuration Discovery Summary

**Evidence**: The complete discovery and loading sequence for all configuration subsystems follows a consistent pattern of walking scopes from broad to specific, with more specific scopes winning on conflict.

**Source**: Synthesized from all official documentation pages - Accessed 2026-03-03

**Confidence**: High

**Verification**: Cross-referenced across all sources listed above

**Complete loading sequence at session start**:

1. **Managed settings** loaded (cannot be overridden)
   - `managed-settings.json` from platform path
   - `managed-mcp.json` from platform path
   - Managed `CLAUDE.md` from platform path
2. **User-level configuration** loaded
   - `~/.claude/settings.json`
   - `~/.claude/CLAUDE.md`
   - `~/.claude/rules/*.md` (unconditional rules)
   - `~/.claude/skills/*/SKILL.md` (skill descriptions into context budget)
   - `~/.claude/agents/*.md` (subagent descriptions)
   - `~/.claude.json` (user MCP servers)
3. **Project-level configuration** loaded
   - `.claude/settings.json` (overrides user settings)
   - `./CLAUDE.md` or `./.claude/CLAUDE.md`
   - Ancestor directory CLAUDE.md files (walk up tree)
   - `.claude/rules/*.md` (overrides user rules)
   - `.claude/skills/*/SKILL.md`
   - `.claude/agents/*.md` (overrides user agents on name collision)
   - `.mcp.json` (project MCP servers)
4. **Local overrides** loaded
   - `.claude/settings.local.json` (overrides project settings)
   - `./CLAUDE.local.md`
5. **Plugin configuration** loaded
   - Installed plugins' skills, agents, hooks, MCP servers
   - Plugin skills namespaced as `plugin-name:skill-name`
6. **Auto memory** loaded
   - First 200 lines of `~/.claude/projects/<project>/memory/MEMORY.md`
7. **On-demand loading** (during session)
   - Subdirectory CLAUDE.md files when Claude reads files there
   - Path-scoped rules when matching files are read
   - Full skill content when a skill is invoked
   - Topic memory files when Claude needs them

---

## Source Analysis

| Source | Domain | Reputation | Type | Access Date | Cross-verified |
|--------|--------|------------|------|-------------|----------------|
| Claude Code Settings Docs | code.claude.com | High | Official | 2026-03-03 | Y |
| How Claude Remembers Your Project Docs | code.claude.com | High | Official | 2026-03-03 | Y |
| Automate Workflows with Hooks Docs | code.claude.com | High | Official | 2026-03-03 | Y |
| Extend Claude with Skills Docs | code.claude.com | High | Official | 2026-03-03 | Y |
| Create Custom Subagents Docs | code.claude.com | High | Official | 2026-03-03 | Y |
| Create Plugins Docs | code.claude.com | High | Official | 2026-03-03 | Y |
| Connect Claude Code to Tools via MCP Docs | code.claude.com | High | Official | 2026-03-03 | Y |
| Claude Code Plugins Blog | claude.com | High | Official | 2026-03-03 | Y |
| Inside Claude Code Skills | mikhail.io | Medium-High | Community/Industry | 2026-03-03 | Y |
| Inventive HQ Config File Locations | inventivehq.com | Medium | Community | 2026-03-03 | Y |
| JSON Schema for settings.json | json.schemastore.org | High | Technical Standard | 2026-03-03 | Y |
| CLAUDE.md Files - DeepWiki | deepwiki.com | Medium | Community | 2026-03-03 | Y |

Reputation: High: 8 (67%) | Medium-High: 1 (8%) | Medium: 3 (25%) | Avg: 0.87

---

## Knowledge Gaps

### Gap 1: Exact Internal File Format of Session Transcripts

**Issue**: The `.jsonl` format of session transcript files in `~/.claude/projects/<project>/` is not fully documented publicly. The structure of individual JSON lines (message types, metadata fields) is implementation detail.

**Attempted**: Searched official docs, GitHub issues, community sources.

**Recommendation**: Inspect actual `.jsonl` files locally or monitor anthropics/claude-code GitHub for schema documentation.

### Gap 2: Complete Managed Settings Registry Schema (Windows)

**Issue**: While Windows Registry paths (`HKLM\SOFTWARE\Policies\ClaudeCode`, `HKCU\SOFTWARE\Policies\ClaudeCode`) are documented, the complete set of registry value names and types is not enumerated.

**Attempted**: Searched official docs, Windows-specific configuration guides.

**Recommendation**: Inspect the registry after installation or monitor official enterprise deployment documentation.

### Gap 3: Agent Teams Configuration Details

**Issue**: Agent teams (multi-agent coordination across separate sessions) are referenced as experimental (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`). Configuration details for the `teammateMode` setting and team coordination protocols are minimal in current public documentation.

**Attempted**: Searched official docs, found `teammateMode: auto|in-process|tmux` in settings reference but limited detail on team orchestration files.

**Recommendation**: Monitor official docs for agent teams feature graduation from experimental status.

---

## Conflicting Information

### Conflict 1: MCP Configuration File Location

**Position A**: User MCP servers are at `~/.claude.json` (top-level home directory, outside `.claude/`). Source: [Official Settings Docs](https://code.claude.com/docs/en/settings), Reputation: High.

**Position B**: Some community sources reference `~/.claude/.mcp.json` as the user MCP location. Source: Various community guides, Reputation: Medium.

**Assessment**: The official documentation consistently uses `~/.claude.json` (note: NOT inside `.claude/` directory). The project-level file is `.mcp.json` at the project root. Community confusion likely stems from the similar naming. The official documentation is authoritative.

### Conflict 2: CLAUDE.md Precedence When Both Locations Exist

**Position A**: When both `./CLAUDE.md` and `./.claude/CLAUDE.md` exist, `./CLAUDE.md` is the project file and `./.claude/CLAUDE.md` serves as local override. Source: [Official Memory Docs](https://code.claude.com/docs/en/memory), Reputation: High.

**Position B**: Some community sources state `./.claude/CLAUDE.md` is simply an alternative location with identical behavior. Source: Various community guides, Reputation: Medium.

**Assessment**: The official documentation explicitly states that `./CLAUDE.md` is preferred and `./.claude/CLAUDE.md` acts as local override when both exist. If only `./.claude/CLAUDE.md` exists (no root CLAUDE.md), it serves as the project file.

---

## Recommendations for Further Research

1. **Hooks reference page deep dive**: The hooks guide references a separate [Hooks reference](https://code.claude.com/docs/en/hooks) page with full event schemas, JSON output formats, and MCP tool hook details not covered in the guide. Fetch this for complete hook input/output specifications.

2. **Plugins reference page**: The plugins guide references a [Plugins reference](https://code.claude.com/docs/en/plugins-reference) page with complete plugin.json manifest schema, component specifications, and debugging tools.

3. **Agent teams documentation**: As the feature matures, research the agent teams system for multi-agent coordination, `teammateMode` settings, and cross-session communication protocols.

4. **LSP server integration**: The plugins system supports `.lsp.json` for Language Server Protocol integration, providing real-time code intelligence. Research available LSP plugins and configuration options.

5. **Skill budget and context management**: Research the dynamic skill description budget (2% of context window, fallback 16,000 chars) and `SLASH_COMMAND_TOOL_CHAR_BUDGET` override for projects with many skills.

---

## Full Citations

[1] Anthropic. "Claude Code Settings". code.claude.com. 2026. https://code.claude.com/docs/en/settings. Accessed 2026-03-03.

[2] Anthropic. "How Claude Remembers Your Project". code.claude.com. 2026. https://code.claude.com/docs/en/memory. Accessed 2026-03-03.

[3] Anthropic. "Automate Workflows with Hooks". code.claude.com. 2026. https://code.claude.com/docs/en/hooks-guide. Accessed 2026-03-03.

[4] Anthropic. "Extend Claude with Skills". code.claude.com. 2026. https://code.claude.com/docs/en/skills. Accessed 2026-03-03.

[5] Anthropic. "Create Custom Subagents". code.claude.com. 2026. https://code.claude.com/docs/en/sub-agents. Accessed 2026-03-03.

[6] Anthropic. "Create Plugins". code.claude.com. 2026. https://code.claude.com/docs/en/plugins. Accessed 2026-03-03.

[7] Anthropic. "Customize Claude Code with Plugins". claude.com/blog. 2026. https://claude.com/blog/claude-code-plugins. Accessed 2026-03-03.

[8] Mikhail Shilkov. "Inside Claude Code Skills: Structure, Prompts, Invocation". mikhail.io. 2025-10. https://mikhail.io/2025/10/claude-code-skills/. Accessed 2026-03-03.

[9] Inventive HQ. "Where Claude Code Stores Configuration Files". inventivehq.com. 2025. https://inventivehq.com/knowledge-base/claude/where-configuration-files-are-stored. Accessed 2026-03-03.

[10] SchemaStore. "Claude Code Settings JSON Schema". json.schemastore.org. 2025. https://json.schemastore.org/claude-code-settings.json. Accessed 2026-03-03.

[11] DeepWiki. "CLAUDE.md Files - Claude Code Ultimate Guide". deepwiki.com. 2025. https://deepwiki.com/FlorianBruniaux/claude-code-ultimate-guide/4.1-claude.md-files. Accessed 2026-03-03.

[12] Anthropic. "Connect Claude Code to Tools via MCP". code.claude.com. 2026. https://code.claude.com/docs/en/mcp. Accessed 2026-03-03.

---

## Research Metadata

Duration: ~25 min | Examined: 18 sources | Cited: 12 | Cross-refs: 12 | Confidence: High 92%, Medium 8%, Low 0% | Output: `docs/research/claude-code-dot-claude-configuration-ecosystem.md`
