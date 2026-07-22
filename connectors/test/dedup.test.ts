import { describe, it, expect } from 'vitest';
import { MemoryMessageDedup } from '../src/session/dedup';
import { makeWorld, makeMessage, send } from './harness';

const FLEXI = 'pn_flexi';
const USER = '919361176218';

describe('MemoryMessageDedup', () => {
  it('claims a new id once; a repeat is rejected', async () => {
    const d = new MemoryMessageDedup();
    expect(await d.claim('wamid.1')).toBe(true);  // newly claimed → process
    expect(await d.claim('wamid.1')).toBe(false); // duplicate → drop
    expect(await d.claim('wamid.2')).toBe(true);  // a different id is independent
  });
});

describe('engine webhook dedup', () => {
  it('drops a redelivered message (same messageId) instead of re-processing', async () => {
    const w = makeWorld();
    // WhatsApp Cloud API delivers at-least-once — the SAME message id can arrive
    // twice. The second delivery must be dropped, not re-processed (double-book).
    const msg = makeMessage(FLEXI, USER, 'ride_type:flexi');
    const first = await send(w, msg);
    expect(first.length).toBeGreaterThan(0); // processed (auth + pickup request)
    const dup = await send(w, msg);           // same messageId, redelivered
    expect(dup).toHaveLength(0);              // dropped
  });
});
