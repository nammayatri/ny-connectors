/**
 * Namma Yatri API Client
 * 
 * Adapted from connectors/src/ny/client.ts and mcp/src/index.ts
 * Uses production API base URL: https://api.moving.tech/pilot/app/v2
 */

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.NY_API_BASE || "https://api.moving.tech/pilot/app/v2";
const CLIENT_ID = "ACP_CLI";

// Polling configuration
const POLL_INTERVAL_MS = 2000;
const MAX_POLLING_DURATION_MS = 10000;
const DRIVER_POLL_MAX_MS = 30000;

// ============================================================================
// Type Definitions
// ============================================================================

export interface Currency {
  amount: number;
  currency: string;
}

export interface Location {
  lat: number;
  lon: number;
}

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

export interface LocationWithAddress {
  gps: Location;
  address: Address;
}

// Auth Types
export interface AuthenticateRequest {
  appSecretCode: string;
  userMobileNo: string;
}

export interface PersonAPIEntity {
  id: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  maskedMobileNumber?: string;
}

export interface AuthenticateResponse {
  authId: string;
  attempts: number;
  authType: string;
  token?: string;
  person?: PersonAPIEntity;
  isPersonBlocked: boolean;
}

// Places Types
export interface Place {
  description: string;
  placeId: string;
  distance?: number;
}

export interface PlaceDetails {
  lat: number;
  lon: number;
  placeId: string;
  address: Address;
}

export interface AutoCompleteRequest {
  autoCompleteType: string;
  input: string;
  language: string;
  location?: string;
  origin?: Location;
  radius: number;
  radiusWithUnit: {
    unit: string;
    value: number;
  };
  sessionToken?: string;
  strictbounds: boolean;
  types_?: string;
}

export interface AutoCompleteResponse {
  predictions: Array<{
    description: string;
    distance?: number;
    distanceWithUnit?: {
      unit: string;
      value: number;
    };
    placeId: string;
    types?: string[];
  }>;
}

export interface GetPlaceDetailsRequest {
  getBy: {
    contents: string | Location;
    tag: "ByPlaceId" | "ByLatLong";
  };
  language: string;
  sessionToken: string;
}

// Saved Locations Types
export interface SavedLocation {
  tag: string;
  lat: number;
  lon: number;
  area?: string;
  areaCode?: string;
  building?: string;
  city?: string;
  country?: string;
  door?: string;
  locationName?: string;
  placeId?: string;
  state?: string;
  street?: string;
  ward?: string;
}

export interface SavedLocationsResponse {
  list: SavedLocation[];
}

// Ride Search Types
export interface SearchRideRequest {
  contents: {
    origin: LocationWithAddress;
    destination: LocationWithAddress;
    placeNameSource: string;
    platformType: string;
    driverIdentifier?: {
      type: string;
      value: string;
    };
  };
  fareProductType: string;
}

export interface SearchRideResponse {
  searchId: string;
}

// Estimate Types
export interface FareBreakup {
  price: number;
  priceWithCurrency: Currency;
  title: string;
}

export interface NightShiftInfo {
  nightShiftCharge: number;
  nightShiftChargeWithCurrency: Currency;
  nightShiftEnd: string;
  nightShiftStart: string;
  oldNightShiftCharge: number;
}

export interface TollChargesInfo {
  tollChargesWithCurrency: Currency;
  tollNames: string[];
}

export interface WaitingCharges {
  waitingChargePerMin: number;
  waitingChargePerMinWithCurrency: Currency;
}

export interface FareRange {
  maxFare: number;
  maxFareWithCurrency: Currency;
  minFare: number;
  minFareWithCurrency: Currency;
}

