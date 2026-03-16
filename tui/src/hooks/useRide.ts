import { useState, useCallback } from 'react';
import type { PlaceDetailsResponse, RideEstimate, RideBooking } from '../types/index.js';
import { searchRide, selectEstimate, pollForRideAssignment } from '../utils/api.js';

interface UseRideReturn {
  isSearching: boolean;
  isSelecting: boolean;
  isPolling: boolean;
  estimates: RideEstimate[];
  error: string | null;
  search: (token: string, origin: PlaceDetailsResponse, destination: PlaceDetailsResponse) => Promise<RideEstimate[]>;
  select: (token: string, estimate: RideEstimate) => Promise<void>;
  pollForDriver: (token: string, maxDurationMs?: number) => Promise<RideBooking | null>;
  clearEstimates: () => void;
  clearError: () => void;
}

export function useRide(): UseRideReturn {
  const [isSearching, setIsSearching] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [estimates, setEstimates] = useState<RideEstimate[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (
    token: string,
    origin: PlaceDetailsResponse,
    destination: PlaceDetailsResponse
  ): Promise<RideEstimate[]> => {
    setIsSearching(true);
    setError(null);

    try {
      const result = await searchRide(token, origin, destination);
      setEstimates(result.estimates);
      return result.estimates;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search for rides';
      setError(message);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  const select = useCallback(async (token: string, estimate: RideEstimate): Promise<void> => {
    setIsSelecting(true);
    setError(null);

    try {
      await selectEstimate(token, estimate.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to select estimate';
      setError(message);
      throw err;
    } finally {
      setIsSelecting(false);
    }
  }, []);

  const pollForDriver = useCallback(async (
    token: string,
    maxDurationMs: number = 30000
  ): Promise<RideBooking | null> => {
    setIsPolling(true);
    setError(null);

    try {
      const booking = await pollForRideAssignment(token, maxDurationMs);
      return booking;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to poll for driver';
      setError(message);
      return null;
    } finally {
      setIsPolling(false);
    }
  }, []);

  const clearEstimates = useCallback(() => {
    setEstimates([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isSearching,
    isSelecting,
    isPolling,
    estimates,
    error,
    search,
    select,
    pollForDriver,
    clearEstimates,
    clearError,
  };
}
