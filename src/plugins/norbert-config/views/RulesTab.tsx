/// RulesTab -- renders rule entries with text and source annotation.
///
/// Stateless renderer. Empty state when no rules configured.

import type { FC } from "react";
import type { RuleEntry } from "../domain/types";
import { EmptyState } from "./EmptyState";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RulesTabProps {
  readonly rules: readonly RuleEntry[];
}

// ---------------------------------------------------------------------------
// Rule card
// ---------------------------------------------------------------------------

const RuleCard: FC<{ readonly rule: RuleEntry }> = ({ rule }) => (
  <div className="config-card">
    <div className="config-card-body">
      <p className="config-card-rule-text">{rule.text}</p>
      <div className="config-card-rule-source">
        <span className="config-card-source" data-mono="">{rule.source}</span>
        <span className="config-scope-badge">{rule.scope}</span>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const RulesTab: FC<RulesTabProps> = ({ rules }) => {
  if (rules.length === 0) {
    return (
      <EmptyState
        category="rules"
        guidance="Define rules in settings.json or CLAUDE.md files."
      />
    );
  }

  return (
    <div className="config-tab-content">
      {rules.map((rule, index) => (
        <RuleCard key={`${rule.source}-${index}`} rule={rule} />
      ))}
    </div>
  );
};
