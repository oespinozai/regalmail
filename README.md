# RegalMail

Email channel plugin for AI agents. IMAP inbound, SMTP outbound, thread-aware, anti-loop protected.

Give your AI agents a real email inbox. They receive emails in real-time via IMAP IDLE, understand the full thread context, and reply via SMTP with proper threading headers.

## Install

```bash
npm install regalmail
```

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
          "imapHost": "imap.gmail.com",
          "imapPort": 993,
          "smtpHost": "smtp.gmail.com",
          "smtpPort": 587,
          "agentBinding": "sales-agent"
        }
      }
    }
  }
}
```

## Features

- **IMAP IDLE** — real-time email detection, no polling
- **Multi-account routing** — different addresses → different agents
- **Thread awareness** — Message-ID, In-Reply-To, References headers
- **Anti-loop protection** — blocks noreply, auto-replies, rate-limits per sender
- **Any provider** — Gmail, Outlook, OCI, Fastmail, self-hosted
- **Tier-based limits** — Free, Pro, Business plans

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

// Set tier
setTier("pro");

// Check usage
const stats = getUsageStats("pro");
console.log(`${stats.sent}/${stats.limit} emails sent this month`);
```

## License

MIT — [Alvento Ltd](https://alvento.ltd)
