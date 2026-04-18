# Performance Monitor — Jobs-to-be-Done Discovery

**Status**: Hypothesis-stage discovery. No external interviews conducted.
**Primary reference user**: Phil (product owner, self-identified representative power user).
**Evidence base**: Phil's stated usage + JTBD theory + analogous-tool patterns (Activity Monitor, htop, Wireshark, Datadog Live Tail, traffic signals, oscilloscopes).
**Hard constraint honored**: All framings preserve room for a "cool live-updating signal display."

> **Evidence warning.** Everything below is *hypothesis*, not validated finding. The Mom Test discipline says future-intent and opinion are the least reliable signals. Before committing, Phil should self-interview against the trigger-moment map in Section 2 and flag any trigger he cannot remember doing in the last two weeks.

---

## 1. Candidate JTBD Statements

JTBD format: *When [situation], I want to [motivation], so I can [outcome].*

| # | Job | Pain | Live-signal fit |
|---|---|---|---|
| J1 | When I've just kicked off a long-running agent task and switched to other work, I want to feel in my peripheral vision that the agent is still working, so I can stay in flow on the other task without context-switching to check on it. | High — the babysitting tax is the core cost of concurrent-agent workflows. | **Very high.** Live motion = "still alive." This is what oscilloscopes and Wireshark capture panes do. |
| J2 | When I hear my laptop fans spin up or feel thermal throttling, I want to instantly see whether Claude Code is the cause, so I can decide whether to kill a session or just wait it out. | Medium — happens, but infrequently for most users. | High for the trigger moment; low for daily use. |
| J3 | When I'm considering starting a 3rd or 4th concurrent session, I want to sense whether I already have "headroom" (attention, cost budget, machine), so I can avoid overloading myself or my wallet. | High — the "should I start another?" decision recurs many times per day. | Medium-high. A live gauge of *current intensity* helps more than a number. |
| J4 | When I return to the laptop after a break (bathroom, coffee, meeting), I want a single glance to tell me what happened while I was away, so I can resume the right session first. | High — matches the most common "return to screen" moment. | Medium. This is partly ambient, partly investigative. A live signal shows *now*, but the user also wants *what changed*. |
| J5 | When something feels slow or wrong with a session, I want to see if a real resource signal corroborates my gut, so I can distinguish "it's actually stuck" from "I'm impatient." | Medium-high — frequent micro-anxiety. | High. Flatlined signal = stuck. Spiky signal = working. The *shape of motion* is the answer. |
| J6 | When an agent appears to have silently stalled (no output for minutes), I want to be alerted or see at-a-glance that throughput has dropped to zero, so I can intervene. | High — stalls are costly. | High, but leans toward *threshold alert* rather than passive signal. |
| J7 | When I end my day, I want a rough sense of "was today expensive?", so I can recalibrate tomorrow's spend. | Medium — but this is a historical / report job, not live. | **Low.** Single number or end-of-day summary, not a live signal. |
| J8 | When I'm demoing Claude Code to a colleague, I want something visually alive that conveys "something powerful is happening," so the tool feels real and impressive, not just a CLI. | Low-medium — infrequent but emotionally valent. | Very high. This is the "sensory confidence" / "engine room" aesthetic. |
| J9 | When I'm deep in flow on one session, I want to know if *another* session is finished or needs input, so I can switch at the right moment instead of checking constantly. | High — switching cost is the dominant concurrency tax. | Medium. Better served by per-session status glyphs than aggregate signal — but live motion per session can encode this. |
| J10 | When I suspect I'm being rate-limited or context-capped, I want to see pressure building before it fails, so I can slow down or split work. | Medium — depends on how often the user hits limits. | High. Classic "pressure gauge" pattern. |

### Clustered themes

- **Presence / liveness cluster** (J1, J5, J6, J8): *Is the machine alive and working?*
  Live-signal-native. This is the dominant cluster by both pain and fit.
- **Capacity / headroom cluster** (J3, J10, J2): *Do I have room to do more?*
  Live-signal-friendly, especially as gauges or pressure meters.
- **Re-entry cluster** (J4, J9): *What happened while I was away / on another task?*
  Partly live (right-now state), partly historical (delta). Mixed fit.
- **Accounting cluster** (J7): *What did this cost me?*
  Not live-signal. Candidate anti-job.

---

## 2. Trigger-Moment Map

Power-user day, segmented by intent of the glance.

### Ambient-glance triggers (peripheral, passive, sub-second)

- **Flow-check glance**: while typing elsewhere, eyes flick to a secondary monitor or corner of screen. Looking for *motion = alive*. (J1, J5)
- **Context-switch moment**: just finished a sub-task, about to decide what to do next. Wants to see "which sessions are hot right now?" (J4, J9)
- **Demo-glance**: showing a colleague the setup. Wants the display to look *alive and legitimate*. (J8)
- **Fan/thermal trigger**: auditory/haptic signal makes user look up. Wants instant "is it me?" confirmation. (J2)

