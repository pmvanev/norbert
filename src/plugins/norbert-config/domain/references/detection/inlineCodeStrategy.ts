/**
 * Detection Pipeline -- inline-code strategy
 *
 * Visits MDAST `inlineCode` nodes (`` `name` ``) and, when the node value
 * matches a known item name in the ReferenceRegistry, annotates the node with
 * the standard unified `data.hName` / `data.hProperties` block so
 * react-markdown's `components` map renders it as a cross-reference token.
 *
 * Architecture: §6.2 (Detection Pipeline) -- inline-code branch.
 * ADR-010: ships in v1 alongside markdown-link. Bare prose deferred.
 *
 * Pure: no IO, no closures over module-level state. Uses `resolve` so all four
 * ResolvedRef variants (live | ambiguous | dead | unsupported) Just Work as
 * later steps un-skip more scenarios. The current scenario only exercises
 * `live`; the resolver classifies the rest correctly today.
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

function annotate(
  node: MdastNode & { value: string; data?: Record<string, unknown> },
  data: ReferenceTokenData,
): void {
  // Mutating `node.data` in place is the standard unified contract for remark
  // plugins (see remark-toc, remark-external-links). The surrounding pipeline
  // produces fresh trees per render, so this stays effectively pure.
  const existing = (node.data ?? {}) as Record<string, unknown>;
  node.data = { ...existing, hName: data.hName, hProperties: data.hProperties };
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

    const rawText = node.value;
    const resolved = resolve({ kind: "name", value: rawText }, registry);

    // No registry hit and no .claude/<unknown-category>/ path: leave the node
    // untouched. Inline code that doesn't match any item is plain code.
    if (resolved.tag === "dead") {
      return;
    }

    const targetKey =
      resolved.tag === "live"
        ? resolved.entry.itemKey
        : resolved.tag === "ambiguous"
          ? // First candidate is a stable identifier for the variant; the
            // disambiguation popover (US-108) reads the full candidates list
            // off the registry at click time, not off the data attribute.
            (resolved.candidates[0]?.itemKey ?? "")
          : "";

    // Base contract per architecture sec 6.2: variant + target-key + raw-text.
    // Additive hProperty for ambiguous tokens: the React layer (popover per
    // ADR-004 -- always-show disambiguation) reads `data-ref-candidate-count`
    // to render the right number of options without re-querying the registry.
    // Back-prop to architecture during finalize (roadmap step 05-06 note).
    const hProperties: ReferenceTokenData["hProperties"] = {
      "data-ref-variant": resolved.tag,
      "data-ref-target-key": targetKey,
      "data-ref-raw-text": rawText,
      ...(resolved.tag === "ambiguous"
        ? { "data-ref-candidate-count": resolved.candidates.length }
        : {}),
    };

    annotate(node, {
      hName: "reference-token",
      hProperties,
    });
  },
};
