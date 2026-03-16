const DEFAULT_ACCOUNT_ID = "default";
const DEFAULT_IMAP_PORT = 993;
const DEFAULT_SMTP_PORT = 587;
/**
 * Resolve a password field that may be a string or a { cmd: "..." } object.
 * In production, cmd passwords are resolved by OpenClaw's config loader.
 * Here we handle the already-resolved string case.
 */
function resolvePassword(pass) {
    if (!pass)
        return "";
    if (typeof pass === "string")
        return pass;
    // cmd-based passwords should be resolved by the config loader before reaching here
    return "";
}
/**
 * List all configured email account IDs from the config.
 */
export function listEmailAccountIds(cfg) {
    const emailCfg = cfg?.channels?.email;
    if (!emailCfg)
        return [];
    const ids = [];
    // Check for top-level (default) account
    if (emailCfg.email) {
        ids.push(DEFAULT_ACCOUNT_ID);
    }
    // Check named accounts
    const accounts = emailCfg.accounts;
    if (accounts && typeof accounts === "object") {
        ids.push(...Object.keys(accounts));
    }
    return ids;
}
/**
 * Resolve a specific email account from config.
 */
export function resolveEmailAccount(cfg, accountId) {
    const emailCfg = cfg?.channels?.email;
    const defaults = emailCfg ?? {};
    // Get account-specific config (or top-level for default)
    const accountCfg = accountId === DEFAULT_ACCOUNT_ID
        ? defaults
        : { ...defaults, ...(emailCfg?.accounts?.[accountId] ?? {}) };
    const email = accountCfg.email ?? "";
    const displayName = accountCfg.displayName ?? email.split("@")[0] ?? "";
    return {
        accountId,
        name: accountCfg.displayName ?? accountId,
        enabled: accountCfg.enabled !== false,
        configured: Boolean(email && accountCfg.imapHost && accountCfg.smtpHost),
        email,
        displayName,
        imap: {
            host: accountCfg.imapHost ?? "imap.gmail.com",
            port: accountCfg.imapPort ?? DEFAULT_IMAP_PORT,
            secure: (accountCfg.imapPort ?? DEFAULT_IMAP_PORT) === 993,
            auth: {
                user: accountCfg.imapUser ?? email,
                pass: resolvePassword(accountCfg.imapPass),
            },
        },
        smtp: {
            host: accountCfg.smtpHost ?? "",
            port: accountCfg.smtpPort ?? DEFAULT_SMTP_PORT,
            secure: false, // STARTTLS
            auth: {
                user: accountCfg.smtpUser ?? "",
                pass: resolvePassword(accountCfg.smtpPass),
            },
        },
        agentBinding: accountCfg.agentBinding,
        config: accountCfg,
    };
}
/**
 * Given a list of To/Cc addresses from an inbound email,
 * find which account should handle it.
 */
export function matchAccountByRecipient(accounts, recipients) {
    const recipientSet = new Set(recipients.map((r) => r.toLowerCase()));
    for (const account of accounts) {
        if (recipientSet.has(account.email.toLowerCase())) {
            return account;
        }
    }
    // Fallback: return first enabled account (default)
    return accounts.find((a) => a.enabled);
}
//# sourceMappingURL=accounts.js.map