/**
 * IMAP IDLE monitor — persistent connection that reacts to new emails in real-time.
 *
 * Uses imapflow for IMAP IDLE support. Reconnects with exponential backoff.
 * Renews IDLE every 10 minutes to prevent server timeouts.
 *
 * This is the core inbound loop, equivalent to Signal's monitorSignalProvider.
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { ResolvedEmailAccount, NormalizedEmail } from "./types.js";
import { normalizeEmail, buildAgentBody } from "./monitor-normalize.js";
import { shouldSkipReply, cleanRateLimits } from "./anti-loop.js";
import { matchAccountByRecipient } from "./accounts.js";
import { validateMailboxCount, type TierName } from "./tiers.js";

const IDLE_RENEW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_CLEAN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export type EmailMonitorOptions = {
  /** All resolved email accounts (for recipient matching) */
  accounts: ResolvedEmailAccount[];
  /** Primary IMAP account (shared inbox) */
  imapAccount: ResolvedEmailAccount;
  /** Abort signal for graceful shutdown */
  abortSignal?: AbortSignal;
  /** RegalMail tier for enforcing mailbox limits */
  tier?: TierName;
  /** Internal deployment bypass for private first-party use */
  internalBypass?: boolean;
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
export async function startEmailMonitor(options: EmailMonitorOptions): Promise<void> {
  const { accounts, imapAccount, abortSignal, onEmail, log, tier = "free", internalBypass = false } = options;

  // Enforce mailbox limit
  if (!internalBypass) {
    const mailboxCheck = validateMailboxCount(tier, accounts.length);
    if (!mailboxCheck.ok) {
      throw new Error(mailboxCheck.error);
    }
  }

  // Collect all own addresses for anti-loop protection
  const ownAddresses = accounts.map((a) => a.email);

  let backoffMs = 1000;
  let rateLimitCleanTimer: ReturnType<typeof setInterval> | undefined;

  // Periodic rate limit cleanup
  rateLimitCleanTimer = setInterval(() => cleanRateLimits(), RATE_LIMIT_CLEAN_INTERVAL_MS);

  const cleanup = () => {
    if (rateLimitCleanTimer) {
      clearInterval(rateLimitCleanTimer);
      rateLimitCleanTimer = undefined;
    }
  };

  if (abortSignal) {
    abortSignal.addEventListener("abort", cleanup, { once: true });
  }

  while (!abortSignal?.aborted) {
    try {
      await runIdleLoop(imapAccount, accounts, ownAddresses, abortSignal, onEmail, log);
      // If we exit cleanly (abort), break
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log?.warn(`IMAP connection lost: ${msg}. Reconnecting in ${backoffMs / 1000}s...`);

      // Exponential backoff
      await sleep(backoffMs, abortSignal);
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    }
  }

  cleanup();
  log?.info("Email monitor stopped.");
}

async function runIdleLoop(
  imapAccount: ResolvedEmailAccount,
  accounts: ResolvedEmailAccount[],
  ownAddresses: string[],
  abortSignal: AbortSignal | undefined,
  onEmail: EmailMonitorOptions["onEmail"],
  log: EmailMonitorOptions["log"],
): Promise<void> {
  const client = new ImapFlow({
    host: imapAccount.imap.host,
    port: imapAccount.imap.port,
    secure: imapAccount.imap.secure,
    auth: imapAccount.imap.auth,
    logger: false, // Suppress imapflow's verbose logging
  });

  try {
    await client.connect();
    log?.info(`Connected to IMAP: ${imapAccount.imap.host}:${imapAccount.imap.port}`);

    // Reset backoff on successful connection
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Process any unseen emails on startup
      await processUnseen(client, accounts, ownAddresses, onEmail, log);

      // Enter IDLE loop
      while (!abortSignal?.aborted) {
        log?.debug?.("Entering IDLE...");

        // Wait for new mail or IDLE renewal timeout
        const idlePromise = client.idle();
        const timeoutPromise = sleep(IDLE_RENEW_MS, abortSignal);

        await Promise.race([idlePromise, timeoutPromise]);

        if (abortSignal?.aborted) break;

        // Check for new unseen messages
        await processUnseen(client, accounts, ownAddresses, onEmail, log);
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

/**
 * Fetch and process all unseen emails in INBOX.
 */
async function processUnseen(
  client: ImapFlow,
  accounts: ResolvedEmailAccount[],
  ownAddresses: string[],
  onEmail: EmailMonitorOptions["onEmail"],
  log: EmailMonitorOptions["log"],
): Promise<void> {
  // Search for unseen messages
  const uids = await client.search({ seen: false }, { uid: true });

  if (!uids || uids.length === 0) return;

  log?.info(`Found ${uids.length} unseen email(s)`);

  for (const uid of uids) {
    try {
      // Fetch full message source
      const download = await client.download(String(uid), undefined, { uid: true });
      if (!download?.content) continue;

      // Collect the stream into a buffer
      const chunks: Buffer[] = [];
      for await (const chunk of download.content) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const source = Buffer.concat(chunks);

      // Parse with mailparser
      const parsed = await simpleParser(source);
      const email = normalizeEmail(parsed);

      // Match to an account by recipient
      const allRecipients = [...email.to, ...(email.cc ?? [])];
      const matchedAccount = matchAccountByRecipient(accounts, allRecipients);

      if (!matchedAccount) {
        log?.debug?.(`No matching account for recipients: ${allRecipients.join(", ")}`);
        // Mark as seen so we don't re-process
        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        continue;
      }

      // Anti-loop checks
      const skipReason = shouldSkipReply(
        email,
        ownAddresses,
        matchedAccount.config.rateLimitPerHour,
      );

      if (skipReason) {
        log?.info(`Skipping reply to ${email.from}: ${skipReason}`);
        await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        continue;
      }

      // Mark as seen before processing (prevents duplicate processing)
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });

      // Dispatch to handler
      log?.info(`Processing email from ${email.from} → ${matchedAccount.email} (${matchedAccount.accountId})`);
      await onEmail(email, matchedAccount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log?.error(`Error processing email UID ${uid}: ${msg}`);
    }
  }
}

function sleep(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    abortSignal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
