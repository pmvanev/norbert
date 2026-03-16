/// AgentsTab -- renders agent cards with expand/collapse for full details.
///
/// Each card shows name, model, tool count, and description preview.
/// Expanding reveals the full system prompt and source path.
/// Uses ErrorIndicator inline for agents that failed to parse.

import { useState, type FC } from "react";
import type { AgentDefinition, AgentParseResult } from "../domain/types";
import { EmptyState } from "./EmptyState";
import { ErrorIndicator } from "./ErrorIndicator";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AgentsTabProps {
  readonly agents: readonly AgentParseResult[];
}

// ---------------------------------------------------------------------------
// Scope badge
// ---------------------------------------------------------------------------

const ScopeBadge: FC<{ readonly scope: string }> = ({ scope }) => (
  <span className="config-scope-badge">{scope}</span>
);

// ---------------------------------------------------------------------------
// Agent card (collapsed + expanded)
// ---------------------------------------------------------------------------

const DESCRIPTION_PREVIEW_LENGTH = 120;

const truncateDescription = (text: string): string =>
  text.length > DESCRIPTION_PREVIEW_LENGTH
    ? `${text.slice(0, DESCRIPTION_PREVIEW_LENGTH)}...`
    : text;

interface AgentCardProps {
  readonly agent: AgentDefinition;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
}

const AgentCard: FC<AgentCardProps> = ({ agent, isExpanded, onToggle }) => (
  <div className="config-card">
    <button
      className="config-card-header"
      onClick={onToggle}
      aria-expanded={isExpanded}
      type="button"
    >
      <span className="config-card-toggle">{isExpanded ? "\u25BC" : "\u25B6"}</span>
      <span className="config-card-title">{agent.name}</span>
      <ScopeBadge scope={agent.scope} />
      <span className="config-card-meta" data-mono="">
        {agent.model} {"\u00B7"} {agent.toolCount} tool{agent.toolCount !== 1 ? "s" : ""}
      </span>
    </button>

    {!isExpanded && (
      <p className="config-card-preview">{truncateDescription(agent.description)}</p>
    )}

    {isExpanded && (
      <div className="config-card-body">
        <p className="config-card-description">{agent.description}</p>
        <div className="config-card-section">
          <span className="config-card-section-label">System Prompt</span>
          <pre className="config-card-code">{agent.systemPrompt}</pre>
        </div>
        <div className="config-card-section">
          <span className="config-card-section-label">Source</span>
          <span className="config-card-source" data-mono="">{agent.filePath}</span>
        </div>
        {agent.tools.length > 0 && (
          <div className="config-card-section">
            <span className="config-card-section-label">Tools</span>
            <div className="config-tag-list">
              {agent.tools.map((tool) => (
                <span key={tool} className="config-tag">{tool}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AgentsTab: FC<AgentsTabProps> = ({ agents }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (agents.length === 0) {
    return (
      <EmptyState
        category="agents"
        guidance="Add agent definitions in .claude/agents/ as markdown files."
      />
    );
  }

  const handleToggle = (index: number) => () => {
    setExpandedIndex((current) => (current === index ? null : index));
  };

  return (
    <div className="config-tab-content">
      {agents.map((result, index) =>
        result.tag === "parsed" ? (
          <AgentCard
            key={result.agent.filePath}
            agent={result.agent}
            isExpanded={expandedIndex === index}
            onToggle={handleToggle(index)}
          />
        ) : (
          <ErrorIndicator
            key={result.filePath}
            filePath={result.filePath}
            error={result.message}
          />
        ),
      )}
    </div>
  );
};
