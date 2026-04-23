/**
 * Detection Pipeline -- markdown-link strategy
 *
 * Visits MDAST `link` nodes (`[label](href)`) and, when `node.url` resolves
 * via the registry's path index (or the resolver's `unsupported` bucket for
 * `.claude/<unknown-category>/...` paths), annotates the node with the
 * standard reference-token contract (architecture §6.2) so react-markdown's
 * `components` map renders it as a cross-reference token.
 *
 * Outcomes (all four ResolvedRef variants annotate -- D2: dead refs never
 * crash, they always render as a token rather than a bare link so users see
 * the broken state):
 *   - live        -> annotate with target-key
 *   - ambiguous   -> annotate with first-candidate target-key
 *   - dead        -> annotate with empty target-key (renderer keys off
 *                    raw-text per US-107 strikethrough+tooltip)
 *   - unsupported -> annotate with empty target-key + target-path (renderer
 *                    keys off target-path per US-101 AC bullet 4 neutral chip)
 *
 * Architecture: §6.2 (Detection Pipeline) -- markdown-link branch.
 * ADR-001: pure remark-style transform. ADR-010: ships in v1; canonical
 * pipeline order is [markdownLinkStrategy, inlineCodeStrategy].
 *
 * Pure: no IO, no closures over module-level state. The token-annotation
 * projection is shared with inlineCodeStrategy via applyTokenAnnotation.
 */

import { resolve } from "../resolver";
import type { ReferenceRegistry } from "../registry";
import { applyTokenAnnotation } from "./applyAnnotation";
import type {
  DetectionContext,
  DetectionStrategy,
  MdastNode,
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

    const extras: Record<string, string | number> =
      resolved.tag === "unsupported"
        ? { "data-ref-target-path": resolved.path }
        : {};

    applyTokenAnnotation(node, resolved, href, extras);
  },
};
