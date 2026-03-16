/**
 * Namma Yatri TUI - API Client
 * Adapted from connectors/src/ny/client.ts and mcp/src/index.ts
 */

import {
  NYPlace,
  NYPlaceDetails,
  NYEstimate,
  NYSavedLocation,
  RideBooking,
  AuthResponse,
  GetTokenRequest,
  GetTokenResponse,
  AutoCompleteRequest,
  AutoCompleteResponse,
  GetPlaceDetailsRequest,
  GetPlaceDetailsResponse,
  SearchRideRequest,
  SearchRideResponse,
  SearchResultsResponse,
  SelectEstimateRequest,
  SavedReqLocationsListRes,
  FetchStatusResponse,
  Address,
  Location,
} from '../types/index.js';

// ============================================================================
// Configuration
// ============================================================================

const NY_API_BASE = process.env.NY_API_BASE || 'https://api.moving.tech/pilot/app/v2';
const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_DURATION_MS = 10000;
const MAX_DRIVER_POLL_DURATION_MS = 30000;

// ============================================================================
// Custom Error Types
// ============================================================================

export class NYAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NYAuthError';
  }
}

export class NYApiError extends Error {
  public statusCode?: number;
  public responseBody?: string;

  constructor(message: string, statusCode?: number, responseBody?: string) {
    super(message);
    this.name = 'NYApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

// ============================================================================
// NammaYatriClient Class
// ============================================================================

export class NammaYatriClient {
  private token: string;
  private currentSearchId: string | null = null;
  private currentEstimateId: string | null = null;

  constructor(token: string) {
    this.token = token;
  }

  // ============================================================================
  // Static Authentication
  // ============================================================================

  /**
   * Authenticate with Namma Yatri API
   * @param mobileNumber - User's mobile number
   * @param accessCode - App secret access code from Namma Yatri app
   * @returns Promise with token and person details
   */
  static async authenticate(
    mobileNumber: string,
    accessCode: string
  ): Promise<{ token: string; person?: AuthResponse['person'] }> {
    const request: GetTokenRequest = {
      appSecretCode: accessCode,
      userMobileNo: mobileNumber,
    };

    const response = await this.makeApiCall<GetTokenResponse>(
      '/auth/get-token',
      'POST',
      request,
      false
    );

    if (!response.token) {
      throw new NYAuthError('Authentication failed - no token in response');
    }

    return {
      token: response.token,
      person: response.person,
    };
  }

  // ============================================================================
  // Saved Locations
  // ============================================================================

  /**
   * Get user's saved locations (Home, Work, etc.)
   * @returns Promise with array of saved locations
   */
  async getSavedLocations(): Promise<NYSavedLocation[]> {
    const response = await this.makeApiCall<SavedReqLocationsListRes>(
      '/savedLocation/list',
      'GET',
      undefined,
      true
    );
    return response.list || [];
  }

  // ============================================================================
  // Place Search
  // ============================================================================

  /**
   * Search for places using autocomplete
   * @param searchText - Location name or address to search for
   * @param sourceLat - Optional source latitude for proximity search
   * @param sourceLon - Optional source longitude for proximity search
   * @returns Promise with array of matching places
   */
  async searchPlaces(
    searchText: string,
    sourceLat?: number,
    sourceLon?: number
  ): Promise<NYPlace[]> {
    const request: AutoCompleteRequest = {
      autoCompleteType: 'DROP',
      input: searchText,
      language: 'ENGLISH',
      location: '12.97413032560963,77.58534937018615', // Default location (Bangalore)
      origin:
        sourceLat && sourceLon
          ? { lat: sourceLat, lon: sourceLon }
          : undefined,
      radius: 50000,
      radiusWithUnit: {
        unit: 'Meter',
        value: 50000.0,
      },
      strictbounds: false,
    };

    const response = await this.makeApiCall<AutoCompleteResponse>(
      '/maps/autoComplete',
      'POST',
      request,
      true
    );

    return (response.predictions || []).map((p) => ({
      description: p.description,
      placeId: p.placeId,
      distance: p.distanceWithUnit?.value,
    }));
  }

  // ============================================================================
  // Place Details
  // ============================================================================

  /**
   * Get detailed location information including lat/lon
   * @param placeId - The place ID from searchPlaces response
   * @returns Promise with place details
   */
  async getPlaceDetails(placeId: string): Promise<NYPlaceDetails> {
    const request: GetPlaceDetailsRequest = {
      getBy: {
        contents: placeId,
        tag: 'ByPlaceId',
      },
      language: 'ENGLISH',
      sessionToken: 'default-token',
    };

    const response = await this.makeApiCall<GetPlaceDetailsResponse>(
      '/maps/getPlaceName',
      'POST',
      request,
      true
    );

    return {
      lat: response.lat,
      lon: response.lon,
      placeId: response.placeId,
      address: response.address || {},
    };
  }

  /**
   * Get place details by coordinates
   * @param lat - Latitude
   * @param lon - Longitude
   * @returns Promise with place details
   */
  async getPlaceDetailsByCoordinates(lat: number, lon: number): Promise<NYPlaceDetails> {
    const request: GetPlaceDetailsRequest = {
      getBy: {
        contents: { lat, lon },
        tag: 'ByLatLong',
      },
      language: 'ENGLISH',
      sessionToken: 'default-token',
    };

    const response = await this.makeApiCall<GetPlaceDetailsResponse>(
      '/maps/getPlaceName',
      'POST',
      request,
      true
    );

    return {
      lat: response.lat,
      lon: response.lon,
      placeId: response.placeId,
      address: response.address || {},
    };
  }

  // ============================================================================
  // Ride Search
  // ============================================================================

  /**
   * Search for available rides between origin and destination
   * @param origin - Origin place details
   * @param destination - Destination place details
   * @returns Promise with searchId
   */
  async searchRide(origin: NYPlaceDetails, destination: NYPlaceDetails): Promise<string> {
    const request: SearchRideRequest = {
      contents: {
        origin: {
          gps: { lat: origin.lat, lon: origin.lon },
          address: {
            area: origin.address.area || '',
            city: origin.address.city || '',
            country: origin.address.country || '',
            building: origin.address.building || '',
            placeId: origin.placeId,
            state: origin.address.state || '',
          },
        },
        destination: {
          gps: { lat: destination.lat, lon: destination.lon },
          address: {
            area: destination.address.area || '',
            city: destination.address.city || '',
            country: destination.address.country || '',
            building: destination.address.building || '',
            placeId: destination.placeId,
            state: destination.address.state || '',
          },
        },
        placeNameSource: 'API_TUI',
        platformType: 'APPLICATION',
      },
      fareProductType: 'ONE_WAY',
    };

    const response = await this.makeApiCall<SearchRideResponse>(
      '/rideSearch',
      'POST',
      request,
      true
    );

    this.currentSearchId = response.searchId;
    return response.searchId;
  }

  // ============================================================================
  // Estimates
  // ============================================================================

  /**
   * Get ride estimates for a search
   * @param searchId - The search ID from searchRide
   * @returns Promise with array of estimates
   */
  async getEstimates(searchId: string): Promise<NYEstimate[]> {
    const response = await this.makeApiCall<SearchResultsResponse>(
      `/rideSearch/${searchId}/results`,
      'GET',
      undefined,
      true
    );

    return (response.estimates || []).map((e) => ({
      id: e.id,
      estimatedFare: e.estimatedFare,
      estimatedFareWithCurrency: e.estimatedFareWithCurrency,
      estimatedTotalFare: e.estimatedTotalFare,
      estimatedTotalFareWithCurrency: e.estimatedTotalFareWithCurrency,
      estimatedPickupDuration: e.estimatedPickupDuration,
      vehicleVariant: e.vehicleVariant,
      serviceTierType: e.serviceTierType,
      serviceTierName: e.serviceTierName,
      serviceTierShortDesc: e.serviceTierShortDesc,
      providerName: e.providerName,
      providerId: e.providerId,
      providerLogoUrl: e.providerLogoUrl,
      validTill: e.validTill,
      totalFareRange: e.totalFareRange,
      tipOptions: e.tipOptions,
      smartTipSuggestion: e.smartTipSuggestion,
      smartTipReason: e.smartTipReason,
      isAirConditioned: e.isAirConditioned,
      vehicleServiceTierSeatingCapacity: e.vehicleServiceTierSeatingCapacity,
      tripTerms: e.tripTerms,
      specialLocationTag: e.specialLocationTag,
      isBlockedRoute: e.isBlockedRoute,
      isCustomerPrefferedSearchRoute: e.isCustomerPrefferedSearchRoute,
      isInsured: e.isInsured,
      insuredAmount: e.insuredAmount,
      isReferredRide: e.isReferredRide,
      agencyName: e.agencyName,
      agencyNumber: e.agencyNumber,
      agencyCompletedRidesCount: e.agencyCompletedRidesCount,
    }));
  }

  /**
   * Poll for estimates until available or timeout
   * @param searchId - The search ID
   * @param maxDurationMs - Maximum polling duration in milliseconds
   * @returns Promise with array of estimates
   */
  async pollForEstimates(
    searchId: string,
    maxDurationMs: number = MAX_POLLING_DURATION_MS
  ): Promise<NYEstimate[]> {
    const startTime = Date.now();
    const maxEndTime = startTime + maxDurationMs;

    while (Date.now() < maxEndTime) {
      const results = await this.getEstimates(searchId);

      if (results.length > 0) {
        return results;
      }

      await this.sleep(POLLING_INTERVAL_MS);
    }

    throw new NYApiError(
      `Polling timeout: No ride estimates found after ${maxDurationMs}ms`
    );
  }

  // ============================================================================
  // Estimate Selection
  // ============================================================================

  /**
   * Select an estimate for booking
   * @param estimateId - The estimate ID to select
   * @param additionalEstimateIds - Optional additional estimate IDs for multiple variants
   * @param isPetRide - Whether it's a pet ride
   * @param specialAssistance - Whether special assistance is needed
   */
  async selectEstimate(
    estimateId: string,
    additionalEstimateIds?: string[],
    isPetRide: boolean = false,
    specialAssistance: boolean = false
  ): Promise<void> {
    const request: SelectEstimateRequest = {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: '',
      otherSelectedEstimates: additionalEstimateIds || [],
      disabilityDisable: !specialAssistance,
      isPetRide,
    };

    await this.makeApiCall(
      `/estimate/${estimateId}/select2`,
      'POST',
      request,
      true
    );

    this.currentEstimateId = estimateId;
  }

  /**
   * Add a tip to an estimate and select it
   * @param estimateId - The estimate ID
   * @param tipAmount - Tip amount
   * @param tipCurrency - Currency code (default: INR)
   */
  async addTipAndSelect(
    estimateId: string,
    tipAmount: number,
    tipCurrency: string = 'INR'
  ): Promise<void> {
    const request: SelectEstimateRequest = {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: '',
      customerExtraFeeWithCurrency: {
        amount: tipAmount,
        currency: tipCurrency,
      },
      customerExtraFee: tipAmount,
      otherSelectedEstimates: [],
      disabilityDisable: true,
      isPetRide: false,
    };

    await this.makeApiCall(
      `/estimate/${estimateId}/select2`,
      'POST',
      request,
      true
    );

    this.currentEstimateId = estimateId;
  }

  // ============================================================================
  // Driver Assignment Polling
  // ============================================================================

  /**
   * Poll for driver assignment after estimate selection
   * @param maxDurationMs - Maximum polling duration in milliseconds (default: 30000)
   * @returns Promise with ride booking details or null if timeout
   */
  async pollForDriverAssignment(
    maxDurationMs: number = MAX_DRIVER_POLL_DURATION_MS
  ): Promise<RideBooking | null> {
    const startTime = Date.now();
    const maxEndTime = startTime + maxDurationMs;

    while (Date.now() < maxEndTime) {
      const activeBookings = await this.getActiveBookings();

      if (activeBookings.length > 0) {
        return activeBookings[0];
      }

      await this.sleep(POLLING_INTERVAL_MS);
    }

    // Timeout reached - no driver assigned
    return null;
  }

  // ============================================================================
  // Cancel Search
  // ============================================================================

  /**
   * Cancel an active ride search
   * @param estimateId - The estimate ID to cancel
   */
  async cancelSearch(estimateId: string): Promise<void> {
    await this.makeApiCall(
      `/estimate/${estimateId}/cancelSearch`,
      'POST',
      {},
      true
    );

    if (this.currentEstimateId === estimateId) {
      this.currentEstimateId = null;
    }
  }

  // ============================================================================
  // Active Bookings
  // ============================================================================

  /**
   * Get active ride bookings
   * @returns Promise with array of ride bookings
   */
  async getActiveBookings(): Promise<RideBooking[]> {
    const params = new URLSearchParams({
      onlyActive: 'true',
      clientId: 'ACP_TUI',
    });

    const response = await this.makeApiCall<FetchStatusResponse>(
      `/rideBooking/list?${params.toString()}`,
      'GET',
      undefined,
      true
    );

    return response.list || [];
  }

  /**
   * Get all ride bookings (active and historical)
   * @param limit - Maximum number of results
   * @param offset - Offset for pagination
   * @returns Promise with array of ride bookings
   */
  async getAllBookings(limit?: number, offset?: number): Promise<RideBooking[]> {
    const params = new URLSearchParams({
      onlyActive: 'false',
      clientId: 'ACP_TUI',
    });

    if (limit !== undefined) {
      params.append('limit', limit.toString());
    }
    if (offset !== undefined) {
      params.append('offset', offset.toString());
    }

    const response = await this.makeApiCall<FetchStatusResponse>(
      `/rideBooking/list?${params.toString()}`,
      'GET',
      undefined,
      true
    );

    return response.list || [];
  }

  // ============================================================================
  // Booking Details
  // ============================================================================

  /**
   * Get full details of a specific booking
   * @param bookingId - The booking ID
   * @returns Promise with booking details
   */
  async getBookingDetails(bookingId: string): Promise<unknown> {
    return this.makeApiCall(
      `/rideBooking/v2/${bookingId}`,
      'GET',
      undefined,
      true
    );
  }

  // ============================================================================
  // Ride Status
  // ============================================================================

  /**
   * Get real-time status of an active ride
   * @param rideId - The ride ID
   * @returns Promise with ride status
   */
  async getRideStatus(rideId: string): Promise<unknown> {
    return this.makeApiCall(
      `/ride/${rideId}/status`,
      'GET',
      undefined,
      true
    );
  }

  // ============================================================================
  // Cancellation Reasons
  // ============================================================================

  /**
   * Get valid cancellation reasons for a stage
   * @param stage - The cancellation stage (OnSearch, OnInit, OnConfirm, OnAssign)
   * @returns Promise with array of cancellation reasons
   */
  async getCancellationReasons(
    stage: 'OnSearch' | 'OnInit' | 'OnConfirm' | 'OnAssign'
  ): Promise<Array<{ reasonCode: string; description: string }>> {
    return this.makeApiCall(
      `/cancellationReason/list?cancellationStage=${stage}`,
      'GET',
      undefined,
      true
    );
  }

  // ============================================================================
  // Cancel Booking
  // ============================================================================

  /**
   * Cancel a confirmed ride booking
   * @param bookingId - The booking ID
   * @param reasonCode - Cancellation reason code
   * @param reasonStage - The cancellation stage
   * @param additionalInfo - Optional additional cancellation reason
   * @param reallocate - Whether to try reallocating to another driver
   */
  async cancelBooking(
    bookingId: string,
    reasonCode: string,
    reasonStage: 'OnSearch' | 'OnInit' | 'OnConfirm' | 'OnAssign',
    additionalInfo?: string,
    reallocate?: boolean
  ): Promise<void> {
    const request: {
      reasonCode: string;
      reasonStage: string;
      additionalInfo?: string;
      reallocate?: boolean;
    } = {
      reasonCode,
      reasonStage,
    };

    if (additionalInfo !== undefined) {
      request.additionalInfo = additionalInfo;
    }
    if (reallocate !== undefined) {
      request.reallocate = reallocate;
    }

    await this.makeApiCall(
      `/rideBooking/${bookingId}/cancel`,
      'POST',
      request,
      true
    );
  }

  // ============================================================================
  // Price Breakdown
  // ============================================================================

  /**
   * Get detailed fare breakdown for a booking
   * @param bookingId - The booking ID
   * @returns Promise with price breakdown
   */
  async getPriceBreakdown(bookingId: string): Promise<unknown> {
    return this.makeApiCall(
      `/priceBreakup?bookingId=${bookingId}`,
      'GET',
      undefined,
      true
    );
  }

  // ============================================================================
  // Post-Ride Tip
  // ============================================================================

  /**
   * Add a tip after a ride has been completed
   * @param rideId - The ride ID
   * @param tipAmount - Tip amount
   * @param tipCurrency - Currency code (default: INR)
   */
  async addPostRideTip(
    rideId: string,
    tipAmount: number,
    tipCurrency: string = 'INR'
  ): Promise<void> {
    const request = {
      amount: {
        amount: tipAmount,
        currency: tipCurrency,
      },
    };

    await this.makeApiCall(
      `/payment/${rideId}/addTip`,
      'POST',
      request,
      true
    );
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get the current search ID
   */
  getCurrentSearchId(): string | null {
    return this.currentSearchId;
  }

  /**
   * Get the current estimate ID
   */
  getCurrentEstimateId(): string | null {
    return this.currentEstimateId;
  }

  /**
   * Clear the current search/estimate state
   */
  clearState(): void {
    this.currentSearchId = null;
    this.currentEstimateId = null;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Make an API call to the Namma Yatri API
   */
  private static async makeApiCall<T = unknown>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: unknown,
    requireAuth: boolean = false
  ): Promise<T> {
    const url = `${NY_API_BASE}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API call failed: ${response.status} ${response.statusText}`;

      // Try to parse JSON error response for more details
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && typeof errorJson === 'object') {
          errorMessage += ` - ${JSON.stringify(errorJson)}`;
        }
      } catch {
        // If not JSON, use the text as-is
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }

      if (response.status === 401) {
        throw new NYAuthError(errorMessage);
      }

      throw new NYApiError(errorMessage, response.status, errorText);
    }

    return (await response.json()) as T;
  }

