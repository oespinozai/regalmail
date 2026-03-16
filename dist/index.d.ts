/**
 * OpenClaw Email Channel Plugin
 *
 * Adds email as a first-class channel alongside Signal, Discord, Telegram, etc.
 * Uses IMAP IDLE for real-time inbound + SMTP for outbound.
 *
 * @example
 * // In openclaw.json:
 * {
 *   "channels": {
 *     "email": {
 *       "enabled": true,
 *       "accounts": {
 *         "sales": {
 *           "email": "sales@alvento.ltd",
 *           "displayName": "Alvento Sales",
 *           "imapHost": "imap.gmail.com",
 *           "imapPort": 993,
 *           "imapUser": "alventohope@gmail.com",
 *           "imapPass": { "cmd": "cat /run/secrets/gmail-hope-pass" },
 *           "smtpHost": "smtp.email.uk-london-1.oci.oraclecloud.com",
 *           "smtpPort": 587,
 *           "smtpUser": "...",
 *           "smtpPass": { "cmd": "cat /run/secrets/oci-smtp-pass" },
 *           "agentBinding": "sales-agent"
 *         }
 *       }
 *     }
 *   }
 * }
 */
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
declare const plugin: {
    id: string;
    name: string;
    description: string;
    register(api: OpenClawPluginApi): void;
};
export default plugin;
export type { ResolvedEmailAccount, EmailAccountConfig, NormalizedEmail } from "./types.js";
export { sendEmailReply, sendNewEmail } from "./send.js";
export { probeEmailAccount } from "./probe.js";
//# sourceMappingURL=index.d.ts.map