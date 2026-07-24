import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeWorld, tick } from './harness';
import { config } from '../src/config';
import { ActiveRide } from '../src/session/ride-registry';
import { MockNammaYatriClient } from '../src/ny/mock-client';

const USER = '919361176218';

// In NY_FIXED_USER_TOKEN test mode the token is injected into the engine, never
// written to the token store — so the background tracker (which reads the store)
// couldn't poll, and ride-status pushes silently stopped. The tracker must fall
// back to config.nyFixedUserToken. In production (real auth) the token IS stored,
// so this fallback is test-only and never changes prod behavior.
const REGISTERED: ActiveRide = {
  bookingId: 'mock-booking-001',
  source: 'whatsapp',
  userKey: 'whatsapp:FLEXI:919361176218',
  sessionUserId: 'FLEXI:919361176218',
  chatId: '919361176218',
  phoneNumberId: 'pn_flexi',
  merchantId: 'FLEXI',
  lastStage: 'confirmed',
  // Recent (real time) so MemoryRideRegistry.list() doesn't prune it as past max-age.
  createdAt: new Date().toISOString(),
};

describe('ride tracker — NY_FIXED_USER_TOKEN fallback', () => {
  let saved: string | undefined;
  beforeEach(() => { saved = config.nyFixedUserToken; });
  afterEach(() => { config.nyFixedUserToken = saved; vi.restoreAllMocks(); });

  it('prefers the fixed token over a STALE stored token (matches the engine override)', async () => {
    const w = makeWorld();
    await w.registry.register({ ...REGISTERED });
    // A stale token is persisted from a prior run on a DIFFERENT env (e.g. a pilot
    // token still in Redis). In test mode the engine always uses the fixed token,
    // so the tracker must too — polling with the stale stored token would 401.
    await w.tokenStore.set('whatsapp:FLEXI:919361176218', {
      nyToken: 'stale-pilot-token', personId: 'p', phone: USER, authenticatedAt: '2026-07-09T00:00:00.000Z',
    });
    config.nyFixedUserToken = 'fixed-test-token';

    let usedToken: string | undefined;
    vi.spyOn(MockNammaYatriClient.prototype, 'getBookingDetails').mockImplementation(async function (this: any) {
      usedToken = this.token;
      return { id: 'mock-booking-001', status: 'TRIP_ASSIGNED', rideList: [{ driverName: 'Ravi', rideOtp: '4321' }] };
    });

    await tick(w);
    expect(usedToken).toBe('fixed-test-token'); // NOT the stale stored token
  });

  it('polls + pushes using the fixed token when the store has no per-user token', async () => {
    const w = makeWorld();
    await w.registry.register({ ...REGISTERED });     // no token ever stored for this user
    config.nyFixedUserToken = 'fixed-test-token';

    const pushed = await tick(w);

    // Tracker polled the booking (mock returns an assigned driver) and pushed the
    // driver card — proving it used the fixed token instead of bailing out.
    expect(pushed.some((r) => r.buttons?.some((b) => b.data.startsWith('cancel_confirm:')))).toBe(true);
  });

  it('still skips when there is neither a stored token nor a fixed token', async () => {
    const w = makeWorld();
    await w.registry.register({ ...REGISTERED });
    config.nyFixedUserToken = undefined;

    const pushed = await tick(w);
    expect(pushed).toHaveLength(0);
  });
});
