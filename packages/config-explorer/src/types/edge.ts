/**
 * ConfigEdge -- a relationship between two configuration elements.
 *
 * Edges represent cross-references discovered during content parsing:
 * agent -> skill, plugin -> component, rule -> path pattern, etc.
 */

// ---------------------------------------------------------------------------
// EdgeType (Discriminated Union -- relationship kind)
// ---------------------------------------------------------------------------

export type EdgeType =
  | 'agent-references-skill'
  | 'plugin-contains-component'
  | 'agent-defines-hook'
  | 'rule-scoped-to-path'
  | 'skill-allows-tool'
  | 'skill-uses-agent'
  | 'naming-conflict';

export const ALL_EDGE_TYPES: readonly EdgeType[] = [
  'agent-references-skill',
  'plugin-contains-component',
  'agent-defines-hook',
  'rule-scoped-to-path',
  'skill-allows-tool',
  'skill-uses-agent',
  'naming-conflict',
] as const;

// ---------------------------------------------------------------------------
// ConfigEdge
// ---------------------------------------------------------------------------

export interface ConfigEdge {
  readonly sourceId: string;
  readonly targetId: string;
  readonly edgeType: EdgeType;
  readonly label: string;
}
