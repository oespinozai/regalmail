/**
 * Send email with attachments using the plugin's nodemailer transport.
 */
import { createTransport } from "nodemailer";
import { readFileSync } from "fs";

const transport = createTransport({
  host: "smtp.email.uk-london-1.oci.oraclecloud.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: "ocid1.user.oc1..aaaaaaaapjyc3l4dq6mkixztc2dxdvdcfcai5w44vtzae6t3jf3nx4z7acgq@ocid1.tenancy.oc1..aaaaaaaai6mnwkayqahalzsp55aoylgqjyzlgz556zbotsiyefa2wq5nvaua.vk.com",
    pass: process.env.OCI_SMTP_PASS ?? "h2Jl:Xei7!G:ds#+2UqY",
  },
});

const result = await transport.sendMail({
  from: "Amara <hello@alvento.ltd>",
  to: "oki.esib@gmail.com",
  subject: "Landing Pages — Plugin + Website",
  text: "Two landing pages attached. Open in browser to preview.\n\n1. Email plugin product page\n2. Alvento company website",
  attachments: [
    { filename: "openclaw-plugin-email-landing.html", path: "/root/openclaw-plugin-email-landing.html" },
    { filename: "alvento-website.html", path: "/root/alvento-website.html" },
  ],
});

console.log(`Sent with attachments: ${result.messageId}`);
transport.close();
