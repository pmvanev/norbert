# config-env-viewer Evolution

## Feature Summary

Added an **Environment** tab to the Config Viewer plugin, displaying environment variables from `~/.claude/settings.json`. Users can verify that `/norbert:setup` correctly configured OTEL environment variables without manually inspecting JSON files.

## Delivery Timeline

- **DISCUSS**: JTBD analysis, journey design, 2 user stories (US-CEV-01, US-CEV-02)
- **DESIGN**: Architecture (ADR-041 frontend-only, ADR-042 separate EnvVarEntry type), 3-step roadmap
- **DISTILL**: 22 Gherkin scenarios, walking skeleton defined
- **DELIVER**: 3 TDD steps, L1-L4 refactoring, double adversarial review, mutation testing (97.5% kill rate)

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| ADR-041: Frontend-only extraction | settings.json already available via existing IPC — no Rust backend changes needed |
| ADR-042: Separate EnvVarEntry type | Scope/source/filePath attribution needed, distinct from MCP EnvVar (key/value only) |
| Masked env var values | Consistent with MCP server env var display pattern — prevents accidental secret exposure |
| localeCompare sort | Consistent sort comparator between parser and view for non-ASCII keys |

## Files Changed

**Production (6 files modified, 1 new):**
- `src/plugins/norbert-config/domain/types.ts` — EnvVarEntry type, CONFIG_SUB_TABS + "env", SelectedConfigItem + env variant, AggregatedConfig + envVars
- `src/plugins/norbert-config/domain/settingsParser.ts` — extractTopLevelEnvVars function
- `src/plugins/norbert-config/domain/configAggregator.ts` — ParsedSettings + envVars, aggregateSettings threading
- `src/plugins/norbert-config/views/ConfigViewerView.tsx` — SUB_TAB_LABELS + env, SUB_TAB_ICONS + env
- `src/plugins/norbert-config/views/ConfigListPanel.tsx` — EnvVarListRow, env case in switch
- `src/plugins/norbert-config/views/ConfigDetailPanel.tsx` — MaskedValue, EnvVarDetail, env case in switch
- `src/plugins/norbert-config/views/shared.tsx` — Extracted ScopeBadge, formatAgentDisplayName, deriveFilename

**Tests (5 files):**
- `tests/acceptance/config-env-viewer/env-extraction.test.ts` — 10 tests
- `tests/acceptance/config-env-viewer/env-aggregation.test.ts` — 3 tests
- `tests/acceptance/config-env-viewer/env-tab-rendering.test.tsx` — 10 tests
- `tests/unit/plugins/norbert-config/domain/settingsParser-env.test.ts` — 8 tests
- `tests/unit/plugins/norbert-config/domain/configAggregator.test.ts` — 2 new property tests

## Quality Metrics

- **Mutation kill rate**: 97.5% (39/40 mutants killed)
- **Test count**: 33 feature-specific tests
- **DES integrity**: All 3 steps verified with complete TDD traces
- **Adversarial review**: 2 rounds, all findings addressed
