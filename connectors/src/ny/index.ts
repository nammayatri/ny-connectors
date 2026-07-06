import { config } from '../config';
import { NammaYatriClient as RealNammaYatriClient } from './client';
import { MockNammaYatriClient } from './mock-client';

// Value export: the mock (a subclass) swaps in when NY_MOCK=1, else the real client.
// Typed as `typeof RealNammaYatriClient` so `new` and static calls resolve identically.
export const NammaYatriClient: typeof RealNammaYatriClient = config.nyMock
  ? MockNammaYatriClient
  : RealNammaYatriClient;

if (config.nyMock) {
  console.log('[ny] ⚠️  NY_MOCK enabled — using in-memory mock client (no real Namma Yatri calls, no driver dispatch)');
}

// Type export: `NammaYatriClient` also names the instance type (the mock subclasses it).
export type NammaYatriClient = RealNammaYatriClient;

export type { NYPlace, NYPlaceDetails, NYEstimate, NYFlexiQuote, NYSavedLocation, NYRideHistoryItem } from './client';
