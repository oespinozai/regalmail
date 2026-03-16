import type { ResolvedEmailAccount, NormalizedEmail } from "./types.js";
export type EmailMonitorOptions = {
    /** All resolved email accounts (for recipient matching) */
    accounts: ResolvedEmailAccount[];
    /** Primary IMAP account (shared inbox) */
    imapAccount: ResolvedEmailAccount;
    /** Abort signal for graceful shutdown */
    abortSignal?: AbortSignal;
    /** Called when a new email arrives and passes anti-loop checks */
    onEmail: (email: NormalizedEmail, matchedAccount: ResolvedEmailAccount) => Promise<void>;
    /** Optional logger */
    log?: {
        info: (msg: string) => void;
        warn: (msg: string) => void;
        error: (msg: string) => void;
        debug?: (msg: string) => void;
    };
};
/**
 * Start the IMAP IDLE monitor. Runs until abortSignal fires.
 * Reconnects automatically on connection loss.
 */
export declare function startEmailMonitor(options: EmailMonitorOptions): Promise<void>;
//# sourceMappingURL=monitor.d.ts.map