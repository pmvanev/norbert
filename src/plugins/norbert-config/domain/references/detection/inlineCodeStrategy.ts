/**
 * Detection Pipeline -- inline-code strategy
 *
 * Visits MDAST `inlineCode` nodes (`` `name` ``) and, when the node value
 * resolves via the registry's name index, annotates the node with the
 * standard reference-token contract (architecture §6.2) so react-markdown's
 * `components` map renders it as a cross-reference token.
 *
 * Outcomes (all four ResolvedRef variants):
 *   - live       -> annotate with target-key
 *   - ambiguous  -> annotate with first-candidate target-key + candidate-count
 *                   (the popover re-reads candidates at click time per ADR-004)
 *   - dead       -> leave the node untouched (plain code, no registry hit)
 *   - unsupported -> not produced by the name branch of the resolver
 *
 * Architecture: §6.2 (Detection Pipeline) -- inline-code branch.
 * ADR-001: pure remark-style transform. ADR-010: ships in v1 alongside
 * markdown-link; bare-prose detection deferred.
 *
 * Pure: no IO, no closures over module-level state. The token-annotation
 * projection is shared with markdownLinkStrategy via applyTokenAnnotation.
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
 * Narrow guard for an `inlineCode` MDAST node carrying a string `value`.
 * Avoids a hard import of `mdast.InlineCode` so detection stays decoupled
 * from upstream type churn.
 */
function isInlineCodeNode(
  node: MdastNode,
): node is MdastNode & { value: string; data?: Record<string, unknown> } {
  return (
    node.type === "inlineCode" &&
    typeof (node as { value?: unknown }).value === "string"
  );
}

export const inlineCodeStrategy: DetectionStrategy = {
  apply: (
    node: MdastNode,
    registry: ReferenceRegistry,
    _ctx: DetectionContext,
  ) => {
    if (!isInlineCodeNode(node)) {
      return;
    }

    // Note: remark-parse trims surrounding whitespace from inlineCode.value
    // before the AST is produced, so a raw Map.get against the registry's
    // by-name index matches without explicit trim. If a future markdown parser
    // variant ships without this guarantee, add `.trim()` here.
    const rawText = node.value;
    const resolved = resolve({ kind: "name", value: rawText }, registry);

    // No registry hit: leave the node untouched. Inline code that doesn't
    // match any item is plain code, not a reference.
    if (resolved.tag === "dead") {
      return;
    }

    const extras: Record<string, string | number> =
      resolved.tag === "ambiguous"
        ? { "data-ref-candidate-count": resolved.candidates.length }
        : {};

    applyTokenAnnotation(node, resolved, rawText, extras);
  },
};
