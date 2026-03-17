# Data Models: norbert-notif

All types are readonly/immutable following existing Norbert patterns (see `src/plugins/types.ts`). FP paradigm -- algebraic data types, discriminated unions, const arrays for known values.

---

## Notification Event Types

```
NotificationEventCategory = "session" | "cost" | "error" | "agent" | "system"

NotificationEventId =
  | "session_response_completed"
  | "session_started"
  | "context_compaction_occurred"
  | "token_count_threshold"
  | "cost_threshold_reached"
  | "context_window_threshold"
  | "hook_error_detected"
  | "hook_timeout"
  | "des_enforcement_block"
  | "agent_spawned"
  | "agent_completed"
  | "anomaly_detected"
  | "session_digest_ready"
  | "credit_balance_low"

NotificationEvent = {
  readonly id: NotificationEventId
  readonly label: string
  readonly category: NotificationEventCategory
  readonly hasThreshold: boolean
  readonly thresholdUnit: string | null       -- "$", "tokens", "%", null
  readonly defaultThreshold: number | null
}
```

---

## Channel Types

```
BuiltInChannelId = "toast" | "banner" | "badge"
AdvancedChannelId = "email" | "webhook"
ChannelId = BuiltInChannelId | AdvancedChannelId

ChannelStatus = "active" | "configured" | "not_configured" | "error"
```

---

## Sound Types

```
BuiltInSoundName = "phosphor-ping" | "amber-pulse" | "compaction"
                 | "session-complete" | "des-block" | "silence"

SoundEntry = {
  readonly name: string
  readonly source: "built-in" | "custom"
  readonly filePath: string | null   -- null for "silence"
}
```

---

## User Preferences

```
EventPreference = {
  readonly eventId: NotificationEventId
  readonly channels: {
    readonly toast: boolean
    readonly banner: boolean
    readonly badge: boolean
    readonly email: boolean
    readonly webhook: boolean
  }
  readonly sound: string             -- sound name from SoundEntry
  readonly threshold: number | null  -- for threshold-based events only
}

NotificationPreferences = {
  readonly version: 1
  readonly events: readonly EventPreference[]
  readonly globalVolume: number      -- 0-100
}
```

---

## Channel Configuration

```
SmtpConfig = {
  readonly host: string
  readonly port: number
  readonly username: string
  readonly from: string
  readonly to: string
  readonly encryption: "none" | "tls" | "starttls"
}
-- Note: password stored separately via OS credential API or encrypted config

WebhookConfig = {
  readonly url: string
  readonly method: "POST"
  readonly contentType: "application/json"
}

TrayBadgeConfig = {
  readonly style: "colored_dot" | "count"
  readonly color: "amber"   -- amber per project feedback
}

ChannelConfig = {
  readonly version: 1
  readonly toast: { readonly enabled: boolean }
  readonly banner: { readonly enabled: boolean }
  readonly badge: TrayBadgeConfig & { readonly enabled: boolean }
  readonly email: SmtpConfig & { readonly enabled: boolean; readonly status: ChannelStatus }
  readonly webhook: WebhookConfig & { readonly enabled: boolean; readonly status: ChannelStatus }
}
```

---

## DND State

```
DndBehavior = "queue_with_badge" | "discard_silently" | "banner_only"

DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

DndScheduleEntry = {
  readonly day: DayOfWeek
  readonly enabled: boolean
  readonly startTime: string | null   -- "HH:MM" format, null if not set
  readonly endTime: string | null
}

DndConfig = {
  readonly manuallyEnabled: boolean
  readonly scheduleEnabled: boolean
  readonly schedule: readonly DndScheduleEntry[]
  readonly behavior: DndBehavior
}

DndState = {
  readonly active: boolean
  readonly source: "manual" | "schedule" | "none"
  readonly endsAt: string | null      -- ISO 8601, null if manual
  readonly queuedCount: number
}
```

---

## Dispatch Engine Types

```
DispatchChannel = ChannelId

DispatchInstruction = {
  readonly channel: DispatchChannel
  readonly title: string
  readonly body: string
  readonly sound: string | null        -- null if badge-only or silence
  readonly volume: number              -- 0-100
  readonly isTest: boolean
  readonly eventId: NotificationEventId
  readonly metadata: Record<string, unknown>  -- event-specific data (session name, cost, etc.)
}

DispatchResult =
  | { readonly ok: true; readonly channel: DispatchChannel; readonly timestamp: string }
  | { readonly ok: false; readonly channel: DispatchChannel; readonly error: string; readonly timestamp: string }
```

---

## Banner State

```
BannerNotification = {
  readonly id: string                 -- unique ID for dismiss tracking
  readonly eventId: NotificationEventId
  readonly title: string
  readonly body: string
  readonly timestamp: string          -- ISO 8601
  readonly dismissed: boolean
  readonly isTest: boolean
}

BannerState = {
  readonly banners: readonly BannerNotification[]
  readonly unreadCount: number        -- derived from banners where dismissed === false
}
```

---

## Webhook Payload (outgoing)

```json
{
  "event": "cost_threshold_reached",
  "timestamp": "2026-03-17T14:45:10Z",
  "source": "norbert",
  "version": "1.0.0",
  "data": {
    "session": "api-refactor",
    "cost": 25.12,
    "threshold": 25.00,
    "currency": "USD"
  }
}
```

---

## Test Notification Payload

```
TestNotificationRequest = {
  readonly channel: ChannelId
  readonly channelConfig: ChannelConfig  -- current config for the channel being tested
}
```

The test notification creates a synthetic event payload with `isTest: true` and routes through the standard dispatch pipeline. The notification content is prefixed with "[TEST]" in all channels.

---

## Persistence Strategy

| Data | Location | Format |
|------|----------|--------|
| User preferences | `~/.norbert/plugins/norbert-notif/preferences.json` | JSON, schema version 1 |
| Channel config | `~/.norbert/plugins/norbert-notif/channels.json` | JSON, schema version 1 |
| DND config | `~/.norbert/plugins/norbert-notif/preferences.json` (nested) | JSON |
| SMTP password | OS credential store or encrypted in channels.json | Encrypted |
| Built-in sounds | `src/plugins/norbert-notif/assets/sounds/` | WAV files, bundled |
| Custom sounds | `~/.norbert/sounds/` | WAV, MP3, OGG |
| Banner state | In-memory (not persisted across restarts) | TypeScript runtime |
| DND runtime state | In-memory, backed by preferences.json for restart recovery | TypeScript runtime |

No new SQLite tables. norbert-notif does not write to the event store. All persistence is file-based JSON in the plugin's config directory.
