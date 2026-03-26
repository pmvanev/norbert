# Journey Visual: Environment Variable Viewer

## Journey Flow

```
[Trigger]              [Step 1]              [Step 2]              [Step 3]              [Goal]
User runs              Opens Norbert         Clicks Environment    Scans env var         Confident config
/norbert:setup    -->  Config Viewer    -->  tab              -->  list             -->  is correct

Feels: Hopeful         Feels: Oriented       Feels: Focused        Feels: Scanning       Feels: Confident
"Did it work?"         "I know where         "Found it"            "Checking each         "All good" or
                        to look"                                    value..."              "Found the issue"
```

## Emotional Arc: Confidence Building

```
Confidence
    ^
    |                                                          * Confirmed correct
    |                                                        /
    |                                                      /
    |                                              * Scanning values
    |                                            /
    |                              * Tab found  /
    |                            /
    |              * Viewer open/
    |            /
    |  * Setup  /
    |  ran     /
    +--+------+--------+--------+--------+-----> Time
       Trigger  Step 1   Step 2   Step 3   Goal
```

**Arc Pattern**: Confidence Building
- Start: Hopeful but uncertain ("did setup work?")
- Middle: Focused scanning (progressive confidence as each var checks out)
- End: Confident or informed (either "all correct" or "found the problem")

---

## Step 1: Open Config Viewer

**Action**: User opens Norbert, navigates to Config Viewer plugin
**Emotional State**: Oriented -- familiar territory, knows where config lives

No new UI needed -- this step uses existing navigation.

---

## Step 2: Click Environment Tab

**Action**: User clicks the "Environment" tab in the sub-tab navigation
**Emotional State**: Focused -- found the right place, ready to inspect

### TUI Mockup: Sub-Tab Navigation (with new Environment tab)

```
+-- Configuration Viewer ----------------------------------------[reload]--+
|                                                                           |
| [Agents] [Commands] [Hooks] [MCP Servers] [Skills] [Rules] [Plugins]    |
| [Docs] [*Environment*]                                                   |
|                                                                           |
```

**Design Notes**:
- Environment tab appears last in the tab bar (after Docs)
- Uses a variable icon (lucide `variable` or `settings`) to distinguish from other tabs
- Tab label: "Environment" (not "Env Vars" -- full word for clarity)

---

## Step 3: Scan Environment Variable List

**Action**: User scans the list of key-value pairs from settings.json `env` block
**Emotional State**: Scanning -> Confident (progressive confidence as each var checks out)

### TUI Mockup: Environment Tab Content (Happy Path -- 5 vars configured)

```
+-- Configuration Viewer ----------------------------------------[reload]--+
|                                                                           |
| [Agents] [Commands] [Hooks] [MCP Servers] [Skills] [Rules] [Plugins]    |
| [Docs] [*Environment*]                                                   |
|                                                                           |
|  +-- Environment Variables (5) -- user --------------------------+       |
|  |                                                                |       |
|  |  CLAUDE_CODE_ENABLE_TELEMETRY        1                        |       |
|  |  OTEL_EXPORTER_OTLP_ENDPOINT         http://127.0.0.1:3748   |       |
|  |  OTEL_EXPORTER_OTLP_PROTOCOL         http/json               |       |
|  |  OTEL_LOGS_EXPORTER                  otlp                    |       |
|  |  OTEL_METRICS_EXPORTER               otlp                    |       |
|  |                                                                |       |
|  +----------------------------------------------------------------+       |
+--------------------------------------------------------------------------+
```

**Design Notes**:
- Count badge in header: "Environment Variables (5)" -- immediate orientation
- Scope tag: "user" -- matches existing pattern for scope attribution
- Keys sorted alphabetically for scannability
- Key-value pairs displayed in two-column layout (key left-aligned, value right)
- Monospace font for values to preserve exact strings
- No detail panel needed -- env vars are simple key-value pairs, fully visible in list

### TUI Mockup: Environment Tab Content (Empty State -- no env block)

```
+-- Configuration Viewer ----------------------------------------[reload]--+
|                                                                           |
| [Agents] [Commands] [Hooks] [MCP Servers] [Skills] [Rules] [Plugins]    |
| [Docs] [*Environment*]                                                   |
|                                                                           |
|  +-- Environment Variables (0) -- user --------------------------+       |
|  |                                                                |       |
|  |  No environment variables configured.                         |       |
|  |  Run /norbert:setup to configure OpenTelemetry.               |       |
|  |                                                                |       |
|  +----------------------------------------------------------------+       |
+--------------------------------------------------------------------------+
```

**Design Notes**:
- Empty state provides actionable guidance (run `/norbert:setup`)
- Count shows (0) to be explicit about absence vs loading

### TUI Mockup: Environment Tab Content (Detail Selection)

```
+-- Configuration Viewer ----------------------------------------[reload]--+
|                                                                           |
| [Agents] [Commands] [Hooks] [MCP Servers] [Skills] [Rules] [Plugins]    |
| [Docs] [*Environment*]                                                   |
|                                                                           |
|  +-- Environment Variables (5) -- user --------------------------+       |
|  |                                                                |       |
|  |  CLAUDE_CODE_ENABLE_TELEMETRY        1                        |       |
|  |  OTEL_EXPORTER_OTLP_ENDPOINT         http://127.0.0.1:3748   |       |
|  | >OTEL_EXPORTER_OTLP_PROTOCOL         http/json               |       |
|  |  OTEL_LOGS_EXPORTER                  otlp                    |       |
|  |  OTEL_METRICS_EXPORTER               otlp                    |       |
|  |                                                                |       |
|  +----------------------------------------------------------------+       |
|                                                                           |
|  +-- Detail: OTEL_EXPORTER_OTLP_PROTOCOL ---+                           |
|  |  Key:    OTEL_EXPORTER_OTLP_PROTOCOL      |                           |
|  |  Value:  http/json                         |                           |
|  |  Source: ~/.claude/settings.json           |                           |
|  |  Scope:  user                              |                           |
|  +--------------------------------------------+                           |
+--------------------------------------------------------------------------+
```

**Design Notes**:
- Selecting an env var opens detail in secondary zone (existing pattern)
- Detail shows: key, value, source file path, scope
- Consistent with how other config items show detail

---

## Error Paths

### Error 1: settings.json Missing or Unreadable

**Trigger**: `~/.claude/settings.json` does not exist or cannot be read
**Display**: Existing error indicator pattern (ErrorIndicator component)
**Recovery**: User creates the file or fixes permissions

### Error 2: settings.json Has No `env` Block

**Trigger**: File exists and parses but contains no `env` key
**Display**: Empty state with guidance message
**Recovery**: User runs `/norbert:setup`

### Error 3: `env` Block Contains Non-String Values

**Trigger**: `env` block has nested objects or arrays instead of string values
**Display**: Only valid string key-value pairs shown; malformed entries skipped silently
**Recovery**: User edits settings.json to fix malformed entries
