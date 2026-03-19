import { describe, it, expect, beforeEach } from "vitest";
import { shouldSkipReply } from "../anti-loop.js";
import type { NormalizedEmail } from "../types.js";

function makeEmail(overrides: Partial<NormalizedEmail> = {}): NormalizedEmail {
  return {
    messageId: "<test@example.com>",
    from: "customer@example.com",
    to: ["hello@alvento.ltd"],
    subject: "Test",
    textBody: "Hello",
    date: new Date(),
    headers: {},
    ...overrides,
  };
}

const OWN_ADDRESSES = ["hello@alvento.ltd", "sales@alvento.ltd", "support@alvento.ltd"];

describe("shouldSkipReply", () => {
  it("returns null for normal emails", () => {
    const email = makeEmail();
    expect(shouldSkipReply(email, OWN_ADDRESSES)).toBeNull();
  });

  it("skips own addresses", () => {
    const email = makeEmail({ from: "hello@alvento.ltd" });
    const result = shouldSkipReply(email, OWN_ADDRESSES);
    expect(result).toContain("own-address");
  });

  it("skips noreply addresses", () => {
    const patterns = [
      "noreply@google.com",
      "no-reply@github.com",
      "mailer-daemon@mail.example.com",
      "postmaster@example.com",
      "bounces+foo@mail.example.com",
    ];

    for (const from of patterns) {
      const email = makeEmail({ from });
      const result = shouldSkipReply(email, OWN_ADDRESSES);
      expect(result, `should skip ${from}`).toContain("noreply-pattern");
    }
  });

  it("skips auto-submitted emails", () => {
    const email = makeEmail({
      headers: { "auto-submitted": "auto-replied" },
    });
    expect(shouldSkipReply(email, OWN_ADDRESSES)).toContain("auto-header");
  });

  it("skips bulk precedence", () => {
    const email = makeEmail({
      headers: { precedence: "bulk" },
    });
    expect(shouldSkipReply(email, OWN_ADDRESSES)).toContain("auto-header");
  });

  it("skips x-auto-response-suppress", () => {
    const email = makeEmail({
      headers: { "x-auto-response-suppress": "All" },
    });
    expect(shouldSkipReply(email, OWN_ADDRESSES)).toContain("auto-header");
  });

  it("rate-limits after threshold", () => {
    const email = makeEmail({ from: "spammer@example.com" });

    // First 5 should pass
    for (let i = 0; i < 5; i++) {
      expect(shouldSkipReply(email, OWN_ADDRESSES, 5)).toBeNull();
    }

    // 6th should be rate-limited
    expect(shouldSkipReply(email, OWN_ADDRESSES, 5)).toContain("rate-limit");
  });

  it("allows normal senders through", () => {
    const email = makeEmail({ from: "real-customer@bigcorp.co.uk" });
    expect(shouldSkipReply(email, OWN_ADDRESSES)).toBeNull();
  });
});
