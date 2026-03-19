# RegalMail

**Email for AI agents.** IMAP IDLE inbound, SMTP outbound, thread-aware, anti-loop protected.

Give your AI agents a real email inbox. They receive emails in real-time via IMAP IDLE, understand the full thread context, and reply via SMTP with proper threading headers. Works with any email provider — Gmail, Outlook, OCI, Fastmail, self-hosted.

## Install

```bash
npm install regalmail
```

Requires OpenClaw `>=2026.2.0` as a peer dependency.

## Quick Start

Add to your `openclaw.json`:

```json
{
  "channels": {
    "email": {
      "tier": "free",
      "accounts": {
        "sales": {
          "email": "sales@yourcompany.com",
          "displayName": "Your Company Sales",
          "imapHost": "imap.gmail.com",
          "imapPort": 993,
          "imapUser": "you@gmail.com",
          "imapPass": { "cmd": "cat /run/secrets/gmail-app-pass" },
          "smtpHost": "smtp.gmail.com",
          "smtpPort": 587,
          "smtpUser": "you@gmail.com",
          "smtpPass": { "cmd": "cat /run/secrets/gmail-app-pass" },
          "agentBinding": "sales-agent"
        }
      }
    }
  }
}
```

## Features

- **IMAP IDLE** — real-time email detection, no polling. Persistent connection with auto-reconnect and exponential backoff
- **Thread awareness** — correct In-Reply-To and References headers, threads render properly in all email clients
- **Anti-loop protection** — skips noreply, auto-replies, and mailing list traffic; per-sender rate limiting
- **Multi-account routing** — multiple email addresses each routed to a different AI agent
- **Any provider** — works with any IMAP/SMTP service: Gmail, Outlook, OCI Email, Fastmail, Exchange, self-hosted
- **Attachments** — inbound attachments passed to your agent as structured content
- **Tier-based limits** — automatic enforcement of mailbox count and monthly send limits per plan

## Pricing

| Tier | Mailboxes | Emails/mo | Price |
|------|-----------|-----------|-------|
| Free | 1 | 200 | $0 |
| Pro | 5 | 10,000 | $15/mo |
| Business | 25 | 50,000 | $49/mo |

Set your tier in config: `"tier": "free"` (default), `"tier": "pro"`, or `"tier": "business"`.

Upgrade at [alvento.ltd/email-plugin](https://alvento.ltd/email-plugin)

## API

```typescript
import { sendEmailReply, sendNewEmail, setTier, getUsageStats } from "regalmail";

// Set tier (called automatically from openclaw.json on startup)
setTier("pro");

// Check usage
const stats = getUsageStats("pro");
console.log(`${stats.sent}/${stats.limit} emails sent this month`);
```

## Documentation

Full documentation at [alvento.ltd/email-plugin](https://alvento.ltd/email-plugin)

## License

MIT — [Alvento Ltd](https://alvento.ltd)
