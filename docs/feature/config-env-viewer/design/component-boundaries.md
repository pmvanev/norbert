# Component Boundaries: config-env-viewer

## Boundary Map

All changes occur within the existing `norbert-config` plugin boundary. No cross-plugin dependencies, no new modules.

```
src/plugins/norbert-config/
  domain/
    types.ts          -- type extensions (EnvVarEntry, union variants)
    settingsParser.ts -- env block extraction function
    configAggregator.ts -- env vars passthrough in aggregation
  views/
    ConfigViewerView.tsx  -- tab label + icon registration
    ConfigListPanel.tsx   -- env tab list rendering + empty state
    ConfigDetailPanel.tsx -- env var detail rendering
```

## Responsibility Assignment

| Boundary | Owns | Does NOT Own |
|----------|------|--------------|
| `domain/types.ts` | Type definitions for env vars, tab enum extension, selected item variant | Parsing logic, rendering logic |
| `domain/settingsParser.ts` | Extracting env key-value pairs from raw JSON, filtering non-string values | File reading, aggregation across scopes |
| `domain/configAggregator.ts` | Threading env vars from settings parse result into aggregated config | Parsing JSON, rendering |
| `views/ConfigViewerView.tsx` | Tab label/icon mapping for "env" tab | List rendering, detail rendering |
| `views/ConfigListPanel.tsx` | Rendering env var list rows, empty state, selection callback | Detail panel content, parsing |
| `views/ConfigDetailPanel.tsx` | Rendering env var detail (key, value, source, scope) | List display, parsing |

## Dependency Direction

```
Views -> Domain (types, aggregator)
Domain types <- settingsParser (imports types)
Domain types <- configAggregator (imports types)
configAggregator -> settingsParser (calls parseSettings)
```

All dependencies point inward toward domain. No circular dependencies introduced.
