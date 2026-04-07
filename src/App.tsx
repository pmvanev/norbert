import { useState, useEffect, useCallback, useMemo, useRef, startTransition, type FC } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  type AppStatus,
  type SessionInfo,
  formatField,
  formatSessionTimestamp,
  deriveConnectionStatus,
  isSessionActive,
} from "./domain/status";
import { deriveSessionName } from "./domain/sessionPresentation";
import { createInitialMetrics } from "./plugins/norbert-usage/domain/metricsAggregator";
import {
  type ThemeName,
  THEME_NAMES,
  readStoredTheme,
  storeTheme,
  themeToClassName,
} from "./domain/theme";
import { buildMenuBar } from "./domain/menu";
import { MenuBar } from "./components/MenuBar";
import { loadPlugins } from "./plugins/lifecycleManager";
import { createNorbertAPI } from "./plugins/apiFactory";
import { createPluginRegistry, getAllViews } from "./plugins/pluginRegistry";
import { norbertSessionPlugin } from "./plugins/norbert-session/index";
import { norbertUsagePlugin, usageMetricsStore, usageMultiSessionStore } from "./plugins/norbert-usage/index";
import { norbertConfigPlugin } from "./plugins/norbert-config/index";
import { norbertNotifPlugin } from "./plugins/norbert-notif/index";
import { NotificationCenterStandalone } from "./plugins/norbert-notif/views/NotificationCenterView";
import { ConfigViewerView } from "./plugins/norbert-config/views/ConfigViewerView";
import { ConfigDetailPanel } from "./plugins/norbert-config/views/ConfigDetailPanel";
import type { SelectedConfigItem } from "./plugins/norbert-config/domain/types";
import { PerformanceMonitorView } from "./plugins/norbert-usage/views/PerformanceMonitorView";
import { CostTicker } from "./plugins/norbert-usage/views/CostTicker";
import { SessionStatusView, type SessionEvent as DashboardSessionEvent } from "./plugins/norbert-usage/views/SessionStatusView";
import type { AccumulatedMetric as BackendAccumulatedMetric } from "./plugins/norbert-usage/domain/activeTimeFormatter";
import { computeGaugeClusterData } from "./plugins/norbert-usage/domain/gaugeCluster";
import { computeCostTickerData } from "./plugins/norbert-usage/domain/costTicker";
import { resetHookBridge, deliverHookEvent } from "./plugins/hookBridge";
import { createDefaultLayoutState, isSecondaryVisible, toggleSecondaryZone, type TwoZoneLayoutState } from "./layout/zoneToggle";
import { assignView } from "./layout/assignmentEngine";
import { ZoneRenderer, type ViewRegistry } from "./layout/zoneRenderer";
import { SessionListView } from "./views/SessionListView";
import { EventDetailView } from "./views/EventDetailView";
import { createDefaultSidebarState, getVisibleItems } from "./sidebar/sidebarManager";
import { Icon } from "./components/Icon";
import { createIdlePoller, yieldToMain } from "./scheduling";
// LayoutState base type imported via TwoZoneLayoutState from zoneToggle

/// Polling interval in milliseconds for live UI updates.
const POLL_INTERVAL_MS = 2000;

/// Minimum zone width in pixels for the layout divider.
const MIN_ZONE_WIDTH = 200;

/// Default container width for the layout engine.
const DEFAULT_CONTAINER_WIDTH = 800;

/// Applies a theme CSS class to the document root element.
/// Removes all other theme classes first to ensure clean switching.
const applyThemeToDocument = (theme: ThemeName): void => {
  const root = document.documentElement;
  for (const name of THEME_NAMES) {
    root.classList.remove(themeToClassName(name));
  }
  root.classList.add(themeToClassName(theme));
};

/// Initializes the plugin system by loading norbert-session and norbert-usage
/// via the standard plugin lifecycle. Returns the plugin registry with all
/// registered views, tabs, and hooks.
const initializePluginSystem = () => {
  resetHookBridge();
  return loadPlugins(
    [norbertSessionPlugin, norbertUsagePlugin, norbertConfigPlugin, norbertNotifPlugin],
    createPluginRegistry(),
    createNorbertAPI
  );
};

