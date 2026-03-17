# JTBD Analysis: norbert-notif (Notification Center)

## Job Classification

**Job Type**: Build Something New (Greenfield)
**Workflow**: research -> discuss -> design -> distill -> baseline -> roadmap -> split -> execute -> review
**Current Phase**: DISCUSS (requirements discovery)

---

## Personas

### Persona: Raj Patel

**Who**: Senior developer who runs Claude Code sessions daily for feature work and bug fixes.
**Demographics**:
- High technical proficiency; comfortable with desktop apps and keyboard workflows
- Uses Claude Code 4-8 hours daily across 3-5 sessions
- Runs Norbert on Windows 11 on a secondary monitor
- Motivated by staying aware of agent behavior without constant context-switching

**Pain Points**:
- Misses agent completion because he is focused in another window -- maps to Job Step: Monitor
- Does not notice cost spikes until reviewing usage after the fact -- maps to Job Step: Monitor
- Context compaction happens silently and he only learns about it from degraded output quality -- maps to Job Step: Monitor
- Has no way to know when a hook error blocks agent progress -- maps to Job Step: Respond

**Success Metrics**:
- Aware of session completion within 10 seconds of it occurring
- Cost threshold alerts fire before spending exceeds budget
- Zero silent failures -- every hook error or DES block produces a visible signal

### Persona: Keiko Tanaka

**Who**: Tech lead who manages a team of 3 developers all using Claude Code, monitors team costs and quality.
**Demographics**:
- Moderate technical proficiency; uses Norbert primarily for oversight, not active coding
- Checks Norbert 5-10 times per day between meetings
- Runs Norbert on Windows 11 on her primary monitor alongside Slack and email
- Motivated by cost governance and catching anomalies before they compound

**Pain Points**:
- Discovers cost overruns hours after they happen -- maps to Job Step: Monitor
- Cannot route critical alerts to Slack where her team communicates -- maps to Job Step: Respond
- Gets overwhelmed when every event fires a toast; wants control over what interrupts her -- maps to Job Step: Configure
- Needs Do Not Disturb during meetings but forgets to re-enable alerts -- maps to Job Step: Configure

**Success Metrics**:
- Cost and anomaly alerts delivered to Slack webhook within 30 seconds
- Can configure notification preferences in under 2 minutes
- DND schedule auto-engages during recurring calendar blocks

### Persona: Marcus Chen

**Who**: Solo freelance developer who uses Claude Code for client projects and tracks costs carefully.
**Demographics**:
- High technical proficiency; power user who customizes everything
- Runs 1-2 long sessions per day, often unattended while he works on other tasks
- Runs Norbert on Windows 11; often minimizes it to tray
- Motivated by cost control and not missing critical agent events while multitasking

**Pain Points**:
- Leaves agent running and misses completion; wastes time checking back manually -- maps to Job Step: Monitor
- Credit balance warnings come too late; has been surprised by API lockout -- maps to Job Step: Monitor
- Wants a custom sound for session completion so he can tell it apart from OS notifications -- maps to Job Step: Configure
- Cannot test whether his notification setup actually works without triggering a real event -- maps to Job Step: Verify

**Success Metrics**:
- Hears a distinct sound within 5 seconds of session completion
- Credit balance alert fires with enough lead time to top up
- Can test any notification channel from settings without a live event

---

## Job Step Tables

### Raj Patel -- Job Steps

| Job Step | Goal | Desired Outcome |
|----------|------|-----------------|
| Monitor | Stay aware of agent events while focused elsewhere | Minimize the time between an agent event and awareness of it |
| Respond | Act on critical alerts promptly | Minimize the likelihood of a critical event going unnoticed |
| Configure | Set up notifications to match personal workflow | Minimize the time to configure event routing |
| Verify | Confirm notifications are working correctly | Minimize the likelihood of a misconfigured notification channel |

### Keiko Tanaka -- Job Steps

| Job Step | Goal | Desired Outcome |
|----------|------|-----------------|
| Monitor | Maintain oversight of team agent activity and costs | Minimize the time between a cost threshold breach and awareness |
| Route | Direct alerts to the channel where she already works | Minimize the number of tools she must check for alerts |
| Configure | Control which events interrupt her and which are passive | Minimize the effort to set notification granularity |
| Schedule | Manage Do Not Disturb for meeting blocks | Minimize the likelihood of missed alerts due to forgotten DND toggle |

### Marcus Chen -- Job Steps

| Job Step | Goal | Desired Outcome |
|----------|------|-----------------|
| Monitor | Know when sessions complete without watching the screen | Minimize the time between session completion and awareness |
| Budget | Get early warning before credit balance runs out | Minimize the likelihood of being surprised by API credit exhaustion |
| Customize | Personalize sounds and channels per event type | Minimize the effort to distinguish notification types by sound |
| Verify | Test that configured notifications will actually fire | Minimize the likelihood of discovering a broken channel during a real event |

