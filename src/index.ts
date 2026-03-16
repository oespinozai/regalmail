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
import { emailPlugin } from "./channel.js";
import { setEmailRuntime } from "./runtime.js";

const plugin = {
  id: "email",
  name: "Email",
  description:
    "Email channel plugin — IMAP IDLE inbound routing + SMTP outbound with thread awareness and anti-loop protection",
  register(api: OpenClawPluginApi) {
    setEmailRuntime(api.runtime);
    api.registerChannel({ plugin: emailPlugin as any });
  },
};

export default plugin;

// Re-export types for consumers
export type { ResolvedEmailAccount, EmailAccountConfig, NormalizedEmail } from "./types.js";
export { sendEmailReply, sendNewEmail } from "./send.js";
export { probeEmailAccount } from "./probe.js";
