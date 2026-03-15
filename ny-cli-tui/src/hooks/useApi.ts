/**
 * useApi - React hook for Namma Yatri API integration
 * 
 * This hook provides a clean interface for components to interact with
 * the Namma Yatri API. It handles:
 * - Token management via token-storage
 * - Client initialization and lifecycle
 * - Loading and error states
 * - Saved locations caching
 * - Authentication state
 * 
 * @example
 * ```tsx
 * const { client, isLoading, error, isAuthenticated, authenticate, logout } = useApi();
 * 
 * if (!isAuthenticated) {
 *   return <AuthFlow onSuccess={login} />;
 * }
 * 
 * const places = await client.searchPlaces('Koramangala');
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { NyApiClient } from '@namma-yatri/api-client';
import type {
  Place,
  PlaceDetails,
  RideSearchResult,
  Estimate,
  RideStatus,
  SavedLocation,
  AuthResult,
  Address,
} from '@namma-yatri/api-client';
import { tokenStorage, type TokenData } from '../utils/token-storage.js';

// =============================================================================
// Types
// =============================================================================

export interface UseApiState {
  /** Whether the API is ready for use */
  isReady: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Current error message if any */
  error: string | null;
  /** Saved locations from cache */
  savedLocations: SavedLocation[];
  /** Token data if available */
  tokenData: TokenData | null;
}

export interface UseApiActions {
  /** Authenticate with access code */
  authenticate: (config: {
    country: string;
    mobileNumber: string;
    accessCode: string;
  }) => Promise<AuthResult>;
  /** Logout and clear token */
  logout: () => Promise<void>;
  /** Clear current error */
  clearError: () => void;
  /** Refresh saved locations from API */
  refreshSavedLocations: () => Promise<SavedLocation[]>;
  /** Check if saved locations need refresh (older than 24h) */
  needsLocationRefresh: () => Promise<boolean>;
}

export interface UseApiReturns extends UseApiState, UseApiActions {
  /** The NyApiClient instance (null if not authenticated) */
  client: NyApiClient | null;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useApi(): UseApiReturns {
  // State
  const [state, setState] = useState<UseApiState>({
    isReady: false,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    savedLocations: [],
    tokenData: null,
  });

  const [client, setClient] = useState<NyApiClient | null>(null);

  // Refs for cleanup
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeClient();
  }, []);

  /**
   * Initialize the API client from stored token
   */
  const initializeClient = async () => {
    try {
      const isValid = await tokenStorage.isValid();
      
      if (!isValid) {
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            isReady: true,
            isAuthenticated: false,
            isLoading: false,
          }));
        }
        return;
      }

      const token = await tokenStorage.getToken();
      const tokenData = await tokenStorage.load();
      const savedLocations = await tokenStorage.getSavedLocations();

      if (token && mountedRef.current) {
        const apiClient = new NyApiClient(token);
        setClient(apiClient);
        setState(prev => ({
          ...prev,
          isReady: true,
          isAuthenticated: true,
          isLoading: false,
          savedLocations,
          tokenData,
        }));
      }
    } catch (error) {
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isReady: true,
          isAuthenticated: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to initialize',
        }));
      }
    }
  };

  /**
   * Authenticate with Namma Yatri
   */
  const authenticate = useCallback(async (config: {
    country: string;
    mobileNumber: string;
    accessCode: string;
  }): Promise<AuthResult> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await NyApiClient.authenticate({
        country: config.country,
        mobileNumber: config.mobileNumber,
        accessCode: config.accessCode,
      });

      if (!result.authenticated || !result.token) {
        throw new Error('Authentication failed - no token received');
      }

      // Save token to storage
      await tokenStorage.save(result.token, {
        savedLocations: result.savedLocations || [],
      });

      // Create client
      const apiClient = new NyApiClient(result.token);

      if (mountedRef.current) {
        setClient(apiClient);
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          isLoading: false,
          savedLocations: result.savedLocations || [],
        }));
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
      }
      
      throw error;
    }
  }, []);

  /**
   * Logout and clear stored token
   */
  const logout = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await tokenStorage.delete();
      
      if (mountedRef.current) {
        setClient(null);
        setState(prev => ({
          ...prev,
          isAuthenticated: false,
          isLoading: false,
          savedLocations: [],
          tokenData: null,
          error: null,
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
      }
    }
  }, []);

  /**
   * Clear current error
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Refresh saved locations from API
   */
  const refreshSavedLocations = useCallback(async (): Promise<SavedLocation[]> => {
    if (!client) {
      return state.savedLocations;
    }

    try {
      const locations = await client.getSavedLocations();
      await tokenStorage.updateSavedLocations(locations);
      
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          savedLocations: locations,
        }));
      }
      
      return locations;
    } catch (error) {
      // Return cached locations on error
      return state.savedLocations;
    }
  }, [client, state.savedLocations]);

  /**
   * Check if saved locations need refresh
   */
  const needsLocationRefresh = useCallback(async (): Promise<boolean> => {
    return tokenStorage.needsLocationRefresh();
  }, []);

  return {
    ...state,
    client,
    authenticate,
    logout,
    clearError,
    refreshSavedLocations,
    needsLocationRefresh,
  };
}

