// ============================================================================
// Namma Yatri API Client
// Reuses patterns from mcp/src/index.ts
// ============================================================================

import {
  GetTokenRequest,
  GetTokenResponse,
  AutoCompleteResponse,
  GetPlaceDetailsResponse,
  SearchRideResponse,
  SearchResultsResponse,
  SavedReqLocationsListRes,
  FetchStatusResponse,
  BookingStatusAPIEntity,
  GetRideStatusResponse,
  CancellationReasonAPIEntity,
  QuoteBreakupRes,
  Address,
  Location,
  RideBooking,
} from '../types/index.js';

const NAMMA_YATRI_API_BASE = process.env.NAMMA_YATRI_API_BASE || 'https://api.moving.tech/pilot/app/v2';
const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_DURATION_MS = 10000;
const MAX_DRIVER_POLL_DURATION_MS = 30000;

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
  const url = `${NAMMA_YATRI_API_BASE}${endpoint}`;

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

export async function authenticate(
  mobileNumber: string,
  accessCode: string
): Promise<GetTokenResponse> {
  const request: GetTokenRequest = {
    appSecretCode: accessCode,
    userMobileNo: mobileNumber,
  };

  return makeApiCall<GetTokenResponse>('/auth/get-token', 'POST', request);
}

// ============================================================================
// Places API
// ============================================================================

export async function searchPlaces(
  token: string,
  searchText: string,
  sourceLat?: number,
  sourceLon?: number
): Promise<AutoCompleteResponse> {
  const request = {
    autoCompleteType: 'DROP',
    input: searchText,
    language: 'ENGLISH',
    location: sourceLat && sourceLon ? `${sourceLat},${sourceLon}` : '12.97413032560963,77.58534937018615',
    origin: sourceLat && sourceLon ? { lat: sourceLat, lon: sourceLon } : undefined,
    radius: 50000,
    radiusWithUnit: {
      unit: 'Meter',
      value: 50000.0,
    },
    strictbounds: false,
  };

  return makeApiCall<AutoCompleteResponse>('/maps/autoComplete', 'POST', request, token);
}

export async function getPlaceDetails(
  token: string,
  placeId?: string,
  lat?: number,
  lon?: number
): Promise<GetPlaceDetailsResponse> {
  let request;

  if (lat !== undefined && lon !== undefined) {
    request = {
      getBy: {
        contents: { lat, lon },
        tag: 'ByLatLong',
      },
      language: 'ENGLISH',
      sessionToken: 'default-token',
    };
  } else if (placeId) {
    request = {
      getBy: {
        contents: placeId,
        tag: 'ByPlaceId',
      },
      language: 'ENGLISH',
      sessionToken: 'default-token',
    };
  } else {
    throw new Error('Either placeId or both lat and lon must be provided');
  }

  return makeApiCall<GetPlaceDetailsResponse>('/maps/getPlaceName', 'POST', request, token);
}

// ============================================================================
// Ride Search API
// ============================================================================

function createAddressFromCoordinates(lat: number, lon: number): Address {
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
  origin: Location,
  destination: Location,
  originAddress?: Address,
  destinationAddress?: Address
): Promise<SearchRideResponse> {
  const request = {
    contents: {
      origin: {
        gps: origin,
        address: originAddress || createAddressFromCoordinates(origin.lat, origin.lon),
      },
      destination: {
        gps: destination,
        address: destinationAddress || createAddressFromCoordinates(destination.lat, destination.lon),
      },
      placeNameSource: 'API_CLI',
      platformType: 'APPLICATION',
    },
    fareProductType: 'ONE_WAY',
  };

  return makeApiCall<SearchRideResponse>('/rideSearch', 'POST', request, token);
}

export async function pollSearchResults(
  token: string,
  searchId: string,
  onProgress?: (elapsedMs: number) => void
): Promise<SearchResultsResponse> {
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
      return results;
    }

    if (onProgress) {
      onProgress(Date.now() - startTime);
    }

    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS));
  }

  throw new Error('Polling timeout: No ride estimates found');
}

// ============================================================================
// Estimate Selection API
// ============================================================================