export interface Estimate {
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

export interface SearchResultsResponse {
  estimates: Estimate[];
  fromLocation: Address & { id?: string; lat: number; lon: number };
  toLocation: Address & { id?: string; lat: number; lon: number };
  allJourneysLoaded: boolean;
}

// Select Estimate Types
export interface SelectEstimateRequest {
  autoAssignEnabled: boolean;
  autoAssignEnabledV2: boolean;
  paymentMethodId: string;
  customerExtraFeeWithCurrency?: Currency;
  customerExtraFee?: number;
  otherSelectedEstimates: string[];
  disabilityDisable: boolean;
  isPetRide: boolean;
  deliveryDetails?: unknown;
  isAdvancedBookingEnabled?: boolean;
}

export interface SelectEstimateOptions {
  additionalEstimateIds?: string[];
  specialAssistance?: boolean;
  isPetRide?: boolean;
}

// Booking Types
export interface RideBooking {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  fromLocation: Address & Location;
  toLocation?: Address & Location;
  estimatedFare: number;
  driverName?: string;
  vehicleNumber?: string;
  vehicleVariant?: string;
}

export interface FetchStatusResponse {
  list: RideBooking[];
}

export interface FetchStatusOptions {
  limit?: number;
  offset?: number;
  onlyActive?: boolean;
  status?: string[];
}

// Booking Details Types
export interface BookingStatusAPIEntity {
  id: string;
  bookingStatus: string;
  isBookingUpdated: boolean;
  rideStatus?: string;
  talkedWithDriver: boolean;
  stopInfo: unknown[];
  isSafetyPlus: boolean;
  driverArrivalTime?: string;
  destinationReachedAt?: string;
  estimatedEndTimeRange?: unknown;
  driversPreviousRideDropLocLat?: number;
  driversPreviousRideDropLocLon?: number;
  sosStatus?: string;
  batchConfig?: unknown;
}

// Ride Status Types
export interface RideAPIEntity {
  id: string;
  status: string;
  rideOtp: string;
  shortRideId: string;
  driverName: string;
  driverNumber?: string;
  driverImage?: string;
  driverRatings?: number;
  vehicleNumber: string;
  vehicleVariant: string;
  vehicleModel: string;
  vehicleColor: string;
  createdAt: string;
  updatedAt: string;
  rideStartTime?: string;
  rideEndTime?: string;
  computedPrice?: number;
  computedPriceWithCurrency?: Currency;
  chargeableRideDistance?: number;
  chargeableRideDistanceWithUnit?: { unit: string; value: number };
  traveledRideDistance?: { unit: string; value: number };
  tipAmount?: { amount: number; currency: string };
  onlinePayment: boolean;
  feedbackSkipped: boolean;
  isPetRide: boolean;
  isSafetyPlus: boolean;
  paymentStatus: string;
  endOtp?: string;
  talkedWithDriver: boolean;
  stopsInfo: unknown[];
  billingCategory: string;
}

export interface GetRideStatusResponse {
  ride: RideAPIEntity;
  fromLocation: Address & { lat: number; lon: number };
  toLocation?: Address & { lat: number; lon: number };
  driverPosition?: { lat: number; lon: number };
  customer: PersonAPIEntity;
}

// Cancellation Types
export interface CancellationReason {
  reasonCode: string;
  description: string;
}

export interface CancelBookingRequest {
  reasonCode: string;
  reasonStage: string;
  additionalInfo?: string;
  reallocate?: boolean;
}

// Tip Types
export interface AddTipRequest {
  amount: Currency;
}

// Price Breakdown Types
export interface QuoteBreakupItem {
  title: string;
  priceWithCurrency: Currency;
}

export interface PriceBreakdownResponse {
  quoteBreakup: QuoteBreakupItem[];
}

// API Error
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: string,
    public isAuthError?: boolean
  ) {
    super(message);
    this.name = "APIError";
  }
}

// ============================================================================
// Namma Yatri API Client
// ============================================================================

