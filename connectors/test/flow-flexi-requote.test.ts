import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeWorld, makeMessage, makePin, send } from './harness';
import { MockNammaYatriClient } from '../src/ny/mock-client';

const FLEXI = 'pn_flexi';
const USER = '919361176218';

// A quote is priced at pickup-share and only booked on the Confirm tap. Quotes are
// valid ~5 min; if the rider dawdles past that, confirmFlexiBooking must silently
// re-price (never confirm a stale quoteId). Fake timers make expiry deterministic.
describe('flexi quote expiry → silent re-search', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T00:00:00.000Z'));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('re-searches when the quote has expired before the rider confirms', async () => {
    const w = makeWorld();
    await send(w, makeMessage(FLEXI, USER, 'ride_type:flexi')); // auth → pickup request
    await send(w, makePin(FLEXI, USER));                        // search #1 → confirm prompt

    const searchSpy = vi.spyOn(MockNammaYatriClient.prototype, 'searchFlexi');
    const confirmSpy = vi.spyOn(MockNammaYatriClient.prototype, 'confirmQuote');

    // Rider takes >5 min → the stored quote (validTill = share + 5 min) is stale.
    vi.setSystemTime(new Date('2026-07-09T00:06:00.000Z'));
    const confirm = await send(w, makeMessage(FLEXI, USER, 'pickup_confirm'));

    // Stale quote → one fresh search before booking, then confirm the fresh quote.
    expect(searchSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // A driver card still lands (the booking succeeded on the re-priced quote).
    expect(confirm.some((r) => r.buttons?.some((b) => b.data.startsWith('cancel_confirm:')))).toBe(true);
  });

  it('re-searches a quote with no validTill once it passes the absolute age cap', async () => {
    const w = makeWorld();
    // Quote carries NO validTill → staleness must fall back to an absolute age cap
    // (from when the quote was captured), else a truly-old quoteId gets confirmed.
    vi.spyOn(MockNammaYatriClient.prototype, 'getFlexiQuotes').mockResolvedValue([
      { quoteId: 'q-no-validtill', serviceTierName: 'Auto', estimatedFare: 40, vehicleVariant: 'AUTO_RICKSHAW' },
    ]);
    await send(w, makeMessage(FLEXI, USER, 'ride_type:flexi'));
    await send(w, makePin(FLEXI, USER));

    const searchSpy = vi.spyOn(MockNammaYatriClient.prototype, 'searchFlexi');
    vi.setSystemTime(new Date('2026-07-09T00:06:00.000Z')); // >5 min after share
    await send(w, makeMessage(FLEXI, USER, 'pickup_confirm'));
    expect(searchSpy).toHaveBeenCalledTimes(1); // re-priced despite the absent validTill
  });

  it('does NOT re-search when the quote is still valid', async () => {
    const w = makeWorld();
    await send(w, makeMessage(FLEXI, USER, 'ride_type:flexi'));
    await send(w, makePin(FLEXI, USER));

    const searchSpy = vi.spyOn(MockNammaYatriClient.prototype, 'searchFlexi');
    // Confirm right away — the quote is fresh, so no re-price.
    await send(w, makeMessage(FLEXI, USER, 'pickup_confirm'));
    expect(searchSpy).not.toHaveBeenCalled();
  });
});
