import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../src/i18n';
import { isWithinServiceArea, cityCenterByName, haversineKm, findNearestCity } from '../src/ny/cities';
import { formatDialable, classifyStage, buildStarted, buildFlexiFareLine } from '../src/flow/flexi-messages';
import { toFareNumber, parseQuoteFareBreakup } from '../src/ny/client';
import { resolveRideMode } from '../src/config';
import { en } from '../src/i18n/en';
import { hi } from '../src/i18n/hi';
import { gu } from '../src/i18n/gu';
import { kn } from '../src/i18n/kn';
import { ta } from '../src/i18n/ta';
import { te } from '../src/i18n/te';

describe('detectLanguage', () => {
  it('detects each Indic script', () => {
    expect(detectLanguage('ನಮಸ್ಕಾರ')).toBe('kn'); // Kannada
    expect(detectLanguage('नमस्ते')).toBe('hi'); // Devanagari
    expect(detectLanguage('வணக்கம்')).toBe('ta'); // Tamil
    expect(detectLanguage('నమస్కారం')).toBe('te'); // Telugu
    expect(detectLanguage('નમસ્તે')).toBe('gu'); // Gujarati
  });

  it('returns undefined for Latin / empty / digits', () => {
    expect(detectLanguage('hello')).toBeUndefined();
    expect(detectLanguage('book a ride')).toBeUndefined();
    expect(detectLanguage('')).toBeUndefined();
    expect(detectLanguage('12345 🚗')).toBeUndefined();
  });

  it('picks the dominant script in mixed text', () => {
    expect(detectLanguage('ok ನಮಸ್ಕಾರ ಬನ್ನಿ')).toBe('kn');
  });
});

describe('cities geofence', () => {
  it('resolves service-area names (alias-aware)', () => {
    expect(cityCenterByName('Tumkur')?.name).toBe('Tumakuru');
    expect(cityCenterByName('Bengaluru')?.name).toBe('Bangalore');
    expect(cityCenterByName('Nowhere City')).toBeUndefined();
  });

  it('isWithinServiceArea: true near center, false far away', () => {
    expect(isWithinServiceArea(13.34, 77.1, 'Tumkur', 15)).toBe(true);
    expect(isWithinServiceArea(12.9716, 77.5946, 'Tumkur', 15)).toBe(false); // Bangalore ~70km
  });

  it('isWithinServiceArea FAILS OPEN on an unknown area', () => {
    expect(isWithinServiceArea(0, 0, 'Atlantis', 5)).toBe(true);
  });

  it('haversineKm is ~0 for the same point and symmetric', () => {
    expect(haversineKm(13.34, 77.1, 13.34, 77.1)).toBeCloseTo(0, 6);
    expect(haversineKm(13.34, 77.1, 12.97, 77.59)).toBeCloseTo(haversineKm(12.97, 77.59, 13.34, 77.1), 6);
  });

  it('findNearestCity snaps to the closest supported city', () => {
    expect(findNearestCity(13.34, 77.1).name).toBe('Tumakuru');
    expect(findNearestCity(12.9716, 77.5946).name).toBe('Bangalore');
  });
});

describe('flexi-messages helpers', () => {
  it('formatDialable normalizes to +91 international form', () => {
    expect(formatDialable('9998887776')).toBe('+919998887776');
    expect(formatDialable('919998887776')).toBe('+919998887776');
    expect(formatDialable('08046970000')).toBe('08046970000'); // landline-form exophone as-is
    expect(formatDialable(undefined)).toBeUndefined();
    expect(formatDialable('')).toBeUndefined();
  });

  it('classifyStage checks terminal states first', () => {
    expect(classifyStage({ status: 'COMPLETED', rideList: [{ status: 'INPROGRESS' }] })).toBe('completed');
    expect(classifyStage({ rideList: [{ status: 'CANCELLED' }] })).toBe('cancelled');
    expect(classifyStage({ rideList: [{ status: 'INPROGRESS' }] })).toBe('started');
    expect(classifyStage({ rideList: [{ status: 'NEW', driverArrivalTime: 'x' }] })).toBe('arrived');
    expect(classifyStage({ rideList: [{ driverName: 'Ravi' }] })).toBe('assigned');
    expect(classifyStage({ rideList: [] })).toBe('none');
  });

  it('buildStarted is a plain message with no button (EasyBooking / ONE_WAY are driver-ended)', () => {
    expect(buildStarted({ id: 'b1', rideList: [{}] }).buttons).toBeUndefined();
    // Even if a stray endOtp appears on the booking, no End-ride button is offered.
    expect(buildStarted({ id: 'b1', rideList: [{ endOtp: '8765' }] }).buttons).toBeUndefined();
  });
});

