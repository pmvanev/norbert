/**
 * Detection Pipeline -- composer
 *
 * The DETECTION_PIPELINE constant is the single source of truth for which
 * strategies participate in v1, in what order. Per ADR-001 / ADR-010, v1
 * ships [markdown-link, inline-code]. This step bootstraps with only the
 * inline-code branch -- the markdown-link strategy PREPENDS in step 05-04 so
 * the canonical order is preserved without touching this file twice.
 *
 * `composePipeline` reduces a strategy list to a single DetectionStrategy
 * whose `apply` runs every member in order against each visited node.
 *
 * Pure: no IO, no closures over module-level state.
 */

import { inlineCodeStrategy } from "./inlineCodeStrategy";
import type {
  DetectionContext,
  DetectionStrategy,
  MdastNode,
} from "./types";
import type { ReferenceRegistry } from "../registry";

export const DETECTION_PIPELINE: readonly DetectionStrategy[] = [
  inlineCodeStrategy,
  // markdownLinkStrategy lands in step 05-04 with PREPEND so order matches
  // ADR-010 (markdown-link first, then inline-code).
];

export function composePipeline(
  strategies: readonly DetectionStrategy[],
): DetectionStrategy {
  return {
    apply: (
      node: MdastNode,
      registry: ReferenceRegistry,
      ctx: DetectionContext,
    ) => {
      for (const strategy of strategies) {
        strategy.apply(node, registry, ctx);
      }
    },
  };
}
