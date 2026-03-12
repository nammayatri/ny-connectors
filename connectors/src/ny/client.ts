import { config } from '../config';

export interface NYPlace {
  description: string;
  placeId: string;
  distance?: number;
}

export interface NYPlaceDetails {
  lat: number;
  lon: number;
  placeId: string;
  address: {
    area?: string;
    building?: string;
    city?: string;
    country?: string;
    state?: string;
    street?: string;
  };
}

export interface NYEstimate {
  id: string;
  estimatedFare: number;
  serviceTierName: string;
  vehicleVariant: string;
  totalFareRange: { minFare: number; maxFare: number };
  estimatedPickupDuration?: number;
}

export interface NYSavedLocation {
  tag: string;
  lat: number;
  lon: number;
  area?: string;
  building?: string;
  city?: string;
  country?: string;
  state?: string;
  placeId?: string;
}

export class NammaYatriClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  static async authenticate(mobileNumber: string, accessCode: string): Promise<{ token: string; person: any }> {
    const res = await fetch(`${config.nyAuthUrl}/auth/get-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appSecretCode: accessCode,
        userMobileNo: mobileNumber,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({} as any)) as any;
      throw new Error(err.errorMessage || `Auth failed: ${res.status}`);
    }

    const data = await res.json() as any;
    return { token: data.token, person: data.person };
  }

  async getSavedLocations(): Promise<NYSavedLocation[]> {
    const res = await fetch(`${config.nyBaseUrl}/savedLocation/list`, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });
    if (!res.ok) throw new Error(`Failed to get saved locations: ${res.status}`);
    const data = await res.json() as any;
    return data.list || [];
  }

  async searchPlaces(searchText: string): Promise<NYPlace[]> {
    const res = await fetch(`${config.nyBaseUrl}/maps/autoComplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({
        autoCompleteType: 'DROP',
        input: searchText,
        language: 'ENGLISH',
        location: '12.97413032560963,77.58534937018615',
        radius: 50000,
        radiusWithUnit: { unit: 'Meter', value: 50000.0 },
        strictbounds: false,
      }),
    });
    if (!res.ok) throw new Error(`Place search failed: ${res.status}`);
    const data = await res.json() as any;
    return (data.predictions || []).map((p: any) => ({
      description: p.description,
      placeId: p.placeId,
      distance: p.distanceWithUnit?.value,
    }));
  }

  async getPlaceDetails(placeId: string): Promise<NYPlaceDetails> {
    const res = await fetch(`${config.nyBaseUrl}/maps/getPlaceName`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({
        getBy: { contents: placeId, tag: 'ByPlaceId' },
        language: 'ENGLISH',
        sessionToken: 'default-token',
      }),
    });
    if (!res.ok) throw new Error(`Place details failed: ${res.status}`);
    const data = await res.json() as any;
    return {
      lat: data.lat,
      lon: data.lon,
      placeId: data.placeId,
      address: data.address || {},
    };
  }

  async searchRide(origin: NYPlaceDetails, destination: NYPlaceDetails): Promise<string> {
    const res = await fetch(`${config.nyBaseUrl}/rideSearch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({
        contents: {
          origin: {
            gps: { lat: origin.lat, lon: origin.lon },
            address: {
              area: origin.address.area || '',
              city: origin.address.city || '',
              country: origin.address.country || '',
              building: origin.address.building || '',
              placeId: origin.placeId,
              state: origin.address.state || '',
            },
          },
          destination: {
            gps: { lat: destination.lat, lon: destination.lon },
            address: {
              area: destination.address.area || '',
              city: destination.address.city || '',
              country: destination.address.country || '',
              building: destination.address.building || '',
              placeId: destination.placeId,
              state: destination.address.state || '',
            },
          },
          placeNameSource: 'API_MCP',
          platformType: 'APPLICATION',
        },
        fareProductType: 'ONE_WAY',
      }),
    });
    if (!res.ok) throw new Error(`Ride search failed: ${res.status}`);
    const data = await res.json() as any;
    return data.searchId;
  }

  async getEstimates(searchId: string): Promise<NYEstimate[]> {
    const res = await fetch(`${config.nyBaseUrl}/rideSearch/${searchId}/results`, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });
    if (!res.ok) throw new Error(`Get estimates failed: ${res.status}`);
    const data = await res.json() as any;
    return (data.estimates || []).map((e: any) => ({
      id: e.id,
      estimatedFare: e.estimatedFare,
      serviceTierName: e.serviceTierName,
      vehicleVariant: e.vehicleVariant,
      totalFareRange: e.totalFareRange,
      estimatedPickupDuration: e.estimatedPickupDuration,
    }));
  }

  async selectEstimate(estimateId: string): Promise<void> {
    const res = await fetch(`${config.nyBaseUrl}/estimate/${estimateId}/select2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({
        autoAssignEnabled: true,
        autoAssignEnabledV2: true,
        paymentMethodId: '',
        otherSelectedEstimates: [],
        disabilityDisable: true,
        isPetRide: false,
      }),
    });
    if (!res.ok) throw new Error(`Select estimate failed: ${res.status}`);
  }

  async cancelSearch(estimateId: string): Promise<void> {
    const res = await fetch(`${config.nyBaseUrl}/estimate/${estimateId}/cancelSearch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`Cancel failed: ${res.status}`);
  }

  async getActiveBookings(): Promise<any[]> {
    const res = await fetch(`${config.nyBaseUrl}/rideBooking/list?onlyActive=true&clientId=ACP_SERVER`, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });
    if (!res.ok) throw new Error(`Get bookings failed: ${res.status}`);
    const data = await res.json() as any;
    return data.list || [];
  }
}
