/**
 * Detection Pipeline -- shared token-annotation helper
 *
 * Both v1 strategies (markdown-link and inline-code) project a ResolvedRef
 * onto the same `data.hName` / `data.hProperties` shape -- the architecture
 * §6.2 contract: variant + target-key + raw-text. This module owns that
 * projection so the contract lives in one place and per-variant differences
 * (ambiguous candidate-count, unsupported target-path) stay explicit at the
 * caller as additive `extras`.
 *
 * Pure: no IO, no shared mutable state. Mutates `node.data` in place per the
 * standard unified contract (see remark-toc, remark-external-links). Caller
 * owns tree freshness.
 */

import type { ResolvedRef } from "../resolver";
import type { MdastNode, ReferenceTokenData } from "./types";

/**
 * Derive the `data-ref-target-key` value from a ResolvedRef.
 *
 *   - live      -> the matched entry's itemKey
 *   - ambiguous -> first candidate's itemKey (the disambiguation popover
 *                  re-reads candidates from the registry at click time per
 *                  ADR-004; this attribute only needs a stable identifier)
 *   - dead | unsupported -> empty string (no registry entry to point at;
 *                  renderers key off raw-text and target-path instead)
 */
function deriveTargetKey(resolved: ResolvedRef): string {
  if (resolved.tag === "live") {
    return resolved.entry.itemKey;
  }
  if (resolved.tag === "ambiguous") {
    return resolved.candidates[0]?.itemKey ?? "";
  }
  return "";
}

/**
 * Annotate an MDAST node with the architecture §6.2 reference-token contract.
 *
 * `extras` carries the per-variant additive hProperties:
 *   - ambiguous: { "data-ref-candidate-count": <n> }
 *   - unsupported: { "data-ref-target-path": <href> }
 *   - live | dead: {} (no extras)
 *
 * Back-prop note: candidate-count and target-path are additive beyond
 * architecture §6.2's documented contract. Documented during finalize per
 * roadmap step 05-06 / 05-07.
 */
export function applyTokenAnnotation(
  node: MdastNode & { data?: Record<string, unknown> },
  resolved: ResolvedRef,
  rawText: string,
  extras: Readonly<Record<string, string | number>> = {},
): void {
  const hProperties: ReferenceTokenData["hProperties"] = {
    "data-ref-variant": resolved.tag,
    "data-ref-target-key": deriveTargetKey(resolved),
    "data-ref-raw-text": rawText,
    ...extras,
  };

  const existing = (node.data ?? {}) as Record<string, unknown>;
  node.data = {
    ...existing,
    hName: "reference-token",
    hProperties,
  };
}
