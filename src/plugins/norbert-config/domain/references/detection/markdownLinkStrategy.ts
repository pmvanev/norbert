/**
 * Detection Pipeline -- markdown-link strategy
 *
 * Visits MDAST `link` nodes (`[label](href)`) and, when `node.url` resolves
 * via the registry's path index to a known item -- or falls into the
 * resolver's `unsupported` (`.claude/<unknown-category>/...`) bucket -- annotates
 * the node with the standard unified `data.hName` / `data.hProperties` block
 * so react-markdown's `components` map renders it as a cross-reference token.
 *
 * Architecture: §6.2 (Detection Pipeline) -- markdown-link branch.
 * ADR-001: pure remark-style transform. ADR-010: ships in v1; canonical
 * pipeline order is [markdownLinkStrategy, inlineCodeStrategy].
 *
 * Pure: no IO, no closures over module-level state. Uses `resolve` so all
 * four ResolvedRef variants (live | ambiguous | dead | unsupported) work
 * uniformly as later steps un-skip more scenarios. The path branch of the
 * resolver classifies each outcome correctly today; this strategy just
 * projects the result onto the data-attribute shape the renderer reads.
 */

import { resolve } from "../resolver";
import type { ReferenceRegistry } from "../registry";
import type {
  DetectionContext,
  DetectionStrategy,
  MdastNode,
  ReferenceTokenData,
} from "./types";

/**
 * Narrow guard for a `link` MDAST node carrying a string `url`. Avoids a
 * hard import of `mdast.Link` so detection stays decoupled from upstream
 * type churn (mirrors inlineCodeStrategy's `isInlineCodeNode`).
 */
function isLinkNode(
  node: MdastNode,
): node is MdastNode & { url: string; data?: Record<string, unknown> } {
  return (
    node.type === "link" &&
    typeof (node as { url?: unknown }).url === "string"
  );
}

function annotate(
  node: MdastNode & { url: string; data?: Record<string, unknown> },
  data: ReferenceTokenData,
): void {
  // Mutating `node.data` in place is the standard unified contract for remark
  // plugins (see remark-toc, remark-external-links). Caller passes fresh
  // trees per render, so this stays effectively pure.
  const existing = (node.data ?? {}) as Record<string, unknown>;
  node.data = { ...existing, hName: data.hName, hProperties: data.hProperties };
}

export const markdownLinkStrategy: DetectionStrategy = {
  apply: (
    node: MdastNode,
    registry: ReferenceRegistry,
    _ctx: DetectionContext,
  ) => {
    if (!isLinkNode(node)) {
      return;
    }

    const href = node.url;
    const resolved = resolve({ kind: "path", value: href }, registry);

    // Plain dead links (href is not a registry path AND not under
    // `.claude/<unknown-category>/`) stay unannotated -- they remain regular
    // markdown links so the renderer can navigate or ignore them at will.
    // Dead links pointing into `.claude/<known-category>/` (e.g. a deleted
    // skill) ARE annotated as the `dead` variant in step 05-05.
    if (resolved.tag === "dead") {
      return;
    }

    // Project the ResolvedRef onto the data-attribute shape the renderer
    // reads. `data-ref-target-key` is meaningful for live (the entry's
    // itemKey) and ambiguous (first candidate's itemKey -- the popover
    // re-reads candidates from the registry at click time). For unsupported,
    // the renderer keys off `data-ref-target-path` instead, which step 05-07
    // will surface; we set target-key to the empty string to keep the data
    // shape consistent.
    const targetKey =
      resolved.tag === "live"
        ? resolved.entry.itemKey
        : resolved.tag === "ambiguous"
          ? (resolved.candidates[0]?.itemKey ?? "")
          : "";

    annotate(node, {
      hName: "reference-token",
      hProperties: {
        "data-ref-variant": resolved.tag,
        "data-ref-target-key": targetKey,
        "data-ref-raw-text": href,
      },
    });
  },
};