---

## Job Stories

### JS-01: Aware of Agent Completion

**When** I am working in another window while a Claude Code session runs,
**I want to** be notified immediately when the session finishes,
**so I can** switch back and review the output without repeatedly checking.

**Functional Job**: Receive timely signal that agent work completed.
**Emotional Job**: Feel free to focus on other work without anxiety about missing completion.
**Social Job**: Not appear unresponsive to collaborators waiting on agent output.

### JS-02: Cost and Budget Awareness

**When** a Claude Code session is accumulating cost toward my budget limit,
**I want to** receive an alert before the threshold is crossed,
**so I can** decide whether to continue, pause, or adjust the session.

**Functional Job**: Get proactive cost threshold notifications.
**Emotional Job**: Feel in control of spending rather than surprised by bills.
**Social Job**: Demonstrate responsible resource management to clients or management.

### JS-03: Critical Error Visibility

**When** a hook error, timeout, or DES enforcement block occurs during an agent session,
**I want to** see a clear notification with enough context to understand what happened,
**so I can** intervene before the error compounds or blocks further progress.

**Functional Job**: Surface errors that would otherwise go unnoticed in logs.
**Emotional Job**: Feel confident that nothing is silently failing.
**Social Job**: Be seen as someone who catches and resolves issues quickly.

### JS-04: Notification Routing Control

**When** I have multiple channels where I receive information (desktop, Slack, email),
**I want to** route specific event types to specific channels,
**so I can** get critical alerts where I will definitely see them without being overwhelmed by noise.

**Functional Job**: Map events to delivery channels with per-event granularity.
**Emotional Job**: Feel that notifications serve me rather than interrupt me.
**Social Job**: Not be "that person" whose desktop is constantly dinging in meetings.

### JS-05: Quiet Focus Time

**When** I am in a meeting, deep focus block, or off-hours,
**I want to** suppress all notifications temporarily and have them resume automatically,
**so I can** focus without worrying about missing alerts permanently.

**Functional Job**: Schedule or toggle Do Not Disturb with automatic resume.
**Emotional Job**: Feel safe turning off alerts knowing they will come back.
**Social Job**: Not have notification sounds interrupt a meeting or presentation.

### JS-06: Notification Confidence

**When** I have configured notification preferences for a new channel or event,
**I want to** test that the notification actually fires through the configured channel,
**so I can** trust the setup before relying on it for real events.

**Functional Job**: Send a test notification through any configured channel.
**Emotional Job**: Feel confident that the notification infrastructure works.
**Social Job**: Not look foolish when asked "did you not get the alert?" and discovering the webhook was misconfigured.

---

## Four Forces Analysis

### JS-01: Aware of Agent Completion

**Demand-Generating**:
- **Push**: Raj runs a session, switches to browser, forgets to check back for 20 minutes. Session finished 18 minutes ago. Wasted time and broken flow.
- **Pull**: A distinct sound or toast when session completes means Raj can fully commit attention elsewhere, knowing he will be recalled.

**Demand-Reducing**:
- **Anxiety**: "Will the notifications be too noisy? Will every trivial event interrupt me?"
- **Habit**: Currently Raj manually polls Norbert's session view. It is inefficient but predictable.

**Assessment**:
- Switch likelihood: High
- Key blocker: Noise anxiety -- must have per-event toggles from day one
- Key enabler: Strong push from wasted time polling
- Design implication: Default only the most important events to On; opt-in for the rest

### JS-02: Cost and Budget Awareness

**Demand-Generating**:
- **Push**: Keiko discovered a $47 session cost 3 hours after it happened. She had to explain the overage to her manager.
- **Pull**: A proactive "$25 threshold reached" alert to Slack means she can intervene in real time.

**Demand-Reducing**:
- **Anxiety**: "What if the threshold is wrong and I get false alarms, or worse, no alarm at all?"
- **Habit**: Currently reviews usage dashboard manually every few hours.

**Assessment**:
- Switch likelihood: High
- Key blocker: Trust in threshold accuracy -- needs test button
- Key enabler: Financial pain from surprise costs
- Design implication: Threshold configuration must show current value alongside the threshold setting; test button confirms channel works

### JS-03: Critical Error Visibility

**Demand-Generating**:
- **Push**: Marcus had a hook error that silently broke his agent's ability to write files. He spent 30 minutes debugging before finding the hook bridge log.
- **Pull**: A toast notification with "Hook error: pre-write hook timed out after 10s" would have saved 30 minutes.

**Demand-Reducing**:
- **Anxiety**: "What if error notifications fire so frequently that I start ignoring all notifications?"
- **Habit**: Currently checks terminal output or Norbert logs manually after noticing something wrong.

