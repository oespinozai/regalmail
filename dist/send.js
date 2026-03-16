/**
 * SMTP outbound — send email replies via nodemailer.
 * Handles proper threading headers (In-Reply-To, References).
 */
import { createTransport } from "nodemailer";
/** Cache transporter instances per account to reuse connections */
const transporters = new Map();
function getTransporter(account) {
    const key = `${account.smtp.host}:${account.smtp.port}:${account.smtp.auth.user}`;
    let transport = transporters.get(key);
    if (!transport) {
        transport = createTransport({
            host: account.smtp.host,
            port: account.smtp.port,
            secure: account.smtp.secure,
            auth: {
                user: account.smtp.auth.user,
                pass: account.smtp.auth.pass,
            },
            // STARTTLS for port 587
            ...(account.smtp.port === 587 ? { requireTLS: true } : {}),
        });
        transporters.set(key, transport);
    }
    return transport;
}
/**
 * Send a reply to an inbound email with proper threading headers.
 */
export async function sendEmailReply(options) {
    const { account, inReplyTo, body, subject } = options;
    const transport = getTransporter(account);
    // Build References header: append original messageId to existing chain
    const references = [
        ...(inReplyTo.references ?? []),
        inReplyTo.messageId,
    ].filter(Boolean);
    // Build subject with Re: prefix if not already present
    const replySubject = subject ??
        (inReplyTo.subject.startsWith("Re:") ? inReplyTo.subject : `Re: ${inReplyTo.subject}`);
    const result = await transport.sendMail({
        from: `${account.displayName} <${account.email}>`,
        to: inReplyTo.from,
        subject: replySubject,
        text: body,
        headers: {
            "In-Reply-To": inReplyTo.messageId,
            References: references.join(" "),
        },
    });
    return { messageId: result.messageId };
}
/**
 * Send a new (non-reply) email.
 */
export async function sendNewEmail(options) {
    const { account, to, subject, body, html } = options;
    const transport = getTransporter(account);
    const result = await transport.sendMail({
        from: `${account.displayName} <${account.email}>`,
        to,
        subject,
        text: body,
        ...(html ? { html } : {}),
    });
    return { messageId: result.messageId };
}
/**
 * Verify SMTP connection works.
 */
export async function verifySmtp(account) {
    try {
        const transport = getTransporter(account);
        await transport.verify();
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Close all cached transporter connections.
 */
export function closeAllTransporters() {
    for (const transport of transporters.values()) {
        transport.close();
    }
    transporters.clear();
}
//# sourceMappingURL=send.js.map