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
import {
  agentDetectionConfig,
  ambiguousReleaseConfig,
  walkingSkeletonConfig,
} from "./_helpers/fixtures";
import {
  fencedCodeBlockWithKnownName,
  parseMarkdown,
} from "./_helpers/markdownFixtures";
import { buildRegistry } from "../../../src/plugins/norbert-config/domain/references/registry";
import {
  detectionRemarkPlugin,
  type DetectionContext,
} from "../../../src/plugins/norbert-config/domain/references/detection/remarkPlugin";
import { inlineCodeStrategy } from "../../../src/plugins/norbert-config/domain/references/detection/inlineCodeStrategy";
import { markdownLinkStrategy } from "../../../src/plugins/norbert-config/domain/references/detection/markdownLinkStrategy";
import type { MdastNode } from "../../../src/plugins/norbert-config/domain/references/detection/types";

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

// @validation_only @driving_port
describe("Inline code containing an unregistered name produces no annotation", () => {
  it("inline code containing an unregistered name produces no annotation (asymmetric to markdown-link strategy)", () => {
    // Locks in the design decision documented in inlineCodeStrategy.ts lines
    // 60-64 (early-return on dead): inline code that does not match any
    // registry item stays plain code, NOT a dead reference token. This is
    // INTENTIONALLY asymmetric to markdownLinkStrategy, which DOES annotate
    // dead links so the renderer can surface the strikethrough/tooltip
    // affordance (US-107). The asymmetry exists because (a) inline code is
    // ambient prose syntax with high false-positive risk, while (b) markdown
    // links are explicit author intent ("I meant to reference this").
    //
    // If the early-return is accidentally removed in a future refactor, every
    // unregistered inline-code span would suddenly render as a dead token --
    // a noisy regression. This test catches that regression.
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const ctx: DetectionContext = { currentItemDir: null };
    const tree = parseMarkdown("Run `nw-nonexistent-skill` here.");

    // Act
    detectionRemarkPlugin(registry, ctx)(tree);

    // Assert: walk EVERY node in the tree -- not just inlineCode -- and confirm
    // no node anywhere carries a reference-token annotation. A regression that
    // dropped the early-return would annotate the inlineCode node; this would
    // immediately fail the toHaveLength(0) assertion.
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
    // Live tokens MUST NOT carry data-ref-target-path -- that key is reserved
    // for unsupported tokens (markdownLinkStrategy.ts:64-67 spread). The
    // renderer distinguishes variants by hProperty PRESENCE, not value. We
    // assert key absence (not just `undefined` value) so a mutation that
    // always-spreads `{ "data-ref-target-path": resolved.path }` -- which
    // injects `undefined` for non-unsupported variants -- is killed.
    expect(
      Object.prototype.hasOwnProperty.call(
        matched.data?.hProperties ?? {},
        "data-ref-target-path",
      ),
    ).toBe(false);
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
    // Dead links have no registry entry to key off, so target-key is the
    // empty-string sentinel (markdownLinkStrategy.ts:87 -- the renderer keys
    // off data-ref-raw-text instead). Asserting the exact sentinel value
    // anchors the `: ""` literal so a mutation to a non-empty string is killed.
    expect(matched.data?.hProperties?.["data-ref-target-key"]).toBe("");
    // Dead tokens MUST NOT carry data-ref-target-path -- that key is reserved
    // for unsupported tokens (markdownLinkStrategy.ts:64-67 spread). We assert
    // key absence (not just `undefined` value) so a mutation that
    // always-spreads `{ "data-ref-target-path": resolved.path }` -- which
    // injects `undefined` for non-unsupported variants -- is killed.
    expect(
      Object.prototype.hasOwnProperty.call(
        matched.data?.hProperties ?? {},
        "data-ref-target-path",
      ),
    ).toBe(false);
  });
});

