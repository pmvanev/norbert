import { useState, useEffect, useCallback, useMemo, useRef, type FC } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  type AppStatus,
  type SessionInfo,
  formatField,
  deriveConnectionStatus,
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
import { norbertUsagePlugin } from "./plugins/norbert-usage/index";
import { GaugeClusterView } from "./plugins/norbert-usage/views/GaugeClusterView";
import { OscilloscopeView } from "./plugins/norbert-usage/views/OscilloscopeView";
import { UsageDashboardView } from "./plugins/norbert-usage/views/UsageDashboardView";
import { CostTicker } from "./plugins/norbert-usage/views/CostTicker";
import { computeDashboardData } from "./plugins/norbert-usage/domain/dashboard";
import { computeGaugeClusterData } from "./plugins/norbert-usage/domain/gaugeCluster";
import { computeCostTickerData } from "./plugins/norbert-usage/domain/costTicker";
import { createMetricsStore } from "./plugins/norbert-usage/adapters/metricsStore";
import { resetHookBridge } from "./plugins/hookBridge";
import { createDefaultLayoutState, isSecondaryVisible, toggleSecondaryZone, type TwoZoneLayoutState } from "./layout/zoneToggle";
import { assignView } from "./layout/assignmentEngine";
import { ZoneRenderer, type ViewRegistry } from "./layout/zoneRenderer";
import { SessionListView } from "./views/SessionListView";
import { EventDetailView } from "./views/EventDetailView";
import { createDefaultSidebarState, getVisibleItems } from "./sidebar/sidebarManager";
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
    [norbertSessionPlugin, norbertUsagePlugin],
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

function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeName>(() =>
    readStoredTheme(localStorage)
  );
  const [layout, setLayout] = useState<TwoZoneLayoutState>(createInitialLayout);

  /// Initialize plugin system once on mount.
  const [pluginRegistry] = useState(initializePluginSystem);

  /// Metrics store for norbert-usage views (single mutable cell at the edge).
  const [metricsStore] = useState(() => createMetricsStore("default"));

  /// Initialize sidebar from plugin registry views.
  const sidebarState = useMemo(
    () => createDefaultSidebarState(getAllViews(pluginRegistry), []),
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
      const assigned = assignView(withSecondary, "secondary", "session-detail", "norbert-session");
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

    // norbert-usage views: each wrapper reads current metrics from the store
    // and delegates to pure domain functions for computation.
    const GaugeClusterWrapper: FC = () => {
      const metrics = metricsStore.getMetrics();
      return <GaugeClusterView data={computeGaugeClusterData(metrics)} />;
    };
    GaugeClusterWrapper.displayName = "GaugeClusterWrapper";

    const OscilloscopeWrapper: FC = () => (
      <OscilloscopeView store={metricsStore} />
    );
    OscilloscopeWrapper.displayName = "OscilloscopeWrapper";

    // TODO: Daily cost aggregation requires querying historical events from
    // SQLite via the EventsAPI, which the plugin doesn't support yet.
    // Passing empty array triggers the onboarding state in the dashboard
    // when all session metrics are zero, so users see a helpful message
    // instead of a silently empty burn chart.
    const UsageDashboardWrapper: FC = () => {
      const metrics = metricsStore.getMetrics();
      const dashboard = computeDashboardData(metrics);
      return <UsageDashboardView dashboard={dashboard} dailyCosts={[]} />;
    };
    UsageDashboardWrapper.displayName = "UsageDashboardWrapper";

    const CostTickerWrapper: FC = () => {
      const metrics = metricsStore.getMetrics();
      return <CostTicker data={computeCostTickerData(metrics.sessionCost, 0)} />;
    };
    CostTickerWrapper.displayName = "CostTickerWrapper";

    registry.set("gauge-cluster", GaugeClusterWrapper);
    registry.set("oscilloscope", OscilloscopeWrapper);
    registry.set("usage-dashboard", UsageDashboardWrapper);
    registry.set("cost-ticker", CostTickerWrapper);

    return registry;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /// Handle sidebar icon click — assign the view to the main zone.
  const handleSidebarClick = useCallback((viewId: string, pluginId: string) => {
    setSelectedSessionId(null);
    setLayout((currentLayout) => ({
      ...currentLayout,
      ...assignView(currentLayout, "main", viewId, pluginId),
    }));
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
              <span className="sidebar-icon-symbol">{item.icon}</span>
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
