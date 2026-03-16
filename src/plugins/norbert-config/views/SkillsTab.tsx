/// SkillsTab -- renders skill entries with name, description, and source path.
///
/// Stateless renderer. Empty state when no skills configured.

import type { FC } from "react";
import type { SkillDefinition } from "../domain/types";
import { EmptyState } from "./EmptyState";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SkillsTabProps {
  readonly skills: readonly SkillDefinition[];
}

// ---------------------------------------------------------------------------
// Skill card
// ---------------------------------------------------------------------------

const SkillCard: FC<{ readonly skill: SkillDefinition }> = ({ skill }) => (
  <div className="config-card">
    <div className="config-card-header config-card-header-static">
      <span className="config-card-title">{skill.name}</span>
      <span className="config-scope-badge">{skill.scope === "plugin" ? skill.source : skill.scope}</span>
    </div>
    <div className="config-card-body">
      <p className="config-card-description">{skill.description}</p>
      <div className="config-card-section">
        <span className="config-card-section-label">Source</span>
        <span className="config-card-source" data-mono="">{skill.filePath}</span>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SkillsTab: FC<SkillsTabProps> = ({ skills }) => {
  if (skills.length === 0) {
    return (
      <EmptyState
        category="skills"
        guidance="Add skill definitions in .claude/commands/ as markdown files."
      />
    );
  }

  return (
    <div className="config-tab-content">
      {skills.map((skill) => (
        <SkillCard key={skill.filePath} skill={skill} />
      ))}
    </div>
  );
};
