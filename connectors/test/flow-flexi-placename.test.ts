import { describe, it, expect } from 'vitest';
import { makeWorld, makePin, send, seedAuth } from './harness';

const FLEXI = 'pn_flexi';
const USER = '919361176218';

// The pickup-confirm reply must name the pickup from the getPlaceName API result
// (building + street + area), for ANY shared location — whether or not WhatsApp
// attached a `name` field (a saved place / business). The user-supplied name is
// never shown, because it can differ from where the coordinates actually resolve.
describe('flexi pickup label = getPlaceName place (never the shared name)', () => {
  it('a NAMED location share shows the getPlaceName address, not the WhatsApp name', async () => {
    const w = makeWorld();
    await seedAuth(w, FLEXI, USER);

    const pin = await send(w, makePin(FLEXI, USER, 13.34, 77.1, 'My Saved Home'));
    const prompt = pin.find((r) => r.buttons?.some((b) => b.data === 'pickup_confirm'));

    expect(prompt).toBeTruthy();
    expect(prompt!.text).toContain('2, 8th Main Road, Koramangala'); // from getPlaceName
    expect(prompt!.text).not.toContain('My Saved Home');             // NOT the shared name
  });

  it('an UN-named location share shows the same getPlaceName address', async () => {
    const w = makeWorld();
    await seedAuth(w, FLEXI, USER);

    const pin = await send(w, makePin(FLEXI, USER)); // no name field
    const prompt = pin.find((r) => r.buttons?.some((b) => b.data === 'pickup_confirm'));

    expect(prompt!.text).toContain('2, 8th Main Road, Koramangala');
  });
});
