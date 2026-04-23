/**
 * Detection Pipeline -- unified-compatible remark plugin
 *
 * Builds the unified-style transform that walks an MDAST tree and applies
 * the composed DETECTION_PIPELINE to every node. Returned shape matches the
 * `remarkPlugins` prop contract react-markdown expects -- a function that,
 * given the root node, mutates it in place and returns it.
 *
 * Architecture: §6.2 (Detection Pipeline). ADR-001.
 *
 * Pure with respect to inputs other than the tree. The tree mutation is the
 * standard unified contract; callers are expected to pass freshly-parsed
 * trees per render and memoise upstream by `(content, registry.version)`.
 */

import { visit } from "unist-util-visit";
import { composePipeline, DETECTION_PIPELINE } from "./pipeline";
import type { DetectionContext, MdastNode } from "./types";
import type { ReferenceRegistry } from "../registry";

export type { DetectionContext } from "./types";

/**
 * Build the remark transform. Captures `registry` and `ctx` in a closure;
 * returns a tree-walking function suitable for react-markdown's
 * `remarkPlugins` prop or for direct invocation in tests.
 */
export function detectionRemarkPlugin(
  registry: ReferenceRegistry,
  ctx: DetectionContext,
): (tree: MdastNode) => MdastNode {
  const composed = composePipeline(DETECTION_PIPELINE);
  return (tree: MdastNode) => {
    visit(tree, (node) => {
      composed.apply(node, registry, ctx);
    });
    return tree;
  };
}
