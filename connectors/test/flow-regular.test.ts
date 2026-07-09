import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeWorld, makeMessage, makePin, send, tick, structured } from './harness';

const REG = 'pn_reg';
const USER = '919812345678'; // returning user (silent auth)

describe('regular (Ride with destination) book + track lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T00:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('prices a one-way auto (typed drop) and books + tracks it', async () => {
    const w = makeWorld();

    // Tap the book button → silent auth → pickup request (no fare line for regular).
    const tap = await send(w, makeMessage(REG, USER, 'ride_type:regular'));
    expect(structured(tap)).toEqual([{ kind: 'location_request', to: USER, merchant: 'REG' }]);

    // Pickup pin → confirm.
    const pin = await send(w, makePin(REG, USER));
    expect(structured(pin)).toEqual([
      { kind: 'buttons', to: USER, merchant: 'REG', buttons: ['pickup_confirm', 'pickup_adjust'] },
    ]);

    // Confirm pickup → regular asks for the DROP (location request).
    const dropPrompt = await send(w, makeMessage(REG, USER, 'pickup_confirm'));
    expect(structured(dropPrompt)).toEqual([{ kind: 'location_request', to: USER, merchant: 'REG' }]);

    // Type a drop address → place search → disambiguation options.
    const dropSearch = await send(w, makeMessage(REG, USER, 'Bus Stand'));
    expect(structured(dropSearch)).toMatchSnapshot('1-drop-options');
    expect(dropSearch[0]?.buttons?.every((b) => b.data.startsWith('regdrop:'))).toBe(true);

    // Pick a drop → estimate → fare confirmation.
    const fare = await send(w, makeMessage(REG, USER, 'regdrop:mock-place-1'));
    expect(structured(fare)).toMatchSnapshot('2-fare-confirm');
    const confirmBtn = fare.find((r) => r.buttons?.some((b) => b.data === 'regular_book'));
    expect(confirmBtn).toBeTruthy();

    // Book → select estimate → driver card.
    const booked = await send(w, makeMessage(REG, USER, 'regular_book'));
    expect(structured(booked)).toMatchSnapshot('3-booking-and-driver-card');
    expect(await w.registry.list()).toHaveLength(1);

    // --- Tracking ---
    // Regular's in-handler poll uses getActiveBookings (not getBookingDetails), so
    // the tracker's first getBookingDetails call is what starts the mock's
    // progression clock. Prime it with one tick (still 'assigned' → no new message),
    // then advance relative to that.
    const prime = await tick(w);
    expect(prime).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(6000);
    const arrived = await tick(w);
    expect(arrived).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(6000);
    const started = await tick(w);
    expect(structured(started)).toMatchSnapshot('4-started');

    await vi.advanceTimersByTimeAsync(8000);
    const ended = await tick(w);
    expect(structured(ended)).toMatchSnapshot('5-ended');
    expect(await w.registry.list()).toHaveLength(0);

    expect(w.connector.sent).toMatchSnapshot('full-transcript');
  });
});
