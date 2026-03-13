/// Token extractor: pure function to extract token usage from raw event payloads.
///
/// (payload: unknown) => TokenExtractionResult
///
/// No side effects, no IO imports. Handles arbitrary unknown input safely.

import type { TokenExtractionResult } from "./types";

// ---------------------------------------------------------------------------
// Type guards for safe payload traversal
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === "number";

const isString = (value: unknown): value is string =>
  typeof value === "string";

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

const extractNumericField = (
  record: Record<string, unknown>,
  field: string,
  defaultValue?: number,
): number | undefined => {
  const value = record[field];
  if (isNumber(value)) return value;
  return defaultValue;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract token usage from an unknown event payload.
 *
 * Looks for payload.usage.input_tokens, payload.usage.output_tokens,
 * and payload.usage.model. Cache token fields default to 0 when absent.
 *
 * Returns { tag: 'found', usage } when all required fields present,
 * or { tag: 'absent' } otherwise. Never fabricates zero tokens from
 * missing data.
 */
export const extractTokenUsage = (payload: unknown): TokenExtractionResult => {
  if (!isRecord(payload)) return { tag: "absent" };

  const usageField = payload["usage"];
  if (!isRecord(usageField)) return { tag: "absent" };

  const inputTokens = extractNumericField(usageField, "input_tokens");
  const outputTokens = extractNumericField(usageField, "output_tokens");
  const model = usageField["model"];

  if (inputTokens === undefined || outputTokens === undefined || !isString(model)) {
    return { tag: "absent" };
  }

  const cacheReadTokens = extractNumericField(usageField, "cache_read_input_tokens", 0)!;
  const cacheCreationTokens = extractNumericField(usageField, "cache_creation_input_tokens", 0)!;

  return {
    tag: "found",
    usage: {
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      model,
    },
  };
};
