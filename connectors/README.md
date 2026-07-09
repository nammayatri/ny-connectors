# WhatsApp Ride-Booking Gateway

A conversational gateway that lets riders book Namma Yatri autos over **WhatsApp** — no
app install. It receives WhatsApp Cloud API webhooks, drives a booking conversation, and
calls the Namma Yatri API. Built for tech-inept tier-2 users: friction-free, location-first.

Two ride types:

- **Quick Ride** (Flexi) — metered, pickup-only (RENTAL). Share a pin, get an auto.
- **Ride with destination** (Regular) — pickup + drop → upfront fare → book (ONE_WAY).

Plus silent auth (existing riders) / one-time OTP onboarding (new riders), first-message
language detection (6 Indian languages), SOS/safety, live ride tracking, and a per-number
access allowlist.

## Setup

```bash
npm install
npm run build
npm start          # or: npm run dev   (ts-node, no build step)
```

Copy `.env.example` → `.env` and fill in the WhatsApp + Namma Yatri credentials.

## Test

```bash
npm test           # vitest run — golden characterization suite
npm run typecheck  # tsc --noEmit (src + tests)
```

The suite in `test/` drives the real flow engine against the `NY_MOCK` client and snapshots
every outbound message. Snapshots must not change without a deliberate, reviewed reason.

## Webhook Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/webhook/whatsapp` | Meta webhook verification (hub challenge) |
| POST | `/webhook/whatsapp` | Inbound messages (HMAC-verified) |
| GET | `/health` | Liveness/readiness |

## Configuration

All configuration is via environment variables — see `.env.example` for the full list.
Key groups: WhatsApp Cloud API credentials, Namma Yatri API/auth, `RIDE_MODE`
(`flexi`|`regular`|`both`), the `FLEXI_*` tariff/geofence/tracker settings, `ALLOWED_PHONES`,
and optional Redis. Multiple merchants can be configured with `MERCHANT_{ID}_{FIELD}` vars.

## Docker

```bash
docker build -t ny-whatsapp-gateway .
docker run -p 3000:3000 --env-file .env ny-whatsapp-gateway
```

## Kubernetes

```bash
kubectl apply -f k8s/
# Create secrets separately, e.g.:
kubectl create secret generic message-gateway-secrets \
  --from-literal=WHATSAPP_VERIFY_TOKEN=xxx \
  --from-literal=WHATSAPP_APP_SECRET=xxx \
  --from-literal=WHATSAPP_ACCESS_TOKEN=xxx \
  --from-literal=WHATSAPP_PHONE_NUMBER_ID=xxx \
  --from-literal=NY_PRE_AUTH_TOKEN=xxx \
  --from-literal=NY_DASHBOARD_TOKEN=xxx
```
