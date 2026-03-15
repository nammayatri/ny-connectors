// ============================================================================
// Currency & Location Types
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

// ============================================================================
// Auth Types
// ============================================================================

export interface GetTokenRequest {
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

export interface GetTokenResponse {
  authId: string;
  attempts: number;
  authType: string;
  token?: string;
  person?: PersonAPIEntity;
  isPersonBlocked: boolean;
}

// ============================================================================
// Places API Types
// ============================================================================

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

export interface GetPlaceDetailsResponse {
  lat: number;
  lon: number;
  placeId: string;
  address: Address;
}

// ============================================================================
// Ride Search Types
// ============================================================================

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

export interface SearchResultsResponse {
  estimates: RideEstimate[];
  fromLocation: Address & { id?: string; lat: number; lon: number };
  toLocation: Address & { id?: string; lat: number; lon: number };
  allJourneysLoaded: boolean;
}

// ============================================================================
// Select Estimate Types
// ============================================================================

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

// ============================================================================
// Ride Booking Types
// ============================================================================

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

// ============================================================================
// Saved Locations Types
// ============================================================================

export interface SavedReqLocationAPIEntity {
  lat: number;
  lon: number;
  tag: string;
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

export interface SavedReqLocationsListRes {
  list: SavedReqLocationAPIEntity[];
}

// ============================================================================
// API Error Types
// ============================================================================

export interface ApiError extends Error {
  statusCode: number;
  responseBody?: string;
  isAuthError?: boolean;
}

// ============================================================================
// Client Configuration
// ============================================================================

export interface NammaYatriClientConfig {
  apiBase: string;
  defaultTimeout?: number;
  pollIntervalMs?: number;
  searchPollMaxMs?: number;
  driverPollMaxMs?: number;
}