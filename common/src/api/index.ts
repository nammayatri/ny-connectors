import type {
  NammaYatriClientConfig,
  ApiError,
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
  RideBooking,
  FetchStatusResponse,
  SavedReqLocationsListRes,
  Address,
  Location,
} from '../types/index.js';

export type {
  NammaYatriClientConfig,
  ApiError,
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
  RideBooking,
  FetchStatusResponse,
  SavedReqLocationsListRes,
  Address,
  Location,
};

/**
 * Namma Yatri API Client
 * 
 * A shared client for interacting with Namma Yatri APIs.
 * Used by both the MCP server and CLI TUI.
 */
export class NammaYatriClient {
  private readonly apiBase: string;
  private readonly pollIntervalMs: number;
  private readonly searchPollMaxMs: number;
  private readonly driverPollMaxMs: number;

  constructor(config: NammaYatriClientConfig) {
    this.apiBase = config.apiBase;
    this.pollIntervalMs = config.pollIntervalMs ?? 2000;
    this.searchPollMaxMs = config.searchPollMaxMs ?? 10000;
    this.driverPollMaxMs = config.driverPollMaxMs ?? 30000;
  }

  // ============================================================================
  // Core API Methods
  // ============================================================================

  /**
   * Make an authenticated API call
   */
  async makeApiCall<T = unknown>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: unknown,
    token?: string
  ): Promise<T> {
    const url = `${this.apiBase}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['token'] = token;
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
      let errorDetails = errorText;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && typeof errorJson === 'object') {
          errorDetails = JSON.stringify(errorJson);
        }
      } catch {
        // If not JSON, use the text as-is
      }

      const error = new Error(
        `API call failed: ${response.status} ${response.statusText} - ${errorDetails}`
      ) as ApiError;
      error.statusCode = response.status;
      error.responseBody = errorText;
      error.isAuthError = response.status === 401;
      throw error;
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  /**
   * Get authentication token
   */
  async getToken(mobileNumber: string, accessCode: string): Promise<GetTokenResponse> {
    const request: GetTokenRequest = {
      appSecretCode: accessCode,
      userMobileNo: mobileNumber,
    };

    return this.makeApiCall<GetTokenResponse>('/auth/get-token', 'POST', request);
  }

  // ============================================================================
  // Places API
  // ============================================================================

  /**
   * Search for places using autocomplete
   */
  async searchPlaces(
    searchText: string,
    options?: {
      token?: string;
      sourceLat?: number;
      sourceLon?: number;
      radius?: number;
    }
  ): Promise<AutoCompleteResponse> {
    const request: AutoCompleteRequest = {
      autoCompleteType: 'DROP',
      input: searchText,
      language: 'ENGLISH',
      location: '12.97413032560963,77.58534937018615',
      origin:
        options?.sourceLat && options?.sourceLon
          ? { lat: options.sourceLat, lon: options.sourceLon }
          : undefined,
      radius: options?.radius ?? 50000,
      radiusWithUnit: {
        unit: 'Meter',
        value: options?.radius ?? 50000.0,
      },
      sessionToken: undefined,
      strictbounds: false,
      types_: undefined,
    };

    return this.makeApiCall<AutoCompleteResponse>(
      '/maps/autoComplete',
      'POST',
      request,
      options?.token
    );
  }

  /**
   * Get place details by place ID
   */
  async getPlaceDetails(placeId: string, token?: string): Promise<GetPlaceDetailsResponse>;

  /**
   * Get place details by coordinates
   */
  async getPlaceDetails(lat: number, lon: number, token?: string): Promise<GetPlaceDetailsResponse>;

  async getPlaceDetails(
    placeIdOrLat: string | number,
    lonOrToken?: number | string,
    maybeToken?: string
  ): Promise<GetPlaceDetailsResponse> {
    let request: GetPlaceDetailsRequest;
    let token: string | undefined;

    if (typeof placeIdOrLat === 'string') {
      // placeId overload
      request = {
        getBy: {
          contents: placeIdOrLat,
          tag: 'ByPlaceId',
        },
        language: 'ENGLISH',
        sessionToken: 'default-token',
      };
      token = lonOrToken as string | undefined;
    } else {
      // lat/lon overload
      request = {
        getBy: {
          contents: {
            lat: placeIdOrLat,
            lon: lonOrToken as number,
          },
          tag: 'ByLatLong',
        },
        language: 'ENGLISH',
        sessionToken: 'default-token',
      };
      token = maybeToken;
    }

    return this.makeApiCall<GetPlaceDetailsResponse>(
      '/maps/getPlaceName',
      'POST',
      request,
      token
    );
  }

  // ============================================================================
  // Ride Search
  // ============================================================================

  /**
   * Parse coordinates from various formats
   */
  parseCoordinates(latOrString: number | string, lon?: number): Location {
    if (lon !== undefined) {
      const lat = typeof latOrString === 'string' ? parseFloat(latOrString) : latOrString;
      if (isNaN(lat) || isNaN(lon)) {
        throw new Error(`Invalid coordinate values. Could not parse lat/lon from: ${latOrString}, ${lon}`);
      }
      return { lat, lon };
    }

    if (typeof latOrString === 'string') {
      const parts = latOrString.split(',').map((s) => s.trim());
      if (parts.length !== 2) {
        throw new Error(`Invalid coordinate format. Expected "lat,lon" but got: ${latOrString}`);
      }
      const lat = parseFloat(parts[0]);
      const lon = parseFloat(parts[1]);
      if (isNaN(lat) || isNaN(lon)) {
        throw new Error(`Invalid coordinate values. Could not parse lat/lon from: ${latOrString}`);
      }
      return { lat, lon };
    }

    throw new Error('lon is required when lat is a number');
  }

  /**
   * Create a minimal address from coordinates
   */
  createAddressFromCoordinates(lat: number, lon: number): Address {
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
   * Start a ride search
   */
  async startRideSearch(params: {
    originLat: number;
    originLon: number;
    destLat: number;
    destLon: number;
    originAddress?: Address;
    destAddress?: Address;
    token: string;
    placeNameSource?: string;
  }): Promise<SearchRideResponse> {
    const originAddress: Address = params.originAddress
      ? {
          area: params.originAddress.area || '',
          city: params.originAddress.city || '',
          country: params.originAddress.country || '',
          building: params.originAddress.building || '',
          placeId: params.originAddress.placeId || '',
          state: params.originAddress.state || '',
          ...(params.originAddress.areaCode && { areaCode: params.originAddress.areaCode }),
          ...(params.originAddress.door && { door: params.originAddress.door }),
          ...(params.originAddress.extras && { extras: params.originAddress.extras }),
          ...(params.originAddress.instructions && { instructions: params.originAddress.instructions }),
          ...(params.originAddress.street && { street: params.originAddress.street }),
          ...(params.originAddress.title && { title: params.originAddress.title }),
          ...(params.originAddress.ward && { ward: params.originAddress.ward }),
        }
      : this.createAddressFromCoordinates(params.originLat, params.originLon);

    const destinationAddress: Address = params.destAddress
      ? {
          area: params.destAddress.area || '',
          city: params.destAddress.city || '',
          country: params.destAddress.country || '',
          building: params.destAddress.building || '',
          placeId: params.destAddress.placeId || '',
          state: params.destAddress.state || '',
          ...(params.destAddress.areaCode && { areaCode: params.destAddress.areaCode }),
          ...(params.destAddress.door && { door: params.destAddress.door }),
          ...(params.destAddress.extras && { extras: params.destAddress.extras }),
          ...(params.destAddress.instructions && { instructions: params.destAddress.instructions }),
          ...(params.destAddress.street && { street: params.destAddress.street }),
          ...(params.destAddress.title && { title: params.destAddress.title }),
          ...(params.destAddress.ward && { ward: params.destAddress.ward }),
        }
      : this.createAddressFromCoordinates(params.destLat, params.destLon);

    const request: SearchRideRequest = {
      contents: {
        origin: {
          gps: { lat: params.originLat, lon: params.originLon },
          address: originAddress,
        },
        destination: {
          gps: { lat: params.destLat, lon: params.destLon },
          address: destinationAddress,
        },
        placeNameSource: params.placeNameSource ?? 'API_CLIENT',
        platformType: 'APPLICATION',
      },
      fareProductType: 'ONE_WAY',
    };

    return this.makeApiCall<SearchRideResponse>('/rideSearch', 'POST', request, params.token);
  }

  /**
   * Poll for search results
   */
  async pollSearchResults(searchId: string, token: string): Promise<SearchResultsResponse> {
    const startTime = Date.now();
    const maxEndTime = startTime + this.searchPollMaxMs;

    while (Date.now() < maxEndTime) {
      const results = await this.makeApiCall<SearchResultsResponse>(
        `/rideSearch/${searchId}/results`,
        'GET',
        undefined,
        token
      );

      if (results.estimates && results.estimates.length > 0) {
        return results;
      }

      await this.sleep(this.pollIntervalMs);
    }

    throw new Error(`Polling timeout: No ride estimates found after ${this.searchPollMaxMs}ms`);
  }

  /**
   * Search for rides (combines start + poll)
   */
  async searchRide(params: {
    originLat: number | string;
    originLon?: number;
    originAddress?: Address;
    destLat: number | string;
    destLon?: number;
    destAddress?: Address;
    token: string;
    placeNameSource?: string;
  }): Promise<{ searchId: string; estimates: SearchResultsResponse['estimates'] }> {
    const origin = this.parseCoordinates(params.originLat, params.originLon);
    const dest = this.parseCoordinates(params.destLat, params.destLon);

    const searchResponse = await this.startRideSearch({
      originLat: origin.lat,
      originLon: origin.lon,
      destLat: dest.lat,
      destLon: dest.lon,
      originAddress: params.originAddress,
      destAddress: params.destAddress,
      token: params.token,
      placeNameSource: params.placeNameSource,
    });

    const results = await this.pollSearchResults(searchResponse.searchId, token);

    return {
      searchId: searchResponse.searchId,
      estimates: results.estimates,
    };
  }

  // ============================================================================
  // Estimate Selection
  // ============================================================================

  /**
   * Select an estimate for booking
   */
  async selectEstimate(params: {
    estimateId: string;
    token: string;
    additionalEstimateIds?: string[];
    specialAssistance?: boolean;
    isPetRide?: boolean;
    tipAmount?: number;
    tipCurrency?: string;
  }): Promise<void> {
    const request: SelectEstimateRequest = {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: '',
      otherSelectedEstimates: params.additionalEstimateIds ?? [],
      disabilityDisable: !(params.specialAssistance ?? false),
      isPetRide: params.isPetRide ?? false,
      ...(params.tipAmount && {
        customerExtraFeeWithCurrency: {
          amount: params.tipAmount,
          currency: params.tipCurrency ?? 'INR',
        },
        customerExtraFee: params.tipAmount,
      }),
    };

    await this.makeApiCall(`/estimate/${params.estimateId}/select2`, 'POST', request, params.token);
  }

  /**
   * Add tip to an estimate
   */
  async addTip(params: {
    estimateId: string;
    tipAmount: number;
    tipCurrency?: string;
    token: string;
  }): Promise<void> {
    return this.selectEstimate({
      estimateId: params.estimateId,
      tipAmount: params.tipAmount,
      tipCurrency: params.tipCurrency,
      token: params.token,
    });
  }

  /**
   * Cancel a search
   */
  async cancelSearch(estimateId: string, token: string): Promise<void> {
    await this.makeApiCall(`/estimate/${estimateId}/cancelSearch`, 'POST', {}, token);
  }

  // ============================================================================
  // Ride Status
  // ============================================================================

  /**
   * Fetch ride booking status
   */
  async fetchRideStatus(params: {
    token: string;
    onlyActive?: boolean;
    limit?: number;
    offset?: number;
    status?: string[];
    clientId?: string;
  }): Promise<FetchStatusResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.onlyActive !== undefined) {
      searchParams.append('onlyActive', String(params.onlyActive));
    }
    
    if (params.limit) {
      searchParams.append('limit', String(params.limit));
    }
    
    if (params.offset) {
      searchParams.append('offset', String(params.offset));
    }
    
    if (params.status && params.status.length > 0) {
      searchParams.append('status', JSON.stringify(params.status));
    }
    
    searchParams.append('clientId', params.clientId ?? 'NY_CLIENT');

    const endpoint = `/rideBooking/list?${searchParams.toString()}`;
    return this.makeApiCall<FetchStatusResponse>(endpoint, 'GET', undefined, params.token);
  }

  /**
   * Poll for ride assignment after estimate selection
   */
  async pollForRideAssignment(token: string): Promise<RideBooking | null> {
    const startTime = Date.now();

    while (Date.now() < startTime + this.driverPollMaxMs) {
      const response = await this.fetchRideStatus({
        token,
        onlyActive: true,
        clientId: 'NY_CLIENT',
      });

      if (response.list && response.list.length > 0) {
        return response.list[0];
      }

      await this.sleep(this.pollIntervalMs);
    }

    return null;
  }

  // ============================================================================
  // Saved Locations
  // ============================================================================

  /**
   * Get saved locations
   */
  async getSavedLocations(token: string): Promise<SavedReqLocationsListRes> {
    return this.makeApiCall<SavedReqLocationsListRes>(
      '/savedLocation/list',
      'GET',
      undefined,
      token
    );
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a client for production API
 */
export function createProductionClient(): NammaYatriClient {
  return new NammaYatriClient({
    apiBase: 'https://api.moving.tech/pilot/app/v2',
  });
}

/**
 * Create a client for sandbox API
 */
export function createSandboxClient(): NammaYatriClient {
  return new NammaYatriClient({
    apiBase: 'https://api.sandbox.moving.tech/dev/app/v2',
  });
}

/**
 * Create a client with custom configuration
 */
export function createClient(config: NammaYatriClientConfig): NammaYatriClient {
  return new NammaYatriClient(config);
}