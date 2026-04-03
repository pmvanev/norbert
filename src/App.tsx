import { useState, useEffect, useCallback, useMemo, useRef, type FC } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  type AppStatus,
  type SessionInfo,
  formatField,
  deriveConnectionStatus,
  isSessionActive,
} from "./domain/status";
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
import { GaugeClusterView } from "./plugins/norbert-usage/views/GaugeClusterView";
import { PerformanceMonitorView } from "./plugins/norbert-usage/views/PerformanceMonitorView";
import { UsageDashboardView } from "./plugins/norbert-usage/views/UsageDashboardView";
import { CostTicker } from "./plugins/norbert-usage/views/CostTicker";
import { SessionDashboard, type SessionEvent as DashboardSessionEvent } from "./plugins/norbert-usage/views/SessionDashboard";
import type { AccumulatedMetric as BackendAccumulatedMetric } from "./plugins/norbert-usage/domain/activeTimeFormatter";
import { computeDashboardData } from "./plugins/norbert-usage/domain/dashboard";
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
// LayoutState base type imported via TwoZoneLayoutState from zoneToggle

/// Polling interval in milliseconds for live UI updates.
const POLL_INTERVAL_MS = 1000;

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
function SessionDashboardLoader({ sessionId, onClose }: { readonly sessionId: string; readonly onClose?: () => void }) {
  const [events, setEvents] = useState<DashboardSessionEvent[]>([]);
  const [metrics, setMetrics] = useState<BackendAccumulatedMetric[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = () => {
      invoke<DashboardSessionEvent[]>("get_session_events", { sessionId })
        .then((data) => { if (!cancelled) setEvents(data); })
        .catch(() => {});
      invoke<BackendAccumulatedMetric[]>("get_metrics_for_session", { sessionId })
        .then((data) => { if (!cancelled) setMetrics(data); })
        .catch(() => {});
    };
    fetchData();
    const intervalId = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(intervalId); };
  }, [sessionId]);

  const totalApiRequests = events.filter((e) => e.event_type === "api_request").length;
  return (
    <SessionDashboard
      sessionId={sessionId}
      events={events}
      metrics={metrics}
      totalApiRequests={totalApiRequests}
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
      getAllViews(pluginRegistry).filter((v) => v.id !== "session-detail" && v.id !== "config-detail" && v.id !== "session-dashboard"),
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
      const assigned = assignView(withSecondary, "secondary", "session-dashboard", "norbert-usage");
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
    return usageMetricsStore.subscribe((m) => setMetrics(m));
  }, []);

  useEffect(() => {
    function pollStatus() {
      invoke<AppStatus>("get_status")
        .then(setStatus)
        .catch((err) => setError(String(err)));

      invoke<SessionInfo[]>("get_sessions")
        .then(setSessions)
        .catch((err) => setError(String(err)));
    }

    pollStatus();
    const intervalId = setInterval(pollStatus, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);

  /// Event poller: bridges SQLite events → hook bridge → metricsStore.
  ///
  /// Polls ALL live sessions so the multi-session store gets per-session
  /// metrics. The "primary" session (most active) also feeds the transcript
  /// poller for token usage data.
  ///
  /// Tracks per-session processed event counts to avoid re-delivering.
  const processedCountsRef = useRef<Map<string, number>>(new Map());
  const polledSessionIdRef = useRef<string | null>(null);
  /// Per-session OTel-active flag: true once an api_request event is seen.
  /// Used by the transcript poller to skip polling for OTel-active sessions.
  const otelActiveRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    const intervalId = setInterval(() => {
      const liveSessions = sessions.filter((s) => isSessionActive(s));
      if (liveSessions.length === 0) {
        // No active sessions — clean up all tracked sessions from the store
        for (const tracked of usageMultiSessionStore.getSessions()) {
          usageMultiSessionStore.removeSession(tracked.sessionId);
        }
        return;
      }

      // Remove ended/stale sessions from multi-session store and cleanup
      const liveIds = new Set(liveSessions.map((s) => s.id));
      for (const tracked of usageMultiSessionStore.getSessions()) {
        if (!liveIds.has(tracked.sessionId)) {
          usageMultiSessionStore.removeSession(tracked.sessionId);
          processedCountsRef.current.delete(tracked.sessionId);
          otelActiveRef.current.delete(tracked.sessionId);
        }
      }

      // Identify primary session for transcript poller
      const primary = liveSessions.reduce((best, s) =>
        new Date(s.last_event_at!).getTime() > new Date(best.last_event_at!).getTime() ? s : best
      );

      if (primary.id !== polledSessionIdRef.current) {
        polledSessionIdRef.current = primary.id;
        transcriptPathRef.current = null;
        lastTranscriptInputRef.current = 0;
        lastTranscriptOutputRef.current = 0;
      }

      // Batch-fetch new events for all live sessions in a single IPC call
      const offsets: Record<string, number> = {};
      for (const session of liveSessions) {
        offsets[session.id] = processedCountsRef.current.get(session.id) ?? 0;
      }

      invoke<Record<string, Array<{ session_id: string; event_type: string; payload: Record<string, unknown>; received_at: string; provider: string }>>>(
        "get_new_events_batch",
        { offsets }
      )
        .then((batchResult) => {
          for (const [sessionId, newEvents] of Object.entries(batchResult)) {
            for (const event of newEvents) {
              deliverHookEvent("session-event", event);
              // Extract transcript_path from primary session
              if (sessionId === polledSessionIdRef.current && transcriptPathRef.current === null && event.payload) {
                const tp = (event.payload as Record<string, unknown>)["transcript_path"];
                if (typeof tp === "string") {
                  transcriptPathRef.current = tp;
                }
              }
            }
            const prevCount = processedCountsRef.current.get(sessionId) ?? 0;
            processedCountsRef.current.set(sessionId, prevCount + newEvents.length);
            // Mark session as OTel-active once any api_request event is seen
            if (!otelActiveRef.current.get(sessionId)) {
              if (newEvents.some((e) => e.event_type === "api_request")) {
                otelActiveRef.current.set(sessionId, true);
              }
            }
          }
        })
        .catch(() => {
          // Silently ignore — status poller handles connectivity errors
        });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [sessions]);

  /// Transcript usage poller: reads token data from Claude Code transcript files.
  ///
  /// Claude Code hook payloads do NOT include token usage data (input_tokens,
  /// output_tokens, model). That data lives in the session transcript JSONL files.
  /// Every hook event includes a `transcript_path` field pointing to the file.
  ///
  /// This poller extracts the transcript path from the first event of the active
  /// session, calls get_transcript_usage to read the JSONL, and feeds a synthetic
  /// event with the cumulative usage into the hook bridge for metrics processing.
  const transcriptPathRef = useRef<string | null>(null);
  const lastTranscriptInputRef = useRef(0);
  const lastTranscriptOutputRef = useRef(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const path = transcriptPathRef.current;
      if (path === null) return;

      // Skip transcript polling for OTel-active sessions: their usage data
      // arrives directly via api_request events, making transcript parsing redundant.
      const primaryId = polledSessionIdRef.current;
      if (primaryId !== null) {
        if (otelActiveRef.current.get(primaryId)) return;
      }

      invoke<{ input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_creation_tokens: number; model: string; message_count: number }>(
        "get_transcript_usage",
        { transcriptPath: path }
      )
        .then((usage) => {
          const deltaInput = usage.input_tokens - lastTranscriptInputRef.current;
          const deltaOutput = usage.output_tokens - lastTranscriptOutputRef.current;

          // Only deliver if token count changed since last poll
          if (deltaInput <= 0 && deltaOutput <= 0) return;

          lastTranscriptInputRef.current = usage.input_tokens;
          lastTranscriptOutputRef.current = usage.output_tokens;

          // Feed as a wrapped event matching the DB event format
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
        })
        .catch(() => {
          // Silently ignore — transcript may not be accessible yet
        });
    }, POLL_INTERVAL_MS * 3); // Poll transcript less frequently than events

    return () => clearInterval(intervalId);
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
    const GaugeClusterWrapper: FC = () => {
      return <GaugeClusterView data={computeGaugeClusterData(metricsRef.current)} />;
    };
    GaugeClusterWrapper.displayName = "GaugeClusterWrapper";

    const UsageDashboardWrapper: FC = () => {
      const dashboard = computeDashboardData(metricsRef.current);
      return <UsageDashboardView dashboard={dashboard} dailyCosts={[]} />;
    };
    UsageDashboardWrapper.displayName = "UsageDashboardWrapper";

    const CostTickerWrapper: FC = () => {
      return <CostTicker data={computeCostTickerData(metricsRef.current.sessionCost, 0)} />;
    };
    CostTickerWrapper.displayName = "CostTickerWrapper";

    const PerformanceMonitorWrapper: FC = () => (
      <PerformanceMonitorView store={usageMetricsStore} multiSessionStore={usageMultiSessionStore} />
    );
    PerformanceMonitorWrapper.displayName = "PerformanceMonitorWrapper";

    registry.set("gauge-cluster", GaugeClusterWrapper);
    registry.set("usage-dashboard", UsageDashboardWrapper);
    registry.set("cost-ticker", CostTickerWrapper);
    registry.set("performance-monitor", PerformanceMonitorWrapper);

    // Session Dashboard: wraps the SessionDashboard component.
    // Data fetching is handled by the SessionDashboardLoader component
    // defined outside the useMemo to allow proper hook usage.
    const SessionDashboardWrapperInner: FC = () => {
      const sid = selectedSessionIdRef.current;
      if (sid === null) return <div className="empty-state">Select a session to view its dashboard.</div>;
      return <SessionDashboardLoader sessionId={sid} onClose={handleBackToSessionsRef.current} />;
    };
    SessionDashboardWrapperInner.displayName = "SessionDashboardWrapper";
    registry.set("session-dashboard", SessionDashboardWrapperInner);

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
