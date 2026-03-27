/**
 * Live integration test — connects to real IMAP and processes unseen emails.
 * Run with: npx tsx test-live.ts
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { normalizeEmail, buildAgentBody } from "./src/monitor-normalize.js";
import { shouldSkipReply } from "./src/anti-loop.js";
import { matchAccountByRecipient, resolveEmailAccount } from "./src/accounts.js";
import { readFileSync } from "fs";

const IMAP_HOST = "imap.gmail.com";
const IMAP_PORT = 993;
const IMAP_USER = "alventohope@gmail.com";
const IMAP_PASS = process.env.GMAIL_HOPE_APP_PASSWORD
  ?? readFileSync("/run/secrets/gmail-hope-pass", "utf8").trim();

const CONFIG = {
  channels: {
    email: {
      imapHost: IMAP_HOST,
      imapPort: IMAP_PORT,
      imapUser: IMAP_USER,
      imapPass: IMAP_PASS,
      smtpHost: "smtp.email.uk-london-1.oci.oraclecloud.com",
      smtpPort: 587,
      accounts: {
        hello: { email: "hello@alvento.ltd", displayName: "Helena Lopez" },
        sales: { email: "sales@alvento.ltd", displayName: "Sabrina Ellis" },
        support: { email: "support@alvento.ltd", displayName: "Susan Powers" },
        hope: { email: "hope@alvento.ltd", displayName: "Hope" },
        billing: { email: "billing@alvento.ltd", displayName: "Fiona Nash" },
        accounts: { email: "accounts@alvento.ltd", displayName: "Fiona Nash" },
        mkt: { email: "mkt@alvento.ltd", displayName: "Mara Kent" },
      },
    },
  },
};

const OWN_ADDRESSES = [
  "hello@alvento.ltd",
  "sales@alvento.ltd",
  "support@alvento.ltd",
  "hope@alvento.ltd",
  "billing@alvento.ltd",
  "accounts@alvento.ltd",
  "mkt@alvento.ltd",
];

async function main() {
  console.log("Connecting to IMAP...");

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false,
  });

  await client.connect();
  console.log("Connected!");

  const lock = await client.getMailboxLock("INBOX");

  try {
    // Get last 5 emails (not just unseen, for testing)
    const messages = await client.search({ all: true }, { uid: true });
    const recent = messages.slice(-5);

    console.log(`\nProcessing last ${recent.length} emails:\n`);

    for (const uid of recent) {
      const download = await client.download(String(uid), undefined, { uid: true });
      if (!download?.content) continue;

      const chunks: Buffer[] = [];
      for await (const chunk of download.content) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const parsed = await simpleParser(Buffer.concat(chunks));
      const email = normalizeEmail(parsed);

      // Match account
      const accountIds = Object.keys(CONFIG.channels.email.accounts);
      const accounts = accountIds.map((id) => resolveEmailAccount(CONFIG, id));
      const allRecipients = [...email.to, ...(email.cc ?? [])];
      const matched = matchAccountByRecipient(accounts, allRecipients);

      // Anti-loop check
      const skip = shouldSkipReply(email, OWN_ADDRESSES);

      console.log(`--- Email UID ${uid} ---`);
      console.log(`From: ${email.fromName ?? ""} <${email.from}>`);
      console.log(`To: ${email.to.join(", ")}`);
      console.log(`Subject: ${email.subject}`);
      console.log(`Date: ${email.date.toISOString()}`);
      console.log(`Matched account: ${matched?.accountId ?? "none"} (${matched?.email ?? ""})`);
      console.log(`Skip reply: ${skip ?? "no (safe to reply)"}`);
      console.log(`Agent body preview: ${buildAgentBody(email).slice(0, 200)}...`);
      console.log();
    }
  } finally {
    lock.release();
    await client.logout();
  }

  console.log("Done.");
}

main().catch(console.error);
