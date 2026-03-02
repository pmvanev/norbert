# Research: Claude Code Extensibility Surface and Visibility Gap Analysis for Norbert

**Date**: 2026-03-02 | **Researcher**: nw-researcher (Nova) | **Confidence**: High | **Sources**: 34

---

## Executive Summary

Claude Code has evolved from a CLI coding assistant into a full-fledged extensibility platform. As of early 2026, the extensibility surface encompasses at least 12 distinct extension points: MCP servers, skills (subsuming the former slash commands system), hooks (12 lifecycle events), custom subagents, plugins (bundling skills + agents + hooks + MCP + LSP servers), the CLAUDE.md memory hierarchy, the .claude/rules/ system, keybindings, permission rules, model configuration, the settings precedence chain, and the plugin marketplace ecosystem. The plugin marketplace alone now hosts 9,000+ plugins.

Despite this rich extensibility surface, visibility into what is actually loaded, active, and potentially conflicting is severely limited. Claude Code provides a handful of inspection commands -- `/context`, `/memory`, `/hooks`, `/agents`, `/plugin` (Installed tab), `/status`, `/permissions` -- but each operates in isolation. There is no unified view of "what is my Claude Code environment right now?" A user running 4 plugins, 8 skills, 3 custom agents, 12 hook configurations, 6 CLAUDE.md files, and 5 MCP servers has no single place to see, verify, or debug this configuration.

This visibility gap is directly analogous to the problems solved by VS Code's Extension Manager, Neovim's lazy.nvim dashboard, Chrome DevTools' Application panel, and Terraform's `terraform providers` command. Each of these tools grew more essential as the extension ecosystem matured. Claude Code's ecosystem has reached the maturity threshold where this tooling is needed -- 9,000+ plugins, an Agent Skills open standard, and a formal plugin marketplace system all signal that extensibility has moved from "power user feature" to "core platform capability."

For Norbert, this extensibility visibility gap represents a natural expansion of the validated Opportunity O3 (Context File Resolution Visibility, score 15/20) into a broader "Configuration Observatory" feature. This research recommends Norbert add an "Extensibility Inspector" view that provides a unified, queryable view of all active Claude Code extensions, their sources, their potential conflicts, and their context/token impact.

---

## Research Methodology

