// src/lib/rate-limit.ts — In-memory rate limiter

interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Creates an in-memory rate limiter.
 * Can be upgraded to Redis/Upstash for multi-instance deployments.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, maxRequests } = options;
  const store = new Map<string, RateLimitEntry>();

  // Clean up expired entries every 60 seconds
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, 60_000);

  // Prevent the interval from keeping the process alive
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return {
    /**
     * Check if a request from the given identifier is allowed.
     * @param identifier - IP address, username, or other unique key
     */
    check(identifier: string): RateLimitResult {
      const now = Date.now();
      let entry = store.get(identifier);

      // Reset if window has expired
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        store.set(identifier, entry);
      }

      entry.count++;

      const allowed = entry.count <= maxRequests;
      const remaining = Math.max(0, maxRequests - entry.count);

      return {
        allowed,
        remaining,
        resetAt: new Date(entry.resetAt),
      };
    },

    /**
     * Reset the rate limit for a specific identifier.
     */
    reset(identifier: string): void {
      store.delete(identifier);
    },
  };
}

/**
 * Extract a client identifier from a request for rate limiting.
 * Uses X-Forwarded-For header (for proxied environments) or falls back
 * to a generic key when IP is unavailable.
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the first IP in the chain (original client)
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  // Fallback — in development or when behind certain proxies
  return "unknown-client";
}