// @walking_skeleton @driving_port
describe("Reference resolving to multiple items renders as an ambiguous token", () => {
  it("detection over inline code 'release' produces an ambiguous token when 'release' exists in 2+ scopes", () => {
    // Arrange: ambiguousReleaseConfig has a 'release' command in BOTH project
    // and user scope, so resolve({kind:'name', value:'release'}, registry)
    // returns { tag: 'ambiguous', candidates: [<project>, <user>] }. The
    // detection layer must surface this multiplicity to the React layer per
    // ADR-004 (always-show disambiguation popover) so the popover knows how
    // many options to render. Architecture sec 6.2 lists data-ref-variant /
    // data-ref-target-key / data-ref-raw-text; the candidate count is an
    // ADDITIVE hProperty for ambiguous tokens (back-prop to architecture
    // during finalize per roadmap step 05-06 note).
    const registry = buildRegistry(ambiguousReleaseConfig, 0);
    const ctx: DetectionContext = { currentItemDir: null };
    const tree = parseMarkdown("Run `release` to ship.");

    // Act
    detectionRemarkPlugin(registry, ctx)(tree);

    // Assert: collect every inlineCode node and locate the 'release' one.
    const inlineCodeNodes: InlineCode[] = [];
    visit(tree, "inlineCode", (node) => {
      inlineCodeNodes.push(node);
    });
    expect(inlineCodeNodes).toHaveLength(1);

    const matched = inlineCodeNodes[0];
    if (matched === undefined) {
      throw new Error(
        "Expected the parsed tree to contain the 'release' inlineCode node",
      );
    }

    const matchedData = matched.data as
      | {
          hName?: string;
          hProperties?: Record<string, unknown>;
        }
      | undefined;
    expect(matchedData?.hName).toBe("reference-token");
    expect(matchedData?.hProperties?.["data-ref-variant"]).toBe("ambiguous");
    expect(matchedData?.hProperties?.["data-ref-raw-text"]).toBe("release");
    // Two registry candidates (project + user scope) for the bare name.
    expect(matchedData?.hProperties?.["data-ref-candidate-count"]).toBe(2);
    // ambiguous branch picks the first candidate's itemKey as a stable
    // identifier for the variant (architecture sec 6.2 contract via
    // inlineCodeStrategy.ts:74-79); ambiguousReleaseConfig is ordered
    // [project, user] so the first candidate is the project-scope command.
    // Asserting this anchors the ternary's ambiguous branch and the
    // optional-chaining/nullish-coalescing on candidates[0].
    expect(matchedData?.hProperties?.["data-ref-target-key"]).toBe(
      "command:project:release",
    );
  });
});