// =============================================================================
// Specialized Hooks
// =============================================================================

/**
 * Hook for place search operations
 */
export function usePlaceSearch(client: NyApiClient | null) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (
    searchText: string,
    sourceLocation?: { lat: number; lon: number }
  ) => {
    if (!client || searchText.length < 2) {
      setPlaces([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await client.searchPlaces({
        searchText,
        sourceLat: sourceLocation?.lat,
        sourceLon: sourceLocation?.lon,
      });
      setPlaces(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setPlaces([]);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const getDetails = useCallback(async (placeId: string): Promise<PlaceDetails | null> => {
    if (!client) return null;

    try {
      return await client.getPlaceDetails(placeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get place details');
      return null;
    }
  }, [client]);

  const getDetailsByCoords = useCallback(async (lat: number, lon: number): Promise<PlaceDetails | null> => {
    if (!client) return null;

    try {
      return await client.getPlaceDetails(lat, lon);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get place details');
      return null;
    }
  }, [client]);

  const clear = useCallback(() => {
    setPlaces([]);
    setError(null);
  }, []);

  return {
    places,
    isLoading,
    error,
    search,
    getDetails,
    getDetailsByCoords,
    clear,
  };
}

/**
 * Hook for ride search operations
 */
export function useRideSearch(client: NyApiClient | null) {
  const [searchId, setSearchId] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromLocation, setFromLocation] = useState<RideSearchResult['fromLocation'] | null>(null);
  const [toLocation, setToLocation] = useState<RideSearchResult['toLocation'] | null>(null);

  const search = useCallback(async (params: {
    originLat: number;
    originLon: number;
    destinationLat: number;
    destinationLon: number;
    originAddress?: Address;
    destinationAddress?: Address;
  }) => {
    if (!client) {
      setError('Not authenticated');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setEstimates([]);

    try {
      const result = await client.searchRides({
        originLat: params.originLat,
        originLon: params.originLon,
        destinationLat: params.destinationLat,
        destinationLon: params.destinationLon,
        originAddress: params.originAddress,
        destinationAddress: params.destinationAddress,
      });

      setSearchId(result.searchId);
      setEstimates(result.estimates);
      setFromLocation(result.fromLocation);
      setToLocation(result.toLocation);

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const startSearch = useCallback(async (params: {
    originLat: number;
    originLon: number;
    destinationLat: number;
    destinationLon: number;
    originAddress?: Address;
    destinationAddress?: Address;
  }): Promise<string | null> => {
    if (!client) {
      setError('Not authenticated');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const id = await client.startRideSearch({
        originLat: params.originLat,
        originLon: params.originLon,
        destinationLat: params.destinationLat,
        destinationLon: params.destinationLon,
        originAddress: params.originAddress,
        destinationAddress: params.destinationAddress,
      });

      setSearchId(id);
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start search');
      return null;
    }
  }, [client]);

  const pollForEstimates = useCallback(async (
    id?: string,
    maxAttempts = 5,
    interval = 2000
  ): Promise<Estimate[]> => {
    const searchIdToUse = id || searchId;
    if (!client || !searchIdToUse) return [];

    try {
      const results = await client.pollForEstimates(searchIdToUse, maxAttempts, interval);
      setEstimates(results);
      return results;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Polling failed');
      return [];
    }
  }, [client, searchId]);

  const getSearchResults = useCallback(async (id?: string): Promise<RideSearchResult | null> => {
    const searchIdToUse = id || searchId;
    if (!client || !searchIdToUse) return null;

    try {
      const result = await client.getSearchResults(searchIdToUse);
      setEstimates(result.estimates);
      setFromLocation(result.fromLocation);
      setToLocation(result.toLocation);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get results');
      return null;
    }
  }, [client, searchId]);

  const clear = useCallback(() => {
    setSearchId(null);
    setEstimates([]);
    setError(null);
    setFromLocation(null);
    setToLocation(null);
  }, []);

  return {
    searchId,
    estimates,
    isLoading,
    error,
    fromLocation,
    toLocation,
    search,
    startSearch,
    pollForEstimates,
    getSearchResults,
    clear,
  };
}

/**
 * Hook for estimate selection and booking
 */
export function useBooking(client: NyApiClient | null) {
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ride, setRide] = useState<RideStatus | null>(null);

  const selectEstimate = useCallback(async (params: {
    estimateId: string;
    additionalEstimateIds?: string[];
    isPetRide?: boolean;
    specialAssistance?: boolean;
  }) => {
    if (!client) {
      setError('Not authenticated');
      return null;
    }

    setIsBooking(true);
    setError(null);

    try {
      await client.selectEstimate(params);
      
      // Poll for driver assignment
      const assignedRide = await client.pollForDriverAssignment();
      setRide(assignedRide);
      
      return assignedRide;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed');
      return null;
    } finally {
      setIsBooking(false);
    }
  }, [client]);

  const selectEstimateAndWait = useCallback(async (params: {
    estimateId: string;
    additionalEstimateIds?: string[];
    isPetRide?: boolean;
    specialAssistance?: boolean;
  }, maxWaitMs?: number): Promise<RideStatus | null> => {
    if (!client) {
      setError('Not authenticated');
      return null;
    }

    setIsBooking(true);
    setError(null);

    try {
      const assignedRide = await client.selectEstimateAndWait(params, maxWaitMs);
      setRide(assignedRide);
      return assignedRide;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed');
      return null;
    } finally {
      setIsBooking(false);
    }
  }, [client]);

  const addTip = useCallback(async (params: {
    estimateId: string;
    tipAmount: number;
    tipCurrency?: string;
  }) => {
    if (!client) {
      setError('Not authenticated');
      return false;
    }

    try {
      await client.addTip(params);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add tip');
      return false;
    }
  }, [client]);

  const cancelSearch = useCallback(async (estimateId: string) => {
    if (!client) {
      setError('Not authenticated');
      return false;
    }

    try {
      await client.cancelSearch({ estimateId });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
      return false;
    }
  }, [client]);

  const clear = useCallback(() => {
    setIsBooking(false);
    setError(null);
    setRide(null);
  }, []);

  return {
    isBooking,
    error,
    ride,
    selectEstimate,
    selectEstimateAndWait,
    addTip,
    cancelSearch,
    clear,
  };
}

/**
 * Hook for ride status tracking
 */
export function useRideStatus(client: NyApiClient | null) {
  const [rides, setRides] = useState<RideStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (params?: {
    onlyActive?: boolean;
    limit?: number;
    offset?: number;
    status?: string[];
  }) => {
    if (!client) {
      setError('Not authenticated');
      return [];
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await client.getRideStatus(params);
      setRides(results);
      return results;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const pollForDriver = useCallback(async (
    maxAttempts = 30,
    interval = 2000
  ): Promise<RideStatus | null> => {
    if (!client) return null;

    try {
      const ride = await client.pollForDriverAssignment(maxAttempts, interval);
      if (ride) {
        setRides(prev => [ride, ...prev.filter(r => r.id !== ride.id)]);
      }
      return ride;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Polling failed');
      return null;
    }
  }, [client]);

  const clear = useCallback(() => {
    setRides([]);
    setError(null);
  }, []);

  return {
    rides,
    isLoading,
    error,
    fetchStatus,
    pollForDriver,
    clear,
  };
}

/**
 * Hook for saved locations management
 */
export function useSavedLocations(client: NyApiClient | null) {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    if (!client) {
      // Try to load from local storage
      const localLocations = await tokenStorage.getSavedLocations();
      setLocations(localLocations);
      return localLocations;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await client.getSavedLocations();
      await tokenStorage.updateSavedLocations(results);
      setLocations(results);
      return results;
    } catch (err) {
      // Fall back to local cache
      const localLocations = await tokenStorage.getSavedLocations();
      setLocations(localLocations);
      setError(err instanceof Error ? err.message : 'Failed to fetch locations');
      return localLocations;
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  const refreshIfNeeded = useCallback(async () => {
    const needsRefresh = await tokenStorage.needsLocationRefresh();
    if (needsRefresh) {
      return fetchLocations();
    }
    const localLocations = await tokenStorage.getSavedLocations();
    setLocations(localLocations);
    return localLocations;
  }, [fetchLocations]);

  // Load locations on mount
  useEffect(() => {
    refreshIfNeeded();
  }, [refreshIfNeeded]);

  return {
    locations,
    isLoading,
    error,
    fetchLocations,
    refreshIfNeeded,
  };
}

// =============================================================================
// Re-export types from shared api-client
// =============================================================================

export type {
  Place,
  PlaceDetails,
  RideSearchResult,
  Estimate,
  RideStatus,
  SavedLocation,
  AuthResult,
  Address,
} from '@namma-yatri/api-client';

// =============================================================================
// Default Export
// =============================================================================

export default useApi;