### Purposeful-investigation triggers (foveal, active, multi-second)

- **"Should I start another?" decision**: user about to open a new Claude Code session. Wants to check headroom before committing. (J3)
- **"Why is this slow?" probe**: current session feels sluggish. User wants to isolate cause. (J5, J10)
- **"Is it stuck?" probe**: no output for N minutes. User wants confirmation. (J6)
- **End-of-day check**: "how much did I spend today?" — investigative but not live. (J7)

### Key distinction

Ambient-glance triggers are the **natural home of a live-signal display**. Investigation triggers are not — they want lists, tables, session-level drill-downs, and historical views. The current design tries to serve both with the same 4-category live chart, which is why it "doesn't make sense."

---

## 3. Ambient Awareness vs. Investigation Decomposition

| Dimension | Ambient Awareness | Investigation |
|---|---|---|
| User posture | Peripheral, sub-second | Foveal, multi-second to minutes |
| Cognitive load | Near-zero | Focused |
| Ideal format | Motion, color, shape of signal | Tables, lists, filters, history |
| Decision supported | "Is anything wrong? Can I stay in flow?" | "Which session? Why? What changed?" |
| Failure mode if mismatched | Feels noisy/ignorable | Feels shallow/useless |

**Recommendation: Performance Monitor should primarily own ambient awareness.**

Justification:
1. The hard constraint ("cool live-updating signal display") is the ambient-awareness aesthetic.
2. Investigation jobs fragment naturally into per-session views. An aggregate 4-category chart cannot answer "why is *this* session stuck" anyway — that's the existing design's core problem.
3. Norbert already has / plans adjacent views that are better homes for investigation work.

**Delegate to adjacent views:**
- *Session-level drill-down and "why is this one slow"* → **Session Status / Session Event Viewer**.
- *End-of-day spend and historical cost breakdown* → **Usage / Cost Ticker** (already in Norbert as `norbert-usage`).
- *Context-window pressure per session* → **per-session indicator** (not aggregable; belongs near the session, not in an aggregate panel).
- *Stall detection / "agent is stuck" alerts* → **notification plugin** (already in Norbert as `norbert-notif`).

The Performance Monitor's job is the *peripheral aliveness-and-intensity signal*, not the answer panel.

---

## 4. What "Resource" Means Here

Candidate resources, with format fit:

| Resource | What the user actually wants to feel | Best format | Lives in PM? |
|---|---|---|---|
| **Money (cost)** | Running-total awareness + spike detection | Single number + spark/rate indicator for *right now*; historical total belongs elsewhere | Partial — rate yes, total no |
| **Time / throughput (tokens/s, latency)** | "Is it making progress at a healthy pace?" | Live signal — shape of motion is the answer | **Yes, core** |
| **Context pressure** | "Is this session about to hit the wall?" | Per-session gauge; not aggregable | **No** — belongs at session level |
| **Attention (do I need to babysit?)** | "Can I trust the agents to keep working without me?" | Aliveness indicator — any motion at all | **Yes, core** |
| **Compute health (CPU, RAM, thermals)** | "Is my machine the bottleneck?" | Live signal, threshold-crossing emphasis | Optional secondary — belongs when J2 triggers |
| **Progress / momentum** | "Are the agents advancing toward done?" | Event-stream or completion counter; not really a "resource" | **No** — belongs in Session Event Viewer |

**Key insight**: of the six candidates, only *time/throughput*, *attention/aliveness*, and *compute health* are genuinely live-signal-native AND aggregable across sessions. Cost is live-signal-native but *aggregable only as a rate, not a total*. Context pressure and progress/momentum are not aggregable at all — trying to put them in PM was the design's category-uniformity mistake.

---

## 5. Anti-Jobs — what the Performance Monitor should NOT do

- **Historical cost attribution** ("which session cost me the most last week?"). Belongs in Usage.
- **Billing reconciliation** ("do these numbers match my Anthropic invoice?"). Belongs in Usage or a future reporting view.
- **Per-session context-window management**. Belongs next to each session, not aggregated.
- **Post-hoc debugging** ("why did this request fail 20 minutes ago?"). Belongs in Session Event Viewer.
- **Quota / plan management** ("when does my month reset?"). Belongs in account/settings view.
- **Long-term trend analysis** ("is my usage growing?"). Belongs in Usage / evolution reports.
- **Precise numeric answers.** PM should convey *shape and intensity*, not be a source of truth for exact figures. If the user needs a number, they click through.

The discipline here: if a job wants a *precise answer*, it is not a PM job. PM answers *how does this feel right now?*

---

## 6. Opportunity Statements and Recommendation

### Top 3 opportunities (success signals are behavioral, not attitudinal)

