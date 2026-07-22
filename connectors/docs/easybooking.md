# EasyBooking — the "Quick Ride" booking mechanic

Authoritative reference for how the connector books a **Quick Ride** (internally `flexi`)
via Namma Yatri's **EasyBooking** product. This is the mechanic that replaced the old RENTAL
approach. Source of truth: **merged `nammayatri/main`** (PR
[#15753](https://github.com/nammayatri/nammayatri/pull/15753) merged 2026-07-20, commit
`6ca198b4` "backend/feat: Easybooking flow"), verified against the merged rider-app source
**and** the NY team's own end-to-end test collection
`Backend/dev/integration-tests/collections/EasyBookingRideFlow/01-EasyBookingRideFlow.json`.

> **Status:** the connector code is complete, mock-verified, and its wire format is verified
> byte-for-byte against merged main + the official integration test. EasyBooking is now on
> `main`; it goes live for riders once that build is **deployed to the environment `NY_BASE_URL`
> points at** AND an **`EASY_BOOKING` fare product is configured for the target city** (see
> "The one real deploy dependency" below). Against a backend without the fare product, an
> `EASY_BOOKING` search returns **HTTP 200 with an empty `quotes[]`** (not an error) — the rider
> just sees "no auto available."

## What EasyBooking is

A **destination-less, metered auto ride**. The rider shares only a pickup pin; there is no drop.
The fare is a metered Progressive tariff computed **server-side from the actual GPS distance
driven**, settled at ride end. It reuses the rental-shaped persistence/response envelope but is a
distinct trip category.

Key properties (all verified from the PR):

| Property | Value |
|---|---|
| Rider-app search variant | `SearchReq = … \| EasyBookingSearch EasyBookingSearchReq` (`SharedLogic/Search.hs:61`) |
| Wire discriminator | `fareProductType: "EASY_BOOKING"` (`fareProductConstructorModifier`, `SharedLogic/Search.hs:87`) |
| Request payload | `EasyBookingSearchReq` = `origin` + `startTime` required; `isSourceManuallyMoved?`, `isSpecialLocation?`, `quotesUnifiedFlow?`, `isReallocationEnabled?`, `numberOfLuggages?` optional (`SharedLogic/Search.hs:167`) |
| Destination | **None** — origin-only |
| Result type | **Quote-based** (`quotes[]`, `EasyBookingQuoteDetails { quoteId }`, `OnSearch.hs:317`), not estimate-based |
| Rate card | `quoteDetails.contents` is **zeroed** server-side (`buildEasyBookingDetails` sets `baseFare = perExtraKmRate = perHourCharge = 0`, `OnSearch.hs:703`) — BUT the real rate-card values survive in the quote's **`quoteFareBreakup[]`** (title→amount: `BASE_FARE`, `DEAD_KILOMETER_FARE`, `EXTRA_PER_KM_FARE`, `NIGHT_SHIFT_CHARGE`, `NIGHT_SHIFT_START/END_TIME_IN_SECONDS`, …). That array is what we display. |
| Fare shown pre-ride | a fare rate-card line built from `quoteFareBreakup` — `🛺 ₹<BASE+DEAD_KM> + ₹<EXTRA_PER_KM>/km · <night window>: <NIGHT_SHIFT_CHARGE>× fare` — shown on the pickup-confirm prompt (fallback: `from ₹<estimatedFare>` when no breakup). |
| Final fare | computed from actual GPS distance at ride end (Progressive fare policy); read from the completed booking |
| Rider end-OTP | **None** — `isEndOtpRequired EasyBooking = False`; the driver ends the ride |
| Customer origination guard | **None** (unlike MeterRide's `"only meter dummy guy"` guard) — a normal rider can originate it |

## The request the connector sends

`searchFlexi` (`src/ny/client.ts`) — `POST {NY_BASE_URL}/rideSearch`:

```json
{
  "contents": {
    "origin": { "gps": { "lat": <n>, "lon": <n> }, "address": { "area": "...", "city": "...", "country": "India", "building": "...", "placeId": "...", "state": "..." } },
    "isSourceManuallyMoved": false,
    "startTime": "<ISO-8601 now>"
  },
  "fareProductType": "EASY_BOOKING"
}
```

Then:
- `GET /rideSearch/{searchId}/results` → read `data.quotes[]`; unwrap **`onRentalCab || onDemandCab`**;
  take `id` (→ `quoteId`), `estimatedTotalFare ?? estimatedFare`, the `quoteFareBreakup[]` (→ `fareBreakup`
  map, via `parseQuoteFareBreakup`), and `validTill` (used to silently re-search a stale quote at confirm).
  **Verified:** an EasyBooking quote is destination-less, so the rider-app wraps it as `onRentalCab`
  — there is **no `onEasyBookingCab`** key (we keep it first in our chain only as a harmless
  forward-compat guard). The NY team's own test reads `quotes[i].onRentalCab || quotes[i].onDemandCab`
  and asserts `inner.tripCategory` includes `"EasyBooking"`. Since this connector only ever issues
  `EASY_BOOKING` searches, `onRentalCab` is unambiguous for us; only disambiguate on
  `tripCategory.tag === "EasyBooking"` if Rental and EasyBooking ever coexist in one flow.
  `/results` **always returns HTTP 200 with a (possibly empty) `quotes[]`** — there is no
  "searchCompleted" flag, so "still gathering" and "no serviceable fare product" look identical.
  We poll (10×2s) until quotes appear, else fall through to "no auto available".
- `POST /rideSearch/quotes/{quoteId}/confirm` with `{}` → `bookingId`. This single call is enough to
  trigger driver dispatch — **no rider-side init/select/payment step** (confirm fires Beckn `init`
  internally; `confirm` goes on `on_init`). Response also carries `confirmTtl` (we ignore it; we
  confirm immediately).
- `POST /rideBooking/{bookingId}` (empty body) → poll until `rideList` appears, then read driver +
  `rideList[0].rideOtp` (see OTP note below).

## How the rider experiences it (fare + OTP)

- **Flow ordering:** the quote is searched when the rider **shares the pin** (not on confirm) —
  EasyBooking search is quote-only and dispatches **no driver** (only `confirmQuote` does), so
  pricing before the rider commits is safe. The pickup-confirm prompt states the fare; tapping
  **Confirm** books (`confirmQuote`). If the quote has expired (`validTill`, ~5 min) the confirm
  handler silently re-searches and books the fresh quote.
- **Pre-ride fare:** a fare rate-card line built from `quoteFareBreakup` via `buildFlexiFareLine`
  (`src/flow/flexi-messages.ts`), e.g. `🛺 ₹46 + ₹28/km · 10PM–5AM: 1.5× fare` (`flexiFareBreakup`
  i18n key). Base = `BASE_FARE + DEAD_KILOMETER_FARE`; per-km = `EXTRA_PER_KM_FARE`; the night window
  is derived from `NIGHT_SHIFT_START/END_TIME_IN_SECONDS` and the multiplier from `NIGHT_SHIFT_CHARGE`;
  missing parts are omitted. It is shown on the confirm prompt AND re-stated in the "finding an auto"
  message. Fallback when a quote has no breakup: `from ₹<estimatedFare>` (`flexiFareFrom`).
- **Start OTP:** the ride-level `rideList[0].rideOtp` (a plain, category-independent start OTP,
  populated once a driver is assigned). The rider shows it to the driver, who enters it at ride
  start. `buildDriverCard` reads `rideList[0].rideOtp || booking.rideOtp` and renders it only when
  present. **Do NOT** read `bookingDetails.contents.otpCode` for EasyBooking — that slot is the
  special-zone/airport OTP and is `null` here (verified from merged source).
- **End of ride:** **no** "End ride" button and no rider end-OTP. The driver ends the ride; the
  tracker pushes the "ride started" (plain) then "ride complete" (with the server final fare) updates.

## Connector delta vs the old RENTAL path

- `searchFlexi`: body changed from `fareProductType: "RENTAL"` + `estimatedRentalDistance/Duration`
  to `fareProductType: "EASY_BOOKING"` (origin + startTime only).
- Removed config `FLEXI_RENTAL_DISTANCE_KM` / `FLEXI_RENTAL_DURATION_MIN` and the display tariff
  `FLEXI_BASE_FARE` / `FLEXI_PER_KM` (fare is now the dynamic quote `estimatedFare`).
- Removed the rental-only **End-ride OTP** feature (the `flexi_end_otp:` handler, the button, and
  the `flexiEndOtp*` / `flexiRideStarted` / `flexiRideAlreadyEnded` i18n keys). `buildStarted` is now
  a plain "ride started" message for both Quick Ride and Regular.
- The mock (`NY_MOCK`) no longer emits `endOtp`.
- Internal `flexi*` names, states, the results-parse, confirm, tracking, and the whole
  post-assignment surface are unchanged.

## The one real deploy dependency — EASY_BOOKING fare product for the city

EasyBooking dispatch is driven by the **driver-app** having an `EASY_BOOKING` **fare product**
(+ a Progressive **fare policy**) configured for the target **merchant operating city**. The
rider-app search has **no serviceability/role guard** for EasyBooking — if the city has no such
fare product, `/results` simply returns **HTTP 200 with empty `quotes[]`**, and the rider sees
"no auto available" (indistinguishable from "no drivers online"). This is the single most likely
reason a correct deploy would still not book.

Config lives in the driver-app DB (`atlas_driver_offer_bpp.fare_product`, keyed on
`merchant_operating_city_id` + `trip_category` + `vehicle_variant` + `enabled`). Check it for the
Tumakuru driver MOC (`c98da615-0515-4d93-8e12-1253e5b369a2`) before go-live:

```sql
-- read-only ClickHouse (http://34.47.188.201:8123/?readonly=1)
SELECT DISTINCT merchant_operating_city_id, trip_category, vehicle_variant, enabled, area
FROM atlas_driver_offer_bpp.fare_product
WHERE merchant_operating_city_id = 'c98da615-0515-4d93-8e12-1253e5b369a2'
  AND trip_category ILIKE '%EasyBooking%';
```

Empty result ⇒ the driver-app team must add an EasyBooking fare product + Progressive fare policy
for that city (and vehicle tier, e.g. `AUTO_RICKSHAW`) before WhatsApp Quick Ride can book there.

## Pre-live verification — what's proven vs what still needs a live run

**Proven (merged source + the NY team's `EasyBookingRideFlow` integration test):** the search body,
the `onRentalCab` quote wrapper + `id`/`estimatedTotalFare` fields, the `tripCategory == EasyBooking`
marker, empty-`quotes` polling semantics, `confirm` (body `{}`) → `bookingId`, single-confirm dispatch
(no init/select/payment), `rideList[0].rideOtp` as the start OTP, and driver-ended / no rider end-OTP.
**The connector wire format matches byte-for-byte; no code change is outstanding.**

**Still needs a live run against a deployed backend (`NY_MOCK=0`):**

1. The target env actually has the EASY_BOOKING fare product for the city (query above), so a real
   search returns a quote within the poll window.
2. A real driver-assigned booking exposes `rideList[0].rideOtp`, and the final `computedPrice` +
   `chargeableRideDistance` populate on COMPLETED (values are env-specific, not contract facts).

The fastest way to exercise (1)+(2) without the WhatsApp layer: run the NY team's own collection
`Backend/dev/integration-tests/collections/EasyBookingRideFlow/01-EasyBookingRideFlow.json`
(newman) against the stack, or the read-only `scripts/easybooking-smoke.ts` in this repo (search +
results only; it does **not** confirm/book unless `--book` is passed).

## References

- Merged: nammayatri `main` @ `6ca198b4` (PR
  [#15753](https://github.com/nammayatri/nammayatri/pull/15753), merged 2026-07-20)
- **Integration test (canonical E2E):**
  `Backend/dev/integration-tests/collections/EasyBookingRideFlow/01-EasyBookingRideFlow.json`
- `.../rider-app/Main/src/SharedLogic/Search.hs` — `SearchReq`, `EasyBookingSearchReq`, `EASY_BOOKING` tag
- `.../rider-app/Main/src/Domain/Action/UI/Quote.hs` — `OfferRes` (no `onEasyBookingCab`; EasyBooking → `onRentalCab`)
- `.../rider-app/Main/src/Domain/Action/Beckn/OnSearch.hs` — `buildEasyBookingDetails` (zeroed rate card)
- `.../beckn-spec/src/Domain/Types/Trip.hs` — `TripCategory = … | EasyBooking EasyBookingMode`; `isEndOtpRequired (EasyBooking _) = False`
- Connector: `src/ny/client.ts` (`searchFlexi`/`getFlexiQuotes`), `src/flow/engine.ts` (`startFlexiSearch`), `src/flow/flexi-messages.ts` (`buildDriverCard`)
- `Backend/app/rider-platform/rider-app/Main/src/SharedLogic/Search.hs` — `SearchReq`, `EasyBookingSearchReq`, `fareProductConstructorModifier`
- `Backend/app/rider-platform/rider-app/Main/src/Domain/Action/Beckn/OnSearch.hs` — `EasyBookingQuoteDetails`, `buildEasyBookingDetails` (zeroed rate card)
- Connector: `src/ny/client.ts` (`searchFlexi`/`getFlexiQuotes`), `src/flow/engine.ts` (`startFlexiSearch`), `src/flow/flexi-messages.ts` (`buildStarted`/`buildDriverCard`)
