import type {
  AuthCredentials,
  AuthResponse,
  Prediction,
  PlaceDetailsResponse,
  SearchResultsResponse,
  SearchRideResponse,
  RideBooking,
  FetchStatusResponse,
  SavedLocation,
  RideEstimate,
} from '../types/index.js';

const API_BASE = process.env.NAMMA_YATRI_API_BASE || 'https://api.sandbox.moving.tech/dev/app/v2';
const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_DURATION_MS = 10000;

// ============================================================================
// Token Obfuscation/Deobfuscation
// ============================================================================

function getRandomAlphanumeric(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return chars.charAt(Math.floor(Math.random() * chars.length));
}

export function obfuscateToken(input: string): string {
  let out = '';
  const len = input.length;
  let i = 0;
  for (; i + 3 <= len; i += 3) {
    const a = input[i];
    const b = input[i + 1];
    const c = input[i + 2];
    out += c + b + a;
    out += getRandomAlphanumeric();
  }
  if (i < len) out += input.slice(i);
  return out;
}

export function deobfuscateToken(obf: string): string {
  let out = '';
  const len = obf.length;
  let i = 0;
  while (i + 4 <= len) {
    const c0 = obf[i];
    const c1 = obf[i + 1];
    const c2 = obf[i + 2];
    out += c2 + c1 + c0;
    i += 4;
  }
  if (i < len) out += obf.slice(i);
  return out;
}

// ============================================================================
// API Client
// ============================================================================

class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isAuthError?: boolean
  ) {
    super(message);
    this.name = 'APIError';
  }
}

async function makeApiCall<T = unknown>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
  token?: string
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    const realToken = deobfuscateToken(token);
    headers['token'] = realToken;
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
    const isAuthError = response.status === 401;
    throw new APIError(
      `API call failed: ${response.status} ${response.statusText} - ${errorText}`,
      response.status,
      isAuthError
    );
  }

  return (await response.json()) as T;
}

// ============================================================================
// Auth API
// ============================================================================

export async function authenticate(credentials: AuthCredentials): Promise<{
  token: string;
  auth: AuthResponse;
  savedLocations: SavedLocation[];
}> {
  const request = {
    appSecretCode: credentials.accessCode,
    userMobileNo: credentials.mobileNumber,
  };

  const auth = await makeApiCall<AuthResponse>('/auth/get-token', 'POST', request);

  if (!auth.token) {
    throw new Error('Authentication failed: No token received');
  }

  const obfuscatedToken = obfuscateToken(auth.token);

  // Fetch saved locations
  let savedLocations: SavedLocation[] = [];
  try {
    const locations = await makeApiCall<{ list: SavedLocation[] }>(
      '/savedLocation/list',
      'GET',
      undefined,
      obfuscatedToken
    );
    savedLocations = locations.list || [];
  } catch {
    // Ignore saved locations fetch errors
  }

  return { token: obfuscatedToken, auth, savedLocations };
}

// ============================================================================
// Places API
// ============================================================================

export async function searchPlaces(
  token: string,
  searchText: string,
  sourceLat?: number,
  sourceLon?: number
): Promise<Prediction[]> {
  const request = {
    autoCompleteType: 'DROP',
    input: searchText,
    language: 'ENGLISH',
    location: '12.97413032560963,77.58534937018615',
    origin: sourceLat && sourceLon ? { lat: sourceLat, lon: sourceLon } : undefined,
    radius: 50000,
    radiusWithUnit: { unit: 'Meter', value: 50000.0 },
    sessionToken: undefined,
    strictbounds: false,
    types_: undefined,
  };

  const response = await makeApiCall<{ predictions: Prediction[] }>(
    '/maps/autoComplete',
    'POST',
    request,
    token
  );

  return response.predictions || [];
}

export async function getPlaceDetails(
  token: string,
  placeId: string
): Promise<PlaceDetailsResponse> {
  const request = {
    getBy: {
      contents: placeId,
      tag: 'ByPlaceId',
    },
    language: 'ENGLISH',
    sessionToken: 'default-token',
  };

  return makeApiCall<PlaceDetailsResponse>('/maps/getPlaceName', 'POST', request, token);
}

export async function getPlaceDetailsByLatLon(
  token: string,
  lat: number,
  lon: number
): Promise<PlaceDetailsResponse> {
  const request = {
    getBy: {
      contents: { lat, lon },
      tag: 'ByLatLong',
    },
    language: 'ENGLISH',
    sessionToken: 'default-token',
  };

  return makeApiCall<PlaceDetailsResponse>('/maps/getPlaceName', 'POST', request, token);
}

// ============================================================================
// Ride Search API
// ============================================================================

