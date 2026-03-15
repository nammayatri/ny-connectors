import { API_BASE } from '../config.js';
import { loadToken } from '../auth/token-store.js';

export interface ApiCallOptions<T> {
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
  token?: string;
  requireAuth?: boolean;
}

export interface ApiError extends Error {
  statusCode: number;
  body?: unknown;
}

export async function apiCall<T = unknown>(options: ApiCallOptions<T>): Promise<T> {
  const { method, path, body, token, requireAuth = true } = options;
  
  const url = `${API_BASE}${path}`;
  
  // Get token if required
  let authToken = token;
  if (!authToken && requireAuth) {
    const stored = loadToken();
    if (!stored) {
      const error = new Error('Not authenticated. Run `ny-cli auth` first.') as ApiError;
      error.statusCode = 401;
      throw error;
    }
    authToken = stored.token;
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (authToken) {
    headers['token'] = authToken;
  }
  
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const error = new Error(`API error: ${response.status} ${response.statusText}`) as ApiError;
    error.statusCode = response.status;
    
    try {
      error.body = await response.json();
    } catch {
      // Ignore JSON parse errors
    }
    
    // Handle 401 specifically
    if (response.status === 401) {
      error.message = 'Authentication failed. Token expired or invalid. Run `ny-cli auth` to re-authenticate.';
    }
    
    throw error;
  }
  
  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }
  
  return JSON.parse(text) as T;
}

// Specific API types and functions
export interface PlacePrediction {
  description: string;
  placeId: string;
  distanceWithUnit?: {
    value: number;
    unit: string;
  };
}

export interface PlacesResponse {
  predictions: PlacePrediction[];
}

export interface PlaceDetails {
  lat: number;
  lon: number;
  placeId: string;
  address: {
    area?: string;
    city?: string;
    state?: string;
    country?: string;
    building?: string;
    street?: string;
    door?: string;
    ward?: string;
    placeId?: string;
    title?: string;
    extras?: string;
    instructions?: string;
    areaCode?: string;
  };
}

export interface RideEstimate {
  id: string;
  vehicleVariant: string;
  serviceTierName: string;
  providerName: string;
  estimatedTotalFareWithCurrency: {
    amount: number;
    currency: string;
  };
  totalFareRange?: {
    minFare: number;
    maxFare: number;
  };
  estimatedPickupDuration?: number;
  estimatedDistance?: number;
}

export interface SearchRideResponse {
  searchId: string;
}

export interface SearchResultsResponse {
  estimates: RideEstimate[];
}

export interface RideBooking {
  id: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  estimatedFare?: number;
  // Driver info
  driverName?: string;
  driverNumber?: string;
  driverRating?: number;
  driverTotalRides?: number;
  // Vehicle info
  vehicleNumber?: string;
  vehicleModel?: string;
  vehicleVariant?: string;
  vehicleColor?: string;
  // OTP for ride
  otp?: string;
  // ETA and trip info
  eta?: number;
  tripDuration?: number;
  distance?: number;
  // Route info
  fromAddress?: string;
  toAddress?: string;
}

export interface BookingListResponse {
  list: RideBooking[];
}

