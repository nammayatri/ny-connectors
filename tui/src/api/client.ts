/**
 * Namma Yatri API Client for TUI
 * 
 * A comprehensive TypeScript client for the Namma Yatri API.
 * Reuses patterns from connectors/src/ny/client.ts and mcp/src/index.ts.
 * 
 * Token storage: ~/.namma-yatri/token.json (compatible with bash CLI)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

// =============================================================================
// Configuration
// =============================================================================

const API_BASE = process.env.NY_API_BASE || 'https://api.moving.tech/pilot/app/v2';
const AUTH_BASE = process.env.NY_AUTH_URL || 'https://api.sandbox.moving.tech/dev/app/v2';
const TOKEN_DIR = path.join(os.homedir(), '.namma-yatri');
const TOKEN_FILE = path.join(TOKEN_DIR, 'token.json');

const POLLING_INTERVAL_MS = 2000;
const MAX_SEARCH_POLLING_MS = 10000;
const MAX_DRIVER_POLLING_MS = 30000;

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Currency with amount and currency code
 */
export interface Currency {
  amount: number;
  currency: string;
}

/**
 * GPS coordinates
 */
export interface Location {
  lat: number;
  lon: number;
}

/**
 * Address details for a place
 */
export interface Address {
  area?: string;
  areaCode?: string;
  building?: string;
  city?: string;
  country?: string;
  door?: string;
  extras?: string;
  instructions?: string;
  placeId?: string;
  state?: string;
  street?: string;
  title?: string;
  ward?: string;
}

/**
 * Location with GPS and address
 */
export interface LocationWithAddress {
  gps: Location;
  address: Address;
}

/**
 * Person entity from auth response
 */
export interface PersonEntity {
  id: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  maskedMobileNumber?: string;
}

/**
 * Stored token data
 */
export interface TokenData {
  token: string;
  savedAt: string;
  person?: PersonEntity;
  savedLocations: SavedLocation[];
  savedLocationsUpdatedAt: string;
}

/**
 * Saved location from user's account
 */
export interface SavedLocation {
  tag: string;
  lat: number;
  lon: number;
  locationName?: string;
  area?: string;
  areaCode?: string;
  building?: string;
  city?: string;
  country?: string;
  door?: string;
  placeId?: string;
  state?: string;
  street?: string;
  ward?: string;
}

/**
 * Place prediction from autocomplete
 */
export interface PlacePrediction {
  description: string;
  placeId: string;
  distance?: number;
  distanceWithUnit?: {
    value: number;
    unit: string;
  };
  types?: string[];
}

/**
 * Place details response
 */
export interface PlaceDetails {
  lat: number;
  lon: number;
  placeId: string;
  address: Address;
}

/**
 * Fare breakdown item
 */
export interface FareBreakup {
  price: number;
  priceWithCurrency: Currency;
  title: string;
}

/**
 * Night shift charge info
 */
export interface NightShiftInfo {
  nightShiftCharge: number;
  nightShiftChargeWithCurrency: Currency;
  nightShiftEnd: string;
  nightShiftStart: string;
  oldNightShiftCharge: number;
}

/**
 * Toll charges info
 */
export interface TollChargesInfo {
  tollChargesWithCurrency: Currency;
  tollNames: string[];
}

/**
 * Waiting charges info
 */
export interface WaitingCharges {
  waitingChargePerMin: number;
  waitingChargePerMinWithCurrency: Currency;
}

/**
 * Fare range
 */
export interface FareRange {
  maxFare: number;
  maxFareWithCurrency: Currency;
  minFare: number;
  minFareWithCurrency: Currency;
}

/**
 * Ride estimate from search
 */
export interface RideEstimate {
  id: string;
  estimatedFare: number;
  estimatedFareWithCurrency: Currency;
  estimatedTotalFare: number;
  estimatedTotalFareWithCurrency: Currency;
  estimatedPickupDuration: number;
  vehicleVariant: string;
  serviceTierType: string;
  serviceTierName: string;
  serviceTierShortDesc?: string;
  providerName: string;
  providerId: string;
  providerLogoUrl?: string;
  validTill: string;
  estimateFareBreakup?: FareBreakup[];
  nightShiftInfo?: NightShiftInfo;
  tollChargesInfo?: TollChargesInfo;
  waitingCharges?: WaitingCharges;
  totalFareRange?: FareRange;
  tipOptions?: number[];
  smartTipSuggestion?: number;
  smartTipReason?: string;
  isAirConditioned?: boolean;
  vehicleServiceTierSeatingCapacity?: number;
  tripTerms?: string[];
  specialLocationTag?: string;
  isBlockedRoute?: boolean;
  isCustomerPrefferedSearchRoute?: boolean;
  isInsured?: boolean;
  insuredAmount?: string;
  isReferredRide?: boolean;
  agencyName?: string;
  agencyNumber?: string;
  agencyCompletedRidesCount?: number;
}

