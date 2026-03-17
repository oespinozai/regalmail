/**
 * Send email using the plugin's own SMTP sender.
 * Usage: GMAIL_HOPE_APP_PASSWORD="..." npx tsx send-test.ts
 */
import { readFileSync } from "fs";
import { sendNewEmail } from "./src/send.js";
import type { ResolvedEmailAccount } from "./src/types.js";

const account: ResolvedEmailAccount = {
  accountId: "hello",
  name: "Amara",
  enabled: true,
  configured: true,
  email: "hello@alvento.ltd",
  displayName: "Amara",
  imap: { host: "imap.gmail.com", port: 993, secure: true, auth: { user: "", pass: "" } },
  smtp: {
    host: "smtp.email.uk-london-1.oci.oraclecloud.com",
    port: 587,
    secure: false,
    auth: {
      user: "ocid1.user.oc1..aaaaaaaapjyc3l4dq6mkixztc2dxdvdcfcai5w44vtzae6t3jf3nx4z7acgq@ocid1.tenancy.oc1..aaaaaaaai6mnwkayqahalzsp55aoylgqjyzlgz556zbotsiyefa2wq5nvaua.vk.com",
      pass: process.env.OCI_SMTP_PASS ?? "h2Jl:Xei7!G:ds#+2UqY",
    },
  },
  config: { email: "hello@alvento.ltd" },
};

const to = process.argv[2] ?? "oki.esib@gmail.com";
const subject = process.argv[3] ?? "Test from openclaw-plugin-email";
const body = process.argv[4] ?? "Sent via the email plugin's own SMTP sender — not himalaya.";

sendNewEmail({ account, to, subject, body })
  .then((r) => console.log(`Sent: ${r.messageId}`))
  .catch(console.error);
