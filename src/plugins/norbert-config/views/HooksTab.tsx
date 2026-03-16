/// HooksTab -- renders hook cards with event type, command, and matcher tags.
///
/// Each hook card displays the event type as the title, the command being
/// executed, and any matchers as inline tags. Empty state when no hooks.

import type { FC } from "react";
import type { HookConfig } from "../domain/types";
import { EmptyState } from "./EmptyState";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HooksTabProps {
  readonly hooks: readonly HookConfig[];
}

// ---------------------------------------------------------------------------
// Hook card
// ---------------------------------------------------------------------------

const HookCard: FC<{ readonly hook: HookConfig }> = ({ hook }) => (
  <div className="config-card">
    <div className="config-card-header config-card-header-static">
      <span className="config-card-title">{hook.event}</span>
      <span className="config-scope-badge">{hook.scope}</span>
    </div>
    <div className="config-card-body">
      <div className="config-card-section">
        <span className="config-card-section-label">Command</span>
        <code className="config-card-code-inline">{hook.command}</code>
      </div>
      {hook.matchers.length > 0 && (
        <div className="config-card-section">
          <span className="config-card-section-label">Matchers</span>
          <div className="config-tag-list">
            {hook.matchers.map((matcher, i) => (
              <span key={`${matcher}-${i}`} className="config-tag">{matcher}</span>
            ))}
          </div>
        </div>
      )}
      <div className="config-card-section">
        <span className="config-card-section-label">Source</span>
        <span className="config-card-source" data-mono="">{hook.filePath}</span>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const HooksTab: FC<HooksTabProps> = ({ hooks }) => {
  if (hooks.length === 0) {
    return (
      <EmptyState
        category="hooks"
        guidance="Define hooks in settings.json under the hooks key."
      />
    );
  }

  return (
    <div className="config-tab-content">
      {hooks.map((hook, index) => (
        <HookCard key={`${hook.event}-${hook.command}-${index}`} hook={hook} />
      ))}
    </div>
  );
};
