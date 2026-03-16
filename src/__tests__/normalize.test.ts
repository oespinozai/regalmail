import { describe, it, expect } from "vitest";
import { buildAgentBody } from "../monitor-normalize.js";
import type { NormalizedEmail } from "../types.js";

function makeEmail(overrides: Partial<NormalizedEmail> = {}): NormalizedEmail {
  return {
    messageId: "<abc123@mail.example.com>",
    from: "john@example.com",
    fromName: "John Smith",
    to: ["hello@alvento.ltd"],
    subject: "Website inquiry",
    textBody: "Hi, I'm interested in your SEO services. Can you tell me more?",
    date: new Date("2026-03-16T12:00:00Z"),
    headers: {},
    ...overrides,
  };
}

describe("buildAgentBody", () => {
  it("includes sender name and email", () => {
    const body = buildAgentBody(makeEmail());
    expect(body).toContain("John Smith <john@example.com>");
  });

  it("includes subject", () => {
    const body = buildAgentBody(makeEmail());
    expect(body).toContain("Subject: Website inquiry");
  });

  it("includes body text", () => {
    const body = buildAgentBody(makeEmail());
    expect(body).toContain("interested in your SEO services");
  });

  it("shows email only when no display name", () => {
    const body = buildAgentBody(makeEmail({ fromName: undefined }));
    expect(body).toContain("From: john@example.com");
    expect(body).not.toContain("<");
  });

  it("lists attachments", () => {
    const body = buildAgentBody(
      makeEmail({
        attachments: [
          { filename: "invoice.pdf", contentType: "application/pdf", size: 1024, content: Buffer.from("") },
          { filename: "photo.jpg", contentType: "image/jpeg", size: 2048, content: Buffer.from("") },
        ],
      }),
    );
    expect(body).toContain("Attachments: invoice.pdf, photo.jpg");
  });
});
