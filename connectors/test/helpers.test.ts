import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../src/i18n';
import { isWithinServiceArea, cityCenterByName, haversineKm, findNearestCity } from '../src/ny/cities';
import { formatDialable, classifyStage, buildStarted } from '../src/flow/flexi-messages';
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

  it('buildStarted shows the End-ride button only for rentals (endOtp present)', () => {
    expect(buildStarted({ id: 'b1', rideList: [{ endOtp: '8765' }] }).buttons).toBeTruthy();
    expect(buildStarted({ id: 'b1', rideList: [{}] }).buttons).toBeUndefined();
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
