/**
 * EasyBooking live smoke test — exercises the REAL NammaYatriClient (the same code
 * the WhatsApp flow uses) against a deployed Namma Yatri backend, so we can verify
 * the EasyBooking wire contract end-to-end without the WhatsApp layer.
 *
 * By DEFAULT it is READ-ONLY: authenticate → searchFlexi → poll getFlexiQuotes, and
 * prints the raw quote shape + the resolved quoteId/estimatedFare. It STOPS before
 * confirming, because `confirmQuote` books a real ride and DISPATCHES A REAL DRIVER.
 * Pass `--book` to also confirm + poll the booking (only on a sandbox/dev env, and
 * cancel the ride afterwards — the script prints the bookingId for that).
 *
 * Usage:
 *   NY_MOCK=0 \
 *   NY_BASE_URL=https://api.sandbox.moving.tech/dev/app/v2 \
 *   NY_AUTH_URL=https://api.sandbox.moving.tech/dev/app/v2 \
 *   NY_PRE_AUTH_TOKEN=<token> NY_MERCHANT_ID=<merchantId> \
 *   TEST_MOBILE=<registered 10-digit mobile> \
 *   npx ts-node scripts/easybooking-smoke.ts --lat <pickup> --lon <pickup> [--book]
 *
 * IMPORTANT: --lat/--lon must be inside your TEST DRIVER's operating city — the backend
 * resolves the city from this GPS (Bangalore 12.9352 77.6245 is the only city proven
 * end-to-end in the NY repo). NY_MERCHANT_ID is the merchant UUID (e.g. NAMMA_YATRI
 * 4b17bd06-ae7e-48e9-85bf-282fb310209c), NOT the short id.
 *
 * Exit code is non-zero if any expected part of the contract fails (so it can gate a
 * pre-deploy check). Nothing here is committed with real creds — all via env.
 */
