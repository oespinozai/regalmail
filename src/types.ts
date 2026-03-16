/**
 * Email channel plugin types.
 */

/** IMAP connection config */
export type ImapConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
};

/** SMTP connection config */
export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
};

/** Resolved email account (after config parsing) */
export type ResolvedEmailAccount = {
  accountId: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  email: string;
  displayName: string;
  imap: ImapConfig;
  smtp: SmtpConfig;
  /** Which agent handles inbound for this address */
  agentBinding?: string;
  config: EmailAccountConfig;
};

/** Raw config shape from openclaw.json channels.email section */
export type EmailAccountConfig = {
  enabled?: boolean;
  email: string;
  displayName?: string;
  imapHost?: string;
  imapPort?: number;
  imapUser?: string;
  imapPass?: string | { cmd: string };
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string | { cmd: string };
  agentBinding?: string;
  dmPolicy?: "open" | "allowlist" | "pairing";
  allowFrom?: string[];
  /** Max replies per sender per hour (anti-loop) */
  rateLimitPerHour?: number;
};

/** Normalized inbound email before routing */
export type NormalizedEmail = {
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  date: Date;
  attachments?: EmailAttachment[];
  headers: Record<string, string>;
};

export type EmailAttachment = {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
};

/** Anti-loop: addresses that must never receive auto-replies */
export const NOREPLY_PATTERNS = [
  /^no-?reply@/i,
  /^mailer-daemon@/i,
  /^postmaster@/i,
  /^bounce[sd]?[+-@]/i,
  /^notifications?@/i,
  /^noreply-/i,
  /^auto-/i,
];

/** Headers that indicate an auto-generated email (never reply) */
export const AUTO_REPLY_HEADERS: Record<string, string[]> = {
  "auto-submitted": ["auto-replied", "auto-generated", "auto-notified"],
  "x-auto-response-suppress": ["all", "oof", "dr", "rn", "nrn"],
  precedence: ["bulk", "junk", "list"],
};

/** Rate limit tracker entry */
export type RateLimitEntry = {
  sender: string;
  count: number;
  windowStart: number;
};