/// Creates the initial layout state with session-list assigned to the main zone.
const createInitialLayout = (): TwoZoneLayoutState => {
  const defaultLayout = createDefaultLayoutState();
  const withView = assignView(defaultLayout, "main", "session-list", "norbert-session");
  return { ...defaultLayout, ...withView };
};

/// Fetches session events and metrics via IPC and renders the SessionDashboard.
///
/// Extracted as a standalone component so React hooks work correctly
/// (components inside useMemo read from refs, this component manages its own state).
/// Loader for the combined Session Status view.
///
/// Fetches events + OTel metrics for the selected session, reads per-session
/// gauge metrics from the multi-session store (so gauges reflect THIS session,
/// not aggregate data), and fetches the session metadata once to derive a
/// human-readable name from the cwd.
function SessionStatusLoader({
  sessionId,
  eventCount,
  startedAtFallback,
  onClose,
}: {
  readonly sessionId: string;
  readonly eventCount: number;
  readonly startedAtFallback: string;
  readonly onClose?: () => void;
}) {
  const [events, setEvents] = useState<DashboardSessionEvent[]>([]);
  const [metrics, setMetrics] = useState<BackendAccumulatedMetric[]>([]);
  const [cwd, setCwd] = useState<string | null>(null);

  // Fetch session metadata once per sessionId change to derive the name.
  useEffect(() => {
    let cancelled = false;
    invoke<Array<{ session_id: string; cwd: string | null }>>("get_all_session_metadata")
      .then((list) => {
        if (cancelled) return;
        const meta = list.find((m) => m.session_id === sessionId);
        setCwd(meta?.cwd ?? null);
      })
      .catch(() => {
        // Missing metadata is not fatal — falls back to timestamp name.
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    let prevEvtLen = 0;
    let prevMetLen = 0;
    const fetchData = async () => {
      const [eventsResult, metricsResult] = await Promise.allSettled([
        invoke<DashboardSessionEvent[]>("get_session_events", { sessionId }),
        invoke<BackendAccumulatedMetric[]>("get_metrics_for_session", { sessionId }),
      ]);
      if (cancelled) return;
      if (eventsResult.status === "fulfilled" && eventsResult.value.length !== prevEvtLen) {
        prevEvtLen = eventsResult.value.length;
        await yieldToMain();
        startTransition(() => setEvents(eventsResult.value));
      }
      if (metricsResult.status === "fulfilled" && metricsResult.value.length !== prevMetLen) {
        prevMetLen = metricsResult.value.length;
        await yieldToMain();
        startTransition(() => setMetrics(metricsResult.value));
      }
    };
    const stop = createIdlePoller(fetchData, POLL_INTERVAL_MS);
    return () => { cancelled = true; stop(); };
  }, [sessionId]);

  // Subscribe to per-session metrics from the multi-session store.
  // This is the correct source for gauge cluster data -- the global
  // usageMetricsStore is an aggregate across all sessions.
  const [sessionMetrics, setSessionMetrics] = useState(() =>
    usageMultiSessionStore.getSession(sessionId),
  );

  useEffect(() => {
    setSessionMetrics(usageMultiSessionStore.getSession(sessionId));
    return usageMultiSessionStore.subscribe(() =>
      startTransition(() => setSessionMetrics(usageMultiSessionStore.getSession(sessionId))),
    );
  }, [sessionId]);

  const effectiveMetrics = sessionMetrics ?? createInitialMetrics(sessionId);
  const gaugeData = computeGaugeClusterData(effectiveMetrics);

  const totalApiRequests = events.filter((e) => e.event_type === "api_request").length;
  const sessionName = deriveSessionName(cwd, formatSessionTimestamp(startedAtFallback));
  return (
    <SessionStatusView
      sessionName={sessionName}
      eventCount={eventCount}
      totalTokens={effectiveMetrics.totalTokens}
      inputTokens={effectiveMetrics.inputTokens}
      outputTokens={effectiveMetrics.outputTokens}
      events={events}
      metrics={metrics}
      totalApiRequests={totalApiRequests}
      gaugeData={gaugeData}
      onClose={onClose}
    />
  );
}

function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedConfigItem, setSelectedConfigItem] = useState<SelectedConfigItem | null>(null);
  const [theme, setTheme] = useState<ThemeName>(() =>
    readStoredTheme(localStorage)
  );
  const [layout, setLayout] = useState<TwoZoneLayoutState>(createInitialLayout);

  /// Initialize plugin system once on mount.
  const [pluginRegistry] = useState(initializePluginSystem);

  /// Initialize sidebar from plugin registry views.
  /// Filter out drill-down views (session-detail) that only make sense
  /// as a navigation target, not a standalone sidebar entry.
  const sidebarState = useMemo(
    () => createDefaultSidebarState(
      getAllViews(pluginRegistry).filter((v) => v.id !== "session-detail" && v.id !== "config-detail" && v.id !== "session-status"),
      [],
    ),
    [pluginRegistry]
  );
  const visibleSidebarItems = useMemo(
    () => getVisibleItems(sidebarState),
    [sidebarState]
  );

  /// Apply theme class to document on mount and theme change.
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const handleThemeSelect = useCallback((newTheme: ThemeName) => {
    setTheme(newTheme);
    storeTheme(newTheme, localStorage);
  }, []);

  const menuEntries = useMemo(
    () => buildMenuBar(theme, handleThemeSelect),
    [theme, handleThemeSelect]
  );

  /// Handler for selecting a session row to view its events.
  /// Opens session-detail in the secondary zone (side-by-side layout).
  const handleSessionSelect = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
    setLayout((currentLayout) => {
      // Ensure secondary zone is visible
      const withSecondary = isSecondaryVisible(currentLayout)
        ? currentLayout
        : toggleSecondaryZone(currentLayout);
      const assigned = assignView(withSecondary, "secondary", "session-status", "norbert-usage");
      return { ...withSecondary, ...assigned };
    });
  }, []);

  /// Handler for selecting a config item to view its details.
  /// Opens config-detail in the secondary zone (side-by-side layout).
  const handleConfigItemSelect = useCallback((item: SelectedConfigItem) => {
    setSelectedConfigItem(item);
    setLayout((currentLayout) => {
      const withSecondary = isSecondaryVisible(currentLayout)
        ? currentLayout
        : toggleSecondaryZone(currentLayout);
      const assigned = assignView(withSecondary, "secondary", "config-detail", "norbert-config");
      return { ...withSecondary, ...assigned };
    });
  }, []);

  /// Handler for navigating back to the session list.
  /// Closes the secondary zone.
  const handleBackToSessions = useCallback(() => {
    setSelectedSessionId(null);
    setLayout((currentLayout) =>
      isSecondaryVisible(currentLayout)
        ? toggleSecondaryZone(currentLayout)
        : currentLayout
    );
  }, []);

  /// Handler for divider position changes from ZoneRenderer.
  const handleDividerPositionChange = useCallback((ratio: number) => {
    setLayout((currentLayout) => ({
      ...currentLayout,
      dividerPosition: ratio,
    }));
  }, []);

  /// Reactive metrics: re-render views when the store updates.
  const [metrics, setMetrics] = useState(() => usageMetricsStore.getMetrics());
  useEffect(() => {
    return usageMetricsStore.subscribe((m) => startTransition(() => setMetrics(m)));
  }, []);

  /// Change-detection refs: skip setState when poll data is unchanged.
  /// This prevents React from reconciling + repainting the DOM on no-op polls,
  /// which is the primary source of UI lag during window drag.
  const prevStatusRef = useRef<string>("");
  const prevSessionsRef = useRef<string>("");

  /// Unified polling loop: fetches status, sessions, events, and transcript
  /// usage in a single tick. Skips when the document is hidden to avoid
  /// wasted renders. Transcript usage polls every other tick (~4s).
  const processedCountsRef = useRef<Map<string, number>>(new Map());
  const polledSessionIdRef = useRef<string | null>(null);
  const otelActiveRef = useRef<Map<string, boolean>>(new Map());
  const transcriptPathRef = useRef<string | null>(null);
  const lastTranscriptInputRef = useRef(0);
  const lastTranscriptOutputRef = useRef(0);

  useEffect(() => {
    let tickCount = 0;

    const pollTick = async () => {
      if (document.visibilityState === "hidden") return;
      tickCount++;

      // Phase 1: Status + sessions in a single IPC call (one mutex lock, one query)
      let freshSessions: SessionInfo[];
      try {
        const [newStatus, sessions] = await invoke<[AppStatus, SessionInfo[]]>("get_status_and_sessions");

        // Only update state when data actually changed
        const statusKey = `${newStatus.session_count}:${newStatus.event_count}`;
        if (statusKey !== prevStatusRef.current) {
          prevStatusRef.current = statusKey;
          await yieldToMain();
          setStatus(newStatus);
        }

        const sessKey = sessions.map((s) => `${s.id}:${s.event_count}:${s.last_event_at}`).join("|");
        if (sessKey !== prevSessionsRef.current) {
          prevSessionsRef.current = sessKey;
          await yieldToMain();
          setSessions(sessions);
        }

        freshSessions = sessions;
      } catch (err) {
        setError(String(err));
        return;
      }

      // Phase 2: Event batch processing (uses fresh sessions, no stale closure)
      const liveSessions = freshSessions.filter((s) => isSessionActive(s));
      if (liveSessions.length === 0) {
        for (const tracked of usageMultiSessionStore.getSessions()) {
          usageMultiSessionStore.removeSession(tracked.sessionId);
        }
        return;
      }

      const liveIds = new Set(liveSessions.map((s) => s.id));
      for (const tracked of usageMultiSessionStore.getSessions()) {
        if (!liveIds.has(tracked.sessionId)) {
          usageMultiSessionStore.removeSession(tracked.sessionId);
          processedCountsRef.current.delete(tracked.sessionId);
          otelActiveRef.current.delete(tracked.sessionId);
        }
      }

      const primary = liveSessions.reduce((best, s) =>
        new Date(s.last_event_at!).getTime() > new Date(best.last_event_at!).getTime() ? s : best
      );

      if (primary.id !== polledSessionIdRef.current) {
        polledSessionIdRef.current = primary.id;
        transcriptPathRef.current = null;
        lastTranscriptInputRef.current = 0;
        lastTranscriptOutputRef.current = 0;
      }

      const offsets: Record<string, number> = {};
      for (const session of liveSessions) {
        offsets[session.id] = processedCountsRef.current.get(session.id) ?? 0;
      }

      try {
        const batchResult = await invoke<Record<string, Array<{ session_id: string; event_type: string; payload: Record<string, unknown>; received_at: string; provider: string }>>>(
          "get_new_events_batch",
          { offsets }
        );

        for (const [sessionId, newEvents] of Object.entries(batchResult)) {
          for (const event of newEvents) {
            deliverHookEvent("session-event", event);
            if (sessionId === polledSessionIdRef.current && transcriptPathRef.current === null && event.payload) {
              const tp = (event.payload as Record<string, unknown>)["transcript_path"];
              if (typeof tp === "string") {
                transcriptPathRef.current = tp;
              }
            }
          }
          const prevCount = processedCountsRef.current.get(sessionId) ?? 0;
          processedCountsRef.current.set(sessionId, prevCount + newEvents.length);
          if (!otelActiveRef.current.get(sessionId)) {
            if (newEvents.some((e) => e.event_type === "api_request")) {
              otelActiveRef.current.set(sessionId, true);
            }
          }
        }
      } catch {
        // Silently ignore — phase 1 handles connectivity errors
      }

      await yieldToMain();

      // Phase 3: Transcript usage (every other tick ≈ 4s)
      if (tickCount % 2 !== 0) return;

      const path = transcriptPathRef.current;
      if (path === null) return;

      const primaryId = polledSessionIdRef.current;
      if (primaryId !== null && otelActiveRef.current.get(primaryId)) return;

      try {
        const usage = await invoke<{ input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_creation_tokens: number; model: string; message_count: number }>(
          "get_transcript_usage",
          { transcriptPath: path }
        );

        const deltaInput = usage.input_tokens - lastTranscriptInputRef.current;
        const deltaOutput = usage.output_tokens - lastTranscriptOutputRef.current;

        if (deltaInput > 0 || deltaOutput > 0) {
          lastTranscriptInputRef.current = usage.input_tokens;
          lastTranscriptOutputRef.current = usage.output_tokens;

          deliverHookEvent("session-event", {
            session_id: polledSessionIdRef.current ?? "",
            event_type: "tool_call_end",
            payload: {
              usage: {
                input_tokens: deltaInput,
                output_tokens: deltaOutput,
                cache_read_input_tokens: 0,
                cache_creation_input_tokens: 0,
                model: usage.model || "claude-sonnet-4-20250514",
              },
            },
            received_at: new Date().toISOString(),
            provider: "transcript",
          });
        }
      } catch {
        // Silently ignore — transcript may not be accessible yet
      }
    };

    return createIdlePoller(pollTick, POLL_INTERVAL_MS);
  }, []);

  /// Use refs so wrapper components stay referentially stable across re-renders.
  /// This prevents ZoneRenderer from unmounting/remounting views every poll cycle.
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const selectedSessionIdRef = useRef(selectedSessionId);
  selectedSessionIdRef.current = selectedSessionId;
  const handleSessionSelectRef = useRef(handleSessionSelect);
  handleSessionSelectRef.current = handleSessionSelect;
  const handleBackToSessionsRef = useRef(handleBackToSessions);
  handleBackToSessionsRef.current = handleBackToSessions;
  const selectedConfigItemRef = useRef(selectedConfigItem);
  selectedConfigItemRef.current = selectedConfigItem;
  const handleConfigItemSelectRef = useRef(handleConfigItemSelect);
  handleConfigItemSelectRef.current = handleConfigItemSelect;
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  /// Build the view registry once — wrapper components read from refs,
  /// so they always render current data without changing identity.
  const viewRegistry: ViewRegistry = useMemo(() => {
    const registry = new Map<string, FC>();

    const SessionListWrapper: FC = () => (
      <SessionListView
        sessions={sessionsRef.current}
        onSessionSelect={handleSessionSelectRef.current}
      />
    );
    SessionListWrapper.displayName = "SessionListWrapper";

    const SessionDetailWrapper: FC = () => {
      const sid = selectedSessionIdRef.current;
      const selectedSession =
        sid !== null
          ? sessionsRef.current.find((s) => s.id === sid) ?? null
          : null;

      if (selectedSession === null) {
        return null;
      }

      return (
        <EventDetailView
          session={selectedSession}
          onBack={handleBackToSessionsRef.current}
        />
      );
    };
    SessionDetailWrapper.displayName = "SessionDetailWrapper";

    registry.set("session-list", SessionListWrapper);
    registry.set("session-detail", SessionDetailWrapper);

    // norbert-usage views: each wrapper reads current metrics from the
    // reactive ref (updated via store subscription) and delegates to
    // pure domain functions for computation.
    const CostTickerWrapper: FC = () => {
      return <CostTicker data={computeCostTickerData(metricsRef.current.sessionCost, 0)} />;
    };
    CostTickerWrapper.displayName = "CostTickerWrapper";

    const PerformanceMonitorWrapper: FC = () => (
      <PerformanceMonitorView store={usageMetricsStore} multiSessionStore={usageMultiSessionStore} />
    );
    PerformanceMonitorWrapper.displayName = "PerformanceMonitorWrapper";

    registry.set("cost-ticker", CostTickerWrapper);
    registry.set("performance-monitor", PerformanceMonitorWrapper);

    // Session Status: combined gauges + session dashboard, shown in the
    // secondary panel when a session is selected. Data fetching handled
    // by SessionStatusLoader defined outside the useMemo.
    const SessionStatusWrapperInner: FC = () => {
      const sid = selectedSessionIdRef.current;
      if (sid === null) return <div className="empty-state">Select a session to view its status.</div>;
      const selected = sessionsRef.current.find((s) => s.id === sid) ?? null;
      const eventCount = selected?.event_count ?? 0;
      const startedAt = selected?.started_at ?? new Date().toISOString();
      return (
        <SessionStatusLoader
          sessionId={sid}
          eventCount={eventCount}
          startedAtFallback={startedAt}
          onClose={handleBackToSessionsRef.current}
        />
      );
    };
    SessionStatusWrapperInner.displayName = "SessionStatusWrapper";
    registry.set("session-status", SessionStatusWrapperInner);

    // norbert-config views: list view in main zone, detail view in secondary.
    const ConfigViewerWrapper: FC = () => (
      <ConfigViewerView onItemSelect={handleConfigItemSelectRef.current} />
    );
    ConfigViewerWrapper.displayName = "ConfigViewerWrapper";

    const ConfigDetailWrapper: FC = () => (
      <ConfigDetailPanel selection={selectedConfigItemRef.current} />
    );
    ConfigDetailWrapper.displayName = "ConfigDetailWrapper";

    registry.set("config-viewer", ConfigViewerWrapper);
    registry.set("config-detail", ConfigDetailWrapper);

    // norbert-notif view: notification center with DND toggle.
    const NotifCenterWrapper: FC = () => <NotificationCenterStandalone />;
    NotifCenterWrapper.displayName = "NotifCenterWrapper";
    registry.set("notif-settings", NotifCenterWrapper);

    return registry;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /// Handle sidebar icon click — assign the view to the main zone.
  /// Clears any drill-down selections and closes the secondary zone.
  const handleSidebarClick = useCallback((viewId: string, pluginId: string) => {
    setSelectedSessionId(null);
    setSelectedConfigItem(null);
    setLayout((currentLayout) => {
      // Close secondary zone when switching views
      const withoutSecondary = isSecondaryVisible(currentLayout)
        ? toggleSecondaryZone(currentLayout)
        : currentLayout;
      return {
        ...withoutSecondary,
        ...assignView(withoutSecondary, "main", viewId, pluginId),
      };
    });
  }, []);

  if (error) {
    return (
      <main>
        <p>Failed to load status: {error}</p>
      </main>
    );
  }

  if (!status) {
    return (
      <main>
        <p>Loading...</p>
      </main>
    );
  }

  /// Derive the latest session from the sessions list for status calculation.
  const latestSession = sessions.length > 0 ? sessions[0] : null;

  const derivedStatus = deriveConnectionStatus(
    status.session_count,
    status.event_count,
    latestSession
  );

  return (
    <main>
      <MenuBar entries={menuEntries} />
      <div className="app-body">
        <nav className="sidebar" data-testid="sidebar">
          {visibleSidebarItems.map((item) => (
            <button
              key={item.id}
              className={`sidebar-icon${layout.zones.get("main")?.viewId === item.id ? " active" : ""}`}
              title={item.label}
              onClick={() => handleSidebarClick(item.id, item.pluginId)}
            >
              <Icon name={item.icon} size={16} className="sidebar-icon-symbol" />
            </button>
          ))}
        </nav>
        <ZoneRenderer
          layout={layout}
          viewRegistry={viewRegistry}
          containerWidth={DEFAULT_CONTAINER_WIDTH}
          minZoneWidth={MIN_ZONE_WIDTH}
          onDividerPositionChange={handleDividerPositionChange}
        />
      </div>
      <footer className="status-bar">
        <span>{formatField("Status", derivedStatus)}</span>
        <span>{formatField("Port", status.port)}</span>
        <span>{formatField("Sessions", status.session_count)}</span>
        <span>{formatField("Events", status.event_count)}</span>
      </footer>
    </main>
  );
}

export default App;
