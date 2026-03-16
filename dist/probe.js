/**
 * Health check — verify IMAP and SMTP connections work.
 */
import { ImapFlow } from "imapflow";
import { verifySmtp } from "./send.js";
/**
 * Probe both IMAP and SMTP connections for an email account.
 */
export async function probeEmailAccount(account, timeoutMs = 10000) {
    const [imapResult, smtpResult] = await Promise.all([
        probeImap(account, timeoutMs),
        probeSmtp(account, timeoutMs),
    ]);
    return { imap: imapResult, smtp: smtpResult };
}
async function probeImap(account, timeoutMs) {
    const start = Date.now();
    try {
        const client = new ImapFlow({
            host: account.imap.host,
            port: account.imap.port,
            secure: account.imap.secure,
            auth: account.imap.auth,
            logger: false,
        });
        const timeout = setTimeout(() => client.close(), timeoutMs);
        try {
            await client.connect();
            clearTimeout(timeout);
            await client.logout();
            return { ok: true, latencyMs: Date.now() - start };
        }
        finally {
            clearTimeout(timeout);
        }
    }
    catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            latencyMs: Date.now() - start,
        };
    }
}
async function probeSmtp(account, _timeoutMs) {
    const start = Date.now();
    try {
        const ok = await verifySmtp(account);
        return { ok, latencyMs: Date.now() - start, ...(!ok ? { error: "SMTP verify failed" } : {}) };
    }
    catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            latencyMs: Date.now() - start,
        };
    }
}
//# sourceMappingURL=probe.js.map