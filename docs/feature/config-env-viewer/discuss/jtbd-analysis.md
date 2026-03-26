# JTBD Analysis: Config Environment Viewer

## Job Classification

**Job Type**: Build Something New (Greenfield) -- adding a new tab to an existing plugin
**Workflow**: discuss -> design -> distill -> execute -> review
**Research Depth**: Lightweight (domain well-understood, evidence from `/norbert:setup` usage)

---

## Job Stories

### JS-01: Verify Setup Worked

**When** I have just run `/norbert:setup` to configure OpenTelemetry for Claude Code,
**I want to** see the environment variables that were written to `settings.json`,
**so I can** confirm the setup completed correctly without manually inspecting JSON files.

#### Functional Job
Verify that 5 specific environment variables exist with correct values in `~/.claude/settings.json`.

#### Emotional Job
Feel confident that the setup command did what it promised -- no lingering doubt about whether telemetry is actually configured.

#### Social Job
Be able to demonstrate to teammates that Norbert's observability stack is properly configured on this machine.

---

### JS-02: Diagnose Configuration Issues

**When** Claude Code telemetry is not working as expected (no metrics appearing, exporter errors),
**I want to** inspect the current environment variable configuration at a glance,
**so I can** identify misconfigured or missing variables without digging through raw JSON.

#### Functional Job
Identify which environment variables are set, which are missing, and whether values are correct.

#### Emotional Job
Feel in control when troubleshooting -- reduce the anxiety of "what's actually configured?" during an incident.

#### Social Job
Appear competent when pair-debugging with colleagues by quickly surfacing the relevant configuration.

---

### JS-03: Understand Claude Code Environment

**When** I am exploring what Norbert has configured in my Claude Code environment,
**I want to** browse all environment variables in a familiar tab-based interface,
**so I can** build a mental model of how my Claude Code instance is configured.

#### Functional Job
View all `env` key-value pairs from `settings.json` in a structured, scannable format.

#### Emotional Job
Feel oriented and informed -- the Config Viewer gives a complete picture, not a partial one.

#### Social Job
None significant -- this is a personal exploration task.

---

## Four Forces Analysis

### Demand-Generating

**Push (Current Frustration)**:
- After running `/norbert:setup`, there is no way to verify the result without opening `~/.claude/settings.json` in a text editor
- The `env` block is nested inside a large JSON file alongside unrelated config (hooks, MCP servers, rules), making it hard to scan
- When telemetry stops working, the first troubleshooting step is "check the env vars" -- currently a manual file inspection
- The Config Viewer already shows 8 categories of config but omits environment variables, creating a completeness gap

**Pull (Attraction of New Solution)**:
- One-click verification after running `/norbert:setup` -- open Norbert, click Environment tab, done
- Pretty-printed key-value pairs are faster to scan than raw JSON
- Consistent with existing Config Viewer patterns (tabs, scope tags, list/detail)
- Completes the configuration picture -- all settings.json sections visible in one place

### Demand-Reducing

**Anxiety (Fears About New Approach)**:
- Low anxiety -- this is a read-only display feature with no destructive actions
- Minor concern: will the env vars update live if I re-run `/norbert:setup`? (reload button addresses this)
- Could the display misrepresent the actual file contents? (trust in source fidelity)

**Habit (Inertia of Current Approach)**:
- Power users are comfortable opening JSON files in their editor
- Some users have `cat ~/.claude/settings.json | jq .env` as muscle memory
- The workaround is fast enough for infrequent checks

### Assessment

- **Switch likelihood**: High -- very low anxiety/habit barriers, strong push from completeness gap
- **Key blocker**: Habit of checking JSON directly (weak barrier)
- **Key enabler**: Push from incomplete Config Viewer + Pull of instant verification
- **Design implication**: Must display env vars with high fidelity to raw JSON (so users trust it over manual inspection)

---

## Opportunity Scoring

| # | Outcome Statement | Imp. (%) | Sat. (%) | Score | Priority |
|---|-------------------|----------|----------|-------|----------|
| 1 | Minimize the time to verify environment configuration after setup | 90 | 20 | 16.0 | Extremely Underserved |
| 2 | Minimize the likelihood of overlooking a misconfigured env var | 80 | 30 | 12.0 | Underserved |
| 3 | Minimize the time to identify which env vars are set for Claude Code | 75 | 35 | 11.5 | Appropriately Served |
| 4 | Maximize the likelihood that Config Viewer shows complete configuration | 85 | 40 | 12.0 | Underserved |
| 5 | Minimize the time to diagnose telemetry configuration issues | 80 | 25 | 13.5 | Underserved |

### Scoring Method

- Importance: estimated from Claude Code power user profile (small team proxy)
- Satisfaction: rated against current workaround (manual JSON inspection)
- Score: Importance + max(0, Importance - Satisfaction)
- Data Quality: team estimate, confidence Medium

### Top Opportunities (Score >= 12)

1. Verify environment configuration after setup -- Score: 16.0
2. Diagnose telemetry configuration issues -- Score: 13.5
3. Overlooking misconfigured env var -- Score: 12.0
4. Config Viewer completeness -- Score: 12.0

---

## 8-Step Job Map: Verify Environment Configuration

| Step | Activity | Pain Point |
|------|----------|------------|
| 1. Define | Decide to check env vars after running `/norbert:setup` | User must remember to check |
| 2. Locate | Find where env vars are stored (`~/.claude/settings.json`) | Path not obvious to new users |
| 3. Prepare | Open Norbert, navigate to Config Viewer | Already natural -- Norbert is open |
| 4. Confirm | Look for Environment tab among existing tabs | **Tab does not exist yet** |
| 5. Execute | Click Environment tab, scan the list of key-value pairs | Core interaction |
| 6. Monitor | Verify each expected var is present with correct value | Need scannable layout |
| 7. Modify | If a var is wrong, re-run `/norbert:setup` or edit JSON | Out of scope (read-only) |
| 8. Conclude | Close tab, confident configuration is correct | Emotional payoff: relief/confidence |

Steps 4-6 are where this feature delivers value. Steps 7-8 are natural follow-ons outside this feature's scope.

---

## Persona

**Reiko Tanaka** -- Senior Developer, Claude Code Power User

- Uses Claude Code daily for development work
- Installed Norbert to monitor Claude Code's telemetry and health
- Ran `/norbert:setup` to enable OpenTelemetry
- Comfortable with JSON but prefers GUI tools for quick verification
- Expects Config Viewer to show everything in `settings.json`
- Checks configuration when telemetry dashboards show unexpected gaps
