import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeWorld, makeMessage, makePin, send, tick, structured } from './harness';
import { MockNammaYatriClient } from '../src/ny/mock-client';

const FLEXI = 'pn_flexi';
const USER = '919361176218'; // returning user (silent auth)

// The whole flexi lifecycle is one test: the mock keys ride progression by
// bookingId in module-level state, so a second booking in the same file would
// reuse the first ride's timeline. Fake timers make the tracker's Date.now()-
// based arrived→started→ended progression deterministic.
describe('flexi (Quick Ride) book + track lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T00:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('books a metered ride and pushes arrived → started → ended', async () => {
    const w = makeWorld();

    // Tap Quick Ride → silent auth → pickup request.
    const tap = await send(w, makeMessage(FLEXI, USER, 'ride_type:flexi'));
    expect(structured(tap)).toMatchSnapshot('1-pickup-request');
    expect(tap.some((r) => r.kind === 'location_request')).toBe(true);

    // Search happens on the SHARE (prices the ride before the rider commits);
    // the booking dispatch happens only on the Confirm tap.
    const searchSpy = vi.spyOn(MockNammaYatriClient.prototype, 'searchFlexi');
    const confirmSpy = vi.spyOn(MockNammaYatriClient.prototype, 'confirmQuote');

    // Share a pickup pin (inside the Tumkur geofence) → search → confirm prompt
    // that already states the real fare rate-card.
    const pin = await send(w, makePin(FLEXI, USER));
    expect(structured(pin)).toMatchSnapshot('2-pickup-confirm');
    expect(structured(pin)).toEqual([
      { kind: 'text', to: USER, merchant: 'FLEXI' }, // "getting your fare…" ack
      { kind: 'buttons', to: USER, merchant: 'FLEXI', buttons: ['pickup_confirm', 'pickup_adjust'] },
    ]);
    // Searched but NOT yet booked — no driver dispatched at share time.
    expect(searchSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).not.toHaveBeenCalled();
    // The confirm prompt carries the fare breakdown from the quote's breakup.
    const prompt = pin.find((r) => r.buttons?.some((b) => b.data === 'pickup_confirm'));
    expect(prompt?.text).toContain('₹40 + ₹12/km');

    // Confirm pickup → book (confirmQuote) + driver card (mock returns a driver at once).
    const confirm = await send(w, makeMessage(FLEXI, USER, 'pickup_confirm'));
    expect(structured(confirm)).toMatchSnapshot('3-searching-and-driver-card');
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // The "finding an auto" message re-states the true fare; the standalone
    // "Metered auto · starting from ₹X" line is gone.
    const finding = confirm.find((r) => r.buttons?.some((b) => b.data === 'cancel'));
    expect(finding?.text).toContain('₹40 + ₹12/km');
    expect(confirm.every((r) => !/Metered auto|starting from/i.test(r.text))).toBe(true);
    // The driver card carries a cancel button scoped to the booking.
    const card = confirm.find((r) => r.buttons?.some((b) => b.data.startsWith('cancel_confirm:')));
    expect(card).toBeTruthy();
    // A ride is now registered for tracking.
    expect(await w.registry.list()).toHaveLength(1);

    searchSpy.mockRestore();
    confirmSpy.mockRestore();

    // --- Tracking (driven manually; the tracker timer is not started) ---
    // t+6s → driver arrived.
    await vi.advanceTimersByTimeAsync(6000);
    const arrived = await tick(w);
    expect(structured(arrived)).toMatchSnapshot('4-arrived');
    expect(arrived).toHaveLength(1);

    // t+12s → ride started (EasyBooking is driver-ended → plain message, no button).
    await vi.advanceTimersByTimeAsync(6000);
    const started = await tick(w);
    expect(structured(started)).toMatchSnapshot('5-started');
    expect(started[0]?.buttons).toBeUndefined();

    // t+20s → ride completed (final fare) → session reset + registry cleared.
    await vi.advanceTimersByTimeAsync(8000);
    const ended = await tick(w);
    expect(structured(ended)).toMatchSnapshot('6-ended');
    expect(await w.registry.list()).toHaveLength(0);

    // Full copy snapshot of the whole lifecycle for wording-drift detection.
    expect(w.connector.sent).toMatchSnapshot('full-transcript');
  });

  // In-repo coverage for the 401 re-auth path (the golden token-expiry-reauth fixture
  // lives outside the repo and is skipped in CI, so this gates the behavior in CI).
  it('clears the auth token on a 401 during search, so the next booking re-authenticates', async () => {
    const w = makeWorld();
    const userKey = 'whatsapp:FLEXI:919361176218';

    // Existing rider taps Quick Ride → silent auth stores a token.
    await send(w, makeMessage(FLEXI, USER, 'ride_type:flexi'));
    expect(await w.tokenStore.get(userKey)).not.toBeNull();

    // Share pickup → confirm prompt.
    await send(w, makePin(FLEXI, USER));

    // Confirm pickup, but confirmQuote 401s (token expired mid-search).
    const confirmSpy = vi.spyOn(MockNammaYatriClient.prototype, 'confirmQuote')
      .mockRejectedValue(new Error('Request failed 401'));
    const authSpy = vi.spyOn(MockNammaYatriClient, 'authenticate');
    const noAuto = await send(w, makeMessage(FLEXI, USER, 'pickup_confirm'));

    // The 401 must CLEAR the stored token (so the next message re-auths) and land on a
    // [book] Try-again — not loop on the dead token.
    expect(await w.tokenStore.get(userKey)).toBeNull();
    expect(noAuto.some((r) => r.buttons?.some((b) => b.data === 'book'))).toBe(true);

    // Tap Book again → a fresh authenticate() runs (proving re-auth) and re-stores a token.
    confirmSpy.mockRestore();
    const authCallsBefore = authSpy.mock.calls.length;
    await send(w, makeMessage(FLEXI, USER, 'book'));
    expect(authSpy.mock.calls.length).toBeGreaterThan(authCallsBefore);
    expect(await w.tokenStore.get(userKey)).not.toBeNull();

    vi.restoreAllMocks();
  });
});
