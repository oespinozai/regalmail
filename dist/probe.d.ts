import type { ResolvedEmailAccount } from "./types.js";
export type ProbeResult = {
    imap: {
        ok: boolean;
        error?: string;
        latencyMs: number;
    };
    smtp: {
        ok: boolean;
        error?: string;
        latencyMs: number;
    };
};
/**
 * Probe both IMAP and SMTP connections for an email account.
 */
export declare function probeEmailAccount(account: ResolvedEmailAccount, timeoutMs?: number): Promise<ProbeResult>;
//# sourceMappingURL=probe.d.ts.map