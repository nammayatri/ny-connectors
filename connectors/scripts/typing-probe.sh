#!/usr/bin/env bash
# THROWAWAY PROBE (safe to delete) — settles two undocumented WhatsApp questions:
#   1. Does a typing indicator render when fired AFTER you've already replied?
#   2. Can it be re-fired to bridge past the 25s cap?
# Reads WhatsApp creds from ../.env (never printed). Sends REAL messages to $TO.
#
# Usage:
#   TO=919343922922 MSGID=wamid.HBg... ./scripts/typing-probe.sh
#   - TO    = the recipient phone (your own WhatsApp, digits only, 91 + number)
#   - MSGID = a FRESH inbound wamid: message your bot from your phone, then grab
#             `message.messageId` (see the one-line log tip I gave you).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
env_file="$here/../.env"
TOKEN=$(grep -E '^WHATSAPP_ACCESS_TOKEN=' "$env_file" | head -1 | cut -d= -f2-)
PHONE_ID=$(grep -E '^WHATSAPP_PHONE_NUMBER_ID=' "$env_file" | head -1 | cut -d= -f2-)
: "${TO:?set TO=<recipient phone, e.g. 919343922922>}"
: "${MSGID:?set MSGID=<a FRESH inbound wamid from your phone>}"
API="https://graph.facebook.com/v23.0/${PHONE_ID}/messages"
auth=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")

echo "1) Sending the 'Finding an auto' text (this is the 'reply')…"
curl -sS "${auth[@]}" "$API" \
  -d "{\"messaging_product\":\"whatsapp\",\"to\":\"${TO}\",\"type\":\"text\",\"text\":{\"body\":\"🛺 Finding an auto near you…\"}}"; echo

sleep 2
echo
echo "2) Firing typing indicator AFTER the reply — 👀 WATCH YOUR PHONE for 'typing…' under the name:"
curl -sS "${auth[@]}" "$API" \
  -d "{\"messaging_product\":\"whatsapp\",\"status\":\"read\",\"message_id\":\"${MSGID}\",\"typing_indicator\":{\"type\":\"text\"}}"; echo
echo "   (a success looks like {\"success\":true}; an error tells us it's not allowed after a reply)"

echo
echo "…waiting 27s (past the 25s cap). Typing should auto-vanish around 25s."
sleep 27
echo "3) Re-firing typing for the SAME message — 👀 WATCH again: does it re-appear?"
curl -sS "${auth[@]}" "$API" \
  -d "{\"messaging_product\":\"whatsapp\",\"status\":\"read\",\"message_id\":\"${MSGID}\",\"typing_indicator\":{\"type\":\"text\"}}"; echo

echo
echo "REPORT: (a) did 'typing…' show after the text in step 2, and for how long?"
echo "        (b) did step 3 make it re-appear (re-fire works) or nothing (hard 25s, one-shot)?"
