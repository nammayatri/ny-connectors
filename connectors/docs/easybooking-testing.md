# EasyBooking — live end-to-end test runbook

How to test the WhatsApp Quick Ride (EasyBooking) flow against a **deployed** Namma Yatri backend,
including the full loop with a real test-driver APK. Source-verified against merged `nammayatri/main`
(@`6ca198b4`) + the NY team's own integration test
`Backend/dev/integration-tests/collections/EasyBookingRideFlow/01-EasyBookingRideFlow.json`.

## The one fact that governs everything

The rider's search **operating city is chosen server-side from the pickup GPS + the auth token's
merchant** — not by `NY_CITY`, not by the connector. `searchFlexi` posts only
`{fareProductType:"EASY_BOOKING", contents:{origin:{gps,address}, startTime, isSourceManuallyMoved:false}}`.
So three things must resolve to the **same MerchantOperatingCity on the same env**:

1. the rider's **pickup GPS**,
2. the **test driver's operating city** (as provisioned in the APK), and
3. a seeded, enabled **`EASY_BOOKING` + matching vehicle-tier fare product** for that city.

Every failure mode below is a corollary. **Caveat:** "pickup GPS decides the city" holds only if the
rider merchant's origin geofencing is configured as **Regions** (polygons). If it's **Unrestricted**,
the server ignores the GPS and uses the merchant's **default city** — so the pin can't steer the city.
Treat GPS→city as an assumption to verify (run Stage 1 at two different-city pins and see if the quotes
differ), not a fact.

## Two test vehicles — don't conflate

| Vehicle | Runs against | Needs a driver? | Purpose |
|---|---|---|---|
| **Smoke script** `scripts/easybooking-smoke.ts` | a **deployed** env (pilot/sandbox) | No (read-only default) | Drives the *real* `NammaYatriClient` — the same code the WhatsApp flow uses. **Use this for the first real test.** |
| **Integration test** `EasyBookingRideFlow/01-…json` | a **local full stack** (`localhost:8013/8016/8081/8018`) | Yes — onboards its own driver via dashboard | Gold-standard driver+rider sequence; the source of every step name here. Its dashboard-onboarding steps can't run against a deployed env. |

## Staged ladder — cheapest, most-isolating first

Each stage rules out a whole class of failure before you spend a live driver.

| Stage | What it proves | Rider creds | Registered rider | Matched driver on APK | Real booking? |
|---|---|---|---|---|---|
| **0 — Reachability (DONE)** | routes mounted + auth-gated | – | – | – | No |
| **1 — Authed search (no driver)** | auth + handler + city has a priced EASY_BOOKING product → returns a **quote** | ✅ | ✅ | – | **No (read-only)** |
| **2 — Full loop (+ driver APK)** | dispatch reaches a driver, OTP populates in `rideList[0].rideOtp`, start/end, final metered fare | ✅ | ✅ | ✅ | **Yes** |
| **3 — Over real WhatsApp** | UX only (no new backend coverage) | ✅ | ✅ | ✅ | **Yes** |

**Stage 0 result (already run):** `POST {base}/rideSearch` → 401, `GET {base}/rideSearch/{id}/results`
→ 400, on **both** `api.moving.tech/pilot/app/v2` and `api.sandbox.moving.tech/dev/app/v2`. Proves the
routes are deployed and auth-gated; proves **nothing** about fare-product config or dispatch.

A **Stage-1 pass + Stage-2 dispatch fail ⇒ a driver/dispatch problem, not a backend/config one.** That
separation is the whole point of the ladder.

## Inputs needed (none are in the repo — all env-injected)

- **Env** — pilot (`https://api.moving.tech/pilot/app/v2`) **or** sandbox
  (`https://api.sandbox.moving.tech/dev/app/v2`). The connector **and** the driver APK must be on the
  **same** env (isolated datastores), or search succeeds but no driver ever sees the request. Set both
  `NY_BASE_URL` and `NY_AUTH_URL` — they default independently to pilot.
- **`NY_PRE_AUTH_TOKEN`** — the `token:` header on the internal `getToken` (`client.ts:275`). Per-env.
- **`NY_MERCHANT_ID`** — the **merchant UUID** (rider `NAMMA_YATRI` = `4b17bd06-ae7e-48e9-85bf-282fb310209c`
  on pilot). **Not the short id.** The internal `getToken` matches `merchantId` directly against
  `person.merchantId` (a UUID); passing `NAMMA_YATRI` returns `PersonDoesNotExist`. (The integration
  test's `merchantId=NAMMA_YATRI` hits the *public* `/auth` registration endpoint, a different handler —
  it does not apply here.)
