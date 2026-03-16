/**
 * Unit tests for NammaYatriClient
 * Tests all API methods with mocked fetch calls
 */

import { jest } from '@jest/globals';
import {
  NammaYatriClient,
  APIError,
  createAddressFromCoordinates,
  parseCoordinates,
} from './client.js';

// Mock fetch globally
const mockFetch = jest.fn<() => Promise<Response>>();
global.fetch = mockFetch as unknown as typeof fetch;

// Helper to safely get mock call arguments
function getMockCallArgs(index: number): [string, RequestInit | undefined] {
  const call = mockFetch.mock.calls[index];
  if (!call) throw new Error(`No mock call at index ${index}`);
  return call as unknown as [string, RequestInit | undefined];
}

describe('NammaYatriClient', () => {
  const mockToken = 'test-token-123';
  const API_BASE_URL = 'https://api.moving.tech/pilot/app/v2';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a client with the provided token', () => {
      const client = new NammaYatriClient(mockToken);
      expect(client).toBeInstanceOf(NammaYatriClient);
    });
  });

  describe('static authenticate', () => {
    it('should authenticate successfully and return auth response', async () => {
      const mockResponse = {
        authId: 'auth-123',
        attempts: 1,
        authType: 'OTP',
        token: 'new-token-456',
        person: {
          id: 'person-123',
          firstName: 'Test',
          lastName: 'User',
        },
        isPersonBlocked: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockResponse,
      } as Response);

      const result = await NammaYatriClient.authenticate(
        '+919876543210',
        'test-access-code'
      );

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/auth/get-token`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appSecretCode: 'test-access-code',
            userMobileNo: '+919876543210',
          }),
        })
      );
    });

    it('should throw APIError on 401 authentication failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid credentials',
      } as Response);

      await expect(
        NammaYatriClient.authenticate('+919876543210', 'wrong-code')
      ).rejects.toThrow(APIError);

      await expect(
        NammaYatriClient.authenticate('+919876543210', 'wrong-code')
      ).rejects.toThrow('Authentication failed (401)');
    });

    it('should throw APIError on 500 server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error occurred',
      } as Response);

      await expect(
        NammaYatriClient.authenticate('+919876543210', 'test-code')
      ).rejects.toThrow(APIError);
    });
  });

  describe('getSavedLocations', () => {
    it('should fetch saved locations successfully', async () => {
      const client = new NammaYatriClient(mockToken);
      const mockLocations = [
        {
          tag: 'home',
          lat: 12.9716,
          lon: 77.5946,
          area: 'MG Road',
          city: 'Bangalore',
        },
        {
          tag: 'work',
          lat: 12.9352,
          lon: 77.6245,
          area: 'Koramangala',
          city: 'Bangalore',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ list: mockLocations }),
      } as Response);

      const result = await client.getSavedLocations();

      expect(result).toEqual(mockLocations);
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/savedLocation/list`,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            token: mockToken,
          },
        })
      );
    });

    it('should return empty array when no locations exist', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ list: [] }),
      } as Response);

      const result = await client.getSavedLocations();

      expect(result).toEqual([]);
    });

    it('should throw APIError on 401 unauthorized', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Token expired',
      } as Response);

      await expect(client.getSavedLocations()).rejects.toThrow(APIError);
      await expect(client.getSavedLocations()).rejects.toThrow(
        'Authentication failed (401)'
      );
    });
  });

  describe('searchPlaces', () => {
    it('should search places successfully', async () => {
      const client = new NammaYatriClient(mockToken);
      const mockPredictions = {
        predictions: [
          {
            description: 'Koramangala, Bangalore',
            placeId: 'place-123',
            distanceWithUnit: { value: 2.5, unit: 'km' },
          },
          {
            description: 'Indiranagar, Bangalore',
            placeId: 'place-456',
            distance: 5.0,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockPredictions,
      } as Response);

      const result = await client.searchPlaces('koramangala');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        description: 'Koramangala, Bangalore',
        placeId: 'place-123',
        distance: 2.5,
      });
    });

    it('should search with source coordinates', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ predictions: [] }),
      } as Response);

      await client.searchPlaces('mall', 12.9716, 77.5946);

      const callArgs = getMockCallArgs(0);
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody.origin).toEqual({ lat: 12.9716, lon: 77.5946 });
    });

    it('should throw APIError on 404 not found', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Endpoint not found',
      } as Response);

      await expect(client.searchPlaces('unknown')).rejects.toThrow(APIError);
    });
  });

  describe('getPlaceDetails', () => {
    it('should get place details by placeId', async () => {
      const client = new NammaYatriClient(mockToken);
      const mockDetails = {
        lat: 12.9352,
        lon: 77.6245,
        placeId: 'place-123',
        address: {
          area: 'Koramangala',
          city: 'Bangalore',
          country: 'India',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockDetails,
      } as Response);

      const result = await client.getPlaceDetails('place-123');

      expect(result).toEqual(mockDetails);
    });
  });

  describe('getPlaceDetailsByCoordinates', () => {
    it('should get place details by coordinates', async () => {
      const client = new NammaYatriClient(mockToken);
      const mockDetails = {
        lat: 12.9352,
        lon: 77.6245,
        placeId: 'latlon-123',
        address: {
          area: 'Koramangala',
          city: 'Bangalore',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockDetails,
      } as Response);

      const result = await client.getPlaceDetailsByCoordinates(12.9352, 77.6245);

      expect(result).toEqual(mockDetails);

      const callArgs = getMockCallArgs(0);
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody.getBy.tag).toBe('ByLatLong');
      expect(requestBody.getBy.contents).toEqual({ lat: 12.9352, lon: 77.6245 });
    });
  });

  describe('searchRide', () => {
    it('should initiate ride search and return searchId', async () => {
      const client = new NammaYatriClient(mockToken);
      const origin = {
        gps: { lat: 12.9716, lon: 77.5946 },
        address: { area: 'MG Road', city: 'Bangalore' },
      };
      const destination = {
        gps: { lat: 12.9352, lon: 77.6245 },
        address: { area: 'Koramangala', city: 'Bangalore' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ searchId: 'search-123' }),
      } as Response);

      const result = await client.searchRide(origin, destination);

      expect(result).toBe('search-123');
    });

    it('should throw APIError on 500 server error', async () => {
      const client = new NammaYatriClient(mockToken);
      const origin = {
        gps: { lat: 12.9716, lon: 77.5946 },
        address: { area: 'MG Road', city: 'Bangalore' },
      };
      const destination = {
        gps: { lat: 12.9352, lon: 77.6245 },
        address: { area: 'Koramangala', city: 'Bangalore' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => JSON.stringify({ error: 'Service unavailable' }),
      } as Response);

      await expect(client.searchRide(origin, destination)).rejects.toThrow(
        APIError
      );
    });
  });

  describe('getEstimates', () => {
    it('should fetch ride estimates', async () => {
      const client = new NammaYatriClient(mockToken);
      const mockEstimates = {
        estimates: [
          {
            id: 'est-1',
            estimatedFare: 150,
            estimatedFareWithCurrency: { amount: 150, currency: 'INR' },
            estimatedTotalFare: 165,
            estimatedTotalFareWithCurrency: { amount: 165, currency: 'INR' },
            estimatedPickupDuration: 300,
            vehicleVariant: 'AUTO_RICKSHAW',
            serviceTierType: 'Auto',
            serviceTierName: 'Auto',
            providerName: 'Namma Yatri',
            providerId: 'ny-1',
            validTill: new Date().toISOString(),
          },
        ],
        fromLocation: { lat: 12.9716, lon: 77.5946, area: 'MG Road' },
        toLocation: { lat: 12.9352, lon: 77.6245, area: 'Koramangala' },
        allJourneysLoaded: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockEstimates,
      } as Response);

      const result = await client.getEstimates('search-123');

      expect(result).toHaveLength(1);
      expect(result[0].vehicleVariant).toBe('AUTO_RICKSHAW');
    });
  });

  describe('pollForEstimates', () => {
    it('should return estimates when found', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          estimates: [
            {
              id: 'est-1',
              estimatedFare: 150,
              estimatedFareWithCurrency: { amount: 150, currency: 'INR' },
              estimatedTotalFare: 165,
              estimatedTotalFareWithCurrency: { amount: 165, currency: 'INR' },
              estimatedPickupDuration: 300,
              vehicleVariant: 'AUTO_RICKSHAW',
              serviceTierType: 'Auto',
              serviceTierName: 'Auto',
              providerName: 'Namma Yatri',
              providerId: 'ny-1',
              validTill: new Date().toISOString(),
            },
          ],
          fromLocation: { lat: 12.9716, lon: 77.5946 },
          toLocation: { lat: 12.9352, lon: 77.6245 },
          allJourneysLoaded: true,
        }),
      } as Response);

      const result = await client.pollForEstimates('search-123', 10000);

      expect(result).toHaveLength(1);
    });

    it('should throw error on polling timeout', async () => {
      const client = new NammaYatriClient(mockToken);

      // Always return empty estimates
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ estimates: [] }),
      } as Response);

      await expect(
        client.pollForEstimates('search-123', 100)
      ).rejects.toThrow('Polling timeout');
    });
  });

  describe('selectEstimate', () => {
    it('should select estimate successfully', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({}),
      } as Response);

      await client.selectEstimate('est-123');

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/estimate/est-123/select2`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('autoAssignEnabled'),
        })
      );
    });

    it('should select estimate with additional options', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({}),
      } as Response);

      await client.selectEstimate('est-123', {
        additionalEstimateIds: ['est-456'],
        specialAssistance: true,
        isPetRide: true,
      });

      const callArgs = getMockCallArgs(0);
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody.otherSelectedEstimates).toEqual(['est-456']);
      expect(requestBody.disabilityDisable).toBe(false);
      expect(requestBody.isPetRide).toBe(true);
    });
  });

  describe('addTip', () => {
    it('should add tip to estimate', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({}),
      } as Response);

      await client.addTip('est-123', 20, 'INR');

      const callArgs = getMockCallArgs(0);
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody.customerExtraFee).toBe(20);
      expect(requestBody.customerExtraFeeWithCurrency).toEqual({
        amount: 20,
        currency: 'INR',
      });
    });
  });

  describe('cancelSearch', () => {
    it('should cancel search successfully', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({}),
      } as Response);

      await client.cancelSearch('est-123');

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/estimate/est-123/cancelSearch`,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('getActiveBookings', () => {
    it('should fetch active bookings', async () => {
      const client = new NammaYatriClient(mockToken);
      const mockBookings = {
        list: [
          {
            id: 'booking-123',
            status: 'CONFIRMED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            fromLocation: {
              lat: 12.9716,
              lon: 77.5946,
              area: 'MG Road',
            },
            estimatedFare: 150,
            driverName: 'Ramesh',
            vehicleNumber: 'KA01AB1234',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockBookings,
      } as Response);

      const result = await client.getActiveBookings();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('CONFIRMED');
    });

    it('should support pagination options', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ list: [] }),
      } as Response);

      await client.getActiveBookings({
        limit: 10,
        offset: 20,
        onlyActive: false,
        status: ['COMPLETED'],
      });

      const callArgs = getMockCallArgs(0);
      const callUrl = callArgs[0];
      expect(callUrl).toContain('limit=10');
      expect(callUrl).toContain('offset=20');
      expect(callUrl).toContain('onlyActive=false');
      expect(callUrl).toContain('status=');
    });
  });

  describe('pollForDriverAssignment', () => {
    it('should return booking when driver is assigned', async () => {
      const client = new NammaYatriClient(mockToken);
      const mockBooking = {
        id: 'booking-123',
        status: 'DRIVER_ASSIGNED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fromLocation: { lat: 12.9716, lon: 77.5946 },
        estimatedFare: 150,
        driverName: 'Ramesh',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ list: [mockBooking] }),
      } as Response);

      const result = await client.pollForDriverAssignment(5000);

      expect(result).toEqual(mockBooking);
    });

    it('should throw error on timeout', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ list: [] }),
      } as Response);

      await expect(
        client.pollForDriverAssignment(100)
      ).rejects.toThrow('No driver assigned yet');
    });
  });

  describe('getBookingDetails', () => {
    it('should fetch booking details', async () => {
      const client = new NammaYatriClient(mockToken);
      const mockDetails = {
        id: 'booking-123',
        bookingStatus: 'CONFIRMED',
        isBookingUpdated: false,
        rideStatus: 'IN_PROGRESS',
        talkedWithDriver: false,
        stopInfo: [],
        isSafetyPlus: false,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockDetails,
      } as Response);

      const result = await client.getBookingDetails('booking-123');

      expect(result.id).toBe('booking-123');
      expect(result.bookingStatus).toBe('CONFIRMED');
    });
  });

  describe('getRideStatus', () => {
    it('should fetch ride status', async () => {
      const client = new NammaYatriClient(mockToken);
      const mockStatus = {
        ride: {
          id: 'ride-123',
          status: 'IN_PROGRESS',
          rideOtp: '1234',
          shortRideId: 'R123',
          driverName: 'Ramesh',
          driverNumber: '+919876543210',
          vehicleNumber: 'KA01AB1234',
          vehicleVariant: 'AUTO_RICKSHAW',
          vehicleModel: 'Auto',
          vehicleColor: 'Yellow',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          onlinePayment: false,
          feedbackSkipped: false,
          isPetRide: false,
          isSafetyPlus: false,
          paymentStatus: 'PENDING',
          talkedWithDriver: false,
          stopsInfo: [],
          billingCategory: 'NORMAL',
        },
        fromLocation: { lat: 12.9716, lon: 77.5946 },
        toLocation: { lat: 12.9352, lon: 77.6245 },
        customer: { id: 'cust-123' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockStatus,
      } as Response);

      const result = await client.getRideStatus('ride-123');

      expect(result.ride.id).toBe('ride-123');
      expect(result.ride.driverName).toBe('Ramesh');
    });
  });

  describe('getCancellationReasons', () => {
    it('should fetch cancellation reasons', async () => {
      const client = new NammaYatriClient(mockToken);
      const mockReasons = [
        { reasonCode: 'CHANGE_PLAN', description: 'Change of plans' },
        { reasonCode: 'DRIVER_LATE', description: 'Driver is late' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockReasons,
      } as Response);

      const result = await client.getCancellationReasons('OnSearch');

      expect(result).toHaveLength(2);
      expect(result[0].reasonCode).toBe('CHANGE_PLAN');
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking successfully', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({}),
      } as Response);

      await client.cancelBooking('booking-123', 'CHANGE_PLAN', 'OnSearch');

      const callArgs = getMockCallArgs(0);
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody.reasonCode).toBe('CHANGE_PLAN');
      expect(requestBody.reasonStage).toBe('OnSearch');
    });

    it('should cancel with additional info and reallocate', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({}),
      } as Response);

      await client.cancelBooking(
        'booking-123',
        'OTHER',
        'OnConfirm',
        'Other reason',
        true
      );

      const callArgs = getMockCallArgs(0);
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody.additionalInfo).toBe('Other reason');
      expect(requestBody.reallocate).toBe(true);
    });
  });

  describe('postRideTip', () => {
    it('should add tip after ride', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({}),
      } as Response);

      await client.postRideTip('ride-123', 50, 'INR');

      const callArgs = getMockCallArgs(0);
      const requestBody = JSON.parse(callArgs[1]?.body as string);

      expect(requestBody.amount).toEqual({ amount: 50, currency: 'INR' });
    });
  });

  describe('getPriceBreakdown', () => {
    it('should fetch price breakdown', async () => {
      const client = new NammaYatriClient(mockToken);
      const mockBreakdown = {
        quoteBreakup: [
          { title: 'Base Fare', priceWithCurrency: { amount: 50, currency: 'INR' } },
          { title: 'Distance Charge', priceWithCurrency: { amount: 100, currency: 'INR' } },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => mockBreakdown,
      } as Response);

      const result = await client.getPriceBreakdown('booking-123');

      expect(result.quoteBreakup).toHaveLength(2);
      expect(result.quoteBreakup[0].title).toBe('Base Fare');
    });
  });

  describe('APIError', () => {
    it('should create APIError with all properties', () => {
      const error = new APIError(
        'Test error',
        401,
        'Unauthorized',
        true
      );

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(401);
      expect(error.responseBody).toBe('Unauthorized');
      expect(error.isAuthError).toBe(true);
      expect(error.name).toBe('APIError');
    });

    it('should handle JSON error responses', async () => {
      const client = new NammaYatriClient(mockToken);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({ error: 'Invalid input', code: 'E001' }),
      } as Response);

      try {
        await client.getSavedLocations();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        const apiError = error as APIError;
        expect(apiError.message).toContain('Invalid input');
        expect(apiError.statusCode).toBe(400);
      }
    });
  });
});

