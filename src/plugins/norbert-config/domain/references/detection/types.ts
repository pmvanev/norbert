/**
 * Detection Pipeline -- shared types
 *
 * The detection pipeline is a pure remark-style transform: each strategy
 * inspects an MDAST node, decides whether it should become a cross-reference
 * token, and (when so) annotates the node in place with the standard unified
 * `data.hName` / `data.hProperties` mechanism so react-markdown's `components`
 * map can render it as a custom element.
 *
 * Architecture: §6.2 (Detection Pipeline). ADR-001 (remark AST walk).
 *
 * Constraints:
 *   - Pure functions only -- no React, no Tauri, no IO, no node:* imports
 *   - Strategies receive everything they need (node, registry, ctx) by argument
 *   - The set of allowed imports under detection/ is enforced by the
 *     `detection-strategies-isolated` rule in .dependency-cruiser.cjs
 */

import type { Node } from "unist";
import type { ReferenceRegistry } from "../registry";

/**
 * Narrow alias for the MDAST nodes a detection strategy may visit. We keep the
 * structural type local rather than importing every node interface from
 * @types/mdast so detection stays decoupled from upstream type churn. The
 * relevant fields are added per-strategy via narrowing on `node.type`.
 */
export type MdastNode = Node;

/**
 * Per-render context threaded through every strategy.
 *
 * `currentItemDir` is the directory of the currently-viewed item, used by the
 * markdown-link strategy (lands in 05-04) to resolve relative paths like
 * `./foo.md`. `null` for items that have no containing directory (e.g.,
 * aggregated rules surfaces).
 */
export interface DetectionContext {
  readonly currentItemDir: string | null;
}

/**
 * A detection strategy. Mutates `node.data` in place when a match is found;
 * otherwise leaves the node unchanged. Pure: no IO, no shared mutable state
 * beyond the node passed in (the surrounding tree-walk owns iteration).
 */
export interface DetectionStrategy {
  readonly apply: (
    node: MdastNode,
    registry: ReferenceRegistry,
    ctx: DetectionContext,
  ) => void;
}

/**
 * Shape of the `data` block we attach to a matched MDAST node. Mirrors the
 * unified `data.hName` / `data.hProperties` convention used by remark-toc,
 * remark-external-links, etc. (ADR-001).
 */
export interface ReferenceTokenData {
  hName: "reference-token";
  hProperties: {
    "data-ref-variant": "live" | "ambiguous" | "dead" | "unsupported";
    "data-ref-target-key": string;
    "data-ref-raw-text": string;
    [extra: string]: string | number;
  };
}
