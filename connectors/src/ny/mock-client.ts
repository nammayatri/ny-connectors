import { MerchantConfig } from '../config';
import {
  NammaYatriClient,
  NYPlace,
  NYPlaceDetails,
  NYEstimate,
  NYFlexiQuote,
  NYRideHistoryItem,
  NYSavedLocation,
} from './client';

// ---------------------------------------------------------------------------
// MockNammaYatriClient — a dev-only, in-memory stand-in for NammaYatriClient.
// Enabled via NY_MOCK=1. Returns canned data so the whole WhatsApp flow can be
// walked end-to-end WITHOUT real Namma Yatri credentials and WITHOUT ever
// dispatching a real driver (selectEstimate is a no-op here).
//
// Data is themed for Tumkur. Conventions for testing:
//   - Any phone authenticates as a returning user, EXCEPT a phone containing
//     "00000", which triggers the new-user (OTP registration) path.
//   - In the OTP flow, the accepted OTP is "123456".
// It subclasses the real client so it satisfies every type position unchanged.
// ---------------------------------------------------------------------------

const log = (m: string) => console.log(`[ny-mock] ${m}`);

const TUMKUR = { lat: 13.3379, lon: 77.1173 };

// Tracks when each mock booking was first polled, so getBookingDetails can
// simulate a ride progressing assigned → arrived → started → completed over
// ~20s. Lets the background RideTracker be exercised end-to-end with no driver.
const mockRideFirstSeen = new Map<string, number>();

function place(description: string, placeId: string): NYPlace {
  return { description, placeId, distance: 1200 };
}

function details(lat: number, lon: number, area: string, placeId: string): NYPlaceDetails {
  return {
    lat,
    lon,
    placeId,
    address: { area, city: 'Tumakuru', state: 'Karnataka', country: 'India' },
  };
}

export class MockNammaYatriClient extends NammaYatriClient {
  constructor(token = 'mock-ny-token') {
    super(token);
  }

  // --- static auth ---
  static async authenticate(
    mobileNumber: string,
    _merchant?: MerchantConfig,
  ): Promise<{ token: string; personId: string; person: any }> {
    log(`authenticate(${mobileNumber})`);
    if (mobileNumber.includes('00000')) {
      // Simulate a brand-new user so the registration/OTP branch runs.
      throw new Error('Person not found');
    }
    return { token: 'mock-ny-token', personId: 'mock-person-1', person: { firstName: 'Test User' } };
  }

  static async requestOtp(
    mobileNumber: string,
    _options?: { firstName?: string; lastName?: string; email?: string },
    _merchant?: MerchantConfig,
  ): Promise<{ authId: string; attempts: number }> {
    log(`requestOtp(${mobileNumber}) — use OTP 123456`);
    return { authId: 'mock-auth-1', attempts: 3 };
  }

  static async resendOtp(_authId: string, mobileNumber?: string, _merchant?: MerchantConfig): Promise<void> {
    log(`resendOtp(${mobileNumber ?? ''}) — use OTP 123456`);
  }

  static async verifyOtp(
    _authId: string,
    otp: string,
    _merchant?: MerchantConfig,
  ): Promise<{ token: string; person: any }> {
    log(`verifyOtp(${otp})`);
    if (otp !== '123456') throw new Error('Invalid OTP');
    return { token: 'mock-ny-token', person: { firstName: '' } };
  }

  // --- instance ---
  async getPersonId(): Promise<string> {
    return 'mock-person-1';
  }

  async updateProfile(): Promise<void> {
    log('updateProfile()');
  }

  async getSavedLocations(): Promise<NYSavedLocation[]> {
    // Returning-user with Home + Work so quick-route buttons appear.
    return [
      { tag: 'Home', lat: 13.3410, lon: 77.1010, area: 'Sira Gate', city: 'Tumakuru', placeId: 'mock-home' },
      { tag: 'Work', lat: 13.3290, lon: 77.1230, area: 'SIT College', city: 'Tumakuru', placeId: 'mock-work' },
    ];
  }

  async saveLocation(tag: string, _details: NYPlaceDetails): Promise<void> {
    log(`saveLocation(${tag})`);
  }

  async searchPlaces(searchText: string, _near?: { lat: number; lon: number }): Promise<NYPlace[]> {
    log(`searchPlaces("${searchText}")`);
    return [
      place(`${searchText} — Tumkur Bus Stand`, 'mock-place-1'),
      place(`${searchText} — Amanikere Lake`, 'mock-place-2'),
      place(`${searchText} — SIT College Road`, 'mock-place-3'),
    ];
  }

  async getPlaceDetails(placeId: string): Promise<NYPlaceDetails> {
    log(`getPlaceDetails(${placeId})`);
    return details(TUMKUR.lat, TUMKUR.lon, 'Tumkur Bus Stand', placeId);
  }

  async reverseGeocode(lat: number, lon: number): Promise<NYPlaceDetails> {
    log(`reverseGeocode(${lat},${lon})`);
    return details(lat, lon, 'Shared pin location', 'mock-pin');
  }

  async searchRide(_origin: NYPlaceDetails, _destination: NYPlaceDetails): Promise<string> {
    log('searchRide() -> mock-search-1');
    return 'mock-search-1';
  }

