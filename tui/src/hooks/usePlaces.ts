import { useState, useCallback } from 'react';
import type { Prediction, PlaceDetailsResponse, SavedLocation } from '../types/index.js';
import { searchPlaces, getPlaceDetails, getPlaceDetailsByLatLon } from '../utils/api.js';

interface UsePlacesReturn {
  isLoading: boolean;
  predictions: Prediction[];
  error: string | null;
  search: (token: string, query: string, sourceLat?: number, sourceLon?: number) => Promise<void>;
  getDetails: (token: string, placeId: string) => Promise<PlaceDetailsResponse | null>;
  getDetailsByLatLon: (token: string, lat: number, lon: number) => Promise<PlaceDetailsResponse | null>;
  clearPredictions: () => void;
  clearError: () => void;
}

export function usePlaces(): UsePlacesReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (
    token: string,
    query: string,
    sourceLat?: number,
    sourceLon?: number
  ): Promise<void> => {
    if (!query.trim()) {
      setPredictions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await searchPlaces(token, query, sourceLat, sourceLon);
      setPredictions(results);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search places';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getDetails = useCallback(async (
    token: string,
    placeId: string
  ): Promise<PlaceDetailsResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      return await getPlaceDetails(token, placeId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get place details';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getDetailsByLatLon = useCallback(async (
    token: string,
    lat: number,
    lon: number
  ): Promise<PlaceDetailsResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      return await getPlaceDetailsByLatLon(token, lat, lon);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get place details';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearPredictions = useCallback(() => {
    setPredictions([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    predictions,
    error,
    search,
    getDetails,
    getDetailsByLatLon,
    clearPredictions,
    clearError,
  };
}
