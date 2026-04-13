# Walking Skeleton: MCP Server Discovery

## Walking Skeletons (3)

### WS-1: User sees MCP servers from all configuration sources in one view
- **User goal**: See all MCP servers regardless of which config file defines them
- **Observable outcome**: 4 server cards with correct source attribution
- **E2E path**: Rust reads 4 config files -> domain aggregates with source -> view renders cards
- **Demo**: Show stakeholder the MCP tab with servers from settings.json, .claude.json, .mcp.json, and a plugin

### WS-2: User identifies where each MCP server is configured
- **User goal**: Know which file and scope each server comes from
- **Observable outcome**: Each card shows scope (user/project/plugin) and source file
- **Demo**: Point to any server card and see "user / settings.json" or "plugin / discord"

### WS-3: Missing configuration files produce an empty view without errors
- **User goal**: Trust that Norbert handles missing files gracefully
- **Observable outcome**: Empty state message listing checked locations, no error noise
- **Demo**: Launch with no MCP configs, see helpful empty state

## Implementation Sequence

Enable one walking skeleton at a time. Each must pass before enabling the next.

1. **WS-1** (all sources in one view) -- proves full vertical slice works
2. **WS-2** (source attribution) -- proves scope/source metadata flows correctly
3. **WS-3** (missing files) -- proves graceful degradation

## Stakeholder Litmus Test

For each skeleton, a non-technical stakeholder should confirm:
- "Yes, I can see my MCP servers from all my config files"
- "Yes, I can tell which file each server comes from"
- "Yes, the app handles missing files without confusing error messages"
