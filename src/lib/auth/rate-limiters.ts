// src/lib/auth/rate-limiters.ts — Pre-configured rate limiters

import { createRateLimiter } from "@/lib/rate-limit";

/** Login: 5 attempts per 15 minutes */
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
});

/** Registration: 3 attempts per hour */
export const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 3,
});

/** General API: 100 requests per minute */
export const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
});

/** Import operations: 5 per hour */
export const importLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
});
