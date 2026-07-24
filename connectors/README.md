# WhatsApp Ride-Booking Gateway

A conversational gateway that lets riders book Namma Yatri autos over **WhatsApp** — no
app install. It receives WhatsApp Cloud API webhooks, drives a booking conversation, and
calls the Namma Yatri API. Built for tech-inept tier-2 users: friction-free, location-first.

Two ride types:

- **Quick Ride** (Flexi) — metered, destination-less, pickup-only, via NY's EasyBooking product. Share a pin, get an auto; the fare is metered by actual distance (see `docs/easybooking.md`).
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
(`flexi`|`regular`|`both`), the `FLEXI_*` geofence/tracker settings, `ALLOWED_PHONES`,
and Redis (`REDIS_URL` — required in production). Multiple merchants can be configured
with `MERCHANT_{ID}_{FIELD}` vars. In production (`NODE_ENV=production`) the app fails
fast at boot if Redis is not configured, refuses `NY_MOCK`, and forces webhook signature
verification on.

## Docker

```bash
docker build -t ny-whatsapp-gateway .
docker run -p 3000:3000 --env-file .env ny-whatsapp-gateway
```

## Kubernetes

```bash
# 1. Create the Secret. Fill in a copy of k8s/examples/secret.example.yaml and apply it,
#    or (simpler) create it imperatively:
kubectl create secret generic ny-connectors-secrets \
  --from-literal=WHATSAPP_VERIFY_TOKEN=xxx \
  --from-literal=WHATSAPP_APP_SECRET=xxx \
  --from-literal=WHATSAPP_ACCESS_TOKEN=xxx \
  --from-literal=WHATSAPP_PHONE_NUMBER_ID=xxx \
  --from-literal=NY_PRE_AUTH_TOKEN=xxx \
  --from-literal=NY_MERCHANT_ID=xxx \
  --from-literal=NY_DASHBOARD_TOKEN=xxx \
  --from-literal=NY_CITY=xxx

# 2. Apply the app manifests. The Secret TEMPLATE lives in k8s/examples/ (a subdir),
#    so this non-recursive apply won't touch it or clobber the real Secret above.
kubectl apply -f k8s/
```

Pin `image:` in `k8s/deployment.yaml` to a specific `sha-<gitsha>` tag from the
connectors-ci workflow before a real rollout (not `:latest`). For a durable prod
Redis, point `REDIS_URL` at a managed Redis instead of the pilot `k8s/redis.yaml`
(see the note in that file).
