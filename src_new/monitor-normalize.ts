/**
 * Normalize raw email (from mailparser) into NormalizedEmail and then
 * into OpenClaw's NormalizedWebhookMessage-compatible format.
 */
import type { ParsedMail, AddressObject } from "mailparser";
import type { NormalizedEmail } from "./types.js";

/** Extract email addresses from mailparser AddressObject */
function extractAddresses(addr: AddressObject | AddressObject[] | undefined): string[] {
  if (!addr) return [];
  const list = Array.isArray(addr) ? addr : [addr];
  return list.flatMap((a) => a.value.map((v: { address?: string }) => v.address ?? "")).filter(Boolean);
}

/** Extract display name from first address */
function extractName(addr: AddressObject | AddressObject[] | undefined): string | undefined {
  if (!addr) return undefined;
  const list = Array.isArray(addr) ? addr : [addr];
  return list[0]?.value[0]?.name || undefined;
}

/** Convert parsed email headers to a flat string map */
function flattenHeaders(headers: Map<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of headers) {
    if (value instanceof Date) {
      result[key.toLowerCase()] = value.toISOString();
    } else if (Array.isArray(value)) {
      result[key.toLowerCase()] = value.map(String).join(", ");
    } else if (typeof value === "object" && value !== null) {
      result[key.toLowerCase()] = JSON.stringify(value);
    } else {
      result[key.toLowerCase()] = String(value ?? "");
    }
  }
  return result;
}

/**
 * Convert a mailparser ParsedMail into our NormalizedEmail.
 */
export function normalizeEmail(parsed: ParsedMail): NormalizedEmail {
  const from = extractAddresses(parsed.from)?.[0] ?? "";
  const fromName = extractName(parsed.from);
  const to = extractAddresses(parsed.to);
  const cc = extractAddresses(parsed.cc);
  const messageId = parsed.messageId ?? `unknown-${Date.now()}`;
  const inReplyTo = parsed.inReplyTo;
  const references = parsed.references
    ? Array.isArray(parsed.references)
      ? parsed.references
      : [parsed.references]
    : undefined;

  // Prefer text body; fall back to stripping HTML
  let textBody = parsed.text ?? "";
  if (!textBody && parsed.html) {
    // Basic HTML stripping — good enough for agent context
    textBody = parsed.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const attachments = (parsed.attachments ?? []).map((att: { filename?: string; contentType: string; size: number; content: Buffer }) => ({
    filename: att.filename ?? "attachment",
    contentType: att.contentType,
    size: att.size,
    content: att.content,
  }));

  return {
    messageId,
    inReplyTo,
    references,
    from,
    fromName,
    to,
    cc,
    subject: parsed.subject ?? "(no subject)",
    textBody,
    htmlBody: parsed.html || undefined,
    date: parsed.date ?? new Date(),
    attachments: attachments.length > 0 ? attachments : undefined,
    headers: flattenHeaders(parsed.headers),
  };
}

/**
 * Build the text body that gets sent to the agent.
 * Includes sender info, subject, and body — structured for LLM consumption.
 */
export function buildAgentBody(email: NormalizedEmail): string {
  const parts: string[] = [];

  const senderLabel = email.fromName
    ? `${email.fromName} <${email.from}>`
    : email.from;

  parts.push(`From: ${senderLabel}`);
  parts.push(`Subject: ${email.subject}`);

  if (email.attachments && email.attachments.length > 0) {
    const names = email.attachments.map((a) => a.filename).join(", ");
    parts.push(`Attachments: ${names}`);
  }

  parts.push("");
  parts.push(email.textBody);

  return parts.join("\n");
}
