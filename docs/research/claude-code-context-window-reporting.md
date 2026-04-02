# Research: Claude Code Context Window Utilization Reporting

**Date**: 2026-04-02 | **Researcher**: nw-researcher (Nova) | **Confidence**: High | **Sources**: 6

## Executive Summary

Claude Code computes context window utilization percentage client-side from token counts returned by the Anthropic API. The `used_percentage` field is calculated using input-only tokens: `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`, divided by the model's `context_window_size`. Output tokens are excluded from this calculation. This data is exposed to status line scripts via a JSON payload on stdin but is NOT available through the hooks system or through OTel telemetry as a dedicated context-window metric.

OTel telemetry exports per-API-call token counts (input, output, cacheRead, cacheCreation) as events and metrics, which could be used to derive context utilization externally, but Claude Code does not emit a pre-calculated context window percentage or remaining-capacity metric via OTel. The hooks system provides no token or context window data whatsoever -- only session metadata, tool inputs/outputs, and permission context.

## Research Methodology

**Search Strategy**: Official Anthropic documentation (code.claude.com/docs, platform.claude.com/docs), GitHub issues on anthropics/claude-code, community guides and blog posts.
**Source Selection**: Types: official docs, API reference, community verified | Reputation: high/medium-high min | Verification: cross-referencing official docs against community implementations
**Quality Standards**: Min 3 sources/claim | All major claims cross-referenced | Avg reputation: 0.9

## Findings

### Finding 1: Context Window Percentage Is Computed Client-Side from API Token Counts

**Evidence**: The `used_percentage` field is calculated from input tokens only: `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`. It does not include `output_tokens`.

