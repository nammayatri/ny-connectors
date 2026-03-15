/**
 * Tests for useApi Hook
 * 
 * Tests cover:
 * - Hook initialization
 * - Authentication flow
 * - Logout flow
 * - Error handling
 * - Saved locations management
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useApi, usePlaceSearch, useRideSearch, useBooking, useRideStatus, useSavedLocations } from '../hooks/useApi.js';
import { NyApiClient } from '@namma-yatri/api-client';
import { tokenStorage } from '../utils/token-storage.js';

// Mock the API client
jest.mock('@namma-yatri/api-client', () => ({
  NyApiClient: jest.fn().mockImplementation(() => ({
    searchPlaces: jest.fn(),
    getPlaceDetails: jest.fn(),
    searchRides: jest.fn(),
    startRideSearch: jest.fn(),
    pollForEstimates: jest.fn(),
    getSearchResults: jest.fn(),
    selectEstimate: jest.fn(),
    selectEstimateAndWait: jest.fn(),
    addTip: jest.fn(),
    cancelSearch: jest.fn(),
    getRideStatus: jest.fn(),
    getSavedLocations: jest.fn(),
    pollForDriverAssignment: jest.fn(),
  })),
}));

// Mock token storage
jest.mock('../utils/token-storage.js', () => ({
  tokenStorage: {
    isValid: jest.fn(),
    getToken: jest.fn(),
    load: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    getSavedLocations: jest.fn(),
    updateSavedLocations: jest.fn(),
    needsLocationRefresh: jest.fn(),
  },
}));

describe('useApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // Initialization Tests
  // ===========================================================================

  describe('initialization', () => {
    it('should start in loading state', () => {
      (tokenStorage.isValid as jest.Mock).mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useApi());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isReady).toBe(false);
    });

    it('should initialize as unauthenticated when no valid token', async () => {
      (tokenStorage.isValid as jest.Mock).mockResolvedValue(false);

      const { result } = renderHook(() => useApi());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.client).toBeNull();
    });

    it('should initialize as authenticated with valid token', async () => {
      (tokenStorage.isValid as jest.Mock).mockResolvedValue(true);
      (tokenStorage.getToken as jest.Mock).mockResolvedValue('test-token');
      (tokenStorage.load as jest.Mock).mockResolvedValue({
        token: 'test-token',
        savedAt: '2024-01-01T00:00:00Z',
        savedLocations: [],
        savedLocationsUpdatedAt: '2024-01-01T00:00:00Z',
      });
      (tokenStorage.getSavedLocations as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => useApi());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.client).not.toBeNull();
      expect(NyApiClient).toHaveBeenCalledWith('test-token');
    });

    it('should load saved locations on init', async () => {
      const mockLocations = [
        { tag: 'Home', lat: 12.97, lon: 77.59 },
        { tag: 'Work', lat: 12.93, lon: 77.62 },
      ];

      (tokenStorage.isValid as jest.Mock).mockResolvedValue(true);
      (tokenStorage.getToken as jest.Mock).mockResolvedValue('test-token');
      (tokenStorage.load as jest.Mock).mockResolvedValue({
        token: 'test-token',
        savedAt: '2024-01-01T00:00:00Z',
        savedLocations: mockLocations,
        savedLocationsUpdatedAt: '2024-01-01T00:00:00Z',
      });
      (tokenStorage.getSavedLocations as jest.Mock).mockResolvedValue(mockLocations);

      const { result } = renderHook(() => useApi());

      await waitFor(() => {
        expect(result.current.savedLocations).toHaveLength(2);
      });
    });

    it('should handle initialization errors', async () => {
      (tokenStorage.isValid as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useApi());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Storage error');
    });
  });

  // ===========================================================================
  // Authentication Tests
  // ===========================================================================

  describe('authenticate', () => {
    it('should authenticate successfully', async () => {
      (tokenStorage.isValid as jest.Mock).mockResolvedValue(false);

      // Mock static authenticate method
      (NyApiClient.authenticate as jest.Mock) = jest.fn().mockResolvedValue({
        authenticated: true,
        token: 'new-auth-token',
        savedLocations: [],
      });

      const { result } = renderHook(() => useApi());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await act(async () => {
        await result.current.authenticate({
          country: 'IN',
          mobileNumber: '9876543210',
          accessCode: 'secret-code',
        });
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(tokenStorage.save).toHaveBeenCalledWith('new-auth-token', expect.any(Object));
    });

    it('should handle authentication failure', async () => {
      (tokenStorage.isValid as jest.Mock).mockResolvedValue(false);

      (NyApiClient.authenticate as jest.Mock) = jest.fn().mockRejectedValue(
        new Error('Invalid access code')
      );

      const { result } = renderHook(() => useApi());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await act(async () => {
        try {
          await result.current.authenticate({
            country: 'IN',
            mobileNumber: '9876543210',
            accessCode: 'wrong-code',
          });
        } catch (error) {
          // Expected
        }
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Invalid access code');
    });

    it('should handle missing token in response', async () => {
      (tokenStorage.isValid as jest.Mock).mockResolvedValue(false);

      (NyApiClient.authenticate as jest.Mock) = jest.fn().mockResolvedValue({
        authenticated: false,
        token: null,
      });

      const { result } = renderHook(() => useApi());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await act(async () => {
        try {
          await result.current.authenticate({
            country: 'IN',
            mobileNumber: '9876543210',
            accessCode: 'code',
          });
        } catch (error) {
          // Expected
        }
      });

      expect(result.current.error).toBe('Authentication failed - no token received');
    });
  });

  // ===========================================================================
  // Logout Tests
  // ===========================================================================

  describe('logout', () => {
    it('should logout successfully', async () => {
      (tokenStorage.isValid as jest.Mock).mockResolvedValue(true);
      (tokenStorage.getToken as jest.Mock).mockResolvedValue('test-token');
      (tokenStorage.load as jest.Mock).mockResolvedValue({
        token: 'test-token',
        savedAt: '2024-01-01T00:00:00Z',
        savedLocations: [],
        savedLocationsUpdatedAt: '2024-01-01T00:00:00Z',
      });
      (tokenStorage.getSavedLocations as jest.Mock).mockResolvedValue([]);
      (tokenStorage.delete as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useApi());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(tokenStorage.delete).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.client).toBeNull();
    });

    it('should handle logout errors', async () => {
      (tokenStorage.isValid as jest.Mock).mockResolvedValue(true);
      (tokenStorage.getToken as jest.Mock).mockResolvedValue('test-token');
      (tokenStorage.load as jest.Mock).mockResolvedValue({
        token: 'test-token',
        savedAt: '2024-01-01T00:00:00Z',
        savedLocations: [],
        savedLocationsUpdatedAt: '2024-01-01T00:00:00Z',
      });
      (tokenStorage.getSavedLocations as jest.Mock).mockResolvedValue([]);
      (tokenStorage.delete as jest.Mock).mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(() => useApi());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.error).toBe('Delete failed');
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('clearError', () => {
    it('should clear error state', async () => {
      (tokenStorage.isValid as jest.Mock).mockRejectedValue(new Error('Init error'));

      const { result } = renderHook(() => useApi());

      await waitFor(() => {
        expect(result.current.error).toBe('Init error');
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  // ===========================================================================
  // Saved Locations Tests
  // ===========================================================================

  describe('refreshSavedLocations', () => {
    it('should refresh saved locations from API', async () => {
      const mockLocations = [
        { tag: 'Home', lat: 12.97, lon: 77.59 },
      ];

      (tokenStorage.isValid as jest.Mock).mockResolvedValue(true);
      (tokenStorage.getToken as jest.Mock).mockResolvedValue('test-token');
      (tokenStorage.load as jest.Mock).mockResolvedValue({
        token: 'test-token',
        savedAt: '2024-01-01T00:00:00Z',
        savedLocations: [],
        savedLocationsUpdatedAt: '2024-01-01T00:00:00Z',
      });
      (tokenStorage.getSavedLocations as jest.Mock).mockResolvedValue([]);
      (tokenStorage.updateSavedLocations as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useApi());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Mock client method
      (result.current.client!.getSavedLocations as jest.Mock).mockResolvedValue(mockLocations);

      await act(async () => {
        const locations = await result.current.refreshSavedLocations();
        expect(locations).toEqual(mockLocations);
      });
    });

    it('should return cached locations on API error', async () => {
      const cachedLocations = [{ tag: 'Work', lat: 12.93, lon: 77.62 }];

      (tokenStorage.isValid as jest.Mock).mockResolvedValue(true);
      (tokenStorage.getToken as jest.Mock).mockResolvedValue('test-token');
      (tokenStorage.load as jest.Mock).mockResolvedValue({
        token: 'test-token',
        savedAt: '2024-01-01T00:00:00Z',
        savedLocations: cachedLocations,
        savedLocationsUpdatedAt: '2024-01-01T00:00:00Z',
      });
      (tokenStorage.getSavedLocations as jest.Mock).mockResolvedValue(cachedLocations);

      const { result } = renderHook(() => useApi());

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Mock client method to throw
      (result.current.client!.getSavedLocations as jest.Mock).mockRejectedValue(new Error('API error'));

      await act(async () => {
        const locations = await result.current.refreshSavedLocations();
        expect(locations).toEqual(cachedLocations);
      });
    });
  });

  describe('needsLocationRefresh', () => {
    it('should check if locations need refresh', async () => {
      (tokenStorage.isValid as jest.Mock).mockResolvedValue(false);
      (tokenStorage.needsLocationRefresh as jest.Mock).mockResolvedValue(true);

      const { result } = renderHook(() => useApi());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      const needsRefresh = await result.current.needsLocationRefresh();
      expect(needsRefresh).toBe(true);
    });
  });
});

// ===========================================================================
// usePlaceSearch Tests
// ===========================================================================

describe('usePlaceSearch', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      searchPlaces: jest.fn(),
      getPlaceDetails: jest.fn(),
    };
  });

  it('should start with empty places', () => {
    const { result } = renderHook(() => usePlaceSearch(null));

    expect(result.current.places).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should not search with short text', async () => {
    const { result } = renderHook(() => usePlaceSearch(mockClient));

    await act(async () => {
      await result.current.search('a');
    });

    expect(mockClient.searchPlaces).not.toHaveBeenCalled();
    expect(result.current.places).toEqual([]);
  });

  it('should search for places', async () => {
    const mockPlaces = [
      { description: 'Koramangala', placeId: 'place-1' },
    ];

    mockClient.searchPlaces.mockResolvedValue(mockPlaces);

    const { result } = renderHook(() => usePlaceSearch(mockClient));

    await act(async () => {
      await result.current.search('Koramangala');
    });

    expect(mockClient.searchPlaces).toHaveBeenCalledWith({
      searchText: 'Koramangala',
      sourceLat: undefined,
      sourceLon: undefined,
    });
    expect(result.current.places).toEqual(mockPlaces);
  });

  it('should handle search errors', async () => {
    mockClient.searchPlaces.mockRejectedValue(new Error('Search failed'));

    const { result } = renderHook(() => usePlaceSearch(mockClient));

    await act(async () => {
      await result.current.search('Koramangala');
    });

    expect(result.current.error).toBe('Search failed');
    expect(result.current.places).toEqual([]);
  });

  it('should get place details by ID', async () => {
    const mockDetails = { lat: 12.97, lon: 77.59, placeId: 'place-1' };
    mockClient.getPlaceDetails.mockResolvedValue(mockDetails);

    const { result } = renderHook(() => usePlaceSearch(mockClient));

    const details = await result.current.getDetails('place-1');

    expect(details).toEqual(mockDetails);
  });

  it('should get place details by coordinates', async () => {
    const mockDetails = { lat: 12.97, lon: 77.59, placeId: 'coords-place' };
    mockClient.getPlaceDetails.mockResolvedValue(mockDetails);

    const { result } = renderHook(() => usePlaceSearch(mockClient));

    const details = await result.current.getDetailsByCoords(12.97, 77.59);

    expect(mockClient.getPlaceDetails).toHaveBeenCalledWith(12.97, 77.59);
    expect(details).toEqual(mockDetails);
  });

  it('should clear places', async () => {
    mockClient.searchPlaces.mockResolvedValue([{ description: 'Test', placeId: '1' }]);

    const { result } = renderHook(() => usePlaceSearch(mockClient));

    await act(async () => {
      await result.current.search('Test');
    });

    expect(result.current.places).toHaveLength(1);

    act(() => {
      result.current.clear();
    });

    expect(result.current.places).toEqual([]);
  });
});

// ===========================================================================
// useRideSearch Tests
// ===========================================================================

describe('useRideSearch', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      searchRides: jest.fn(),
      startRideSearch: jest.fn(),
      pollForEstimates: jest.fn(),
      getSearchResults: jest.fn(),
    };
  });

  it('should start with empty state', () => {
    const { result } = renderHook(() => useRideSearch(null));

    expect(result.current.estimates).toEqual([]);
    expect(result.current.searchId).toBeNull();
  });

  it('should search for rides', async () => {
    const mockResult = {
      searchId: 'search-123',
      estimates: [{ id: 'est-1', vehicleVariant: 'AUTO' }],
      fromLocation: { lat: 12.93, lon: 77.62 },
      toLocation: { lat: 12.97, lon: 77.59 },
    };

    mockClient.searchRides.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useRideSearch(mockClient));

    await act(async () => {
      const res = await result.current.search({
        originLat: 12.93,
        originLon: 77.62,
        destinationLat: 12.97,
        destinationLon: 77.59,
      });
      expect(res).toEqual(mockResult);
    });

    expect(result.current.searchId).toBe('search-123');
    expect(result.current.estimates).toHaveLength(1);
  });

  it('should start ride search without polling', async () => {
    mockClient.startRideSearch.mockResolvedValue('search-456');

    const { result } = renderHook(() => useRideSearch(mockClient));

    await act(async () => {
      const id = await result.current.startSearch({
        originLat: 12.93,
        originLon: 77.62,
        destinationLat: 12.97,
        destinationLon: 77.59,
      });
      expect(id).toBe('search-456');
    });

    expect(result.current.searchId).toBe('search-456');
  });

  it('should poll for estimates', async () => {
    const mockEstimates = [{ id: 'est-1' }];
    mockClient.pollForEstimates.mockResolvedValue(mockEstimates);

    const { result } = renderHook(() => useRideSearch(mockClient));

    // Set searchId first
    await act(async () => {
      await result.current.startSearch({
        originLat: 12.93,
        originLon: 77.62,
        destinationLat: 12.97,
        destinationLon: 77.59,
      });
    });

    await act(async () => {
      const estimates = await result.current.pollForEstimates();
      expect(estimates).toEqual(mockEstimates);
    });
  });

  it('should handle search errors', async () => {
    mockClient.searchRides.mockRejectedValue(new Error('Search failed'));

    const { result } = renderHook(() => useRideSearch(mockClient));

    await act(async () => {
      await result.current.search({
        originLat: 12.93,
        originLon: 77.62,
        destinationLat: 12.97,
        destinationLon: 77.59,
      });
    });

    expect(result.current.error).toBe('Search failed');
  });

  it('should clear search state', async () => {
    mockClient.searchRides.mockResolvedValue({
      searchId: 'search-123',
      estimates: [{ id: 'est-1' }],
      fromLocation: { lat: 12.93, lon: 77.62 },
      toLocation: { lat: 12.97, lon: 77.59 },
    });

    const { result } = renderHook(() => useRideSearch(mockClient));

    await act(async () => {
      await result.current.search({
        originLat: 12.93,
        originLon: 77.62,
        destinationLat: 12.97,
        destinationLon: 77.59,
      });
    });

    expect(result.current.searchId).toBe('search-123');

    act(() => {
      result.current.clear();
    });

    expect(result.current.searchId).toBeNull();
    expect(result.current.estimates).toEqual([]);
  });
});

// ===========================================================================
// useBooking Tests
// ===========================================================================

describe('useBooking', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      selectEstimate: jest.fn(),
      selectEstimateAndWait: jest.fn(),
      addTip: jest.fn(),
      cancelSearch: jest.fn(),
      pollForDriverAssignment: jest.fn(),
    };
  });

  it('should select estimate and wait for driver', async () => {
    const mockRide = { id: 'ride-1', status: 'TRIP_ASSIGNED' };
    mockClient.selectEstimateAndWait.mockResolvedValue(mockRide);

    const { result } = renderHook(() => useBooking(mockClient));

    await act(async () => {
      const ride = await result.current.selectEstimateAndWait({
        estimateId: 'est-1',
      });
      expect(ride).toEqual(mockRide);
    });

    expect(result.current.ride).toEqual(mockRide);
  });

  it('should add tip', async () => {
    mockClient.addTip.mockResolvedValue(undefined);

    const { result } = renderHook(() => useBooking(mockClient));

    await act(async () => {
      const success = await result.current.addTip({
        estimateId: 'est-1',
        tipAmount: 20,
      });
      expect(success).toBe(true);
    });
  });

  it('should cancel search', async () => {
    mockClient.cancelSearch.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useBooking(mockClient));

    await act(async () => {
      const success = await result.current.cancelSearch('est-1');
      expect(success).toBe(true);
    });
  });

  it('should handle booking errors', async () => {
    mockClient.selectEstimateAndWait.mockRejectedValue(new Error('Booking failed'));

    const { result } = renderHook(() => useBooking(mockClient));

    await act(async () => {
      await result.current.selectEstimateAndWait({ estimateId: 'est-1' });
    });

    expect(result.current.error).toBe('Booking failed');
  });
});

// ===========================================================================
// useRideStatus Tests
// ===========================================================================

describe('useRideStatus', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      getRideStatus: jest.fn(),
      pollForDriverAssignment: jest.fn(),
    };
  });

  it('should fetch ride status', async () => {
    const mockRides = [{ id: 'ride-1', status: 'TRIP_ASSIGNED' }];
    mockClient.getRideStatus.mockResolvedValue(mockRides);

    const { result } = renderHook(() => useRideStatus(mockClient));

    await act(async () => {
      const rides = await result.current.fetchStatus();
      expect(rides).toEqual(mockRides);
    });

    expect(result.current.rides).toEqual(mockRides);
  });

  it('should poll for driver', async () => {
    const mockRide = { id: 'ride-1', status: 'DRIVER_ASSIGNED' };
    mockClient.pollForDriverAssignment.mockResolvedValue(mockRide);

    const { result } = renderHook(() => useRideStatus(mockClient));

    await act(async () => {
      const ride = await result.current.pollForDriver(5, 100);
      expect(ride).toEqual(mockRide);
    });
  });

  it('should clear status', async () => {
    mockClient.getRideStatus.mockResolvedValue([{ id: 'ride-1' }]);

    const { result } = renderHook(() => useRideStatus(mockClient));

    await act(async () => {
      await result.current.fetchStatus();
    });

    expect(result.current.rides).toHaveLength(1);

    act(() => {
      result.current.clear();
    });

    expect(result.current.rides).toEqual([]);
  });
});

// ===========================================================================
// useSavedLocations Tests
// ===========================================================================

describe('useSavedLocations', () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      getSavedLocations: jest.fn(),
    };
  });

  it('should load locations from local storage when no client', async () => {
    (tokenStorage.getSavedLocations as jest.Mock).mockResolvedValue([
      { tag: 'Home', lat: 12.97, lon: 77.59 },
    ]);
    (tokenStorage.needsLocationRefresh as jest.Mock).mockResolvedValue(false);

    const { result } = renderHook(() => useSavedLocations(null));

    await waitFor(() => {
      expect(result.current.locations).toHaveLength(1);
    });
  });

  it('should fetch locations from API', async () => {
    const mockLocations = [
      { tag: 'Home', lat: 12.97, lon: 77.59 },
      { tag: 'Work', lat: 12.93, lon: 77.62 },
    ];

    mockClient.getSavedLocations.mockResolvedValue(mockLocations);
    (tokenStorage.updateSavedLocations as jest.Mock).mockResolvedValue(undefined);
    (tokenStorage.getSavedLocations as jest.Mock).mockResolvedValue([]);
    (tokenStorage.needsLocationRefresh as jest.Mock).mockResolvedValue(true);

    const { result } = renderHook(() => useSavedLocations(mockClient));

    await waitFor(() => {
      expect(result.current.locations).toHaveLength(2);
    });
  });

  it('should fall back to local cache on API error', async () => {
    const cachedLocations = [{ tag: 'Cached', lat: 12.90, lon: 77.50 }];

    mockClient.getSavedLocations.mockRejectedValue(new Error('API error'));
    (tokenStorage.getSavedLocations as jest.Mock).mockResolvedValue(cachedLocations);
    (tokenStorage.needsLocationRefresh as jest.Mock).mockResolvedValue(true);

    const { result } = renderHook(() => useSavedLocations(mockClient));

    await waitFor(() => {
      expect(result.current.locations).toEqual(cachedLocations);
    });
  });
});