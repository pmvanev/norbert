/**
 * Session history endpoint -- GET /api/sessions/history.
 *
 * Returns filterable/sortable session list with daily trends and baselines.
 *
 * Query parameters:
 *   - dateStart, dateEnd: date range filter (YYYY-MM-DD)
 *   - costMin, costMax: cost range filter
 *   - agentMin, agentMax: agent count range filter
 *   - sortBy: startTime | estimatedCost | eventCount | agentCount (default: startTime)
 *   - sortOrder: asc | desc (default: desc)
 *   - limit: max sessions to return (default: 50, max: 200)
 *   - offset: pagination offset (default: 0)
 *
 * Step: 05-02
 * Story: US-008
 */

import type { FastifyInstance } from 'fastify';
import type { StoragePort } from '@norbert/storage';
import type { SessionFilter, SortField, SortOrder } from '@norbert/core';
import { computeDailyTrends, computeBaselines } from '@norbert/core';

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

export const registerHistoryRoute = (
  app: FastifyInstance,
  storage: StoragePort
): void => {
  app.get('/api/sessions/history', async (request, reply) => {
    const query = request.query as Record<string, string>;

    // Parse filter parameters
    const dateStart = query.dateStart;
    const dateEnd = query.dateEnd;
    const costMin = parseOptionalFloat(query.costMin);
    const costMax = parseOptionalFloat(query.costMax);
    const agentMin = parseOptionalInt(query.agentMin);
    const agentMax = parseOptionalInt(query.agentMax);

    const sortBy = parseSortField(query.sortBy);
    const sortOrder = parseSortOrder(query.sortOrder);
    const limit = Math.min(Math.max(parseInt(query.limit ?? '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(query.offset ?? '0', 10) || 0, 0);

    // Build SessionFilter
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

    // Compute trends and baselines from the returned sessions
    const trends = computeDailyTrends(sessions);
    const baselines = computeBaselines([...sessions]);

    return reply.status(200).send({
      sessions,
      trends,
      baselines,
    });
  });
};