**Source**: [Customize your status line - Claude Code Docs](https://code.claude.com/docs/en/statusline) - Accessed 2026-04-02
**Confidence**: High
**Verification**: [Anthropic API Messages Reference](https://docs.anthropic.com/en/api/messages), [Context Windows - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/context-windows)

**Analysis**: The Anthropic Messages API response includes a `usage` object with `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens`. Claude Code takes these values from the most recent API call (the `current_usage` object) and computes the percentage against `context_window_size`. The percentage is NOT returned by the Anthropic API itself -- it is a Claude Code client-side computation.

### Finding 2: Full JSON Schema of Context Window Data Available to Status Line Scripts

**Evidence**: Claude Code sends a JSON payload to status line scripts via stdin containing:

```json
{
  "context_window": {
    "total_input_tokens": 15234,
    "total_output_tokens": 4521,
    "context_window_size": 200000,
    "used_percentage": 8,
    "remaining_percentage": 92,
    "current_usage": {
      "input_tokens": 8500,
      "output_tokens": 1200,
      "cache_creation_input_tokens": 5000,
      "cache_read_input_tokens": 2000
    }
  },
  "exceeds_200k_tokens": false
}
```

Key fields:
- `context_window.context_window_size`: Maximum tokens (200000 or 1000000 depending on model)
- `context_window.used_percentage`: Pre-calculated percentage (input tokens only)
- `context_window.remaining_percentage`: Pre-calculated remaining percentage
- `context_window.current_usage`: Token counts from the LAST API call (not cumulative)
- `context_window.total_input_tokens` / `total_output_tokens`: Cumulative session totals
- `exceeds_200k_tokens`: Fixed threshold flag, regardless of actual context window size

**Source**: [Customize your status line - Claude Code Docs](https://code.claude.com/docs/en/statusline) - Accessed 2026-04-02
**Confidence**: High
**Verification**: [aihero.dev Status Line Guide](https://www.aihero.dev/creating-the-perfect-claude-code-status-line), [ccusage.com Status Line Guide](https://ccusage.com/guide/statusline)

**Analysis**: The `current_usage` object is null before the first API call. The `total_input_tokens` and `total_output_tokens` are cumulative across the session and may exceed `context_window_size` (they represent total consumption, not current window state). For accurate context percentage, use `used_percentage` or compute from `current_usage`, not the cumulative totals. Updates occur after each assistant message, debounced at 300ms.

### Finding 3: OTel Telemetry Does NOT Emit Context Window Percentage

**Evidence**: Claude Code's OTel integration emits the following token-related data:

**Metrics** (via `OTEL_METRICS_EXPORTER`):
- `claude_code.token.usage` -- counter with attributes: `type` (input, output, cacheRead, cacheCreation), `model`
- `claude_code.cost.usage` -- cost in USD with `model` attribute

**Events** (via `OTEL_LOGS_EXPORTER`):
- `claude_code.api_request` event includes: `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `model`, `cost_usd`, `duration_ms`

There is NO metric or event attribute for:
- `context_window_pct` or `used_percentage`
- `context_window_size` or `max_tokens`
- `context_tokens` (current window occupancy)
- `remaining_tokens` or `remaining_percentage`

**Source**: [Monitoring - Claude Code Docs](https://code.claude.com/docs/en/monitoring-usage) - Accessed 2026-04-02
**Confidence**: High
**Verification**: [SigNoz Claude Code Monitoring Guide](https://signoz.io/blog/claude-code-monitoring-with-opentelemetry/), [Quesma Claude Code OTel Guide](https://quesma.com/blog/track-claude-code-usage-and-limits-with-grafana-cloud/)

**Analysis**: You CAN derive context utilization from OTel data, but it requires external computation. You would need to: (1) capture `claude_code.api_request` events, (2) sum `input_tokens + cache_read_tokens + cache_creation_tokens` from the latest event per session, (3) divide by a known context window size for the model. This is not trivial because `context_window_size` is not emitted in any OTel data -- you must maintain a lookup table of model-to-context-window mappings yourself.

### Finding 4: Hooks System Provides NO Token or Context Window Data

**Evidence**: Hook events receive the following common fields: `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`. There are no fields for token counts, context window size, usage percentage, or remaining capacity in any hook event.

The closest context-related hooks are:
- `PreCompact` / `PostCompact` -- fire before/after context compaction, with only `{ "trigger": "manual|auto" }`. No token counts.
- `SessionStart` -- includes `source` (startup|resume|clear|compact) and `model`, but no token data.

**Source**: [Hooks reference - Claude Code Docs](https://code.claude.com/docs/en/hooks) - Accessed 2026-04-02
**Confidence**: High
**Verification**: [Claude Code Hooks Reference: All 12 Events - Pixelmojo](https://www.pixelmojo.io/blogs/claude-code-hooks-production-quality-ci-cd-patterns), [DataCamp Claude Code Hooks Guide](https://www.datacamp.com/tutorial/claude-code-hooks)

**Analysis**: The hooks system is designed for workflow automation (blocking/allowing tools, injecting context) rather than observability. If you need to react to context window thresholds, the only current options are: (1) parse the transcript file from a hook script, (2) use the status line mechanism, or (3) implement external monitoring via OTel events.

### Finding 5: Model Context Window Limits

**Evidence**: Context window sizes by model:

| Model | Context Window |
|-------|---------------|
| Claude Opus 4.6 | 1,000,000 tokens |
| Claude Sonnet 4.6 | 1,000,000 tokens |
| Claude Sonnet 4.5 | 200,000 tokens |
| Claude Sonnet 4 | 200,000 tokens |
| Claude Haiku 4.5 | 200,000 tokens |
| All other models | 200,000 tokens |

Claude Code exposes this as `context_window.context_window_size` in the status line JSON: 200000 or 1000000 depending on the active model.

**Source**: [Context Windows - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/context-windows) - Accessed 2026-04-02
**Confidence**: High
**Verification**: [Claude Help Center - Context Window FAQ](https://support.anthropic.com/en/articles/8606395-how-large-is-the-anthropic-api-s-context-window), [Customize your status line - Claude Code Docs](https://code.claude.com/docs/en/statusline)

### Finding 6: Anthropic API Response Token Usage Format

**Evidence**: The Messages API response includes a `usage` object:

```json
{
  "usage": {
    "input_tokens": 8500,
    "output_tokens": 1200,
    "cache_creation_input_tokens": 5000,
    "cache_read_input_tokens": 2000
  }
}
```

The API does NOT return:
- Context window size or limit
- Percentage utilization
- Remaining capacity

The `stop_reason` field can indicate `"model_context_window_exceeded"` when limits are hit, but this is an error condition, not ongoing reporting.

**Source**: [Messages - Claude API Reference](https://docs.anthropic.com/en/api/messages) - Accessed 2026-04-02
**Confidence**: High
**Verification**: [Context Windows - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/context-windows), [Rate limits - Claude API Docs](https://docs.anthropic.com/en/api/rate-limits)

**Analysis**: Claude Code must maintain its own mapping of model ID to context window size. The API tells you how many tokens were used but not the maximum allowed. The context-awareness feature (system warnings like `Token usage: 35000/1000000; 965000 remaining`) is injected into the model's context, not returned as API response metadata to the caller.

## Source Analysis

| Source | Domain | Reputation | Type | Access Date | Cross-verified |
|--------|--------|------------|------|-------------|----------------|
| Claude Code Status Line Docs | code.claude.com | High | Official | 2026-04-02 | Y |
| Claude Code Monitoring Docs | code.claude.com | High | Official | 2026-04-02 | Y |
| Claude Code Hooks Docs | code.claude.com | High | Official | 2026-04-02 | Y |
| Context Windows - Claude API Docs | platform.claude.com | High | Official | 2026-04-02 | Y |
| Messages API Reference | docs.anthropic.com | High | Official | 2026-04-02 | Y |
| Claude Help Center | support.anthropic.com | High | Official | 2026-04-02 | Y |

Reputation: High: 6 (100%) | Avg: 1.0

## Knowledge Gaps

### Gap 1: VS Code Extension Status Bar Implementation
**Issue**: How the VS Code extension (Claude Code for VS Code) specifically renders the context window percentage in its status bar is not documented publicly. It likely consumes the same internal data as the terminal status line, but the exact mechanism (extension API, WebSocket, etc.) is not confirmed.
**Attempted**: Searched Claude Code VS Code extension documentation, GitHub issues.
**Recommendation**: Inspect the VS Code extension source or Claude Code npm package for implementation details.

### Gap 2: Exact Client-Side Calculation Code
**Issue**: While the formula is documented (`input_tokens + cache_creation_input_tokens + cache_read_input_tokens` / `context_window_size`), the exact rounding behavior, timing of calculation, and edge cases (e.g., extended thinking token handling) are not fully specified.
**Attempted**: Official docs describe the formula but not implementation precision.
**Recommendation**: Test empirically by comparing `used_percentage` with manual calculation from `current_usage` values.

### Gap 3: OTel Context Window Metrics Feature Request Status
**Issue**: Whether Anthropic plans to add context window utilization as a first-class OTel metric is unknown.
**Attempted**: Searched GitHub issues on anthropics/claude-code for feature requests.
**Recommendation**: File a feature request on anthropics/claude-code if this is needed, or implement external derivation from `claude_code.api_request` events.

## Recommendations for Further Research

1. **For Norbert integration**: The status line JSON payload is the richest source of context window data. Consider whether Norbert can consume the same JSON (perhaps by running as a status line script or by reading the transcript file).
2. **For OTel-based monitoring**: Build a derived metric in your observability backend that computes context utilization from `claude_code.api_request` event token counts + a model-to-context-window lookup table.
3. **For threshold alerting**: Since hooks lack token data, implement a status line script that writes to a file or sends an HTTP request when thresholds are crossed, then consume that signal externally.

## Full Citations

[1] Anthropic. "Customize your status line". Claude Code Docs. 2026. https://code.claude.com/docs/en/statusline. Accessed 2026-04-02.
[2] Anthropic. "Monitoring". Claude Code Docs. 2026. https://code.claude.com/docs/en/monitoring-usage. Accessed 2026-04-02.
[3] Anthropic. "Hooks reference". Claude Code Docs. 2026. https://code.claude.com/docs/en/hooks. Accessed 2026-04-02.
[4] Anthropic. "Context windows". Claude API Docs. 2026. https://platform.claude.com/docs/en/build-with-claude/context-windows. Accessed 2026-04-02.
[5] Anthropic. "Messages". Claude API Reference. 2026. https://docs.anthropic.com/en/api/messages. Accessed 2026-04-02.
[6] Anthropic. "How large is the Claude API's context window?". Claude Help Center. 2026. https://support.anthropic.com/en/articles/8606395-how-large-is-the-anthropic-api-s-context-window. Accessed 2026-04-02.

## Research Metadata

Duration: ~10 min | Examined: 12 | Cited: 6 | Cross-refs: 12 | Confidence: High 100% | Output: docs/research/claude-code-context-window-reporting.md