  async getEstimates(_searchId: string): Promise<NYEstimate[]> {
    log('getEstimates()');
    return [
      {
        id: 'mock-est-auto',
        estimatedFare: 52,
        serviceTierName: 'Auto',
        vehicleVariant: 'AUTO_RICKSHAW',
        totalFareRange: { minFare: 52, maxFare: 60 },
        estimatedPickupDuration: 180,
      },
      {
        id: 'mock-est-cab',
        estimatedFare: 118,
        serviceTierName: 'Cab (Non-AC)',
        vehicleVariant: 'SEDAN',
        totalFareRange: { minFare: 118, maxFare: 140 },
        estimatedPickupDuration: 300,
      },
    ];
  }

  // --- Flexi (MeterRide) mock — pickup-only, no dispatch ---
  async searchFlexi(_origin: NYPlaceDetails): Promise<string> {
    log('searchFlexi() -> mock-flexi-search-1');
    return 'mock-flexi-search-1';
  }

  async getFlexiQuotes(_searchId: string): Promise<NYFlexiQuote[]> {
    log('getFlexiQuotes() -> 1 Auto quote');
    return [{ quoteId: 'mock-flexi-quote-auto', serviceTierName: 'Auto', estimatedFare: 40, vehicleVariant: 'AUTO_RICKSHAW' }];
  }

  async confirmQuote(quoteId: string): Promise<string> {
    log(`confirmQuote(${quoteId}) -> mock-booking-001 — NO real dispatch`);
    return 'mock-booking-001';
  }

  // The real booking commit — a NO-OP in mock. No driver is ever dispatched.
  async selectEstimate(estimateId: string): Promise<void> {
    log(`selectEstimate(${estimateId}) — NO-OP (no real dispatch)`);
  }

  async pollSelectResult(_personId: string, _estimateId: string): Promise<{ bookingId: string | null; raw: any }> {
    return { bookingId: 'mock-booking-001', raw: {} };
  }

  async getActiveBookings(_createdAfter?: Date): Promise<any[]> {
    log('getActiveBookings() -> 1 assigned mock booking');
    return [
      {
        id: 'mock-booking-001',
        status: 'TRIP_ASSIGNED',
        merchantExoPhone: '08046970000',   // masked call-proxy number
        rideList: [
          {
            id: 'mock-ride-001',
            status: 'NEW',
            driverName: 'Ravi Kumar',
            vehicleNumber: 'KA06 AB 1234',
            driverNumber: '9998887776',
            rideOtp: '4321',
            rating: 4.9,
            etaMinutes: 3,
          },
        ],
      },
    ];
  }

  async getBookingDetails(bookingId: string): Promise<any> {
    // Simulate ride progression over ~20s so the background tracker's
    // arrived → started → ended updates can be walked without a real driver.
    // Timeline (seconds from first poll): 0 assigned, 6 arrived, 12 started, 20 ended.
    const now = Date.now();
    let first = mockRideFirstSeen.get(bookingId);
    if (first === undefined) {
      first = now;
      mockRideFirstSeen.set(bookingId, now);
    }
    const elapsed = (now - first) / 1000;

    const driver = {
      id: 'mock-ride-001',
      driverName: 'Ravi Kumar',
      vehicleNumber: 'KA06 AB 1234',
      driverNumber: '9998887776',
      rideOtp: '4321',
      rating: 4.9,
      etaMinutes: 3,
    };
    const arrivalTime = new Date(first + 6000).toISOString();
    const startTime = new Date(first + 12000).toISOString();

    let ride: any;
    let bookingStatus = 'TRIP_ASSIGNED';
    if (elapsed >= 20) {
      bookingStatus = 'COMPLETED';
      ride = {
        ...driver, status: 'COMPLETED', endOtp: '8765',
        driverArrivalTime: arrivalTime, rideStartTime: startTime,
        rideEndTime: new Date(first + 20000).toISOString(),
        computedPrice: 57, chargeableRideDistance: 4200,
      };
    } else if (elapsed >= 12) {
      ride = { ...driver, status: 'INPROGRESS', endOtp: '8765', driverArrivalTime: arrivalTime, rideStartTime: startTime };
    } else if (elapsed >= 6) {
      ride = { ...driver, status: 'NEW', driverArrivalTime: arrivalTime };
    } else {
      ride = { ...driver, status: 'NEW' };
    }

    log(`getBookingDetails(${bookingId}) -> booking ${bookingStatus} / ride ${ride.status} (t=${Math.round(elapsed)}s)`);
    return { id: bookingId, status: bookingStatus, merchantExoPhone: '08046970000', rideList: [ride] };
  }

  async cancelSearch(_estimateId: string): Promise<void> {
    log('cancelSearch()');
  }

  async cancelRide(_bookingId: string, _bookingStatus?: string): Promise<void> {
    log('cancelRide()');
  }

  async triggerSOS(_rideId: string, _customerLat?: number, _customerLon?: number): Promise<string> {
    log('triggerSOS()');
    return 'mock-sos-1';
  }

  async markRideAsSafe(_sosId: string): Promise<void> {
    log('markRideAsSafe()');
  }

  async getRideHistory(_limit = 10): Promise<NYRideHistoryItem[]> {
    return [
      {
        id: 'mock-ride-hist-1',
        status: 'COMPLETED',
        createdAt: '2026-06-30T10:00:00.000Z',
        serviceTierName: 'Auto',
        estimatedFare: 48,
        fromLocation: { area: 'Sira Gate', city: 'Tumakuru' },
        toLocation: { area: 'Tumkur Bus Stand', city: 'Tumakuru' },
      },
    ];
  }
}
