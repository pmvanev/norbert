/// Hook processor for norbert-usage plugin.
///
/// Factory function: createHookProcessor(deps) => (payload: unknown) => void
///
/// Pipeline: payload -> extractEventType -> buildAggregatorEvent -> aggregateEvent -> updateStore
///
/// Dependencies are injected via function parameters (no DI container).
/// Imports only from plugin types and its own domain modules.

import type { HookProcessor } from "../types";
import type { SessionMetrics, PricingTable } from "./domain/types";
import type { AggregatorEvent } from "./domain/metricsAggregator";
import type { CategorySampleInput } from "./adapters/multiSessionStore";
import { aggregateEvent } from "./domain/metricsAggregator";
import { computeInstantaneousRates } from "./domain/instantaneousRate";
import {
  PULSE_STRENGTHS,
  RATE_TICK_MS,
  type MetricId,
  type Pulse,
  type PulseKind,
} from "./domain/phosphor/phosphorMetricConfig";
import {
  deriveEventsRate,
  deriveTokensRate,
  deriveToolCallsRate,
} from "./domain/phosphor/rateDerivation";

// Re-export phosphor rate-derivation helpers so acceptance tests and
// upstream wiring can import the full derivation surface from a single
// hookProcessor module, matching the v2 derivation-seam driving-port
// shape declared in the acceptance test. Implementation lives in the
// pure `domain/phosphor/rateDerivation` module to keep this file's
// effect-boundary concerns separate from the pure rate math.
export {
  deriveEventsRate,
  deriveTokensRate,
  deriveToolCallsRate,
} from "./domain/phosphor/rateDerivation";

// ---------------------------------------------------------------------------
// Dependencies — injected at construction
// ---------------------------------------------------------------------------

export interface HookProcessorDeps {
  readonly updateMetrics: (reducer: (prev: SessionMetrics) => SessionMetrics) => void;
  readonly updateMultiSessionMetrics?: (sessionId: string, label: string, reducer: (prev: SessionMetrics) => SessionMetrics) => void;
  readonly appendSessionSample?: (sessionId: string, samples: CategorySampleInput) => void;
  /**
   * v2 phosphor: append a rate sample (events/s, tokens/s, or toolcalls/s)
   * onto the session's per-metric history. Called by:
   *   - per-event tokens/s derivation on OTel `api_request` arrivals
   *   - per-tick events/s and toolcalls/s derivation from `sampleRates`
   */
  readonly appendRateSample?: (
    sessionId: string,
    metric: MetricId,
    t: number,
    v: number,
  ) => void;
  /**
   * v2 phosphor: append a pulse event onto the session's pulse log.
   * Called per-event with the pulse kind (tool / subagent / lifecycle)
   * derived from the event_type.
   */
  readonly appendPulse?: (sessionId: string, pulse: Pulse) => void;
  /**
   * Clock dependency. Defaults to `Date.now` when omitted so existing
   * callers and tests are unaffected. Tests inject a deterministic clock
   * (e.g. `vi.getMockedSystemTime`) to pin rate-sample timestamps.
   */
  readonly now?: () => number;
  readonly pricingTable: PricingTable;
  readonly getIsOtelActive?: (sessionId: string) => boolean;
}

/**
 * The hookProcessor returned by `createHookProcessor`. Callable as
 * `HookProcessor(payload)` — the existing plugin-loader contract — and
 * augmented with a `sampleRates(now)` method that the composition root
 * invokes on a 5-second tick to derive events/s and toolcalls/s rate
 * samples from closure-scoped counters.
 *
 * The augmentation preserves backwards compatibility: existing unit
 * tests that destructure the returned function and call it directly
 * remain unchanged (a function-with-property is still a function).
 */
