# ADR-007: Claude Code Hooks as Primary Data Capture Mechanism

## Status
Accepted

## Context
Norbert needs to capture agentic workflow data from Claude Code. Multiple approaches are possible: hook-based capture, log file parsing, MCP proxy pattern, or Anthropic partnership/API. The approach must be non-blocking (never slow Claude Code), capture MCP-specific data (server name, tool name), and work on all platforms.

## Decision
Claude Code hooks as primary data capture mechanism. Hook scripts fire async HTTP POST to Norbert server on each lifecycle event. 7 hook types configured: PreToolUse, PostToolUse, PostToolUseFailure, SubagentStart, SubagentStop, SessionStart, Stop.

Hook scripts are implemented as Node.js one-liners (not shell/bash) for Windows compatibility. Claude Code hooks support both shell commands and Node.js scripts -- Node.js is required for cross-platform portability (macOS, Linux, Windows).

## Alternatives Considered

### Alternative 1: Log file parsing (post-hoc)
- Parse `~/.claude/` conversation JSON files after sessions complete.
- No real-time capability. Log format is undocumented and may change. MCP attribution fields uncertain in log format.
- Rejection: Inferior to hooks on all dimensions. Hooks provide real-time, structured, MCP-attributed data. Log parsing kept as emergency fallback only.

### Alternative 2: MCP proxy pattern (Norbert as proxy between Claude Code and MCP servers)
- Full visibility into all MCP traffic. No data loss.
- Adds latency to every MCP call. Requires reconfiguring user's MCP server setup. Complex to maintain.
- MetaMCP proves the pattern works but at infrastructure tier, not personal tool tier.
- Rejection: Violates the "must not add latency" constraint. Too invasive to user's configuration.

### Alternative 3: Anthropic partnership / official API
- Best possible data access. Stable API. Rich metadata.
- Requires Anthropic cooperation. Unknown timeline. Dependency on external party.
- Rejection: Cannot depend on external party for MVP. Hooks are proven and available today. Pursue partnership in parallel for long-term stability.

## Evidence
- disler/claude-code-hooks-multi-agent-observability project proves hooks capture MCP data (server name, tool name, inputs, outputs, errors)
- 3+ independent forks validate the approach
- Hook-based architecture demonstrated working real-time dashboard (hooks -> HTTP -> server -> WebSocket -> UI)

## Consequences
- Positive: Proven, working approach with community validation
- Positive: Non-blocking (async HTTP POST, fire-and-forget)
- Positive: Captures both agent lifecycle AND MCP-specific data
- Positive: No modification to user's Claude Code configuration beyond adding hooks
- Negative: Hook API not formally versioned by Anthropic -- may change (mitigated by raw_payload preservation)
- Negative: Events lost if Norbert server is down (acceptable for observability tool)
- Negative: Limited to data Claude Code exposes through hooks (cannot capture data not in hook payloads)