/**
 * Search results response
 */
export interface SearchResults {
  searchId: string;
  estimates: RideEstimate[];
  fromLocation: Address & Location & { id?: string };
  toLocation: Address & Location & { id?: string };
  allJourneysLoaded: boolean;
}

/**
 * Ride booking details
 */
export interface RideBooking {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  fromLocation: Address & Location;
  toLocation?: Address & Location;
  estimatedFare: number;
  driverName?: string;
  driverNumber?: string;
  vehicleNumber?: string;
  vehicleVariant?: string;
  estimatedPickupDuration?: number;
  rideStartTime?: string;
  rideEndTime?: string;
  tripDistance?: number;
}

/**
 * Authentication request
 */
export interface AuthRequest {
  mobileNumber: string;
  accessCode: string;
  country?: string;
}

/**
 * Authentication response
 */
export interface AuthResponse {
  success: boolean;
  token?: string;
  person?: PersonEntity;
  authId?: string;
  savedLocations: SavedLocation[];
  error?: string;
}

/**
 * API error with status code
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public responseBody?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// =============================================================================
// Token Management
// =============================================================================

/**
 * Ensures the token directory exists
 */
function ensureTokenDir(): void {
  if (!fs.existsSync(TOKEN_DIR)) {
    fs.mkdirSync(TOKEN_DIR, { recursive: true });
  }
}

/**
 * Reads the stored token data
 */
export function readTokenData(): TokenData | null {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
      return JSON.parse(data) as TokenData;
    }
  } catch (error) {
    console.error(chalk.yellow('Warning: Failed to read token file:', (error as Error).message));
  }
  return null;
}

/**
 * Saves token data to disk
 */
export function saveTokenData(token: string, person?: PersonEntity, savedLocations: SavedLocation[] = []): void {
  ensureTokenDir();
  const now = new Date().toISOString();
  const data: TokenData = {
    token,
    savedAt: now,
    person,
    savedLocations,
    savedLocationsUpdatedAt: now,
  };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

/**
 * Updates saved locations in the token file
 */
export function updateSavedLocations(locations: SavedLocation[]): void {
  const existing = readTokenData();
  if (existing) {
    const now = new Date().toISOString();
    existing.savedLocations = locations;
    existing.savedLocationsUpdatedAt = now;
    ensureTokenDir();
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(existing, null, 2), { mode: 0o600 });
  }
}

/**
 * Clears the stored token
 */
export function clearToken(): void {
  if (fs.existsSync(TOKEN_FILE)) {
    fs.unlinkSync(TOKEN_FILE);
  }
}

/**
 * Gets the raw token string
 */
export function getToken(): string | null {
  const data = readTokenData();
  return data?.token ?? null;
}

/**
 * Gets saved locations from token data
 */
export function getSavedLocations(): SavedLocation[] {
  const data = readTokenData();
  return data?.savedLocations ?? [];
}

/**
 * Checks if saved locations need refresh (older than 24 hours)
 */
export function needsSavedLocationsRefresh(): boolean {
  const data = readTokenData();
  if (!data?.savedLocationsUpdatedAt) return true;
  
  const lastUpdate = new Date(data.savedLocationsUpdatedAt);
  const now = new Date();
  const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
  
  return hoursSinceUpdate >= 24;
}

/**
 * Finds a saved location by tag (case-insensitive)
 */
export function findSavedLocation(tag: string): SavedLocation | undefined {
  const locations = getSavedLocations();
  return locations.find(loc => loc.tag.toLowerCase() === tag.toLowerCase());
}

// =============================================================================
// API Client Class
// =============================================================================

/**
 * Namma Yatri API Client
 */
