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
import { agentDetectionConfig } from "./_helpers/fixtures";
import { parseMarkdown } from "./_helpers/markdownFixtures";
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
  it.skip("detection over a fenced block containing 'nw-bdd-requirements' produces no token annotations", () => {
    // Given: tree parsed from "```bash\necho \"nw-bdd-requirements\"\n```"
    // And:   registry contains the skill 'nw-bdd-requirements'
    // When:  annotated = detectionRemarkPlugin(registry, ctx)(tree)
    // Then:  no node in the fenced 'code' subtree has data.hName === 'reference-token'
  });
});

// @walking_skeleton @driving_port
describe("Bare prose is not detected as a reference in v1", () => {
  it.skip("detection over plain prose containing the bare word 'release' produces no token annotations even when 'release' is a known command", () => {
    // Given: tree parsed from "Use release to ship."
    // And:   registry contains a project-scope command 'release'
    // When:  annotated = detectionRemarkPlugin(registry, ctx)(tree)
    // Then:  no text node in the result has data.hName === 'reference-token'
    //        (Bare-prose detection is OFF by default per ADR-010.)
  });
});

// @walking_skeleton @driving_port
describe("Markdown link to a known skill renders as a live cross-reference token", () => {
  it.skip("detection over [nw-bdd-requirements](~/.claude/skills/nw-bdd-requirements/SKILL.md) produces a live token annotation", () => {
    // Given: tree parsed from the markdown link
    // And:   registry contains the user-scope skill 'nw-bdd-requirements' at that path
    // When:  annotated = detectionRemarkPlugin(registry, ctx)(tree)
    // Then:  the link node has data.hName === 'reference-token' and data.hProperties['data-ref-variant'] === 'live'
  });
});

// @walking_skeleton @driving_port
describe("Reference to a missing item renders as a dead token", () => {
  it.skip("detection over a markdown link to a non-existent skill produces a dead token annotation", () => {
    // Given: tree parsed from "[nw-retired-skill](~/.claude/skills/nw-retired-skill/SKILL.md)"
    // And:   registry has no item named 'nw-retired-skill'
    // When:  annotated = detectionRemarkPlugin(registry, ctx)(tree)
    // Then:  the link node has data.hName === 'reference-token' and data.hProperties['data-ref-variant'] === 'dead'
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
