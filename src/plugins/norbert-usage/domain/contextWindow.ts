/// Context window: pure helpers mapping a model identifier to its maximum
/// context window size, and computing the current context window fill
/// percentage from a token usage record.
///
/// No side effects, no IO imports.

import type { TokenUsage } from "./types";

// ---------------------------------------------------------------------------
// Model -> max context window lookup table (tokens)
// ---------------------------------------------------------------------------

/** Ordered list of model name prefixes to their max context window size.
 *  First matching prefix wins. The trailing empty-string entry is a catch-all
 *  fallback so unknown models still produce a non-zero denominator. */
export interface ContextWindowEntry {
  readonly modelPattern: string;
  readonly maxTokens: number;
}

export const DEFAULT_CONTEXT_WINDOW_TABLE: ReadonlyArray<ContextWindowEntry> = [
  // Claude 4.x models currently ship with a 200k default window.
  // Opus 4.6 / Sonnet 4.6 both support 1M via the [1m] beta context header,
  // but we report the default unless the session explicitly surfaces the
  // larger limit, so the fuel gauge doesn't falsely show "empty" for users
  // on the default context.
  { modelPattern: "claude-opus-4-6[1m]", maxTokens: 1_000_000 },
  { modelPattern: "claude-sonnet-4-6[1m]", maxTokens: 1_000_000 },
  { modelPattern: "claude-opus-4", maxTokens: 200_000 },
  { modelPattern: "claude-sonnet-4", maxTokens: 200_000 },
  { modelPattern: "claude-haiku", maxTokens: 200_000 },
  { modelPattern: "", maxTokens: 200_000 },
];

/** Look up the max context window for a given model string.
 *  Returns the first entry whose modelPattern is a prefix of the model id,
 *  or the catch-all fallback (200k) when none match. */
export const lookupContextWindowMax = (
  model: string,
  table: ReadonlyArray<ContextWindowEntry> = DEFAULT_CONTEXT_WINDOW_TABLE,
): number => {
  for (const entry of table) {
    if (entry.modelPattern === "" || model.startsWith(entry.modelPattern)) {
      return entry.maxTokens;
    }
  }
  return 200_000;
};

// ---------------------------------------------------------------------------
// Context window sample derivation
// ---------------------------------------------------------------------------

export interface ContextWindowSample {
  readonly currentTokens: number;
  readonly maxTokens: number;
  readonly pct: number;
  readonly model: string;
}

/** Known extended context window tier for Sonnet/Opus 4.x via the
 *  `context-1m-2025-08-07` beta header. The model id reported in usage
 *  records is the same as the 200k variant, so we cannot tell from the
 *  id alone whether a request was made with the beta header enabled.
 *  Instead we promote the limit dynamically when an observed request
 *  exceeds the looked-up baseline -- the observed token count itself
 *  is the only reliable evidence that the wider window is in use. */
const EXTENDED_CONTEXT_WINDOW_TOKENS = 1_000_000;

/** Promote the looked-up baseline to the next supported tier when an
 *  observed request exceeds it. Returns the original baseline when no
 *  promotion is needed. */
const promoteWindowForObserved = (
  baselineMax: number,
  observedTokens: number,
): number => {
  if (observedTokens <= baselineMax) return baselineMax;
  if (observedTokens <= EXTENDED_CONTEXT_WINDOW_TOKENS) return EXTENDED_CONTEXT_WINDOW_TOKENS;
  // Exceeds even the 1M tier -- the data itself is the source of truth.
  // Round up to the next 100k so the gauge shows a meaningful pct rather
  // than pinning at 100% on a genuine outlier.
  return Math.ceil(observedTokens / 100_000) * 100_000;
};

/** Derive a context window sample from a single token usage record.
 *
 *  The "context window" is the cumulative input side of the request: the
 *  prompt tokens plus any cached prefix (both read and creation). This
 *  represents what Claude had to load to answer the request, which maps
 *  directly to the fuel gauge semantics.
 *
 *  Output tokens are intentionally excluded: they are generated AFTER the
 *  context is consumed and do not compete for the same budget. */
export const deriveContextWindowSample = (
  usage: TokenUsage,
  table: ReadonlyArray<ContextWindowEntry> = DEFAULT_CONTEXT_WINDOW_TABLE,
): ContextWindowSample => {
  const baselineMax = lookupContextWindowMax(usage.model, table);
  const currentTokens = usage.inputTokens + usage.cacheReadTokens + usage.cacheCreationTokens;
  const maxTokens = promoteWindowForObserved(baselineMax, currentTokens);
  const pct = maxTokens === 0 ? 0 : (currentTokens / maxTokens) * 100;
  return {
    currentTokens,
    maxTokens,
    pct: Math.min(100, Math.max(0, pct)),
    model: usage.model,
  };
};
