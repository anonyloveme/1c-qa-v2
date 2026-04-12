// lib/rateLimit.js — simple in-memory rate limiter
// Note: resets on cold starts in serverless environments (Vercel).
// For global persistence, replace with Vercel KV or Redis.

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 20;      // per IP per window

const store = new Map();

function cleanup() {
  const now = Date.now();
  for (const [key, state] of store.entries()) {
    if (now > state.resetAt) store.delete(key);
  }
}

/**
 * Returns { allowed: boolean, retryAfter: number (seconds) }
 */
export function checkRateLimit(request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const now = Date.now();

  // Periodic cleanup to prevent unbounded memory growth
  if (store.size > 5000) cleanup();

  const state = store.get(ip);

  if (!state || now > state.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (state.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((state.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  state.count++;
  return { allowed: true, retryAfter: 0 };
}
