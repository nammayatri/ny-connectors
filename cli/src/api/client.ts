// ============================================================================
// Namma Yatri API Client
// Reuses patterns from connectors/src/ny/client.ts
// ============================================================================

import type {
  AuthCredentials,
  AuthResponse,
  Place,
  PlaceDetails,
  RideEstimate,
  RideBooking,
  RideStatus,
  SavedLocation,
  LocationWithAddress,
} from '../types.js';

const NY_API_BASE = process.env.NY_API_BASE || 'https://api.moving.tech/pilot/app/v2';
const CLIENT_ID = 'ACP_CLI';

export class NammaYatriClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  static async authenticate(credentials: AuthCredentials): Promise<AuthResponse> {
    const { mobileNumber, accessCode, country = 'IN' } = credentials;

    const res = await fetch(`${NY_API_BASE}/auth/get-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appSecretCode: accessCode,
        userMobileNo: mobileNumber,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({} as any)) as any;
      throw new Error(err.errorMessage || err.message || `Auth failed: ${res.status}`);
    }

    const data = await res.json() as any;
    const personId = data.person?.id || data.personId || data.customerId || data.userId || data.id || '';

    return {
      token: data.token,
      personId,
      person: data.person,
    };
  }

  // ============================================================================
  // Saved Locations
  // ============================================================================

  async getSavedLocations(): Promise<SavedLocation[]> {
    const res = await fetch(`${NY_API_BASE}/savedLocation/list`, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });

    if (!res.ok) {
      throw new Error(`Failed to get saved locations: ${res.status}`);
    }

    const data = await res.json() as any;
    return data.list || [];
  }

  // ============================================================================
  // Places / Location Search
  // ============================================================================

  async searchPlaces(searchText: string, sourceLat?: number, sourceLon?: number): Promise<Place[]> {
    const res = await fetch(`${NY_API_BASE}/maps/autoComplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({
        autoCompleteType: 'DROP',
        input: searchText,
        language: 'ENGLISH',
        location: sourceLat && sourceLon ? `${sourceLat},${sourceLon}` : '12.97413032560963,77.58534937018615',
        origin: sourceLat && sourceLon ? { lat: sourceLat, lon: sourceLon } : undefined,
        radius: 50000,
        radiusWithUnit: { unit: 'Meter', value: 50000.0 },
        strictbounds: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Place search failed: ${res.status}`);
    }

    const data = await res.json() as any;
    return (data.predictions || []).map((p: any) => ({
      description: p.description,
      placeId: p.placeId,
      distance: p.distanceWithUnit?.value,
      distanceWithUnit: p.distanceWithUnit,
    }));
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    const res = await fetch(`${NY_API_BASE}/maps/getPlaceName`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({
        getBy: { contents: placeId, tag: 'ByPlaceId' },
        language: 'ENGLISH',
        sessionToken: 'default-token',
      }),
    });

    if (!res.ok) {
      throw new Error(`Place details failed: ${res.status}`);
    }

    const data = await res.json() as any;
    return {
      lat: data.lat,
      lon: data.lon,
      placeId: data.placeId,
      address: data.address || {},
    };
  }

  async getPlaceDetailsByLatLon(lat: number, lon: number): Promise<PlaceDetails> {
    const res = await fetch(`${NY_API_BASE}/maps/getPlaceName`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({
        getBy: {
          contents: { lat, lon },
          tag: 'ByLatLong',
        },
        language: 'ENGLISH',
        sessionToken: 'default-token',
      }),
    });

    if (!res.ok) {
      throw new Error(`Place details failed: ${res.status}`);
    }

    const data = await res.json() as any;
    return {
      lat: data.lat,
      lon: data.lon,
      placeId: data.placeId,
      address: data.address || {},
    };
  }

  // ============================================================================
  // Ride Search & Booking
  // ============================================================================

  async searchRide(origin: PlaceDetails, destination: PlaceDetails): Promise<string> {
    const res = await fetch(`${NY_API_BASE}/rideSearch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({
        contents: {
          origin: {
            gps: { lat: origin.lat, lon: origin.lon },
            address: {
              area: origin.address.area || `${origin.lat},${origin.lon}`,
              city: origin.address.city || '',
              country: origin.address.country || '',
              building: origin.address.building || '',
              placeId: origin.placeId || `${origin.lat},${origin.lon}`,
              state: origin.address.state || '',
            },
          },
          destination: {
            gps: { lat: destination.lat, lon: destination.lon },
            address: {
              area: destination.address.area || `${destination.lat},${destination.lon}`,
              city: destination.address.city || '',
              country: destination.address.country || '',
              building: destination.address.building || '',
              placeId: destination.placeId || `${destination.lat},${destination.lon}`,
              state: destination.address.state || '',
            },
          },
          placeNameSource: 'API_CLI',
          platformType: 'APPLICATION',
        },
        fareProductType: 'ONE_WAY',
      }),
    });

    if (!res.ok) {
      throw new Error(`Ride search failed: ${res.status}`);
    }

    const data = await res.json() as any;
    return data.searchId;
  }

  async getEstimates(searchId: string): Promise<RideEstimate[]> {
    const res = await fetch(`${NY_API_BASE}/rideSearch/${searchId}/results`, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });

    if (!res.ok) {
      throw new Error(`Get estimates failed: ${res.status}`);
    }

