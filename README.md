# RegalMail

**Email channel plugin for AI agents.**

Give your AI agents a real email inbox. New emails arrive in real-time via IMAP IDLE (push, not polling). Replies go out via SMTP with correct threading headers so they land in the right email thread.

OpenClaw runtime identity:
- Plugin/channel id: `email`
- Product/package name: `regalmail`

## Install

```bash
npm install regalmail
```

## Features

- **IMAP IDLE** — real-time push, no polling. Auto-reconnects with exponential backoff.
- **Thread awareness** — Message-ID, In-Reply-To, References headers
- **Anti-loop protection** — skips bulk/noreply senders, per-sender rate limiting
- **Stripe billing** — checkout sessions, customer portal, tier enforcement
- **Any IMAP/SMTP provider** — Gmail, OCI, Fastmail, self-hosted

## Tiers

| Tier | Mailboxes | Emails/mo | Price |
|------|-----------|-----------|-------|
| Free | 1 | 200 | $0 |
| Pro | 5 | 10,000 | $15/mo |
| Business | 25 | 50,000 | $49/mo |

## Quick Start

```typescript
import { startEmailMonitor, setTier, getUsageStats } from "regalmail";

setTier("pro");

await startEmailMonitor({
  accounts: [{
    email: "hello@yourdomain.com",
    displayName: "Agent",
    imap: { host: "imap.gmail.com", port: 993, secure: true, auth: { user: "you@gmail.com", pass: "app-password" } },
    smtp: { host: "smtp.gmail.com", port: 587, secure: false, auth: { user: "you@gmail.com", pass: "app-password" } },
  }],
  imapAccount: /* primary account */,
  onEmail: async (email, account) => {
    console.log(`From: ${email.from} — Subject: ${email.subject}`);
  },
});
```

## OpenClaw Plugin

Add to `openclaw.json`:

```json
{
  "channels": {
    "regalmail": {
      "enabled": true,
      "tier": "free",
      "accounts": {
        "hello": {
          "email": "hello@yourdomain.com",
          "displayName": "Agent",
          "imap": { "host": "imap.gmail.com", "port": 993, "secure": true, "auth": { "user": "you@gmail.com", "pass": "app-password" } },
          "smtp": { "host": "smtp.gmail.com", "port": 587, "secure": false, "auth": { "user": "you@gmail.com", "pass": "app-password" } }
        }
      }
    }
  }
}
```

## Stripe Billing

RegalMail manages subscriptions via Stripe. Set your customer ID and tier in config:

```json
{
  "channels": {
    "regalmail": {
      "enabled": true,
      "stripeCustomerId": "cus_xxxx",
      "tier": "pro"
    }
  }
}
```

- **Checkout**: `createCheckoutSession({ tier: "pro" })` → Stripe hosted checkout URL
- **Portal**: `getCustomerPortalUrl(customerId)` → self-serve billing management
- **Status**: `getSubscriptionStatus(customerId)` → current tier and period end

## CLI

```bash
# Check usage
node -e "const {getUsageStats}=require('regalmail'); console.log(getUsageStats('pro'))"

# Force Stripe product creation (idempotent)
node -e "const {ensureProducts}=require('regalmail'); ensureProducts().then(()=>console.log('done'))"
```

## License

MIT — [Alvento Ltd](https://alvento.ltd)
