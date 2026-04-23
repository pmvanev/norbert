/**
 * Acceptance tests: Detection Pipeline (config-cross-references)
 *
 * Validates the pure remark-style detection plugin per ADR-001 and ADR-010.
 * Tests run against a parsed MDAST tree (we use react-markdown's parser by
 * proxy via the helper) and assert that the resulting node annotations match
 * the contract in architecture.md section 6.2.
 *
 * Driving port: detectionRemarkPlugin(registry, ctx) -> (tree) -> tree' (pure).
 *
 * Traces to:
 *   walking-skeleton.feature
 *     -- Inline code matching a known agent renders as a live cross-reference token
 *     -- Content inside fenced code blocks is never linkified
 *     -- Bare prose is not detected as a reference in v1
 *     -- Reference to a missing item renders as a dead token
 *   user-stories.md US-101 acceptance criteria, ADR-001, ADR-010
 */

import { describe, it, expect } from "vitest";
import { visit } from "unist-util-visit";
import type { InlineCode } from "mdast";
import { agentDetectionConfig, walkingSkeletonConfig } from "./_helpers/fixtures";
import {
  fencedCodeBlockWithKnownName,
  parseMarkdown,
} from "./_helpers/markdownFixtures";
import { buildRegistry } from "../../../src/plugins/norbert-config/domain/references/registry";
import {
  detectionRemarkPlugin,
  type DetectionContext,
} from "../../../src/plugins/norbert-config/domain/references/detection/remarkPlugin";

// @walking_skeleton @driving_port
describe("Inline code matching a known agent renders as a live cross-reference token", () => {
  it("detection over inline code 'nw-solution-architect' produces a token annotation when the agent exists in the registry", () => {
    // Arrange
    const registry = buildRegistry(agentDetectionConfig, 0);
    const ctx: DetectionContext = { currentItemDir: null };
    const tree = parseMarkdown(
      "Invoke `nw-solution-architect` here. Run `ls -la`.",
    );

    // Act
    detectionRemarkPlugin(registry, ctx)(tree);

    // Assert: collect every inlineCode node in the annotated tree.
    const inlineCodeNodes: InlineCode[] = [];
    visit(tree, "inlineCode", (node) => {
      inlineCodeNodes.push(node);
    });
    expect(inlineCodeNodes).toHaveLength(2);

    const matched = inlineCodeNodes.find(
      (node) => node.value === "nw-solution-architect",
    );
    const unmatched = inlineCodeNodes.find((node) => node.value === "ls -la");
    if (matched === undefined || unmatched === undefined) {
      throw new Error(
        "Expected the parsed tree to contain both inlineCode fixtures",
      );
    }

    // Matched node: live token annotation per architecture sec 6.2.
    const matchedData = matched.data as
      | {
          hName?: string;
          hProperties?: Record<string, unknown>;
        }
      | undefined;
    expect(matchedData?.hName).toBe("reference-token");
    expect(matchedData?.hProperties?.["data-ref-variant"]).toBe("live");
    expect(matchedData?.hProperties?.["data-ref-target-key"]).toBe(
      "agent:project:nw-solution-architect",
    );
    expect(matchedData?.hProperties?.["data-ref-raw-text"]).toBe(
      "nw-solution-architect",
    );

    // Non-matched node: no annotation. (data may be undefined OR present but
    // without hName -- both are acceptable shapes for "unannotated".)
    const unmatchedData = unmatched.data as
      | { hName?: string }
      | undefined;
    expect(unmatchedData?.hName).toBeUndefined();
  });
});

// @walking_skeleton @driving_port
describe("Content inside fenced code blocks is never linkified", () => {
  it("detection over a fenced block containing 'nw-bdd-requirements' produces no token annotations", () => {
    // Arrange: registry contains the skill 'nw-bdd-requirements' (user scope)
    // and the source markdown wraps it inside a fenced bash code block.
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const ctx: DetectionContext = { currentItemDir: null };
    const tree = parseMarkdown(fencedCodeBlockWithKnownName);

    // Act
    detectionRemarkPlugin(registry, ctx)(tree);

    // Assert: walk EVERY node in the tree -- not just inlineCode -- and confirm
    // no node anywhere carries a reference-token annotation. Fenced code blocks
    // are MDAST `code` nodes (not `inlineCode`), so the inlineCode strategy
    // must leave them alone (architecture sec 6.2, ADR-001).
    const annotatedNodes: Array<{ type: string; hName: unknown }> = [];
    visit(tree, (node) => {
      const data = (node as { data?: { hName?: unknown } }).data;
      if (data?.hName !== undefined) {
        annotatedNodes.push({ type: node.type, hName: data.hName });
      }
    });
    expect(annotatedNodes).toHaveLength(0);
  });
});

// @walking_skeleton @driving_port
describe("Bare prose is not detected as a reference in v1", () => {
  it("detection over plain prose containing the bare word 'release' produces no token annotations even when 'release' is a known command", () => {
    // Arrange: registry contains a project-scope `release` command
    // (walkingSkeletonConfig). Source markdown is bare prose -- no inline code,
    // no markdown link -- so no v1 strategy should annotate it (ADR-010).
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const ctx: DetectionContext = { currentItemDir: null };
    const tree = parseMarkdown("Use release to ship.");

    // Act
    detectionRemarkPlugin(registry, ctx)(tree);

    // Assert: walk EVERY node in the tree -- not just text -- and confirm no
    // node anywhere carries a reference-token annotation. ADR-010 fixes
    // bare-prose detection OFF by default in v1; the DETECTION_PIPELINE
    // contains only inlineCodeStrategy (and, in 05-04, markdownLinkStrategy),
    // neither of which scans plain text nodes.
    const annotatedNodes: Array<{ type: string; hName: unknown }> = [];
    visit(tree, (node) => {
      const data = (node as { data?: { hName?: unknown } }).data;
      if (data?.hName !== undefined) {
        annotatedNodes.push({ type: node.type, hName: data.hName });
      }
    });
    expect(annotatedNodes).toHaveLength(0);
  });
});

