/**
 * Namma Yatri API Client
 * Handles all HTTP communication with the Namma Yatri backend
 */

import { TokenManager, TokenObfuscator } from './token.js';
import type {
  Address,
  AuthResponse,
  AutoCompleteRequest,
  AutoCompleteResponse,
  BookingListResponse,
  Currency,
  GetPlaceDetailsByLatLong,
  GetPlaceDetailsByPlaceId,
  Location,
  LocationWithAddress,
  NammaYatriApiError,
  Person,
  PlaceDetails,
  PlacePrediction,
  RideBooking,
  RideEstimate,
  RideSearchRequest,
  RideSearchResponse,
  SavedLocation,
  SavedLocationsResponse,
  SearchResultsResponse,
  SelectEstimateOptions,
  SelectEstimateRequest,
  TokenValidationResult,
} from './types.js';

export { NammaYatriApiError } from './types.js';

// API Configuration
const API_BASE = process.env.NY_API_BASE || 'https://api.moving.tech/pilot/app/v2';
const CLIENT_ID = 'ACP_CLI';

// Polling configuration
const POLL_INTERVAL_MS = 2000;
const SEARCH_POLL_MAX_MS = 10000;
const DRIVER_POLL_MAX_MS = 30000;

/**
 * Namma Yatri API Client
 * Provides methods for all Namma Yatri API operations
 */
export class NammaYatriClient {
  private tokenManager: TokenManager;

  constructor() {
    this.tokenManager = new TokenManager();
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  /**
   * Make an API request
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: object,
    requireAuth = true
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const token = this.tokenManager.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requireAuth) {
      if (!token) {
        throw new Error('Not authenticated. Please run authentication first.');
      }
      headers['token'] = token;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      if (response.status === 401) {
        this.tokenManager.clearToken();
        const error = new Error(
          'Authentication failed (401). Token expired or invalid. Please re-authenticate.'
        ) as NammaYatriApiError;
        (error as any).statusCode = 401;
        (error as any).isAuthError = true;
        (error as any).responseBody = errorText;
        throw error;
      }

      const error = new Error(
        `API error: HTTP ${response.status} on ${method} ${endpoint}\n${errorText}`
      ) as NammaYatriApiError;
      (error as any).statusCode = response.status;
      (error as any).isAuthError = false;
      (error as any).responseBody = errorText;
      throw error;
    }

    return response.json();
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a minimal address from coordinates
   */
  private createAddressFromCoordinates(lat: number, lon: number): Address {
    return {
      area: `${lat.toFixed(6)},${lon.toFixed(6)}`,
      city: '',
      country: '',
      building: '',
      placeId: `${lat},${lon}`,
      state: '',
    };
  }

  // =============================================================================
  // Authentication
  // =============================================================================

  /**
   * Authenticate with Namma Yatri using mobile number and access code
   */
  async authenticate(mobileNumber: string, accessCode: string): Promise<AuthResponse> {
    const response = await this.makeRequest<AuthResponse>(
      'POST',
      '/auth/get-token',
      {
        appSecretCode: accessCode,
        userMobileNo: mobileNumber,
      },
      false // No auth required for login
    );

    if (response.token) {
      // Fetch saved locations after successful auth
      let savedLocations: SavedLocation[] = [];
      try {
        // Temporarily set token for saved locations fetch
        this.tokenManager.setToken(response.token);
        savedLocations = await this.getSavedLocations();
      } catch {
        // Ignore errors fetching saved locations
      }

      // Store token with metadata
      this.tokenManager.setToken(response.token, savedLocations, response.person);
    }

    return response;
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return this.tokenManager.hasToken() && this.tokenManager.isTokenPossiblyValid();
  }

  /**
   * Validate the current token
   * Makes an API call to verify the token is still valid
   */
  async validateToken(): Promise<TokenValidationResult> {
    return this.tokenManager.validateToken(this);
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.tokenManager.clearToken();
  }

  /**
   * Get the obfuscated token (safe for display/logging)
   */
  getObfuscatedToken(): string | null {
    return this.tokenManager.getObfuscatedToken();
  }

  // =============================================================================
  // Places API
  // =============================================================================

  /**
   * Search for places using autocomplete
   */
  async searchPlaces(
    searchText: string,
    sourceLat = 12.9741,
    sourceLon = 77.5853
  ): Promise<PlacePrediction[]> {
    const request: AutoCompleteRequest = {
      autoCompleteType: 'DROP',
      input: searchText,
      language: 'ENGLISH',
      location: `${sourceLat},${sourceLon}`,
      origin: { lat: sourceLat, lon: sourceLon },
      radius: 50000,
      radiusWithUnit: { unit: 'Meter', value: 50000.0 },
      strictbounds: false,
    };

    const response = await this.makeRequest<AutoCompleteResponse>(
      'POST',
      '/maps/autoComplete',
      request
    );

    return response.predictions || [];
  }

  /**
   * Get place details by place ID or coordinates
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetails>;
  async getPlaceDetails(lat: number, lon: number): Promise<PlaceDetails>;
  async getPlaceDetails(placeIdOrLat: string | number, lon?: number): Promise<PlaceDetails> {
    const body =
      typeof placeIdOrLat === 'string'
        ? ({
            getBy: { contents: placeIdOrLat, tag: 'ByPlaceId' },
            language: 'ENGLISH',
            sessionToken: 'default-token',
          } as GetPlaceDetailsByPlaceId)
        : ({
            getBy: { contents: { lat: placeIdOrLat, lon: lon! }, tag: 'ByLatLong' },
            language: 'ENGLISH',
            sessionToken: 'default-token',
          } as GetPlaceDetailsByLatLong);

    return this.makeRequest<PlaceDetails>('POST', '/maps/getPlaceName', body);
  }

  // =============================================================================
  // Ride Search
  // =============================================================================

  /**
   * Search for rides between two locations
   * Returns search ID for polling
   */
  async searchRides(
    originLat: number,
    originLon: number,
    destLat: number,
    destLon: number,
    originAddress?: Address,
    destAddress?: Address
  ): Promise<string> {
    const request: RideSearchRequest = {
      contents: {
        origin: {
          gps: { lat: originLat, lon: originLon },
          address: originAddress || this.createAddressFromCoordinates(originLat, originLon),
        },
        destination: {
          gps: { lat: destLat, lon: destLon },
          address: destAddress || this.createAddressFromCoordinates(destLat, destLon),
        },
        placeNameSource: 'API_CLI',
        platformType: 'APPLICATION',
      },
      fareProductType: 'ONE_WAY',
    };

    const response = await this.makeRequest<RideSearchResponse>(
      'POST',
      '/rideSearch',
      request
    );

    return response.searchId;
  }

  /**
   * Poll for search results
   */
  async pollSearchResults(searchId: string, maxWaitMs = SEARCH_POLL_MAX_MS): Promise<RideEstimate[]> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const response = await this.makeRequest<SearchResultsResponse>(
        'GET',
        `/rideSearch/${searchId}/results`
      );

      if (response.estimates && response.estimates.length > 0) {
        return response.estimates;
      }

      await this.sleep(POLL_INTERVAL_MS);
    }

