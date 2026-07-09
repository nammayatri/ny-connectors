import { describe, it, expect } from 'vitest';
import { makeWorld, makeMessage, makePin, send, structured, World } from './harness';

const FLEXI = 'pn_flexi';
const USER = '919361176218';

async function bookFlexi(w: World): Promise<void> {
  await send(w, makeMessage(FLEXI, USER, 'ride_type:flexi'));
  await send(w, makePin(FLEXI, USER));
  await send(w, makeMessage(FLEXI, USER, 'pickup_confirm'));
}

describe('cancel an active ride', () => {
  it('confirms then cancels, clearing the tracker registry', async () => {
    const w = makeWorld();
    await bookFlexi(w);
    expect(await w.registry.list()).toHaveLength(1);

    // Tap the driver-card cancel button → confirmation prompt.
    const confirm = await send(w, makeMessage(FLEXI, USER, 'cancel_confirm:mock-booking-001'));
    expect(structured(confirm)).toEqual([
      { kind: 'buttons', to: USER, merchant: 'FLEXI', buttons: ['cancel:mock-booking-001', 'abort_cancel'] },
    ]);

    // Confirm cancel → cancelRide + registry cleared.
    const cancelled = await send(w, makeMessage(FLEXI, USER, 'cancel:mock-booking-001'));
    expect(cancelled).toMatchSnapshot('cancelled');
    expect(await w.registry.list()).toHaveLength(0);
  });

  it('abort_cancel returns to ride status without cancelling', async () => {
    const w = makeWorld();
    await bookFlexi(w);
    await send(w, makeMessage(FLEXI, USER, 'cancel_confirm:mock-booking-001'));
    const aborted = await send(w, makeMessage(FLEXI, USER, 'abort_cancel'));
    expect(aborted.length).toBeGreaterThan(0);
    // ride still tracked
    expect(await w.registry.list()).toHaveLength(1);
  });
});