**Opportunity A — Ambient aliveness for flow-state protection (J1, J5, J6, J8)**
> *Claude Code power users running concurrent agents lose flow every time they context-switch to check whether an agent is still working. An ambient, peripheral live-signal display would let them feel agent aliveness without switching focus.*
- *User says*: "I can tell from the corner of my eye that it's still cooking." / "I stopped alt-tabbing to check."
- *User does*: Leaves PM visible on a secondary monitor or docked corner. Reduces rate of focused switches to the Claude Code window when nothing is wrong. Glances at PM *before* switching.

**Opportunity B — Headroom sensing for concurrency decisions (J3, J10, J2)**
> *Before starting a 3rd or 4th concurrent session, users need a sense of whether they — and their machine — have room. A live intensity/pressure signal would answer this pre-commitment.*
- *User says*: "I could see things were already pegged, so I queued it instead." / "The gauge told me I could add one more."
- *User does*: Visibly checks PM before opening new sessions. Defers starting a session when the signal shows pressure.

**Opportunity C — Re-entry orientation after breaks (J4, J9)**
> *When users return to the laptop, they need to quickly orient to which session is hot, idle, or waiting. Live per-session motion would surface the active ones without requiring a status scan.*
- *User says*: "I knew which tab to click first." / "I saw session 2 had gone quiet."
- *User does*: Returns from break and goes straight to the right session. Reduces time-to-reorient.

### Recommendation — Anchor Job

**Anchor: Opportunity A — Ambient aliveness for flow-state protection.**

**Why this anchor:**

1. **Highest recurrence.** Flow-check glances happen dozens of times per hour during concurrent-agent work. Headroom decisions (B) happen a few times per day. Re-entry (C) happens a handful of times per day. Frequency of trigger directly determines the ROI of investing in a dedicated panel.
2. **Best fit-to-format.** The core question "is it alive and healthy?" is answered by the *shape of motion* itself — not by any single number. This is precisely what a live signal display does natively and what a table/list cannot do at all. The format earns its place.
3. **Anchors the "resource" question.** When aliveness is the anchor, the live signal's content (throughput + whatever proxies "working vs. stuck") follows naturally. Without this anchor, the design drifts back into category-uniformity ("what else can we chart?") — which is how we got here.
4. **Cleanest delegation story.** Anchoring on aliveness lets us cleanly punt investigation, cost history, and per-session context to adjacent views, each of which already has a home in Norbert.
5. **Hard-constraint alignment.** Phil's stated want — "get a sense of resource usage in real time across all sessions" via a live graph — is almost a verbatim description of ambient aliveness. The constraint is the anchor.

**Secondary role**: Opportunity B (headroom sensing) is served *for free* by a well-designed aliveness display — a sparse/quiet signal implies headroom; a saturated signal implies pressure. So B is a derived benefit, not a separate job to design for. Opportunity C (re-entry) needs per-session resolution, which the aliveness display can provide as a secondary layer (per-session sub-signals) without fighting the anchor.

---

## Assumptions Phil Should Test Against His Own Usage

Before the researcher's findings converge with this, Phil should self-check:

1. **A1 (core)**: *I actually glance at something ambient while other work is in focus.* If Phil currently never glances at the PM during flow, the aliveness anchor is wrong and this whole recommendation inverts.
2. **A2**: *My concurrency count is usually 2–5, not 1 or 10.* If usually 1, the aggregation story collapses. If usually 10, the design problem is different (scan-a-list, not feel-the-whole).
3. **A3**: *I have lost flow in the last week because I context-switched to check on an agent.* If this has not happened recently, J1 is weaker than assumed.
4. **A4**: *I have, in the last week, decided whether or not to start another session based on some sense of "current load."* If never, Opportunity B is weaker.
5. **A5**: *When I return from a break, I currently do scan sessions to find the right one first.* If Phil just clicks the last-active one without scanning, J4 is weak.
6. **A6**: *Cost-in-the-moment matters to me; cost-this-month does not belong in PM.* If Phil actually wants a running monthly total in PM, the anti-jobs list needs revisiting.
7. **A7**: *A flatlined throughput signal would read as "stuck" to me faster than the Claude Code UI would.* If the Claude Code UI already tells him this clearly, J6 is redundant.

Each assumption should be tested by recalling a *specific recent instance* (Mom Test discipline — past behavior, not "would I"). Any assumption Phil cannot produce a concrete recent example for is a candidate to drop before the synthesis step.

---

## Summary

The Performance Monitor's anchor job should be **ambient aliveness for flow-state protection**. The live-signal aesthetic is not a decoration to preserve — it is the *correct format for this specific job* and the wrong format for the jobs the current design was accidentally serving (aggregation, accounting, investigation). Delegate investigation to Session views, history to Usage, and per-session context to per-session indicators. Let PM be the engine-room glance that tells the user, without words, that the machines are alive and the work is flowing.
