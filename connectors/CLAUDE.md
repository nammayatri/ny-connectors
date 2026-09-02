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

- **`src/ny/client.ts`** — Namma Yatri taxi API wrapper. Handles authentication (phone → JWT via internal auth, or OTP registration via the dashboard API), place search, ride search, estimate polling, estimate selection, and active booking retrieval.

- **`src/ny/frfs.ts`** — FRFS (metro / bus / suburban rail) ticketing and multimodal journey APIs. Same base URL and same `token:` user JWT as `client.ts`. `src/ny/http.ts` holds the `loggedFetch` wrapper both clients share.

- **`src/qr.ts`** — rasterises a ticket's `qrData` to a PNG. The mobile app renders QRs client-side; a chat bot has to produce the image itself, so Telegram gets `sendPhoto` and WhatsApp gets a media upload followed by an image message. Slack has no image path and falls back to the raw code as text.

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

The taxi flow progresses through: `IDLE → AWAITING_CONTACT → AWAITING_PHONE → AWAITING_ORIGIN → CONFIRMING_ORIGIN → AWAITING_DESTINATION → CONFIRMING_DESTINATION → SHOWING_ESTIMATES → TRACKING`. New users who fail the silent auth divert through `AWAITING_OTP → AWAITING_NAME`. Quick route buttons allow authenticated users with saved locations to skip origin/destination entry.

Ticketing adds `CHOOSING_TRANSIT_MODE → AWAITING_TRANSIT_ORIGIN → AWAITING_TRANSIT_DEST → CONFIRMING_TICKET → AWAITING_TICKET_PAYMENT → SHOWING_TICKETS`, and journeys add `SHOWING_JOURNEYS → AWAITING_JOURNEY_PAYMENT → TRACKING_JOURNEY`.

### Transit ticketing & journeys

Two features sit alongside taxi booking, both reachable from the home menu:

- **FRFS tickets** (`transit` button): pick metro/bus/suburban → search stations by name → fare quote → confirm → pay → QR ticket. API path: `POST /frfs/search` → `GET /frfs/search/{id}/quote` → `POST /frfs/quote/{quoteId}/confirm` → poll `GET /frfs/booking/{id}/status` until `CONFIRMED`.

- **Multimodal journeys** (`show_journeys`, offered inline with the taxi estimates): `POST /multimodalSearch` returns whole journeys made of walk/metro/bus/taxi legs. Selecting one runs `POST /multimodal/{journeyId}/initiate` then `/confirm`, which books every leg the backend marks bookable.

Payment for both happens outside the chat. Confirming creates a Juspay order; the mobile app drives it through the HyperSDK, which a bot cannot use, so the bot sends `payment.paymentOrder.payment_links.web` as a plain URL (WhatsApp reply buttons cannot carry URLs) and polls the booking until the gateway reports back — 60 attempts at 3s, i.e. 3 minutes. Setting `FRFS_MOCK_PAYMENT=true` confirms with `?isMockPayment=true` and skips checkout entirely; it is for sandbox use only.

Quantity is chosen in `CHOOSING_TICKET_QUANTITY` (1–`MAX_TICKETS`, currently 6) and passed to `POST /frfs/search`. The pre-confirm fare summary shows the quote's `price`; the pay button and the actual charge use the confirmed booking's `price`.

### Configuration

All config is in `src/config.ts`, loaded from environment variables. Key groups:
- **Platform tokens**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SECRET_TOKEN`, `WHATSAPP_*`, `SLACK_*`
- **Namma Yatri**: `NY_BASE_URL`, `NY_AUTH_URL`, `NY_PRE_AUTH_TOKEN`, `NY_APP_SECRET`
- **Transit**: `FRFS_ENABLED`, `NY_FRFS_CITY` (a city *name* like `Chennai`, unlike `NY_CITY` which is a `std:` code), `FRFS_MOCK_PAYMENT`, `MULTIMODAL_ENABLED`
- **Infrastructure**: `REDIS_URL`, `SESSION_TTL_SECONDS`, `PORT`

### Deployment

Dockerfile uses multi-stage Node 20 Alpine build. Kubernetes manifests are in `k8s/` (deployment, service, configmap).
