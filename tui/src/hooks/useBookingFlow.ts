import { useState, useEffect, useCallback } from 'react';
import type {
  NYPlaceDetails,
  NYSavedLocation,
  NYEstimate,
  RideBooking,
  PersonAPIEntity,
  StoredToken,
} from '../types/index.js';
import { loadToken, saveToken } from '../utils/token.js';
import { NammaYatriClient } from '../api/client.js';

// ============================================================================
// Flow State Types
// ============================================================================

export type BookingFlowState =
  | 'AUTH'
  | 'ORIGIN'
  | 'DESTINATION'
  | 'SEARCHING'
  | 'ESTIMATES'
  | 'SELECTING'
  | 'POLLING_DRIVER'
  | 'CONFIRMED'
  | 'ERROR';

export interface BookingFlowContext {
  state: BookingFlowState;
  token: string | null;
  user: PersonAPIEntity | null;
  savedLocations: NYSavedLocation[];
  origin: NYPlaceDetails | null;
  destination: NYPlaceDetails | null;
  searchId: string | null;
  estimates: NYEstimate[];
  selectedEstimate: NYEstimate | null;
  currentBooking: RideBooking | null;
  error: string | null;
  isLoading: boolean;
}

export interface UseBookingFlowReturn extends BookingFlowContext {
  // Actions
  setAuth: (token: string, user: PersonAPIEntity | null, savedLocations: NYSavedLocation[]) => void;
  setOrigin: (origin: NYPlaceDetails) => void;
  setDestination: (destination: NYPlaceDetails) => void;
  searchRides: () => Promise<void>;
  selectEstimate: (estimateId: string, additionalIds?: string[], tipAmount?: number) => Promise<void>;
  pollForDriver: () => Promise<void>;
  resetFlow: () => void;
  goToHome: () => void;
  setErrorState: (message: string) => void;
  retry: () => void;
  logout: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const INITIAL_CONTEXT: BookingFlowContext = {
  state: 'AUTH',
  token: null,
  user: null,
  savedLocations: [],
  origin: null,
  destination: null,
  searchId: null,
  estimates: [],
  selectedEstimate: null,
  currentBooking: null,
  error: null,
  isLoading: false,
};

// ============================================================================
// Hook
// ============================================================================

export function useBookingFlow(): UseBookingFlowReturn {
  const [context, setContext] = useState<BookingFlowContext>(INITIAL_CONTEXT);

  // Load token on mount
  useEffect(() => {
    async function init() {
      try {
        const stored = await loadToken();
        if (stored?.token) {
          // Check if saved locations need refresh
          const needsRefresh = !stored.savedLocationsUpdatedAt || 
            Date.now() - new Date(stored.savedLocationsUpdatedAt).getTime() > 24 * 60 * 60 * 1000;

          let savedLocations = stored.savedLocations || [];

          if (needsRefresh) {
            try {
              const client = new NammaYatriClient(stored.token);
              savedLocations = await client.getSavedLocations();
              // Update stored token with fresh locations
              await saveToken({
                ...stored,
                savedLocations,
                savedLocationsUpdatedAt: new Date().toISOString(),
              });
            } catch {
              // Use cached locations if refresh fails
            }
          }

          setContext(prev => ({
            ...prev,
            state: 'ORIGIN',
            token: stored.token,
            user: stored.person || null,
            savedLocations,
          }));
        }
      } catch (err) {
        // Stay in AUTH state if token loading fails
        console.error('Failed to load token:', err);
      }
    }
    init();
  }, []);

  // Set authentication data
  const setAuth = useCallback((
    token: string,
    user: PersonAPIEntity | null,
    savedLocations: NYSavedLocation[]
  ) => {
    setContext(prev => ({
      ...prev,
      state: 'ORIGIN',
      token,
      user,
      savedLocations,
    }));
  }, []);

  // Set origin location
  const setOrigin = useCallback((origin: NYPlaceDetails) => {
    setContext(prev => ({
      ...prev,
      origin,
      state: 'DESTINATION',
    }));
  }, []);

  // Set destination location
  const setDestination = useCallback((destination: NYPlaceDetails) => {
    setContext(prev => ({
      ...prev,
      destination,
      state: 'SEARCHING',
    }));
  }, []);

  // Search for rides
  const searchRides = useCallback(async () => {
    const { token, origin, destination } = context;
    
    if (!token || !origin || !destination) {
      setContext(prev => ({
        ...prev,
        state: 'ERROR',
        error: 'Missing required information for ride search',
      }));
      return;
    }

    setContext(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const client = new NammaYatriClient(token);
      const searchId = await client.searchRide(origin, destination);
      
      // Poll for estimates
      const estimates = await client.pollForEstimates(searchId);

      setContext(prev => ({
        ...prev,
        state: 'ESTIMATES',
        searchId,
        estimates,
        isLoading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search for rides';
      setContext(prev => ({
        ...prev,
        state: 'ERROR',
        error: message,
        isLoading: false,
      }));
    }
  }, [context.token, context.origin, context.destination]);

  // Select an estimate
  const selectEstimate = useCallback(async (
    estimateId: string,
    additionalIds: string[] = [],
    tipAmount?: number
  ) => {
    const { token, estimates } = context;
    
    if (!token) {
      setContext(prev => ({
        ...prev,
        state: 'ERROR',
        error: 'Not authenticated',
      }));
      return;
    }

    const selectedEstimate = estimates.find(e => e.id === estimateId) || null;
    
    setContext(prev => ({
      ...prev,
      state: 'SELECTING',
      selectedEstimate,
      isLoading: true,
      error: null,
    }));

    try {
      const client = new NammaYatriClient(token);
      
      if (tipAmount && tipAmount > 0) {
        await client.addTipAndSelect(estimateId, tipAmount);
      } else {
        await client.selectEstimate(estimateId, additionalIds);
      }

      setContext(prev => ({
        ...prev,
        state: 'POLLING_DRIVER',
        isLoading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to select estimate';
      setContext(prev => ({
        ...prev,
        state: 'ERROR',
        error: message,
        isLoading: false,
      }));
    }
  }, [context.token, context.estimates]);

  // Poll for driver assignment
  const pollForDriver = useCallback(async () => {
    const { token } = context;
    
    if (!token) {
      setContext(prev => ({
        ...prev,
        state: 'ERROR',
        error: 'Not authenticated',
      }));
      return;
    }

    try {
      const client = new NammaYatriClient(token);
      const booking = await client.pollForDriverAssignment(30000);

      if (booking) {
        setContext(prev => ({
          ...prev,
          state: 'CONFIRMED',
          currentBooking: booking,
        }));
      } else {
        // Timeout - driver not assigned yet but request is still active
        setContext(prev => ({
          ...prev,
          state: 'CONFIRMED',
          currentBooking: null,
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to poll for driver';
      setContext(prev => ({
        ...prev,
        state: 'ERROR',
        error: message,
      }));
    }
  }, [context.token]);

  // Reset flow to start new booking
  const resetFlow = useCallback(() => {
    setContext(prev => ({
      ...prev,
      state: 'ORIGIN',
      origin: null,
      destination: null,
      searchId: null,
      estimates: [],
      selectedEstimate: null,
      currentBooking: null,
      error: null,
      isLoading: false,
    }));
  }, []);

  // Go to home (origin selection)
  const goToHome = useCallback(() => {
    setContext(prev => ({
      ...prev,
      state: 'ORIGIN',
      error: null,
    }));
  }, []);

  // Set error state
  const setErrorState = useCallback((message: string) => {
    setContext(prev => ({
      ...prev,
      state: 'ERROR',
      error: message,
    }));
  }, []);

  // Retry from error state
  const retry = useCallback(() => {
    setContext(prev => {
      // Determine where to go back to based on what data we have
      if (!prev.origin) {
        return { ...prev, state: 'ORIGIN', error: null };
      }
      if (!prev.destination) {
        return { ...prev, state: 'DESTINATION', error: null };
      }
      if (prev.estimates.length === 0) {
        return { ...prev, state: 'SEARCHING', error: null };
      }
      if (!prev.selectedEstimate) {
        return { ...prev, state: 'ESTIMATES', error: null };
      }
      return { ...prev, state: 'POLLING_DRIVER', error: null };
    });
  }, []);

  // Logout and clear token
  const logout = useCallback(async () => {
    const { clearToken } = await import('../utils/token.js');
    await clearToken();
    setContext(INITIAL_CONTEXT);
  }, []);

  return {
    ...context,
    setAuth,
    setOrigin,
    setDestination,
    searchRides,
    selectEstimate,
    pollForDriver,
    resetFlow,
    goToHome,
    setErrorState,
    retry,
    logout,
  };
}
