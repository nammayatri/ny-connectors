/**
 * Namma Yatri TUI - Shared Types
 * Adapted from connectors/src/ny/client.ts and mcp/src/index.ts
 */

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
// Place Types
// ============================================================================

export interface NYPlace {
  description: string;
  placeId: string;
  distance?: number;
}

export interface NYPlaceDetails {
  lat: number;
  lon: number;
  placeId: string;
  address: Address;
}

// ============================================================================
// Saved Location Types
// ============================================================================

export interface NYSavedLocation {
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

// ============================================================================
// Estimate Types
// ============================================================================

export interface Currency {
  amount: number;
  currency: string;
}

export interface FareRange {
  minFare: number;
  maxFare: number;
  minFareWithCurrency?: Currency;
  maxFareWithCurrency?: Currency;
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

export interface NYEstimate {
  id: string;
  estimatedFare: number;
  estimatedFareWithCurrency?: Currency;
  estimatedTotalFare?: number;
  estimatedTotalFareWithCurrency?: Currency;
  estimatedPickupDuration?: number;
  vehicleVariant: string;
  serviceTierType?: string;
  serviceTierName: string;
  serviceTierShortDesc?: string;
  providerName?: string;
  providerId?: string;
  providerLogoUrl?: string;
  validTill?: string;
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

// ============================================================================
// Ride Booking Types
// ============================================================================

export interface RideBooking {
  id: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  fromLocation: Address & Location;
  toLocation?: Address & Location;
  estimatedFare?: number;
  driverName?: string;
  vehicleNumber?: string;
  vehicleVariant?: string;
  rideOtp?: string;
  driverNumber?: string;
  driverImage?: string;
  driverRatings?: number;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface PersonAPIEntity {
  id: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  maskedMobileNumber?: string;
}

export interface AuthResponse {
  token: string;
  person?: PersonAPIEntity;
  authId?: string;
  attempts?: number;
  authType?: string;
  isPersonBlocked?: boolean;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface GetTokenRequest {
  appSecretCode: string;
  userMobileNo: string;
}

export interface GetTokenResponse {
  authId: string;
  attempts: number;
  authType: string;
  token?: string;
  person?: PersonAPIEntity;
  isPersonBlocked: boolean;
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

export interface GetPlaceDetailsRequestByPlaceId {
  getBy: {
    contents: string;
    tag: "ByPlaceId";
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
    tag: "ByLatLong";
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

export interface SearchResultsResponse {
  estimates: NYEstimate[];
  fromLocation: Address & { id?: string; lat: number; lon: number };
  toLocation: Address & { id?: string; lat: number; lon: number };
  allJourneysLoaded: boolean;
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

export interface SavedReqLocationsListRes {
  list: NYSavedLocation[];
}

export interface FetchStatusResponse {
  list: RideBooking[];
}

// ============================================================================
// Token Storage Types
// ============================================================================

export interface StoredToken {
  token: string;
  savedAt: string;
  person?: PersonAPIEntity;
  savedLocations?: NYSavedLocation[];
  savedLocationsUpdatedAt?: string;
}

// ============================================================================
// Cancellation Types
// ============================================================================

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

// ============================================================================
// Price Breakdown Types
// ============================================================================

export interface QuoteBreakupAPIEntity {
  title: string;
  priceWithCurrency: Currency;
}

export interface QuoteBreakupRes {
  quoteBreakup: QuoteBreakupAPIEntity[];
}

// ============================================================================
// Ride Status Types
// ============================================================================

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

// ============================================================================
// Booking Details Types
// ============================================================================

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
