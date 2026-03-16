// ============================================================================
// Type Definitions for Namma Yatri CLI TUI
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
export interface AuthCredentials {
  mobileNumber: string;
  accessCode: string;
  country?: string;
}

export interface AuthResponse {
  token: string;
  personId: string;
  person?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

// Place Types
export interface Place {
  description: string;
  placeId: string;
  distance?: number;
  distanceWithUnit?: {
    unit: string;
    value: number;
  };
}

export interface PlaceDetails {
  lat: number;
  lon: number;
  placeId: string;
  address: Address;
}

// Ride Types
export interface RideEstimate {
  id: string;
  estimatedFare: number;
  estimatedFareWithCurrency: Currency;
  estimatedTotalFare: number;
  estimatedTotalFareWithCurrency: Currency;
  estimatedPickupDuration?: number;
  vehicleVariant: string;
  serviceTierName: string;
  serviceTierShortDesc?: string;
  providerName: string;
  totalFareRange?: {
    minFare: number;
    maxFare: number;
  };
  tipOptions?: number[];
  smartTipSuggestion?: number;
}

export interface RideBooking {
  id: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  fromLocation?: LocationWithAddress;
  toLocation?: LocationWithAddress;
  estimatedFare?: number;
  driverName?: string;
  driverNumber?: string;
  driverImage?: string;
  driverRatings?: number;
  vehicleNumber?: string;
  vehicleVariant?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  rideOtp?: string;
}

export interface RideStatus {
  ride: RideBooking;
  fromLocation: LocationWithAddress;
  toLocation?: LocationWithAddress;
  driverPosition?: Location;
}

// Saved Location Types
export interface SavedLocation {
  tag: string;
  lat: number;
  lon: number;
  area?: string;
  building?: string;
  city?: string;
  country?: string;
  state?: string;
  street?: string;
  placeId?: string;
  locationName?: string;
}

// App State Types
export type AppScreen =
  | 'AUTH'
  | 'LOCATION'
  | 'RIDE_TYPE'
  | 'CONFIRM'
  | 'TRACK'
  | 'HISTORY'
  | 'SETTINGS';

export interface AppState {
  screen: AppScreen;
  token?: string;
  personId?: string;
  personName?: string;
  savedLocations: SavedLocation[];
  origin?: PlaceDetails;
  destination?: PlaceDetails;
  selectedEstimate?: RideEstimate;
  currentBooking?: RideBooking;
  searchId?: string;
  estimates: RideEstimate[];
  error?: string;
}

// API Error Types
export interface APIError {
  statusCode: number;
  message: string;
  isAuthError: boolean;
}
