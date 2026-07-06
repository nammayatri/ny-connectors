#!/usr/bin/env bash
# Simulate a signed inbound WhatsApp Cloud API webhook to the locally-running gateway.
# Lets you exercise the flow engine WITHOUT a public tunnel or Meta delivering to you.
#
# Usage:
#   ./scripts/simulate-inbound.sh "hi"                       # text from default sender
#   ./scripts/simulate-inbound.sh "Koramangala" 919876543210 # text from a specific sender
#   ./scripts/simulate-inbound.sh --interactive book 919876543210         # a button/list tap
#   ./scripts/simulate-inbound.sh --location 13.3392 77.1140 919876543210 # share a location pin
#
# Notes:
# - Signs the body with WHATSAPP_APP_SECRET from .env so verifyWebhook() passes.
# - The OUTBOUND reply the bot sends is a REAL Graph API call. It only succeeds if the
#   sender number has messaged the business number within the last 24h (WhatsApp rule).
#   For a guaranteed successful reply, use YOUR phone as the sender and WhatsApp the
#   business number first. Otherwise you'll still see inbound+flow work in the logs,
#   and the outbound send may fail with a 24h-window error (that's expected).
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

URL="${TARGET_URL:-http://localhost:${PORT:-3000}/webhook/whatsapp}"
PNID="${WHATSAPP_PHONE_NUMBER_ID:?set WHATSAPP_PHONE_NUMBER_ID in .env}"
SECRET="${WHATSAPP_APP_SECRET:?set WHATSAPP_APP_SECRET in .env}"

MSG_TYPE="text"
case "${1:-}" in
  --interactive) MSG_TYPE="interactive"; shift ;;
  --location)    MSG_TYPE="location";    shift ;;
esac
# Sender defaults to TEST_SENDER (.env) so every step in a conversation uses the
# SAME number — sessions are keyed per-sender, so mixing numbers = separate users.
if [ "$MSG_TYPE" = "location" ]; then
  LAT="${1:-13.3392}"; LON="${2:-77.1140}"          # default: central Tumkur
  SENDER="${3:-${TEST_SENDER:-919876543210}}"
  BODY="location($LAT,$LON)"
else
  TEXT="${1:-hi}"
  SENDER="${2:-${TEST_SENDER:-919876543210}}"
  BODY="$TEXT"
fi
TS="$(date +%s)"
MID="wamid.test-${TS}"

if [ "$MSG_TYPE" = "interactive" ]; then
  MSG_JSON="{\"from\":\"$SENDER\",\"id\":\"$MID\",\"timestamp\":\"$TS\",\"type\":\"interactive\",\"interactive\":{\"type\":\"button_reply\",\"button_reply\":{\"id\":\"$TEXT\",\"title\":\"$TEXT\"}}}"
elif [ "$MSG_TYPE" = "location" ]; then
  # Set LOC_NAME=... to simulate sharing a NAMED/saved place (vs a raw current-location pin).
  if [ -n "${LOC_NAME:-}" ]; then
    MSG_JSON="{\"from\":\"$SENDER\",\"id\":\"$MID\",\"timestamp\":\"$TS\",\"type\":\"location\",\"location\":{\"latitude\":$LAT,\"longitude\":$LON,\"name\":\"$LOC_NAME\",\"address\":\"$LOC_NAME\"}}"
  else
    MSG_JSON="{\"from\":\"$SENDER\",\"id\":\"$MID\",\"timestamp\":\"$TS\",\"type\":\"location\",\"location\":{\"latitude\":$LAT,\"longitude\":$LON}}"
  fi
else
  MSG_JSON="{\"from\":\"$SENDER\",\"id\":\"$MID\",\"timestamp\":\"$TS\",\"type\":\"text\",\"text\":{\"body\":\"$TEXT\"}}"
fi

PAYLOAD="{\"object\":\"whatsapp_business_account\",\"entry\":[{\"id\":\"WABA_TEST\",\"changes\":[{\"field\":\"messages\",\"value\":{\"messaging_product\":\"whatsapp\",\"metadata\":{\"display_phone_number\":\"TEST\",\"phone_number_id\":\"$PNID\"},\"contacts\":[{\"profile\":{\"name\":\"Local Tester\"},\"wa_id\":\"$SENDER\"}],\"messages\":[$MSG_JSON]}}]}]}"

TMP="$(mktemp)"; printf '%s' "$PAYLOAD" > "$TMP"
SIG="sha256=$(openssl dgst -sha256 -hmac "$SECRET" "$TMP" | awk '{print $NF}')"

echo "POST $URL"
echo "  sender=$SENDER type=$MSG_TYPE body=$BODY"
curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIG" \
  --data-binary "@$TMP" -w "\n-> HTTP %{http_code}\n"
rm -f "$TMP"
echo "Check the server logs to see the flow engine run and the outbound reply attempt."