describe('parseQuoteFareBreakup (quote → fare-breakup map)', () => {
  it('flattens quoteFareBreakup[] into a title→amount map', () => {
    const inner = {
      quoteFareBreakup: [
        { title: 'BASE_FARE', priceWithCurrency: { amount: 36, currency: 'INR' } },
        { title: 'EXTRA_PER_KM_FARE', priceWithCurrency: { amount: 28, currency: 'INR' } },
        { title: 'NIGHT_SHIFT_CHARGE', priceWithCurrency: { amount: 1.5, currency: 'INR' } },
      ],
    };
    expect(parseQuoteFareBreakup(inner)).toEqual({
      BASE_FARE: 36,
      EXTRA_PER_KM_FARE: 28,
      NIGHT_SHIFT_CHARGE: 1.5,
    });
  });

  it('returns undefined when there is no breakup', () => {
    expect(parseQuoteFareBreakup({})).toBeUndefined();
    expect(parseQuoteFareBreakup({ quoteFareBreakup: [] })).toBeUndefined();
    expect(parseQuoteFareBreakup(undefined)).toBeUndefined();
  });
});

describe('buildFlexiFareLine (fare rate-card display)', () => {
  // Real sandbox EasyBooking quoteFareBreakup values.
  const FULL = {
    BASE_FARE: 36,
    DEAD_KILOMETER_FARE: 10,
    EXTRA_PER_KM_FARE: 28,
    NIGHT_SHIFT_CHARGE: 1.5,
    NIGHT_SHIFT_START_TIME_IN_SECONDS: 79200, // 22:00 = 10PM
    NIGHT_SHIFT_END_TIME_IN_SECONDS: 18000,   // 05:00 = 5AM
  };

  it('renders base(+deadKm) + per-km + night window from the breakup', () => {
    expect(buildFlexiFareLine(FULL, 'en')).toBe('🛺 ₹46 + ₹28/km · 10PM–5AM: 1.5× fare');
  });

  it('omits the night clause when night fields are absent', () => {
    const { NIGHT_SHIFT_CHARGE, NIGHT_SHIFT_START_TIME_IN_SECONDS, NIGHT_SHIFT_END_TIME_IN_SECONDS, ...noNight } = FULL;
    expect(buildFlexiFareLine(noNight, 'en')).toBe('🛺 ₹46 + ₹28/km');
  });

  it('rounds the base sum so paise fares never render IEEE float garbage', () => {
    // 46.1 + 3.2 === 49.300000000000004 in IEEE-754 — must render ₹49.3, not garbage.
    expect(buildFlexiFareLine({ BASE_FARE: 46.1, DEAD_KILOMETER_FARE: 3.2, EXTRA_PER_KM_FARE: 12 }, 'en'))
      .toBe('🛺 ₹49.3 + ₹12/km');
  });

  it('returns undefined when there is no base and no per-km rate to show', () => {
    expect(buildFlexiFareLine({}, 'en')).toBeUndefined();
    expect(buildFlexiFareLine(undefined, 'en')).toBeUndefined();
    // A lone night charge is meaningless without a fare to multiply.
    expect(buildFlexiFareLine({ NIGHT_SHIFT_CHARGE: 1.5 }, 'en')).toBeUndefined();
  });

  it('flexiFareFrom is the neutral fallback line (no "metered auto" wording)', () => {
    expect(en.flexiFareFrom(48)).toBe('🛺 From ₹48');
    expect(en.flexiFareFrom(48)).not.toContain('Metered');
  });
});

describe('toFareNumber (quote fare coercion)', () => {
  it('coerces number, numeric string, and { amount } to a number; else undefined', () => {
    // NY/BECKN prices arrive as numbers, numeric strings, OR { amount } objects.
    // The starting-fare line is gated on Number.isFinite, which does NOT coerce, so
    // an un-coerced string fare would be silently dropped for the rider.
    expect(toFareNumber(40)).toBe(40);
    expect(toFareNumber('45')).toBe(45);          // string price → must still show
    expect(toFareNumber({ amount: 50, currency: 'INR' })).toBe(50);
    expect(toFareNumber({ amount: '55' })).toBe(55);
    expect(toFareNumber(undefined)).toBeUndefined();
    expect(toFareNumber(null)).toBeUndefined();
    expect(toFareNumber('abc')).toBeUndefined();  // unparseable → no ₹NaN
    // A price object with a null/empty amount must DROP, not coerce to ₹0
    // (Number(null) === 0, Number('') === 0 would otherwise render "₹0").
    expect(toFareNumber({ amount: null })).toBeUndefined();
    expect(toFareNumber({ amount: '' })).toBeUndefined();
  });
});

describe('resolveRideMode', () => {
  it('maps explicit modes', () => {
    expect(resolveRideMode('flexi')).toBe('flexi');
    expect(resolveRideMode('regular')).toBe('regular');
    expect(resolveRideMode('both')).toBe('both');
  });

  it('falls back to legacy FLEXI_ENABLED', () => {
    expect(resolveRideMode(undefined, 'true')).toBe('flexi');
    expect(resolveRideMode(undefined, 'false')).toBeUndefined();
  });

  it('is undefined when nothing is set', () => {
    expect(resolveRideMode(undefined, undefined)).toBeUndefined();
    expect(resolveRideMode('', '')).toBeUndefined();
  });
});

describe('i18n key parity', () => {
  const enKeys = Object.keys(en).sort();
  for (const [name, obj] of Object.entries({ hi, gu, kn, ta, te })) {
    it(`${name} has exactly the same keys as en`, () => {
      expect(Object.keys(obj).sort()).toEqual(enKeys);
    });
  }
});
