/**
 * Email ChannelPlugin definition — the main integration point with OpenClaw.
 *
 * Follows the same pattern as Signal, Discord, BlueBubbles plugins.
 * Wires up: config, security, outbound messaging, status, and gateway (monitor).
 */
import type { ResolvedEmailAccount } from "./types.js";
import { getEmailRuntime } from "./runtime.js";
import {
  listEmailAccountIds,
  resolveEmailAccount,
  matchAccountByRecipient,
} from "./accounts.js";
import { sendEmailReply, sendNewEmail, closeAllTransporters, setInternalBypass } from "./send.js";
import { startEmailMonitor } from "./monitor.js";
import { buildAgentBody } from "./monitor-normalize.js";
import { probeEmailAccount } from "./probe.js";
import path from "node:path";
import os from "node:os";

// NOTE: ChannelPlugin type comes from openclaw/plugin-sdk.
// Since we can't import it at build time without the peer dep installed,
// the shape is documented here and validated at runtime by OpenClaw's loader.
//
// When building against the actual SDK, replace `any` with proper types:
//   import type { ChannelPlugin } from "openclaw/plugin-sdk";

const DEFAULT_ACCOUNT_ID = "default";

function resolveSessionStorePath(cfg: any, route: { agentId: string }, core: any) {
  const rawStore = cfg?.session?.store;
  if (typeof rawStore === "string" && rawStore.trim()) {
    const expanded = rawStore.includes("{agentId}")
      ? rawStore.replaceAll("{agentId}", route.agentId)
      : rawStore;
    if (expanded.startsWith("~")) {
      return path.resolve(path.join(os.homedir(), expanded.slice(1)));
    }
    return path.resolve(expanded);
  }
  return path.join(core.state.resolveStateDir(cfg), "agents", route.agentId, "sessions", "sessions.json");
}

export const emailPlugin = {
  id: "email",
  meta: {
    displayName: "Email",
    description: "Email channel — IMAP IDLE inbound + SMTP outbound",
    icon: "📧",
    chatTypes: ["direct"] as const,
  },

  capabilities: {
    chatTypes: ["direct"] as const,
    media: true,
    reactions: false,
  },

  streaming: {
    // Email replies are sent as complete messages, not streamed
    blockStreamingCoalesceDefaults: { minChars: 99999, idleMs: 30000 },
  },

  reload: { configPrefixes: ["channels.email"] },

  config: {
    listAccountIds: (cfg: any) => listEmailAccountIds(cfg),
    resolveAccount: (cfg: any, accountId: string) => resolveEmailAccount(cfg, accountId),
    defaultAccountId: (_cfg: any) => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, accountId, enabled }: any) => {
      const next = structuredClone(cfg);
      if (accountId === DEFAULT_ACCOUNT_ID) {
        next.channels = next.channels ?? {};
        next.channels.email = next.channels.email ?? {};
        next.channels.email.enabled = enabled;
      } else {
        next.channels = next.channels ?? {};
        next.channels.email = next.channels.email ?? {};
        next.channels.email.accounts = next.channels.email.accounts ?? {};
        next.channels.email.accounts[accountId] =
          next.channels.email.accounts[accountId] ?? {};
        next.channels.email.accounts[accountId].enabled = enabled;
      }
      return next;
    },
    deleteAccount: ({ cfg, accountId }: any) => {
      const next = structuredClone(cfg);
      if (next.channels?.email?.accounts?.[accountId]) {
        delete next.channels.email.accounts[accountId];
      }
      return next;
    },
    isConfigured: (account: ResolvedEmailAccount) => account.configured,
    describeAccount: (account: ResolvedEmailAccount) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      email: account.email,
    }),
  },

  security: {
    resolveDmPolicy: ({ account }: any) => ({
      policy: account.config.dmPolicy ?? "open",
      allowFrom: account.config.allowFrom ?? [],
      policyPath: `channels.email.accounts.${account.accountId}.dmPolicy`,
      allowFromPath: `channels.email.accounts.${account.accountId}.`,
      normalizeEntry: (raw: string) => raw.toLowerCase().trim(),
    }),
  },

  messaging: {
    normalizeTarget: (target: string) => target.toLowerCase().trim(),
    targetResolver: {
      looksLikeId: (id: string) => id.includes("@"),
      hint: "<email-address>",
    },
  },

  outbound: {
    deliveryMode: "direct" as const,
    chunker: (text: string, _limit: number) => [text], // Email doesn't need chunking
    chunkerMode: "text" as const,
    textChunkLimit: 100000, // Emails can be long

    sendText: async ({ cfg, to, text, accountId }: any) => {
      setInternalBypass(Boolean(cfg?.channels?.email?.internalBypass));
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
    collectStatusIssues: (_accounts: any) => [],
    buildChannelSummary: ({ snapshot }: any) => ({
      accountId: snapshot.accountId,
      email: snapshot.email,
      enabled: snapshot.enabled,
      configured: snapshot.configured,
      running: snapshot.running,
    }),
    probeAccount: async ({ account, timeoutMs }: any) => {
      return await probeEmailAccount(account, timeoutMs);
    },
    buildAccountSnapshot: ({ account, runtime, probe }: any) => ({
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
    startAccount: async (ctx: any) => {
      const account: ResolvedEmailAccount = ctx.account;
      const core = getEmailRuntime();
      const cfg = ctx.cfg;
      const internalBypass = Boolean(cfg?.channels?.email?.internalBypass);
      setInternalBypass(internalBypass);

      ctx.log?.info(`[email:${account.accountId}] Starting IMAP monitor for ${account.email}`);

      // Resolve all accounts for recipient matching
      const accountIds = listEmailAccountIds(cfg);
      const allAccounts = accountIds.map((id) => resolveEmailAccount(cfg, id));

      await startEmailMonitor({
        accounts: allAccounts,
        imapAccount: account,
        abortSignal: ctx.abortSignal,
        log: ctx.log,
        internalBypass,
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
              storePath: resolveSessionStorePath(cfg, route, core),
              sessionKey: route.sessionKey,
              ctx: msgCtx,
              onRecordError: (err: unknown) => {
                ctx.log?.warn(`Session record error: ${err}`);
              },
            } as any);
          } catch {
            // Non-fatal — session recording is best-effort
          }

          // Dispatch reply through OpenClaw's reply pipeline
          await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: msgCtx,
            cfg,
            dispatcherOptions: {
              deliver: async (payload: any) => {
                const replyText =
                  typeof payload === "string"
                    ? payload
                    : payload?.text ?? payload?.body ?? String(payload);

                await sendEmailReply({
                  account: matchedAccount,
                  inReplyTo: email,
                  body: replyText,
                });

                ctx.log?.info(
                  `[email:${matchedAccount.accountId}] Replied to ${email.from}: ${email.subject}`,
                );
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
