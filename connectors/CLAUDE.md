# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Run & Test

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript (tsc)
npm run dev          # Run in development mode (ts-node src/index.ts)
npm start            # Run compiled output (node dist/index.js)
npm test             # Run the golden characterization suite (vitest run)
npm run typecheck    # Type-check src + tests (tsc --noEmit -p tsconfig.test.json)
```

**Tests are the safety net.** `test/` contains a Vitest characterization suite that drives the
real `FlowEngine` against the `NY_MOCK` client (via a fake recording connector + in-memory
stores + fake timers) and snapshots every outbound WhatsApp message. Run `npm test` after any
change to the flow. **A snapshot change means behavior changed** — only accept it if the change
is intended and reviewed. No linter is configured.

## Architecture

A **conversational WhatsApp ride-booking gateway**: it receives WhatsApp Cloud API webhooks,
drives a booking conversation, and calls the Namma Yatri API. WhatsApp is the only channel.

### Request Lifecycle

```
Webhook → WhatsAppConnector.verifyWebhook() → parseIncoming() → SessionManager.resolveSession() → FlowEngine.handleMessage()
```

Orchestrated by `handleIncoming()` in `src/app.ts`. The flow engine runs async and does not
block the webhook response (200 is sent immediately).

### Ride types

- **Quick Ride** (internally `flexi`) — metered, pickup-only (NY RENTAL / MeterRide). Share a
  pin → search → confirm → driver card → tracked to completion.
- **Ride with destination** (internally `regular`) — pickup + drop → ONE_WAY estimate → upfront
  fare confirm → book → tracked.

Per-merchant `RIDE_MODE` (`flexi`|`regular`|`both`) sets which are offered. A merchant offering
neither is unsupported (flagged loudly at config load).

### Key Modules

- **`src/connectors/`** — `WhatsAppConnector` (the sole connector) implements the `Connector`
  interface in `types.ts`: `verifyWebhook`, `parseIncoming`, and the outbound surface
  `sendMessage` / `sendWithButtons` / `sendLocationRequest` / `sendVideo` (each merchant-scoped,
  returning a delivery boolean). The engine programs to this interface.

- **`src/flow/engine.ts`** — the state machine driving the conversation (auth/onboarding,
  ride-type selection, pickup/drop, search/booking, tracking, SOS, cancel, language). States are
  in `src/flow/states.ts`. `src/flow/flexi-messages.ts` holds the shared driver-card / progress
  message builders + ride-stage classifier.

- **`src/session/`** — dual-mode stores (Redis if configured, else in-memory): `SessionManager`
  (conversation context), `token-store.ts` (persistent NY auth token + language + intro flag),
  `ride-registry.ts` (durable index of bookings the tracker watches).

- **`src/tracking/ride-tracker.ts`** — a background timer that polls registered bookings and
  pushes arrived → started → ended/cancelled WhatsApp updates.

- **`src/ny/`** — `client.ts` (Namma Yatri API wrapper: silent auth, OTP registration, place
  search/geocode, flexi + regular search/estimate/booking, tracking, SOS, cancel),
  `mock-client.ts` (the `NY_MOCK` in-memory stand-in), `cities.ts` (service-area geofence).

- **`src/i18n/`** — 6 languages (en/hi/kn/ta/te/gu) + first-message script detection.

### Flow States

`IDLE`, `AWAITING_OTP`, `CHOOSING_LANGUAGE`, `AWAITING_PICKUP`, `CONFIRMING_PICKUP`,
`FLEXI_SEARCHING`, `AWAITING_REGULAR_DROP`, `CONFIRMING_REGULAR_DROP`, `CONFIRMING_REGULAR_FARE`,
`REGULAR_SEARCHING`, `TRACKING`, `CONFIRMING_SOS`, `CONFIRMING_MARK_SAFE`.

### Auth

Existing riders authenticate silently (`getToken`, no SMS). New riders onboard with one
interactive OTP (`requestOtp` → `verifyOtp`). Registration is lazy (fires on first action) and
the booking intent resumes after verify. A per-number `ALLOWED_PHONES` gate runs first.

### Configuration

All config is in `src/config.ts`, loaded from env vars (see `.env.example`). Key groups:
WhatsApp Cloud API creds, Namma Yatri API/auth, `RIDE_MODE` + `FLEXI_*` settings, `ALLOWED_PHONES`,
Redis, and the `MERCHANT_{ID}_{FIELD}` multi-merchant registry.

### Deployment

Dockerfile uses a multi-stage Node 20 Alpine build. Kubernetes manifests are in `k8s/`.