    const data = await res.json() as any;
    return (data.estimates || []).map((e: any) => ({
      id: e.id,
      estimatedFare: e.estimatedFare,
      estimatedFareWithCurrency: e.estimatedFareWithCurrency,
      estimatedTotalFare: e.estimatedTotalFare,
      estimatedTotalFareWithCurrency: e.estimatedTotalFareWithCurrency,
      estimatedPickupDuration: e.estimatedPickupDuration,
      vehicleVariant: e.vehicleVariant,
      serviceTierName: e.serviceTierName,
      serviceTierShortDesc: e.serviceTierShortDesc,
      providerName: e.providerName,
      totalFareRange: e.totalFareRange,
      tipOptions: e.tipOptions,
      smartTipSuggestion: e.smartTipSuggestion,
    }));
  }

  async selectEstimate(
    estimateId: string,
    options?: {
      additionalEstimateIds?: string[];
      tipAmount?: number;
      specialAssistance?: boolean;
      isPetRide?: boolean;
    }
  ): Promise<void> {
    const body: any = {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: '',
      otherSelectedEstimates: options?.additionalEstimateIds || [],
      disabilityDisable: !(options?.specialAssistance ?? false),
      isPetRide: options?.isPetRide ?? false,
    };

    if (options?.tipAmount) {
      body.customerExtraFee = options.tipAmount;
      body.customerExtraFeeWithCurrency = {
        amount: options.tipAmount,
        currency: 'INR',
      };
    }

    const res = await fetch(`${NY_API_BASE}/estimate/${estimateId}/select2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Select estimate failed: ${res.status}`);
    }
  }

  async cancelSearch(estimateId: string): Promise<void> {
    const res = await fetch(`${NY_API_BASE}/estimate/${estimateId}/cancelSearch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      throw new Error(`Cancel search failed: ${res.status}`);
    }
  }

  // ============================================================================
  // Booking Status & Tracking
  // ============================================================================

  async getActiveBookings(): Promise<RideBooking[]> {
    const params = new URLSearchParams({
      onlyActive: 'true',
      clientId: CLIENT_ID,
    });

    const res = await fetch(`${NY_API_BASE}/rideBooking/list?${params}`, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });

    if (!res.ok) {
      throw new Error(`Get bookings failed: ${res.status}`);
    }

    const data = await res.json() as any;
    return data.list || [];
  }

  async getBookingDetails(bookingId: string): Promise<RideBooking> {
    const res = await fetch(`${NY_API_BASE}/rideBooking/v2/${bookingId}`, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });

    if (!res.ok) {
      throw new Error(`Get booking details failed: ${res.status}`);
    }

    const data = await res.json() as any;
    return {
      id: data.id,
      status: data.bookingStatus || data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      fromLocation: data.fromLocation,
      toLocation: data.toLocation,
      estimatedFare: data.estimatedFare,
      driverName: data.driverName,
      driverNumber: data.driverNumber,
      vehicleNumber: data.vehicleNumber,
      vehicleVariant: data.vehicleVariant,
      rideOtp: data.rideOtp,
    };
  }

  async getRideStatus(rideId: string): Promise<RideStatus> {
    const res = await fetch(`${NY_API_BASE}/ride/${rideId}/status`, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });

    if (!res.ok) {
      throw new Error(`Get ride status failed: ${res.status}`);
    }

    return await res.json() as RideStatus;
  }

  async cancelBooking(
    bookingId: string,
    reasonCode: string,
    reasonStage: 'OnSearch' | 'OnInit' | 'OnConfirm' | 'OnAssign',
    additionalInfo?: string
  ): Promise<void> {
    const body: any = {
      reasonCode,
      reasonStage,
    };

    if (additionalInfo) {
      body.additionalInfo = additionalInfo;
    }

    const res = await fetch(`${NY_API_BASE}/rideBooking/${bookingId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Cancel booking failed: ${res.status}`);
    }
  }

  // ============================================================================
  // Polling Helpers
  // ============================================================================

  /**
   * Polls /rideBooking/select/{personId}/{estimateId}/result until bookingId is returned.
   * Returns the bookingId string, or null if not yet assigned.
   */
  async pollSelectResult(personId: string, estimateId: string): Promise<{ bookingId: string | null; raw: any }> {
    const url = `${NY_API_BASE}/rideBooking/select/${personId}/${estimateId}/result`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[booking] pollSelectResult ${res.status}: ${body.substring(0, 200)}`);
      return { bookingId: null, raw: null };
    }

    const data = await res.json() as any;
    const bookingId = data.bookingId || data.id || null;
    return { bookingId, raw: data };
  }

  async pollForEstimates(
    searchId: string,
    maxDurationMs: number = 10000,
    intervalMs: number = 2000
  ): Promise<RideEstimate[]> {
    const startTime = Date.now();
    const maxEndTime = startTime + maxDurationMs;

    while (Date.now() < maxEndTime) {
      const estimates = await this.getEstimates(searchId);

      if (estimates.length > 0) {
        return estimates;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('No ride estimates found. Please try again.');
  }

  async pollForDriverAssignment(
    maxDurationMs: number = 60000,
    intervalMs: number = 3000
  ): Promise<RideBooking | null> {
    const startTime = Date.now();
    const maxEndTime = startTime + maxDurationMs;

    while (Date.now() < maxEndTime) {
      const bookings = await this.getActiveBookings();

      if (bookings.length > 0) {
        const booking = bookings[0];
        if (booking.status === 'TRIP_ASSIGNED' || booking.driverName) {
          return booking;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return null; // Timeout - driver not yet assigned
  }
}

export default NammaYatriClient;
