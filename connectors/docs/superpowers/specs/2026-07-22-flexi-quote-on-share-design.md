# Flexi (EasyBooking) — quote-on-share, fare breakdown, and test-mode fixes

**Date:** 2026-07-22
**Scope:** `ny-connectors/connectors` — the WhatsApp Quick Ride (internally `flexi`, NY
EasyBooking) flow. Minor, well-bounded changes on top of the merged EasyBooking swap.

## Goal

Three user-requested changes:

1. **Show the fare rate-card in the pickup-confirmation message** so the rider agrees to a
   concrete fare *before* the ride is booked.
2. **Get the quote before the rider confirms** — reorder so a shared location immediately
   prices the ride, and the Confirm tap only commits the booking.
3. **Fix ride-status pushes** (driver-accept / arrived / started / ended) not arriving in
   `NY_FIXED_USER_TOKEN` test mode, and get local **Redis** back up.

## Key enabling finding

EasyBooking zeroes the rate card in `quoteDetails.contents` (`baseFare=0`, `perExtraKmRate=0`,
…), but the **real values live in the quote's `quoteFareBreakup` array**, which the connector
currently discards in `getFlexiQuotes`. Verified from a live sandbox quote:

| `quoteFareBreakup` title | value | use |
|---|---|---|
| `BASE_FARE` | 36 | base (summed) |
| `DEAD_KILOMETER_FARE` | 10 | base (summed) |
| `EXTRA_PER_KM_FARE` | 28 | per-km |
| `NIGHT_SHIFT_CHARGE` | 1.5 | night multiplier |
| `NIGHT_SHIFT_START_TIME_IN_SECONDS` | 79200 | 79200/3600 = 22:00 = 10 PM |
| `NIGHT_SHIFT_END_TIME_IN_SECONDS` | 18000 | 18000/3600 = 5:00 = 5 AM |

The numbers shown to the rider are whatever the merchant's fare policy carries — in sandbox
they are test values; in prod they are the real seeded policy.

**Safety of the reorder:** EasyBooking driver dispatch fires on `confirmQuote`
(`SendSearchRequestToDrivers` runs post-confirm), *not* on `/rideSearch`. So pricing at
location-share pings **no drivers** — only the Confirm tap does.

## Change 1 — Reorder: search on share, book on confirm

Split the current `startFlexiSearch` (search → quote → **book** → poll) into two phases:

- **`handlePickup` (location shared)** → resolve origin → **search + poll quotes** → store
  `flexiQuoteId`, the parsed fare, and the quote `validTill` in ctx → render the confirm
  prompt with the fare. No quotes → existing `flexiNoAuto`.
- **`pickup_confirm` tap** → new `confirmFlexiBooking`: (re-search if the quote is stale, see
  Change 4) → send the "finding an auto" message with the fare re-stated → `confirmQuote`
  (book) → `registerRide` → poll for driver → driver card. (Same post-book logic as today.)

During the ~10s on-search wait after a share, send one short ack (`📍 Getting your fare…`)
so the rider isn't staring at silence. (Deliberate single line; easy to drop if unwanted.)

New/changed ctx fields (`states.ts`): add `flexiQuoteFare?: { startingFare?: number;
base?: number; perKm?: number; nightMult?: number; nightWindow?: string }` and
`flexiQuoteValidTill?: string`. `flexiQuoteId` already exists and already persists.

`sendPickupConfirm` renders the fare from `ctx.flexiQuoteFare` in **both** the normal and the
saved-place branches (so a re-render while in `CONFIRMING_PICKUP` still shows it).

## Change 2 — Fare breakdown line

**Data:** `getFlexiQuotes` also carries the fare breakup. Extend `NYFlexiQuote` with
`fareBreakup?: Record<string, number>` (title → amount, from `inner.quoteFareBreakup`).
`client.ts` stays a dumb pass-through.

**Presentation:** a pure builder (in `flexi-messages.ts`) turns the breakup map into the
display components, gracefully omitting missing parts:
- `base = (BASE_FARE ?? 0) + (DEAD_KILOMETER_FARE ?? 0)` (undefined if both absent)
- `perKm = EXTRA_PER_KM_FARE`
- `nightMult = NIGHT_SHIFT_CHARGE`, `nightWindow` = `fmt(start)–fmt(end)` from the two
  night-time fields (12-hour, e.g. `10PM–5AM`); omitted if any is missing.