export class NammaYatriClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  static async authenticate(
    mobileNumber: string,
    accessCode: string
  ): Promise<AuthenticateResponse> {
    const request: AuthenticateRequest = {
      appSecretCode: accessCode,
      userMobileNo: mobileNumber,
    };

    return this.makeApiCall<AuthenticateResponse>(
      "/auth/get-token",
      "POST",
      request
    );
  }

  // ============================================================================
  // Saved Locations
  // ============================================================================

  async getSavedLocations(): Promise<SavedLocation[]> {
    const response = await this.makeApiCall<SavedLocationsResponse>(
      "/savedLocation/list",
      "GET"
    );
    return response.list || [];
  }

  // ============================================================================
  // Places
  // ============================================================================

  async searchPlaces(
    searchText: string,
    sourceLat?: number,
    sourceLon?: number
  ): Promise<Place[]> {
    const request: AutoCompleteRequest = {
      autoCompleteType: "DROP",
      input: searchText,
      language: "ENGLISH",
      location: "12.97413032560963,77.58534937018615",
      origin:
        sourceLat && sourceLon
          ? { lat: sourceLat, lon: sourceLon }
          : undefined,
      radius: 50000,
      radiusWithUnit: {
        unit: "Meter",
        value: 50000.0,
      },
      strictbounds: false,
    };

    const response = await this.makeApiCall<AutoCompleteResponse>(
      "/maps/autoComplete",
      "POST",
      request
    );

    return (response.predictions || []).map((p) => ({
      description: p.description,
      placeId: p.placeId,
      distance: p.distanceWithUnit?.value ?? p.distance,
    }));
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    const request: GetPlaceDetailsRequest = {
      getBy: {
        contents: placeId,
        tag: "ByPlaceId",
      },
      language: "ENGLISH",
      sessionToken: "default-token",
    };

    return this.makeApiCall<PlaceDetails>("/maps/getPlaceName", "POST", request);
  }

  async getPlaceDetailsByCoordinates(lat: number, lon: number): Promise<PlaceDetails> {
    const request: GetPlaceDetailsRequest = {
      getBy: {
        contents: { lat, lon },
        tag: "ByLatLong",
      },
      language: "ENGLISH",
      sessionToken: "default-token",
    };

    return this.makeApiCall<PlaceDetails>("/maps/getPlaceName", "POST", request);
  }

  // ============================================================================
  // Ride Search & Estimates
  // ============================================================================

  async searchRide(
    origin: LocationWithAddress,
    destination: LocationWithAddress
  ): Promise<string> {
    const request: SearchRideRequest = {
      contents: {
        origin,
        destination,
        placeNameSource: "API_CLI",
        platformType: "APPLICATION",
      },
      fareProductType: "ONE_WAY",
    };

    const response = await this.makeApiCall<SearchRideResponse>(
      "/rideSearch",
      "POST",
      request
    );

    return response.searchId;
  }

  async getEstimates(searchId: string): Promise<Estimate[]> {
    const response = await this.makeApiCall<SearchResultsResponse>(
      `/rideSearch/${searchId}/results`,
      "GET"
    );
    return response.estimates || [];
  }

  async pollForEstimates(
    searchId: string,
    maxDurationMs: number = MAX_POLLING_DURATION_MS
  ): Promise<Estimate[]> {
    const startTime = Date.now();
    const maxEndTime = startTime + maxDurationMs;

    while (Date.now() < maxEndTime) {
      const results = await this.getEstimates(searchId);

      if (results.length > 0) {
        return results;
      }

      await this.sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
      `Polling timeout: No ride estimates found after ${maxDurationMs}ms`
    );
  }

  // ============================================================================
  // Estimate Selection & Tips
  // ============================================================================

  async selectEstimate(
    estimateId: string,
    options: SelectEstimateOptions = {}
  ): Promise<void> {
    const request: SelectEstimateRequest = {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: "",
      otherSelectedEstimates: options.additionalEstimateIds || [],
      disabilityDisable: !(options.specialAssistance ?? false),
      isPetRide: options.isPetRide ?? false,
    };

    await this.makeApiCall(
      `/estimate/${estimateId}/select2`,
      "POST",
      request
    );
  }

  async addTip(estimateId: string, tipAmount: number, tipCurrency: string = "INR"): Promise<void> {
    const request: SelectEstimateRequest = {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: "",
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
      "POST",
      request
    );
  }

  async cancelSearch(estimateId: string): Promise<void> {
    await this.makeApiCall(
      `/estimate/${estimateId}/cancelSearch`,
      "POST",
      {}
    );
  }

  // ============================================================================
  // Booking Status & Polling
  // ============================================================================

  async getActiveBookings(options: FetchStatusOptions = {}): Promise<RideBooking[]> {
    const params = new URLSearchParams();
    params.append("onlyActive", String(options.onlyActive ?? true));
    params.append("clientId", CLIENT_ID);

    if (options.limit) params.append("limit", options.limit.toString());
    if (options.offset) params.append("offset", options.offset.toString());
    if (options.status && options.status.length > 0) {
      params.append("status", JSON.stringify(options.status));
    }

    const response = await this.makeApiCall<FetchStatusResponse>(
      `/rideBooking/list?${params.toString()}`,
      "GET"
    );

    return response.list || [];
  }

  async pollForDriverAssignment(
    maxDurationMs: number = DRIVER_POLL_MAX_MS
  ): Promise<RideBooking | null> {
    const startTime = Date.now();
    const maxEndTime = startTime + maxDurationMs;

    while (Date.now() < maxEndTime) {
      const bookings = await this.getActiveBookings({ onlyActive: true });

      if (bookings.length > 0) {
        return bookings[0];
      }

      await this.sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
      "No driver assigned yet. You will receive a notification on your phone when a driver is assigned."
    );
  }

  // ============================================================================
  // Booking Details
  // ============================================================================

  async getBookingDetails(bookingId: string): Promise<BookingStatusAPIEntity> {
    return this.makeApiCall<BookingStatusAPIEntity>(
      `/rideBooking/v2/${bookingId}`,
      "GET"
    );
  }

  async getRideStatus(rideId: string): Promise<GetRideStatusResponse> {
    return this.makeApiCall<GetRideStatusResponse>(
      `/ride/${rideId}/status`,
      "GET"
    );
  }

  // ============================================================================
  // Cancellation
  // ============================================================================

  async getCancellationReasons(
    cancellationStage: "OnSearch" | "OnInit" | "OnConfirm" | "OnAssign"
  ): Promise<CancellationReason[]> {
    return this.makeApiCall<CancellationReason[]>(
      `/cancellationReason/list?cancellationStage=${cancellationStage}`,
      "GET"
    );
  }

  async cancelBooking(
    bookingId: string,
    reasonCode: string,
    reasonStage: "OnSearch" | "OnInit" | "OnConfirm" | "OnAssign",
    additionalInfo?: string,
    reallocate?: boolean
  ): Promise<void> {
    const request: CancelBookingRequest = {
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
      "POST",
      request
    );
  }

  // ============================================================================
  // Post-Ride Operations
  // ============================================================================

  async postRideTip(
    rideId: string,
    tipAmount: number,
    tipCurrency: string = "INR"
  ): Promise<void> {
    const request: AddTipRequest = {
      amount: {
        amount: tipAmount,
        currency: tipCurrency,
      },
    };

    await this.makeApiCall(`/payment/${rideId}/addTip`, "POST", request);
  }

  async getPriceBreakdown(bookingId: string): Promise<PriceBreakdownResponse> {
    return this.makeApiCall<PriceBreakdownResponse>(
      `/priceBreakup?bookingId=${bookingId}`,
      "GET"
    );
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async makeApiCall<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    body?: unknown
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "token": this.token,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method === "POST") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails = errorText;

      // Try to parse JSON error response for more details
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && typeof errorJson === "object") {
          errorDetails = JSON.stringify(errorJson);
        }
      } catch {
        // If not JSON, use the text as-is
      }

      let errorMessage = `API call failed: ${response.status} ${response.statusText} - ${errorDetails}`;
      const isAuthError = response.status === 401;

      if (isAuthError) {
        errorMessage = `Authentication failed (401). Token expired or invalid. Please re-authenticate.`;
      }

      throw new APIError(errorMessage, response.status, errorText, isAuthError);
    }

    return (await response.json()) as T;
  }

  private static async makeApiCall<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    body?: unknown
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method === "POST") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails = errorText;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && typeof errorJson === "object") {
          errorDetails = JSON.stringify(errorJson);
        }
      } catch {
        // If not JSON, use the text as-is
      }

      let errorMessage = `API call failed: ${response.status} ${response.statusText} - ${errorDetails}`;
      const isAuthError = response.status === 401;

      if (isAuthError) {
        errorMessage = `Authentication failed (401). Token expired or invalid.`;
      }

      throw new APIError(errorMessage, response.status, errorText, isAuthError);
    }

    return (await response.json()) as T;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a minimal address object from coordinates
 * Used as fallback when no full address is provided
 */
