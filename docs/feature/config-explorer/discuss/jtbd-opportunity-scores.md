# JTBD Opportunity Scores: Config Explorer

**Feature ID**: config-explorer
**Phase**: DISCUSS -- Phase 1 (JTBD Analysis)
**Date**: 2026-03-03
**Scoring Method**: Ulwick ODI -- Score = Importance + max(0, Importance - Satisfaction)

---

## Outcome Statements and Scoring

Importance and Satisfaction derived from Phase 1 signals (7 stakeholder perspectives + structural evidence + market analogues) and Phase 3 simulated usability testing (5 user archetypes).

### Job Map Step: Define (Determine what config is needed)

| # | Outcome Statement | Imp. (1-10) | Sat. (1-10) | Score | Job |
|---|-------------------|-------------|-------------|-------|-----|
| O-01 | Minimize the time to identify which configuration subsystems are relevant to a project | 8 | 2 | 8 + 6 = **14** | JS-01 |
| O-02 | Minimize the likelihood of being unaware of available configuration options | 7 | 2 | 7 + 5 = **12** | JS-07 |

### Job Map Step: Locate (Find where config lives)

| # | Outcome Statement | Imp. (1-10) | Sat. (1-10) | Score | Job |
|---|-------------------|-------------|-------------|-------|-----|
| O-03 | Minimize the time to locate a specific configuration file across all scopes | 8 | 3 | 8 + 5 = **13** | JS-08 |
| O-04 | Minimize the likelihood of missing a configuration file that affects behavior | 9 | 1 | 9 + 8 = **17** | JS-01, JS-02 |

### Job Map Step: Prepare (Create or modify config)

| # | Outcome Statement | Imp. (1-10) | Sat. (1-10) | Score | Job |
|---|-------------------|-------------|-------------|-------|-----|
| O-05 | Minimize the likelihood of creating configuration that conflicts with existing settings | 8 | 1 | 8 + 7 = **15** | JS-02, JS-06 |
| O-06 | Minimize the time to understand the correct file format and location for new configuration | 7 | 3 | 7 + 4 = **11** | JS-07 |

### Job Map Step: Confirm (Verify config is correct)

| # | Outcome Statement | Imp. (1-10) | Sat. (1-10) | Score | Job |
|---|-------------------|-------------|-------------|-------|-----|
| O-07 | Minimize the time to determine which configuration is active for a given subsystem | 9 | 1 | 9 + 8 = **17** | JS-02 |
| O-08 | Minimize the likelihood of deploying configuration that does not take effect | 9 | 1 | 9 + 8 = **17** | JS-02, JS-04 |
| O-09 | Minimize the time to verify that a path-scoped rule matches the intended files | 8 | 1 | 8 + 7 = **15** | JS-04 |
| O-10 | Minimize the likelihood of plugin naming conflicts going undetected | 8 | 1 | 8 + 7 = **15** | JS-05 |

### Job Map Step: Execute (Use Claude Code with config)

| # | Outcome Statement | Imp. (1-10) | Sat. (1-10) | Score | Job |
|---|-------------------|-------------|-------------|-------|-----|
| O-11 | Minimize the uncertainty about which configuration is active during a session | 9 | 1 | 9 + 8 = **17** | JS-02 |
| O-12 | Minimize the likelihood of unexpected behavior due to invisible config overrides | 9 | 1 | 9 + 8 = **17** | JS-02 |

### Job Map Step: Monitor (Observe config behavior)

| # | Outcome Statement | Imp. (1-10) | Sat. (1-10) | Score | Job |
|---|-------------------|-------------|-------------|-------|-----|
| O-13 | Minimize the time to detect configuration-related issues during a session | 8 | 2 | 8 + 6 = **14** | JS-02 |
| O-14 | Minimize the likelihood of misattributing a behavior issue to code when config is the cause | 8 | 1 | 8 + 7 = **15** | JS-02, JS-04 |

### Job Map Step: Modify (Debug and fix config)

| # | Outcome Statement | Imp. (1-10) | Sat. (1-10) | Score | Job |
|---|-------------------|-------------|-------------|-------|-----|
| O-15 | Minimize the time to identify which file to modify to change a specific behavior | 9 | 2 | 9 + 7 = **16** | JS-02, JS-03 |
| O-16 | Minimize the effort to understand cross-references between config elements | 9 | 1 | 9 + 8 = **17** | JS-03 |
| O-17 | Minimize the time to diagnose why a plugin is not working as expected | 8 | 1 | 8 + 7 = **15** | JS-05 |

### Job Map Step: Conclude (Share and standardize)

| # | Outcome Statement | Imp. (1-10) | Sat. (1-10) | Score | Job |
|---|-------------------|-------------|-------------|-------|-----|
| O-18 | Minimize the time from working configuration to team-shared standard | 7 | 2 | 7 + 5 = **12** | JS-06 |
| O-19 | Minimize the likelihood of configuration drift from team standards | 7 | 1 | 7 + 6 = **13** | JS-06 |

---

## Ranked Opportunity Scores

