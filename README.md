# openclaw-plugin-email

Email channel plugin for [OpenClaw](https://openclaw.io). Adds email as a first-class messaging channel alongside Signal, Discord, Telegram, and others.

Receives emails in real-time via IMAP IDLE and routes them to the right AI agent based on recipient address. Agents reply via SMTP with proper email threading.

## Features

- **IMAP IDLE** — real-time inbound, no polling. Reacts to new emails within seconds.
- **Multi-account routing** — `sales@` goes to your sales agent, `support@` goes to your support agent.
- **Thread awareness** — maintains conversation context across email threads using `In-Reply-To` and `References` headers.
- **Anti-loop protection** — never replies to noreply@, mailer-daemon@, auto-replies, or bulk mail. Rate-limits per sender.
- **Shared inbox support** — multiple email addresses can share one IMAP inbox (e.g., Google Workspace routing).
- **Health checks** — probe IMAP and SMTP connections from the OpenClaw dashboard.

## Quick Start

```bash
npm install openclaw-plugin-email
```

Add to your `openclaw.json`:

```json
{
  "plugins": ["openclaw-plugin-email"],
  "channels": {
    "email": {
      "enabled": true,
      "imapHost": "imap.gmail.com",
      "imapPort": 993,
      "imapUser": "your-inbox@gmail.com",
      "imapPass": { "cmd": "cat /run/secrets/gmail-pass" },
      "smtpHost": "smtp.gmail.com",
      "smtpPort": 587,
      "smtpUser": "your-inbox@gmail.com",
      "smtpPass": { "cmd": "cat /run/secrets/gmail-pass" },
      "accounts": {
        "sales": {
          "email": "sales@yourcompany.com",
          "displayName": "Sales Team",
          "agentBinding": "sales-agent"
        },
        "support": {
          "email": "support@yourcompany.com",
          "displayName": "Support",
          "agentBinding": "ai-receptionist"
        }
      }
    }
  }
}
```

## How It Works

```
Inbound email arrives
  → IMAP IDLE detects it instantly
  → Recipient address matched to account (sales@, support@, etc.)
  → Anti-loop checks (skip auto-replies, noreply, rate limits)
  → Route to bound AI agent via OpenClaw's agent routing
  → Agent generates contextual reply
  → Reply sent via SMTP with proper threading headers
```

## Configuration

### Global Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `false` | Enable the email channel |
| `imapHost` | string | `imap.gmail.com` | IMAP server hostname |
| `imapPort` | number | `993` | IMAP server port |
| `imapUser` | string | — | IMAP login username |
| `imapPass` | string \| `{cmd}` | — | IMAP password or command |
| `smtpHost` | string | — | SMTP server hostname |
| `smtpPort` | number | `587` | SMTP server port |
| `smtpUser` | string | — | SMTP login username |
| `smtpPass` | string \| `{cmd}` | — | SMTP password or command |

### Per-Account Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `email` | string | — | Email address for this account |
| `displayName` | string | — | Display name in From header |
| `agentBinding` | string | `main` | Which OpenClaw agent handles inbound |
| `dmPolicy` | string | `open` | `open`, `allowlist`, or `pairing` |
| `allowFrom` | string[] | `[]` | Allowed sender addresses (when `dmPolicy=allowlist`) |
| `rateLimitPerHour` | number | `5` | Max auto-replies per sender per hour |

Accounts inherit global IMAP/SMTP settings — override per-account only if different.

### Password Commands

Use `{ "cmd": "..." }` to read passwords from files or secret managers:

```json
"imapPass": { "cmd": "cat /run/secrets/gmail-app-password" }
"smtpPass": { "cmd": "vault kv get -field=password kv/smtp" }
```

## Shared Inbox Pattern

If all your email addresses forward to one Gmail inbox (via Google Workspace routing, Cloudflare Email Routing, etc.):

1. Configure ONE set of IMAP credentials (the shared inbox)
2. Create multiple accounts with different `email` addresses
3. The plugin matches inbound emails by `To:`/`Cc:` header to the right account

```json
{
  "imapUser": "shared-inbox@gmail.com",
  "imapPass": { "cmd": "..." },
  "accounts": {
    "sales": { "email": "sales@yourcompany.com", "agentBinding": "sales-agent" },
    "support": { "email": "support@yourcompany.com", "agentBinding": "support-bot" },
    "hello": { "email": "hello@yourcompany.com", "agentBinding": "main" }
  }
}
```

## Anti-Loop Protection

The plugin never replies to:

- `noreply@`, `no-reply@`, `mailer-daemon@`, `postmaster@`, `bounce@`
- Emails with `Auto-Submitted: auto-replied` header
- Emails with `X-Auto-Response-Suppress` header
- Emails with `Precedence: bulk` or `Precedence: junk`
- Its own sending addresses (prevents infinite loops)
- Senders exceeding the rate limit (default: 5 replies/hour)

## Providers Tested

| Provider | IMAP | SMTP | Notes |
|----------|------|------|-------|
| Gmail | Yes | Yes | Use App Password with 2FA |
| Google Workspace | Yes | Yes | Admin must enable IMAP |
| OCI Email Delivery | — | Yes | Send-only, pair with Gmail IMAP |
| Outlook/365 | Yes | Yes | May need OAuth2 (future) |
| Fastmail | Yes | Yes | App passwords supported |

## Requirements

- OpenClaw >= 2026.2.0
- Node.js >= 18
- IMAP server with IDLE support (most modern servers)

## License

MIT
