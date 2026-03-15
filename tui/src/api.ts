/**
 * API module - Re-exports from client.ts for backward compatibility
 * 
 * This file provides a convenient entry point for API functionality.
 * The main implementation is in ./api/client.ts
 */

export {
  // Client class
  NammaYatriClient,
  ApiError,
  
  // Token management
  readTokenData,
  saveTokenData,
  updateSavedLocations,
  clearToken,
  getToken,
  getSavedLocations,
  needsSavedLocationsRefresh,
  findSavedLocation,
  getAuthenticatedClient,
  isAuthenticated,
  
  // Convenience functions
  searchPlaces,
  getPlaceDetails,
  searchRides,
  selectEstimate,
  addTip,
  cancelSearch,
  fetchStatus,
  fetchSavedLocations,
  
  // Formatting utilities
  formatCurrency,
  formatFareRange,
  formatPickupDuration,
  formatDistance,
  
  // Types
  type Currency,
  type Location,
  type Address,
  type LocationWithAddress,
  type PersonEntity,
  type TokenData,
  type SavedLocation,
  type PlacePrediction,
  type PlaceDetails,
  type FareBreakup,
  type NightShiftInfo,
  type TollChargesInfo,
  type WaitingCharges,
  type FareRange,
  type RideEstimate,
  type SearchResults,
  type RideBooking,
  type AuthRequest,
  type AuthResponse,
} from './api/client.js';