export async function selectEstimate(
  token: string,
  estimateId: string,
  additionalEstimateIds?: string[],
  specialAssistance?: boolean,
  isPetRide?: boolean
): Promise<void> {
  const request = {
    autoAssignEnabled: true,
    autoAssignEnabledV2: true,
    paymentMethodId: '',
    otherSelectedEstimates: additionalEstimateIds || [],
    disabilityDisable: !(specialAssistance ?? false),
    isPetRide: isPetRide ?? false,
  };

  await makeApiCall(`/estimate/${estimateId}/select2`, 'POST', request, token);
}

export async function addTip(
  token: string,
  estimateId: string,
  tipAmount: number,
  tipCurrency: string = 'INR'
): Promise<void> {
  const request = {
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

  await makeApiCall(`/estimate/${estimateId}/select2`, 'POST', request, token);
}

export async function cancelSearch(token: string, estimateId: string): Promise<void> {
  await makeApiCall(`/estimate/${estimateId}/cancelSearch`, 'POST', {}, token);
}

// ============================================================================
// Booking Status API
// ============================================================================

export async function pollForRideAssignment(
  token: string,
  onProgress?: (elapsedMs: number) => void
): Promise<RideBooking | null> {
  const startTime = Date.now();
  const maxEndTime = startTime + MAX_DRIVER_POLL_DURATION_MS;

  while (Date.now() < maxEndTime) {
    const response = await makeApiCall<FetchStatusResponse>(
      '/rideBooking/list?onlyActive=true&clientId=CLI_TUI',
      'GET',
      undefined,
      token
    );

    if (response.list && response.list.length > 0) {
      return response.list[0];
    }

    if (onProgress) {
      onProgress(Date.now() - startTime);
    }

    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL_MS));
  }

  throw new Error('No driver assigned yet. You will receive a notification when a driver is assigned.');
}

export async function fetchRideStatus(
  token: string,
  onlyActive: boolean = true,
  limit?: number
): Promise<FetchStatusResponse> {
  const params = new URLSearchParams();
  params.append('onlyActive', onlyActive.toString());
  params.append('clientId', 'CLI_TUI');
  if (limit) params.append('limit', limit.toString());

  return makeApiCall<FetchStatusResponse>(`/rideBooking/list?${params.toString()}`, 'GET', undefined, token);
}

export async function getBookingDetails(token: string, bookingId: string): Promise<BookingStatusAPIEntity> {
  return makeApiCall<BookingStatusAPIEntity>(`/rideBooking/v2/${bookingId}`, 'GET', undefined, token);
}

export async function getRideStatus(token: string, rideId: string): Promise<GetRideStatusResponse> {
  return makeApiCall<GetRideStatusResponse>(`/ride/${rideId}/status`, 'GET', undefined, token);
}

// ============================================================================
// Saved Locations API
// ============================================================================

export async function getSavedLocations(token: string): Promise<SavedReqLocationsListRes> {
  return makeApiCall<SavedReqLocationsListRes>('/savedLocation/list', 'GET', undefined, token);
}

// ============================================================================
// Cancellation API
// ============================================================================

export async function getCancellationReasons(
  token: string,
  stage: 'OnSearch' | 'OnInit' | 'OnConfirm' | 'OnAssign'
): Promise<CancellationReasonAPIEntity[]> {
  return makeApiCall<CancellationReasonAPIEntity[]>(
    `/cancellationReason/list?cancellationStage=${stage}`,
    'GET',
    undefined,
    token
  );
}

export async function cancelBooking(
  token: string,
  bookingId: string,
  reasonCode: string,
  reasonStage: string,
  additionalInfo?: string,
  reallocate?: boolean
): Promise<void> {
  const request: Record<string, unknown> = {
    reasonCode,
    reasonStage,
  };

  if (additionalInfo) request.additionalInfo = additionalInfo;
  if (reallocate !== undefined) request.reallocate = reallocate;

  await makeApiCall(`/rideBooking/${bookingId}/cancel`, 'POST', request, token);
}

// ============================================================================
// Price Breakdown API
// ============================================================================

export async function getPriceBreakdown(token: string, bookingId: string): Promise<QuoteBreakupRes> {
  return makeApiCall<QuoteBreakupRes>(`/priceBreakup?bookingId=${bookingId}`, 'GET', undefined, token);
}

// ============================================================================
// Post-Ride Tip API
// ============================================================================

export async function postRideTip(
  token: string,
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

  await makeApiCall(`/payment/${rideId}/addTip`, 'POST', request, token);
}

export { APIError };