**Assessment**:
- Switch likelihood: Very High
- Key blocker: Alert fatigue if errors are frequent
- Key enabler: Very strong push from silent failures
- Design implication: Error notifications should be high-signal; consider grouping repeated errors

### JS-04: Notification Routing Control

**Demand-Generating**:
- **Push**: Keiko misses OS toasts because she is in Slack all day. The notification she needed was on the wrong screen.
- **Pull**: Routing cost alerts to Slack webhook means they appear where she already looks.

**Demand-Reducing**:
- **Anxiety**: "Setting up SMTP or webhooks sounds complicated. What if I get it wrong?"
- **Habit**: Currently relies on OS notifications for everything, even though they get lost.

**Assessment**:
- Switch likelihood: Medium-High
- Key blocker: Setup complexity for SMTP/webhook
- Key enabler: Pain of missed notifications on wrong channel
- Design implication: Channel setup must have inline validation and test button; start with simple channels (toast, banner, badge) and progress to advanced (SMTP, webhook)

### JS-05: Quiet Focus Time

**Demand-Generating**:
- **Push**: Keiko's notification sound fired during a client demo. She had to apologize and manually mute.
- **Pull**: A DND schedule that auto-activates during meeting hours means no embarrassing interruptions.

**Demand-Reducing**:
- **Anxiety**: "What if I forget DND is on and miss something critical?"
- **Habit**: Currently mutes her entire Windows sound; loses all app audio.

**Assessment**:
- Switch likelihood: High
- Key blocker: Forgetting DND is active -- needs visible indicator
- Key enabler: Embarrassment from notification sounds in meetings
- Design implication: DND must have visible tray indicator, scheduled auto-enable/disable, and a clear "DND is active" banner in the dashboard

### JS-06: Notification Confidence

**Demand-Generating**:
- **Push**: Marcus configured a Slack webhook URL but mistyped it. He only discovered the error 2 days later when a real alert should have fired but did not.
- **Pull**: A "Send test notification" button that fires a sample payload through the configured channel would have caught the typo instantly.

**Demand-Reducing**:
- **Anxiety**: "Is the test notification representative of a real one? Will it spam the channel?"
- **Habit**: Currently just hopes the config is correct and waits for a real event.

**Assessment**:
- Switch likelihood: Very High
- Key blocker: Minimal -- test buttons are universally expected
- Key enabler: Very strong push from silent misconfiguration
- Design implication: Every channel must have a "Test" button; test notifications must be clearly labeled as tests

---

## Opportunity Scoring

| # | Outcome Statement | Imp. (%) | Sat. (%) | Score | Priority |
|---|-------------------|----------|----------|-------|----------|
| 1 | Minimize the time between an agent event and user awareness | 95 | 10 | 18.0 | Extremely Underserved |
| 2 | Minimize the likelihood of a cost threshold breach going unnoticed | 90 | 15 | 16.5 | Extremely Underserved |
| 3 | Minimize the likelihood of a silent hook error or DES block | 90 | 10 | 17.0 | Extremely Underserved |
| 4 | Minimize the effort to route events to preferred channels | 80 | 5 | 15.5 | Extremely Underserved |
| 5 | Minimize the likelihood of notifications interrupting focus time | 75 | 20 | 13.0 | Underserved |
| 6 | Minimize the likelihood of a misconfigured channel going undetected | 85 | 5 | 16.5 | Extremely Underserved |
| 7 | Minimize the time to configure per-event notification preferences | 70 | 10 | 13.0 | Underserved |
| 8 | Minimize the likelihood of forgetting DND is active | 65 | 15 | 11.5 | Appropriately Served |
| 9 | Minimize the effort to distinguish notification types by sound | 55 | 10 | 10.0 | Appropriately Served |
| 10 | Minimize the time to set up SMTP or webhook channels | 60 | 5 | 11.5 | Appropriately Served |

### Scoring Method

- Importance: estimated % of target users rating 4+ on 5-point scale (team estimate)
- Satisfaction: estimated % satisfied with current state (no notification system exists, so satisfaction is near-zero for notification-specific outcomes)
- Score: Importance + max(0, Importance - Satisfaction)
- Priority: Extremely Underserved (15+), Underserved (12-15), Appropriately Served (10-12), Overserved (<10)

### Top Opportunities (Score >= 15)

1. Agent event awareness (18.0) -- core notification delivery for session, cost, error events
2. Silent error visibility (17.0) -- hook error and DES block notifications
3. Cost threshold breach detection (16.5) -- proactive cost alerts
4. Misconfigured channel detection (16.5) -- test button for all channels
5. Event-to-channel routing (15.5) -- per-event channel assignment

### Data Quality Notes

- Source: team estimates based on product spec, user feedback patterns, and competitive analysis
- Sample size: 3 personas (representative archetypes)
- Confidence: Medium (team estimates, not direct user survey)
