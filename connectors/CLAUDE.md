# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript (tsc)
npm run dev          # Run in development mode (ts-node src/index.ts)
npm start            # Run compiled output (node dist/index.js)
```

No test framework is configured. No linter is configured.

## Architecture

This is a **conversational ride-booking gateway** that receives webhooks from messaging platforms (Telegram, WhatsApp, Slack), normalizes them, and drives users through a ride-booking flow via the Namma Yatri API.

### Request Lifecycle

```
Webhook → Connector.verifyWebhook() → Connector.parseIncoming() → SessionManager.resolveSession() → FlowEngine.handleMessage()
```

This pipeline is orchestrated by `handleIncoming()` in `src/app.ts`. The flow engine runs async and does not block the webhook response (200 is sent immediately).

### Key Modules

- **`src/connectors/`** — Platform adapters implementing the `Connector` interface (`types.ts`). Each connector handles signature verification, message parsing, and reply sending for its platform. Telegram also supports inline keyboard buttons and contact sharing.

- **`src/flow/engine.ts`** — State machine (~700 lines) that drives the booking conversation. States are defined in `src/flow/states.ts`. The engine handles state transitions, global commands (`cancel`, `status`), and error recovery (e.g., token expiry). This is the core business logic.

- **`src/session/`** — Dual-mode session store. `createSessionManager()` in `index.ts` returns a Redis-backed store if `REDIS_URL` is set, otherwise falls back to an in-memory store with 60s cleanup interval. Sessions are keyed by `{source}:{senderId}` and have a configurable TTL (default 30 min).

- **`src/session/token-store.ts`** — File-based persistent auth token cache (`user-tokens.json`). Allows users to authenticate once and reuse tokens across sessions.

- **`src/ny/client.ts`** — Namma Yatri API wrapper. Handles authentication (phone + access code → JWT), place search, ride search, estimate polling, estimate selection, and active booking retrieval.

### Connector Interface

All platform connectors implement this interface from `src/connectors/types.ts`:

```typescript
interface Connector {
  readonly source: MessageSource;  // 'telegram' | 'whatsapp' | 'slack'
  parseIncoming(req): CommandMessage | null;
  verifyWebhook(req): boolean;
  sendMessage(chatId, text): Promise<void>;
}
```

Messages are normalized to `CommandMessage` before reaching the flow engine.

### Flow States

The booking flow progresses through: `IDLE → AWAITING_CONTACT → AWAITING_PHONE → AWAITING_ACCESS_CODE → AWAITING_ORIGIN → CONFIRMING_ORIGIN → AWAITING_DESTINATION → CONFIRMING_DESTINATION → SHOWING_ESTIMATES → TRACKING`. Quick route buttons allow authenticated users with saved locations to skip origin/destination entry.

### Configuration

All config is in `src/config.ts`, loaded from environment variables. Key groups:
- **Platform tokens**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SECRET_TOKEN`, `WHATSAPP_*`, `SLACK_*`
- **Namma Yatri**: `NY_BASE_URL`, `NY_AUTH_URL`, `NY_PRE_AUTH_TOKEN`, `NY_APP_SECRET`
- **Infrastructure**: `REDIS_URL`, `SESSION_TTL_SECONDS`, `PORT`

### Deployment

Dockerfile uses multi-stage Node 20 Alpine build. Kubernetes manifests are in `k8s/` (deployment, service, configmap).