// @walking_skeleton @driving_port
describe("Reference to an unsupported item type renders as an unsupported token", () => {
  it("detection over a markdown link whose path resolves to an item type the plugin does not expose produces an unsupported token annotation", () => {
    // Arrange: walkingSkeletonConfig has no 'unknown-kind' category entries, so
    // a markdown link to a path under .claude/unknown-kind/ classifies via the
    // resolver path branch as unsupported (resolver.ts: extractDotClaudeCategory
    // matches 'unknown-kind' which is NOT in REGISTRY_CATEGORIES). Per
    // architecture sec 6.2 + US-101 AC bullet 4 the markdown-link strategy
    // must annotate the link MDAST node with data-ref-variant === 'unsupported'
    // AND data-ref-target-path so the React renderer can surface the unsupported
    // chip + tooltip with the original href (no re-parsing the link).
    //
    // NOTE: data-ref-target-path is an ADDITIVE hProperty beyond architecture
    // sec 6.2's documented contract -- back-prop during finalize per roadmap.
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const ctx: DetectionContext = { currentItemDir: null };
    const tree = parseMarkdown(
      "Open the [unknown thing](~/.claude/unknown-kind/foo.bin) file.",
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

    // Unsupported variant: token annotation + variant + target-path so the
    // tooltip can surface the original href without re-parsing the link.
    expect(matched.data?.hName).toBe("reference-token");
    expect(matched.data?.hProperties?.["data-ref-variant"]).toBe("unsupported");
    expect(matched.data?.hProperties?.["data-ref-target-path"]).toBe(
      "~/.claude/unknown-kind/foo.bin",
    );
  });
});

// @mutation_coverage @driving_port
describe("Each strategy short-circuits on nodes its guard does not match", () => {
  // Mutation-coverage scenarios for the type-narrowing guards in
  // inlineCodeStrategy.isInlineCodeNode and markdownLinkStrategy.isLinkNode.
  // The end-to-end remarkPlugin walks every MDAST node (root, paragraph, text,
  // code, heading, ...) and applies BOTH strategies to each, so the guards must
  // reject any node whose `type` differs OR whose payload field is non-string.
  //
  // The driving port for these scenarios is the strategy's exported `apply`
  // function -- the same function the composed pipeline invokes per node. We
  // pass deliberately-mistyped MdastNode values (correct .type, missing/wrong
  // payload) and assert no `data` annotation is added.

  it("inlineCodeStrategy.apply ignores a non-inlineCode node even when it carries a string value field matching a registry name", () => {
    // Arrange: a `text`-typed node whose `value` IS a string and IS a known
    // registry name. Kills two guard mutations together:
    //   - `node.type === "inlineCode" -> true`: would let the second conjunct
    //     pass (value is a string), so the strategy would annotate a plain
    //     text node.
    //   - `node.type === "inlineCode" && ... -> node.type === "inlineCode" || ...`:
    //     same effect via the disjunction mutation.
    // Without a string value, both mutations would still reject (the second
    // conjunct fails for missing payload), leaving the mutants alive.
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const ctx: DetectionContext = { currentItemDir: null };
    const node: MdastNode & { data?: Record<string, unknown>; value?: unknown } = {
      type: "text",
      value: "nw-bdd-requirements",
    };

    // Act
    inlineCodeStrategy.apply(node, registry, ctx);

    // Assert: a non-inlineCode node must remain unannotated regardless of
    // payload shape -- bare-prose detection is OFF in v1 (ADR-010).
    expect(node.data).toBeUndefined();
  });

  it("inlineCodeStrategy.apply ignores an inlineCode-typed node whose value field is missing entirely", () => {
    // Arrange: type matches the discriminator but the payload field is
    // structurally absent. Kills the second-conjunct mutation
    //   `typeof node.value === "string" -> true`
    // which would otherwise let the strategy proceed to read `.value` as
    // `undefined`, then call `resolve({kind:'name', value: undefined})` --
    // which would crash or, worse, classify undefined as dead and annotate
    // the node. The early-return `if (resolved.tag === "dead") return` would
    // mask a downstream crash, so we assert no annotation directly.
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const ctx: DetectionContext = { currentItemDir: null };
    const node: MdastNode & { data?: Record<string, unknown> } = {
      type: "inlineCode",
    };

    // Act
    inlineCodeStrategy.apply(node, registry, ctx);

    // Assert
    expect(node.data).toBeUndefined();
  });

  it("inlineCodeStrategy.apply leaves a non-inlineCode node unannotated even when the early-return body is removed", () => {
    // Arrange: a `text`-typed node bearing a known registry name as value.
    // Kills two guard-body mutations together:
    //   - `if (!isInlineCodeNode(node)) -> if (false)`: removes the early
    //     return so the strategy proceeds on a non-inlineCode node.
    //   - `if (!isInlineCodeNode(node)) { return; } -> { ... } { }`: empty
    //     block body, same downstream effect (no return).
    // Either mutation lets the strategy reach `node.value as string` and
    // resolve a known name. We pick a `text` node containing a known name so
    // the downstream resolve succeeds and would write a `data` annotation.
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const ctx: DetectionContext = { currentItemDir: null };
    const node: MdastNode & { data?: Record<string, unknown>; value?: unknown } = {
      type: "text",
      value: "nw-bdd-requirements",
    };

    // Act
    inlineCodeStrategy.apply(node, registry, ctx);

    // Assert
    expect(node.data).toBeUndefined();
  });

  it("markdownLinkStrategy.apply ignores a non-link node even when it carries a string url field that resolves through the registry", () => {
    // Arrange: a `definition`-typed node (MDAST link definition) whose `url`
    // IS a string and DOES resolve to a registry entry. Kills two guard
    // mutations together:
    //   - `node.type === "link" -> true`: would let the second conjunct pass
    //     (url is a string), so the strategy would annotate the definition.
    //   - `node.type === "link" || ...`: same via the disjunction mutation.
    // Without a string url, both mutations still reject. Definition nodes
    // are NOT links per MDAST -- they are reference targets -- so no
    // annotation is correct.
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const ctx: DetectionContext = { currentItemDir: null };
    const node: MdastNode & { data?: Record<string, unknown>; url?: unknown } = {
      type: "definition",
      url: "~/.claude/skills/nw-bdd-requirements/SKILL.md",
    };

    // Act
    markdownLinkStrategy.apply(node, registry, ctx);

    // Assert
    expect(node.data).toBeUndefined();
  });

  it("markdownLinkStrategy.apply ignores a link-typed node whose url field is missing entirely", () => {
    // Arrange: type matches the discriminator but the payload field is
    // structurally absent. Kills the second-conjunct mutation
    //   `typeof node.url === "string" -> true`
    // which would otherwise let the strategy proceed to read `.url` as
    // `undefined`, then call `resolve({kind:'path', value: undefined})`.
    const registry = buildRegistry(walkingSkeletonConfig, 0);
    const ctx: DetectionContext = { currentItemDir: null };
    const node: MdastNode & { data?: Record<string, unknown> } = {
      type: "link",
    };

    // Act
    markdownLinkStrategy.apply(node, registry, ctx);

    // Assert
    expect(node.data).toBeUndefined();
  });
});