// @walking_skeleton @driving_port
describe("Markdown link to a known skill renders as a live cross-reference token", () => {
  it("detection over [nw-bdd-requirements](~/.claude/skills/nw-bdd-requirements/SKILL.md) produces a live token annotation", () => {
    // Arrange: walkingSkeletonConfig already contains nw-bdd-requirements (user
    // scope) at filePath '~/.claude/skills/nw-bdd-requirements/SKILL.md', so a
    // markdown link to that exact href must classify via the resolver path
    // branch as live and the markdown-link strategy must annotate the link
    // MDAST node with the standard token data block.
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const ctx: DetectionContext = { currentItemDir: null };
    const tree = parseMarkdown(
      "Load the [nw-bdd-requirements](~/.claude/skills/nw-bdd-requirements/SKILL.md) skill.",
    );

    // Act
    detectionRemarkPlugin(registry, ctx)(tree);

    // Assert: collect every link node in the annotated tree.
    const linkNodes: Array<{
      type: string;
      url: string;
      data?: { hName?: string; hProperties?: Record<string, unknown> };
    }> = [];
    visit(tree, "link", (node) => {
      linkNodes.push(node as unknown as (typeof linkNodes)[number]);
    });
    expect(linkNodes).toHaveLength(1);

    const matched = linkNodes[0];
    if (matched === undefined) {
      throw new Error("Expected the parsed tree to contain a link node");
    }

    // The matched link gets a live token annotation per architecture sec 6.2.
    // Resolver returns the user-scope skill, whose itemKey is computed by
    // buildRegistry from (type, scope, name).
    expect(matched.data?.hName).toBe("reference-token");
    expect(matched.data?.hProperties?.["data-ref-variant"]).toBe("live");
    expect(matched.data?.hProperties?.["data-ref-target-key"]).toBe(
      "skill:user:nw-bdd-requirements",
    );
  });
});

// @walking_skeleton @driving_port
describe("Reference to a missing item renders as a dead token", () => {
  it("detection over a markdown link to a non-existent skill produces a dead token annotation", () => {
    // Arrange: walkingSkeletonConfig contains nw-bdd-requirements but NOT
    // nw-retired-skill, so a markdown link to a path under .claude/skills/ for
    // a missing skill must classify via the resolver path branch as dead. Per
    // architecture sec 6.2 + D2 ("dead refs never crash"), the markdown-link
    // strategy must annotate the link MDAST node so the React renderer can
    // surface the dead-style token (US-107: strikethrough + tooltip).
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const ctx: DetectionContext = { currentItemDir: null };
    const tree = parseMarkdown(
      "Load the [nw-retired-skill](~/.claude/skills/nw-retired-skill/SKILL.md) skill.",
    );

    // Act
    detectionRemarkPlugin(registry, ctx)(tree);

    // Assert: collect every link node in the annotated tree.
    const linkNodes: Array<{
      type: string;
      url: string;
      data?: { hName?: string; hProperties?: Record<string, unknown> };
    }> = [];
    visit(tree, "link", (node) => {
      linkNodes.push(node as unknown as (typeof linkNodes)[number]);
    });
    expect(linkNodes).toHaveLength(1);

    const matched = linkNodes[0];
    if (matched === undefined) {
      throw new Error("Expected the parsed tree to contain a link node");
    }

    // The dead link gets a dead token annotation per architecture sec 6.2.
    expect(matched.data?.hName).toBe("reference-token");
    expect(matched.data?.hProperties?.["data-ref-variant"]).toBe("dead");
  });
});

// @walking_skeleton @driving_port
describe("Reference resolving to multiple items renders as an ambiguous token", () => {
  it.skip("detection over inline code 'release' produces an ambiguous token when 'release' exists in 2+ scopes", () => {
    // Given: tree parsed from "Run `release` to ship."
    // And:   registry has 'release' command in both project and user scope
    // When:  annotated = detectionRemarkPlugin(registry, ctx)(tree)
    // Then:  the inlineCode node has data.hName === 'reference-token' and data.hProperties['data-ref-variant'] === 'ambiguous'
    //        AND data.hProperties['data-ref-candidate-count'] === 2
  });
});

// @walking_skeleton @driving_port
describe("Reference to an unsupported item type renders as an unsupported token", () => {
  it.skip("detection over a markdown link whose path resolves to an item type the plugin does not expose produces an unsupported token annotation", () => {
    // Given: tree parsed from "[unknown thing](~/.claude/unknown-kind/foo.bin)"
    // And:   registry contains no 'unknown-kind' items at that path; the path
    //        resolves through resolve(path, registry) to { tag: 'unsupported',
    //        path, reason } per architecture sec 6.3.
    // When:  annotated = detectionRemarkPlugin(registry, ctx)(tree)
    // Then:  the link node has data.hName === 'reference-token' and
    //        data.hProperties['data-ref-variant'] === 'unsupported'
    //        AND data.hProperties['data-ref-target-path'] === '~/.claude/unknown-kind/foo.bin'
    //
    // (Closes PO MEDIUM #1 -- US-101 AC bullet 4 'unsupported' variant.
    //  Paired with resolver.test.ts unsupported case and walking-skeleton.feature
    //  scenario "Reference to an unsupported item type renders as an unsupported token".)
  });
});
