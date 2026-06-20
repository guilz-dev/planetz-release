/** Fallback when provider/model limits are unknown (processing design §5.2.1). */
export const CONVERSATION_CONTEXT_MAX_INPUT_TOKENS_FALLBACK = 32_000

/** Soft-limit ratio applied to `maxInputTokens` (processing design §5.2.1). */
export const CONVERSATION_CONTEXT_SOFT_LIMIT_RATIO = 0.85

/** Recent assistant turns kept verbatim during compaction (processing design §5.2.2). */
export const CONTEXT_COMPACTOR_RECENT_TURNS_KEEP = 8

/** Debounced remote history search interval (PLAN23 G1). */
export const CHAT_HISTORY_SEARCH_DEBOUNCE_MS = 300

/** Minimum query length before calling `conversationHistory:search`. */
export const CHAT_HISTORY_REMOTE_SEARCH_MIN_CHARS = 2

/** Fallback title length from first user message when LLM title fails (PLAN23 G3). */
export const CONVERSATION_TITLE_FALLBACK_MAX_CHARS = 40

/** Max characters kept when summarizing older assistant turns (processing design §5.2.2). */
export const CONTEXT_COMPACTOR_SUMMARY_SNIPPET_MAX_CHARS = 400

/** Virtual transcript: stick to bottom when within this distance (px) from the end (PLAN23 G2). */
export const CHAT_TRANSCRIPT_NEAR_END_PX = 120

/** Turn count at which the chat transcript enables virtual scrolling (PLAN23 G2). */
export const CHAT_TRANSCRIPT_VIRTUALIZE_MIN_TURNS = 50
