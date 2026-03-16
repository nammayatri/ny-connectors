/**
 * TypeScript interfaces for Namma Yatri API
 * Based on MCP server patterns and API documentation
 */

// =============================================================================
// Common Types
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
 * Location with GPS coordinates and address
 */
export interface LocationWithAddress {
  gps: Location;
  address: Address;
}

// =============================================================================
// Authentication Types
// =============================================================================

/**
 * Request to authenticate with Namma Yatri
 */
export interface AuthRequest {
  appSecretCode: string;
  userMobileNo: string;
}

/**
 * Person entity returned from auth
 */
export interface Person {
  id: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  maskedMobileNumber?: string;
}

/**
 * Response from authentication
 */
export interface AuthResponse {
  authId: string;
  attempts: number;
  authType: string;
  token?: string;
  person?: Person;
  isPersonBlocked: boolean;
}

/**
 * Stored token data with metadata
 */
export interface TokenData {
  token: string;
  savedAt: string;
  savedLocations: SavedLocation[];
  savedLocationsUpdatedAt: string;
  person?: Person;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  expired: boolean;
  error?: string;
  person?: Person;
}

/**
 * Token refresh result
 */
export interface TokenRefreshResult {
  success: boolean;
  newToken?: string;
  error?: string;
}

// =============================================================================
// Places API Types
// =============================================================================

/**
 * Distance with unit
 */
export interface DistanceWithUnit {
  value: number;
  unit: string;
}

/**
 * Place prediction from autocomplete
 */
export interface PlacePrediction {
  description: string;
  placeId: string;
  distance?: number;
  distanceWithUnit?: DistanceWithUnit;
  types?: string[];
}

/**
 * Autocomplete request
 */
export interface AutoCompleteRequest {
  autoCompleteType: 'DROP' | 'PICKUP';
  input: string;
  language: 'ENGLISH';
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

/**
 * Autocomplete response
 */
export interface AutoCompleteResponse {
  predictions: PlacePrediction[];
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
 * Request to get place details by place ID
 */
export interface GetPlaceDetailsByPlaceId {
  getBy: {
    contents: string;
    tag: 'ByPlaceId';
  };
  language: string;
  sessionToken: string;
}

/**
 * Request to get place details by coordinates
 */
export interface GetPlaceDetailsByLatLong {
  getBy: {
    contents: Location;
    tag: 'ByLatLong';
  };
  language: string;
  sessionToken: string;
}

// =============================================================================
// Ride Search Types
// =============================================================================

/**
 * Fare breakup item
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
  nightShiftStart: string;
  nightShiftEnd: string;
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
 * Waiting charges
 */
export interface WaitingCharges {
  waitingChargePerMin: number;
  waitingChargePerMinWithCurrency: Currency;
}

/**
 * Fare range
 */
export interface FareRange {
  minFare: number;
  minFareWithCurrency: Currency;
  maxFare: number;
  maxFareWithCurrency: Currency;
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
 * Ride search request
 */
export interface RideSearchRequest {
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
  fareProductType: 'ONE_WAY' | 'RENTAL' | 'INTERCITY';
}

/**
 * Ride search response
 */
export interface RideSearchResponse {
  searchId: string;
}

/**
 * Search results response
 */
export interface SearchResultsResponse {
  estimates: RideEstimate[];
  fromLocation: Address & { id?: string; lat: number; lon: number };
  toLocation: Address & { id?: string; lat: number; lon: number };
  allJourneysLoaded: boolean;
}

// =============================================================================
// Estimate Selection Types
// =============================================================================

/**
 * Request to select an estimate
 */
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

/**
 * Options for selecting an estimate
 */
export interface SelectEstimateOptions {
  additionalEstimateIds?: string[];
  isPetRide?: boolean;
  specialAssistance?: boolean;
}

// =============================================================================
// Booking Types
// =============================================================================

/**
 * Ride booking status
 */
export type BookingStatus =
  | 'NEW'
  | 'CONFIRMED'
  | 'TRIP_ASSIGNED'
  | 'TRIP_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DRIVER_ASSIGNMENT_PENDING';

/**
 * Ride booking details
 */
export interface RideBooking {
  id: string;
  status: BookingStatus | string;
  createdAt: string;
  updatedAt: string;
  fromLocation: Address & Location;
  toLocation?: Address & Location;
  estimatedFare: number;
  estimatedFareWithCurrency?: Currency;
  driverName?: string;
  driverNumber?: string;
  driverRegisteredNumber?: string;
  vehicleNumber?: string;
  vehicleVariant?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  otp?: string;
  estimatedPickupDuration?: number;
  estimatedDistance?: number;
  estimatedDuration?: number;
  providerName?: string;
  providerId?: string;
}

/**
 * Booking list response
 */
export interface BookingListResponse {
  list: RideBooking[];
}

// =============================================================================
// Saved Locations Types
// =============================================================================

/**
 * Saved location (Home, Work, etc.)
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
 * Saved locations list response
 */
export interface SavedLocationsResponse {
  list: SavedLocation[];
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * API error response
 */
export interface ApiError {
  statusCode: number;
  message: string;
  errorMessage?: string;
  errorDetails?: string;
}

/**
 * Error with additional context
 */
export class NammaYatriApiError extends Error {
  public readonly statusCode: number;
  public readonly isAuthError: boolean;
  public readonly responseBody?: string;

  constructor(message: string, statusCode: number, responseBody?: string) {
    super(message);
    this.name = 'NammaYatriApiError';
    this.statusCode = statusCode;
    this.isAuthError = statusCode === 401;
    this.responseBody = responseBody;
  }
}

// =============================================================================
// API Client Interface
// =============================================================================

/**
 * API client interface for dependency injection and testing
 */
export interface INammaYatriClient {
  // Authentication
  authenticate(mobileNumber: string, accessCode: string): Promise<AuthResponse>;
  isAuthenticated(): boolean;
  clearAuth(): void;

  // Places
  searchPlaces(searchText: string, sourceLat?: number, sourceLon?: number): Promise<PlacePrediction[]>;
  getPlaceDetails(placeId: string): Promise<PlaceDetails>;
  getPlaceDetails(lat: number, lon: number): Promise<PlaceDetails>;

  // Ride Search
  searchRides(
    originLat: number,
    originLon: number,
    destLat: number,
    destLon: number,
    originAddress?: Address,
    destAddress?: Address
  ): Promise<string>;
  pollSearchResults(searchId: string, maxWaitMs?: number): Promise<RideEstimate[]>;

  // Estimate Selection
  selectEstimate(estimateId: string, options?: SelectEstimateOptions): Promise<void>;
  addTip(estimateId: string, amount: number, currency?: string): Promise<void>;
  cancelSearch(estimateId: string): Promise<void>;

  // Status
  getRideStatus(onlyActive?: boolean, limit?: number): Promise<RideBooking[]>;
  pollForDriverAssignment(maxWaitMs?: number): Promise<RideBooking | null>;

  // Saved Locations
  getSavedLocations(): Promise<SavedLocation[]>;
  getSavedLocationsFromCache(): SavedLocation[];
}