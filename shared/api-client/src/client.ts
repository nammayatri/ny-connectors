import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  ApiClientConfig,
  AuthConfig,
  AuthResult,
  PlacesSearchConfig,
  Place,
  PlaceDetails,
  RideSearchParams,
  RideSearchResult,
  Estimate,
  SelectEstimateParams,
  AddTipParams,
  FetchStatusParams,
  RideStatus,
  SavedLocation,
  CancelSearchParams,
  CancelSearchResponse,
  NammaYatriApiError,
  RideEstimate,
  SearchResultsResponse,
  Address,
  Location,
} from './types.js';

// Default configuration
const DEFAULT_BASE_URL = 'https://api.sandbox.moving.tech/dev/app/v2';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_CLIENT_ID = 'ACP_CLI';
const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_DURATION_MS = 10000;
const MAX_RIDE_ASSIGNMENT_POLLING_MS = 30000;

/**
 * Namma Yatri API Client
 * 
 * Provides a clean interface to interact with Namma Yatri ride-hailing services.
 * Supports authentication, place search, ride booking, and status tracking.
 * 
 * @example
 * ```typescript
 * // Authenticate
 * const authResult = await NyApiClient.authenticate({
 *   country: 'IN',
 *   mobileNumber: '9876543210',
 *   accessCode: 'your-access-code'
 * });
 * 
 * // Create client with token
 * const client = new NyApiClient(authResult.token);
 * 
 * // Search for places
 * const places = await client.searchPlaces({ searchText: 'Koramangala' });
 * 
 * // Get place details
 * const details = await client.getPlaceDetails(places[0].placeId);
 * 
 * // Search for rides
 * const searchResult = await client.searchRides({
 *   originLat: origin.lat,
 *   originLon: origin.lon,
 *   destinationLat: dest.lat,
 *   destinationLon: dest.lon
 * });
 * 
 * // Select an estimate
 * await client.selectEstimate({ estimateId: searchResult.estimates[0].id });
 * ```
 */
export class NyApiClient {
  private client: AxiosInstance;
  private token: string | null;
  private config: Required<ApiClientConfig>;

