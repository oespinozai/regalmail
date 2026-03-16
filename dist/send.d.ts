import type { ResolvedEmailAccount, NormalizedEmail } from "./types.js";
export type SendReplyOptions = {
    account: ResolvedEmailAccount;
    /** The original inbound email (for threading) */
    inReplyTo: NormalizedEmail;
    /** The reply body text */
    body: string;
    /** Optional subject override (defaults to Re: original subject) */
    subject?: string;
};
/**
 * Send a reply to an inbound email with proper threading headers.
 */
export declare function sendEmailReply(options: SendReplyOptions): Promise<{
    messageId: string;
}>;
export type SendNewEmailOptions = {
    account: ResolvedEmailAccount;
    to: string;
    subject: string;
    body: string;
    html?: string;
};
/**
 * Send a new (non-reply) email.
 */
export declare function sendNewEmail(options: SendNewEmailOptions): Promise<{
    messageId: string;
}>;
/**
 * Verify SMTP connection works.
 */
export declare function verifySmtp(account: ResolvedEmailAccount): Promise<boolean>;
/**
 * Close all cached transporter connections.
 */
export declare function closeAllTransporters(): void;
//# sourceMappingURL=send.d.ts.map