export async function searchPlaces(query: string, options?: {
  lat?: number;
  lon?: number;
  radius?: number;
}): Promise<PlacePrediction[]> {
  const response = await apiCall<PlacesResponse>({
    method: 'POST',
    path: '/maps/autoComplete',
    body: {
      autoCompleteType: 'DROP',
      input: query,
      language: 'ENGLISH',
      location: `${options?.lat ?? 12.97},${options?.lon ?? 77.58}`,
      radius: options?.radius ?? 50000,
      radiusWithUnit: { unit: 'Meter', value: options?.radius ?? 50000 },
      strictbounds: false,
    },
  });
  
  return response.predictions ?? [];
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails>;
export async function getPlaceDetails(lat: number, lon: number): Promise<PlaceDetails>;
export async function getPlaceDetails(placeIdOrLat: string | number, lon?: number): Promise<PlaceDetails> {
  const body = typeof placeIdOrLat === 'string'
    ? {
        getBy: { contents: placeIdOrLat, tag: 'ByPlaceId' },
        language: 'ENGLISH',
        sessionToken: 'cli-session',
      }
    : {
        getBy: { contents: { lat: placeIdOrLat, lon: lon! }, tag: 'ByLatLong' },
        language: 'ENGLISH',
        sessionToken: 'cli-session',
      };
  
  return apiCall<PlaceDetails>({
    method: 'POST',
    path: '/maps/getPlaceName',
    body,
  });
}

export async function startRideSearch(params: {
  originLat: number;
  originLon: number;
  destLat: number;
  destLon: number;
  originAddress?: PlaceDetails['address'];
  destAddress?: PlaceDetails['address'];
}): Promise<string> {
  const response = await apiCall<SearchRideResponse>({
    method: 'POST',
    path: '/rideSearch',
    body: {
      contents: {
        origin: {
          gps: { lat: params.originLat, lon: params.originLon },
          address: params.originAddress ?? {
            area: `${params.originLat},${params.originLon}`,
            placeId: `${params.originLat},${params.originLon}`,
          },
        },
        destination: {
          gps: { lat: params.destLat, lon: params.destLon },
          address: params.destAddress ?? {
            area: `${params.destLat},${params.destLon}`,
            placeId: `${params.destLat},${params.destLon}`,
          },
        },
        placeNameSource: 'API_CLI',
        platformType: 'APPLICATION',
      },
      fareProductType: 'ONE_WAY',
    },
  });
  
  return response.searchId;
}

export async function pollSearchResults(searchId: string): Promise<RideEstimate[]> {
  const response = await apiCall<SearchResultsResponse>({
    method: 'GET',
    path: `/rideSearch/${searchId}/results`,
  });
  
  return response.estimates ?? [];
}

export async function selectEstimate(estimateId: string, options?: {
  additionalEstimates?: string[];
  isPetRide?: boolean;
  specialAssistance?: boolean;
  tipAmount?: number;
}): Promise<void> {
  await apiCall({
    method: 'POST',
    path: `/estimate/${estimateId}/select2`,
    body: {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: '',
      otherSelectedEstimates: options?.additionalEstimates ?? [],
      disabilityDisable: options?.specialAssistance !== true,
      isPetRide: options?.isPetRide ?? false,
      ...(options?.tipAmount && {
        customerExtraFeeWithCurrency: { amount: options.tipAmount, currency: 'INR' },
        customerExtraFee: options.tipAmount,
      }),
    },
  });
}

export async function cancelSearch(estimateId: string): Promise<void> {
  await apiCall({
    method: 'POST',
    path: `/estimate/${estimateId}/cancelSearch`,
    body: {},
  });
}

export async function fetchRideStatus(options?: {
  onlyActive?: boolean;
  limit?: number;
  offset?: number;
}): Promise<RideBooking[]> {
  const params = new URLSearchParams();
  params.set('onlyActive', String(options?.onlyActive ?? true));
  params.set('clientId', 'NY_CLI_TUI');
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));
  
  const response = await apiCall<BookingListResponse>({
    method: 'GET',
    path: `/rideBooking/list?${params.toString()}`,
  });
  
  return response.list ?? [];
}

export async function fetchSavedLocations(): Promise<unknown[]> {
  const response = await apiCall<{ list: unknown[] }>({
    method: 'GET',
    path: '/savedLocation/list',
  });
  
  return response.list ?? [];
}

/**
 * Fetch detailed ride booking information
 */
export async function fetchRideDetails(rideId: string): Promise<RideBooking> {
  return apiCall<RideBooking>({
    method: 'GET',
    path: `/rideBooking/${rideId}`,
  });
}

/**
 * Cancel an active ride
 */
export async function cancelRide(rideId: string, reason?: string): Promise<void> {
  await apiCall({
    method: 'POST',
    path: `/rideBooking/${rideId}/cancel`,
    body: {
      reason: reason ?? 'User requested cancellation',
      source: 'CLI',
    },
  });
}