// ============================================================================
// Places Search Hook
// Manages location search and saved locations
// ============================================================================

import { useState, useCallback } from 'react';
import { NammaYatriClient } from '../api/client.js';
import type { Place, PlaceDetails, SavedLocation } from '../types.js';

interface PlacesState {
  searchResults: Place[];
  selectedPlace: PlaceDetails | null;
  isSearching: boolean;
  error: string | null;
}

interface UsePlacesReturn {
  places: PlacesState;
  searchPlaces: (token: string, query: string, sourceLat?: number, sourceLon?: number) => Promise<void>;
  getPlaceDetails: (token: string, placeId: string) => Promise<void>;
  getPlaceDetailsByLatLon: (token: string, lat: number, lon: number) => Promise<void>;
  selectSavedLocation: (location: SavedLocation) => void;
  clearSearch: () => void;
}

export function usePlaces(): UsePlacesReturn {
  const [places, setPlaces] = useState<PlacesState>({
    searchResults: [],
    selectedPlace: null,
    isSearching: false,
    error: null,
  });

  const searchPlaces = useCallback(async (
    token: string,
    query: string,
    sourceLat?: number,
    sourceLon?: number
  ) => {
    if (!query.trim()) {
      setPlaces((prev) => ({ ...prev, searchResults: [] }));
      return;
    }

    setPlaces((prev) => ({ ...prev, isSearching: true, error: null }));

    try {
      const client = new NammaYatriClient(token);
      const results = await client.searchPlaces(query, sourceLat, sourceLon);

      setPlaces((prev) => ({
        ...prev,
        searchResults: results,
        isSearching: false,
      }));
    } catch (error) {
      setPlaces((prev) => ({
        ...prev,
        isSearching: false,
        error: error instanceof Error ? error.message : 'Search failed',
      }));
    }
  }, []);

  const getPlaceDetails = useCallback(async (token: string, placeId: string) => {
    setPlaces((prev) => ({ ...prev, isSearching: true, error: null }));

    try {
      const client = new NammaYatriClient(token);
      const details = await client.getPlaceDetails(placeId);

      setPlaces((prev) => ({
        ...prev,
        selectedPlace: details,
        isSearching: false,
      }));
    } catch (error) {
      setPlaces((prev) => ({
        ...prev,
        isSearching: false,
        error: error instanceof Error ? error.message : 'Failed to get place details',
      }));
    }
  }, []);

  const getPlaceDetailsByLatLon = useCallback(async (token: string, lat: number, lon: number) => {
    setPlaces((prev) => ({ ...prev, isSearching: true, error: null }));

    try {
      const client = new NammaYatriClient(token);
      const details = await client.getPlaceDetailsByLatLon(lat, lon);

      setPlaces((prev) => ({
        ...prev,
        selectedPlace: details,
        isSearching: false,
      }));
    } catch (error) {
      setPlaces((prev) => ({
        ...prev,
        isSearching: false,
        error: error instanceof Error ? error.message : 'Failed to get place details',
      }));
    }
  }, []);

  const selectSavedLocation = useCallback((location: SavedLocation) => {
    setPlaces((prev) => ({
      ...prev,
      selectedPlace: {
        lat: location.lat,
        lon: location.lon,
        placeId: location.placeId || `${location.lat},${location.lon}`,
        address: {
          area: location.area,
          building: location.building,
          city: location.city,
          country: location.country,
          state: location.state,
          street: location.street,
        },
      },
    }));
  }, []);

  const clearSearch = useCallback(() => {
    setPlaces({
      searchResults: [],
      selectedPlace: null,
      isSearching: false,
      error: null,
    });
  }, []);

  return {
    places,
    searchPlaces,
    getPlaceDetails,
    getPlaceDetailsByLatLon,
    selectSavedLocation,
    clearSearch,
  };
}

export default usePlaces;
