/// Shared view utilities for the norbert-config plugin.
///
/// Small, reusable components and functions used by both
/// ConfigListPanel and ConfigDetailPanel.

import type { FC } from "react";

// ---------------------------------------------------------------------------
// Scope badge -- renders a scope or plugin source label
// ---------------------------------------------------------------------------

export const ScopeBadge: FC<{ readonly scope: string; readonly source?: string }> = ({ scope, source }) => (
  <span className="config-scope-badge">{scope === "plugin" && source ? source : scope}</span>
);

// ---------------------------------------------------------------------------
// Agent display name -- "Persona, name" or just name
// ---------------------------------------------------------------------------

export const formatAgentDisplayName = (agent: { readonly persona: string; readonly name: string }): string =>
  agent.persona ? `${agent.persona}, ${agent.name}` : agent.name;

// ---------------------------------------------------------------------------
// Filename extraction from path -- last segment of a file path
// ---------------------------------------------------------------------------

export const deriveFilename = (filePath: string, fallback?: string): string => {
  const segments = filePath.split(/[/\\]/);
  return segments[segments.length - 1] ?? fallback ?? filePath;
};
