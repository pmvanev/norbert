/// PluginsTab -- renders plugin entries with name and version.
///
/// Stateless renderer. Empty state when no plugins configured.

import type { FC } from "react";
import type { PluginInfo } from "../domain/types";
import { EmptyState } from "./EmptyState";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PluginsTabProps {
  readonly plugins: readonly PluginInfo[];
}

// ---------------------------------------------------------------------------
// Plugin card
// ---------------------------------------------------------------------------

const PluginCard: FC<{ readonly plugin: PluginInfo }> = ({ plugin }) => (
  <div className="config-card">
    <div className="config-card-header config-card-header-static">
      <span className="config-card-title">{plugin.name}</span>
      <span className="config-scope-badge">{plugin.scope}</span>
      <span className="config-card-meta" data-mono="">v{plugin.version}</span>
    </div>
    <div className="config-card-body">
      <div className="config-card-section">
        <span className="config-card-section-label">Source</span>
        <span className="config-card-source" data-mono="">{plugin.filePath}</span>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PluginsTab: FC<PluginsTabProps> = ({ plugins }) => {
  if (plugins.length === 0) {
    return (
      <EmptyState
        category="plugins"
        guidance="Plugins are detected from settings.json configuration."
      />
    );
  }

  return (
    <div className="config-tab-content">
      {plugins.map((plugin) => (
        <PluginCard key={`${plugin.name}-${plugin.filePath}`} plugin={plugin} />
      ))}
    </div>
  );
};
