# Definition of Ready Validation: Walking Skeleton

## Story: US-WS-000 (CI/CD Pipeline -- Technical Task)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "There is no way to build, package, or distribute Norbert" -- clear, domain-language |
| User/persona identified | PASS | Developer building Norbert -- appropriate for technical task |
| 3+ domain examples | PASS | 3 examples: tag release, build failure, postinstall download |
| UAT scenarios (3-7) | PASS | 3 scenarios covering happy path, failure, and install |
| AC derived from UAT | PASS | 5 AC items, each traceable to scenarios |
| Right-sized | PASS | 2-3 days effort, 3 scenarios -- appropriate for pipeline setup |
| Technical notes | PASS | Tauri action, Windows x64 target, binary size constraint |
| Dependencies tracked | PASS | None (foundation infrastructure) |

### DoR Status: PASSED

---

## Story: US-WS-001 (Tauri App Shell with System Tray and Status Window)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "Priya has no desktop tool to observe sessions... has to go to a website or read terminal logs" -- real pain, domain language |
| User/persona identified | PASS | Priya Chandrasekaran, Claude Code power user, Windows 11, $15-30/week spend |
| 3+ domain examples | PASS | 3 examples with real persona: first launch, window toggle, reboot persistence |
| UAT scenarios (3-7) | PASS | 4 scenarios: tray icon, window open, window close, empty state |
| AC derived from UAT | PASS | 5 AC items, each derived from corresponding scenarios |
| Right-sized | PASS | 1-2 days effort, 4 scenarios -- Tauri hello-world with tray icon |
| Technical notes | PASS | Tauri 2.0, React frontend, shared artifact references (version, hook_port) |
| Dependencies tracked | PASS | None (foundation story) |

### DoR Status: PASSED

---

## Story: US-WS-002 (Settings Merge, Hook Server, and Database Initialization)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "Priya finds it daunting to manually edit settings.json... afraid of breaking her MCP servers" -- specific pain with specific fear |
| User/persona identified | PASS | Priya Chandrasekaran, has existing settings.json with custom MCP servers |
| 3+ domain examples | PASS | 3 examples: existing config preserved, no existing settings, malformed JSON |
| UAT scenarios (3-7) | PASS | 5 scenarios covering merge, database, HTTP server, error handling, notification |
| AC derived from UAT | PASS | 8 AC items traceable to scenarios |
| Right-sized | PASS | 2-3 days effort, 5 scenarios -- settings merge + HTTP server + SQLite init |
| Technical notes | PASS | Surgical JSON merge, byte-identical backup, WAL mode, async hooks, shared artifact alignment |
| Dependencies tracked | PASS | US-WS-001 (app shell) -- explicitly tracked |

### DoR Status: PASSED

---

## Story: US-WS-003 (End-to-End Pipeline Confirmation)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "Priya has no way to know if the full pipeline actually works... needs proof that data flows from Claude Code through every layer to the UI" |
| User/persona identified | PASS | Priya Chandrasekaran, has Norbert installed, needs visible proof |
| 3+ domain examples | PASS | 3 examples: first session captured, multiple sessions, restart mid-session |
| UAT scenarios (3-7) | PASS | 5 scenarios: first session, live count, status transitions, multiple sessions, banner dismiss |
| AC derived from UAT | PASS | 7 AC items derived from scenarios |
| Right-sized | PASS | 1-2 days effort, 5 scenarios -- wiring existing pieces together with UI updates |
| Technical notes | PASS | Session identification, duration calculation, durable writes, tray state |
| Dependencies tracked | PASS | US-WS-002 and US-WS-001 -- explicitly tracked |

### DoR Status: PASSED

---

## Summary

| Story | DoR Status | Effort Estimate | Scenarios |
|-------|-----------|-----------------|-----------|
| US-WS-000 | PASSED | 2-3 days | 3 |
| US-WS-001 | PASSED | 1-2 days | 4 |
| US-WS-002 | PASSED | 2-3 days | 5 |
| US-WS-003 | PASSED | 1-2 days | 5 |

**Total walking skeleton effort**: 6-10 days
**Total scenarios**: 17
**All 4 stories pass DoR**

### Dependency Order

```
US-WS-000 (CI/CD Pipeline)
    |
    v
US-WS-001 (App Shell) -----> US-WS-002 (Settings + Server + DB)
                                          |
                                          v
                              US-WS-003 (End-to-End Confirmation)
```

US-WS-000 (CI/CD) is infrastructure that enables delivery of all other stories. US-WS-001 through US-WS-003 are sequentially dependent -- each builds on the previous.
