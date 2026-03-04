# Walking Skeleton: Config Explorer

**Feature ID**: config-explorer
**Phase**: DISTILL
**Date**: 2026-03-03

---

## Walking Skeleton Definition

The Config Explorer walking skeleton validates the end-to-end data pipeline:

```
Fake ConfigFileReaderPort -> JSON Parser -> File Classifier -> API Route -> HTTP Response
```

### First Acceptance Test

**File**: `tests/acceptance/config-explorer/walking-skeleton.feature`
**Scenario**: "Developer sees settings from both user and project scopes"

```gherkin
Scenario: Developer sees settings from both user and project scopes
  Given user settings contain model preference "sonnet"
  And project settings contain permission "Read"
  When the developer requests the configuration tree
  Then the response includes user-scope settings with model "sonnet"
  And the response includes project-scope settings with permission "Read"
  And each settings file is annotated with its scope
```

### Why This Is the Right First Test

1. **Simplest possible E2E path**: Two JSON files parsed and served via one API endpoint.
2. **Observable user value**: A developer can see their settings organized by scope.
3. **Stakeholder demo-able**: "Can a developer see which settings are at user vs project scope?" Yes.
4. **Architecture validation**: Proves the ConfigFileReaderPort injection, JSON parsing, scope annotation, and Fastify API route all work together.

### What It Does NOT Test

- YAML frontmatter parsing (deferred to milestone 2)
- Precedence resolution (deferred to milestone 1)
- Cross-reference extraction (deferred to milestone 5)
- D3.js visualization (UI tests, not acceptance tests)

---

## Implementation Guidance for Software Crafter

### Step 1: Make the Walking Skeleton Fail for the Right Reason

The test should fail because:
- `GET /api/config/tree` endpoint does not exist yet
- OR the endpoint exists but returns empty data

It should NOT fail because:
- The test framework is misconfigured
- Step definitions have syntax errors
- The Fastify server cannot start

### Step 2: Build the Thinnest Vertical Slice

1. Create `@norbert/config-explorer` package with `ConfigScope` and `ParsedFile` types
2. Create `classifyFile()` pure function (just for settings.json)
3. Create `parseContent()` pure function (just for JSON)
4. Create `ConfigFileReaderPort` type definition
5. Create `GET /api/config/tree` Fastify route that accepts a fake reader
6. Wire up in server app factory
7. Walking skeleton test passes

### Step 3: Then Enable the Next Scenario

Remove `@skip` from the first scenario in `milestone-1-cascade.feature` and repeat the cycle.

---

## Walking Skeleton Inventory

Nine walking skeleton scenarios across all 7 stories:

| Story | Walking Skeleton | What It Proves |
|-------|-----------------|----------------|
| US-CE-07 | Developer sees settings from both scopes | Parser -> API -> scope annotations |
| US-CE-07 | Missing user settings file shown as placeholder | Graceful degradation for missing files |
| US-CE-01 | Hook override identified via cascade | Precedence resolution marks ACTIVE/OVERRIDDEN |
| US-CE-02 | Developer sees complete configuration tree | Full tree with 14 files classified |
| US-CE-04 | Developer tests a file path against all rules | Glob matching with MATCH/NO MATCH results |
| US-CE-05 | Developer sees 8 subsystem branches | Config model with subsystem summaries |
| US-CE-03 | Developer sees agent-to-skill relationships | Cross-reference extraction produces edges |
| US-CE-06 | Developer searches for hooks across scopes | Full-text search across all config files |

Each walking skeleton is the first scenario in its feature file. The DELIVER wave enables them one at a time.
