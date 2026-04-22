/**
 * Health check — verify IMAP and SMTP connections work.
 */
import { ImapFlow } from "imapflow";
import type { ResolvedEmailAccount } from "./types.js";
import { verifySmtp } from "./send.js";

export type ProbeResult = {
  imap: { ok: boolean; error?: string; latencyMs: number };
  smtp: { ok: boolean; error?: string; latencyMs: number };
};

/**
 * Probe both IMAP and SMTP connections for an email account.
 */
export async function probeEmailAccount(
  account: ResolvedEmailAccount,
  timeoutMs: number = 10000,
): Promise<ProbeResult> {
  const [imapResult, smtpResult] = await Promise.all([
    probeImap(account, timeoutMs),
    probeSmtp(account, timeoutMs),
  ]);

  return { imap: imapResult, smtp: smtpResult };
}

async function probeImap(
  account: ResolvedEmailAccount,
  timeoutMs: number,
): Promise<ProbeResult["imap"]> {
  const start = Date.now();

  try {
    const client = new ImapFlow({
      host: account.imap.host,
      port: account.imap.port,
      secure: account.imap.secure,
      auth: account.imap.auth,
      logger: false,
    });

    const safeClose = () => {
      try {
        const maybe = (client as unknown as { close?: () => unknown }).close?.();
        if (maybe && typeof (maybe as Promise<unknown>).catch === "function") {
          (maybe as Promise<unknown>).catch(() => {});
        }
      } catch {
        // Benign — e.g. "Already logged out" when the session already ended.
      }
    };
    const timeout = setTimeout(safeClose, timeoutMs);

    try {
      await client.connect();
      clearTimeout(timeout);
      try {
        await client.logout();
      } catch {
        // Ignore benign logout errors (e.g. "Already logged out").
      }
      return { ok: true, latencyMs: Date.now() - start };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  }
}

async function probeSmtp(
  account: ResolvedEmailAccount,
  _timeoutMs: number,
): Promise<ProbeResult["smtp"]> {
  const start = Date.now();

  try {
    const ok = await verifySmtp(account);
    return { ok, latencyMs: Date.now() - start, ...(!ok ? { error: "SMTP verify failed" } : {}) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - start,
    };
  }
}
