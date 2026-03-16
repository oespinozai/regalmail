/**
 * Anti-loop protection — prevents reply storms and auto-reply chains.
 */
import {
  NOREPLY_PATTERNS,
  AUTO_REPLY_HEADERS,
  type NormalizedEmail,
  type RateLimitEntry,
} from "./types.js";

const DEFAULT_RATE_LIMIT = 5; // max replies per sender per hour
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** In-memory rate limit tracker. Resets on restart (acceptable for email volume). */
const rateLimits = new Map<string, RateLimitEntry>();

/**
 * Returns a reason string if this email should NOT receive a reply, or null if safe.
 */
export function shouldSkipReply(
  email: NormalizedEmail,
  ownAddresses: string[],
  rateLimitPerHour: number = DEFAULT_RATE_LIMIT,
): string | null {
  const from = email.from.toLowerCase();

  // 1. Never reply to own addresses (prevents infinite loops)
  if (ownAddresses.some((addr) => from.includes(addr.toLowerCase()))) {
    return `own-address: ${from}`;
  }

  // 2. Never reply to noreply/mailer-daemon patterns
  for (const pattern of NOREPLY_PATTERNS) {
    if (pattern.test(from)) {
      return `noreply-pattern: ${from}`;
    }
  }

  // 3. Check auto-reply headers
  for (const [header, values] of Object.entries(AUTO_REPLY_HEADERS)) {
    const headerValue = email.headers[header]?.toLowerCase();
    if (headerValue && values.some((v) => headerValue.includes(v))) {
      return `auto-header: ${header}=${headerValue}`;
    }
  }

  // 4. Rate limiting per sender
  const now = Date.now();
  const entry = rateLimits.get(from);

  if (entry) {
    if (now - entry.windowStart > RATE_WINDOW_MS) {
      // Window expired, reset
      rateLimits.set(from, { sender: from, count: 1, windowStart: now });
    } else if (entry.count >= rateLimitPerHour) {
      return `rate-limit: ${from} (${entry.count}/${rateLimitPerHour} in window)`;
    } else {
      entry.count++;
    }
  } else {
    rateLimits.set(from, { sender: from, count: 1, windowStart: now });
  }

  return null;
}

/**
 * Periodically clean expired rate limit entries (call from monitor loop).
 */
export function cleanRateLimits(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now - entry.windowStart > RATE_WINDOW_MS) {
      rateLimits.delete(key);
    }
  }
}
