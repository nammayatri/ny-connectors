import axios, { AxiosInstance } from 'axios';

const API_BASE = process.env.NY_API_BASE || 'https://api.moving.tech/pilot/app/v2';
const CLIENT_ID = 'ACP_CLI';

export interface Place {
  description: string;
  placeId: string;
  distanceWithUnit?: {
    value: number;
    unit: string;
  };
}

export interface PlaceDetails {
  lat: number;
  lon: number;
  placeId: string;
  address: {
    area?: string;
    city?: string;
    state?: string;
    country?: string;
    building?: string;
    street?: string;
    door?: string;
    ward?: string;
    areaCode?: string;
    placeId?: string;
  };
}

export interface Estimate {
  id: string;
  vehicleVariant: string;
  serviceTierName: string;
  providerName: string;
  estimatedTotalFareWithCurrency: {
    amount: number;
    currency: string;
  };
  totalFareRange?: {
    minFare: number;
    maxFare: number;
  };
  estimatedPickupDuration?: number;
  estimatedDistance?: number;
  estimatedDuration?: number;
  tipEnabled?: boolean;
  availableTips?: number[];
}

export interface RideStatus {
  id: string;
  status: string;
  createdAt: string;
  estimatedFare?: number;
  finalFare?: number;
  currency?: string;
  driverName?: string;
  driverNumber?: string;
  driverRating?: number;
  vehicleNumber?: string;
  vehicleVariant?: string;
  vehicleModel?: string;
  origin?: PlaceDetails;
  destination?: PlaceDetails;
  otp?: string;
  tripStartTime?: string;
  tripEndTime?: string;
  cancellationReason?: string;
}

export interface SavedLocation {
  tag: string;
  lat: number;
  lon: number;
  locationName?: string;
  area?: string;
  city?: string;
  placeId?: string;
}

export class NyClient {
  private client: AxiosInstance;
  private token: string;

  constructor(token: string) {
    this.token = token;
    this.client = axios.create({
      baseURL: API_BASE,
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
    });
  }

  // Places API
  async searchPlaces(searchText: string, location?: { lat: number; lon: number }): Promise<Place[]> {
    const body = {
      autoCompleteType: 'DROP',
      input: searchText,
      language: 'ENGLISH',
      location: location ? `${location.lat},${location.lon}` : '12.97413032560963,77.58534937018615',
      radius: 50000,
      radiusWithUnit: { unit: 'Meter', value: 50000.0 },
      strictbounds: false,
    };

    const response = await this.client.post('/maps/autoComplete', body);
    return response.data.predictions || [];
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails>;
  async getPlaceDetails(lat: number, lon: number): Promise<PlaceDetails>;
  async getPlaceDetails(placeIdOrLat: string | number, lon?: number): Promise<PlaceDetails> {
    let body: object;
    
    if (typeof placeIdOrLat === 'string') {
      body = {
        getBy: { contents: placeIdOrLat, tag: 'ByPlaceId' },
        language: 'ENGLISH',
        sessionToken: 'default-token',
      };
    } else {
      body = {
        getBy: { contents: { lat: placeIdOrLat, lon: lon }, tag: 'ByLatLong' },
        language: 'ENGLISH',
        sessionToken: 'default-token',
      };
    }

    const response = await this.client.post('/maps/getPlaceName', body);
    return response.data;
  }

  // Ride Search API
  async searchRides(
    origin: { lat: number; lon: number; address?: Partial<PlaceDetails['address']> & { placeId?: string } },
    destination: { lat: number; lon: number; address?: Partial<PlaceDetails['address']> & { placeId?: string } }
  ): Promise<string> {
    const body = {
      contents: {
        origin: {
          gps: { lat: origin.lat, lon: origin.lon },
          address: {
            area: origin.address?.area || `${origin.lat},${origin.lon}`,
            city: origin.address?.city || '',
            country: origin.address?.country || '',
            building: origin.address?.building || '',
            placeId: origin.address?.placeId || `${origin.lat},${origin.lon}`,
            state: origin.address?.state || '',
          },
        },
        destination: {
          gps: { lat: destination.lat, lon: destination.lon },
          address: {
            area: destination.address?.area || `${destination.lat},${destination.lon}`,
            city: destination.address?.city || '',
            country: destination.address?.country || '',
            building: destination.address?.building || '',
            placeId: destination.address?.placeId || `${destination.lat},${destination.lon}`,
            state: destination.address?.state || '',
          },
        },
        placeNameSource: 'API_CLI',
        platformType: 'APPLICATION',
      },
      fareProductType: 'ONE_WAY',
    };

    const response = await this.client.post('/rideSearch', body);
    return response.data.searchId;
  }

  async pollSearchResults(searchId: string, maxAttempts = 10, interval = 2000): Promise<Estimate[]> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await this.client.get(`/rideSearch/${searchId}/results`);
      const estimates = response.data.estimates || [];
      if (estimates.length > 0) {
        return estimates;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    return [];
  }

  // Estimate Selection API
  async selectEstimate(
    estimateId: string,
    options?: {
      additionalEstimateIds?: string[];
      isPetRide?: boolean;
      specialAssistance?: boolean;
    }
  ): Promise<void> {
    const body = {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: '',
      otherSelectedEstimates: options?.additionalEstimateIds || [],
      disabilityDisable: options?.specialAssistance !== false,
      isPetRide: options?.isPetRide || false,
    };

    await this.client.post(`/estimate/${estimateId}/select2`, body);
  }

  async addTip(estimateId: string, amount: number, currency = 'INR'): Promise<void> {
    const body = {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: '',
      customerExtraFeeWithCurrency: { amount, currency },
      customerExtraFee: amount,
      otherSelectedEstimates: [],
      disabilityDisable: true,
      isPetRide: false,
    };

    await this.client.post(`/estimate/${estimateId}/select2`, body);
  }

  async cancelSearch(estimateId: string): Promise<void> {
    await this.client.post(`/estimate/${estimateId}/cancelSearch`, {});
  }

  // Status API
  async getRideStatus(options?: {
    onlyActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<RideStatus[]> {
    const params = new URLSearchParams({
      onlyActive: String(options?.onlyActive ?? true),
      clientId: CLIENT_ID,
    });
    
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));

    const response = await this.client.get(`/rideBooking/list?${params}`);
    return response.data.list || [];
  }

  async pollForDriverAssignment(maxAttempts = 30, interval = 2000): Promise<RideStatus | null> {
    for (let i = 0; i < maxAttempts; i++) {
      const rides = await this.getRideStatus({ onlyActive: true });
      if (rides.length > 0) {
        return rides[0];
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    return null;
  }

  // Saved Locations API
  async getSavedLocations(): Promise<SavedLocation[]> {
    const response = await this.client.get('/savedLocation/list');
    return response.data.list || [];
  }
}