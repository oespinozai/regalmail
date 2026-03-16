/**
 * Normalize raw email (from mailparser) into NormalizedEmail and then
 * into OpenClaw's NormalizedWebhookMessage-compatible format.
 */
import type { ParsedMail } from "mailparser";
import type { NormalizedEmail } from "./types.js";
/**
 * Convert a mailparser ParsedMail into our NormalizedEmail.
 */
export declare function normalizeEmail(parsed: ParsedMail): NormalizedEmail;
/**
 * Build the text body that gets sent to the agent.
 * Includes sender info, subject, and body — structured for LLM consumption.
 */
export declare function buildAgentBody(email: NormalizedEmail): string;
//# sourceMappingURL=monitor-normalize.d.ts.map