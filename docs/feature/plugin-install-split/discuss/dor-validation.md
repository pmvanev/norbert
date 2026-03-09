# Definition of Ready Validation: Plugin Install Split

## Story: US-PIS-001 (App Install Without Claude Integration)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | Priya's anxiety about silent settings.json modification, specific persona with context |
| User/persona identified | PASS | Priya Chandrasekaran, Claude Code power user, Windows 11, custom MCP servers |
| 3+ domain examples | PASS | 3 examples: clean install, terminal output hint, app empty state |
| UAT scenarios (3-7) | PASS | 4 scenarios covering install isolation, terminal hint, empty state, no merge |
| AC derived from UAT | PASS | 5 AC items derived from scenarios |
| Right-sized | PASS | 1-2 days: remove merge call, update first-launch UX, update terminal output |
| Technical notes | PASS | Specific code removal targets, ADR-006 note, sidecar unchanged |
| Dependencies tracked | PASS | None -- can start immediately |

### DoR Status: PASSED

---

## Story: US-PIS-002 (Plugin Directory Structure)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | No plugin package exists for Claude's framework, Marcus needs standard structure |
| User/persona identified | PASS | Marcus Rivera, Claude Code user, wants official plugin integration |
| 3+ domain examples | PASS | 3 examples: plugin.json, hooks.json with 6 hooks, .mcp.json |
| UAT scenarios (3-7) | PASS | 4 scenarios covering manifest, hooks, MCP, port consistency |
| AC derived from UAT | PASS | 5 AC items derived from scenarios |
| Right-sized | PASS | 1 day: create 3 files with correct structure |
| Technical notes | PASS | Framework requirements, localhost convention, marketplace out of scope |
| Dependencies tracked | PASS | Claude plugin framework docs needed, marketplace entry tracked as out of scope |

### DoR Status: PASSED

---

## Story: US-PIS-003 (Remove Settings Merge Code)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | Dead code after plugin framework adoption, maintenance burden |
| User/persona identified | PASS | Norbert contributor/maintainer, wants clean codebase |
| 3+ domain examples | PASS | 3 examples: adapter removal, ADR-006 superseded, clean first launch |
| UAT scenarios (3-7) | PASS | 4 scenarios covering adapter, function, ADR, domain functions |
| AC derived from UAT | PASS | 7 AC items covering all removal targets and compile verification |
| Right-sized | PASS | 1-2 days: delete files/functions, update ADR, verify compilation |
| Technical notes | PASS | Dependency check before removal, HOOK_EVENT_NAMES preserved, test updates |
| Dependencies tracked | PASS | Depends on US-PIS-001 (explicitly tracked) |

### DoR Status: PASSED

---

## Story: US-PIS-004 (Plugin Install from Marketplace)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | Marcus wants official plugin channel instead of invasive merge |
| User/persona identified | PASS | Marcus Rivera, Claude Code user, Norbert app installed |
| 3+ domain examples | PASS | 3 examples: happy path, app not running, reinstall idempotency |
| UAT scenarios (3-7) | PASS | 4 scenarios covering install, transition, offline install, idempotency |
| AC derived from UAT | PASS | 4 AC items derived from scenarios |
| Right-sized | PASS | 1 day: primarily validation that plugin structure works with Claude framework |
| Technical notes | PASS | Claude manages install, marketplace entry out of scope, implicit detection |
| Dependencies tracked | PASS | US-PIS-002, marketplace catalog entry tracked |

### DoR Status: PASSED

---

## Story: US-PIS-005 (Plugin Uninstall Cleanly Removes Hooks)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | Priya wants clean, reversible removal without manual config editing |
| User/persona identified | PASS | Priya Chandrasekaran, 3 weeks of usage, troubleshooting scenario |
| 3+ domain examples | PASS | 3 examples: clean uninstall, reinstall after uninstall, mid-session removal |
| UAT scenarios (3-7) | PASS | 4 scenarios covering removal, data preservation, reinstall, graceful disconnection |
| AC derived from UAT | PASS | 5 AC items derived from scenarios |
| Right-sized | PASS | 1 day: primarily validation plus graceful event cessation handling |
| Technical notes | PASS | Claude manages uninstall, timeout-based status transition, DB independence |
| Dependencies tracked | PASS | US-PIS-004 dependency tracked |

### DoR Status: PASSED

---

## Story: US-PIS-006 (App Functions Without Plugin)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | App needs meaningful state for "running without plugin" |
| User/persona identified | PASS | Marcus Rivera, evaluating before committing, historical browsing |
| 3+ domain examples | PASS | 3 examples: first-time empty, historical browsing, sidecar readiness |
| UAT scenarios (3-7) | PASS | 3 scenarios covering empty state, historical access, no-restart transition |
| AC derived from UAT | PASS | 5 AC items derived from scenarios |
| Right-sized | PASS | 1-2 days: empty state UI, status transition logic |
| Technical notes | PASS | Event-driven status, sidecar always listens, timeout window |
| Dependencies tracked | PASS | US-PIS-001 dependency tracked |

### DoR Status: PASSED

---

## Overall Validation

All 6 stories pass Definition of Ready. Ready for handoff to DESIGN wave.
