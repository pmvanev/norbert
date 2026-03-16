/// ConfigViewerView -- primary view for the norbert-config plugin.
///
/// Renders a row of 7 sub-tab buttons (from CONFIG_SUB_TABS) with
/// Agents selected by default. Each sub-tab shows a placeholder
/// with the tab name until content views are implemented.
///
/// Uses sec-hdr pattern for the title and Unicode symbols (not emoji)
/// for icons per project feedback.

import { useState, type FC } from "react";
import { CONFIG_SUB_TABS, type ConfigSubTab } from "../domain/types";

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

/// Props for ConfigViewerView -- currently none, will expand
/// as data flows are connected.
export interface ConfigViewerViewProps {
  readonly className?: string;
}

/// ConfigViewerView renders the sub-tab navigation and placeholder
/// content for each configuration category.
export const ConfigViewerView: FC<ConfigViewerViewProps> = ({
  className,
}) => {
  const [activeTab, setActiveTab] = useState<ConfigSubTab>(DEFAULT_SUB_TAB);

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
        <p className="config-placeholder">
          {SUB_TAB_ICONS[activeTab]} {SUB_TAB_LABELS[activeTab]} -- content coming soon
        </p>
      </div>
    </div>
  );
};
