/// ConfigViewerView -- primary view for the norbert-config plugin.
///
/// Calls read_claude_config IPC on mount, parses with aggregateConfig,
/// and passes data to individual tab components. Each sub-tab shows
/// real config data from user and project scopes.
///
/// Uses sec-hdr pattern for the title and Unicode symbols (not emoji)
/// for icons per project feedback.

import { useState, useEffect, type FC } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CONFIG_SUB_TABS, type ConfigSubTab, type AggregatedConfig } from "../domain/types";
import { aggregateConfig, type RawClaudeConfig } from "../domain/configAggregator";
import { AgentsTab } from "./AgentsTab";
import { HooksTab } from "./HooksTab";
import { McpTab } from "./McpTab";
import { SkillsTab } from "./SkillsTab";
import { RulesTab } from "./RulesTab";
import { PluginsTab } from "./PluginsTab";
import { DocsTab } from "./DocsTab";
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
  | { readonly tag: "loading" }
  | { readonly tag: "loaded"; readonly config: AggregatedConfig }
  | { readonly tag: "error"; readonly message: string };

// ---------------------------------------------------------------------------
// Tab content renderer
// ---------------------------------------------------------------------------

const renderTabContent = (tab: ConfigSubTab, config: AggregatedConfig): JSX.Element => {
  switch (tab) {
    case "agents":
      return <AgentsTab agents={config.agents} />;
    case "hooks":
      return <HooksTab hooks={config.hooks} />;
    case "mcp":
      return <McpTab servers={config.mcpServers} />;
    case "skills":
      return <SkillsTab skills={config.skills} />;
    case "rules":
      return <RulesTab rules={config.rules} />;
    case "plugins":
      return <PluginsTab plugins={config.plugins} />;
    case "docs":
      return <DocsTab docs={config.docs} />;
  }
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/// Props for ConfigViewerView.
export interface ConfigViewerViewProps {
  readonly className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/// ConfigViewerView renders the sub-tab navigation and real config
/// content for each configuration category.
export const ConfigViewerView: FC<ConfigViewerViewProps> = ({
  className,
}) => {
  const [activeTab, setActiveTab] = useState<ConfigSubTab>(DEFAULT_SUB_TAB);
  const [loadState, setLoadState] = useState<ConfigLoadState>({ tag: "loading" });

  useEffect(() => {
    invoke<RawClaudeConfig>("read_claude_config", { scope: "both" })
      .then((rawConfig) => {
        const config = aggregateConfig(rawConfig);
        setLoadState({ tag: "loaded", config });
      })
      .catch((err) => {
        setLoadState({ tag: "error", message: String(err) });
      });
  }, []);

  return (
    <div
      className={`config-viewer${className ? ` ${className}` : ""}`}
      role="region"
      aria-label="Configuration Viewer"
    >
      <div className="sec-hdr">
        <span className="sec-t">Configuration Viewer</span>
      </div>

      <nav className="config-sub-tabs" role="tablist" aria-label="Configuration categories">
        {CONFIG_SUB_TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={tab === activeTab}
            className={`config-sub-tab${tab === activeTab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            <span className="config-sub-tab-icon">{SUB_TAB_ICONS[tab]}</span>
            <span className="config-sub-tab-label">{SUB_TAB_LABELS[tab]}</span>
          </button>
        ))}
      </nav>

      <div className="config-sub-tab-content" role="tabpanel" aria-label={SUB_TAB_LABELS[activeTab]}>
        {loadState.tag === "loading" && (
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
            {renderTabContent(activeTab, loadState.config)}
          </>
        )}
      </div>
    </div>
  );
};
