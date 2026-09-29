/** Default for all routes, applied globally in AppModule. */
export const DEFAULT_RATE_LIMIT = { limit: 120, ttl: 60_000 };

/** Endpoints that call an LLM: each request can cost money and tie up the provider. */
export const AI_RATE_LIMIT = { default: { limit: 10, ttl: 60_000 } };

/** Login/registration: slows password guessing against a single account. */
export const AUTH_RATE_LIMIT = { default: { limit: 10, ttl: 60_000 } };