  /**
   * Make an authenticated API call
   */
  private async makeApiCall<T = unknown>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: unknown,
    requireAuth: boolean = true
  ): Promise<T> {
    const url = `${NY_API_BASE}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requireAuth) {
      headers['token'] = this.token;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API call failed: ${response.status} ${response.statusText}`;

      // Try to parse JSON error response for more details
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && typeof errorJson === 'object') {
          errorMessage += ` - ${JSON.stringify(errorJson)}`;
        }
      } catch {
        // If not JSON, use the text as-is
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }

      if (response.status === 401) {
        throw new NYAuthError(errorMessage);
      }

      throw new NYApiError(errorMessage, response.status, errorText);
    }

    return (await response.json()) as T;
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a minimal address object from coordinates
 * Used as fallback when no address is provided
 */
export function createAddressFromCoordinates(lat: number, lon: number): Address {
  return {
    area: `${lat.toFixed(6)},${lon.toFixed(6)}`,
    city: '',
    country: '',
    building: '',
    placeId: `${lat},${lon}`,
    state: '',
  };
}

/**
 * Parse coordinates from string or number inputs
 * Supports "lat,lon" string format or separate lat/lon numbers
 */
export function parseCoordinates(
  latOrString: number | string,
  lon?: number
): { lat: number; lon: number } {
  // If lon is provided, treat latOrString as latitude
  if (lon !== undefined) {
    const lat = typeof latOrString === 'string' ? parseFloat(latOrString) : latOrString;
    if (isNaN(lat) || isNaN(lon)) {
      throw new Error(
        `Invalid coordinate values. Could not parse lat/lon from: ${latOrString}, ${lon}`
      );
    }
    return { lat, lon };
  }

  // If lon is not provided, latOrString must be a "lat,lon" string
  if (typeof latOrString === 'string') {
    const parts = latOrString.split(',').map((s) => s.trim());
    if (parts.length !== 2) {
      throw new Error(
        `Invalid coordinate format. Expected "lat,lon" (e.g., "12.9352,77.6245") but got: ${latOrString}`
      );
    }
    const lat = parseFloat(parts[0]);
    const parsedLon = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(parsedLon)) {
      throw new Error(
        `Invalid coordinate values. Could not parse lat/lon from: ${latOrString}`
      );
    }
    return { lat, lon: parsedLon };
  } else {
    // Number format without lon - not allowed
    throw new Error(
      'lon is required when lat is a number'
    );
  }
}