- **`TEST_MOBILE`** — a 10-digit rider that has **completed at least one real OTP login (a verified
  token)** on the chosen env+merchant. Silent `authenticate` is a `getToken` for an existing verified
  person only — no SMS; a half-onboarded number fails with `No verified auth token found`. Riders are
  per-env (a pilot rider doesn't exist on sandbox). Sign up via the real NY rider app on that env, or
  use the connector's one-time OTP onboarding (needs `NY_DASHBOARD_*` + `NY_CITY`).
- **The DRIVER PROFILE's operating city + merchant + vehicle variant** (from the APK). These must equal
  the rider's search city + the seeded product, or dispatch silently never matches. **Prefer Bangalore**
  — it's the only city proven end-to-end in the repo (the integration test + `Local_NY_Bangalore` env:
  merchant `NAMMA_YATRI_PARTNER` `7f7896dd-787e-4a0b-8675-e9e6fe93bb8f`, `AUTO_RICKSHAW`, pickup
  `12.9352, 77.6245`). Tumakuru EASY_BOOKING seeding is asserted only in a code comment, not a migration
  — verify it with the ClickHouse check before choosing Tumakuru.

## Stage 1 — the command (read-only, no booking, no driver)

```bash
NY_MOCK=0 \
NY_BASE_URL=<env>/app/v2  NY_AUTH_URL=<env>/app/v2 \
NY_PRE_AUTH_TOKEN=<token>  NY_MERCHANT_ID=4b17bd06-ae7e-48e9-85bf-282fb310209c \
TEST_MOBILE=<verified-10-digit> \
npx ts-node scripts/easybooking-smoke.ts --lat 12.9352 --lon 77.6245
```

`<env>` = `https://api.moving.tech/pilot` or `https://api.sandbox.moving.tech/dev`. **Set the pickup to
your driver's city** (Bangalore shown). Success = `✓ got N quote(s)  variant=AUTO_RICKSHAW  startingFare=₹…`.
The script now **requires** an explicit `--lat/--lon` (no default) so you can't accidentally search the
wrong city.

> The connector's `getFlexiQuotes` drops `tripCategory` from its return, so to confirm the quote is
> genuinely EasyBooking (as the integration test asserts), read the `[ny-api] ← response body` dev log
> and check `quotes[i].onRentalCab.tripCategory.tag == "EasyBooking"`.

## Stage 2 — the full loop (rider + driver APK)

**Order matters: the driver goes online with a fresh GPS fix at the pickup BEFORE the rider searches** —
dispatch is proximity-gated and the request row is valid only ~60s. Driver-column step names are from
`01-EasyBookingRideFlow.json`; on a real APK they are human taps hitting the same endpoints.

| # | RIDER (smoke `--book` / WhatsApp) | DRIVER APK (human taps) | Success check |
|---|---|---|---|
| **D0** | — | *(one-time)* onboard: add **AUTO_RICKSHAW** vehicle + **Enable** + **Subscribe Plan** (skip if pre-provisioned) | `driverInfo.enabled=True`, `subscribed=True` (`Driver.hs`) |
| **D1** | — | **Go Online** | `setActivity?active=true&mode="ONLINE"` → 200 (mode is JSON-quoted). Throws if not enabled/subscribed |
| **D2** | — | **App foregrounded, live GPS at the pickup city** | LTS `/driver/location` (`vt=AUTO_RICKSHAW`) → 200; fix must be recent + in-geofence + variant-matched |
| **R1** | Run **Stage 1** first (go/no-go) | *(waiting online)* | non-empty quote list before you spend the driver |
| **R2** | `--book` (or WhatsApp pin) → `searchFlexi`→poll→`confirmQuote`→`bookingId` | — | quote ≤20s (poll 10×2s); `bookingId` non-null; single confirm triggers dispatch (no init/select/payment) |
| **R3** | *(rider polls up to 180s)* | **Incoming request card → ACCEPT** | `searchRequest/quote/respond {"searchTryId":…,"offeredFare":null,"response":"Accept"}` → 200. No `quoteId`; fare ignored (static offer) |
| **R4** | Rider sees **driver card + Start OTP** (`rideList[0].rideOtp`) | — | OTP populates **on accept**, in `rideList[0].rideOtp` — not `bookingDetails.otpCode` |
| **R5** | Rider tells the driver the OTP in person | **Enter OTP → Start** | `driver/ride/{id}/start {"rideOtp":…}` → 200, INPROGRESS (OTP enforced regardless of category) |
| **R6** | Rider sees "ride started" (no rider end-OTP) | **End** | `driver/ride/{id}/end` → 200, COMPLETED (no end-OTP for EasyBooking) |
| **R7** | Rider sees "🎉 Ride complete · ₹X" | — | final metered fare computed from GPS distance |

