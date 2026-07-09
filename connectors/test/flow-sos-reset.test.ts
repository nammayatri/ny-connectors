import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeWorld, makeMessage, makePin, send, tick, World } from './harness';
import { FlowContext } from '../src/flow/states';

const FLEXI = 'pn_flexi';
const USER = '919361176218';

async function bookFlexi(w: World): Promise<void> {
  await send(w, makeMessage(FLEXI, USER, 'ride_type:flexi'));
  await send(w, makePin(FLEXI, USER));
  await send(w, makeMessage(FLEXI, USER, 'pickup_confirm'));
}

async function sessionCtx(w: World): Promise<FlowContext> {
  const sess = await w.session.getSession('whatsapp', `FLEXI:${USER}`);
  return sess!.metadata as FlowContext;
}

// Regression for the tracker's terminal resetSession leaking a stale SOS: before
// the fix, resetSession cleared the flexi ride fields but not sosId, so a rider
// who raised SOS and then had the ride complete kept a stale sosId — the NEXT
// ride showed "Mark safe" instead of the SOS button. The 39 happy-path tests
// never raise SOS then complete, so they stayed green.
describe('SOS is cleared when the ride completes (no leak into next ride)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-09T00:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracker resetSession on completion clears sosId and returns to IDLE', async () => {
    const w = makeWorld();
    await bookFlexi(w);

    // Raise SOS mid-ride.
    await send(w, makeMessage(FLEXI, USER, 'sos_confirm'));
    await send(w, makeMessage(FLEXI, USER, 'sos_trigger'));
    expect((await sessionCtx(w)).sosId).toBeTruthy();

    // Complete the ride via the background tracker (t+20s → COMPLETED → resetSession).
    await vi.advanceTimersByTimeAsync(20000);
    await tick(w);

    const ctx = await sessionCtx(w);
    expect(ctx.sosId).toBeUndefined();
    expect(ctx.state).toBe('IDLE');
    expect(ctx.flexiBookingId).toBeUndefined();
  });
});
