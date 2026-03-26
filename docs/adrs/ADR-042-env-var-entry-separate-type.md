# ADR-042: Separate EnvVarEntry Type for Top-Level Environment Variables

## Status

Accepted

## Context

The codebase already has an `EnvVar` type (`{ key: string; value: string }`) used for MCP server environment variables. Top-level environment variables from the `env` block of settings.json need scope attribution (user/project), source file path, and source label to match the existing pattern for all other config entities (hooks, rules, MCP servers, etc.).

## Decision

Create a new `EnvVarEntry` type with `key`, `value`, `scope`, `source`, and `filePath` fields. Do not modify the existing `EnvVar` type, which remains purpose-built for MCP server env display.

## Alternatives Considered

### Alternative 1: Reuse Existing EnvVar Type

- **What**: Add optional `scope?`, `source?`, `filePath?` fields to `EnvVar`
- **Expected Impact**: Fewer types, but pollutes MCP server usage with optional fields
- **Why Insufficient**: Violates immutability and explicitness principles. MCP server env vars do not have independent scope -- they inherit from their parent `McpServerConfig`. Making fields optional introduces ambiguity where the type system should enforce presence.

### Alternative 2: Generic Wrapper Type

- **What**: `ScopedItem<T>` wrapper adding scope/source/filePath to any inner type
- **Expected Impact**: Reusable pattern
- **Why Insufficient**: Over-engineering for one usage. Other config entities (hooks, rules, etc.) each have bespoke types with domain-specific fields. A generic wrapper adds indirection without demonstrable reuse benefit in a 6-file change.

## Consequences

- **Positive**: Type safety -- every EnvVarEntry always has scope/source/filePath (non-optional)
- **Positive**: Consistent with codebase pattern where each config entity has its own explicit type
- **Negative**: One more type in types.ts (minimal cost)
