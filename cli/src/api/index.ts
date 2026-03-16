/**
 * API Module Exports
 * Provides Namma Yatri API client and types
 */

// Client and Token Manager
export { NammaYatriClient, apiClient, NammaYatriApiError } from './client.js';
export { TokenManager, TokenObfuscator, tokenManager } from './token.js';
export type { TokenValidationResult, TokenRefreshResult } from './token.js';

// Types - re-export all types for convenience
export type {
  // Common
  Address,
  Currency,
  Location,
  LocationWithAddress,
  // Auth
  AuthResponse,
  AuthRequest,
  Person,
  TokenData,
  // Places
  PlacePrediction,
  PlaceDetails,
  AutoCompleteRequest,
  AutoCompleteResponse,
  DistanceWithUnit,
  GetPlaceDetailsByPlaceId,
  GetPlaceDetailsByLatLong,
  // Ride Search
  RideEstimate,
  RideSearchRequest,
  RideSearchResponse,
  SearchResultsResponse,
  FareBreakup,
  NightShiftInfo,
  TollChargesInfo,
  WaitingCharges,
  FareRange,
  // Selection
  SelectEstimateRequest,
  SelectEstimateOptions,
  // Booking
  RideBooking,
  BookingStatus,
  BookingListResponse,
  // Saved Locations
  SavedLocation,
  SavedLocationsResponse,
  // Errors
  ApiError,
  // Interface
  INammaYatriClient,
} from './types.js';