export type HookProcessorWithRateSampler = HookProcessor & {
  /**
   * Drain the closure-scoped per-session events / toolcalls counters as
   * rate samples at time `now`, then reset the counters. Idempotent per
   * session — invoking with no intervening events produces a zero sample.
   *
   * Noop when `appendRateSample` was not injected (production + tests
   * that do not exercise the v2 rate pathway remain unaffected).
   */
  readonly sampleRates: (now: number) => void;

  /**
   * Prime the live-rate boundary to the backfill's query timestamp.
   *
   * After a successful phosphor-history backfill, the caller invokes this
   * with the Rust-side query time that bounded the backfill. The processor
   * then treats any event with `received_at >= queryTimeMs` as live and
   * anything older as already-covered-by-backfill (dropped). The first
   * live rate tick emits a sample for the window starting at queryTimeMs,
   * so backfill and live stitch together without a visible gap or
   * double-counted events on the seam.
   *
   * Safe to call multiple times (last call wins). Safe to never call —
   * the processor falls back to the historical first-tick-prime when
   * `lastTickAt` remains unset.
   */
  readonly primeFromBackfill: (queryTimeMs: number) => void;
};

// ---------------------------------------------------------------------------
// Payload field extraction — pure helpers
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Extract event_type string from an unknown payload, defaulting to "unknown". */
const extractEventType = (payload: unknown): string => {
  if (!isRecord(payload)) return "unknown";
  const eventType = payload["event_type"];
  return typeof eventType === "string" ? eventType : "unknown";
};

/** Extract session_id from the raw event payload wrapper. */
const extractSessionId = (payload: unknown): string | null => {
  if (!isRecord(payload)) return null;
  const sid = payload["session_id"];
  return typeof sid === "string" ? sid : null;
};

/** Extract the provider tag from an event wrapper.
 *  Known values: "hook", "otel", "transcript". Returns null when absent. */
const extractProvider = (payload: unknown): string | null => {
  if (!isRecord(payload)) return null;
  const provider = payload["provider"];
  return typeof provider === "string" ? provider : null;
};

/** Extract `received_at` as epoch milliseconds, or null if absent/malformed.
 *  Used to distinguish fresh events from backlog replay (e.g. the first
 *  `get_new_events_batch` call against a pre-existing session returns every
 *  historical event). Events older than the current rate window are stale
 *  and must not contribute to live per-minute rates. */
const extractReceivedAtMs = (payload: unknown): number | null => {
  if (!isRecord(payload)) return null;
  const raw = payload["received_at"];
  if (typeof raw !== "string") return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
};

/** Extract a human-readable project name from the event payload.
 *  Claude Code hook payloads include a `cwd` field with the working directory.
 *  Falls back to the last segment of `transcript_path` parent directories. */
const extractSessionLabel = (payload: unknown): string => {
  if (!isRecord(payload)) return "";
  // Try cwd first (top-level field on Claude Code hook payloads)
  const cwd = payload["cwd"];
  if (typeof cwd === "string" && cwd.length > 0) {
    const segments = cwd.replace(/\\/g, "/").split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "";
  }
  // Try inner payload's cwd
  const inner = payload["payload"];
  if (isRecord(inner)) {
    const innerCwd = inner["cwd"];
    if (typeof innerCwd === "string" && innerCwd.length > 0) {
      const segments = innerCwd.replace(/\\/g, "/").split("/").filter(Boolean);
      return segments[segments.length - 1] ?? "";
    }
  }
  return "";
};

/** Extract the inner payload from a DB event wrapper.
 *
 * Events from get_session_events arrive as:
 *   { session_id, event_type, payload: { ...claude code fields... }, received_at, provider }
 *
 * The token extractor needs the inner payload (where usage lives),
 * not the outer wrapper.
 */
const extractInnerPayload = (wrapper: unknown): unknown => {
  if (!isRecord(wrapper)) return wrapper;
  const inner = wrapper["payload"];
  return inner !== undefined ? inner : wrapper;
};

/** Build an AggregatorEvent from a raw payload and extracted event type. */
const buildAggregatorEvent = (
  eventType: string,
  payload: unknown,
): AggregatorEvent => ({
  eventType,
  payload: extractInnerPayload(payload),
  receivedAt: new Date().toISOString(),
});

// ---------------------------------------------------------------------------
// emitPulse — pure helper that builds a Pulse from a kind and timestamp.
//
// The strength for each kind is looked up from the `PULSE_STRENGTHS` table
// in `domain/phosphor/phosphorMetricConfig` (the single source of truth).
// Keeping the lookup as pure data means this helper has no effects and is
// trivially composable at the hookProcessor effect boundary.
//
// Strength convention (see DESIGN §5 Q1): tool > subagent > lifecycle.
// ---------------------------------------------------------------------------

