/**
 * Tests for API Types
 * 
 * Tests cover:
 * - Type guards and validation
 * - NammaYatriApiError class
 * - Type exports
 */

import { NammaYatriApiError } from '../types.js';

describe('NammaYatriApiError', () => {
  describe('constructor', () => {
    it('should create error with required properties', () => {
      const error = new NammaYatriApiError(404, 'Not found');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NammaYatriApiError);
      expect(error.name).toBe('NammaYatriApiError');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not found');
      expect(error.details).toBeUndefined();
    });

    it('should create error with details', () => {
      const details = { field: 'mobile', reason: 'invalid format' };
      const error = new NammaYatriApiError(400, 'Validation failed', details);
      
      expect(error.details).toEqual(details);
    });

    it('should set isAuthError to true for 401', () => {
      const error = new NammaYatriApiError(401, 'Unauthorized');
      expect(error.isAuthError).toBe(true);
    });

    it('should set isAuthError to false for non-401 errors', () => {
      const testCases = [200, 400, 403, 404, 500, 502, 503];
      
      testCases.forEach(statusCode => {
        const error = new NammaYatriApiError(statusCode, 'Error');
        expect(error.isAuthError).toBe(false);
      });
    });
  });

  describe('error behavior', () => {
    it('should be throwable', () => {
      expect(() => {
        throw new NammaYatriApiError(500, 'Server error');
      }).toThrow(NammaYatriApiError);
    });

    it('should be catchable as Error', () => {
      try {
        throw new NammaYatriApiError(500, 'Server error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Server error');
      }
    });

    it('should preserve stack trace', () => {
      const error = new NammaYatriApiError(500, 'Server error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('NammaYatriApiError');
    });
  });
});

describe('Type exports', () => {
  it('should export Currency type', () => {
    const currency = { amount: 100, currency: 'INR' };
    expect(currency.amount).toBe(100);
    expect(currency.currency).toBe('INR');
  });

  it('should export Location type', () => {
    const location = { lat: 12.97, lon: 77.59 };
    expect(location.lat).toBe(12.97);
    expect(location.lon).toBe(77.59);
  });

  it('should export Address type', () => {
    const address = {
      area: 'Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
    };
    expect(address.area).toBe('Koramangala');
    expect(address.city).toBe('Bangalore');
  });

  it('should export AuthConfig type', () => {
    const authConfig = {
      country: 'IN',
      mobileNumber: '9876543210',
      accessCode: 'secret',
    };
    expect(authConfig.country).toBe('IN');
    expect(authConfig.mobileNumber).toBe('9876543210');
  });

  it('should export Place type', () => {
    const place = {
      description: 'Koramangala, Bangalore',
      placeId: 'place-123',
      distance: 5000,
    };
    expect(place.description).toBe('Koramangala, Bangalore');
    expect(place.placeId).toBe('place-123');
  });

  it('should export PlaceDetails type', () => {
    const placeDetails = {
      lat: 12.97,
      lon: 77.59,
      placeId: 'place-123',
      address: { city: 'Bangalore' },
    };
    expect(placeDetails.lat).toBe(12.97);
    expect(placeDetails.placeId).toBe('place-123');
  });

  it('should export Estimate type', () => {
    const estimate = {
      id: 'estimate-1',
      estimatedFare: 100,
      estimatedTotalFare: 120,
      currency: 'INR',
      vehicleVariant: 'AUTO_RICKSHAW',
      serviceTierName: 'Namma Yatri',
      providerName: 'Namma Yatri',
      providerId: 'provider-1',
    };
    expect(estimate.id).toBe('estimate-1');
    expect(estimate.vehicleVariant).toBe('AUTO_RICKSHAW');
  });

  it('should export RideStatus type', () => {
    const rideStatus = {
      id: 'ride-1',
      status: 'TRIP_ASSIGNED',
      createdAt: '2024-01-01T00:00:00Z',
      driverName: 'John',
      vehicleNumber: 'KA01AB1234',
    };
    expect(rideStatus.id).toBe('ride-1');
    expect(rideStatus.status).toBe('TRIP_ASSIGNED');
  });

  it('should export SavedLocation type', () => {
    const savedLocation = {
      tag: 'Home',
      lat: 12.97,
      lon: 77.59,
      locationName: 'My Home',
    };
    expect(savedLocation.tag).toBe('Home');
    expect(savedLocation.lat).toBe(12.97);
  });

  it('should export RideSearchParams type', () => {
    const params = {
      originLat: 12.97,
      originLon: 77.59,
      destinationLat: 12.93,
      destinationLon: 77.62,
    };
    expect(params.originLat).toBe(12.97);
    expect(params.destinationLat).toBe(12.93);
  });

  it('should export SelectEstimateParams type', () => {
    const params = {
      estimateId: 'estimate-1',
      additionalEstimateIds: ['estimate-2'],
      isPetRide: false,
      specialAssistance: false,
    };
    expect(params.estimateId).toBe('estimate-1');
    expect(params.additionalEstimateIds).toHaveLength(1);
  });

  it('should export ApiClientConfig type', () => {
    const config = {
      baseUrl: 'https://api.example.com',
      timeout: 30000,
      clientId: 'TEST_CLIENT',
    };
    expect(config.baseUrl).toBe('https://api.example.com');
    expect(config.timeout).toBe(30000);
  });
});