    return [];
  }

  // =============================================================================
  // Estimate Selection
  // =============================================================================

  /**
   * Select an estimate for booking
   */
  async selectEstimate(
    estimateId: string,
    options?: SelectEstimateOptions
  ): Promise<void> {
    const request: SelectEstimateRequest = {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: '',
      otherSelectedEstimates: options?.additionalEstimateIds || [],
      disabilityDisable: !(options?.specialAssistance ?? false),
      isPetRide: options?.isPetRide ?? false,
    };

    await this.makeRequest('POST', `/estimate/${estimateId}/select2`, request);
  }

  /**
   * Add a tip to an estimate and select it
   */
  async addTip(estimateId: string, amount: number, currency = 'INR'): Promise<void> {
    const request: SelectEstimateRequest = {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: '',
      customerExtraFeeWithCurrency: { amount, currency } as Currency,
      customerExtraFee: amount,
      otherSelectedEstimates: [],
      disabilityDisable: true,
      isPetRide: false,
    };

    await this.makeRequest('POST', `/estimate/${estimateId}/select2`, request);
  }

  /**
   * Cancel an active search
   */
  async cancelSearch(estimateId: string): Promise<void> {
    await this.makeRequest('POST', `/estimate/${estimateId}/cancelSearch`, {});
  }

  // =============================================================================
  // Booking Status
  // =============================================================================

  /**
   * Get ride booking status
   */
  async getRideStatus(onlyActive = true, limit?: number): Promise<RideBooking[]> {
    const params = new URLSearchParams({
      onlyActive: String(onlyActive),
      clientId: CLIENT_ID,
    });

    if (limit) {
      params.set('limit', String(limit));
    }

    const response = await this.makeRequest<BookingListResponse>(
      'GET',
      `/rideBooking/list?${params}`
    );

    return response.list || [];
  }

  /**
   * Poll for driver assignment after booking
   */
  async pollForDriverAssignment(maxWaitMs = DRIVER_POLL_MAX_MS): Promise<RideBooking | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const rides = await this.getRideStatus(true);
      if (rides.length > 0) {
        return rides[0];
      }

      await this.sleep(POLL_INTERVAL_MS);
    }

    return null;
  }

  // =============================================================================
  // Saved Locations
  // =============================================================================

  /**
   * Get saved locations from API
   */
  async getSavedLocations(): Promise<SavedLocation[]> {
    const response = await this.makeRequest<SavedLocationsResponse>(
      'GET',
      '/savedLocation/list'
    );

    const locations = response.list || [];
    this.tokenManager.updateSavedLocations(locations);
    return locations;
  }

  /**
   * Get saved locations from cache
   */
  getSavedLocationsFromCache(): SavedLocation[] {
    return this.tokenManager.getSavedLocations();
  }

  /**
   * Check if saved locations need refresh (older than 24 hours)
   */
  shouldRefreshSavedLocations(): boolean {
    return this.tokenManager.shouldRefreshSavedLocations();
  }

  /**
   * Find a saved location by tag (case-insensitive)
   */
  findSavedLocationByTag(tag: string): SavedLocation | null {
    return this.tokenManager.findSavedLocationByTag(tag);
  }

  // =============================================================================
  // Token Management
  // =============================================================================

  /**
   * Get stored person info
   */
  getPerson(): Person | null {
    return this.tokenManager.getPerson();
  }

  /**
   * Get the token manager instance
   */
  getTokenManager(): TokenManager {
    return this.tokenManager;
  }

  /**
   * Export token data for backup
   */
  exportTokenData(): { token: string; savedAt: string; savedLocations: SavedLocation[] } | null {
    return this.tokenManager.exportTokenData();
  }

  /**
   * Import token data from backup
   */
  importTokenData(data: { token: string; savedAt?: string; savedLocations?: SavedLocation[]; person?: Person }): void {
    this.tokenManager.importTokenData(data);
  }
}

// Export singleton instance
export const apiClient = new NammaYatriClient();