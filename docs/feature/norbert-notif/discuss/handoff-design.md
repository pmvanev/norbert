# DISCUSS Wave Handoff: norbert-notif -> DESIGN Wave

## Feature Summary

**Feature**: norbert-notif (Notification Center)
**Feature Type**: User-facing, first-party plugin
**Strategic Priority**: P4 in build order -- foundational notification infrastructure for all subsequent plugins

## Artifact Index

| Artifact | Path | Purpose |
|----------|------|---------|
| JTBD Analysis | `docs/feature/norbert-notif/discuss/jtbd-analysis.md` | Job stories, forces analysis, opportunity scoring, personas |
| Journey Visual | `docs/feature/norbert-notif/discuss/journey-notification-setup-visual.md` | ASCII mockups, emotional arc, desktop UI prototypes |
| Journey Schema | `docs/feature/norbert-notif/discuss/journey-notification-setup.yaml` | Structured YAML journey with integration validation |
| Gherkin Scenarios | `docs/feature/norbert-notif/discuss/journey-notification-setup.feature` | 33 BDD scenarios across 7 stories |
| Shared Artifacts | `docs/feature/norbert-notif/discuss/shared-artifacts-registry.md` | 10 shared artifacts with sources and consumers |
| User Stories | `docs/feature/norbert-notif/discuss/user-stories.md` | 7 LeanUX stories with UAT scenarios and AC |
| DoR Validation | `docs/feature/norbert-notif/discuss/dor-validation.md` | All 7 stories PASSED DoR |
| Peer Review | `docs/feature/norbert-notif/discuss/peer-review.md` | Approved after 2 iterations |

## Business Context

Norbert is a local-first observability desktop app for Claude Code users. The notification center is the foundational notification infrastructure that all subsequent plugins will use to alert users about agent events. It ships early (P4) so that norbert-session, norbert-usage, and future plugins can fire notifications through it rather than managing their own delivery.

### Key Value Propositions

1. **Agent awareness without polling**: Users learn about session completions, cost thresholds, and errors within seconds, not minutes
2. **Per-event granularity**: 14 event types independently togglable across 5 delivery channels
3. **Channel flexibility**: From simple OS toasts to Slack webhooks and email, routed per-event
4. **Do Not Disturb**: Scheduled and manual suppression with automatic resume and queued delivery
5. **Confidence building**: Test button on every channel validates configuration before relying on it

## Personas

| Persona | Role | Primary Job | Key Differentiator |
|---------|------|------------|-------------------|
| Raj Patel | Senior developer | Aware of agent completion | Daily user, wants immediate awareness |
| Keiko Tanaka | Tech lead | Cost governance and routing | Team oversight, needs Slack/email routing |
| Marcus Chen | Freelance developer | Cost control and customization | Power user, custom sounds, credit alerts |

## User Stories Summary

| ID | Title | Priority | Est. Days | Scenarios | Dependencies |
|----|-------|----------|-----------|-----------|-------------|
| US-NOTIF-07 | Plugin Registration and Status Bar | Must | 1 | 4 | NorbertAPI (existing) |
| US-NOTIF-01 | Event Notification Delivery | Must | 3 | 5 | US-NOTIF-07, hook bridge (existing) |
| US-NOTIF-02 | Event and Channel Configuration | Must | 2 | 5 | US-NOTIF-07 |
| US-NOTIF-06 | Notification Sound System | Should | 2 | 5 | US-NOTIF-02 |
| US-NOTIF-03 | Channel Setup and Testing | Should | 2 | 5 | US-NOTIF-01 |
| US-NOTIF-04 | Do Not Disturb | Should | 3 | 5 | US-NOTIF-01 |
| US-NOTIF-05 | Webhook and Email Delivery | Could | 2 | 4 | US-NOTIF-01, US-NOTIF-03 |

## Dependency Graph

```
US-NOTIF-07 (Plugin scaffold)
    |
    +-> US-NOTIF-01 (Core dispatch) ------+-> US-NOTIF-03 (Test button)
    |       |                              |
    |       +-> US-NOTIF-04 (DND)         +-> US-NOTIF-05 (Webhook/Email)
    |
    +-> US-NOTIF-02 (Settings UI) --------+-> US-NOTIF-06 (Sounds)
```

## Integration Points

### Receives Events From

- **norbert-session**: session started, session completed, agent spawned, agent completed
- **norbert-usage**: cost threshold, token threshold, context window threshold, credit balance low
- **norbert-config**: hook error, hook timeout
- **nWave plugin** (optional): DES enforcement block
- **anomaly detector**: anomaly detected
- **digest generator**: session digest ready

### Publishes To

- **Windows Notification Center**: OS toasts via Tauri notification API
- **Norbert Dashboard**: in-app banners via React components
- **System Tray**: badge updates via Tauri system tray API
- **External**: SMTP email and HTTP webhook POST

### Existing Architecture Integration

- Plugin system: `NorbertPlugin` interface, `PluginManifest`, `NorbertAPI` contract
- Hook bridge: `hookBridge.deliverHookEvent()` for event delivery
- UI registration: `NorbertAPI.ui.registerView()`, `.registerTab()`, `.registerStatusItem()`
- Status bar: `StatusItemHandle.update()` for dynamic DND/count updates
- Sidebar: `RegisterTabInput` for notification tab
- Layout: zone-based assignment for settings views

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Windows toast API limitations (action buttons, rich content) | Medium | Medium | Tauri notification API supports basic toasts; rich content deferred |
| SMTP email requires Rust backend (no browser SMTP) | Medium | Medium | Use Tauri command bridge to Rust SMTP library |
| Event bus flood from misbehaving plugin | Low | High | Rate limiting: group >10 same-type events in 5s window |
| Custom sound file format incompatibility | Low | Low | Validate on discovery; exclude unsupported with tooltip |
| DND schedule timezone issues on travel | Low | Medium | Store local time with offset; re-evaluate on timezone change |

## Deferred Items (Won't Have v1)

- Notification history/log view (reviewing dismissed notifications)
- Per-session notification grouping
- Notification center drawer (dedicated notification panel)
- Rich toast actions (buttons within OS toast to take action)
- Cross-device notification sync

## Design Constraints for DESIGN Wave

1. **Functional programming paradigm**: All domain logic must be pure functions; effects at boundaries only
2. **Plugin sandbox**: norbert-notif uses only the NorbertAPI contract; no direct imports from other plugins
3. **CSS custom properties**: Use existing design system tokens for colors, spacing, typography
4. **Unicode symbols**: Use Unicode symbols (not emoji) for icons per user feedback
5. **Amber badge color**: Notification badges must use amber color per user feedback
6. **Sec-hdr title**: Plugin views must have sec-hdr title area indicating purpose
7. **Immutable state**: Follow readonly interface pattern from existing codebase (types.ts)
8. **Solution-neutral**: Stories specify observable outcomes, not technology choices. DESIGN wave selects implementation.

## Handoff Checklist

- [x] JTBD analysis complete (6 job stories, 3 personas, forces analysis, opportunity scoring)
- [x] Journey visualization complete (6-step journey, emotional arc, desktop mockups)
- [x] Journey schema (YAML) with integration validation rules
- [x] Gherkin scenarios (33 scenarios across 7 stories)
- [x] Shared artifacts registry (10 artifacts, 5 integration checkpoints)
- [x] 7 user stories in LeanUX format with full DoR compliance
- [x] DoR validation: all 7 stories PASSED
- [x] Peer review: APPROVED (iteration 2)
- [x] MoSCoW prioritization and build order defined
- [x] Risk assessment completed
- [x] Deferred items documented
- [x] Design constraints documented