/**
 * Build a `Pulse` for a hook event of the given `kind` observed at time `t`.
 * Pure: derives `strength` from `PULSE_STRENGTHS[kind]`. Callers inject the
 * timestamp so this helper remains clock-free (effects at the boundary).
 */
export const emitPulse = (kind: PulseKind, t: number): Pulse => ({
  t,
  kind,
  strength: PULSE_STRENGTHS[kind],
});

// ---------------------------------------------------------------------------
// Pulse-kind classification — maps event_type to the phosphor pulse kind.
//
// Per v2-phosphor-architecture.md §5 Q1: tool events emit the strongest
// flare, subagent lifecycle events a medium flare, session lifecycle
// events the softest. Event-type names cover both Claude Code hook
// provider names (PreToolUse / PostToolUse / SubagentStop) and OTel /
// internal aliases (tool_call_start / tool_result / agent_complete /
// session_start) so the classification works uniformly regardless of
// which upstream stream delivered the event.
// ---------------------------------------------------------------------------

const TOOL_EVENT_TYPES: ReadonlySet<string> = new Set([
  "PreToolUse",
  "PostToolUse",
  "tool_call_start",
  "tool_call_end",
  "tool_result",
]);

const SUBAGENT_EVENT_TYPES: ReadonlySet<string> = new Set([
  "SubagentStop",
  "agent_complete",
]);

const LIFECYCLE_EVENT_TYPES: ReadonlySet<string> = new Set([
  "SessionStart",
  "SessionEnd",
  "session_start",
  "session_end",
]);

/**
 * Classify an `event_type` into its phosphor pulse kind.
 *
 * Returns `null` for event types that do not warrant a visual pulse
 * (notifications, prompt_submit, api_request, unknown) — the scope
 * intentionally reserves pulses for the three kinds Phil uses to judge
 * ambient aliveness. Pure: lookup against three immutable sets.
 */
const classifyPulseKind = (eventType: string): PulseKind | null => {
  if (TOOL_EVENT_TYPES.has(eventType)) return "tool";
  if (SUBAGENT_EVENT_TYPES.has(eventType)) return "subagent";
  if (LIFECYCLE_EVENT_TYPES.has(eventType)) return "lifecycle";
  return null;
};

/** Is the event_type one that counts toward the toolcalls/s rate? */
const isToolCallEvent = (eventType: string): boolean =>
  TOOL_EVENT_TYPES.has(eventType);

// ---------------------------------------------------------------------------
// OTel api_request token extraction — pure helpers
// ---------------------------------------------------------------------------

/** ITPM-consuming tokens from a Claude Code usage record.
 *
 * On modern Claude models (4.x family) Anthropic's input-tokens-per-minute
 * limit is charged only on `input_tokens + cache_creation_input_tokens`.
 * `cache_read_input_tokens` is free for rate-limiting (billed at 10% of
 * input price, but 0% of ITPM quota), and `output_tokens` lives in a
 * separate OTPM bucket. We sum only the ITPM-consuming fields so the
 * tokens/s trace answers "am I about to hit the rate limit I'm most
 * likely to hit" — for long-context agentic work, that's ITPM. */
const totalTokensOf = (usage: Record<string, unknown>): number => {
  const input = typeof usage["input_tokens"] === "number" ? (usage["input_tokens"] as number) : 0;
  const cacheCreate = typeof usage["cache_creation_input_tokens"] === "number" ? (usage["cache_creation_input_tokens"] as number) : 0;
  return input + cacheCreate;
};

/**
 * Extract the total tokens reported by an OTel `api_request` payload.
 * Returns `null` when the payload's inner record or `usage` block is
 * missing or malformed — the caller then skips the token accumulation.
 *
 * Production OTel payloads (see `get_session_events`) do NOT carry a
 * `duration_ms` field; tokens/s is therefore accumulated per session
 * across each 5-second rate-tick window and drained by `sampleRates`,
 * mirroring the structure of events/s and toolcalls/s. Pure: no throwing
 * on malformed payloads.
 */
