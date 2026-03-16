/**
 * Email account configuration resolution.
 * Handles multi-account setup where multiple email addresses share one IMAP inbox.
 */
import type { ResolvedEmailAccount } from "./types.js";
/**
 * List all configured email account IDs from the config.
 */
export declare function listEmailAccountIds(cfg: Record<string, unknown>): string[];
/**
 * Resolve a specific email account from config.
 */
export declare function resolveEmailAccount(cfg: Record<string, unknown>, accountId: string): ResolvedEmailAccount;
/**
 * Given a list of To/Cc addresses from an inbound email,
 * find which account should handle it.
 */
export declare function matchAccountByRecipient(accounts: ResolvedEmailAccount[], recipients: string[]): ResolvedEmailAccount | undefined;
//# sourceMappingURL=accounts.d.ts.map