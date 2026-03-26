<!-- markdownlint-disable MD024 -->

# User Stories: config-env-viewer

## US-CEV-01: View Environment Variables in Config Viewer

### Problem

Reiko Tanaka is a senior developer who uses Norbert to monitor her Claude Code setup. After running `/norbert:setup` to configure OpenTelemetry, she finds it tedious to verify the configuration by opening `~/.claude/settings.json` in a text editor and hunting for the `env` block among hooks, MCP servers, and rules. The Config Viewer already shows 8 categories of configuration but omits environment variables, leaving a gap in the configuration picture.

### Who

- Claude Code power user | Has just run `/norbert:setup` | Wants instant verification that env vars were written correctly

### Solution

Add an "Environment" tab to the Config Viewer that displays all key-value pairs from the `env` block of `settings.json`, sorted alphabetically, with scope attribution and a count badge.

### Domain Examples

#### 1: Happy Path -- Reiko verifies 5 OpenTelemetry vars after setup

Reiko runs `/norbert:setup` in her project. She opens Norbert, clicks Config Viewer, and clicks the Environment tab. The tab shows "Environment Variables (5) -- user" with:

| Key | Value |
|-----|-------|
| CLAUDE_CODE_ENABLE_TELEMETRY | 1 |
| OTEL_EXPORTER_OTLP_ENDPOINT | http://127.0.0.1:3748 |
| OTEL_EXPORTER_OTLP_PROTOCOL | http/json |
| OTEL_LOGS_EXPORTER | otlp |
| OTEL_METRICS_EXPORTER | otlp |

Reiko confirms all 5 variables are present with correct values. She is confident her setup worked.

#### 2: Edge Case -- Settings file has env block with extra custom vars

Marcus Chen has added custom environment variables alongside the OpenTelemetry ones:

| Key | Value |
|-----|-------|
| CLAUDE_CODE_ENABLE_TELEMETRY | 1 |
| CUSTOM_LOG_LEVEL | debug |
| OTEL_EXPORTER_OTLP_ENDPOINT | http://127.0.0.1:3748 |
| OTEL_EXPORTER_OTLP_PROTOCOL | http/json |
| OTEL_LOGS_EXPORTER | otlp |
| OTEL_METRICS_EXPORTER | otlp |

The tab shows "Environment Variables (6)" with all 6 variables sorted alphabetically. CUSTOM_LOG_LEVEL appears between CLAUDE_CODE_ENABLE_TELEMETRY and OTEL_EXPORTER_OTLP_ENDPOINT.

#### 3: Empty State -- No env block configured

Priya Sharma opens the Config Viewer before running `/norbert:setup`. The Environment tab shows "Environment Variables (0)" with the message "No environment variables configured." and guidance "Run /norbert:setup to configure OpenTelemetry."

### UAT Scenarios (BDD)

#### Scenario: Display environment variables after setup

```gherkin
Given Reiko has run /norbert:setup configuring 5 OpenTelemetry env vars in ~/.claude/settings.json
When Reiko opens Config Viewer and clicks the Environment tab
Then 5 environment variables are displayed in alphabetical order
And the header shows "Environment Variables (5)"
And the scope tag shows "user"
And CLAUDE_CODE_ENABLE_TELEMETRY shows value "1"
And OTEL_EXPORTER_OTLP_ENDPOINT shows value "http://127.0.0.1:3748"
```

#### Scenario: Display empty state when no env block exists

```gherkin
Given Priya's ~/.claude/settings.json contains hooks and MCP servers but no env block
When Priya opens Config Viewer and clicks the Environment tab
Then the header shows "Environment Variables (0)"
And an empty state message reads "No environment variables configured."
And guidance text reads "Run /norbert:setup to configure OpenTelemetry."
```

#### Scenario: Display mixed custom and OpenTelemetry vars

```gherkin
Given Marcus has 6 env vars including CUSTOM_LOG_LEVEL alongside 5 OpenTelemetry vars
When Marcus opens Config Viewer and clicks the Environment tab
Then 6 environment variables are displayed in alphabetical order
And CUSTOM_LOG_LEVEL appears in the list with value "debug"
```