function createAddressFromCoordinates(lat: number, lon: number) {
  return {
    area: `${lat.toFixed(6)},${lon.toFixed(6)}`,
    city: '',
    country: '',
    building: '',
    placeId: `${lat},${lon}`,
    state: '',
  };
}

export async function searchRide(
  token: string,
  origin: PlaceDetailsResponse,
  destination: PlaceDetailsResponse
): Promise<{ searchId: string; estimates: RideEstimate[] }> {
  const originAddress = origin.address || createAddressFromCoordinates(origin.lat, origin.lon);
  const destAddress = destination.address || createAddressFromCoordinates(destination.lat, destination.lon);

  const request = {
    contents: {
      origin: {
        gps: { lat: origin.lat, lon: origin.lon },
        address: {
          area: originAddress.area || '',
          city: originAddress.city || '',
          country: originAddress.country || '',
          building: originAddress.building || '',
          placeId: originAddress.placeId || '',
          state: originAddress.state || '',
          ...(originAddress.areaCode && { areaCode: originAddress.areaCode }),
          ...(originAddress.door && { door: originAddress.door }),
          ...(originAddress.extras && { extras: originAddress.extras }),
          ...(originAddress.instructions && { instructions: originAddress.instructions }),
          ...(originAddress.street && { street: originAddress.street }),
          ...(originAddress.title && { title: originAddress.title }),
          ...(originAddress.ward && { ward: originAddress.ward }),
        },
      },
      destination: {
        gps: { lat: destination.lat, lon: destination.lon },
        address: {
          area: destAddress.area || '',
          city: destAddress.city || '',
          country: destAddress.country || '',
          building: destAddress.building || '',
          placeId: destAddress.placeId || '',
          state: destAddress.state || '',
          ...(destAddress.areaCode && { areaCode: destAddress.areaCode }),
          ...(destAddress.door && { door: destAddress.door }),
          ...(destAddress.extras && { extras: destAddress.extras }),
          ...(destAddress.instructions && { instructions: destAddress.instructions }),
          ...(destAddress.street && { street: destAddress.street }),
          ...(destAddress.title && { title: destAddress.title }),
          ...(destAddress.ward && { ward: destAddress.ward }),
        },
      },
      placeNameSource: 'API_MCP',
      platformType: 'APPLICATION',
    },
    fareProductType: 'ONE_WAY',
  };

  const searchResponse = await makeApiCall<SearchRideResponse>('/rideSearch', 'POST', request, token);

  // Poll for results
  const estimates = await pollSearchResults(token, searchResponse.searchId);

  return { searchId: searchResponse.searchId, estimates };
}

async function pollSearchResults(token: string, searchId: string): Promise<RideEstimate[]> {
  const startTime = Date.now();
  const maxEndTime = startTime + MAX_POLLING_DURATION_MS;

  while (Date.now() < maxEndTime) {
    const results = await makeApiCall<SearchResultsResponse>(
      `/rideSearch/${searchId}/results`,
      'GET',
      undefined,
      token
    );

    if (results.estimates && results.estimates.length > 0) {
      return results.estimates;
    }

    await sleep(POLLING_INTERVAL_MS);
  }

  throw new Error('Polling timeout: No ride estimates found');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Estimate Selection API
// ============================================================================

export async function selectEstimate(
  token: string,
  estimateId: string
): Promise<void> {
  const request = {
    autoAssignEnabled: true,
    autoAssignEnabledV2: true,
    paymentMethodId: '',
    otherSelectedEstimates: [],
    disabilityDisable: true,
    isPetRide: false,
  };

  await makeApiCall(`/estimate/${estimateId}/select2`, 'POST', request, token);
}

// ============================================================================
// Booking Status API
// ============================================================================

export async function fetchActiveBookings(token: string): Promise<RideBooking[]> {
  const params = new URLSearchParams();
  params.append('onlyActive', 'true');
  params.append('clientId', 'ACP_SERVER');

  const response = await makeApiCall<FetchStatusResponse>(
    `/rideBooking/list?${params.toString()}`,
    'GET',
    undefined,
    token
  );

  return response.list || [];
}

export async function pollForRideAssignment(
  token: string,
  maxDurationMs: number = 30000
): Promise<RideBooking | null> {
  const startTime = Date.now();
  const maxEndTime = startTime + maxDurationMs;

  while (Date.now() < maxEndTime) {
    const bookings = await fetchActiveBookings(token);

    if (bookings.length > 0) {
      return bookings[0];
    }

    await sleep(2000);
  }

  return null;
}

// ============================================================================
// Saved Locations API
// ============================================================================

export async function fetchSavedLocations(token: string): Promise<SavedLocation[]> {
  const response = await makeApiCall<{ list: SavedLocation[] }>(
    '/savedLocation/list',
    'GET',
    undefined,
    token
  );
  return response.list || [];
}
