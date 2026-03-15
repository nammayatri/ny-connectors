// Main API Client
export { NyApiClient } from './client.js';
export { NammaYatriApiError } from './types.js';

// Re-export all types
export type {
  // Currency
  Currency,
  
  // Location
  Location,
  Address,
  LocationWithAddress,
  
  // Auth
  AuthConfig,
  AuthRequest,
  Person,
  AuthResponse,
  AuthResult,
  
  // Places
  PlacesSearchConfig,
  AutoCompleteRequest,
  Prediction,
  AutoCompleteResponse,
  Place,
  PlaceDetails,
  GetPlaceDetailsRequestByPlaceId,
  GetPlaceDetailsRequestByLatLong,
  GetPlaceDetailsRequest,
  
  // Ride Search
  RideSearchParams,
  SearchRideRequest,
  SearchRideResponse,
  FareBreakup,
  NightShiftInfo,
  TollChargesInfo,
  WaitingCharges,
  FareRange,
  RideEstimate,
  Estimate,
  SearchResultsResponse,
  RideSearchResult,
  
  // Estimate Selection
  SelectEstimateParams,
  SelectEstimateRequest,
  AddTipParams,
  
  // Booking Status
  FetchStatusParams,
  RideBooking,
  FetchStatusResponse,
  RideStatus,
  
  // Saved Locations
  SavedLocation,
  SavedLocationsListResponse,
  
  // Cancel
  CancelSearchParams,
  CancelSearchResponse,
  
  // Config
  ApiClientConfig,
  ApiError,
} from './types.js';

// Default export
export { NyApiClient as default } from './client.js';