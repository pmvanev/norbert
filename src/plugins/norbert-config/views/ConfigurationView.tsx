/// ConfigurationView -- primary view for the norbert-config plugin.
///
/// Renders sub-tab navigation and a list of items for the active tab.
/// Selecting an item calls onItemSelect to open the detail in the
/// app-level secondary zone (matching the session detail pattern).
///
/// Uses sec-hdr pattern for the title and Unicode symbols (not emoji)
/// for icons per project feedback.

import { useState, useCallback, startTransition, type FC } from "react";
import { yieldToMain } from "../../../scheduling";
import { invoke } from "@tauri-apps/api/core";
import { CONFIG_SUB_TABS, type ConfigSubTab, type AggregatedConfig, type SelectedConfigItem } from "../domain/types";
import { aggregateConfig, type RawClaudeConfig } from "../domain/configAggregator";
import { ConfigListPanel } from "./ConfigListPanel";
import { ErrorIndicator } from "./ErrorIndicator";
import { Icon } from "../../../components/Icon";

// ---------------------------------------------------------------------------
// Sub-tab display labels -- maps domain ids to human-readable labels
// ---------------------------------------------------------------------------

export const SUB_TAB_LABELS: Record<ConfigSubTab, string> = {
  agents: "Agents",
  commands: "Commands",
  hooks: "Hooks",
  mcp: "MCP Servers",
  skills: "Skills",
  rules: "Rules",
  plugins: "Plugins",
  env: "Environment",
};

// ---------------------------------------------------------------------------
// Sub-tab icons -- lucide-react icon names
// ---------------------------------------------------------------------------

export const SUB_TAB_ICONS: Record<ConfigSubTab, string> = {
  agents: "bot",
  commands: "terminal",
  hooks: "anchor",
  mcp: "server",
  skills: "sparkles",
  rules: "list",
  plugins: "package",
  env: "key",
};

/// Default active sub-tab on mount.
const DEFAULT_SUB_TAB: ConfigSubTab = "agents";

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

type ConfigLoadState =
  | { readonly tag: "idle" }
  | { readonly tag: "loading" }
  | { readonly tag: "loaded"; readonly config: AggregatedConfig }
  | { readonly tag: "error"; readonly message: string };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/// Props for ConfigurationView.
export interface ConfigurationViewProps {
  readonly className?: string;
  readonly onItemSelect?: (item: SelectedConfigItem) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/// ConfigurationView renders sub-tab navigation and item list.
/// Selecting an item delegates to onItemSelect which opens the
/// app-level secondary zone with the detail view.
export const ConfigurationView: FC<ConfigurationViewProps> = ({
  className,
  onItemSelect,
}) => {
  const [activeTab, setActiveTab] = useState<ConfigSubTab>(DEFAULT_SUB_TAB);
  const [loadState, setLoadState] = useState<ConfigLoadState>({ tag: "idle" });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  /// Load (or reload) config from the backend.
  const loadConfig = useCallback(async () => {
    setLoadState({ tag: "loading" });
    setSelectedKey(null);
    try {
      const rawConfig = await invoke<RawClaudeConfig>("read_claude_config", { scope: "both" });
      await yieldToMain();
      const config = aggregateConfig(rawConfig);
      await yieldToMain();
      startTransition(() => setLoadState({ tag: "loaded", config }));
    } catch (err) {
      startTransition(() => setLoadState({ tag: "error", message: String(err) }));
    }
  }, []);

  /// Load on first render.
  if (loadState.tag === "idle") {
    loadConfig();
  }

  /// Clear selection when switching tabs.
  const handleTabChange = useCallback((tab: ConfigSubTab) => {
    setActiveTab(tab);
    setSelectedKey(null);
  }, []);

  /// Handle item selection from the list panel.
  const handleSelect = useCallback((item: SelectedConfigItem, key: string) => {
    setSelectedKey(key);
    onItemSelect?.(item);
  }, [onItemSelect]);

  return (
    <div
      className={`config-viewer${className ? ` ${className}` : ""}`}
      role="region"
      aria-label="Configuration"
    >
      <div className="sec-hdr">
        <span className="sec-t">Configuration</span>
        <button
          className={`config-reload-btn${loadState.tag === "loading" ? " is-loading" : ""}`}
          onClick={loadConfig}
          type="button"
          disabled={loadState.tag === "loading"}
          title="Reload configuration"
          aria-label="Reload configuration"
        >
          <Icon name="refresh" size={12} />
        </button>
      </div>

      <nav className="config-sub-tabs" role="tablist" aria-label="Configuration categories">
        {CONFIG_SUB_TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={tab === activeTab}
            className={`config-sub-tab${tab === activeTab ? " active" : ""}`}
            onClick={() => handleTabChange(tab)}
          >
            <Icon name={SUB_TAB_ICONS[tab]} size={12} className="config-sub-tab-icon" />
            <span className="config-sub-tab-label">{SUB_TAB_LABELS[tab]}</span>
          </button>
        ))}
      </nav>

      <div className="config-sub-tab-content" role="tabpanel" aria-label={SUB_TAB_LABELS[activeTab]}>
        {(loadState.tag === "idle" || loadState.tag === "loading") && (
          <div className="config-loading" role="status" aria-live="polite">
            <div className="config-loading-header">
              <span className="config-loading-spinner" aria-hidden="true" />
              <span>Loading configuration…</span>
            </div>
            <ul className="config-skeleton-list" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="config-skeleton-row">
                  <span className="config-skeleton-dot" />
                  <span className="config-skeleton-line" />
                </li>
              ))}
            </ul>
          </div>
        )}

        {loadState.tag === "error" && (
          <ErrorIndicator filePath="IPC" error={loadState.message} />
        )}

        {loadState.tag === "loaded" && (
          <>
            {loadState.config.errors.length > 0 && (
              <div className="config-error-list">
                {loadState.config.errors.map((err) => (
                  <ErrorIndicator
                    key={err.path}
                    filePath={err.path}
                    error={err.error}
                  />
                ))}
              </div>
            )}
            <ConfigListPanel
              tab={activeTab}
              config={loadState.config}
              selectedKey={selectedKey}
              onSelect={handleSelect}
            />
          </>
        )}
      </div>
    </div>
  );
};
