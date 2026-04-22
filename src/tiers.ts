/**
 * RegalMail tier enforcement.
 * Tracks monthly email usage and enforces mailbox/volume limits per plan.
 */
import fs from "node:fs";
import path from "node:path";

export type TierName = "free" | "pro" | "business";

interface TierLimits {
  maxMailboxes: number;
  maxEmailsPerMonth: number;
}

const TIERS: Record<TierName, TierLimits> = {
  free: { maxMailboxes: 1, maxEmailsPerMonth: 200 },
  pro: { maxMailboxes: 5, maxEmailsPerMonth: 10_000 },
  business: { maxMailboxes: 25, maxEmailsPerMonth: 50_000 },
};

interface UsageData {
  month: string; // "2026-03"
  sent: number;
}

const USAGE_FILE = path.join(
  process.env.HOME || "/tmp",
  ".regalmail-usage.json"
);

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function readUsage(): UsageData {
  try {
    const raw = fs.readFileSync(USAGE_FILE, "utf8");
    const data: UsageData = JSON.parse(raw);
    if (data.month !== currentMonth()) {
      return { month: currentMonth(), sent: 0 };
    }
    return data;
  } catch {
    return { month: currentMonth(), sent: 0 };
  }
}

function writeUsage(data: UsageData): void {
  fs.writeFileSync(USAGE_FILE, JSON.stringify(data), "utf8");
}

export function getTierLimits(tier: TierName): TierLimits {
  return TIERS[tier] ?? TIERS.free;
}

/**
 * When REGALMAIL_SELF_HOSTED=1, tier limits are bypassed entirely.
 * Intended for self-hosters running their own OpenClaw gateway where
 * the SaaS billing model does not apply.
 */
function isSelfHosted(): boolean {
  return process.env.REGALMAIL_SELF_HOSTED === "1";
}

export function validateMailboxCount(
  tier: TierName,
  mailboxCount: number
): { ok: boolean; error?: string } {
  if (isSelfHosted()) {
    return { ok: true };
  }
  const limits = getTierLimits(tier);
  if (mailboxCount > limits.maxMailboxes) {
    return {
      ok: false,
      error: `RegalMail ${tier} tier allows ${limits.maxMailboxes} mailbox${limits.maxMailboxes === 1 ? "" : "es"}, but ${mailboxCount} configured. Upgrade at https://alvento.ltd/email-plugin#pricing`,
    };
  }
  return { ok: true };
}

export function checkSendLimit(tier: TierName): {
  ok: boolean;
  remaining: number;
  error?: string;
} {
  if (isSelfHosted()) {
    return { ok: true, remaining: Number.POSITIVE_INFINITY };
  }
  const limits = getTierLimits(tier);
  const usage = readUsage();
  const remaining = limits.maxEmailsPerMonth - usage.sent;

  if (remaining <= 0) {
    return {
      ok: false,
      remaining: 0,
      error: `RegalMail ${tier} tier limit reached (${limits.maxEmailsPerMonth} emails/month). Upgrade at https://alvento.ltd/email-plugin#pricing`,
    };
  }

  return { ok: true, remaining };
}

export function recordSend(): void {
  const usage = readUsage();
  usage.sent += 1;
  writeUsage(usage);
}

export function getUsageStats(tier: TierName): {
  tier: TierName;
  sent: number;
  limit: number;
  remaining: number;
  month: string;
} {
  const limits = getTierLimits(tier);
  const usage = readUsage();
  return {
    tier,
    sent: usage.sent,
    limit: limits.maxEmailsPerMonth,
    remaining: Math.max(0, limits.maxEmailsPerMonth - usage.sent),
    month: usage.month,
  };
}
