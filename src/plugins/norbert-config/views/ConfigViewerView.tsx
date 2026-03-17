/// ConfigViewerView -- primary view for the norbert-config plugin.
///
/// Renders sub-tab navigation and a list of items for the active tab.
/// Selecting an item calls onItemSelect to open the detail in the
/// app-level secondary zone (matching the session detail pattern).
///
/// Uses sec-hdr pattern for the title and Unicode symbols (not emoji)
/// for icons per project feedback.

import { useState, useCallback, type FC } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CONFIG_SUB_TABS, type ConfigSubTab, type AggregatedConfig, type SelectedConfigItem } from "../domain/types";
import { aggregateConfig, type RawClaudeConfig } from "../domain/configAggregator";
import { ConfigListPanel } from "./ConfigListPanel";
import { ErrorIndicator } from "./ErrorIndicator";

// ---------------------------------------------------------------------------
// Sub-tab display labels -- maps domain ids to human-readable labels
// ---------------------------------------------------------------------------

const SUB_TAB_LABELS: Record<ConfigSubTab, string> = {
  agents: "Agents",
  hooks: "Hooks",
  mcp: "MCP Servers",
  skills: "Skills",
  rules: "Rules",
  plugins: "Plugins",
  docs: "Docs",
};

// ---------------------------------------------------------------------------
// Sub-tab icons -- Unicode symbols (not emoji) per project feedback
// ---------------------------------------------------------------------------

const SUB_TAB_ICONS: Record<ConfigSubTab, string> = {
  agents: "\u25C8",   // diamond with dot -- agent identity
  hooks: "\u2693",    // anchor -- hooks binding
  mcp: "\u25A3",      // square with fill -- server
  skills: "\u2726",   // four-pointed star -- skills
  rules: "\u2261",    // triple bar -- rules/constraints
  plugins: "\u29C9",  // two overlapping squares -- plugins
  docs: "\u2637",     // trigram -- documentation
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

/// Props for ConfigViewerView.
export interface ConfigViewerViewProps {
  readonly className?: string;
  readonly onItemSelect?: (item: SelectedConfigItem) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/// ConfigViewerView renders sub-tab navigation and item list.
/// Selecting an item delegates to onItemSelect which opens the
/// app-level secondary zone with the detail view.
export const ConfigViewerView: FC<ConfigViewerViewProps> = ({
  className,
  onItemSelect,
}) => {
  const [activeTab, setActiveTab] = useState<ConfigSubTab>(DEFAULT_SUB_TAB);
  const [loadState, setLoadState] = useState<ConfigLoadState>({ tag: "idle" });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  /// Load (or reload) config from the backend.
  const loadConfig = useCallback(() => {
    setLoadState({ tag: "loading" });
    setSelectedKey(null);
    invoke<RawClaudeConfig>("read_claude_config", { scope: "both" })
      .then((rawConfig) => {
        const config = aggregateConfig(rawConfig);
        setLoadState({ tag: "loaded", config });
      })
      .catch((err) => {
        setLoadState({ tag: "error", message: String(err) });
      });
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
      aria-label="Configuration Viewer"
    >
      <div className="sec-hdr">
        <span className="sec-t">Configuration Viewer</span>
        <button
          className="config-reload-btn"
          onClick={loadConfig}
          type="button"
          title="Reload configuration"
          aria-label="Reload configuration"
        >
          {"\u21BB"}
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
            <span className="config-sub-tab-icon">{SUB_TAB_ICONS[tab]}</span>
            <span className="config-sub-tab-label">{SUB_TAB_LABELS[tab]}</span>
          </button>
        ))}
      </nav>

      <div className="config-sub-tab-content" role="tabpanel" aria-label={SUB_TAB_LABELS[activeTab]}>
        {(loadState.tag === "idle" || loadState.tag === "loading") && (
          <p className="config-placeholder">Loading configuration...</p>
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
