/**
 * Shared TypeScript interfaces and types for ny-cli-tui
 * These types are used across all modules: API client, screens, store, etc.
 */

// =============================================================================
// Authentication Types
// =============================================================================

/**
 * Authentication token data stored locally
 */
export interface AuthToken {
  /** The obfuscated token string from Namma Yatri API */
  token: string;
  /** ISO timestamp when the token was saved */
  savedAt: string;
  /** User's saved locations cached locally */
  savedLocations: SavedLocation[];
  /** ISO timestamp when saved locations were last updated */
  savedLocationsUpdatedAt: string;
}

/**
 * Authentication request payload
 */
export interface AuthRequest {
  /** User's country code (e.g., 'IN') */
  country: string;
  /** User's mobile number */
  mobileNumber: string;
  /** App secret access code from Namma Yatri app */
  accessCode: string;
}

/**
 * Authentication response from API
 */
export interface AuthResponse {
  /** The authentication token */
  token: string;
  /** Customer ID if available */
  customerId?: string;
  /** Token expiration timestamp if available */
  expiresAt?: string;
}

// =============================================================================
// Location Types
// =============================================================================

/**
 * Address components for a location
 */
export interface Address {
  /** Area or locality name */
  area?: string;
  /** Area/pin code */
  areaCode?: string;
  /** Building name or number */
  building?: string;
  /** City name */
  city?: string;
  /** Country name or code */
  country?: string;
  /** Door/flat number */
  door?: string;
  /** Additional address information */
  extras?: string;
  /** Special instructions for finding the location */
  instructions?: string;
  /** Google Places ID */
  placeId?: string;
  /** State or province */
  state?: string;
  /** Street name */
  street?: string;
  /** Ward number */
  ward?: string;
  /** Display title for the address */
  title?: string;
}

/**
 * GPS coordinates
 */
export interface Coordinates {
  /** Latitude */
  lat: number;
  /** Longitude */
  lon: number;
}

/**
 * A generic location with coordinates and optional address
 */
export interface Location extends Coordinates {
  /** Full address details */
  address?: Address;
  /** Display label for the location */
  label?: string;
}

/**
 * Saved location (e.g., Home, Work)
 */
export interface SavedLocation {
  /** Tag name (e.g., 'Home', 'Work') */
  tag: string;
  /** Latitude */
  lat: number;
  /** Longitude */
  lon: number;
  /** Display name for the location */
  locationName?: string;
  /** Area name */
  area?: string;
  /** City name */
  city?: string;
  /** Google Places ID */
  placeId?: string;
}

// =============================================================================
// Place Types (for autocomplete/search)
// =============================================================================

/**
 * Place search result from autocomplete API
 */
export interface Place {
  /** Display description of the place */
  description: string;
  /** Google Places ID */
  placeId: string;
  /** Distance from search origin if available */
  distanceWithUnit?: {
    value: number;
    unit: string;
  };
}

/**
 * Detailed place information
 */
export interface PlaceDetails extends Location {
  /** Google Places ID */
  placeId: string;
  /** Full address components */
  address: Address;
}

// =============================================================================
// Ride Types
// =============================================================================

/**
 * Fare with currency information
 */
export interface FareWithCurrency {
  /** Fare amount */
  amount: number;
  /** Currency code (e.g., 'INR') */
  currency: string;
}

/**
 * Fare range (min-max)
 */
export interface FareRange {
  /** Minimum fare */
  minFare: number;
  /** Maximum fare */
  maxFare: number;
}

/**
 * Ride estimate from search results
 */
export interface RideEstimate {
  /** Unique estimate ID */
  id: string;
  /** Vehicle type (e.g., 'AUTO_RICKSHAW', 'SEDAN') */
  vehicleVariant: string;
  /** Service tier name (e.g., 'Namma Yatri', 'Yatri Savaari') */
  serviceTierName: string;
  /** Provider name */
  providerName: string;
  /** Estimated total fare with currency */
  estimatedTotalFareWithCurrency: FareWithCurrency;
  /** Fare range if variable pricing */
  totalFareRange?: FareRange;
  /** Estimated time to pickup in seconds */
  estimatedPickupDuration?: number;
  /** Distance to travel in meters */
  estimatedDistance?: number;
  /** Estimated trip duration in seconds */
  estimatedDuration?: number;
  /** Whether this estimate supports tips */
  tipEnabled?: boolean;
  /** Available tip amounts */
  availableTips?: number[];
}

