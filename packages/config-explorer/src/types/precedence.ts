/**
 * Precedence types -- per-subsystem precedence resolution.
 *
 * A PrecedenceChain captures how configuration values at different scopes
 * combine for a given subsystem: override (winner takes all), additive
 * (all loaded), or merge (arrays concatenated).
 */

import type { ScopeName } from './scope.js';
import type { SubsystemName } from './subsystem.js';
import type { ConfigNode } from './node.js';

// ---------------------------------------------------------------------------
// ResolutionType
// ---------------------------------------------------------------------------

export type ResolutionType = 'override' | 'additive' | 'merge';

export const ALL_RESOLUTION_TYPES: readonly ResolutionType[] = [
  'override',
  'additive',
  'merge',
] as const;

// ---------------------------------------------------------------------------
// PrecedenceStatus (Discriminated Union)
// ---------------------------------------------------------------------------

export type PrecedenceStatus = 'active' | 'overridden' | 'empty' | 'access-denied';

export const ALL_PRECEDENCE_STATUSES: readonly PrecedenceStatus[] = [
  'active',
  'overridden',
  'empty',
  'access-denied',
] as const;

// ---------------------------------------------------------------------------
// PrecedenceEntry
// ---------------------------------------------------------------------------

export interface PrecedenceEntry {
  readonly scope: ScopeName;
  readonly status: PrecedenceStatus;
  readonly nodes: readonly ConfigNode[];
  readonly overrideReason: string | null;
  readonly mergeContribution: readonly string[] | null;
}

// ---------------------------------------------------------------------------
// PrecedenceChain
// ---------------------------------------------------------------------------

export interface PrecedenceChain {
  readonly subsystem: SubsystemName;
  readonly entries: readonly PrecedenceEntry[];
  readonly resolutionType: ResolutionType;
}
