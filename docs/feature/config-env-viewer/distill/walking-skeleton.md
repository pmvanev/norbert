# Walking Skeleton: config-env-viewer

## Walking Skeleton 1: User verifies environment variables after running setup

### User Goal

Reiko has run /norbert:setup and wants to confirm the 5 OpenTelemetry environment variables were written correctly to her settings file. She expects to see them all listed, sorted, with correct values.

### Observable Outcome

5 environment variables are returned in alphabetical order with exact values matching the settings file content.

### Litmus Test

| Question | Answer |
|----------|--------|
| Title describes user goal? | Yes -- "verifies environment variables after running setup" |
| Given/When describe user actions? | Yes -- user has run setup, settings are parsed |
| Then describe user observations? | Yes -- sorted list of 5 named variables with values |
| Non-technical stakeholder confirms value? | Yes -- "I can see my setup worked" |

### Data Flow Exercised

```
settings.json content (mock input)
  -> settingsParser env extraction (pure function)
  -> sorted EnvVarEntry[] with key, value, scope, source, filePath
```

### Implementation Notes

- Input: raw JSON string representing settings.json with `env` block containing 5 OTel variables
- Driving port: `settingsParser` env extraction function
- Assertions: count = 5, alphabetical order, each key-value pair matches expected
- This is the FIRST test to enable -- it establishes the core extraction pipeline

---

## Walking Skeleton 2: User selects an environment variable to see its full detail

### User Goal

Reiko clicks on OTEL_EXPORTER_OTLP_ENDPOINT to see its full detail including the source file path and scope, confirming where the variable was configured.

### Observable Outcome

Detail data includes the key, value, scope ("user"), and source file path for the selected variable.

### Litmus Test

| Question | Answer |
|----------|--------|
| Title describes user goal? | Yes -- "selects an environment variable to see its full detail" |
| Given/When describe user actions? | Yes -- settings parsed, user selects a variable |
| Then describe user observations? | Yes -- key, value, scope, source file path |
| Non-technical stakeholder confirms value? | Yes -- "I can see where this var came from" |

### Data Flow Exercised

```
settings.json content (mock input)
  -> settingsParser env extraction
  -> configAggregator (adds file path annotation)
  -> EnvVarEntry selected -> detail data (key, value, scope, source, filePath)
```

### Implementation Notes

- Input: raw JSON + file path + scope metadata
- Driving ports: `settingsParser` extraction + `configAggregator` aggregation
- Assertions: selected entry has all 4 detail fields populated correctly
- This is the TWELFTH test to enable -- after list scenarios are green

---

## Skeleton Summary

| # | Skeleton | Story | Enables |
|---|----------|-------|---------|
| WS-1 | Verify env vars after setup | US-CEV-01 | Core extraction pipeline; all list-based scenarios depend on this |
| WS-2 | Select env var for detail | US-CEV-02 | Detail data flow; all detail scenarios depend on this |

Both skeletons are demo-able to stakeholders:
- WS-1: "Here are the 5 variables /norbert:setup wrote -- they are all correct."
- WS-2: "I clicked on one and I can see it came from my user settings file."
