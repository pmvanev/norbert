/**
 * Cross-reference extraction -- pure functions that discover relationship
 * edges between ConfigNode values.
 *
 * No I/O. Operates on an assembled node list and produces ConfigEdge values
 * representing agent->skill references, plugin->component containment,
 * rule->path patterns, agent->tool allowlists, and hook->event bindings.
 */

import type { ConfigNode, ConfigEdge, EdgeType } from './types/index.js';

// ---------------------------------------------------------------------------
// Internal helpers -- frontmatter extraction
// ---------------------------------------------------------------------------

/**
 * Extracts the frontmatter record from a node's parsed content,
 * returning null when no frontmatter is present.
 */
const extractFrontmatter = (
  node: ConfigNode,
): Readonly<Record<string, unknown>> | null => {
  if (node.parsedContent.format === 'markdown-with-frontmatter') {
    return node.parsedContent.frontmatter;
  }
  return null;
};

/**
 * Extracts the parsed JSON data from a node's parsed content,
 * returning null when the content is not JSON.
 */
const extractJsonData = (
  node: ConfigNode,
): Readonly<Record<string, unknown>> | null => {
  if (node.parsedContent.format === 'json') {
    return node.parsedContent.parsedData;
  }
  return null;
};

/**
 * Safely reads an array of strings from an object property.
 * Returns empty array when the property is absent or not a string array.
 */
