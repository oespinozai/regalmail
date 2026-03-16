import { getEmailRuntime } from "./runtime.js";
import { listEmailAccountIds, resolveEmailAccount, } from "./accounts.js";
import { sendEmailReply, sendNewEmail, closeAllTransporters } from "./send.js";
import { startEmailMonitor } from "./monitor.js";
import { buildAgentBody } from "./monitor-normalize.js";
import { probeEmailAccount } from "./probe.js";
// NOTE: ChannelPlugin type comes from openclaw/plugin-sdk.
// Since we can't import it at build time without the peer dep installed,
// the shape is documented here and validated at runtime by OpenClaw's loader.
//
// When building against the actual SDK, replace `any` with proper types:
//   import type { ChannelPlugin } from "openclaw/plugin-sdk";
const DEFAULT_ACCOUNT_ID = "default";
export const emailPlugin = {
    id: "email",
    meta: {
        displayName: "Email",
        description: "Email channel — IMAP IDLE inbound + SMTP outbound",
        icon: "📧",
        chatTypes: ["direct"],
    },
    capabilities: {
        chatTypes: ["direct"],
        media: true,
        reactions: false,
    },
    streaming: {
        // Email replies are sent as complete messages, not streamed
        blockStreamingCoalesceDefaults: { minChars: 99999, idleMs: 30000 },
    },
    reload: { configPrefixes: ["channels.email"] },
    config: {
        listAccountIds: (cfg) => listEmailAccountIds(cfg),
        resolveAccount: (cfg, accountId) => resolveEmailAccount(cfg, accountId),
        defaultAccountId: (_cfg) => DEFAULT_ACCOUNT_ID,
        setAccountEnabled: ({ cfg, accountId, enabled }) => {
            const next = structuredClone(cfg);
            if (accountId === DEFAULT_ACCOUNT_ID) {
                next.channels = next.channels ?? {};
                next.channels.email = next.channels.email ?? {};
                next.channels.email.enabled = enabled;
            }
            else {
                next.channels = next.channels ?? {};
                next.channels.email = next.channels.email ?? {};
                next.channels.email.accounts = next.channels.email.accounts ?? {};
                next.channels.email.accounts[accountId] =
                    next.channels.email.accounts[accountId] ?? {};
                next.channels.email.accounts[accountId].enabled = enabled;
            }
            return next;
        },
        deleteAccount: ({ cfg, accountId }) => {
            const next = structuredClone(cfg);
            if (next.channels?.email?.accounts?.[accountId]) {
                delete next.channels.email.accounts[accountId];
            }
            return next;
        },
        isConfigured: (account) => account.configured,
        describeAccount: (account) => ({
            accountId: account.accountId,
            name: account.name,
            enabled: account.enabled,
            configured: account.configured,
            email: account.email,
        }),
    },
    security: {
        resolveDmPolicy: ({ account }) => ({
            policy: account.config.dmPolicy ?? "open",
            allowFrom: account.config.allowFrom ?? [],
            policyPath: `channels.email.accounts.${account.accountId}.dmPolicy`,
            allowFromPath: `channels.email.accounts.${account.accountId}.`,
            normalizeEntry: (raw) => raw.toLowerCase().trim(),
        }),
    },
    messaging: {
        normalizeTarget: (target) => target.toLowerCase().trim(),
        targetResolver: {
            looksLikeId: (id) => id.includes("@"),
            hint: "<email-address>",
        },
    },
    outbound: {
        deliveryMode: "direct",
        chunker: (text, _limit) => [text], // Email doesn't need chunking
        chunkerMode: "text",
        textChunkLimit: 100000, // Emails can be long
        sendText: async ({ cfg, to, text, accountId }) => {
            const account = resolveEmailAccount(cfg, accountId ?? DEFAULT_ACCOUNT_ID);
            const result = await sendNewEmail({
                account,
                to,
                subject: "Message from " + account.displayName,
                body: text,
            });
            return { channel: "email", ...result };
        },
    },
    status: {
        collectStatusIssues: (_accounts) => [],
        buildChannelSummary: ({ snapshot }) => ({
            accountId: snapshot.accountId,
            email: snapshot.email,
            enabled: snapshot.enabled,
            configured: snapshot.configured,
            running: snapshot.running,
        }),
        probeAccount: async ({ account, timeoutMs }) => {
            return await probeEmailAccount(account, timeoutMs);
        },
        buildAccountSnapshot: ({ account, runtime, probe }) => ({
            accountId: account.accountId,
            name: account.name,
            email: account.email,
            enabled: account.enabled,
            configured: account.configured,
            running: runtime?.running ?? false,
            lastStartAt: runtime?.lastStartAt ?? null,
            lastStopAt: runtime?.lastStopAt ?? null,
            lastError: runtime?.lastError ?? null,
            probe,
            lastInboundAt: runtime?.lastInboundAt ?? null,
            lastOutboundAt: runtime?.lastOutboundAt ?? null,
        }),
    },
    gateway: {
        startAccount: async (ctx) => {
            const account = ctx.account;
            const core = getEmailRuntime();
            const cfg = ctx.cfg;
            ctx.log?.info(`[email:${account.accountId}] Starting IMAP monitor for ${account.email}`);
            // Resolve all accounts for recipient matching
            const accountIds = listEmailAccountIds(cfg);
            const allAccounts = accountIds.map((id) => resolveEmailAccount(cfg, id));
            await startEmailMonitor({
                accounts: allAccounts,
                imapAccount: account,
                abortSignal: ctx.abortSignal,
                log: ctx.log,
                onEmail: async (email, matchedAccount) => {
                    // Build the agent-facing message body
                    const agentBody = buildAgentBody(email);
                    // Build thread ID from email Message-ID chain
                    const threadId = email.inReplyTo ?? email.messageId;
                    // Resolve agent route based on matched account
                    const route = core.channel.routing.resolveAgentRoute({
                        cfg,
                        channel: "email",
                        accountId: matchedAccount.accountId,
                        peer: {
                            kind: "direct",
                            id: email.from.toLowerCase(),
                        },
                    });
                    // Finalize inbound context
                    const msgCtx = core.channel.reply.finalizeInboundContext({
                        cfg,
                        channel: "email",
                        accountId: matchedAccount.accountId,
                        route,
                        body: agentBody,
                        bodyForAgent: agentBody,
                        from: email.from,
                        fromName: email.fromName,
                        replyToId: email.inReplyTo,
                        threadId,
                        mediaUrls: [],
                    });
                    // Record session activity
                    try {
                        core.channel.session.recordInboundSession({
                            storePath: core.state.resolveStateDir(cfg),
                            sessionKey: route.sessionKey,
                            ctx: msgCtx,
                            onRecordError: (err) => {
                                ctx.log?.warn(`Session record error: ${err}`);
                            },
                        });
                    }
                    catch {
                        // Non-fatal — session recording is best-effort
                    }
                    // Dispatch reply through OpenClaw's reply pipeline
                    await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
                        ctx: msgCtx,
                        cfg,
                        dispatcherOptions: {
                            deliver: async (payload) => {
                                const replyText = typeof payload === "string"
                                    ? payload
                                    : payload?.text ?? payload?.body ?? String(payload);
                                await sendEmailReply({
                                    account: matchedAccount,
                                    inReplyTo: email,
                                    body: replyText,
                                });
                                ctx.log?.info(`[email:${matchedAccount.accountId}] Replied to ${email.from}: ${email.subject}`);
                            },
                        },
                    });
                },
            });
            // Cleanup on shutdown
            closeAllTransporters();
        },
    },
};
//# sourceMappingURL=channel.js.map