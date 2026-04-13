/// McpTab -- renders MCP server cards with masked environment variables.
///
/// Env var values are masked by default with click-to-reveal per variable.
/// Env values are NEVER logged to console. Empty state when no servers.

import { useState, type FC } from "react";
import type { EnvVar, McpServerConfig } from "../domain/types";
import { EmptyState } from "./EmptyState";
import { ScopeBadge } from "./shared";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface McpTabProps {
  readonly servers: readonly McpServerConfig[];
}

// ---------------------------------------------------------------------------
// Masked env var row
// ---------------------------------------------------------------------------

const MASK = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";

const EnvVarRow: FC<{ readonly envVar: EnvVar }> = ({ envVar }) => {
  const [revealed, setRevealed] = useState(false);

  const handleReveal = () => {
    setRevealed((current) => !current);
  };

  return (
    <div className="config-env-row">
      <span className="config-env-key" data-mono="">{envVar.key}</span>
      <button
        className="config-env-value-btn"
        onClick={handleReveal}
        type="button"
        aria-label={revealed ? `Hide value for ${envVar.key}` : `Reveal value for ${envVar.key}`}
      >
        <span data-mono="">{revealed ? envVar.value : MASK}</span>
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MCP server card
// ---------------------------------------------------------------------------

const McpServerCard: FC<{ readonly server: McpServerConfig }> = ({ server }) => (
  <div className="config-card">
    <div className="config-card-header config-card-header-static">
      <span className="config-card-title">{server.name}</span>
      <ScopeBadge scope={server.scope} source={server.source} />
      {server.scope !== "plugin" && (
        <span className="config-scope-badge" data-mono="">{server.source}</span>
      )}
      <span className="config-card-meta" data-mono="">{server.type}</span>
    </div>
    <div className="config-card-body">
      <div className="config-card-section">
        <span className="config-card-section-label">Command</span>
        <code className="config-card-code-inline">
          {server.command}{server.args.length > 0 ? ` ${server.args.join(" ")}` : ""}
        </code>
      </div>
      {server.env.length > 0 && (
        <div className="config-card-section">
          <span className="config-card-section-label">Environment</span>
          <div className="config-env-list">
            {server.env.map((envVar) => (
              <EnvVarRow key={envVar.key} envVar={envVar} />
            ))}
          </div>
        </div>
      )}
      {server.warnings.length > 0 && (
        <div className="config-card-section">
          <span className="config-card-section-label config-card-section-label-warn">Warnings</span>
          {server.warnings.map((warning, i) => (
            <span key={i} className="config-card-warning">{"\u26A0"} {warning}</span>
          ))}
        </div>
      )}
      <div className="config-card-section">
        <span className="config-card-section-label">Source</span>
        <span className="config-card-source" data-mono="">{server.filePath}</span>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const McpTab: FC<McpTabProps> = ({ servers }) => {
  if (servers.length === 0) {
    return (
      <EmptyState
        category="MCP servers"
        guidance="Configure MCP servers in ~/.claude.json, .mcp.json (project root), ~/.claude/settings.json, or plugin .mcp.json files."
      />
    );
  }

  return (
    <div className="config-tab-content">
      {servers.map((server) => (
        <McpServerCard key={`${server.name}-${server.filePath}`} server={server} />
      ))}
    </div>
  );
};
