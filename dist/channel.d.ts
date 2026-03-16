/**
 * Email ChannelPlugin definition — the main integration point with OpenClaw.
 *
 * Follows the same pattern as Signal, Discord, BlueBubbles plugins.
 * Wires up: config, security, outbound messaging, status, and gateway (monitor).
 */
import type { ResolvedEmailAccount } from "./types.js";
export declare const emailPlugin: {
    id: string;
    meta: {
        displayName: string;
        description: string;
        icon: string;
        chatTypes: readonly ["direct"];
    };
    capabilities: {
        chatTypes: readonly ["direct"];
        media: boolean;
        reactions: boolean;
    };
    streaming: {
        blockStreamingCoalesceDefaults: {
            minChars: number;
            idleMs: number;
        };
    };
    reload: {
        configPrefixes: string[];
    };
    config: {
        listAccountIds: (cfg: any) => string[];
        resolveAccount: (cfg: any, accountId: string) => ResolvedEmailAccount;
        defaultAccountId: (_cfg: any) => string;
        setAccountEnabled: ({ cfg, accountId, enabled }: any) => any;
        deleteAccount: ({ cfg, accountId }: any) => any;
        isConfigured: (account: ResolvedEmailAccount) => boolean;
        describeAccount: (account: ResolvedEmailAccount) => {
            accountId: string;
            name: string;
            enabled: boolean;
            configured: boolean;
            email: string;
        };
    };
    security: {
        resolveDmPolicy: ({ account }: any) => {
            policy: any;
            allowFrom: any;
            policyPath: string;
            allowFromPath: string;
            normalizeEntry: (raw: string) => string;
        };
    };
    messaging: {
        normalizeTarget: (target: string) => string;
        targetResolver: {
            looksLikeId: (id: string) => boolean;
            hint: string;
        };
    };
    outbound: {
        deliveryMode: "direct";
        chunker: (text: string, _limit: number) => string[];
        chunkerMode: "text";
        textChunkLimit: number;
        sendText: ({ cfg, to, text, accountId }: any) => Promise<{
            messageId: string;
            channel: string;
        }>;
    };
    status: {
        collectStatusIssues: (_accounts: any) => never[];
        buildChannelSummary: ({ snapshot }: any) => {
            accountId: any;
            email: any;
            enabled: any;
            configured: any;
            running: any;
        };
        probeAccount: ({ account, timeoutMs }: any) => Promise<import("./probe.js").ProbeResult>;
        buildAccountSnapshot: ({ account, runtime, probe }: any) => {
            accountId: any;
            name: any;
            email: any;
            enabled: any;
            configured: any;
            running: any;
            lastStartAt: any;
            lastStopAt: any;
            lastError: any;
            probe: any;
            lastInboundAt: any;
            lastOutboundAt: any;
        };
    };
    gateway: {
        startAccount: (ctx: any) => Promise<void>;
    };
};
//# sourceMappingURL=channel.d.ts.map