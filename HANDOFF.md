# OpenClaw Email Channel Plugin — Build Handoff

## What This Is
A marketplace-ready OpenClaw channel plugin that adds email as a first-class channel alongside Signal, Discord, Telegram, WhatsApp, iMessage, LINE, and Slack.

## Package Info
- **Name**: `openclaw-plugin-email`
- **Owner**: Alvento Ltd
- **Peer dependency**: `openclaw` (plugin-sdk)
- **License**: MIT or commercial (Oscar's call)

## Architecture

```
IMAP IDLE (persistent connection)
  → New email arrives
  → normalize.ts → NormalizedWebhookMessage
  → resolveAgentRoute() based on recipient address
  → finalizeInboundContext() with email thread context
  → dispatchReplyWithBufferedBlockDispatcher()
  → Agent generates response
  → send.ts → SMTP reply with proper In-Reply-To headers
```

## File Structure

```
openclaw-plugin-email/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts          — Plugin registration (follow Signal pattern exactly)
│   ├── channel.ts        — ChannelPlugin<ResolvedEmailAccount> definition
│   ├── runtime.ts        — PluginRuntime DI wrapper
│   ├── monitor.ts        — IMAP IDLE listener (core inbound loop)
│   ├── monitor-normalize.ts — Raw email → NormalizedWebhookMessage
│   ├── send.ts           — SMTP outbound (himalaya CLI or nodemailer)
│   ├── probe.ts          — IMAP/SMTP health check
│   ├── accounts.ts       — Multi-account config resolution
│   └── types.ts          — Email-specific types
```

## Blueprint Files (READ THESE FIRST)

All on the server at `/var/lib/openclaw/.npm-global/lib/node_modules/openclaw/extensions/`:

| File | Why |
|------|-----|
| `signal/index.ts` | Plugin registration pattern — copy this structure exactly |
| `signal/src/channel.ts` | Full ChannelPlugin definition — this is the master template |
| `signal/src/runtime.ts` | DI pattern — copy verbatim, rename |
| `bluebubbles/src/monitor.ts` | Webhook/polling pattern with debouncing |
| `bluebubbles/src/monitor-normalize.ts` | Message normalization pattern |
| `bluebubbles/src/monitor-processing.ts` | Full inbound pipeline: security gating → routing → reply dispatch |

### SDK Types (interfaces to implement)
| File | What |
|------|------|
| `dist/plugin-sdk/plugins/runtime/types.d.ts` | PluginRuntime — all available APIs |
| `dist/plugin-sdk/routing/resolve-route.d.ts` | ResolvedAgentRoute, RoutePeer, buildAgentSessionKey |
| `dist/plugin-sdk/auto-reply/reply/provider-dispatcher.d.ts` | dispatchReplyWithBufferedBlockDispatcher |

## Key Design Decisions

### 1. IMAP IDLE (not polling)
Use `imapclient` or `imapflow` npm package for IMAP IDLE support. Renew IDLE every 10 min (server timeout). Reconnect on connection drop with exponential backoff.

### 2. Multi-Account Routing
Each email account maps to a different agent:
```toml
[channels.email.accounts.sales]
email = "sales@alvento.ltd"
imapHost = "imap.gmail.com"
imapPort = 993
imapUser = "alventohope@gmail.com"
imapPass = { cmd = "cat /run/secrets/gmail-hope-pass" }
smtpHost = "smtp.email.uk-london-1.oci.oraclecloud.com"
smtpPort = 587
smtpUser = "ocid1.user..."
smtpPass = { cmd = "cat /run/secrets/oci-smtp-pass" }
fromName = "Maeve O'Brien"
fromEmail = "sales@alvento.ltd"
agentBinding = "sales-agent"

[channels.email.accounts.support]
email = "support@alvento.ltd"
# ... same IMAP (shared inbox), different fromEmail + agent
agentBinding = "ai-receptionist"
```

### 3. Thread Awareness
- Use `Message-ID` and `In-Reply-To` headers to track email threads
- Map thread to OpenClaw `sessionKey` for conversation persistence
- `replyToId` = parent email's Message-ID
- Build sessionKey as: `email:{accountId}:{threadId}`

### 4. Shared Inbox Support
All alvento.ltd addresses route to alventohope@gmail.com. Plugin must:
- Connect to ONE IMAP inbox
- Filter inbound by `To:` / `Cc:` header to determine which account received it
- Route to the correct agent based on recipient address match

### 5. Outbound: SMTP Direct (not himalaya)
Use `nodemailer` for SMTP — it's the standard, handles MIME properly, supports attachments. Himalaya is CLI-only, hard to integrate programmatically from TypeScript.

### 6. Security Gating
- DM policy: `open` (respond to anyone), `allowlist` (only known contacts), `pairing` (require approval code)
- Spam filter: skip emails with spam headers, bulk senders, unsubscribe-only
- Rate limit: max replies per hour per sender (prevent reply loops)
- **Anti-loop protection**: CRITICAL — never reply to auto-replies, noreply@, mailer-daemon, etc.

## Implementation Order

### Phase 1: Core (MVP)
1. `types.ts` — EmailAccount, EmailConfig, NormalizedEmail types
2. `runtime.ts` — Copy from Signal, rename
3. `accounts.ts` — Config parsing, account resolution
4. `monitor.ts` — IMAP IDLE connection, detect new emails
5. `monitor-normalize.ts` — Parse email → NormalizedWebhookMessage
6. `send.ts` — SMTP send with proper headers (In-Reply-To, References, From)
7. `channel.ts` — ChannelPlugin definition wiring everything together
8. `index.ts` — Plugin registration
9. `probe.ts` — IMAP connection test

### Phase 2: Production Hardening
- Anti-loop protection (check headers, track reply counts)
- Exponential backoff on IMAP reconnect
- Attachment handling (download inbound, attach outbound)
- HTML → plaintext extraction for agent context
- Rate limiting per sender
- Logging and metrics

### Phase 3: Marketplace Ready
- README with setup guide
- npm package publishing
- OpenClaw config schema registration
- Onboarding wizard (guided IMAP/SMTP setup)
- Test suite

## Existing Infrastructure (Alvento Server)

### IMAP (Receive)
- Host: `imap.gmail.com:993` (TLS)
- Login: `alventohope@gmail.com`
- Password: `/run/secrets/gmail-hope-pass` → `cbtv ecdp gxcd dxbq`
- All alvento.ltd addresses forward here via Google Workspace routing

### SMTP (Send)
- Host: `smtp.email.uk-london-1.oci.oraclecloud.com:587` (STARTTLS)
- Login: `ocid1.user.oc1..aaaaaaaapjyc3l4dq6mkixztc2dxdvdcfcai5w44vtzae6t3jf3nx4z7acgq@ocid1.tenancy.oc1..aaaaaaaai6mnwkayqahalzsp55aoylgqjyzlgz556zbotsiyefa2wq5nvaua.vk.com`
- Password: `/run/secrets/oci-smtp-pass`
- Approved sender: `hello@alvento.ltd` (others need OCI Console approval)

### Email Personas
| Address | Display Name | Agent |
|---------|-------------|-------|
| hello@alvento.ltd | Amara | main (default) |
| sales@alvento.ltd | Alvento Sales | sales-agent |
| maeve@alvento.ltd | Maeve O'Brien | sales-agent |
| support@alvento.ltd | Alvento Support | ai-receptionist |
| priya@alvento.ltd | Priya P. | ai-receptionist |
| contact@alvento.ltd | Alvento | main |
| amara@alvento.ltd | Amara | main |

### Himalaya Config Reference
Full working config at: `/var/lib/openclaw/.config/himalaya/config.toml`
(9 accounts, all sharing same IMAP + SMTP credentials)

## Dependencies

```json
{
  "peerDependencies": {
    "openclaw": ">=2026.2.0"
  },
  "dependencies": {
    "imapflow": "^1.0.0",
    "nodemailer": "^6.0.0",
    "mailparser": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/nodemailer": "^6.0.0",
    "vitest": "^2.0.0"
  }
}
```

## Anti-Loop Protection (CRITICAL)

Never reply to:
- `noreply@`, `no-reply@`, `mailer-daemon@`, `postmaster@`
- Emails with `Auto-Submitted: auto-replied` header
- Emails with `X-Auto-Response-Suppress` header
- Emails from the plugin's own sending addresses
- Same sender more than 5 replies in 1 hour
- Emails with `Precedence: bulk` or `Precedence: junk`

## Notes
- DKIM is passing for alvento.ltd but emails still land in spam due to new sender reputation. Domain warming in progress.
- OCI approved senders: only hello@ is approved. Others need adding in OCI Console.
- This is the FIRST email channel plugin for OpenClaw — no competition in the marketplace yet.
