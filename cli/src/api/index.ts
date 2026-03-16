/**
 * API Module Exports
 */

export {
  NammaYatriClient as default,
  NammaYatriClient,
  createAddressFromCoordinates,
  parseCoordinates,
  APIError,
} from "./client.js";

export type {
  // Common Types
  Currency,
  Location,
  Address,
  LocationWithAddress,
  
  // Auth Types
  AuthenticateRequest,
  AuthenticateResponse,
  PersonAPIEntity,
  
  // Places Types
  Place,
  PlaceDetails,
  AutoCompleteRequest,
  AutoCompleteResponse,
  GetPlaceDetailsRequest,
  
  // Saved Locations Types
  SavedLocation,
  SavedLocationsResponse,
  
  // Ride Search Types
  SearchRideRequest,
  SearchRideResponse,
  
  // Estimate Types
  FareBreakup,
  NightShiftInfo,
  TollChargesInfo,
  WaitingCharges,
  FareRange,
  Estimate,
  SearchResultsResponse,
  SelectEstimateRequest,
  SelectEstimateOptions,
  
  // Booking Types
  RideBooking,
  FetchStatusResponse,
  FetchStatusOptions,
  BookingStatusAPIEntity,
  
  // Ride Status Types
  RideAPIEntity,
  GetRideStatusResponse,
  
  // Cancellation Types
  CancellationReason,
  CancelBookingRequest,
  
  // Tip Types
  AddTipRequest,
  
  // Price Breakdown Types
  QuoteBreakupItem,
  PriceBreakdownResponse,
} from "./client.js";
