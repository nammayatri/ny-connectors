import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeWorld, makeMessage, makePin, send, structured, World } from './harness';
import { MockNammaYatriClient } from '../src/ny/mock-client';

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
    // The SOS-confirm prompt keeps its content and also nudges the app download.
    expect(confirm[0].text).toContain('Download the Namma Yatri app!');

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

describe('app-download nudge surfaces', () => {
  it('appears on the Track-Ride status screen for an active ride', async () => {
    const w = makeWorld();
    await bookFlexi(w);
    const status = await send(w, makeMessage(FLEXI, USER, 'status'));
    expect(status.some((r) => r.text?.includes('Download the Namma Yatri app!'))).toBe(true);
  });

  it('appears on the Support message', async () => {
    const w = makeWorld();
    await send(w, makeMessage(FLEXI, USER, 'ride_type:flexi')); // establish a session
    const out = await send(w, makeMessage(FLEXI, USER, 'support'));
    expect(out.some((r) => r.text?.includes('Download the Namma Yatri app!'))).toBe(true);
  });
});

describe('SOS on an in-progress ride (INPROGRESS-safe lookup)', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('triggers SOS mid-ride via the registry booking — getActiveBookings would drop INPROGRESS', async () => {
    const w = makeWorld();
    await bookFlexi(w);

    // Force the registry booking to look INPROGRESS — the moment SOS matters most, and
    // exactly the state the real listV2 (getActiveBookings) status filter drops.
    const inProgress = {
      id: 'mock-booking-001',
      status: 'TRIP_ASSIGNED',
      rideList: [{ id: 'mock-ride-001', status: 'INPROGRESS', driverName: 'Ravi Kumar', rideOtp: '4321' }],
    };
    const detailsSpy = vi
      .spyOn(MockNammaYatriClient.prototype, 'getBookingDetails')
      .mockResolvedValue(inProgress);

    const trigger = await send(w, makeMessage(FLEXI, USER, 'sos_trigger'));

    // The fix routes SOS through getBookingDetails (INPROGRESS-safe), NOT getActiveBookings.
    expect(detailsSpy).toHaveBeenCalledWith('mock-booking-001', expect.anything());
    // Success → mark-safe prompt, never the "No active ride found" failure.
    expect(trigger.some((r) => r.buttons?.some((b) => b.data === 'mark_safe_confirm'))).toBe(true);
    expect(trigger.every((r) => !/No active ride found/i.test(r.text ?? ''))).toBe(true);
  });
});