describe('Utility Functions', () => {
  describe('createAddressFromCoordinates', () => {
    it('should create address from coordinates', () => {
      const result = createAddressFromCoordinates(12.9716, 77.5946);

      expect(result.area).toBe('12.971600,77.594600');
      expect(result.placeId).toBe('12.9716,77.5946');
      expect(result.city).toBe('');
      expect(result.country).toBe('');
    });
  });

  describe('parseCoordinates', () => {
    it('should parse coordinate string', () => {
      const result = parseCoordinates('12.9716,77.5946');

      expect(result.lat).toBe(12.9716);
      expect(result.lon).toBe(77.5946);
    });

    it('should parse separate lat and lon numbers', () => {
      const result = parseCoordinates(12.9716, 77.5946);

      expect(result.lat).toBe(12.9716);
      expect(result.lon).toBe(77.5946);
    });

    it('should parse string lat with number lon', () => {
      const result = parseCoordinates('12.9716', 77.5946);

      expect(result.lat).toBe(12.9716);
      expect(result.lon).toBe(77.5946);
    });

    it('should throw error for invalid format', () => {
      expect(() => parseCoordinates('invalid')).toThrow(
        'Invalid coordinate format'
      );
    });

    it('should throw error for non-numeric values', () => {
      expect(() => parseCoordinates('abc,def')).toThrow(
        'Invalid coordinate values'
      );
    });

    it('should throw error when lon is missing for number lat', () => {
      expect(() => parseCoordinates(12.9716)).toThrow(
        'originLon/destinationLon is required'
      );
    });
  });
});
