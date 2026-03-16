// ============================================================================
// Ride Booking Hook
// Manages ride search, selection, and tracking
// ============================================================================

import { useState, useCallback } from 'react';
import { NammaYatriClient } from '../api/client.js';
import type {
  PlaceDetails,
  RideEstimate,
  RideBooking,
  SavedLocation,
} from '../types.js';

interface RideState {
  origin: PlaceDetails | null;
  destination: PlaceDetails | null;
  estimates: RideEstimate[];
  selectedEstimate: RideEstimate | null;
  currentBooking: RideBooking | null;
  searchId: string | null;
  isSearching: boolean;
  isSelecting: boolean;
  isTracking: boolean;
  error: string | null;
}

interface UseRideReturn {
  ride: RideState;
  setOrigin: (origin: PlaceDetails | null) => void;
  setDestination: (destination: PlaceDetails | null) => void;
  searchRide: (token: string) => Promise<void>;
  selectEstimate: (
    token: string,
    estimateId: string,
    options?: {
      tipAmount?: number;
      additionalEstimateIds?: string[];
    }
  ) => Promise<void>;
  cancelSearch: (token: string) => Promise<void>;
  trackBooking: (token: string, bookingId?: string) => Promise<void>;
  reset: () => void;
}

export function useRide(): UseRideReturn {
  const [ride, setRide] = useState<RideState>({
    origin: null,
    destination: null,
    estimates: [],
    selectedEstimate: null,
    currentBooking: null,
    searchId: null,
    isSearching: false,
    isSelecting: false,
    isTracking: false,
    error: null,
  });

  const setOrigin = useCallback((origin: PlaceDetails | null) => {
    setRide((prev) => ({ ...prev, origin }));
  }, []);

  const setDestination = useCallback((destination: PlaceDetails | null) => {
    setRide((prev) => ({ ...prev, destination }));
  }, []);

  const searchRide = useCallback(async (token: string) => {
    setRide((prev) => ({ ...prev, isSearching: true, error: null }));

    try {
      const client = new NammaYatriClient(token);

      if (!ride.origin || !ride.destination) {
        throw new Error('Origin and destination are required');
      }

      const searchId = await client.searchRide(ride.origin, ride.destination);
      const estimates = await client.pollForEstimates(searchId, 15000, 2000);

      setRide((prev) => ({
        ...prev,
        searchId,
        estimates,
        isSearching: false,
      }));
    } catch (error) {
      setRide((prev) => ({
        ...prev,
        isSearching: false,
        error: error instanceof Error ? error.message : 'Search failed',
      }));
      throw error;
    }
  }, [ride.origin, ride.destination]);

  const selectEstimate = useCallback(
    async (
      token: string,
      estimateId: string,
      options?: {
        tipAmount?: number;
        additionalEstimateIds?: string[];
      }
    ) => {
      setRide((prev) => ({ ...prev, isSelecting: true, error: null }));

      try {
        const client = new NammaYatriClient(token);
        const estimate = ride.estimates.find((e) => e.id === estimateId);

        await client.selectEstimate(estimateId, {
          tipAmount: options?.tipAmount,
          additionalEstimateIds: options?.additionalEstimateIds,
        });

        setRide((prev) => ({
          ...prev,
          selectedEstimate: estimate || null,
          isSelecting: false,
        }));

        // Start polling for driver assignment
        setRide((prev) => ({ ...prev, isTracking: true }));
        const booking = await client.pollForDriverAssignment(60000, 3000);

        setRide((prev) => ({
          ...prev,
          currentBooking: booking,
          isTracking: false,
        }));
      } catch (error) {
        setRide((prev) => ({
          ...prev,
          isSelecting: false,
          isTracking: false,
          error: error instanceof Error ? error.message : 'Selection failed',
        }));
        throw error;
      }
    },
    [ride.estimates]
  );

  const cancelSearch = useCallback(async (token: string) => {
    if (!ride.searchId) return;

    try {
      const client = new NammaYatriClient(token);
      await client.cancelSearch(ride.searchId);

      setRide((prev) => ({
        ...prev,
        searchId: null,
        estimates: [],
      }));
    } catch (error) {
      // Non-critical error
    }
  }, [ride.searchId]);

  const trackBooking = useCallback(async (token: string, bookingId?: string) => {
    setRide((prev) => ({ ...prev, isTracking: true, error: null }));

    try {
      const client = new NammaYatriClient(token);

      if (bookingId) {
        const booking = await client.getBookingDetails(bookingId);
        setRide((prev) => ({
          ...prev,
          currentBooking: booking,
          isTracking: false,
        }));
      } else {
        // Get most recent active booking
        const bookings = await client.getActiveBookings();
        if (bookings.length > 0) {
          setRide((prev) => ({
            ...prev,
            currentBooking: bookings[0],
            isTracking: false,
          }));
        } else {
          setRide((prev) => ({
            ...prev,
            isTracking: false,
            error: 'No active bookings found',
          }));
        }
      }
    } catch (error) {
      setRide((prev) => ({
        ...prev,
        isTracking: false,
        error: error instanceof Error ? error.message : 'Tracking failed',
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setRide({
      origin: null,
      destination: null,
      estimates: [],
      selectedEstimate: null,
      currentBooking: null,
      searchId: null,
      isSearching: false,
      isSelecting: false,
      isTracking: false,
      error: null,
    });
  }, []);

  return {
    ride,
    setOrigin,
    setDestination,
    searchRide,
    selectEstimate,
    cancelSearch,
    trackBooking,
    reset,
  };
}

export default useRide;