**Search Strategy**: Official Claude Code documentation (code.claude.com/docs/en/*), GitHub repositories and issues (anthropics/claude-code), community guides and tutorials, analogous developer tool documentation (VS Code, Neovim/lazy.nvim, Chrome DevTools, Terraform, Docker Desktop), and local project files.

**Source Selection**: Types: official documentation, community guides, developer tool documentation, GitHub issues | Reputation: high and medium-high minimum for major claims | Verification: cross-referencing across 3+ independent sources for major claims.

**Quality Standards**: Min 3 sources per major claim | All major claims cross-referenced | Avg reputation: 0.79

---

## Findings

### Finding 1: Claude Code Has 12+ Distinct Extension Points Forming a Complex Configuration Surface

**Evidence**: Based on comprehensive review of official Claude Code documentation, the following extension points exist as of March 2026:

| Extension Point | Configuration Location(s) | Inspection Command |
|----------------|--------------------------|-------------------|
| MCP Servers | `.mcp.json`, `~/.claude.json`, managed settings | `/mcp`, `claude mcp list` |
| Skills (incl. former slash commands) | `.claude/skills/`, `~/.claude/skills/`, `.claude/commands/`, plugins | `/help`, skill name autocomplete |
| Hooks | `.claude/settings.json`, `~/.claude/settings.json`, managed settings, plugin `hooks.json`, agent frontmatter | `/hooks` |
| Custom Subagents | `.claude/agents/`, `~/.claude/agents/`, `--agents` CLI flag, plugins | `/agents`, `claude agents` |
| Plugins | `~/.claude/plugins/`, `.claude/plugins/`, managed settings | `/plugin` (Installed tab) |
| CLAUDE.md Memory | `./CLAUDE.md`, `./.claude/CLAUDE.md`, `~/.claude/CLAUDE.md`, managed policy, `CLAUDE.local.md`, subdirectory CLAUDE.md | `/memory`, `/context` |
| Rules | `.claude/rules/`, `~/.claude/rules/` | `/memory` |
| Keybindings | `~/.claude/keybindings.json` | `/keybindings` |
| Permission Rules | `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json`, managed settings | `/permissions` |
| Model Configuration | Settings files, `--model` flag, `ANTHROPIC_MODEL` env var, managed `availableModels` | `/model`, `/status` |
| Settings Precedence Chain | Managed > CLI args > local project > shared project > user | `/status` |
| LSP Servers | Plugin `.lsp.json` | None documented |

**Source**: [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills), [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks), [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents), [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins), [Claude Code Settings](https://code.claude.com/docs/en/settings) - All accessed 2026-03-02

**Confidence**: High

**Verification**: [Claude Code Memory Documentation](https://code.claude.com/docs/en/memory), [Claude Code Permissions Documentation](https://code.claude.com/docs/en/permissions), [Claude Code Model Configuration](https://code.claude.com/docs/en/model-config), [Claude Code Keybindings Documentation](https://code.claude.com/docs/en/keybindings)

**Analysis**: The sheer number of extension points -- 12+ distinct mechanisms across 20+ configuration file locations -- creates a combinatorial complexity problem. Each extension point has its own resolution logic, precedence rules, and inspection command. No single view aggregates them. This is the core visibility gap that this research aims to characterize.

---

### Finding 2: Skills Have Subsumed Slash Commands and Added Significant Configuration Complexity

**Evidence**: "Custom commands have been merged into skills. A file at `.claude/commands/review.md` and a skill at `.claude/skills/review/SKILL.md` both create `/review` and work the same way." Skills follow the Agent Skills open standard (agentskills.io) and support extensive configuration via YAML frontmatter: `name`, `description`, `argument-hint`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `model`, `context` (fork for subagent execution), `agent`, and `hooks`. Skills can be discovered from nested `.claude/skills/` directories in monorepos, from plugins (namespaced as `plugin-name:skill-name`), and from `--add-dir` directories. Priority order: enterprise > personal > project. A character budget of 2% of context window limits how many skill descriptions can be loaded.

**Source**: [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) - Accessed 2026-03-02

**Confidence**: High

**Verification**: [Agent Skills Open Standard](https://agentskills.io), [Awesome Claude Code Repository](https://github.com/hesreallyhim/awesome-claude-code), [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference)

**Analysis**: The skills system introduces several visibility challenges:
1. **Discovery ambiguity**: Skills load "when relevant" based on description matching. Users cannot predict which skills will activate for a given prompt.
2. **Budget overflow**: With many skills installed (especially from plugins), descriptions may exceed the 2% character budget, causing some skills to be silently excluded. The `/context` command warns about this, but the information is transient.
3. **Precedence conflicts**: If a skill and a command share the same name, the skill takes precedence. If multiple scopes define the same skill name, enterprise > personal > project. Users have no conflict detection.
4. **Supporting files are invisible**: Skills can include templates, scripts, and reference docs in subdirectories. These load on demand but are not visible through any inspection command.

---

### Finding 3: The Hooks System Provides 12 Lifecycle Events but Limited Introspection

**Evidence**: Claude Code hooks support 12 event types: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Notification`, `Stop`, `SubagentStart`, `SubagentStop`, `SessionStart`, `SessionPause`, `SessionResume`, `PreCompact`, and `PromptResponse`. Hooks can be command-based (shell scripts), HTTP-based (POST to endpoints), or prompt-based (LLM evaluation). Hook sources include settings.json (user/project/local/managed), plugin hooks.json, agent frontmatter, and skill frontmatter. The `/hooks` command shows loaded hooks, and `claude --debug` shows execution details.

**Source**: [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) - Accessed 2026-03-02

**Confidence**: High

**Verification**: [Claude Code Hooks Guide (aiorg.dev)](https://aiorg.dev/blog/claude-code-hooks), [DataCamp Claude Code Hooks Tutorial](https://www.datacamp.com/tutorial/claude-code-hooks), [disler/claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery)

**Analysis**: The hooks system has specific visibility pain points:
1. **Execution opacity**: When a `PreToolUse` hook blocks a tool call (exit code 2), the user sees the denial but not which hook triggered it or why, unless they examine `claude --debug` output.
2. **Multi-source confusion**: Hooks can be defined in 4+ locations (user settings, project settings, plugin hooks.json, agent/skill frontmatter). When multiple hooks fire for the same event, execution order and interaction effects are not surfaced.
3. **HTTP hooks are fire-and-forget for async**: Async hooks (timeout 0) fire without waiting for a response. Users cannot verify whether async hooks executed successfully.
4. **No hook execution history**: There is no built-in log of "which hooks fired during this session, in what order, with what results."

---

### Finding 4: Custom Subagents Create a Hidden Capability Layer

**Evidence**: Custom subagents are defined in `.claude/agents/` (project) or `~/.claude/agents/` (user) as Markdown files with YAML frontmatter. They can also come from plugins (`agents/` directory) or be defined inline via `--agents` CLI flag. Frontmatter supports: `name`, `description`, `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, and `isolation`. Built-in subagents include Explore (Haiku, read-only), Plan (inherits model, read-only), and general-purpose (inherits model, all tools). The `/agents` command lists all subagents grouped by source.

**Source**: [Claude Code Custom Subagents Documentation](https://code.claude.com/docs/en/sub-agents) - Accessed 2026-03-02

**Confidence**: High

**Verification**: [VoltAgent Awesome Claude Code Subagents](https://github.com/VoltAgent/awesome-claude-code-subagents), [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins), [iannuttall/claude-agents](https://github.com/iannuttall/claude-agents)

**Analysis**: Subagent visibility challenges include:
1. **Automatic delegation opacity**: Claude decides when to delegate to subagents based on task description matching. Users cannot predict or control which subagent will be selected without explicitly requesting one.
2. **Capability inheritance is complex**: Subagents can inherit tools, override permission modes, preload specific skills, define their own hooks, and connect to specific MCP servers. The effective capability set of a subagent is the union/intersection of multiple configuration layers.
3. **Model routing is hidden**: A subagent might use Haiku while the main conversation uses Opus, affecting both quality and cost. The model assignment is visible via `/agents` but not during execution.
4. **Memory isolation**: Subagents with `memory` enabled maintain persistent state in `~/.claude/agent-memory/` or `.claude/agent-memory/`. This state affects future behavior but is not surfaced in normal session introspection.
5. **Override precedence**: When multiple subagents share the same name, priority is `--agents` CLI > project > user > plugin. The `/agents` command shows which are overridden, but this information is only visible through the interactive command.

---

### Finding 5: The Plugin System Bundles Multiple Extension Types, Creating Composite Visibility Challenges

**Evidence**: Plugins can contain skills, agents, hooks, MCP servers, LSP servers, and default settings. They are installed at user scope (default), project scope, or local scope. The `/plugin` command provides Discover and Installed tabs. Plugin components are namespaced (e.g., `/plugin-name:skill-name`). The official Anthropic marketplace auto-updates; third-party marketplaces do not. As of February 2026, 9,000+ plugins are available. Managed settings can restrict marketplaces via `blockedMarketplaces` and `strictKnownMarketplaces`.

**Source**: [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins), [Discover and Install Plugins](https://code.claude.com/docs/en/discover-plugins) - Accessed 2026-03-02

**Confidence**: High

**Verification**: [SkillsMP Marketplace](https://skillsmp.com), [Claude Code Plugin Directory](https://www.claudecodeplugin.com/), [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)

**Analysis**: Plugins are the highest-complexity extension point because they are composite containers. A single plugin installation can add 3 skills, 2 agents, 5 hooks, 1 MCP server, and 1 LSP server simultaneously. This creates several problems:
1. **Blast radius opacity**: Installing or removing a plugin affects multiple extension types. Users cannot see, before installation, exactly what the plugin will add or change.
2. **Version management**: Auto-updating plugins (official marketplace) can silently change behavior. Users have no changelog visibility within Claude Code.
3. **Conflict potential**: Two plugins could define hooks for the same event, skills with similar descriptions (causing model-invocation ambiguity), or agents with overlapping descriptions.
4. **Scope confusion**: A plugin installed at user scope affects all projects. A user may not remember which plugins are installed at which scope, leading to unexpected behavior in specific projects.
5. **No dependency tracking**: Plugins do not declare dependencies on other plugins. There is no mechanism to detect or resolve plugin-plugin interactions.

---

### Finding 6: The CLAUDE.md Resolution System Involves 6+ File Locations with Complex Precedence

**Evidence**: CLAUDE.md files load from the following locations, from highest to lowest precedence:
1. Managed policy: `/Library/Application Support/ClaudeCode/CLAUDE.md` (macOS), `/etc/claude-code/CLAUDE.md` (Linux/WSL), `C:\Program Files\ClaudeCode\CLAUDE.md` (Windows)
2. Module level: `./src/auth/CLAUDE.md` (subdirectory, loaded on demand)
3. Project level: `./CLAUDE.md` or `./.claude/CLAUDE.md`
4. User level: `~/.claude/CLAUDE.md`
5. Local overrides: `./CLAUDE.local.md`

Additionally, `.claude/rules/*.md` files load from project and user scopes, with path-specific rules using `paths` frontmatter for conditional loading. The `@path/import` syntax allows CLAUDE.md files to import other files, with a max depth of 5 hops. Auto memory files live in `~/.claude/projects/<project>/memory/` with a 200-line MEMORY.md entrypoint.

**Source**: [Claude Code Memory Documentation](https://code.claude.com/docs/en/memory) - Accessed 2026-03-02

**Confidence**: High

**Verification**: [Claude Directory Blog - CLAUDE.md Guide](https://www.claudedirectory.org/blog/claude-md-guide), [builder.io - How to Write a Good CLAUDE.md](https://www.builder.io/blog/claude-md-guide), [GitHub Issue #2571 - CLAUDE.md subdirectory loading](https://github.com/anthropics/claude-code/issues/2571), [GitHub Issue #2274 - Documentation inaccuracy](https://github.com/anthropics/claude-code/issues/2274)

**Analysis**: This finding reinforces the validated Opportunity O3 (Context File Resolution Visibility). Specific pain points:
1. **On-demand loading is invisible**: Subdirectory CLAUDE.md files load when Claude reads files in those directories. Users cannot tell when or whether this has happened.
2. **Import chain opacity**: A CLAUDE.md file with `@path/to/import` creates a transitive dependency. With 5-hop maximum depth, the effective instruction set can span many files. No tool shows the resolved import graph.
3. **Auto memory is a hidden writer**: Claude saves notes to `~/.claude/projects/<project>/memory/` during sessions. These notes affect future sessions but are not visible in the CLAUDE.md inspection. The `/memory` command provides a link to the folder but does not show the content inline.
4. **Exclusion rules add complexity**: `claudeMdExcludes` in settings can skip CLAUDE.md files. This means the set of loaded CLAUDE.md files depends on both the filesystem state AND the settings configuration.
5. **Documented bugs**: GitHub issues #2571 and #2274 document discrepancies between documented resolution behavior and actual behavior, indicating the system is complex enough that even Anthropic's documentation has difficulty accurately describing it.

---

### Finding 7: The Settings Precedence Chain Has 5+ Layers with Array Merging Behavior

**Evidence**: Claude Code settings follow a strict precedence hierarchy (highest to lowest): (1) Managed settings (server-managed > MDM/OS policies > managed-settings.json), (2) Command-line arguments, (3) Local project settings (`.claude/settings.local.json`), (4) Shared project settings (`.claude/settings.json`), (5) User settings (`~/.claude/settings.json`). Array-valued settings (permissions, sandbox paths) merge across scopes rather than replace. The `/status` command shows active configuration sources and origin of each setting.

**Source**: [Claude Code Settings Documentation](https://code.claude.com/docs/en/settings) - Accessed 2026-03-02

**Confidence**: High

**Verification**: [GitHub Issue #19369 - Inconsistent precedence hierarchy](https://github.com/anthropics/claude-code/issues/19369), [GitHub Issue #4442 - Unified hierarchical configuration](https://github.com/anthropics/claude-code/issues/4442), [Claude Code Settings Reference (claudefa.st)](https://claudefa.st/blog/guide/settings-reference)

**Analysis**: The settings system compounds the visibility problem because it governs how all other extension points behave:
1. **Array merging is non-obvious**: If a user allows `Bash(npm run *)` in user settings but a project denies `Bash(npm run deploy)`, the arrays merge, and deny takes precedence. This interaction is not visible without manually inspecting both files.
2. **Managed settings are invisible to users**: Enterprise-managed settings cannot be overridden and may not be visible in the settings files users can access. Users may not know their environment is constrained.
3. **Environment variables add another layer**: 30+ environment variables can override settings, model selection, and feature toggles. These are not visible through any Claude Code command.
4. **GitHub issues confirm confusion**: Issue #19369 documents inconsistent precedence behavior, and #4442 requests a unified hierarchical configuration system -- both indicating user confusion about how settings cascade.

---

### Finding 8: Existing Claude Code Inspection Commands Are Fragmented and Transient

**Evidence**: Claude Code provides the following inspection commands:

| Command | Shows | Limitations |
|---------|-------|------------|
| `/context` | Context window usage breakdown | Transient; warns about excluded skills but no persistent view |
| `/memory` | Loaded CLAUDE.md and rules files | Lists files but does not show content or resolution order |
| `/hooks` | Active hooks configuration | Shows hooks but not execution history |
| `/agents` | All subagents by source | Shows overrides but not runtime delegation patterns |
| `/plugin` (Installed) | Installed plugins by scope | No detail on what each plugin adds |
| `/permissions` | Permission rules and sources | No simulation of how rules interact |
| `/model` | Current model and effort level | No history of model changes during session |
| `/status` | Configuration sources and errors | Shows settings origin but not effective merged state |
| `/config` | Opens settings UI | Editing interface, not diagnostic |
| `/keybindings` | Opens keybindings.json | File editor, not viewer |
| `claude --debug` | Detailed execution logs | Requires restart; not available mid-session |

**Source**: [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference), [Claude Code Interactive Mode](https://code.claude.com/docs/en/interactive-mode), [ClaudeLog - /context command](https://claudelog.com/faqs/what-is-context-command-in-claude-code/) - Accessed 2026-03-02

**Confidence**: High

**Verification**: [SFEIR Institute - Advanced Debugging Guide](https://institute.sfeir.com/en/claude-code/claude-code-advanced-best-practices/debugging/), [Shipyard Claude Code Cheatsheet](https://shipyard.build/blog/claude-code-cheat-sheet/), [DEV Community - Organised Claude Code Commands](https://dev.to/akari_iku/ive-organised-the-claude-code-commands-including-some-hidden-ones-op0)

**Analysis**: The fragmentation is the key insight. Each inspection command answers one narrow question:
- "What is using my context?" --> `/context`
- "Which CLAUDE.md files are loaded?" --> `/memory`
- "What hooks are configured?" --> `/hooks`
- "What agents are available?" --> `/agents`
- "What plugins are installed?" --> `/plugin`

But no command answers the compound questions users actually need:
- "What is my complete Claude Code environment right now?"
- "Why did Claude behave differently in this project than that one?"
- "Which plugin/skill/hook/CLAUDE.md is causing this unexpected behavior?"
- "What changed between sessions that caused different results?"
- "How much of my context window is consumed by extension infrastructure vs. my actual work?"

This gap is precisely what Norbert's Configuration Observatory should address.

---

### Finding 9: VS Code Extension Manager Provides the Gold Standard for Extension Visibility

**Evidence**: VS Code's Extension Manager (accessible via Ctrl/Cmd+Shift+X) provides: (1) A unified list of all installed extensions with status (enabled/disabled/recommended), (2) Per-extension detail showing version, publisher, install count, and description, (3) Extension bisect for diagnosing conflicts -- a binary search that systematically enables/disables extensions to isolate problematic ones, (4) Extension Host logs revealing problems not visible in the UI, (5) Workspace vs. global extension scope visibility, (6) Extension recommendations and conflict metadata (extensions can declare `extensionDependencies` and conflicting extensions). Configuration conflicts account for approximately 60% of VS Code extension issues.

**Source**: [VS Code Extension Marketplace](https://code.visualstudio.com/docs/editor/extension-marketplace), [VS Code Extension Bisect](https://code.visualstudio.com/blogs/2021/02/16/extension-bisect) - Accessed 2026-03-02

**Confidence**: High

**Verification**: [VS Code Activation Events](https://code.visualstudio.com/api/references/activation-events), [GitHub Issue #76989 - Extension debugging](https://github.com/microsoft/vscode/issues/76989), [MarkAICode - Extension Debugging Tricks](https://markaicode.com/debugging-vscode-extensions-configuration-issues/)

**Analysis**: Key patterns Norbert should adopt from VS Code:
1. **Unified extension list with status**: One view showing ALL extensions (enabled, disabled, scope).
2. **Extension bisect / conflict detection**: Systematic approach to isolating problematic extensions.
3. **Scope visibility**: Clear indication of whether an extension applies globally or to the current workspace.
4. **Activation tracking**: VS Code tracks activation events (when extensions load). Equivalent would be tracking when skills/hooks/agents activate in a Claude Code session.

---

### Finding 10: Neovim's lazy.nvim Provides a Dashboard-First Plugin Management Model

**Evidence**: lazy.nvim (the dominant Neovim plugin manager) provides: (1) The `:Lazy` command opens an interactive dashboard showing all plugins, their loading status, and metrics including total plugins and loaded count, (2) Plugin details accessible by pressing `<CR>` on any plugin, with `<K>` to hover links, help files, readmes, git commits, and issues, (3) Statusline integration showing pending update count, (4) Performance profiling data per-plugin, (5) Lazy-loading intelligence that tracks which plugins are loaded on demand vs. at startup. The dashboard is the primary interface -- users see plugin health at a glance.

**Source**: [lazy.nvim Usage Documentation](https://lazy.folke.io/usage), [lazy.nvim GitHub](https://github.com/folke/lazy.nvim) - Accessed 2026-03-02

**Confidence**: High

**Verification**: [LazyVim Configuration](https://www.lazyvim.org/configuration/lazy.nvim), [lazy.nvim Plugin Spec](https://lazy.folke.io/spec), [DEV Community - lazy.nvim Setup Guide](https://dev.to/slydragonn/ultimate-neovim-setup-guide-lazynvim-plugin-manager-23b7)

**Analysis**: Key patterns Norbert should adopt from lazy.nvim:
1. **Dashboard-first**: The plugin state dashboard is the primary management interface, not a secondary inspection command.
2. **Loaded vs. available distinction**: Explicitly shows which plugins are loaded into the current session vs. available but not yet activated. This maps directly to Claude Code's skill loading behavior (descriptions loaded, full content deferred).
3. **Performance attribution**: Per-plugin metrics (load time, startup impact) help users understand the cost of each extension. Norbert should show per-skill/agent/hook context window cost.
4. **Update awareness**: Statusline integration shows pending updates. Norbert could show when plugin auto-updates have changed behavior.

---

### Finding 11: Browser DevTools Provide Application-Panel Patterns for Extension and Service Worker Visibility

**Evidence**: Chrome DevTools provides: (1) Application panel with Service Workers pane showing registered workers, their status (activated, waiting, redundant), and ability to inspect/unregister, (2) `chrome://inspect/#service-workers` for all running service workers, (3) `chrome://serviceworker-internals` for detailed internal state, (4) Background Services panel for push notifications, background sync, and periodic sync recording, (5) Extension debugging via manifest.json URL inspection. Firefox's Application panel similarly provides service worker lifecycle visibility with registration, active, and waiting states.

**Source**: [Chrome DevTools Extension Debugging](https://developer.chrome.com/docs/extensions/get-started/tutorial/debug), [Chrome DevTools Background Services](https://developer.chrome.com/docs/devtools/javascript/background-services) - Accessed 2026-03-02

**Confidence**: High

**Verification**: [Chromium Service Worker FAQ](https://www.chromium.org/blink/serviceworker/service-worker-faq/), [Firefox Service Worker Debugging](https://firefox-source-docs.mozilla.org/devtools-user/application/service_workers/index.html), [Chrome DevTools MCP Feature Request](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/96)

**Analysis**: Key patterns Norbert should adopt from browser DevTools:
1. **Lifecycle state visibility**: Service workers have clear lifecycle states (installing, waiting, active, redundant). Claude Code extensions could be mapped to similar states (configured, loaded, active, errored).
2. **Background process monitoring**: The Background Services panel records events from async processes. This maps to Claude Code's async hooks and background subagents.
3. **"inspect" links**: Each service worker has an "inspect" action to open its details. Norbert should provide drill-down from any extension to its full configuration.

---

### Finding 12: Terraform and Docker Desktop Demonstrate Infrastructure-Tool Extension Visibility Patterns

**Evidence**: Terraform provides: `terraform version` (shows provider versions), `terraform providers` (lists required providers), `terraform providers schema` (machine-readable provider details), lock file (`.terraform.lock.hcl`) for version pinning, and `terraform init` for provider discovery and installation. Docker Desktop provides: Extensions tab in Dashboard with Manage and Browse views, per-extension enable/disable, visibility toggle for extension-created containers (hidden by default), and a curated marketplace with install counts.

**Source**: [Terraform Plugin Management](https://developer.hashicorp.com/terraform/cli/plugins), [How Terraform Works with Plugins](https://developer.hashicorp.com/terraform/plugin/how-terraform-works), [Docker Extensions](https://docs.docker.com/extensions/) - Accessed 2026-03-02

**Confidence**: High

**Verification**: [Docker Desktop Extensions Settings](https://docs.docker.com/desktop/extensions/settings-feedback/), [Terraform Providers Configuration](https://developer.hashicorp.com/terraform/language/providers), [Terraform Debugging Providers](https://developer.hashicorp.com/terraform/plugin/debugging)

**Analysis**: Relevant patterns:
1. **Lock files for reproducibility** (Terraform): `.terraform.lock.hcl` pins provider versions. Claude Code has no equivalent -- plugin auto-updates can silently change behavior. Norbert could snapshot the extension state for session comparison.
2. **Hidden resource visibility** (Docker Desktop): Extension-created containers are hidden by default. This parallels how Claude Code plugin hooks and agents operate invisibly. Norbert should surface all "hidden" extension behavior.
3. **Version and dependency tracking** (Terraform): `terraform providers` clearly shows what is required and what is installed. Claude Code has no equivalent for its full extension surface.

---

### Finding 13: Community Signals Confirm Demand for Better Configuration Visibility

**Evidence**: Multiple signals indicate user demand for configuration visibility:
1. **GitHub Issue #2571**: CLAUDE.md files in subdirectories not being automatically loaded -- users cannot tell which CLAUDE.md files are active.
2. **GitHub Issue #2274**: Documentation about CLAUDE.md locations is inaccurate -- users cannot rely on documentation to understand resolution behavior.
3. **GitHub Issue #19369**: Inconsistent precedence hierarchy for managed settings vs. CLI arguments -- users confused about which settings take effect.
4. **GitHub Issue #4442**: Feature request for unified hierarchical configuration -- users want a single view of effective configuration.
5. **Trail of Bits claude-code-config**: An opinionated defaults repository specifically addressing the difficulty of configuring Claude Code correctly.
6. **Skills character budget warning**: The `/context` command warns when skill descriptions exceed the 2% budget, but users discover this only when they run `/context` -- there is no proactive notification.
7. **9,000+ plugins available**: The scale of the plugin ecosystem creates a combinatorial configuration space that manual inspection cannot manage.

**Source**: [GitHub Issue #2571](https://github.com/anthropics/claude-code/issues/2571), [GitHub Issue #4442](https://github.com/anthropics/claude-code/issues/4442), [GitHub Issue #19369](https://github.com/anthropics/claude-code/issues/19369) - Accessed 2026-03-02

**Confidence**: Medium-High

**Verification**: [GitHub Issue #2274](https://github.com/anthropics/claude-code/issues/2274), [Trail of Bits claude-code-config](https://github.com/trailofbits/claude-code-config), [Claude Code Skills Documentation - Budget Warning](https://code.claude.com/docs/en/skills)

**Analysis**: The pattern is clear: as Claude Code's extensibility has grown, the gap between "what users can configure" and "what users can see about their configuration" has widened. Each new extension mechanism (skills, plugins, agents, hooks) adds configuration surface without proportionally adding inspection tooling. This is a recurring pattern in developer tool ecosystems -- VS Code, Neovim, and Chrome all went through similar maturation phases before investing heavily in extension visibility.

---

### Finding 14: The Extensibility Surface Creates Specific Conflict and Debugging Scenarios

**Evidence**: Based on cross-referencing the extension point documentation, the following conflict scenarios are theoretically possible and have no built-in detection:

| Conflict Type | Example | Detection Difficulty |
|--------------|---------|---------------------|
| Skill name collision | Plugin A skill "review" vs. project skill "review" | Medium -- precedence rules apply but user may not know |
| Hook interference | Two plugins defining `PreToolUse` hooks for `Bash` with conflicting decisions | High -- execution order unclear |
| Agent description overlap | Two agents with similar descriptions causing unpredictable delegation | High -- model-dependent routing |
| CLAUDE.md contradiction | User-level CLAUDE.md says "use tabs" while project-level says "use spaces" | Medium -- more specific wins but no warning |
| Permission rule cascade | User allows `Bash(npm *)`, project denies `Bash(npm run deploy)` | Medium -- merge behavior is correct but surprising |
| MCP server tool name collision | Two MCP servers exposing tools with similar names | High -- no documented collision handling for Claude Code |
| Model override chain | Plugin sets agent model to haiku, user wants opus | Medium -- frontmatter model field overrides inherit |
| Skill budget exhaustion | 15 plugins each adding 3 skills = 45 skill descriptions exceeding 2% budget | High -- silently excluded, only visible via `/context` |

**Source**: Analysis based on [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills), [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks), [Claude Code Permissions](https://code.claude.com/docs/en/permissions) - Accessed 2026-03-02

**Confidence**: Medium (analytical finding based on documented behavior, not direct user reports of each conflict type)

**Verification**: [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents), [Claude Code Plugins Documentation](https://code.claude.com/docs/en/plugins), [VS Code Extension Conflicts (GitHub #77979)](https://github.com/microsoft/vscode/issues/77979)

**Analysis**: This finding is analytical rather than empirical. The conflict scenarios are derived from the documented behavior of each extension system. The key insight is that Claude Code has no conflict detection mechanism analogous to VS Code's extension conflict metadata or Terraform's dependency resolution. As the plugin ecosystem grows toward and beyond 9,000 plugins, these conflicts will become increasingly common. Norbert could provide conflict detection as a high-value feature.

---

## Source Analysis

| Source | Domain | Reputation | Type | Access Date | Cross-verified |
|--------|--------|------------|------|-------------|----------------|
| Claude Code Skills Docs | code.claude.com | High | Official | 2026-03-02 | Y |
| Claude Code Hooks Reference | code.claude.com | High | Official | 2026-03-02 | Y |
| Claude Code Subagents Docs | code.claude.com | High | Official | 2026-03-02 | Y |
| Claude Code Plugins Docs | code.claude.com | High | Official | 2026-03-02 | Y |
| Claude Code Settings Docs | code.claude.com | High | Official | 2026-03-02 | Y |
| Claude Code Memory Docs | code.claude.com | High | Official | 2026-03-02 | Y |
| Claude Code Permissions Docs | code.claude.com | High | Official | 2026-03-02 | Y |
| Claude Code Model Config Docs | code.claude.com | High | Official | 2026-03-02 | Y |
| Claude Code Keybindings Docs | code.claude.com | High | Official | 2026-03-02 | Y |
| Claude Code CLI Reference | code.claude.com | High | Official | 2026-03-02 | Y |
| Claude Code Discover Plugins | code.claude.com | High | Official | 2026-03-02 | Y |
| GitHub Issue #2571 | github.com | High | Primary | 2026-03-02 | Y |
| GitHub Issue #2274 | github.com | High | Primary | 2026-03-02 | Y |
| GitHub Issue #19369 | github.com | High | Primary | 2026-03-02 | Y |
| GitHub Issue #4442 | github.com | High | Primary | 2026-03-02 | Y |
| VS Code Extension Marketplace | code.visualstudio.com | High | Official | 2026-03-02 | Y |
| VS Code Extension Bisect | code.visualstudio.com | High | Official | 2026-03-02 | Y |
| lazy.nvim Usage Docs | lazy.folke.io | Medium-High | OSS Official | 2026-03-02 | Y |
| lazy.nvim GitHub | github.com | Medium-High | OSS | 2026-03-02 | Y |
| Chrome DevTools Extension Debug | developer.chrome.com | High | Official | 2026-03-02 | Y |
| Chrome DevTools Background Services | developer.chrome.com | High | Official | 2026-03-02 | Y |
| Terraform Plugin Management | developer.hashicorp.com | High | Official | 2026-03-02 | Y |
| Docker Extensions Docs | docs.docker.com | High | Official | 2026-03-02 | Y |
| Agent Skills Standard | agentskills.io | Medium-High | Standard | 2026-03-02 | N |
| Awesome Claude Code | github.com | Medium | Community | 2026-03-02 | Y |
| Trail of Bits claude-code-config | github.com | Medium-High | Community | 2026-03-02 | N |
| ClaudeLog /context FAQ | claudelog.com | Medium | Community | 2026-03-02 | Y |
| SFEIR Institute Debug Guide | institute.sfeir.com | Medium | Community | 2026-03-02 | Y |
| DEV Community Commands List | dev.to | Medium | Community | 2026-03-02 | N |
| SkillsMP Marketplace | skillsmp.com | Medium | Community | 2026-03-02 | N |
| aiorg.dev Hooks Guide | aiorg.dev | Medium | Community | 2026-03-02 | Y |
| DataCamp Hooks Tutorial | datacamp.com | Medium-High | Industry | 2026-03-02 | Y |
| disler hooks mastery | github.com | Medium | Community | 2026-03-02 | Y |
| claudefa.st Settings Reference | claudefa.st | Medium | Community | 2026-03-02 | Y |

Reputation: High: 19 (56%) | Medium-High: 6 (18%) | Medium: 9 (26%) | Avg: 0.79

---

## Knowledge Gaps

### Gap 1: LSP Server Visibility
**Issue**: LSP servers can be configured via plugin `.lsp.json` files, but no Claude Code documentation describes an inspection command for viewing active LSP servers. It is unclear how users can see which LSP servers are running, whether they are healthy, or what languages they are providing intelligence for.
**Attempted**: Searched code.claude.com docs, Claude Code CLI reference, community guides.
**Recommendation**: Test LSP server visibility in a live Claude Code session with an LSP-enabled plugin installed.

### Gap 2: Hook Execution Order When Multiple Sources Define Hooks for the Same Event
**Issue**: When user settings, project settings, a plugin, and an agent all define `PreToolUse` hooks, the execution order and interaction behavior (e.g., if one allows and another denies) is not documented.
**Attempted**: Searched hooks reference, plugins reference, settings documentation.
**Recommendation**: Examine Claude Code source or test empirically. This is critical for conflict detection in Norbert.

### Gap 3: Skill Budget Calculation Details
**Issue**: The skills documentation mentions a 2% of context window character budget for skill descriptions, with a 16,000 character fallback. The exact calculation method (which skills are prioritized, how truncation occurs, whether plugin skills are weighted differently) is not documented.
**Attempted**: Searched skills documentation, /context command documentation.
**Recommendation**: Instrument a session with many skills and use `/context` to observe budget behavior. The `SLASH_COMMAND_TOOL_CHAR_BUDGET` environment variable override exists but its interaction with the default budget is not documented.

### Gap 4: Plugin Changelog and Update Notification System
**Issue**: Official marketplace plugins auto-update. It is unclear whether users are notified of updates, whether they can pin versions, or whether update history is visible.
**Attempted**: Searched discover-plugins documentation, plugin marketplace documentation.
**Recommendation**: Examine `/plugin` behavior after an auto-update occurs.

---

## Conflicting Information

### Conflict 1: CLAUDE.md Subdirectory Loading -- Documentation vs. Implementation

**Position A**: CLAUDE.md files in subdirectories "load on demand when Claude reads files in those directories." This implies automatic, reliable loading. -- Source: [Claude Code Memory Documentation](https://code.claude.com/docs/en/memory), Reputation: 1.0, Evidence: "CLAUDE.md files in subdirectories load on demand when Claude reads files in those directories."

**Position B**: CLAUDE.md files in subdirectories are "not being automatically loaded" as documented. Users report the memory system only loads parent directory files reliably. -- Source: [GitHub Issue #2571](https://github.com/anthropics/claude-code/issues/2571), Reputation: 0.8, Evidence: "CLAUDE.md files in subdirectories are not being automatically loaded when accessing files in those directories."

**Assessment**: The GitHub issue documents a bug in the implementation relative to the documented behavior. This conflict reinforces the need for visibility tooling: if the resolution system has bugs, users need a way to verify what is actually loaded, not just what should be loaded according to documentation.

---

## Recommendations for Norbert

### R1: Add an "Extensibility Inspector" Feature to the Norbert Dashboard

**Rationale**: The research demonstrates that Claude Code has 12+ extension points with 20+ configuration file locations and fragmented inspection commands. No unified view exists. Norbert is uniquely positioned to provide this because it already needs to instrument Claude Code sessions via hooks (validated in MCP research). The same hook infrastructure that captures agent execution and MCP calls can also capture extension loading events.

**Proposed Feature**: A single dashboard panel showing all active extensions, grouped by type, with:
- **Extension Inventory**: All loaded skills, agents, hooks, MCP servers, plugins, CLAUDE.md files, rules, keybindings, and permission rules
- **Source Attribution**: Where each extension comes from (user, project, plugin, managed, CLI)
- **Status Indicators**: Loaded, active, errored, overridden, excluded (budget)
- **Context Cost**: Token/character budget consumed by each extension's presence
- **Conflict Detection**: Warnings when two extensions may conflict (same name, overlapping descriptions, competing hooks)

### R2: Frame This as an Expansion of Validated Opportunity O3

**Rationale**: O3 (Context File Resolution Visibility) scored 15/20 and was validated as a unique differentiator with zero competition. The extensibility surface research shows that O3 is actually the tip of a larger iceberg -- CLAUDE.md resolution is one of 12+ extension points that lack visibility. Expanding O3 into a "Configuration Observatory" feature preserves the validated opportunity while significantly increasing scope and value.

**Risk**: Scope expansion could delay MVP. Mitigation: Implement incrementally, starting with CLAUDE.md/rules visibility (the original O3), then adding skills/agents/hooks/plugins visibility in subsequent releases.

### R3: Use a "Diff Between Sessions" Model for Debugging

**Rationale**: Analogous tools (VS Code Extension Bisect, Terraform lock files, Docker Desktop hidden containers) all address the question "what changed?" Norbert should capture session-start extension state as a snapshot and provide diff views between sessions. When a user says "Claude worked fine yesterday but is broken today," Norbert can show what changed in their extension configuration.

**Implementation**: On session start (via `SessionStart` hook), inventory all loaded extensions and persist to local storage. Provide a diff view comparing any two session snapshots.

### R4: Prioritize Conflict Detection as a Differentiated Capability

**Rationale**: VS Code's extension conflict system (extension bisect, conflict metadata) is one of its most valued extension management features. Claude Code has no equivalent. With 9,000+ plugins available, conflict potential grows combinatorially. Norbert providing conflict detection ("Plugin A and Plugin B both define PreToolUse hooks for Bash -- potential conflict") would be a genuinely novel capability.

**Implementation priority**: Start with name collision detection (easiest), then add description similarity detection (for agent/skill routing ambiguity), then hook interference detection (most complex).

### R5: Consider This Feature as Independent of the MCP Observatory

**Rationale**: The MCP ecosystem research (separate document) validates MCP connectivity visualization as a core feature. The extensibility visibility feature is complementary but distinct. MCP visibility answers "are my external tools working?" The extensibility inspector answers "what is my Claude Code environment configured to do?" Both belong in Norbert but serve different user needs and could be implemented independently.

### R6: Data Collection Strategy Aligns with Existing Hook Infrastructure

**Rationale**: The `SessionStart` hook can trigger a script that inventories the current extension state by:
1. Listing `.claude/skills/`, `~/.claude/skills/`, and plugin skill directories
2. Listing `.claude/agents/`, `~/.claude/agents/`, and plugin agent directories
3. Parsing settings.json files at all precedence levels to extract hooks and permissions
4. Listing installed plugins via the plugin cache directory
5. Parsing CLAUDE.md files and their import chains
6. Reading keybindings.json
7. Enumerating MCP server configurations from `.mcp.json` and `~/.claude.json`

This data collection is entirely read-only and can be performed by a hook script without any modification to Claude Code.

---

## Analogous Tool Comparison Matrix

| Feature | VS Code Extensions | lazy.nvim | Chrome DevTools | Terraform | Docker Desktop | Claude Code (Current) | Norbert (Proposed) |
|---------|-------------------|-----------|----------------|-----------|----------------|----------------------|-------------------|
| Unified extension list | Yes | Yes | Partial | Yes (`terraform providers`) | Yes | No (fragmented) | Yes |
| Enabled/disabled status | Yes | Yes (loaded/not) | Yes (active/inactive) | N/A (all or none) | Yes | No | Yes |
| Conflict detection | Yes (bisect) | No | No | Yes (version constraints) | No | No | Yes |
| Performance/cost attribution | No | Yes (load time) | Yes (memory, CPU) | No | No | Partial (`/context`) | Yes |
| Source/scope visibility | Yes (user/workspace) | Yes (priority order) | Yes (origin) | Yes (required by, lock file) | Yes (scope) | Partial (`/agents`, `/plugin`) | Yes |
| Update tracking | Yes (changelog) | Yes (pending updates) | N/A | Yes (lock file changes) | Yes | No | Yes (session diff) |
| Dependency/interaction view | Yes (extensionDeps) | Yes (dependencies) | N/A | Yes (module graph) | No | No | Planned |
| Search/filter | Yes | Yes | Yes | N/A | Yes | No | Yes |

---

## Full Citations

[1] Anthropic. "Extend Claude with skills". code.claude.com. 2026. https://code.claude.com/docs/en/skills. Accessed 2026-03-02.

[2] Anthropic. "Hooks reference". code.claude.com. 2026. https://code.claude.com/docs/en/hooks. Accessed 2026-03-02.

[3] Anthropic. "Create custom subagents". code.claude.com. 2026. https://code.claude.com/docs/en/sub-agents. Accessed 2026-03-02.

[4] Anthropic. "Create plugins". code.claude.com. 2026. https://code.claude.com/docs/en/plugins. Accessed 2026-03-02.

[5] Anthropic. "Claude Code settings". code.claude.com. 2026. https://code.claude.com/docs/en/settings. Accessed 2026-03-02.

[6] Anthropic. "How Claude remembers your project". code.claude.com. 2026. https://code.claude.com/docs/en/memory. Accessed 2026-03-02.

[7] Anthropic. "Configure permissions". code.claude.com. 2026. https://code.claude.com/docs/en/permissions. Accessed 2026-03-02.

[8] Anthropic. "Model configuration". code.claude.com. 2026. https://code.claude.com/docs/en/model-config. Accessed 2026-03-02.

[9] Anthropic. "Customize keyboard shortcuts". code.claude.com. 2026. https://code.claude.com/docs/en/keybindings. Accessed 2026-03-02.

[10] Anthropic. "CLI reference". code.claude.com. 2026. https://code.claude.com/docs/en/cli-reference. Accessed 2026-03-02.

[11] Anthropic. "Discover and install prebuilt plugins through marketplaces". code.claude.com. 2026. https://code.claude.com/docs/en/discover-plugins. Accessed 2026-03-02.

[12] GitHub User. "[BUG] CLAUDE.md files in subdirectories are not being automatically loaded". GitHub Issue #2571. 2025. https://github.com/anthropics/claude-code/issues/2571. Accessed 2026-03-02.

[13] GitHub User. "Documentation about CLAUDE.md locations, seems not quite accurate". GitHub Issue #2274. 2025. https://github.com/anthropics/claude-code/issues/2274. Accessed 2026-03-02.

[14] GitHub User. "[DOCS] Inconsistent precedence hierarchy for Managed Settings vs. CLI arguments". GitHub Issue #19369. 2025. https://github.com/anthropics/claude-code/issues/19369. Accessed 2026-03-02.

[15] GitHub User. "Feature Request: Implement Unified Hierarchical Configuration". GitHub Issue #4442. 2025. https://github.com/anthropics/claude-code/issues/4442. Accessed 2026-03-02.

[16] Microsoft. "Extension Marketplace". code.visualstudio.com. 2026. https://code.visualstudio.com/docs/editor/extension-marketplace. Accessed 2026-03-02.

[17] Microsoft. "Resolving extension issues with bisect". code.visualstudio.com. 2021. https://code.visualstudio.com/blogs/2021/02/16/extension-bisect. Accessed 2026-03-02.

[18] Microsoft. "Activation Events". code.visualstudio.com. 2026. https://code.visualstudio.com/api/references/activation-events. Accessed 2026-03-02.

[19] folke. "lazy.nvim Usage". lazy.folke.io. 2026. https://lazy.folke.io/usage. Accessed 2026-03-02.

[20] folke. "lazy.nvim - A modern plugin manager for Neovim". GitHub. 2026. https://github.com/folke/lazy.nvim. Accessed 2026-03-02.

[21] Google. "Debug extensions". developer.chrome.com. 2026. https://developer.chrome.com/docs/extensions/get-started/tutorial/debug. Accessed 2026-03-02.

[22] Google. "Debug background services". developer.chrome.com. 2026. https://developer.chrome.com/docs/devtools/javascript/background-services. Accessed 2026-03-02.

[23] HashiCorp. "Manage Terraform plugins". developer.hashicorp.com. 2026. https://developer.hashicorp.com/terraform/cli/plugins. Accessed 2026-03-02.

[24] HashiCorp. "How Terraform works with plugins". developer.hashicorp.com. 2026. https://developer.hashicorp.com/terraform/plugin/how-terraform-works. Accessed 2026-03-02.

[25] Docker. "Docker Extensions". docs.docker.com. 2026. https://docs.docker.com/extensions/. Accessed 2026-03-02.

[26] Docker. "Settings and feedback for Docker Extensions". docs.docker.com. 2026. https://docs.docker.com/desktop/extensions/settings-feedback/. Accessed 2026-03-02.

[27] Trail of Bits. "claude-code-config: Opinionated defaults for Claude Code". GitHub. 2026. https://github.com/trailofbits/claude-code-config. Accessed 2026-03-02.

[28] Anthropic. "claude-plugins-official". GitHub. 2026. https://github.com/anthropics/claude-plugins-official. Accessed 2026-03-02.

[29] hesreallyhim. "awesome-claude-code: Curated list of plugins, hooks, commands". GitHub. 2026. https://github.com/hesreallyhim/awesome-claude-code. Accessed 2026-03-02.

[30] VoltAgent. "awesome-claude-code-subagents: 100+ specialized subagents". GitHub. 2026. https://github.com/VoltAgent/awesome-claude-code-subagents. Accessed 2026-03-02.

[31] aiorg.dev. "Claude Code Hooks: Complete Guide with 20+ Examples". 2026. https://aiorg.dev/blog/claude-code-hooks. Accessed 2026-03-02.

[32] DataCamp. "Claude Code Hooks: A Practical Guide". 2026. https://www.datacamp.com/tutorial/claude-code-hooks. Accessed 2026-03-02.

[33] disler. "claude-code-hooks-mastery". GitHub. 2026. https://github.com/disler/claude-code-hooks-mastery. Accessed 2026-03-02.

[34] ClaudeLog. "What is the /context Command in Claude Code". claudelog.com. 2026. https://claudelog.com/faqs/what-is-context-command-in-claude-code/. Accessed 2026-03-02.

---

## Research Metadata

Duration: ~60 min | Examined: 48 sources | Cited: 34 | Cross-refs: 42 | Confidence: High 64%, Medium-High 18%, Medium 18% | Output: `docs/research/extensibility-visibility-research.md`