export class NammaYatriClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Creates a client from stored token
   */
  static fromStoredToken(): NammaYatriClient | null {
    const token = getToken();
    if (!token) return null;
    return new NammaYatriClient(token);
  }

  /**
   * Authenticates with Namma Yatri and returns a new client
   */
  static async authenticate(request: AuthRequest): Promise<AuthResponse> {
    const { mobileNumber, accessCode, country = 'IN' } = request;

    try {
      const res = await fetch(`${AUTH_BASE}/auth/get-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appSecretCode: accessCode,
          userMobileNo: mobileNumber,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = `Authentication failed: ${res.status}`;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.errorMessage || errMsg;
        } catch {
          // Use default message
        }
        return { success: false, error: errMsg, savedLocations: [] };
      }

      const data = await res.json() as any;
      const token = data.token;
      const person = data.person;

      // Fetch saved locations
      let savedLocations: SavedLocation[] = [];
      if (token) {
        try {
          const slRes = await fetch(`${API_BASE}/savedLocation/list`, {
            headers: { 'Content-Type': 'application/json', token },
          });
          if (slRes.ok) {
            const slData = await slRes.json() as any;
            savedLocations = slData.list || [];
          }
        } catch {
          // Non-fatal: continue without saved locations
        }
      }

      // Save token data
      if (token) {
        saveTokenData(token, person, savedLocations);
      }

      return {
        success: !!token,
        token,
        person,
        savedLocations,
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${(error as Error).message}`,
        savedLocations: [],
      };
    }
  }

  /**
   * Makes an API call
   */
  private async apiCall<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: object,
    requireAuth = true
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    
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
      
      if (response.status === 401) {
        clearToken();
        throw new ApiError(
          401,
          'Authentication failed. Token expired or invalid. Please re-authenticate.',
          errorText
        );
      }
      
      throw new ApiError(
        response.status,
        `API error: ${response.status} ${response.statusText}`,
        errorText
      );
    }

    return response.json() as T;
  }

  /**
   * Gets saved locations from the API
   */
  async getSavedLocationsFromApi(): Promise<SavedLocation[]> {
    const response = await this.apiCall<{ list: SavedLocation[] }>(
      'GET',
      '/savedLocation/list'
    );
    const locations = response.list || [];
    
    // Update local cache
    updateSavedLocations(locations);
    
    return locations;
  }

  /**
   * Searches for places using autocomplete
   */
  async searchPlaces(searchText: string, sourceLocation?: Location): Promise<PlacePrediction[]> {
    const body: any = {
      autoCompleteType: 'DROP',
      input: searchText,
      language: 'ENGLISH',
      location: '12.97413032560963,77.58534937018615', // Default: Bangalore center
      radius: 50000,
      radiusWithUnit: { unit: 'Meter', value: 50000.0 },
      strictbounds: false,
    };

    if (sourceLocation) {
      body.origin = sourceLocation;
    }

    const response = await this.apiCall<{ predictions: PlacePrediction[] }>(
      'POST',
      '/maps/autoComplete',
      body
    );

    return (response.predictions || []).map((p: any) => ({
      description: p.description,
      placeId: p.placeId,
      distance: p.distanceWithUnit?.value,
      distanceWithUnit: p.distanceWithUnit,
      types: p.types,
    }));
  }

  /**
   * Gets place details by place ID
   */
  async getPlaceDetailsByPlaceId(placeId: string): Promise<PlaceDetails> {
    const response = await this.apiCall<PlaceDetails>(
      'POST',
      '/maps/getPlaceName',
      {
        getBy: { contents: placeId, tag: 'ByPlaceId' },
        language: 'ENGLISH',
        sessionToken: 'default-token',
      }
    );
    return response;
  }

  /**
   * Gets place details by coordinates
   */
  async getPlaceDetailsByCoords(lat: number, lon: number): Promise<PlaceDetails> {
    const response = await this.apiCall<PlaceDetails>(
      'POST',
      '/maps/getPlaceName',
      {
        getBy: { contents: { lat, lon }, tag: 'ByLatLong' },
        language: 'ENGLISH',
        sessionToken: 'default-token',
      }
    );
    return response;
  }

  /**
   * Gets place details (unified method)
   */
  async getPlaceDetails(placeIdOrLat: string | number, lon?: number): Promise<PlaceDetails> {
    if (typeof placeIdOrLat === 'string') {
      return this.getPlaceDetailsByPlaceId(placeIdOrLat);
    } else {
      return this.getPlaceDetailsByCoords(placeIdOrLat, lon!);
    }
  }

  /**
   * Helper to get address from PlaceDetails or SavedLocation
   */
  private getAddressFromLocation(loc: PlaceDetails | SavedLocation): Address {
    // PlaceDetails has address property, SavedLocation has direct properties
    if ('address' in loc && loc.address) {
      return loc.address;
    }
    // SavedLocation has direct properties
    return {
      area: (loc as SavedLocation).area || '',
      city: (loc as SavedLocation).city || '',
      country: (loc as SavedLocation).country || '',
      building: (loc as SavedLocation).building || '',
      placeId: loc.placeId || `${loc.lat},${loc.lon}`,
      state: (loc as SavedLocation).state || '',
    };
  }

  /**
   * Searches for rides between origin and destination
   */
  async searchRides(
    origin: PlaceDetails | SavedLocation,
    destination: PlaceDetails | SavedLocation
  ): Promise<SearchResults> {
    // Build origin and destination objects
    const originAddress = this.getAddressFromLocation(origin);
    const destAddress = this.getAddressFromLocation(destination);

    const originData: LocationWithAddress = {
      gps: { lat: origin.lat, lon: origin.lon },
      address: originAddress,
    };

    const destData: LocationWithAddress = {
      gps: { lat: destination.lat, lon: destination.lon },
      address: destAddress,
    };

    // Initiate search
    const searchResponse = await this.apiCall<{ searchId: string }>(
      'POST',
      '/rideSearch',
      {
        contents: {
          origin: originData,
          destination: destData,
          placeNameSource: 'API_TUI',
          platformType: 'APPLICATION',
        },
        fareProductType: 'ONE_WAY',
      }
    );

    const searchId = searchResponse.searchId;

    // Poll for results
    const estimates = await this.pollSearchResults(searchId);

    return {
      searchId,
      estimates,
      fromLocation: { ...originData.gps, ...originData.address },
      toLocation: { ...destData.gps, ...destData.address },
      allJourneysLoaded: true,
    };
  }

  /**
   * Polls for search results
   */
  private async pollSearchResults(searchId: string): Promise<RideEstimate[]> {
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_SEARCH_POLLING_MS) {
      try {
        const response = await this.apiCall<{ estimates: RideEstimate[] }>(
          'GET',
          `/rideSearch/${searchId}/results`
        );

        if (response.estimates && response.estimates.length > 0) {
          return response.estimates;
        }
      } catch {
        // Continue polling
      }

      await this.sleep(POLLING_INTERVAL_MS);
    }

    return [];
  }

  /**
   * Selects an estimate for booking
   */
  async selectEstimate(
    estimateId: string,
    options?: {
      additionalEstimateIds?: string[];
      isPetRide?: boolean;
      specialAssistance?: boolean;
    }
  ): Promise<{ success: boolean; rideAssignment?: RideBooking; message?: string }> {
    await this.apiCall(
      'POST',
      `/estimate/${estimateId}/select2`,
      {
        autoAssignEnabled: true,
        autoAssignEnabledV2: true,
        paymentMethodId: '',
        otherSelectedEstimates: options?.additionalEstimateIds || [],
        disabilityDisable: !(options?.specialAssistance ?? false),
        isPetRide: options?.isPetRide ?? false,
      }
    );

    // Poll for driver assignment
    try {
      const rideAssignment = await this.pollForDriverAssignment();
      return { success: true, rideAssignment };
    } catch (error) {
      return {
        success: true,
        message: (error as Error).message,
      };
    }
  }

  /**
   * Adds a tip to an estimate and selects it
   */
  async addTip(
    estimateId: string,
    amount: number,
    currency = 'INR'
  ): Promise<{ success: boolean; rideAssignment?: RideBooking; message?: string }> {
    await this.apiCall(
      'POST',
      `/estimate/${estimateId}/select2`,
      {
        autoAssignEnabled: true,
        autoAssignEnabledV2: true,
        paymentMethodId: '',
        customerExtraFeeWithCurrency: { amount, currency },
        customerExtraFee: amount,
        otherSelectedEstimates: [],
        disabilityDisable: true,
        isPetRide: false,
      }
    );

    // Poll for driver assignment
    try {
      const rideAssignment = await this.pollForDriverAssignment();
      return { success: true, rideAssignment };
    } catch (error) {
      return {
        success: true,
        message: (error as Error).message,
      };
    }
  }

  /**
   * Cancels an active search
   */
  async cancelSearch(estimateId: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.apiCall(
        'POST',
        `/estimate/${estimateId}/cancelSearch`,
        {}
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }

  /**
   * Fetches ride booking status
   */
  async fetchStatus(options?: {
    onlyActive?: boolean;
    limit?: number;
    offset?: number;
    status?: string[];
  }): Promise<RideBooking[]> {
    const params = new URLSearchParams();
    params.append('onlyActive', String(options?.onlyActive ?? true));
    params.append('clientId', 'ACP_TUI');
    
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));
    if (options?.status && options.status.length > 0) {
      params.append('status', JSON.stringify(options.status));
    }

    const response = await this.apiCall<{ list: RideBooking[] }>(
      'GET',
      `/rideBooking/list?${params.toString()}`
    );

    return response.list || [];
  }

  /**
   * Polls for driver assignment after estimate selection
   */
  private async pollForDriverAssignment(): Promise<RideBooking> {
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_DRIVER_POLLING_MS) {
      try {
        const bookings = await this.fetchStatus({ onlyActive: true });
        
        if (bookings.length > 0) {
          return bookings[0];
        }
      } catch {
        // Continue polling
      }

      await this.sleep(POLLING_INTERVAL_MS);
    }

    throw new Error(
      'No driver assigned yet. You will receive a notification on your phone when a driver is assigned.'
    );
  }

  /**
   * Sleeps for the specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Convenience Functions (for backward compatibility with existing menus)
// =============================================================================

/**
 * Gets an authenticated client or throws if not authenticated
 */
