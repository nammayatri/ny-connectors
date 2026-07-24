import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  makeWorld, seedAuth, send, makePin, makeMessage, World,
  startWebhook, flushMicrotasks, sendWebhook, locationEnvelope, buttonEnvelope,
} from './harness';
import { MockNammaYatriClient } from '../src/ny/mock-client';

const FLEXI = 'pn_flexi';
const USER = '919361176218';

// The default MemorySessionManager stores context BY REFERENCE, so a concurrent
// handler's in-place mutation is visible to another handler holding the same
// object — which masks lost-update races. Production (Redis) SERIALIZES context
// (independent snapshots). This wraps the store to serialize on read+write so the
// interleaving tests below reproduce the real prod semantics.
function serializingWorld(): World {
  const w = makeWorld();
  const sm: any = w.session;
  const clone = (o: any) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const origUpdate = sm.updateContext.bind(sm);
  const origGet = sm.getSession.bind(sm);
  sm.updateContext = (s: any, u: any, ctx: any) => origUpdate(s, u, clone(ctx));
  sm.getSession = async (s: any, u: any) => {
    const sess = await origGet(s, u);
    return sess?.metadata ? { ...sess, metadata: clone(sess.metadata) } : sess;
  };
  return w;
}

// The flexi flow does blocking backend work (search at share, confirmQuote at
// confirm) while a "Cancel" can land as a separate inbound. These tests gate the
// in-flight backend call, land the cancel mid-flight, then release — the exact
// interleavings a sequential snapshot suite can't exercise.
describe('flexi cancel/interleaving safety (serialized store)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('a cancel during the share-time search aborts pricing — no confirm prompt is shown', async () => {
    const w = serializingWorld();
    await seedAuth(w, FLEXI, USER);

    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    vi.spyOn(MockNammaYatriClient.prototype, 'searchFlexi')
      .mockImplementation(async () => { await gate; return 'mock-flexi-search-1'; });

    const started = await startWebhook(w, locationEnvelope(FLEXI, USER, 13.34, 77.1));
    await flushMicrotasks();                                     // stall at the gated searchFlexi
    await sendWebhook(w, buttonEnvelope(FLEXI, USER, 'cancel')); // rider cancels mid-search
    release();
    await started.promise;

    // The cancel must win: no "Confirm pickup" prompt is resurrected after it.
    expect(w.connector.sent.some((r) => r.buttons?.some((b) => b.data === 'pickup_confirm'))).toBe(false);
  });

  it('cancels the phantom booking when a cancel lands during confirmQuote', async () => {
    const w = serializingWorld();
    await seedAuth(w, FLEXI, USER);
    await send(w, makePin(FLEXI, USER)); // share → priced → confirm prompt (fresh quote)

    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    vi.spyOn(MockNammaYatriClient.prototype, 'confirmQuote')
      .mockImplementation(async () => { await gate; return 'mock-booking-001'; });
    // Model the booking not being queryable yet, so handleCancel can't cancel it —
    // only the confirm handler's post-confirm abort can.
    vi.spyOn(MockNammaYatriClient.prototype, 'getActiveBookings').mockResolvedValue([]);
    const cancelSpy = vi.spyOn(MockNammaYatriClient.prototype, 'cancelRide');

    const started = await startWebhook(w, buttonEnvelope(FLEXI, USER, 'pickup_confirm'));
    await flushMicrotasks();                                     // stall at the gated confirmQuote
    await sendWebhook(w, buttonEnvelope(FLEXI, USER, 'cancel')); // rider cancels mid-booking
    release();
    await started.promise;

    // The live booking is cancelled by the confirm handler → no stranded driver.
    expect(cancelSpy).toHaveBeenCalledWith('mock-booking-001');
    // And nothing is left registered for tracking.
    expect(await w.registry.list()).toHaveLength(0);
  });
});

describe('flexi Cancel-search actually cancels the booking', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('cancels + de-registers a booking that getActiveBookings does NOT return (EasyBooking, no driver)', async () => {
    const w = makeWorld();
    await seedAuth(w, FLEXI, USER);
    await send(w, makePin(FLEXI, USER));                        // share → priced → confirm prompt
    await send(w, makeMessage(FLEXI, USER, 'pickup_confirm'));  // book → registered for tracking
    expect(await w.registry.list()).toHaveLength(1);

    // EasyBooking with no driver yet is absent from listV2 — but getBookingDetails
    // knows it. Without the direct-resolve fallback, Cancel would find nothing and
    // only reset locally, leaving the server ride live + the tracker polling.
    vi.spyOn(MockNammaYatriClient.prototype, 'getActiveBookings').mockResolvedValue([]);
    vi.spyOn(MockNammaYatriClient.prototype, 'getBookingDetails')
      .mockResolvedValue({ id: 'mock-booking-001', status: 'CONFIRMED', rideList: [] });
    const cancelSpy = vi.spyOn(MockNammaYatriClient.prototype, 'cancelRide');

    await send(w, makeMessage(FLEXI, USER, 'cancel'));

    // The known booking is cancelled server-side AND removed from the tracker.
    expect(cancelSpy).toHaveBeenCalledWith('mock-booking-001', 'CONFIRMED');
    expect(await w.registry.list()).toHaveLength(0);
  });
});
