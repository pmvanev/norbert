# Data Models: config-env-viewer

## New Type: EnvVarEntry

Represents a top-level environment variable from settings.json, distinct from the existing `EnvVar` type (which serves MCP server environments and lacks scope/source/filePath).

| Field | Type | Description |
|-------|------|-------------|
| key | string | Environment variable name (e.g., `OTEL_EXPORTER_OTLP_ENDPOINT`) |
| value | string | Environment variable value (e.g., `http://127.0.0.1:3748`) |
| scope | ConfigScope | `"user"` or `"project"` -- from which settings.json |
| source | string | Source label (matches existing scope attribution pattern) |
| filePath | string | Absolute path to the settings.json file |

## Type Extensions

### SettingsParseResult (parsed variant)

Add `envVars` field to the `"parsed"` branch:

| Existing Fields | Added Field |
|----------------|-------------|
| hooks, mcpServers, rules, plugins | envVars: readonly EnvVarEntry[] |

### AggregatedConfig

Add `envVars` field:

| Existing Fields | Added Field |
|----------------|-------------|
| agents, commands, hooks, mcpServers, skills, rules, plugins, docs, errors | envVars: readonly EnvVarEntry[] |

### SelectedConfigItem

Add `"env"` variant to the discriminated union:

| Existing Variants | Added Variant |
|-------------------|---------------|
| agent, command, hook, mcp, skill, rule, plugin, doc | `{ tag: "env"; envVar: EnvVarEntry }` |

### CONFIG_SUB_TABS

Add `"env"` to the const array (position: after `"docs"`):

| Current | After |
|---------|-------|
| agents, commands, hooks, skills, rules, mcp, plugins, docs | agents, commands, hooks, skills, rules, mcp, plugins, docs, env |

### ConfigSubTab

Derived union type automatically includes `"env"` from the const array.

## Source Data: settings.json env block

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://127.0.0.1:3748",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_METRICS_EXPORTER": "otlp"
  }
}
```

## Extraction Rules

- Only string values included; non-string values (objects, arrays, numbers) silently filtered
- Keys sorted alphabetically for display
- Empty `env` block or missing `env` key produces empty array (not error)
- Reuses the same filtering pattern as existing `extractEnvVars` in settingsParser.ts