export function getAuthenticatedClient(): NammaYatriClient {
  const client = NammaYatriClient.fromStoredToken();
  if (!client) {
    throw new ApiError(401, 'Not authenticated. Please run auth first.');
  }
  return client;
}

/**
 * Checks if the user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Searches for places (convenience function)
 */
export async function searchPlaces(searchText: string): Promise<PlacePrediction[]> {
  const client = getAuthenticatedClient();
  return client.searchPlaces(searchText);
}

/**
 * Gets place details (convenience function)
 */
export async function getPlaceDetails(placeIdOrLat: string | number, lon?: number): Promise<PlaceDetails> {
  const client = getAuthenticatedClient();
  return client.getPlaceDetails(placeIdOrLat as any, lon);
}

/**
 * Searches for rides (convenience function)
 */
export async function searchRides(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): Promise<SearchResults> {
  const client = getAuthenticatedClient();
  
  // Create minimal place details from coordinates
  const origin: PlaceDetails = {
    lat: fromLat,
    lon: fromLon,
    placeId: `${fromLat},${fromLon}`,
    address: {
      area: `${fromLat},${fromLon}`,
      city: '',
      country: '',
      building: '',
      placeId: `${fromLat},${fromLon}`,
      state: '',
    },
  };
  
  const destination: PlaceDetails = {
    lat: toLat,
    lon: toLon,
    placeId: `${toLat},${toLon}`,
    address: {
      area: `${toLat},${toLon}`,
      city: '',
      country: '',
      building: '',
      placeId: `${toLat},${toLon}`,
      state: '',
    },
  };
  
  return client.searchRides(origin, destination);
}

