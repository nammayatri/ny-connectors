// ============================================================================
// Currency Types
// ============================================================================

export interface Currency {
  amount: number;
  currency: string;
}

// ============================================================================
// Location Types
// ============================================================================

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

// ============================================================================
// Auth Types
// ============================================================================

export interface AuthConfig {
  country: string;
  mobileNumber: string;
  accessCode: string;
}

export interface AuthRequest {
  appSecretCode: string;
  userMobileNo: string;
}

export interface Person {
  id: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  maskedMobileNumber?: string;
}

export interface AuthResponse {
  authId: string;
  attempts: number;
  authType: string;
  token?: string;
  person?: Person;
  isPersonBlocked: boolean;
}

export interface AuthResult {
  authenticated: boolean;
  token: string;
  person?: Person;
  savedLocations: SavedLocation[];
}

// ============================================================================
// Places Types
// ============================================================================

export interface PlacesSearchConfig {
  searchText: string;
  sourceLat?: number;
  sourceLon?: number;
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

export interface Prediction {
  description: string;
  distance?: number;
  distanceWithUnit?: {
    unit: string;
    value: number;
  };
  placeId: string;
  types?: string[];
}

export interface AutoCompleteResponse {
  predictions: Prediction[];
}

export interface Place {
  description: string;
  placeId: string;
  distance?: number;
  distanceWithUnit?: {
    value: number;
    unit: string;
  };
}

export interface PlaceDetails {
  lat: number;
  lon: number;
  placeId: string;
  address: Address;
}

export interface GetPlaceDetailsRequestByPlaceId {
  getBy: {
    contents: string;
    tag: 'ByPlaceId';
  };
  language: string;
  sessionToken: string;
}

export interface GetPlaceDetailsRequestByLatLong {
  getBy: {
    contents: {
      lat: number;
      lon: number;
    };
    tag: 'ByLatLong';
  };
  language: string;
  sessionToken: string;
}

export type GetPlaceDetailsRequest = GetPlaceDetailsRequestByPlaceId | GetPlaceDetailsRequestByLatLong;

// ============================================================================
// Ride Search Types
// ============================================================================

export interface RideSearchParams {
  originLat: number | string;
  originLon?: number;
  originAddress?: Address;
  destinationLat: number | string;
  destinationLon?: number;
  destinationAddress?: Address;
}

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

export interface Estimate {
  id: string;
  estimatedFare: number;
  estimatedTotalFare: number;
  currency: string;
  vehicleVariant: string;
  serviceTierName: string;
  serviceTierShortDesc?: string;
  providerName: string;
  providerId: string;
  estimatedPickupDuration?: number;
  totalFareRange?: FareRange;
  tipOptions?: number[];
  isAirConditioned?: boolean;
}

export interface SearchResultsResponse {
  estimates: RideEstimate[];
  fromLocation: Address & { id?: string; lat: number; lon: number };
  toLocation: Address & { id?: string; lat: number; lon: number };
  allJourneysLoaded: boolean;
}

export interface RideSearchResult {
  searchId: string;
  estimates: Estimate[];
  fromLocation: { lat: number; lon: number; address?: Address };
  toLocation: { lat: number; lon: number; address?: Address };
}

// ============================================================================
// Estimate Selection Types
// ============================================================================

export interface SelectEstimateParams {
  estimateId: string;
  additionalEstimateIds?: string[];
  specialAssistance?: boolean;
  isPetRide?: boolean;
}

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

export interface AddTipParams {
  estimateId: string;
  tipAmount: number;
  tipCurrency?: string;
}

// ============================================================================
// Booking Status Types
// ============================================================================

export interface FetchStatusParams {
  limit?: number;
  offset?: number;
  onlyActive?: boolean;
  status?: string[];
}

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
}

export interface FetchStatusResponse {
  list: RideBooking[];
}

export interface RideStatus {
  id: string;
  status: string;
  createdAt: string;
  estimatedFare?: number;
  driverName?: string;
  driverNumber?: string;
  vehicleNumber?: string;
  vehicleVariant?: string;
  origin?: PlaceDetails;
  destination?: PlaceDetails;
}

// ============================================================================
// Saved Locations Types
// ============================================================================

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

export interface SavedLocationsListResponse {
  list: SavedLocation[];
}

// ============================================================================
// Cancel Types
// ============================================================================

export interface CancelSearchParams {
  estimateId: string;
}

export interface CancelSearchResponse {
  success: boolean;
  message?: string;
}

// ============================================================================
// API Client Configuration
// ============================================================================

export interface ApiClientConfig {
  baseUrl?: string;
  timeout?: number;
  clientId?: string;
}

// ============================================================================
// API Error Types
// ============================================================================

export interface ApiError {
  statusCode: number;
  message: string;
  details?: unknown;
  isAuthError: boolean;
}

export class NammaYatriApiError extends Error {
  public statusCode: number;
  public details?: unknown;
  public isAuthError: boolean;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'NammaYatriApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isAuthError = statusCode === 401;
  }
}