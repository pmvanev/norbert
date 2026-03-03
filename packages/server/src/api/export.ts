/**
 * Session export endpoint -- GET /api/sessions/export.
 *
 * Generates CSV from session data using the pure sessionsToCsv function.
 *
 * Query parameters:
 *   - format: only 'csv' is supported (required)
 *   - Same filter params as /api/sessions/history
 *
 * Returns:
 *   - Content-Type: text/csv
 *   - Content-Disposition: attachment; filename="norbert-sessions-export.csv"
 *
 * Step: 05-02
 * Story: US-008
 */

import type { FastifyInstance } from 'fastify';
import type { StoragePort } from '@norbert/storage';
import type { SessionFilter, SortField, SortOrder } from '@norbert/core';
import { sessionsToCsv } from '@norbert/core';

// ---------------------------------------------------------------------------
// Valid sort fields and orders
// ---------------------------------------------------------------------------

const VALID_SORT_FIELDS: readonly SortField[] = ['startTime', 'estimatedCost', 'eventCount', 'agentCount'];
const VALID_SORT_ORDERS: readonly SortOrder[] = ['asc', 'desc'];

// ---------------------------------------------------------------------------
// Query parameter parsing helpers
// ---------------------------------------------------------------------------

const parseOptionalFloat = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parseOptionalInt = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parseSortField = (value: string | undefined): SortField =>
  VALID_SORT_FIELDS.includes(value as SortField) ? (value as SortField) : 'startTime';

const parseSortOrder = (value: string | undefined): SortOrder =>
  VALID_SORT_ORDERS.includes(value as SortOrder) ? (value as SortOrder) : 'desc';

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export const registerExportRoute = (
  app: FastifyInstance,
  storage: StoragePort
): void => {
  app.get('/api/sessions/export', async (request, reply) => {
    const query = request.query as Record<string, string>;

    // Parse filter parameters (same as history endpoint)
    const dateStart = query.dateStart;
    const dateEnd = query.dateEnd;
    const costMin = parseOptionalFloat(query.costMin);
    const costMax = parseOptionalFloat(query.costMax);
    const agentMin = parseOptionalInt(query.agentMin);
    const agentMax = parseOptionalInt(query.agentMax);

    const sortBy = parseSortField(query.sortBy);
    const sortOrder = parseSortOrder(query.sortOrder);
    const limit = Math.min(Math.max(parseInt(query.limit ?? '200', 10) || 200, 1), 1000);
    const offset = Math.max(parseInt(query.offset ?? '0', 10) || 0, 0);

    const filter: SessionFilter = {
      dateRange: dateStart !== undefined && dateEnd !== undefined
        ? { start: dateStart, end: dateEnd }
        : undefined,
      costRange: costMin !== undefined && costMax !== undefined
        ? { min: costMin, max: costMax }
        : undefined,
      agentCountRange: agentMin !== undefined && agentMax !== undefined
        ? { min: agentMin, max: agentMax }
        : undefined,
      sortBy,
      sortOrder,
      limit,
      offset,
    };

    const sessions = storage.getSessions(filter);
    const csv = sessionsToCsv([...sessions]);

    return reply
      .status(200)
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="norbert-sessions-export.csv"')
      .send(csv);
  });
};
