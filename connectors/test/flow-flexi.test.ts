import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeWorld, makeMessage, makePin, send, tick, structured } from './harness';

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

    // Share a pickup pin (inside the Tumkur geofence) → confirm prompt.
    const pin = await send(w, makePin(FLEXI, USER));
    expect(structured(pin)).toMatchSnapshot('2-pickup-confirm');
    expect(structured(pin)).toEqual([
      { kind: 'buttons', to: USER, merchant: 'FLEXI', buttons: ['pickup_confirm', 'pickup_adjust'] },
    ]);

    // Confirm pickup → search + confirm + driver card (mock returns a driver at once).
    const confirm = await send(w, makeMessage(FLEXI, USER, 'pickup_confirm'));
    expect(structured(confirm)).toMatchSnapshot('3-searching-and-driver-card');
    // The driver card carries a cancel button scoped to the booking.
    const card = confirm.find((r) => r.buttons?.some((b) => b.data.startsWith('cancel_confirm:')));
    expect(card).toBeTruthy();
    // A ride is now registered for tracking.
    expect(await w.registry.list()).toHaveLength(1);

    // --- Tracking (driven manually; the tracker timer is not started) ---
    // t+6s → driver arrived.
    await vi.advanceTimersByTimeAsync(6000);
    const arrived = await tick(w);
    expect(structured(arrived)).toMatchSnapshot('4-arrived');
    expect(arrived).toHaveLength(1);

    // t+12s → ride started (rental → End-ride OTP button present).
    await vi.advanceTimersByTimeAsync(6000);
    const started = await tick(w);
    expect(structured(started)).toMatchSnapshot('5-started');
    expect(started[0]?.buttons?.[0].data).toMatch(/^flexi_end_otp:/);

    // t+20s → ride completed (final fare) → session reset + registry cleared.
    await vi.advanceTimersByTimeAsync(8000);
    const ended = await tick(w);
    expect(structured(ended)).toMatchSnapshot('6-ended');
    expect(await w.registry.list()).toHaveLength(0);

    // Full copy snapshot of the whole lifecycle for wording-drift detection.
    expect(w.connector.sent).toMatchSnapshot('full-transcript');
  });
});
