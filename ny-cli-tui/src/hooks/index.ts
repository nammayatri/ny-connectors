/**
 * Hooks index - Export all hooks from the hooks module
 */

export {
  useApi,
  usePlaceSearch,
  useRideSearch,
  useBooking,
  useRideStatus,
  useSavedLocations,
  type UseApiState,
  type UseApiActions,
  type UseApiReturns,
} from './useApi.js';

// Re-export types from shared api-client for convenience
export type {
  Place,
  PlaceDetails,
  RideSearchResult,
  Estimate,
  RideStatus,
  SavedLocation,
  AuthResult,
  Address,
} from './useApi.js';

export default useApi;