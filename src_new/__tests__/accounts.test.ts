import { describe, it, expect } from "vitest";
import { listEmailAccountIds, resolveEmailAccount, matchAccountByRecipient } from "../accounts.js";
import type { ResolvedEmailAccount } from "../types.js";

const MOCK_CONFIG = {
  channels: {
    email: {
      email: "hello@alvento.ltd",
      displayName: "Amara",
      imapHost: "imap.gmail.com",
      imapPort: 993,
      imapUser: "alventohope@gmail.com",
      imapPass: "testpass",
      smtpHost: "smtp.oci.example.com",
      smtpPort: 587,
      smtpUser: "oci-user",
      smtpPass: "oci-pass",
      accounts: {
        sales: {
          email: "sales@alvento.ltd",
          displayName: "Alvento Sales",
          agentBinding: "sales-agent",
        },
        support: {
          email: "support@alvento.ltd",
          displayName: "Alvento Support",
          agentBinding: "ai-receptionist",
        },
      },
    },
  },
};

describe("listEmailAccountIds", () => {
  it("lists default + named accounts", () => {
    const ids = listEmailAccountIds(MOCK_CONFIG);
    expect(ids).toContain("default");
    expect(ids).toContain("sales");
    expect(ids).toContain("support");
    expect(ids).toHaveLength(3);
  });

  it("returns empty for missing config", () => {
    expect(listEmailAccountIds({})).toEqual([]);
  });
});

describe("resolveEmailAccount", () => {
  it("resolves default account", () => {
    const account = resolveEmailAccount(MOCK_CONFIG, "default");
    expect(account.email).toBe("hello@alvento.ltd");
    expect(account.displayName).toBe("Amara");
    expect(account.configured).toBe(true);
    expect(account.imap.host).toBe("imap.gmail.com");
  });

  it("resolves named account with inherited IMAP/SMTP", () => {
    const account = resolveEmailAccount(MOCK_CONFIG, "sales");
    expect(account.email).toBe("sales@alvento.ltd");
    expect(account.displayName).toBe("Alvento Sales");
    expect(account.agentBinding).toBe("sales-agent");
    // Inherits IMAP from parent
    expect(account.imap.host).toBe("imap.gmail.com");
  });
});

describe("matchAccountByRecipient", () => {
  it("matches by To address", () => {
    const accounts = [
      resolveEmailAccount(MOCK_CONFIG, "default"),
      resolveEmailAccount(MOCK_CONFIG, "sales"),
      resolveEmailAccount(MOCK_CONFIG, "support"),
    ];

    const match = matchAccountByRecipient(accounts, ["sales@alvento.ltd"]);
    expect(match?.accountId).toBe("sales");
  });

  it("matches case-insensitively", () => {
    const accounts = [
      resolveEmailAccount(MOCK_CONFIG, "default"),
      resolveEmailAccount(MOCK_CONFIG, "sales"),
    ];

    const match = matchAccountByRecipient(accounts, ["Sales@Alvento.LTD"]);
    expect(match?.accountId).toBe("sales");
  });

  it("falls back to first enabled account", () => {
    const accounts = [
      resolveEmailAccount(MOCK_CONFIG, "default"),
      resolveEmailAccount(MOCK_CONFIG, "sales"),
    ];

    const match = matchAccountByRecipient(accounts, ["unknown@other.com"]);
    expect(match?.accountId).toBe("default");
  });
});