**i18n:** one new function per bundle (6 languages),
`flexiFareBreakup(base?, perKm?, nightMult?, nightWindow?)`, that assembles the line and omits
absent parts. English (locked format):

```
🛺 ₹46 + ₹28/km · 10PM–5AM: 1.5× fare
```

If base+perKm are both absent, the builder returns empty and callers fall back to the quote's
`estimatedFare` ("from ₹X") or nothing — the ride is still bookable.

**Pickup-confirm prompt (English):**
```
📍 Your location: near *Test EasyBooking Origin*

🛺 ₹46 + ₹28/km · 10PM–5AM: 1.5× fare

Shall we go ahead?
```
Buttons: `[✅ Confirm pickup]` `[✏️ Change location]` (unchanged).

## Change 3 — Remove the "metered auto starting from ₹X" line; re-state fare in "finding"

- **Delete** the post-confirm `s.flexiStartingFare(...)` send (engine ~L1067) and remove the
  `flexiStartingFare` key from all 6 i18n bundles.
- The **"Finding an auto near you…"** message (`confirmFlexiBooking`) re-states the true fare
  on a second short line:
```
🛺 Finding an auto near you…
💰 ₹46 + ₹28/km · 10PM–5AM: 1.5× fare
```
Button: `[✋ Cancel search]` (unchanged). One message, not two.

## Change 4 — Quote expiry → silent re-search

Quotes are valid ~5 min (`validTill`). In `confirmFlexiBooking`, if
`now ≥ flexiQuoteValidTill` (minus a small buffer), transparently re-run `searchFlexi` +
`getFlexiQuotes`, pick the auto quote, and use the **fresh** `flexiQuoteId`/fare — the fare
re-stated in the "finding" message is then the fresh one. Safety net: if `confirmQuote` still
4xxs (raced expiry), re-search + confirm once more; if that fails, `flexiNoAuto`. No extra
rider-facing messages for the silent re-search.

## Change 5 — Ride-status pushes in `NY_FIXED_USER_TOKEN` test mode

**Root cause:** `RideTracker.processRide` reads the rider token via
`tokenStore.get(entry.userKey)`. In fixed-token mode the token is injected into `ctx.nyToken`
in the engine and never written to the token store, so `auth?.nyToken` is undefined every tick
and the tracker never polls. The rider only sees the driver when they message (synchronous
`handleStatus`). In production (real silent-auth/OTP) the token *is* stored, so the tracker
already works — this is a **test-mode-only** gap.

**Fix:** in `processRide`, when the store has no token, fall back to `config.nyFixedUserToken`
(mirrors the engine's own override). Guarded, test-only, no production behavior change.

## Redis (operational, no code change)

`REDIS_URL=redis://localhost:6379` in `.env` makes the store factory build Redis-backed
stores; with no Redis process running, ioredis floods `ECONNREFUSED`. It worked pre-EasyBooking
because a local Redis was running then. Fix = spin Redis back up
(`docker run -p 6379:6379 redis` or `brew services start redis`). Redis is *required* in prod
(boot guard) and *optional* locally (in-memory fallback). Redis being down does **not** cause
the missing pushes (Change 5 does).

## Tests / fixtures (behavior changes land here first)

- `mock-client.ts` `getFlexiQuotes`: add a representative `fareBreakup` map so the golden suite
  exercises the breakdown line.
- Flow snapshots: pickup-confirm now includes the fare line; the "finding" message includes the
  re-stated fare; the standalone "metered auto starting from" message is gone. Update
  `test/__snapshots__/*` and `migration/golden/flexi-happy-path.json` (message sequence changes;
  backend call sequence: search+quotes now happen at share, confirm at the Confirm tap).
- Add a unit test for the pure fare-breakdown builder (all-present, missing-night,
  missing-perkm, empty).
- `npm run typecheck` + `npm test` green; only reviewed snapshot diffs accepted.

## Non-goals

- No change to Regular (destination) flow.
- No change to the EasyBooking wire contract (search body, `onRentalCab` unwrap, confirm).
- Driver-side dispatch/seeding (Tiptur pool config etc.) is out of scope — separate operational
  issue.
- `NY_FIXED_USER_TOKEN` remains refused in prod; the tracker fallback is test-only.
