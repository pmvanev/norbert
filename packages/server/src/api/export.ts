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
import type { SessionFilter } from '@norbert/core';
import { sessionsToCsv } from '@norbert/core';
import {
  parseOptionalFloat,
  parseOptionalInt,
  parseSortField,
  parseSortOrder,
} from './query-parsing.js';

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