const extractOtelTokenTotal = (payload: unknown): number | null => {
  const inner = extractInnerPayload(payload);
  if (!isRecord(inner)) return null;
  const usage = inner["usage"];
  if (!isRecord(usage)) return null;
  return totalTokensOf(usage);
};

// ---------------------------------------------------------------------------
// Category sample derivation — pure helper
// ---------------------------------------------------------------------------

/** Minimum assumed interval (ms) between events when no prior timestamp exists. */
const DEFAULT_EVENT_INTERVAL_MS = 1000;

/** Derive per-category sample values from previous and updated session metrics.
 *
 *  Uses the real elapsed time between events (from lastEventAt) to compute
 *  instantaneous rates. Falls back to 1 second when no prior timestamp exists. */
const deriveCategorySamples = (
  previous: SessionMetrics,
  updated: SessionMetrics,
): CategorySampleInput => {
  const now = Date.now();
  const previousTimestamp = previous.lastEventAt
    ? new Date(previous.lastEventAt).getTime()
    : 0;
  // Use real elapsed time; fall back to 1s for first event or invalid timestamps
  const elapsed = previousTimestamp > 0 ? now - previousTimestamp : DEFAULT_EVENT_INTERVAL_MS;
  const safeElapsed = Math.max(DEFAULT_EVENT_INTERVAL_MS, elapsed);

  const previousSnapshot = {
    totalTokens: previous.totalTokens,
    sessionCost: previous.sessionCost,
    timestamp: now - safeElapsed,
  };
  const currentSnapshot = {
    totalTokens: updated.totalTokens,
    sessionCost: updated.sessionCost,
    timestamp: now,
  };
  const { tokenRate, costRate } = computeInstantaneousRates(currentSnapshot, previousSnapshot);

  return {
    tokens: tokenRate,
    cost: costRate,
    agents: updated.activeAgentCount,
    latency: updated.lastApiLatencyMs,
  };
};

// ---------------------------------------------------------------------------
// Public API — factory with dependency injection
// ---------------------------------------------------------------------------

/**
 * Create a hook processor that dispatches session-event payloads through
 * the extraction, pricing, and aggregation pipeline.
 *
 * The processor composes pure domain functions (tokenExtractor, pricingModel,
 * metricsAggregator) with the effect boundary (metrics store update).
 *
 * Pipeline per invocation:
 * 1. extractEventType(payload) -> eventType string
 * 2. buildAggregatorEvent(eventType, payload) -> AggregatorEvent
 * 3. aggregateEvent(prev, event, pricingTable) -> next SessionMetrics
 * 4. updateMetrics(reducer) -> effect (store update)
 */
