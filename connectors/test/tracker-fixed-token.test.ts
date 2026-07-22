import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeWorld, tick } from './harness';
import { config } from '../src/config';
import { ActiveRide } from '../src/session/ride-registry';

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
  afterEach(() => { config.nyFixedUserToken = saved; });

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