const readStringArray = (
  data: Readonly<Record<string, unknown>>,
  key: string,
): readonly string[] => {
  const value = data[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

/**
 * Creates a single ConfigEdge value.
 */
const createEdge = (
  sourceId: string,
  targetId: string,
  edgeType: EdgeType,
  label: string,
): ConfigEdge => ({
  sourceId,
  targetId,
  edgeType,
  label,
});

// ---------------------------------------------------------------------------
// Internal helpers -- node name resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the logical name for a node. For nodes with a `name` field
 * in frontmatter, uses that. Otherwise falls back to the file-based name.
 */
const resolveNodeName = (node: ConfigNode): string => {
  const frontmatter = extractFrontmatter(node);
  if (frontmatter !== null && typeof frontmatter.name === 'string') {
    return frontmatter.name;
  }
  return node.name;
};

// ---------------------------------------------------------------------------
// Edge extractors -- each returns edges for one relationship type
// ---------------------------------------------------------------------------

/**
 * Agent -> Skill references.
 * Agents with a `skills` frontmatter field reference skill nodes by name.
 */
const extractAgentSkillEdges = (
  nodes: readonly ConfigNode[],
): readonly ConfigEdge[] => {
  const agentNodes = nodes.filter((n) => n.nodeType === 'agent');
  const skillNodes = nodes.filter((n) => n.nodeType === 'skill');

  // Build a lookup from skill logical name to skill node
  const skillByName = new Map<string, ConfigNode>();
  for (const skill of skillNodes) {
    const name = resolveNodeName(skill);
    // For plugin skills with namespace prefix (plugin-name:skill-name),
    // also register the bare skill name for matching
    const colonIndex = name.indexOf(':');
    if (colonIndex >= 0) {
      skillByName.set(name, skill);
      // Also store without prefix for agents that reference by bare name
      skillByName.set(name.slice(colonIndex + 1), skill);
    } else {
      skillByName.set(name, skill);
    }
  }

  const edges: ConfigEdge[] = [];
  for (const agent of agentNodes) {
    const frontmatter = extractFrontmatter(agent);
    if (frontmatter === null) continue;

    const skillNames = readStringArray(frontmatter, 'skills');
    for (const skillName of skillNames) {
      const targetSkill = skillByName.get(skillName);
      if (targetSkill !== undefined) {
        edges.push(
          createEdge(
            agent.id,
            targetSkill.id,
            'agent-references-skill',
            `references skill: ${skillName}`,
          ),
        );
      }
    }
  }

  return edges;
};

/**
 * Plugin -> Component containment.
 * A node is contained by a plugin when its filePath starts with
 * the plugin's directory prefix and the node is not the plugin itself.
 */
const extractPluginContainmentEdges = (
  nodes: readonly ConfigNode[],
): readonly ConfigEdge[] => {
  const pluginNodes = nodes.filter((n) => n.nodeType === 'plugin');

  // Derive the plugin directory prefix from the plugin.json path
  // e.g., "my-plugin/.claude-plugin/plugin.json" -> "my-plugin/"
  const pluginPrefixes = pluginNodes.map((plugin) => {
    const normalized = plugin.filePath.replace(/\\/g, '/');
    // Find the path up to the .claude-plugin/ directory
    const pluginDirIndex = normalized.indexOf('.claude-plugin/');
    if (pluginDirIndex > 0) {
      return { plugin, prefix: normalized.slice(0, pluginDirIndex) };
    }
    return null;
  }).filter((entry): entry is { plugin: ConfigNode; prefix: string } => entry !== null);

  const edges: ConfigEdge[] = [];
  for (const node of nodes) {
    if (node.nodeType === 'plugin') continue;

    const normalizedPath = node.filePath.replace(/\\/g, '/');
    for (const { plugin, prefix } of pluginPrefixes) {
      if (normalizedPath.startsWith(prefix)) {
        edges.push(
          createEdge(
            plugin.id,
            node.id,
            'plugin-contains-component',
            `contains: ${node.name}`,
          ),
        );
      }
    }
  }

  return edges;
};

/**
 * Rule -> Path pattern.
 * Rules with a `paths` frontmatter field produce edges to virtual
 * pattern targets (prefixed with "pattern:").
 */
const extractRulePathEdges = (
  nodes: readonly ConfigNode[],
): readonly ConfigEdge[] => {
  const ruleNodes = nodes.filter((n) => n.nodeType === 'rule');

  const edges: ConfigEdge[] = [];
  for (const rule of ruleNodes) {
    const frontmatter = extractFrontmatter(rule);
    if (frontmatter === null) continue;

    const paths = readStringArray(frontmatter, 'paths');
    for (const pattern of paths) {
      edges.push(
        createEdge(
          rule.id,
          `pattern:${pattern}`,
          'rule-scoped-to-path',
          `applies to: ${pattern}`,
        ),
      );
    }
  }

  return edges;
};

/**
 * Agent -> Tool allowlist.
 * Agents with a `tools` frontmatter field produce edges to virtual
 * tool targets (prefixed with "tool:").
 */
const extractToolAllowlistEdges = (
  nodes: readonly ConfigNode[],
): readonly ConfigEdge[] => {
  const agentNodes = nodes.filter((n) => n.nodeType === 'agent');

  const edges: ConfigEdge[] = [];
  for (const agent of agentNodes) {
    const frontmatter = extractFrontmatter(agent);
    if (frontmatter === null) continue;

    const tools = readStringArray(frontmatter, 'tools');
    for (const tool of tools) {
      edges.push(
        createEdge(
          agent.id,
          `tool:${tool}`,
          'skill-allows-tool',
          `allows tool: ${tool}`,
        ),
      );
    }
  }

  return edges;
};

/**
 * Hook -> Event type.
 * Hook nodes (JSON format) with a `hooks` object produce edges to
 * virtual event targets (prefixed with "event:").
 */
const extractHookEventEdges = (
  nodes: readonly ConfigNode[],
): readonly ConfigEdge[] => {
  const hookNodes = nodes.filter((n) => n.nodeType === 'hook');

  const edges: ConfigEdge[] = [];
  for (const hookNode of hookNodes) {
    const jsonData = extractJsonData(hookNode);
    if (jsonData === null) continue;

    const hooks = jsonData.hooks;
    if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) continue;

    const eventNames = Object.keys(hooks as Record<string, unknown>);
    for (const eventName of eventNames) {
      edges.push(
        createEdge(
          hookNode.id,
          `event:${eventName}`,
          'agent-defines-hook',
          `listens to: ${eventName}`,
        ),
      );
    }
  }

  return edges;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts all cross-reference edges from an array of ConfigNode values.
 *
 * Pure function: no I/O, no side effects. Scans nodes for relationships
 * including agent-skill references, plugin-component containment,
 * rule-path patterns, tool allowlists, and hook-event bindings.
 *
 * @param nodes - Array of ConfigNode values from the assembled model
 * @returns Array of ConfigEdge values representing discovered relationships
 */
export const extractEdges = (
  nodes: readonly ConfigNode[],
): readonly ConfigEdge[] => [
  ...extractAgentSkillEdges(nodes),
  ...extractPluginContainmentEdges(nodes),
  ...extractRulePathEdges(nodes),
  ...extractToolAllowlistEdges(nodes),
  ...extractHookEventEdges(nodes),
];