#### Scenario: Skip non-string env values gracefully

```gherkin
Given Reiko's env block contains 5 string vars and 1 nested object entry
When Reiko opens Config Viewer and clicks the Environment tab
Then only the 5 valid string variables are displayed
And the nested object entry is not shown
And the header shows "Environment Variables (5)"
```

#### Scenario: Reload reflects updated configuration

```gherkin
Given Reiko is viewing 5 env vars in the Environment tab
And she re-runs /norbert:setup changing OTEL_EXPORTER_OTLP_ENDPOINT to "http://127.0.0.1:4000"
When Reiko clicks the reload button
Then OTEL_EXPORTER_OTLP_ENDPOINT shows value "http://127.0.0.1:4000"
```

### Acceptance Criteria

- [ ] Environment tab appears in Config Viewer sub-tab navigation
- [ ] Tab displays all string key-value pairs from the `env` block of settings.json
- [ ] Variables are sorted alphabetically by key
- [ ] Header shows count badge with number of variables and scope tag
- [ ] Empty state shows guidance message when no env vars are configured
- [ ] Non-string env values are silently excluded from display
- [ ] Reload button refreshes environment variable data from settings.json

### Technical Notes

- Rust backend already reads `settings.json` but does not extract the `env` section; env extraction must be added
- Frontend `settingsParser.ts` has an existing `extractEnvVars()` function used for MCP server env; a similar approach needed for top-level env block
- `SettingsParseResult` discriminated union type must be extended with `envVars` field
- `AggregatedConfig` must be extended with `envVars` field
- `CONFIG_SUB_TABS` const array must include `"env"`
- `SelectedConfigItem` union must include `{ tag: "env"; envVar: EnvVar }` variant for detail panel
- Follows functional programming paradigm (pure functions, immutable data)

### Dependencies

- Depends on existing `read_claude_config` IPC command (available)
- Depends on existing `settingsParser.ts` parsing infrastructure (available)
- Depends on existing `ConfigListPanel` rendering pattern (available)
- No external dependencies or blockers

### JTBD Traceability

- **JS-01**: Verify Setup Worked (primary)
- **JS-02**: Diagnose Configuration Issues (secondary)
- **JS-03**: Understand Claude Code Environment (secondary)

---

## US-CEV-02: View Environment Variable Detail

### Problem

Reiko Tanaka is inspecting environment variables in the Config Viewer and wants to see the full detail of a specific variable, including its source file path and scope. When variable values are long (like endpoint URLs), the list view may truncate them, and she needs to confirm the exact value.

### Who

- Claude Code power user | Troubleshooting a specific env var | Wants to confirm exact value and source attribution

### Solution

Clicking an environment variable in the list opens a detail panel in the app's secondary zone showing key, value, source file path, and scope.

### Domain Examples

#### 1: Happy Path -- Reiko checks endpoint URL detail

Reiko clicks on OTEL_EXPORTER_OTLP_ENDPOINT in the Environment tab. The detail panel opens showing:
- Key: OTEL_EXPORTER_OTLP_ENDPOINT
- Value: http://127.0.0.1:3748
- Source: ~/.claude/settings.json
- Scope: user

#### 2: Edge Case -- Marcus checks a short boolean-like value

Marcus clicks on CLAUDE_CODE_ENABLE_TELEMETRY. The detail panel shows:
- Key: CLAUDE_CODE_ENABLE_TELEMETRY
- Value: 1
- Source: ~/.claude/settings.json
- Scope: user

Even though the value is short and fully visible in the list, the detail panel provides consistent access to source attribution.

#### 3: Different Scope -- Priya checks a project-level env var

Priya has project-level settings in `.claude/settings.json` with env vars. She clicks on PROJECT_API_KEY. The detail panel shows:
- Key: PROJECT_API_KEY
- Value: sk-proj-abc123
- Source: .claude/settings.json
- Scope: project

