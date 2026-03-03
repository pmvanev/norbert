/**
 * Shared query parameter parsing helpers for session filter endpoints.
 *
 * Used by history.ts and export.ts to avoid duplicated parsing logic.
 */

import type { SortField, SortOrder } from '@norbert/core';

// ---------------------------------------------------------------------------
// Valid sort fields and orders
// ---------------------------------------------------------------------------

export const VALID_SORT_FIELDS: readonly SortField[] = ['startTime', 'estimatedCost', 'eventCount', 'agentCount'];
export const VALID_SORT_ORDERS: readonly SortOrder[] = ['asc', 'desc'];

// ---------------------------------------------------------------------------
// Query parameter parsing helpers
// ---------------------------------------------------------------------------

export const parseOptionalFloat = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const parseOptionalInt = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const parseSortField = (value: string | undefined): SortField =>
  VALID_SORT_FIELDS.includes(value as SortField) ? (value as SortField) : 'startTime';

export const parseSortOrder = (value: string | undefined): SortOrder =>
  VALID_SORT_ORDERS.includes(value as SortOrder) ? (value as SortOrder) : 'desc';