/**
 * Selects an estimate (convenience function)
 */
export async function selectEstimate(
  estimateId: string,
  options?: {
    additionalEstimates?: string[];
    isPetRide?: boolean;
    specialAssistance?: boolean;
  }
): Promise<void> {
  const client = getAuthenticatedClient();
  await client.selectEstimate(estimateId, {
    additionalEstimateIds: options?.additionalEstimates,
    isPetRide: options?.isPetRide,
    specialAssistance: options?.specialAssistance,
  });
}

/**
 * Adds a tip (convenience function)
 */
export async function addTip(estimateId: string, amount: number, currency = 'INR'): Promise<void> {
  const client = getAuthenticatedClient();
  await client.addTip(estimateId, amount, currency);
}

/**
 * Cancels a search (convenience function)
 */
export async function cancelSearch(estimateId: string): Promise<void> {
  const client = getAuthenticatedClient();
  const result = await client.cancelSearch(estimateId);
  if (!result.success) {
    throw new Error(result.message || 'Failed to cancel search');
  }
}

/**
 * Fetches ride status (convenience function)
 */
export async function fetchStatus(onlyActive = true, limit?: number): Promise<RideBooking[]> {
  const client = getAuthenticatedClient();
  return client.fetchStatus({ onlyActive, limit });
}

/**
 * Fetches saved locations (convenience function)
 */
export async function fetchSavedLocations(): Promise<SavedLocation[]> {
  const client = getAuthenticatedClient();
  return client.getSavedLocationsFromApi();
}

// =============================================================================
// Formatting Utilities
// =============================================================================

/**
 * Formats a currency amount for display
 */
export function formatCurrency(currency: Currency | undefined): string {
  if (!currency) return 'N/A';
  return `${currency.currency} ${currency.amount}`;
}

/**
 * Formats a fare range for display
 */
export function formatFareRange(range: FareRange | undefined): string {
  if (!range) return '';
  return `${range.minFare}-${range.maxFare}`;
}

/**
 * Formats pickup duration for display
 */
export function formatPickupDuration(seconds: number | undefined): string {
  if (!seconds) return 'N/A';
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

/**
 * Formats distance for display
 */
export function formatDistance(value: number | undefined, unit = 'Meter'): string {
  if (!value) return '';
  if (unit === 'Meter' && value >= 1000) {
    return `${(value / 1000).toFixed(1)} km`;
  }
  return `${value} ${unit}`;
}