/**
 * Ride status values
 */
export type RideStatusValue =
  | 'NEW'
  | 'CONFIRMED'
  | 'TRIP_ASSIGNED'
  | 'TRIP_STARTED'
  | 'TRIP_ENDED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DRIVER_ASSIGNED'
  | 'IN_PROGRESS';

/**
 * Ride booking status
 */
export interface RideStatus {
  /** Booking ID */
  id: string;
  /** Current status */
  status: RideStatusValue | string;
  /** When the ride was created/booked */
  createdAt: string;
  /** Estimated fare */
  estimatedFare?: number;
  /** Final fare after completion */
  finalFare?: number;
  /** Currency for fare */
  currency?: string;
  /** Assigned driver's name */
  driverName?: string;
  /** Driver's phone number */
  driverNumber?: string;
  /** Driver's rating */
  driverRating?: number;
  /** Vehicle registration number */
  vehicleNumber?: string;
  /** Vehicle type */
  vehicleVariant?: string;
  /** Vehicle model */
  vehicleModel?: string;
  /** Pickup location */
  origin?: PlaceDetails;
  /** Drop location */
  destination?: PlaceDetails;
  /** OTP for ride verification */
  otp?: string;
  /** Ride start time */
  tripStartTime?: string;
  /** Ride end time */
  tripEndTime?: string;
  /** Cancellation reason if cancelled */
  cancellationReason?: string;
}

/**
 * Booking request options
 */
export interface BookingOptions {
  /** Primary estimate ID to book */
  estimateId: string;
  /** Additional estimate IDs for multi-select */
  additionalEstimateIds?: string[];
  /** Whether this is a pet ride */
  isPetRide?: boolean;
  /** Whether special assistance is needed */
  specialAssistance?: boolean;
  /** Tip amount to add */
  tipAmount?: number;
  /** Tip currency */
  tipCurrency?: string;
}

/**
 * Booking result
 */
export interface BookingResult {
  /** Whether booking was successful */
  success: boolean;
  /** Booking ID if successful */
  bookingId?: string;
  /** Message describing the result */
  message: string;
  /** Assigned ride details if available */
  ride?: RideStatus;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  /** Response data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Error code if failed */
  errorCode?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Whether the request was successful */
  success: boolean;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  /** Total number of items */
  total?: number;
  /** Current offset */
  offset?: number;
  /** Items per page */
  limit?: number;
  /** Whether there are more items */
  hasMore?: boolean;
}

/**
 * Places autocomplete API response
 */
export interface PlacesResponse {
  /** List of place predictions */
  predictions: Place[];
}

/**
 * Ride search results response
 */
export interface RideSearchResponse {
  /** Search ID for polling */
  searchId: string;
  /** List of estimates (may be empty initially) */
  estimates: RideEstimate[];
  /** Whether search is complete */
  isComplete?: boolean;
}

/**
 * Saved locations API response
 */
export interface SavedLocationsResponse {
  /** List of saved locations */
  list: SavedLocation[];
}

/**
 * Ride status list response
 */
export interface RideStatusListResponse {
  /** List of rides */
  list: RideStatus[];
  /** Total count */
  count?: number;
}

// =============================================================================
// UI State Types
// =============================================================================

/**
 * Screen identifiers for navigation
 */
export type Screen =
  | 'main'
  | 'auth'
  | 'search'
  | 'status'
  | 'saved-locations'
  | 'loading';

/**
 * Search flow step
 */
export type SearchStep =
  | 'select-origin'
  | 'origin-input'
  | 'origin-results'
  | 'select-destination'
  | 'destination-input'
  | 'destination-results'
  | 'searching'
  | 'select-estimate'
  | 'booking'
  | 'result';

/**
 * Authentication flow step
 */
export type AuthStep =
  | 'mobile'
  | 'code'
  | 'authenticating';

/**
 * Select input item for ink-select-input
 */
export interface SelectItem<T = string> {
  /** Display label */
  label: string;
  /** Item value */
  value: T;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Make specific keys optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extract the element type from an array type
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;

/**
 * Non-nullable type
 */
export type NonNullable<T> = T extends null | undefined ? never : T;