### UAT Scenarios (BDD)

#### Scenario: Open detail panel for environment variable

```gherkin
Given Reiko is viewing 5 env vars in the Environment tab
When Reiko clicks on OTEL_EXPORTER_OTLP_ENDPOINT
Then the detail panel opens in the secondary zone
And it shows Key as "OTEL_EXPORTER_OTLP_ENDPOINT"
And it shows Value as "http://127.0.0.1:3748"
And it shows Source as "~/.claude/settings.json"
And it shows Scope as "user"
```

#### Scenario: Detail panel shows project scope for project-level vars

```gherkin
Given Priya has project-level env vars in .claude/settings.json
When Priya clicks on PROJECT_API_KEY in the Environment tab
Then the detail panel shows Scope as "project"
And Source shows the project settings file path
```

#### Scenario: Switching selection updates detail panel

```gherkin
Given Reiko has selected OTEL_EXPORTER_OTLP_ENDPOINT in the detail panel
When Reiko clicks on OTEL_METRICS_EXPORTER in the list
Then the detail panel updates to show Key as "OTEL_METRICS_EXPORTER"
And Value as "otlp"
```

### Acceptance Criteria

- [ ] Clicking an env var in the list opens the detail panel in the secondary zone
- [ ] Detail panel displays key, value, source file path, and scope
- [ ] Selecting a different env var updates the detail panel
- [ ] Detail panel follows existing config item detail patterns

### Technical Notes

- Requires `SelectedConfigItem` union to include env var variant
- Detail panel rendering must be added to the app-level secondary zone handler
- Source file path comes from the `FileEntry.path` passed through the aggregator
- Follows existing pattern: list item click -> `onItemSelect` callback -> secondary zone renders detail

### Dependencies

- Depends on US-CEV-01 (Environment tab must exist first)
- Depends on existing secondary zone detail rendering infrastructure (available)

### JTBD Traceability

- **JS-02**: Diagnose Configuration Issues (primary)
- **JS-01**: Verify Setup Worked (secondary)

---

## Definition of Ready Validation

### US-CEV-01: View Environment Variables in Config Viewer

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | Reiko's pain: tedious to verify /norbert:setup by inspecting raw JSON; Config Viewer has completeness gap |
| User/persona identified | PASS | Reiko Tanaka, senior developer, Claude Code power user, runs /norbert:setup |
| 3+ domain examples | PASS | 3 examples: happy path (5 OTel vars), edge case (6 mixed vars), empty state (no env block) |
| UAT scenarios (3-7) | PASS | 5 scenarios: display vars, empty state, mixed vars, non-string skip, reload |
| AC derived from UAT | PASS | 7 AC items derived directly from the 5 scenarios |
| Right-sized (1-3 days) | PASS | ~2 days: backend env extraction + frontend type/parser/view changes; 5 scenarios |
| Technical notes | PASS | Identifies all touched files, type extensions, parsing changes, FP paradigm constraint |
| Dependencies resolved | PASS | All dependencies (IPC command, parser, list panel) are available; no blockers |

### DoR Status: PASSED

---

### US-CEV-02: View Environment Variable Detail

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | Reiko needs full value + source attribution for a specific env var; list may truncate |
| User/persona identified | PASS | Reiko Tanaka (happy path), Marcus Chen (short value), Priya Sharma (project scope) |
| 3+ domain examples | PASS | 3 examples: endpoint URL detail, short boolean value, project-scope var |
| UAT scenarios (3-7) | PASS | 3 scenarios: open detail, project scope, switch selection |
| AC derived from UAT | PASS | 4 AC items derived from the 3 scenarios |
| Right-sized (1-3 days) | PASS | ~1 day: add env variant to SelectedConfigItem, render detail panel; 3 scenarios |
| Technical notes | PASS | SelectedConfigItem union extension, secondary zone handler, FileEntry.path flow |
| Dependencies resolved | PASS | Depends on US-CEV-01 (tracked); secondary zone infrastructure available |

### DoR Status: PASSED
