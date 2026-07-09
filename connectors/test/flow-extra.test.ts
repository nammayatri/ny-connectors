import { describe, it, expect } from 'vitest';
import { makeWorld, makeMessage, makePin, send, structured } from './harness';

const FLEXI = 'pn_flexi';
const REG = 'pn_reg';
const BOTH = 'pn_both';
const RETURNING = '919361176218';
const NEWUSER = '919100000999'; // contains "00000" → mock new user
const REG_USER = '919812345678';
const BOTH_USER = '917411122233';

describe('pin-first onboarding (no dead-end)', () => {
  it('a new user who shares a pin first is onboarded via OTP, not dead-ended', async () => {
    const w = makeWorld();
    // Pin shared straight from IDLE by a brand-new user.
    const first = await send(w, makePin(FLEXI, NEWUSER));
    const firstText = first.map((r) => r.text).join(' ');
    expect(firstText).not.toContain('session'); // no "session expired" dead-end
    expect(structured(first)).toMatchSnapshot('1-pin-first-otp');

    // Complete OTP → the flow resumes (asks for the pickup pin again).
    const resumed = await send(w, makeMessage(FLEXI, NEWUSER, '123456'));
    expect(structured(resumed)).toMatchSnapshot('2-resume');
    expect(resumed.some((r) => r.kind === 'location_request' || r.kind === 'buttons')).toBe(true);
    expect(await w.tokenStore.get(`whatsapp:FLEXI:${NEWUSER}`)).not.toBeNull();
  });
});

describe('resend OTP', () => {
  it('resends the OTP during registration', async () => {
    const w = makeWorld();
    await send(w, makeMessage(FLEXI, NEWUSER, 'ride_type:flexi')); // → OTP prompt (sets authId)
    const resent = await send(w, makeMessage(FLEXI, NEWUSER, 'resend_otp'));
    expect(structured(resent)).toMatchSnapshot();
    expect(resent.some((r) => r.buttons?.some((b) => b.data === 'resend_otp'))).toBe(true);
  });
});

describe('multi-merchant routing', () => {
  it('regular-only merchant shows a Book button routing to the regular ride type', async () => {
    const w = makeWorld();
    const out = await send(w, makeMessage(REG, REG_USER, 'hi'));
    const menu = out.find((r) => r.kind === 'buttons');
    expect(menu?.merchant).toBe('REG');
    expect(menu?.buttons?.map((b) => b.data)).toEqual(['ride_type:regular', 'more', 'choose_language']);
  });

  it('both-merchant shows Quick Ride as the primary button', async () => {
    const w = makeWorld();
    const out = await send(w, makeMessage(BOTH, BOTH_USER, 'hi'));
    const menu = out.find((r) => r.kind === 'buttons');
    expect(menu?.merchant).toBe('BOTH');
    expect(menu?.buttons?.[0].data).toBe('ride_type:flexi');
  });

  it('tags every outbound message with the sending merchant', async () => {
    const w = makeWorld();
    const out = await send(w, makeMessage(REG, REG_USER, 'hi'));
    expect(out.every((r) => r.merchant === 'REG')).toBe(true);
  });
});

describe('main_menu', () => {
  it('resets and shows the welcome menu', async () => {
    const w = makeWorld();
    const out = await send(w, makeMessage(FLEXI, RETURNING, 'main_menu'));
    expect(structured(out)).toMatchSnapshot();
  });
});
