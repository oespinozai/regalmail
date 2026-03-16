/**
 * Anti-loop protection — prevents reply storms and auto-reply chains.
 */
import { type NormalizedEmail } from "./types.js";
/**
 * Returns a reason string if this email should NOT receive a reply, or null if safe.
 */
export declare function shouldSkipReply(email: NormalizedEmail, ownAddresses: string[], rateLimitPerHour?: number): string | null;
/**
 * Periodically clean expired rate limit entries (call from monitor loop).
 */
export declare function cleanRateLimits(): void;
//# sourceMappingURL=anti-loop.d.ts.map