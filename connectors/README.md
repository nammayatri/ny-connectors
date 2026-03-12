# Message Gateway

Unified webhook gateway that normalizes incoming messages from Telegram, WhatsApp, and Slack into a standard JSON format and dispatches them to a configurable webhook URL.

## Setup

```bash
npm install
npm run build
npm start
```

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3000) |
| `WEBHOOK_URL` | Destination URL for normalized messages |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (used for webhook secret verification) |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp webhook verification token |
| `WHATSAPP_APP_SECRET` | WhatsApp app secret for signature validation |
| `SLACK_SIGNING_SECRET` | Slack signing secret for request verification |

## Webhook Endpoints

| Platform | Method | Path |
|---|---|---|
| Telegram | POST | `/webhook/telegram` |
| WhatsApp | GET/POST | `/webhook/whatsapp` |
| Slack | POST | `/webhook/slack` |
| Health | GET | `/health` |

## Normalized Message Format

```json
{
  "source": "telegram|whatsapp|slack",
  "messageId": "string",
  "senderId": "string",
  "senderName": "string",
  "chatId": "string",
  "chatType": "direct|group|channel",
  "text": "string",
  "timestamp": "ISO-8601",
  "metadata": {},
  "raw": {}
}
```

## Docker

```bash
docker build -t message-gateway .
docker run -p 3000:3000 --env-file .env message-gateway
```

## Kubernetes

```bash
kubectl apply -f k8s/
# Create secrets separately:
kubectl create secret generic message-gateway-secrets \
  --from-literal=TELEGRAM_BOT_TOKEN=xxx \
  --from-literal=WHATSAPP_VERIFY_TOKEN=xxx \
  --from-literal=WHATSAPP_APP_SECRET=xxx \
  --from-literal=SLACK_SIGNING_SECRET=xxx
```
