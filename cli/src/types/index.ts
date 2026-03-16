// ============================================================================
// Namma Yatri API Types
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

// Places Types
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

export interface GetPlaceDetailsResponse {
  lat: number;
  lon: number;
  placeId: string;
  address: Address;
}

// Ride Types
export interface FareBreakup {
  price: number;
  priceWithCurrency: Currency;
  title: string;
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
  totalFareRange?: FareRange;
  tipOptions?: number[];
  smartTipSuggestion?: number;
  smartTipReason?: string;
  isAirConditioned?: boolean;
  vehicleServiceTierSeatingCapacity?: number;
  tripTerms?: string[];
  specialLocationTag?: string;
}

export interface SearchRideResponse {
  searchId: string;
}

export interface SearchResultsResponse {
  estimates: RideEstimate[];
  fromLocation: Address & { id?: string; lat: number; lon: number };
  toLocation: Address & { id?: string; lat: number; lon: number };
  allJourneysLoaded: boolean;
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
}

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

// Saved Locations
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

// Cancellation
export interface CancellationReasonAPIEntity {
  reasonCode: string;
  description: string;
}

// Price Breakdown
export interface QuoteBreakupAPIEntity {
  title: string;
  priceWithCurrency: {
    amount: number;
    currency: string;
  };
}

export interface QuoteBreakupRes {
  quoteBreakup: QuoteBreakupAPIEntity[];
}

// ============================================================================
// App State Types
// ============================================================================

export type AppState =
  | 'AUTH_PHONE'
  | 'AUTH_CODE'
  | 'AUTH_LOADING'
  | 'MAIN_MENU'
  | 'SEARCH_ORIGIN'
  | 'SEARCH_DESTINATION'
  | 'SEARCH_LOADING'
  | 'SELECT_ESTIMATE'
  | 'BOOKING_LOADING'
  | 'BOOKING_CONFIRMED'
  | 'RIDE_STATUS'
  | 'SAVED_LOCATIONS'
  | 'RIDE_HISTORY'
  | 'SETTINGS';

export interface AppContext {
  token: string | null;
  user: PersonAPIEntity | null;
  savedLocations: SavedReqLocationAPIEntity[];
  currentSearchId: string | null;
  currentEstimateId: string | null;
  currentBooking: RideBooking | null;
  selectedOrigin: GetPlaceDetailsResponse | null;
  selectedDestination: GetPlaceDetailsResponse | null;
  searchResults: SearchResultsResponse | null;
}

export interface StoredTokenData {
  token: string;
  savedAt: string;
  savedLocations: SavedReqLocationAPIEntity[];
  savedLocationsUpdatedAt: string;
  person?: PersonAPIEntity;
}
