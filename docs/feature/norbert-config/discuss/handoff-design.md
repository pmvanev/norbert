# DESIGN Wave Handoff: norbert-config

## Handoff Status: APPROVED

- DoR: All 7 stories PASSED (0 failures)
- Peer Review: Conditionally approved (iteration 1) -- conditions addressed in-place
- Critical/High Issues: 0

## Package Contents

| Artifact | Path |
|----------|------|
| JTBD Analysis | `docs/feature/norbert-config/discuss/jtbd-analysis.md` |
| Journey Visual | `docs/feature/norbert-config/discuss/journey-config-viewer-visual.md` |
| Journey Schema | `docs/feature/norbert-config/discuss/journey-config-viewer.yaml` |
| Gherkin Scenarios | `docs/feature/norbert-config/discuss/journey-config-viewer.feature` |
| Shared Artifacts | `docs/feature/norbert-config/discuss/shared-artifacts-registry.md` |
| User Stories | `docs/feature/norbert-config/discuss/user-stories.md` |
| DoR Validation | `docs/feature/norbert-config/discuss/dor-validation.md` |
| Peer Review | `docs/feature/norbert-config/discuss/peer-review.yaml` |

## Feature Summary

The norbert-config plugin is a read-only Configuration Viewer for Norbert. It reads the user's `.claude/` directory and presents configuration entities across 7 tabs: Agents, Hooks, Skills, Rules, MCP Servers, Plugins, and CLAUDE.md (Docs). It requires no active Claude Code session and no network access -- pure local filesystem reading.

## Stories for DESIGN Wave

| ID | Title | Size | MoSCoW | Dependencies |
|----|-------|------|--------|--------------|
| US-001 | Plugin Registration & Tab Navigation | 1 day | Must Have | None |
| US-007 | Filesystem Reader (.claude/ Parsing) | 2 days | Must Have | US-001 |
| US-002 | Agents Tab | 2 days | Must Have | US-001, US-007 |
| US-003 | Hooks Tab | 1 day | Must Have | US-001, US-007 |
| US-004 | MCP Servers Tab | 1 day | Must Have | US-001, US-007 |
| US-005 | Skills, Rules, Plugins Tabs | 2 days | Must Have | US-001, US-007 |
| US-006 | Docs Tab | 1 day | Should Have | US-001, US-007 |

Total estimated effort: ~10 days

## Key Design Decisions for DESIGN Wave

1. **User-level vs project-level .claude/ scope**: Reader must handle both `~/.claude/` and `./.claude/`. When both exist, display with source annotations and indicate override precedence. This affects the filesystem reader architecture.

2. **settings.json shared parse**: Hooks, MCP, and Rules tabs all consume settings.json. Parse once, share across tabs. This implies a data layer or context pattern.

3. **Sensitive value masking**: MCP server env vars must be masked by default with click-to-reveal. Frontend-only concern, no backend needed.

4. **Agent file format parsing**: Agent definitions are Markdown with optional YAML frontmatter. Parser must extract model, tools, description, and system prompt from varying file structures.

5. **Plugin detection format**: May need a spike (SP-001, half day) if Claude Code's plugin storage format is undocumented. Track as prerequisite for US-005 Plugins sub-tab.

6. **No caching**: Read files fresh on each tab activation to avoid stale data. Performance should be acceptable for local filesystem reads.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Agent file format varies across users | Medium | Medium | Parser handles missing fields with sensible defaults |
| Plugin storage format undocumented | Medium | Low | Spike SP-001 resolves before US-005 enters DESIGN |
| settings.json structure changes in future Claude Code versions | Low | Medium | Parser reports unknown fields gracefully |
| Large .claude/ directories (100+ files) | Low | Low | Filesystem reads are fast; lazy loading if needed |

## Non-Functional Requirements

- **Performance**: All tabs load within 500ms for typical .claude/ directories (10-20 files)
- **Reliability**: Per-file errors isolated; one bad file does not break the viewer
- **Security**: Env var values masked by default; no sensitive data in console logs
- **Accessibility**: Full keyboard navigation across tabs and cards; 4.5:1 contrast ratios
