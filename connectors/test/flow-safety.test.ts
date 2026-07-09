import { describe, it, expect } from 'vitest';
import { makeWorld, makeMessage, makePin, send, structured, World } from './harness';

const FLEXI = 'pn_flexi';
const USER = '919361176218';

// Book a flexi ride so the rider is in TRACKING with an active booking.
// The mock returns quotes + a driver immediately, so no timers are needed.
async function bookFlexi(w: World): Promise<void> {
  await send(w, makeMessage(FLEXI, USER, 'ride_type:flexi'));
  await send(w, makePin(FLEXI, USER));
  await send(w, makeMessage(FLEXI, USER, 'pickup_confirm'));
}

describe('SOS → mark safe', () => {
  it('confirms SOS, triggers it, then marks the rider safe', async () => {
    const w = makeWorld();
    await bookFlexi(w);

    const confirm = await send(w, makeMessage(FLEXI, USER, 'sos_confirm'));
    expect(structured(confirm)).toEqual([
      { kind: 'buttons', to: USER, merchant: 'FLEXI', buttons: ['sos_trigger', 'sos_cancel'] },
    ]);

    const trigger = await send(w, makeMessage(FLEXI, USER, 'sos_trigger'));
    expect(structured(trigger)).toEqual([
      { kind: 'buttons', to: USER, merchant: 'FLEXI', buttons: ['mark_safe_confirm'] },
    ]);

    const markConfirm = await send(w, makeMessage(FLEXI, USER, 'mark_safe_confirm'));
    expect(structured(markConfirm)).toEqual([
      { kind: 'buttons', to: USER, merchant: 'FLEXI', buttons: ['mark_safe_trigger', 'mark_safe_cancel'] },
    ]);

    const marked = await send(w, makeMessage(FLEXI, USER, 'mark_safe_trigger'));
    expect(structured(marked)).toMatchSnapshot('marked-safe');
    expect(marked).toHaveLength(1);
    expect(marked[0].kind).toBe('text');
  });

  it('call_112 replies with the emergency number', async () => {
    const w = makeWorld();
    await bookFlexi(w);
    const out = await send(w, makeMessage(FLEXI, USER, 'call_112'));
    expect(out).toHaveLength(1);
    expect(out[0].text).toContain('112');
  });
});