`--book` opens a 5s abort window, then confirms and polls 30×4s for `rideList[0].rideOtp`/`driverName`.
**It does not auto-cancel** — cancel any dangling booking. Run `--book` only with the driver ready (D0–D2
done); otherwise it just proves confirm returns a `bookingId` and leaves a live booking.

## Failure triage — three distinct symptoms

| Symptom (from the smoke script) | Meaning | Fix |
|---|---|---|
| **search THROWS 4xx** (`✗ search failed: … 4xx`) | pickup GPS outside the merchant's service regions, or resolved city has no operating city (`RideNotServiceable` / `MerchantOperatingCityNotFound`) — **or** merchant geofencing is Unrestricted and defaulted to the wrong city | fix the **pin/city**; verify merchant origin geofencing = Regions with a polygon over the pin |
| **200 + empty quotes** (`✗ Search OK … NO EASY_BOOKING quotes`) | city resolved, but **no priced EASY_BOOKING product** for this vehicle tier (unseeded/disabled, or time-bounds don't cover now) | seed/enable the fare product (ClickHouse check below) |
| **quotes appear, then 180s driver timeout** → `flexiNoAuto` | backend+config OK; **dispatch** didn't reach a matched driver | env mismatch (#), driver not online/near/wrong-variant, or accepted after 3 min |

### Ranked blockers

1. **Env mismatch** (connector ↔ APK on different envs; per-env tokens/merchant). BLOCKER.
2. **Rider city ≠ driver city.** The connector's own geofence (`cities.ts`) is cosmetic + fail-open; the
   server picks the city from `origin.gps` (subject to the Regions/Unrestricted caveat above). BLOCKER.
3. **Fare product not seeded/enabled** for the driver MOC + variant + area + current time. BLOCKER.
4. **Driver not ONLINE / not near pickup / wrong variant / stale GPS** before the rider searches. BLOCKER.
5. **Timing:** quote ≤20s, driver accept ≤180s, request row valid ~60s. Slow env → retry. HIGH.
6. **Auth/token:** valid per-env `NY_PRE_AUTH_TOKEN`; `NY_MERCHANT_ID` = UUID. HIGH.
7. **Vehicle-variant mismatch:** connector picks `AUTO_RICKSHAW` else `quotes[0]`; seeded variant must
   equal the driver's variant. HIGH.
8. **Clock skew:** `startTime` is the connector host clock. If it runs ahead of the backend by more than
   the MOC's `scheduleRideBufferTime`, the search is classified **scheduled** (no immediate dispatch); if
   it lags > 2 min, the rider-app 4xx's the search. NTP-sync the host. MEDIUM.
9. **WhatsApp only:** `ALLOWED_PHONES` gate (add the tester's number or set empty); `FLEXI_SERVICE_AREA`
   geofence (match the driver's city or unset); new-rider one-time OTP (re-share the pin after verify).

### Fare-product check (read-only ClickHouse, driver/BPP MOC)

```sql
-- http://34.47.188.201:8123/?readonly=1   (Bangalore MOC shown; swap for your driver's MOC)
SELECT vehicle_variant, area, trip_category, search_source, enabled, time_bounds
FROM atlas_driver_offer_bpp.fare_product
WHERE merchant_operating_city_id = '<driver-MOC-uuid>'
  AND trip_category LIKE '%EasyBooking%';
```

Want: a row with `vehicle_variant='AUTO_RICKSHAW'`, `enabled=1`, `search_source IN ('ALL','MOBILE_APP')`,
`area` covering the pickup, and `time_bounds` **covering the test time** (an `enabled=1` row with a
time-restricted `time_bounds` that excludes now still won't price → empty quotes). Empty result ⇒ the
driver-app team must seed the product. (Confirm this table is mirrored to the ClickHouse replica; if not,
read it from the BPP dashboard.)

## References

- Gold standard: `nammayatri` @`origin/main` →
  `Backend/dev/integration-tests/collections/EasyBookingRideFlow/01-EasyBookingRideFlow.json`
  (+ `.../Local/Local_NY_Bangalore.postman_environment.json`)
- Connector: `scripts/easybooking-smoke.ts`, `src/ny/client.ts`
  (`authenticate:265`, `searchFlexi:489`, `getFlexiQuotes:526`, `confirmQuote:556`), `src/flow/engine.ts`
  (`startFlexiSearch:988`, quote poll `1020`, driver poll `1082`), `src/ny/cities.ts`, `src/config.ts:139`
- Wire-format reference: `docs/easybooking.md`