export const createHookProcessor = (
  deps: HookProcessorDeps,
): HookProcessorWithRateSampler => {
  const {
    updateMetrics,
    updateMultiSessionMetrics,
    appendSessionSample,
    appendRateSample,
    appendPulse,
    pricingTable,
    getIsOtelActive,
  } = deps;
  const now = deps.now ?? Date.now;

  // Per-session OTel-active tracking. A session is flipped to OTel mode
  // on the first event tagged with provider="otel" and remains in that
  // mode for the rest of its lifetime. Subsequent hook-provider events
  // for that session are routed through the OTel dispatch table, which
  // suppresses hook-side cost/token accumulation and avoids double-
  // counting against OTel api_request events.
  const otelActiveSessions = new Set<string>();

  // v2 phosphor counters. Per-session accumulators drained and reset by
  // `sampleRates(now)` on each 5-second tick. The mutable cell lives in
  // this closure so the production effect boundary stays inside this
  // module (the composition root only owns the ticker scheduler).
  //
  // `tokens` accumulates the total tokens observed on OTel `api_request`
  // events within the current 5s window. It mirrors `events` and
  // `toolcalls` — production OTel payloads do not carry `duration_ms`,
  // so per-event tokens/s derivation is not possible; tick accumulation
  // is the only viable approach.
  const sessionCounters = new Map<
    string,
    { events: number; toolcalls: number; tokens: number }
  >();

  // Wall-clock timestamp of the previous `sampleRates` tick. Tracked so
  // each emitted rate sample uses the REAL elapsed window (tickBoundaryT
  // minus lastTickAt) rather than the nominal `RATE_TICK_MS` constant.
  //
  // The first invocation of `sampleRates` has no reference point: events
  // that accumulated in `sessionCounters` before the ticker was ready
  // could span any fraction of a full window (the plugin's onLoad fires
  // before `setInterval`'s first tick, and the interval itself can be
  // further delayed by event-loop pressure or background-tab throttling).
  // Emitting a rate on that first tick would inflate the sample by
  // dividing real events by an assumed-but-wrong 5s window — exactly the
  // symptom Phil observed as a transient "thousands/s" spike at load.
  //
  // Instead, the first call primes `lastTickAt` and resets counters
  // without emitting. Subsequent calls compute windowMs from the real
  // delta and emit. Trade-off: first honest rate sample lands ~10s after
  // plugin load (the second tick), not ~5s.
  let lastTickAt: number | null = null;

  // ---------------------------------------------------------------------
  // DEV-only diagnostics. Guarded behind `import.meta.env.DEV` so
  // production builds emit nothing. Phil opens DevTools during a local
  // run to confirm the v2 pipeline actually receives events and the 5s
  // tick actually fires. Logs once per boundary (first event, first rate
  // sample, first pulse) to avoid console spam.
  // ---------------------------------------------------------------------
  const isDev =
    typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined" &&
    Boolean(import.meta.env.DEV);
  let loggedFirstEvent = false;
  let loggedFirstRateSample = false;
  let loggedFirstPulse = false;
  let loggedPrimedTick = false;
  let loggedFirstRealTick = false;

  const ensureCounters = (
    sessionId: string,
  ): { events: number; toolcalls: number; tokens: number } => {
    const existing = sessionCounters.get(sessionId);
    if (existing) return existing;
    const fresh = { events: 0, toolcalls: 0, tokens: 0 };
    sessionCounters.set(sessionId, fresh);
    return fresh;
  };

  const processor: HookProcessor = (payload: unknown): void => {
    const eventType = extractEventType(payload);
    const event = buildAggregatorEvent(eventType, payload);
    const sessionId = extractSessionId(payload);
    const provider = extractProvider(payload);

    // Flip the switch BEFORE dispatch so the triggering OTel event is
    // itself processed through the OTel handlers.
    if (sessionId && provider === "otel") {
      otelActiveSessions.add(sessionId);
    }

    const isOtelActive = sessionId
      ? otelActiveSessions.has(sessionId) || (getIsOtelActive?.(sessionId) ?? false)
      : false;

    updateMetrics((previous: SessionMetrics): SessionMetrics =>
      aggregateEvent(previous, event, pricingTable, isOtelActive),
    );

    // Also feed multi-session store if available
    if (updateMultiSessionMetrics) {
      if (sessionId) {
        const label = extractSessionLabel(payload);
        // Capture previous and updated metrics for category sample derivation
        let previousMetrics: SessionMetrics | undefined;
        let updatedMetrics: SessionMetrics | undefined;

        updateMultiSessionMetrics(sessionId, label, (previous: SessionMetrics): SessionMetrics => {
          previousMetrics = previous;
          const next = aggregateEvent(previous, event, pricingTable, isOtelActive);
          updatedMetrics = next;
          return next;
        });

        // v1: Append per-category samples after metrics update (legacy path,
        // still feeds gauges / session-status / other adjacent v1 consumers).
        if (appendSessionSample && previousMetrics && updatedMetrics) {
          const samples = deriveCategorySamples(previousMetrics, updatedMetrics);
          appendSessionSample(sessionId, samples);
        }
      }
    }

    // v2 phosphor: per-event pulse emission + rate counter increments.
    // Guarded on sessionId so hook events that are not scoped to a session
    // do not pollute per-session state.
    //
    // Backlog guard: when Norbert opens against a pre-existing session, the
    // first `get_new_events_batch` call delivers every historical event in
    // a burst. Those ancient events carry a `received_at` from when they
    // were first POSTed to the hook-receiver (hours or days old). If they
    // contributed to the phosphor live signals (rates + pulses), the scope
    // would show misleading spikes that don't correspond to current
    // activity. Rejecting anything older than 2× RATE_TICK_MS keeps all
    // three live signals honest while leaving the cumulative session-state
    // updates above intact (those legitimately want every event).
    //
    // Freshness threshold is 2× RATE_TICK_MS to tolerate the gap between
    // an event firing and the next poll tick delivering it.
    if (sessionId) {
      const receivedAtMs = extractReceivedAtMs(payload);
      // Live-stream partitioning:
      //   - Before the first prime (lastTickAt === null): fall back to the
      //     age-based guard so events that beat the first tick still land
      //     in the counter when backfill is unavailable or still in flight.
      //   - After prime: accept only events whose received_at is inside
      //     the current tick window (>= lastTickAt). Events before the
      //     boundary were already painted by the backfill or a prior tick;
      //     accepting them again would double-count on the seam.
      //   - Events with no received_at fall through to accepted (defensive —
      //     payloads normalized by the Claude Code provider always carry it).
      const freshEnough =
        receivedAtMs === null ||
        (lastTickAt === null
          ? now() - receivedAtMs <= 2 * RATE_TICK_MS
          : receivedAtMs >= lastTickAt);

      if (freshEnough) {
        const counters = ensureCounters(sessionId);
        counters.events += 1;
        if (isToolCallEvent(eventType)) {
          counters.toolcalls += 1;
        }

        if (isDev && !loggedFirstEvent) {
          loggedFirstEvent = true;
          // eslint-disable-next-line no-console
          console.log(
            `[phosphor] first event received — session=${sessionId} type=${eventType}`,
          );
        }

        // Emit a pulse for event types that warrant one. Tool events carry
        // the strongest strength; subagent lifecycle a medium strength;
        // session lifecycle the softest. Event types outside the three
        // classes (prompt_submit, api_request, notifications, unknown) do
        // not emit pulses — this keeps the scope signal diagnostic rather
        // than saturated.
        if (appendPulse) {
          const kind = classifyPulseKind(eventType);
          if (kind) {
            appendPulse(sessionId, emitPulse(kind, now()));
            if (isDev && !loggedFirstPulse) {
              loggedFirstPulse = true;
              // eslint-disable-next-line no-console
              console.log(
                `[phosphor] first pulse appended — session=${sessionId} kind=${kind}`,
              );
            }
          }
        }

        // Tokens/min is accumulated per-session and drained on the 5-second
        // rate tick (see `sampleRates`). Only `api_request` events carry
        // token usage, and they are emitted exclusively by the OTel
        // adapter (Claude Code hooks never emit `api_request` — see
        // adapters/providers/claude_code.rs::HOOK_EVENT_NAMES).
        // `extractOtelTokenTotal` returns null for payloads missing the
        // `usage` block, so malformed events don't inflate the counter.
        if (appendRateSample && eventType === "api_request") {
          const total = extractOtelTokenTotal(payload);
          if (total !== null && total > 0) {
            counters.tokens += total;
          }
        }
      }
    }
  };

  /**
   * Drain the events / toolcalls / tokens counters as rate samples.
   * Invoked by the composition root on its 5-second tick. Resets counters
   * on exit so the next window starts from zero. Noop when
   * `appendRateSample` was not injected (the v2 pathway is disabled).
   *
   * Uses the REAL elapsed window (tickBoundaryT minus lastTickAt) as the
   * divisor rather than the nominal `RATE_TICK_MS` constant. This avoids
   * rate inflation when the first tick fires against a counter populated
   * over an unknown-length warm-up window, and it corrects for any jitter
   * in the `setInterval` cadence (background-tab throttling, event-loop
   * pressure) on subsequent ticks.
   *
   * First call: primes `lastTickAt`, resets counters, emits nothing.
   * Negative / zero windowMs (clock skew): skipped entirely — counters
   * and `lastTickAt` are left untouched, waiting for a forward-moving
   * clock on the next tick.
   *
   * Tokens/s uses the same windowed-rate semantics as the other two
   * metrics (total tokens observed in the window divided by the window
   * duration in seconds) because production OTel `api_request` payloads
   * do not carry `duration_ms` — per-event derivation is not possible.
   */
  const sampleRates = (tickBoundaryT: number): void => {
    if (!appendRateSample) return;

    // First call: prime the reference timestamp and zero the counters
    // without emitting. See `lastTickAt` docblock for the rationale.
    if (lastTickAt === null) {
      if (isDev && !loggedPrimedTick) {
        loggedPrimedTick = true;
        // eslint-disable-next-line no-console
        console.log(
          `[phosphor] rate ticker primed — sessionCount=${sessionCounters.size} t=${tickBoundaryT} (no samples emitted; awaiting next tick for real delta-t)`,
        );
      }
      for (const counters of sessionCounters.values()) {
        counters.events = 0;
        counters.toolcalls = 0;
        counters.tokens = 0;
      }
      lastTickAt = tickBoundaryT;
      return;
    }

    // Defensive: a non-forward-moving clock would yield a nonsensical
    // rate. Skip this tick without touching counters or lastTickAt so the
    // next forward-moving tick emits with a merged (larger) window.
    const windowMs = tickBoundaryT - lastTickAt;
    if (windowMs <= 0) {
      return;
    }

    for (const [sessionId, counters] of sessionCounters.entries()) {
      const eventsSample = deriveEventsRate(
        counters.events,
        windowMs,
        tickBoundaryT,
      );
      appendRateSample(sessionId, "events", eventsSample.t, eventsSample.v);

      const toolcallsSample = deriveToolCallsRate(
        counters.toolcalls,
        windowMs,
        tickBoundaryT,
      );
      appendRateSample(
        sessionId,
        "toolcalls",
        toolcallsSample.t,
        toolcallsSample.v,
      );

      // Tokens/min — ITPM-consuming tokens accumulated this window,
      // scaled to per-minute so the axis matches Anthropic's published
      // ITPM limit directly (see deriveTokensRate).
      const tokensSample = deriveTokensRate(
        counters.tokens,
        windowMs,
        tickBoundaryT,
      );
      appendRateSample(sessionId, "tokens", tokensSample.t, tokensSample.v);
      if (isDev && !loggedFirstRateSample && tokensSample.v > 0) {
        loggedFirstRateSample = true;
        // eslint-disable-next-line no-console
        console.log(
          `[phosphor] first tokens/s rate sample — session=${sessionId} v=${tokensSample.v.toFixed(2)}`,
        );
      }

      counters.events = 0;
      counters.toolcalls = 0;
      counters.tokens = 0;
    }

    // DEV-only: fire once on the first tick that actually emits samples,
    // separate from the primed-tick log so Phil can see both boundaries.
    if (isDev && !loggedFirstRealTick) {
      loggedFirstRealTick = true;
      // eslint-disable-next-line no-console
      console.log(
        `[phosphor] first real rate tick emitted — sessionCount=${sessionCounters.size} windowMs=${windowMs.toFixed(0)}`,
      );
    }

    lastTickAt = tickBoundaryT;
  };

  /**
   * Prime `lastTickAt` to the Rust-side backfill query time and discard
   * any counter state accumulated in the race window between processor
   * construction and backfill completion.
   *
   * After this call:
   *   - `sampleRates` emits samples using windowMs = tickBoundaryT -
   *     queryTimeMs on its first real tick, which stitches seamlessly to
   *     the last backfill bucket.
   *   - The processor's live-event guard rejects events with received_at
   *     < queryTimeMs. Those events were covered by the backfill; accepting
   *     them again would double-count on the seam.
   */
  const primeFromBackfill = (queryTimeMs: number): void => {
    for (const counters of sessionCounters.values()) {
      counters.events = 0;
      counters.toolcalls = 0;
      counters.tokens = 0;
    }
    lastTickAt = queryTimeMs;
  };

  // Function-with-property: the callable stays a `HookProcessor`
  // (preserving the plugin-loader contract and existing unit-test
  // destructure-and-call pattern) while exposing `sampleRates` for the
  // composition root's 5-second tick scheduler.
  const augmented = processor as HookProcessorWithRateSampler;
  (augmented as { sampleRates: (t: number) => void }).sampleRates = sampleRates;
  (augmented as { primeFromBackfill: (t: number) => void }).primeFromBackfill =
    primeFromBackfill;
  return augmented;
};