| Rank | # | Outcome Statement | Score | Priority | Job |
|------|---|-------------------|-------|----------|-----|
| 1 | O-04 | Minimize likelihood of missing a config file that affects behavior | **17** | Extremely Underserved | JS-01, JS-02 |
| 1 | O-07 | Minimize time to determine which config is active for a subsystem | **17** | Extremely Underserved | JS-02 |
| 1 | O-08 | Minimize likelihood of deploying config that does not take effect | **17** | Extremely Underserved | JS-02, JS-04 |
| 1 | O-11 | Minimize uncertainty about which config is active during a session | **17** | Extremely Underserved | JS-02 |
| 1 | O-12 | Minimize likelihood of unexpected behavior from invisible overrides | **17** | Extremely Underserved | JS-02 |
| 1 | O-16 | Minimize effort to understand cross-references between elements | **17** | Extremely Underserved | JS-03 |
| 7 | O-15 | Minimize time to identify which file to modify for a behavior | **16** | Extremely Underserved | JS-02, JS-03 |
| 8 | O-05 | Minimize likelihood of creating conflicting configuration | **15** | Extremely Underserved | JS-02, JS-06 |
| 8 | O-09 | Minimize time to verify path-scoped rule matches intended files | **15** | Extremely Underserved | JS-04 |
| 8 | O-10 | Minimize likelihood of plugin naming conflicts going undetected | **15** | Extremely Underserved | JS-05 |
| 8 | O-14 | Minimize likelihood of misattributing behavior to code vs. config | **15** | Extremely Underserved | JS-02, JS-04 |
| 8 | O-17 | Minimize time to diagnose why a plugin is not working | **15** | Extremely Underserved | JS-05 |
| 13 | O-01 | Minimize time to identify which subsystems are relevant | **14** | Underserved | JS-01 |
| 13 | O-13 | Minimize time to detect config issues during a session | **14** | Underserved | JS-02 |
| 15 | O-03 | Minimize time to locate a specific config file across scopes | **13** | Underserved | JS-08 |
| 15 | O-19 | Minimize likelihood of config drift from team standards | **13** | Underserved | JS-06 |
| 17 | O-02 | Minimize likelihood of being unaware of available options | **12** | Underserved | JS-07 |
| 17 | O-06 | Minimize time to understand correct format and location | **11** | Appropriately Served | JS-07 |
| 17 | O-18 | Minimize time from working config to team standard | **12** | Underserved | JS-06 |

---

## Score Distribution

| Category | Count | Range |
|----------|-------|-------|
| Extremely Underserved (15+) | 12 | 15-17 |
| Underserved (12-15) | 5 | 12-14 |
| Appropriately Served (10-12) | 2 | 11-12 |
| Overserved (<10) | 0 | -- |

**Key insight**: 12 of 19 outcomes (63%) score 15+, indicating the configuration comprehension space is massively underserved. This confirms the structural evidence from Signal 6: a 7-subsystem, 5-scope ecosystem with zero visualization tooling produces extreme opportunity.

---

## Priority Mapping: Outcomes to Stories

### Must Have (Score 15+, multiple 17-scoring outcomes)

| Story | Key Outcomes | Combined Score Weight |
|-------|-------------|----------------------|
| **US-CE-01: Config Cascade (Precedence Waterfall)** | O-04, O-07, O-08, O-11, O-12, O-15 (all 16-17) | Highest |
| **US-CE-02: Config Galaxy (Relationship Graph)** | O-16 (17), O-15 (16), O-14 (15) | High |
| **US-CE-03: Config Atlas (Anatomy View)** | O-04 (17), O-01 (14), O-03 (13) | High |
| **US-CE-04: Path Rule Tester** | O-08 (17), O-09 (15), O-14 (15) | High |

### Should Have (Score 12-15)

| Story | Key Outcomes | Combined Score Weight |
|-------|-------------|----------------------|
| **US-CE-05: Plugin Contribution Viewer** | O-10 (15), O-17 (15) | Medium-High |
| **US-CE-06: Config Mind (Mind Map)** | O-01 (14), O-02 (12) | Medium |
| **US-CE-07: Configuration Search** | O-03 (13) | Medium |
| **US-CE-08: Missing File Indicators** | O-02 (12), O-06 (11) | Medium |

### Could Have (v2)

| Story | Key Outcomes | Combined Score Weight |
|-------|-------------|----------------------|
| **US-CE-09: Team Config Audit** | O-05 (15), O-18 (12), O-19 (13) | Medium (deferred due to forces analysis: high anxiety, single-user architecture) |

---

## Data Quality Notes

- **Source**: Synthesized from 7 validated signals (problem-validation.md), 676-line research document, Phase 3 simulated usability testing with 5 user archetypes
- **Sample size**: 7 signals representing 5 distinct user archetypes
- **Confidence**: High for outcomes scoring 15+ (corroborated by multiple independent signals and structural evidence). Medium for outcomes scoring 12-14 (fewer corroborating signals). Treat scores as relative rankings for prioritization.
- **Bias risk**: Importance ratings may be inflated by structural complexity evidence (Signal 6). Mitigated by cross-validation with behavioral evidence (workaround costs, debugging time).
