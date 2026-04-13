/// Shared view utilities for the norbert-config plugin.
///
/// Small, reusable components and functions used by both
/// ConfigListPanel and ConfigDetailPanel.

import { useState, type FC } from "react";
import type { EnvVar } from "../domain/types";

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

// ---------------------------------------------------------------------------
// Masked env var row -- click-to-reveal for sensitive values
// ---------------------------------------------------------------------------

const ENV_VAR_MASK = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";

export const MaskedEnvVarRow: FC<{ readonly envVar: EnvVar }> = ({ envVar }) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="config-env-row">
      <span className="config-env-key" data-mono="">{envVar.key}</span>
      <button
        className="config-env-value-btn"
        onClick={() => setRevealed((c) => !c)}
        type="button"
        aria-label={revealed ? `Hide value for ${envVar.key}` : `Reveal value for ${envVar.key}`}
      >
        <span data-mono="">{revealed ? envVar.value : ENV_VAR_MASK}</span>
      </button>
    </div>
  );
};
