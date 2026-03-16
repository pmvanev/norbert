/// RulesTab -- renders rule entries with markdown formatting and source annotation.
///
/// Rules from settings.json are plain text strings.
/// Rules from plugin rules/*.md files are rendered as formatted markdown.
/// Stateless renderer. Empty state when no rules configured.

import { useState, type FC } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RuleEntry } from "../domain/types";
import { EmptyState } from "./EmptyState";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RulesTabProps {
  readonly rules: readonly RuleEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a short display name from the file path. */
const deriveRuleName = (rule: RuleEntry): string => {
  const segments = rule.filePath.split(/[/\\]/);
  const filename = segments[segments.length - 1] ?? rule.source;
  return filename.replace(/\.md$/, "");
};

/** Rules from .md files are long and should be collapsible. */
const isMarkdownRule = (rule: RuleEntry): boolean =>
  rule.filePath.endsWith(".md") && rule.text.length > 100;

// ---------------------------------------------------------------------------
// Rule card
// ---------------------------------------------------------------------------

const RuleCard: FC<{ readonly rule: RuleEntry }> = ({ rule }) => {
  const [expanded, setExpanded] = useState(false);
  const markdown = isMarkdownRule(rule);
  const name = deriveRuleName(rule);

  return (
    <div className="config-card">
      {markdown ? (
        <>
          <button
            className="config-card-header"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            type="button"
          >
            <span className="config-card-toggle">{expanded ? "\u25BC" : "\u25B6"}</span>
            <span className="config-card-title">{name}</span>
            <span className="config-scope-badge">
              {rule.scope === "plugin" ? rule.source : rule.scope}
            </span>
          </button>
          {expanded && (
            <div className="config-card-body">
              <div className="config-doc-body">
                <Markdown remarkPlugins={[remarkGfm]}>{rule.text}</Markdown>
              </div>
              <div className="config-card-section">
                <span className="config-card-section-label">Source</span>
                <span className="config-card-source" data-mono="">{rule.filePath}</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="config-card-body">
          <p className="config-card-rule-text">{rule.text}</p>
          <div className="config-card-rule-source">
            <span className="config-card-source" data-mono="">{rule.source}</span>
            <span className="config-scope-badge">
              {rule.scope === "plugin" ? rule.source : rule.scope}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

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