export function createAddressFromCoordinates(lat: number, lon: number): Address {
  return {
    area: `${lat.toFixed(6)},${lon.toFixed(6)}`,
    city: "",
    country: "",
    building: "",
    placeId: `${lat},${lon}`,
    state: "",
  };
}

/**
 * Parses coordinate string like "12.9352,77.6245" or number and returns {lat, lon}
 */
export function parseCoordinates(
  latOrString: number | string,
  lon?: number
): { lat: number; lon: number } {
  // If lon is provided, treat latOrString as latitude
  if (lon !== undefined) {
    const lat =
      typeof latOrString === "string" ? parseFloat(latOrString) : latOrString;
    if (isNaN(lat) || isNaN(lon)) {
      throw new Error(
        `Invalid coordinate values. Could not parse lat/lon from: ${latOrString}, ${lon}`
      );
    }
    return { lat, lon };
  }

  // If lon is not provided, latOrString must be a "lat,lon" string
  if (typeof latOrString === "string") {
    const parts = latOrString.split(",").map((s) => s.trim());
    if (parts.length !== 2) {
      throw new Error(
        `Invalid coordinate format. Expected "lat,lon" (e.g., "12.9352,77.6245") but got: ${latOrString}`
      );
    }
    const lat = parseFloat(parts[0]);
    const lonParsed = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lonParsed)) {
      throw new Error(
        `Invalid coordinate values. Could not parse lat/lon from: ${latOrString}`
      );
    }
    return { lat, lon: lonParsed };
  } else {
    throw new Error(
      "originLon/destinationLon is required when originLat/destinationLat is a number"
    );
  }
}

export default NammaYatriClient;
