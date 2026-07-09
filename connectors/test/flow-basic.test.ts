import { describe, it, expect } from 'vitest';
import { makeWorld, makeMessage, send, structured } from './harness';

// Phone numbers (10-digit forms are in ALLOWED_PHONES except the blocked one):
const FLEXI = 'pn_flexi';
const BOTH = 'pn_both';
const RETURNING = '919361176218'; // no "00000" → mock returning user
const NEWUSER = '919100000999'; // contains "00000" → mock new user (OTP path)
const BOTH_USER = '917411122233';
const BLOCKED = '919999999999'; // NOT in ALLOWED_PHONES

describe('allowlist gate', () => {
  it('blocks a non-allowlisted sender with a coming-soon reply and does no flow work', async () => {
    const w = makeWorld();
    const out = await send(w, makeMessage(FLEXI, BLOCKED, 'hi'));
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('text');
    expect(out[0].text).toContain('coming soon');
    // No auth record, no saved context — the gate short-circuits before any work.
    expect(await w.tokenStore.get(`whatsapp:FLEXI:${BLOCKED}`)).toBeNull();
    const session = await w.session.getSession('whatsapp', `FLEXI:${BLOCKED}`);
    expect(session?.metadata).toEqual({});
    expect(out).toMatchSnapshot();
  });
});

describe('greeting (English default)', () => {
  it('sends the intro video once + welcome + menu; no auth on greeting', async () => {
    const w = makeWorld();
    const out = await send(w, makeMessage(FLEXI, RETURNING, 'hi'));
    expect(structured(out)).toMatchSnapshot('structured');
    // greeting must not authenticate (auth is lazy at first action)
    expect(await w.tokenStore.get(`whatsapp:FLEXI:${RETURNING}`)).toBeNull();
    expect(out).toMatchSnapshot('full');
  });

  it('sends the intro video only once across two greetings', async () => {
    const w = makeWorld();
    await send(w, makeMessage(FLEXI, RETURNING, 'hi'));
    const second = await send(w, makeMessage(FLEXI, RETURNING, 'hi'));
    expect(second.filter((r) => r.kind === 'video')).toHaveLength(0);
  });
});

describe('new-user Kannada onboarding via OTP', () => {
  it('detects Kannada, onboards through one OTP, resumes into pickup', async () => {
    const w = makeWorld();
    // 1. First message in Kannada script → language set to kn + greeting.
    const greeting = await send(w, makeMessage(FLEXI, NEWUSER, 'ನಮಸ್ಕಾರ'));
    expect(structured(greeting)).toMatchSnapshot('1-greeting');

    // 2. Tap Quick Ride → new user → OTP prompt (interactive registration).
    const tapBook = await send(w, makeMessage(FLEXI, NEWUSER, 'ride_type:flexi'));
    expect(structured(tapBook)).toMatchSnapshot('2-otp-prompt');

    // 3. Enter the mock OTP → verified → resume into pickup (location request).
    const otp = await send(w, makeMessage(FLEXI, NEWUSER, '123456'));
    expect(structured(otp)).toMatchSnapshot('3-verified-resume');
    expect(otp.some((r) => r.kind === 'location_request')).toBe(true);

    // Auth record now exists and carries the detected language.
    const auth = await w.tokenStore.get(`whatsapp:FLEXI:${NEWUSER}`);
    expect(auth?.language).toBe('kn');
  });
});

describe('returning-user silent auth', () => {
  it('taps Quick Ride → silent auth (no OTP) → pickup request', async () => {
    const w = makeWorld();
    await send(w, makeMessage(FLEXI, RETURNING, 'hi'));
    const tap = await send(w, makeMessage(FLEXI, RETURNING, 'ride_type:flexi'));
    expect(structured(tap)).toMatchSnapshot();
    // Silent auth: went straight to a location request, no OTP prompt.
    expect(tap.some((r) => r.kind === 'location_request')).toBe(true);
    expect(await w.tokenStore.get(`whatsapp:FLEXI:${RETURNING}`)).not.toBeNull();
  });
});

describe('language switch', () => {
  it('lang:hi updates the language and re-renders the menu in Hindi', async () => {
    const w = makeWorld();
    await send(w, makeMessage(BOTH, BOTH_USER, 'hi'));
    const switched = await send(w, makeMessage(BOTH, BOTH_USER, 'lang:hi'));
    expect(switched).toMatchSnapshot();
    // subsequent menu renders should be Hindi — captured in the snapshot above.
  });
});

describe('More options submenu (both merchant)', () => {
  it('opens a submenu with Ride-with-destination + How it works + Support + Main menu', async () => {
    const w = makeWorld();
    await send(w, makeMessage(BOTH, BOTH_USER, 'hi'));
    const more = await send(w, makeMessage(BOTH, BOTH_USER, 'more'));
    expect(structured(more)).toMatchSnapshot('structured');
    expect(more).toMatchSnapshot('full');
  });
});

describe('status with no active ride', () => {
  it('reports no active ride', async () => {
    const w = makeWorld();
    const out = await send(w, makeMessage(FLEXI, RETURNING, 'status'));
    expect(out).toMatchSnapshot();
  });
});
