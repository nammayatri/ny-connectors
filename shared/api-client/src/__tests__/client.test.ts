/**
 * Tests for NyApiClient
 * 
 * Tests cover:
 * - Client initialization and configuration
 * - Authentication flow
 * - Places API (search, details)
 * - Ride search and polling
 * - Estimate selection and booking
 * - Status tracking
 * - Error handling
 */

import { NyApiClient, NammaYatriApiError } from '../index.js';
import type {
  AuthResult,
  Place,
  PlaceDetails,
  RideSearchResult,
  Estimate,
  RideStatus,
  SavedLocation,
} from '../types.js';

// Mock axios
jest.mock('axios', () => {
  const mockAxiosInstance = {
    request: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    create: jest.fn(() => mockAxiosInstance),
  };
  return {
    ...mockAxiosInstance,
    default: mockAxiosInstance,
    AxiosError: class AxiosError extends Error {
      response?: { status: number; data: unknown };
      constructor(message: string, response?: { status: number; data: unknown }) {
        super(message);
        this.response = response;
      }
    },
  };
});

// Mock fetch for authenticate
global.fetch = jest.fn();

describe('NyApiClient', () => {
  let client: NyApiClient;
  const mockToken = 'test-token-12345';

  beforeEach(() => {
    jest.clearAllMocks();
    client = new NyApiClient(mockToken);
  });

  // ===========================================================================
  // Constructor and Configuration Tests
  // ===========================================================================

  describe('constructor', () => {
    it('should create client with token', () => {
      const c = new NyApiClient('my-token');
      expect(c.getToken()).toBe('my-token');
    });

    it('should create client without token', () => {
      const c = new NyApiClient();
      expect(c.getToken()).toBeNull();
    });

    it('should accept custom configuration', () => {
      const c = new NyApiClient('token', {
        baseUrl: 'https://custom.api.com',
        timeout: 5000,
        clientId: 'CUSTOM_CLIENT',
      });
      expect(c.getToken()).toBe('token');
    });

    it('should use environment variable for base URL', () => {
      process.env.NY_API_BASE = 'https://env.api.com';
      const c = new NyApiClient();
      // Client should be created successfully
      expect(c).toBeDefined();
      delete process.env.NY_API_BASE;
    });
  });

  describe('setToken', () => {
    it('should update the token', () => {
      const c = new NyApiClient();
      expect(c.getToken()).toBeNull();
      c.setToken('new-token');
      expect(c.getToken()).toBe('new-token');
    });
  });

  // ===========================================================================
  // Authentication Tests
  // ===========================================================================

  describe('authenticate', () => {
    it('should authenticate successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ token: 'auth-token-123' }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      // Mock getSavedLocations
      const mockGetSavedLocations = jest
        .spyOn(NyApiClient.prototype, 'getSavedLocations')
        .mockResolvedValue([]);

      const result = await NyApiClient.authenticate({
        country: 'IN',
        mobileNumber: '9876543210',
        accessCode: 'secret-code',
      });

      expect(result.authenticated).toBe(true);
      expect(result.token).toBe('auth-token-123');
      mockGetSavedLocations.mockRestore();
    });

    it('should handle authentication failure', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: async () => ({ errorMessage: 'Invalid access code' }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(
        NyApiClient.authenticate({
          country: 'IN',
          mobileNumber: '9876543210',
          accessCode: 'wrong-code',
        })
      ).rejects.toThrow(NammaYatriApiError);
    });

    it('should handle network errors during authentication', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        NyApiClient.authenticate({
          country: 'IN',
          mobileNumber: '9876543210',
          accessCode: 'secret-code',
        })
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // Places API Tests
  // ===========================================================================

  describe('searchPlaces', () => {
    it('should throw error when not authenticated', async () => {
      const unauthenticatedClient = new NyApiClient();
      await expect(
        unauthenticatedClient.searchPlaces({ searchText: 'Koramangala' })
      ).rejects.toThrow('Authentication required');
    });

    it('should search for places successfully', async () => {
      const mockPredictions = [
        { description: 'Koramangala, Bangalore', placeId: 'place-1', distanceWithUnit: { value: 5000, unit: 'Meter' } },
        { description: 'Koramangala 4th Block', placeId: 'place-2' },
      ];

      const axios = require('axios');
      axios.create().request.mockResolvedValue({
        data: { predictions: mockPredictions },
      });

      const result = await client.searchPlaces({ searchText: 'Koramangala' });

      expect(result).toHaveLength(2);
      expect(result[0].description).toBe('Koramangala, Bangalore');
      expect(result[0].placeId).toBe('place-1');
    });

    it('should include source location in search', async () => {
      const axios = require('axios');
      axios.create().request.mockResolvedValue({
        data: { predictions: [] },
      });

      await client.searchPlaces({
        searchText: 'test',
        sourceLat: 12.97,
        sourceLon: 77.59,
      });

      expect(axios.create().request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            origin: { lat: 12.97, lon: 77.59 },
          }),
        })
      );
    });

    it('should handle empty results', async () => {
      const axios = require('axios');
      axios.create().request.mockResolvedValue({
        data: { predictions: null },
      });

      const result = await client.searchPlaces({ searchText: 'nonexistent' });
      expect(result).toEqual([]);
    });
  });

  describe('getPlaceDetails', () => {
    it('should get place details by placeId', async () => {
      const mockDetails: PlaceDetails = {
        lat: 12.9352,
        lon: 77.6245,
        placeId: 'place-123',
        address: { area: 'Koramangala', city: 'Bangalore' },
      };

      const axios = require('axios');
      axios.create().request.mockResolvedValue({ data: mockDetails });

      const result = await client.getPlaceDetails('place-123');

      expect(result.lat).toBe(12.9352);
      expect(result.lon).toBe(77.6245);
      expect(result.placeId).toBe('place-123');
    });

    it('should get place details by coordinates', async () => {
      const mockDetails: PlaceDetails = {
        lat: 12.9352,
        lon: 77.6245,
        placeId: 'coords-place',
        address: { area: 'Koramangala' },
      };

      const axios = require('axios');
      axios.create().request.mockResolvedValue({ data: mockDetails });

      const result = await client.getPlaceDetails(12.9352, 77.6245);

      expect(result.lat).toBe(12.9352);
      expect(result.lon).toBe(77.6245);
    });
  });

  // ===========================================================================
  // Ride Search Tests
  // ===========================================================================

  describe('searchRides', () => {
    it('should search for rides and return estimates', async () => {
      const mockSearchResponse = { searchId: 'search-123' };
      const mockResultsResponse = {
        estimates: [
          {
            id: 'estimate-1',
            estimatedFare: 100,
            estimatedTotalFare: 120,
            estimatedFareWithCurrency: { amount: 100, currency: 'INR' },
            vehicleVariant: 'AUTO_RICKSHAW',
            serviceTierName: 'Namma Yatri',
            providerName: 'Namma Yatri',
            providerId: 'provider-1',
          },
        ],
        fromLocation: { lat: 12.93, lon: 77.62 },
        toLocation: { lat: 12.97, lon: 77.59 },
      };

      const axios = require('axios');
      axios.create().request
        .mockResolvedValueOnce({ data: mockSearchResponse })
        .mockResolvedValueOnce({ data: mockResultsResponse });

      const result = await client.searchRides({
        originLat: 12.93,
        originLon: 77.62,
        destinationLat: 12.97,
        destinationLon: 77.59,
      });

      expect(result.searchId).toBe('search-123');
      expect(result.estimates).toHaveLength(1);
      expect(result.estimates[0].vehicleVariant).toBe('AUTO_RICKSHAW');
    });

    it('should accept string coordinates', async () => {
      const mockSearchResponse = { searchId: 'search-456' };
      const mockResultsResponse = {
        estimates: [],
        fromLocation: { lat: 12.93, lon: 77.62 },
        toLocation: { lat: 12.97, lon: 77.59 },
      };

      const axios = require('axios');
      axios.create().request
        .mockResolvedValueOnce({ data: mockSearchResponse })
        .mockResolvedValueOnce({ data: mockResultsResponse });

      const result = await client.searchRides({
        originLat: '12.93,77.62',
        destinationLat: '12.97,77.59',
      });

      expect(result.searchId).toBe('search-456');
    });

    it('should throw on invalid coordinates', async () => {
      await expect(
        client.searchRides({
          originLat: 'invalid',
          destinationLat: 12.97,
          destinationLon: 77.59,
        })
      ).rejects.toThrow();
    });
  });

  describe('startRideSearch', () => {
    it('should return search ID without polling', async () => {
      const axios = require('axios');
      axios.create().request.mockResolvedValue({
        data: { searchId: 'search-789' },
      });

      const searchId = await client.startRideSearch({
        originLat: 12.93,
        originLon: 77.62,
        destinationLat: 12.97,
        destinationLon: 77.59,
      });

      expect(searchId).toBe('search-789');
    });
  });

  describe('pollForEstimates', () => {
    it('should poll until estimates are available', async () => {
      const axios = require('axios');
      axios.create().request
        .mockResolvedValueOnce({ data: { estimates: [], fromLocation: {}, toLocation: {} } })
        .mockResolvedValueOnce({ data: { estimates: [], fromLocation: {}, toLocation: {} } })
        .mockResolvedValueOnce({
          data: {
            estimates: [{ id: 'est-1', estimatedFare: 100, estimatedTotalFare: 100, estimatedFareWithCurrency: { amount: 100, currency: 'INR' }, vehicleVariant: 'AUTO', serviceTierName: 'Test', providerName: 'Test', providerId: 'p1' }],
            fromLocation: {},
            toLocation: {},
          },
        });

      const estimates = await client.pollForEstimates('search-123', 5, 100);

      expect(estimates).toHaveLength(1);
    });

    it('should return empty array after max attempts', async () => {
      const axios = require('axios');
      axios.create().request.mockResolvedValue({
        data: { estimates: [], fromLocation: {}, toLocation: {} },
      });

      const estimates = await client.pollForEstimates('search-123', 3, 10);

      expect(estimates).toEqual([]);
    });
  });

  // ===========================================================================
  // Estimate Selection Tests
  // ===========================================================================

  describe('selectEstimate', () => {
    it('should select an estimate for booking', async () => {
      const axios = require('axios');
      axios.create().request.mockResolvedValue({ data: {} });

      await client.selectEstimate({ estimateId: 'estimate-123' });

      expect(axios.create().request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/estimate/estimate-123/select2',
        })
      );
    });

    it('should include additional estimates', async () => {
      const axios = require('axios');
      axios.create().request.mockResolvedValue({ data: {} });

      await client.selectEstimate({
        estimateId: 'estimate-1',
        additionalEstimateIds: ['estimate-2', 'estimate-3'],
      });

      expect(axios.create().request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            otherSelectedEstimates: ['estimate-2', 'estimate-3'],
          }),
        })
      );
    });

    it('should include pet ride and special assistance flags', async () => {
      const axios = require('axios');
      axios.create().request.mockResolvedValue({ data: {} });

      await client.selectEstimate({
        estimateId: 'estimate-1',
        isPetRide: true,
        specialAssistance: true,
      });

      expect(axios.create().request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isPetRide: true,
            disabilityDisable: false,
          }),
        })
      );
    });
  });

  describe('addTip', () => {
    it('should add tip to estimate', async () => {
      const axios = require('axios');
      axios.create().request.mockResolvedValue({ data: {} });

      await client.addTip({
        estimateId: 'estimate-1',
        tipAmount: 20,
        tipCurrency: 'INR',
      });

      expect(axios.create().request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerExtraFee: 20,
            customerExtraFeeWithCurrency: { amount: 20, currency: 'INR' },
          }),
        })
      );
    });
  });

  // ===========================================================================
  // Cancel Tests
  // ===========================================================================

  describe('cancelSearch', () => {
    it('should cancel a ride search', async () => {
      const axios = require('axios');
      axios.create().request.mockResolvedValue({ data: { success: true } });

      const result = await client.cancelSearch({ estimateId: 'estimate-1' });

      expect(result.success).toBe(true);
    });

    it('should handle cancel errors gracefully', async () => {
      const axios = require('axios');
      const { AxiosError } = require('axios');
      const error = new AxiosError('Cancel failed');
      error.response = { status: 400, data: { message: 'Cannot cancel' } };
      axios.create().request.mockRejectedValue(error);

      const result = await client.cancelSearch({ estimateId: 'estimate-1' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Cannot cancel');
    });
  });

  // ===========================================================================
  // Status Tests
  // ===========================================================================

  describe('getRideStatus', () => {
    it('should fetch ride status', async () => {
      const mockRides: RideStatus[] = [
        {
          id: 'ride-1',
          status: 'TRIP_ASSIGNED',
          createdAt: '2024-01-01T00:00:00Z',
          driverName: 'John',
          vehicleNumber: 'KA01AB1234',
        },
      ];

      const axios = require('axios');
      axios.create().request.mockResolvedValue({ data: { list: mockRides } });

      const result = await client.getRideStatus();

      expect(result).toHaveLength(1);
      expect(result[0].driverName).toBe('John');
    });

    it('should pass query parameters', async () => {
      const axios = require('axios');
      axios.create().request.mockResolvedValue({ data: { list: [] } });

      await client.getRideStatus({
        onlyActive: false,
        limit: 10,
        offset: 5,
      });

      expect(axios.create().request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: expect.stringContaining('onlyActive=false'),
        })
      );
    });
  });

  // ===========================================================================
  // Saved Locations Tests
  // ===========================================================================

  describe('getSavedLocations', () => {
    it('should fetch saved locations', async () => {
      const mockLocations: SavedLocation[] = [
        { tag: 'Home', lat: 12.93, lon: 77.62, locationName: 'My Home' },
        { tag: 'Work', lat: 12.97, lon: 77.59, locationName: 'Office' },
      ];

      const axios = require('axios');
      axios.create().request.mockResolvedValue({ data: { list: mockLocations } });

      const result = await client.getSavedLocations();

      expect(result).toHaveLength(2);
      expect(result[0].tag).toBe('Home');
    });

    it('should return empty array on null response', async () => {
      const axios = require('axios');
      axios.create().request.mockResolvedValue({ data: {} });

      const result = await client.getSavedLocations();

      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    it('should throw NammaYatriApiError on API errors', async () => {
      const axios = require('axios');
      const { AxiosError } = require('axios');
      const error = new AxiosError('Request failed');
      error.response = { status: 500, data: { errorMessage: 'Server error' } };
      axios.create().request.mockRejectedValue(error);

      await expect(client.searchPlaces({ searchText: 'test' })).rejects.toThrow(
        NammaYatriApiError
      );
    });

    it('should identify auth errors', () => {
      const authError = new NammaYatriApiError(401, 'Unauthorized');
      expect(authError.isAuthError).toBe(true);

      const otherError = new NammaYatriApiError(500, 'Server error');
      expect(otherError.isAuthError).toBe(false);
    });
  });
});

// ===========================================================================
// NammaYatriApiError Tests
// ===========================================================================

describe('NammaYatriApiError', () => {
  it('should create error with status code', () => {
    const error = new NammaYatriApiError(404, 'Not found');
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Not found');
    expect(error.name).toBe('NammaYatriApiError');
  });

  it('should store error details', () => {
    const details = { field: 'mobile', reason: 'invalid' };
    const error = new NammaYatriApiError(400, 'Validation error', details);
    expect(error.details).toEqual(details);
  });

  it('should identify auth errors', () => {
    const authError = new NammaYatriApiError(401, 'Unauthorized');
    expect(authError.isAuthError).toBe(true);

    const forbiddenError = new NammaYatriApiError(403, 'Forbidden');
    expect(forbiddenError.isAuthError).toBe(false);
  });
});