import { NammaYatriClient, NYPlaceDetails } from '../src/ny/client';
import { config } from '../src/config';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Guardrails — this only makes sense against a real backend.
  if (config.nyMock) {
    console.error('✗ NY_MOCK is enabled — this smoke test must run against a real backend. Set NY_MOCK=0.');
    process.exit(2);
  }
  // --token <tok> (or NY_FIXED_USER_TOKEN) skips silent auth and uses a known rider
  // SESSION token directly — the fast path when you already have a valid user token.
  const fixedToken = arg('token') ?? process.env.NY_FIXED_USER_TOKEN;
  const mobile = process.env.TEST_MOBILE;
  if (!fixedToken) {
    const missing = [
      ['NY_PRE_AUTH_TOKEN', config.nyPreAuthToken],
      ['NY_MERCHANT_ID', config.nyMerchantId],
      ['TEST_MOBILE', mobile],
    ].filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) {
      console.error(`✗ Missing required env: ${missing.join(', ')}  (or pass --token <session-token> to skip auth)`);
      process.exit(2);
    }
  }

  // NO default pickup on purpose: the server resolves the operating city SOLELY from this
  // pickup GPS (EasyBooking search sends no city), so it must be inside YOUR test driver's
  // city. A wrong default would silently search the wrong pool and look like a dispatch bug.
  const latRaw = arg('lat') ?? process.env.TEST_LAT;
  const lonRaw = arg('lon') ?? process.env.TEST_LON;
  if (latRaw == null || lonRaw == null) {
    console.error(
      '✗ Pickup required: pass --lat <n> --lon <n> (or TEST_LAT/TEST_LON). The backend picks the\n' +
      '  operating city from THIS GPS — set it to your test driver\'s city (e.g. Bangalore 12.9352 77.6245).',
    );
    process.exit(2);
  }
  const lat = Number(latRaw), lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    console.error('✗ --lat/--lon must be numbers.');
    process.exit(2);
  }
  const origin: NYPlaceDetails = {
    lat, lon, placeId: '',
    address: { area: 'EasyBooking Smoke Test', city: '', country: 'India', state: '' },
  };

  console.log(`\n─── EasyBooking smoke test ───`);
  console.log(`base=${config.nyBaseUrl}  pickup=(${lat},${lon})  book=${has('book')}  auth=${fixedToken ? 'fixed-token' : 'silent'}\n`);

  // 1. Auth: use the supplied session token, or silent getToken for an existing rider.
  let token: string;
  if (fixedToken) {
    token = fixedToken;
    console.log(`✓ using supplied session token (${token.slice(0, 8)}…)`);
  } else {
    const auth = await NammaYatriClient.authenticate(mobile!);
    token = auth.token;
    console.log(`✓ authenticated  personId=${auth.personId}`);
  }
  const client = new NammaYatriClient(token);

  // 2. Search (EASY_BOOKING). A 4xx THROWS here (serviceability/city) — a distinct failure
  //    from "search ok but no quotes" (unseeded fare product), so diagnose it separately.
  let searchId: string;
  try {
    searchId = await client.searchFlexi(origin);
  } catch (e: any) {
    console.error(`\n✗ search failed: ${e?.message || e}`);
    console.error(
      `  A 4xx here means the pickup GPS is outside the merchant's service regions, or the resolved\n` +
      `  city has no operating city (RideNotServiceable / MerchantOperatingCityNotFound). Fix the pin/\n` +
      `  city — this is NOT "no quotes". (Note: if the merchant's origin geofencing is "Unrestricted",\n` +
      `  the server may ignore the GPS and use the merchant's default city instead.)`,
    );
    process.exit(1);
  }
  console.log(`✓ searchFlexi → searchId=${searchId}`);

  // 3. Poll results until quotes appear (always HTTP 200 + possibly-empty quotes[]).
  let quotes = [] as Awaited<ReturnType<NammaYatriClient['getFlexiQuotes']>>;
  for (let i = 0; i < 10; i++) {
    quotes = await client.getFlexiQuotes(searchId);
    if (quotes.length) break;
    process.stdout.write(`  …waiting for quotes (${(i + 1) * 2}s)\r`);
    await sleep(2000);
  }
  if (!quotes.length) {
    console.error(
      `\n✗ Search OK (HTTP 200) but NO EASY_BOOKING quotes after 20s. The city resolved fine but has\n` +
      `  no priced EASY_BOOKING product for this vehicle tier — i.e. the fare product isn't seeded/enabled\n` +
      `  (or its time-bounds don't cover now) for the resolved operating city. This is distinct from a\n` +
      `  4xx (wrong city/pin) above. See docs/easybooking.md → "The one real deploy dependency" for the\n` +
      `  driver-app fare_product ClickHouse check.`,
    );
    process.exit(1);
  }
  console.log(`\n✓ got ${quotes.length} quote(s):`);
  for (const q of quotes) {
    console.log(`    quoteId=${q.quoteId}  variant=${q.vehicleVariant}  startingFare=₹${q.estimatedFare}`);
  }
  const chosen = quotes.find((q) => q.vehicleVariant === 'AUTO_RICKSHAW') ?? quotes[0];
  console.log(`  → chosen: ${chosen.quoteId} (₹${chosen.estimatedFare})`);

  if (!has('book')) {
    console.log(
      `\n✓ READ-ONLY smoke PASSED. Search + results contract verified.\n` +
      `  (Pass --book to also confirm — WARNING: dispatches a REAL driver; cancel afterwards.)\n`,
    );
    return;
  }

  // 4. --book: confirm (REAL dispatch) → poll booking for driver + start OTP.
  console.log(`\n⚠️  --book: confirming quote in 5s — this DISPATCHES A REAL DRIVER. Ctrl-C to abort.`);
  await sleep(5000);
  const bookingId = await client.confirmQuote(chosen.quoteId);
  console.log(`✓ confirmQuote → bookingId=${bookingId}  (cancel this ride when done!)`);

  for (let i = 0; i < 30; i++) {
    const b = await client.getBookingDetails(bookingId).catch(() => null);
    const ride = b?.rideList?.[0];
    const otp = ride?.rideOtp || b?.rideOtp;
    console.log(`  poll ${i + 1}: status=${b?.status} rideStatus=${ride?.status} driver=${ride?.driverName || '-'} otp=${otp || '-'}`);
    if (ride?.driverName || ride?.rideOtp) {
      console.log(`✓ driver assigned; start OTP = ${otp} (from rideList[0].rideOtp)`);
      console.log(`  Booking ${bookingId} is LIVE — cancel it: client.cancelRide('${bookingId}')`);
      return;
    }
    await sleep(4000);
  }
  console.log(`ℹ︎ no driver assigned within the poll window; booking ${bookingId} left as-is — cancel it manually.`);
}

main().catch((e) => {
  console.error(`\n✗ smoke test failed: ${e?.message || e}`);
  process.exit(1);
});