  /**
   * Create a new API client instance
   * 
   * @param token - Optional authentication token. Required for authenticated endpoints.
   * @param config - Optional client configuration
   */
  constructor(token?: string, config?: ApiClientConfig) {
    this.token = token || null;
    this.config = {
      baseUrl: config?.baseUrl || process.env.NY_API_BASE || DEFAULT_BASE_URL,
      timeout: config?.timeout || DEFAULT_TIMEOUT,
      clientId: config?.clientId || DEFAULT_CLIENT_ID,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Set the authentication token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * Get the current authentication token
   */
  getToken(): string | null {
    return this.token;
  }

  // ============================================================================
  // Authentication API
  // ============================================================================

  /**
   * Authenticate with Namma Yatri using access code
   * 
   * @param config - Authentication configuration
   * @returns Authentication result with token and saved locations
   */
  static async authenticate(config: AuthConfig): Promise<AuthResult> {
    const baseUrl = process.env.NY_API_BASE || DEFAULT_BASE_URL;
    
    const response = await fetch(`${baseUrl}/auth/get-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appSecretCode: config.accessCode,
        userMobileNo: config.mobileNumber,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
      throw new NammaYatriApiError(
        response.status,
        (errorData.errorMessage as string) || `Authentication failed: ${response.status}`,
        errorData
      );
    }

    const data = await response.json() as Record<string, unknown>;
    const token = data.token as string;
    
    // Fetch saved locations after authentication
    let savedLocations: SavedLocation[] = [];
    if (token) {
      try {
        const client = new NyApiClient(token, { baseUrl });
        savedLocations = await client.getSavedLocations();
      } catch (error) {
        // Non-fatal: continue without saved locations
        console.error('Failed to fetch saved locations:', error);
      }
    }

    return {
      authenticated: !!token,
      token,
      person: data.person as Record<string, unknown> | undefined,
      savedLocations,
    };
  }

  // ============================================================================
  // Places API
  // ============================================================================

  /**
   * Search for places using autocomplete
   * 
   * @param config - Search configuration
   * @returns Array of matching places
   */
  async searchPlaces(config: PlacesSearchConfig): Promise<Place[]> {
    this.ensureAuthenticated();

    const body = {
      autoCompleteType: 'DROP',
      input: config.searchText,
      language: 'ENGLISH',
      location: '12.97413032560963,77.58534937018615',
      origin: config.sourceLat && config.sourceLon
        ? { lat: config.sourceLat, lon: config.sourceLon }
        : undefined,
      radius: 50000,
      radiusWithUnit: { unit: 'Meter', value: 50000.0 },
      strictbounds: false,
    };

    const response = await this.request<{ predictions: Array<{
      description: string;
      placeId: string;
      distance?: number;
      distanceWithUnit?: { value: number; unit: string };
    }> }>('POST', '/maps/autoComplete', body);

    return (response.predictions || []).map((p) => ({
      description: p.description,
      placeId: p.placeId,
      distance: p.distanceWithUnit?.value || p.distance,
      distanceWithUnit: p.distanceWithUnit,
    }));
  }

  /**
   * Get place details by place ID
   * 
   * @param placeId - The place ID to look up
   * @returns Place details including coordinates and address
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetails>;

  /**
   * Get place details by coordinates
   * 
   * @param lat - Latitude
   * @param lon - Longitude
   * @returns Place details including address
   */
  async getPlaceDetails(lat: number, lon: number): Promise<PlaceDetails>;

  async getPlaceDetails(placeIdOrLat: string | number, lon?: number): Promise<PlaceDetails> {
    this.ensureAuthenticated();

    let body: object;

    if (typeof placeIdOrLat === 'string') {
      body = {
        getBy: { contents: placeIdOrLat, tag: 'ByPlaceId' },
        language: 'ENGLISH',
        sessionToken: 'default-token',
      };
    } else {
      body = {
        getBy: { contents: { lat: placeIdOrLat, lon: lon }, tag: 'ByLatLong' },
        language: 'ENGLISH',
        sessionToken: 'default-token',
      };
    }

    const response = await this.request<PlaceDetails>('POST', '/maps/getPlaceName', body);
    return response;
  }

  // ============================================================================
  // Ride Search API
  // ============================================================================

  /**
   * Search for available rides between origin and destination
   * 
   * @param params - Ride search parameters
   * @returns Search result with estimates
   */
  async searchRides(params: RideSearchParams): Promise<RideSearchResult> {
    this.ensureAuthenticated();

    // Parse coordinates
    const originCoords = this.parseCoordinates(params.originLat, params.originLon);
    const destCoords = this.parseCoordinates(params.destinationLat, params.destinationLon);

    // Build addresses
    const originAddress = this.buildAddress(params.originAddress, originCoords);
    const destinationAddress = this.buildAddress(params.destinationAddress, destCoords);

    const body = {
      contents: {
        origin: {
          gps: { lat: originCoords.lat, lon: originCoords.lon },
          address: originAddress,
        },
        destination: {
          gps: { lat: destCoords.lat, lon: destCoords.lon },
          address: destinationAddress,
        },
        placeNameSource: 'API_CLI',
        platformType: 'APPLICATION',
      },
      fareProductType: 'ONE_WAY',
    };

    const searchResponse = await this.request<{ searchId: string }>('POST', '/rideSearch', body);
    const searchId = searchResponse.searchId;

    // Poll for results
    const results = await this.pollSearchResults(searchId);

    return {
      searchId,
      estimates: results.estimates.map(this.mapEstimate),
      fromLocation: {
        lat: results.fromLocation.lat,
        lon: results.fromLocation.lon,
        address: results.fromLocation,
      },
      toLocation: {
        lat: results.toLocation.lat,
        lon: results.toLocation.lon,
        address: results.toLocation,
      },
    };
  }

  /**
   * Search for rides and return raw search ID (for manual polling)
   * 
   * @param params - Ride search parameters
   * @returns Search ID for polling
   */
  async startRideSearch(params: RideSearchParams): Promise<string> {
    this.ensureAuthenticated();

    const originCoords = this.parseCoordinates(params.originLat, params.originLon);
    const destCoords = this.parseCoordinates(params.destinationLat, params.destinationLon);

    const originAddress = this.buildAddress(params.originAddress, originCoords);
    const destinationAddress = this.buildAddress(params.destinationAddress, destCoords);

    const body = {
      contents: {
        origin: {
          gps: { lat: originCoords.lat, lon: originCoords.lon },
          address: originAddress,
        },
        destination: {
          gps: { lat: destCoords.lat, lon: destCoords.lon },
          address: destinationAddress,
        },
        placeNameSource: 'API_CLI',
        platformType: 'APPLICATION',
      },
      fareProductType: 'ONE_WAY',
    };

    const response = await this.request<{ searchId: string }>('POST', '/rideSearch', body);
    return response.searchId;
  }

  /**
   * Poll for ride search results
   * 
   * @param searchId - The search ID from startRideSearch
   * @param maxAttempts - Maximum polling attempts (default: 5)
   * @param interval - Polling interval in ms (default: 2000)
   * @returns Array of estimates
   */
  async pollForEstimates(searchId: string, maxAttempts = 5, interval = POLLING_INTERVAL_MS): Promise<Estimate[]> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const results = await this.getSearchResults(searchId);
        if (results.estimates.length > 0) {
          return results.estimates;
        }
      } catch (error) {
        // Continue polling on error
      }
      await this.sleep(interval);
    }
    return [];
  }

  /**
   * Get search results directly
   */
  async getSearchResults(searchId: string): Promise<RideSearchResult> {
    this.ensureAuthenticated();

    const response = await this.request<SearchResultsResponse>(
      'GET',
      `/rideSearch/${searchId}/results`
    );

    return {
      searchId,
      estimates: (response.estimates || []).map(this.mapEstimate),
      fromLocation: {
        lat: response.fromLocation.lat,
        lon: response.fromLocation.lon,
        address: response.fromLocation,
      },
      toLocation: {
        lat: response.toLocation.lat,
        lon: response.toLocation.lon,
        address: response.toLocation,
      },
    };
  }

  // ============================================================================
  // Estimate Selection API
  // ============================================================================

  /**
   * Select an estimate for booking
   * 
   * @param params - Selection parameters
   * @returns Promise that resolves when selection is complete
   */
  async selectEstimate(params: SelectEstimateParams): Promise<void> {
    this.ensureAuthenticated();

    const body = {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: '',
      otherSelectedEstimates: params.additionalEstimateIds || [],
      disabilityDisable: !(params.specialAssistance ?? false),
      isPetRide: params.isPetRide ?? false,
    };

    await this.request('POST', `/estimate/${params.estimateId}/select2`, body);
  }

  /**
   * Select an estimate and poll for driver assignment
   * 
   * @param params - Selection parameters
   * @param maxWaitMs - Maximum time to wait for assignment (default: 30s)
   * @returns Ride status if driver assigned, null otherwise
   */
  async selectEstimateAndWait(params: SelectEstimateParams, maxWaitMs = MAX_RIDE_ASSIGNMENT_POLLING_MS): Promise<RideStatus | null> {
    await this.selectEstimate(params);
    return this.pollForDriverAssignment(maxWaitMs);
  }

  /**
   * Add a tip to an estimate
   * 
   * @param params - Tip parameters
   */
  async addTip(params: AddTipParams): Promise<void> {
    this.ensureAuthenticated();

    const body = {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: '',
      customerExtraFeeWithCurrency: {
        amount: params.tipAmount,
        currency: params.tipCurrency || 'INR',
      },
      customerExtraFee: params.tipAmount,
      otherSelectedEstimates: [],
      disabilityDisable: true,
      isPetRide: false,
    };

    await this.request('POST', `/estimate/${params.estimateId}/select2`, body);
  }

  // ============================================================================
  // Cancel API
  // ============================================================================

  /**
   * Cancel an active ride search
   * 
   * @param params - Cancel parameters
   * @returns Cancel response
   */
  async cancelSearch(params: CancelSearchParams): Promise<CancelSearchResponse> {
    this.ensureAuthenticated();

    try {
      const response = await this.request<{ success?: boolean; message?: string }>(
        'POST',
        `/estimate/${params.estimateId}/cancelSearch`,
        {}
      );

      return {
        success: response.success !== false,
        message: response.message,
      };
    } catch (error) {
      if (error instanceof NammaYatriApiError) {
        return {
          success: false,
          message: error.message,
        };
      }
      throw error;
    }
  }

  // ============================================================================
  // Status API
  // ============================================================================

  /**
   * Get ride booking status
   * 
   * @param params - Status query parameters
   * @returns Array of ride bookings
   */
  async getRideStatus(params?: FetchStatusParams): Promise<RideStatus[]> {
    this.ensureAuthenticated();

    const queryParams = new URLSearchParams();
    queryParams.append('onlyActive', String(params?.onlyActive ?? true));
    queryParams.append('clientId', this.config.clientId);

    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.offset) queryParams.append('offset', String(params.offset));
    if (params?.status?.length) queryParams.append('status', JSON.stringify(params.status));

    const response = await this.request<{ list: RideStatus[] }>(
      'GET',
      `/rideBooking/list?${queryParams.toString()}`
    );

    return response.list || [];
  }

  /**
   * Poll for driver assignment after estimate selection
   * 
   * @param maxWaitMs - Maximum time to wait (default: 30s)
   * @returns Ride status if driver assigned, null otherwise
   */
  async pollForDriverAssignment(maxWaitMs = MAX_RIDE_ASSIGNMENT_POLLING_MS): Promise<RideStatus | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const rides = await this.getRideStatus({ onlyActive: true });
        if (rides.length > 0) {
          return rides[0];
        }
      } catch (error) {
        // Continue polling on error
      }
      await this.sleep(POLLING_INTERVAL_MS);
    }

    return null;
  }

  // ============================================================================
  // Saved Locations API
  // ============================================================================

  /**
   * Get user's saved locations
   * 
   * @returns Array of saved locations
   */
  async getSavedLocations(): Promise<SavedLocation[]> {
    this.ensureAuthenticated();

    const response = await this.request<{ list: SavedLocation[] }>('GET', '/savedLocation/list');
    return response.list || [];
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private ensureAuthenticated(): void {
    if (!this.token) {
      throw new NammaYatriApiError(401, 'Authentication required. Call authenticate() first or provide a token.');
    }
  }

  private async request<T>(method: 'GET' | 'POST', endpoint: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['token'] = this.token;
    }

    try {
      const response = await this.client.request<T>({
        method,
        url: endpoint,
        data: body,
        headers,
      });

      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        const statusCode = error.response?.status || 0;
        const errorData = error.response?.data;
        const message = errorData?.errorMessage || errorData?.message || error.message;

        throw new NammaYatriApiError(statusCode, message, errorData);
      }
      throw error;
    }
  }

  private parseCoordinates(latOrString: number | string, lon?: number): Location {
    if (lon !== undefined) {
      const lat = typeof latOrString === 'string' ? parseFloat(latOrString) : latOrString;
      if (isNaN(lat) || isNaN(lon)) {
        throw new Error(`Invalid coordinate values: ${latOrString}, ${lon}`);
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
        throw new Error(`Invalid coordinate values: ${latOrString}`);
      }
      return { lat, lon };
    }

    throw new Error('lon is required when lat is a number');
  }

  private buildAddress(address: Address | undefined, coords: Location): Address {
    if (address) {
      return {
        area: address.area || '',
        city: address.city || '',
        country: address.country || '',
        building: address.building || '',
        placeId: address.placeId || `${coords.lat},${coords.lon}`,
        state: address.state || '',
        ...(address.areaCode && { areaCode: address.areaCode }),
        ...(address.door && { door: address.door }),
        ...(address.extras && { extras: address.extras }),
        ...(address.instructions && { instructions: address.instructions }),
        ...(address.street && { street: address.street }),
        ...(address.title && { title: address.title }),
        ...(address.ward && { ward: address.ward }),
      };
    }

    return {
      area: `${coords.lat.toFixed(6)},${coords.lon.toFixed(6)}`,
      city: '',
      country: '',
      building: '',
      placeId: `${coords.lat},${coords.lon}`,
      state: '',
    };
  }

  private mapEstimate(e: RideEstimate): Estimate {
    return {
      id: e.id,
      estimatedFare: e.estimatedFare,
      estimatedTotalFare: e.estimatedTotalFare,
      currency: e.estimatedFareWithCurrency?.currency || 'INR',
      vehicleVariant: e.vehicleVariant,
      serviceTierName: e.serviceTierName,
      serviceTierShortDesc: e.serviceTierShortDesc,
      providerName: e.providerName,
      providerId: e.providerId,
      estimatedPickupDuration: e.estimatedPickupDuration,
      totalFareRange: e.totalFareRange,
      tipOptions: e.tipOptions,
      isAirConditioned: e.isAirConditioned,
    };
  }

  private async pollSearchResults(searchId: string): Promise<SearchResultsResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_POLLING_DURATION_MS) {
      const results = await this.request<SearchResultsResponse>(
        'GET',
        `/rideSearch/${searchId}/results`
      );

      if (results.estimates && results.estimates.length > 0) {
        return results;
      }

      await this.sleep(POLLING_INTERVAL_MS);
    }

    throw new NammaYatriApiError(408, `No ride estimates found after ${MAX_POLLING_DURATION_MS}ms`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Default export
export default NyApiClient;