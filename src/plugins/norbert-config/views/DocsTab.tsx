/// DocsTab -- renders CLAUDE.md content with react-markdown.
///
/// Shows a source path header above each doc file's rendered markdown.
/// Empty state when no CLAUDE.md files found.

import type { FC } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DocFile } from "../domain/types";
import { EmptyState } from "./EmptyState";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DocsTabProps {
  readonly docs: readonly DocFile[];
}

// ---------------------------------------------------------------------------
// Doc section
// ---------------------------------------------------------------------------

const DocSection: FC<{ readonly doc: DocFile }> = ({ doc }) => (
  <div className="config-doc-section">
    <div className="config-doc-header">
      <span className="config-card-source" data-mono="">{doc.filePath}</span>
      <span className="config-scope-badge">{doc.scope}</span>
    </div>
    <div className="config-doc-body">
      <Markdown remarkPlugins={[remarkGfm]}>{doc.content}</Markdown>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DocsTab: FC<DocsTabProps> = ({ docs }) => {
  if (docs.length === 0) {
    return (
      <EmptyState
        category="documentation"
        guidance="Add a CLAUDE.md file to your project root or ~/.claude/ directory."
      />
    );
  }

  return (
    <div className="config-tab-content">
      {docs.map((doc) => (
        <DocSection key={doc.filePath} doc={doc} />
      ))}
    </div>
  );
};
