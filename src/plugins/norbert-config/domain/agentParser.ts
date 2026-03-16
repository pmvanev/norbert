/**
 * Agent Definition Parser
 *
 * Pure function that parses agent .md files (with optional YAML frontmatter)
 * into AgentDefinition values. No IO, no side effects.
 *
 * Driving port: parseAgentFile(filename, content) -> AgentParseResult
 */

import type { AgentDefinition, AgentParseResult, ConfigScope } from "./types";

// ---------------------------------------------------------------------------
// Frontmatter extraction
// ---------------------------------------------------------------------------

interface Frontmatter {
  readonly model: string;
  readonly tools: readonly string[];
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

function extractFrontmatter(content: string): {
  readonly frontmatter: Frontmatter;
  readonly body: string;
} {
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    return {
      frontmatter: { model: "default", tools: [] },
      body: content,
    };
  }

  const yamlBlock = match[1];
  const body = content.slice(match[0].length).replace(/^\r?\n/, "");

  return {
    frontmatter: parseFrontmatterYaml(yamlBlock),
    body,
  };
}

// ---------------------------------------------------------------------------
// Minimal YAML parsing (model + tools only)
// ---------------------------------------------------------------------------

function parseFrontmatterYaml(yaml: string): Frontmatter {
  const model = extractModel(yaml);
  const tools = extractTools(yaml);
  return { model, tools };
}

function extractModel(yaml: string): string {
  const match = yaml.match(/^model:\s*(.+)$/m);
  return match ? match[1].trim() : "default";
}

function extractTools(yaml: string): readonly string[] {
  const toolsSectionMatch = yaml.match(/^tools:\s*\n((?:\s+-\s+.+\n?)*)/m);
  if (!toolsSectionMatch) return [];

  const toolLines = toolsSectionMatch[1];
  return toolLines
    .split("\n")
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter((name) => name.length > 0);
}

// ---------------------------------------------------------------------------
// Name derivation
// ---------------------------------------------------------------------------

function deriveAgentName(filename: string): string {
  return filename.replace(/\.md$/, "");
}

// ---------------------------------------------------------------------------
// Description extraction
// ---------------------------------------------------------------------------

function extractDescription(body: string): string {
  const firstNonBlankLine =
    body
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  return firstNonBlankLine;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseAgentFile(
  filename: string,
  content: string,
  scope: ConfigScope = "user",
): AgentParseResult {
  if (content.trim().length === 0) {
    return {
      tag: "error",
      filePath: filename,
      message: "Agent file is empty",
    };
  }

  const { frontmatter, body } = extractFrontmatter(content);
  const name = deriveAgentName(filename);
  const description = extractDescription(body);
  const systemPrompt = body;

  const agent: AgentDefinition = {
    name,
    model: frontmatter.model,
    toolCount: frontmatter.tools.length,
    tools: frontmatter.tools,
    description,
    systemPrompt,
    filePath: filename,
    scope,
  };

  return { tag: "parsed", agent };
}

export type { AgentParseResult };
