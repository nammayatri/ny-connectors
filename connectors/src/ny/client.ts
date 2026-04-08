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

export interface NYRideHistoryItem {
  id: string;
  status: string;
  createdAt: string;
  vehicleVariant?: string;  // mapped from vehicleServiceTierType in listv2
  serviceTierName?: string; // e.g. "Auto", "Auto Priority"
  estimatedFare?: number;
  fromLocation?: { area?: string; city?: string };
  toLocation?: { area?: string; city?: string };
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

  static async authenticate(mobileNumber: string): Promise<{ token: string; personId: string; person: any }> {
    const params = new URLSearchParams({
      mobileNumber,
      mobileCountryCode: '+91',
    });
    const authBase = config.nyAuthUrl.replace(/\/v2\/?$/, '');
    const res = await fetch(`${authBase}/internal/auth/getToken?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', token: config.nyPreAuthToken },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({} as any)) as any;
      throw new Error(err.errorMessage || `Auth failed: ${res.status}`);
    }

    const data = await res.json() as any;
    console.log(`[auth] full response: ${JSON.stringify(data).substring(0, 600)}`);
    const personId = data.personId || '';
    console.log(`[auth] personId=${personId} token=${data.token?.substring(0, 10)}...`);
    return { token: data.token, personId, person: data };
  }

  async getPersonId(): Promise<string> {
    const url = `${config.nyBaseUrl}/profile`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });
    if (!res.ok) {
      console.warn(`[auth] profile fetch failed: ${res.status}`);
      return '';
    }
    const data = await res.json() as any;
    console.log(`[auth] profile response: ${JSON.stringify(data).substring(0, 400)}`);
    return data.id || data.personId || data.customerId || data.userId || '';
  }

  async saveLocation(tag: string, details: NYPlaceDetails): Promise<void> {
    const res = await fetch(`${config.nyBaseUrl}/savedLocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({
        area: details.address.area || '',
        areaCode: '',
        building: details.address.building || '',
        city: details.address.city || '',
        country: details.address.country || '',
        door: '',
        isMoved: false,
        lat: details.lat,
        locationName: '',
        lon: details.lon,
        placeId: details.placeId || '',
        state: details.address.state || '',
        street: details.address.street || '',
        tag,
        ward: '',
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`[savedLocation] save failed ${res.status}: ${err.substring(0, 300)}`);
      throw new Error(`Save location failed: ${res.status}`);
    }
    console.log(`[savedLocation] saved tag=${tag} placeId=${details.placeId}`);
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
    const raw = await res.json() as any;
    // API returns an array — take the first element
    const data = Array.isArray(raw) ? raw[0] : raw;
    // Coordinates are in data.location (Google Places style), address in addressComponents
    const loc = data?.location || {};
    const components = data?.addressComponents || [];
    const getComponent = (type: string) =>
      components.find((c: any) => c.types?.includes(type))?.longName || '';
    console.log(`[getPlaceDetails] lat=${loc.lat} lon=${loc.lng || loc.lon} placeId=${data?.placeId}`);
    return {
      lat: loc.lat,
      lon: loc.lng || loc.lon,
      placeId: data?.placeId || placeId,
      address: {
        area: getComponent('sublocality_level_1') || getComponent('sublocality'),
        building: getComponent('premise') || getComponent('street_number'),
        city: getComponent('locality'),
        state: getComponent('administrative_area_level_1'),
        country: getComponent('country'),
        street: getComponent('route'),
      },
    };
  }

  async reverseGeocode(lat: number, lon: number): Promise<NYPlaceDetails> {
    const res = await fetch(`${config.nyBaseUrl}/maps/getPlaceName`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({
        getBy: { contents: `${lat},${lon}`, tag: 'ByLatLong' },
        language: 'ENGLISH',
        sessionToken: 'default-token',
      }),
    });
    if (!res.ok) {
      console.warn(`[ny] reverseGeocode failed: ${res.status}`);
      return { lat, lon, placeId: `${lat},${lon}`, address: {} };
    }
    const raw = await res.json() as any;
    const data = Array.isArray(raw) ? raw[0] : raw;
    const loc = data?.location || {};
    const components = data?.addressComponents || [];
    const getComponent = (type: string) =>
      components.find((c: any) => c.types?.includes(type))?.longName || '';
    return {
      lat: loc.lat ?? lat,
      lon: (loc.lng || loc.lon) ?? lon,
      placeId: data?.placeId || `${lat},${lon}`,
      address: {
        area: getComponent('sublocality_level_1') || getComponent('sublocality'),
        building: getComponent('premise') || getComponent('street_number'),
        city: getComponent('locality'),
        state: getComponent('administrative_area_level_1'),
        country: getComponent('country'),
        street: getComponent('route'),
      },
    };
  }

  async searchRide(origin: NYPlaceDetails, destination: NYPlaceDetails): Promise<string> {
    const body = {
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
    };
    console.log(`[rideSearch] request: ${JSON.stringify(body).substring(0, 800)}`);
    const res = await fetch(`${config.nyBaseUrl}/rideSearch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[rideSearch] failed ${res.status}: ${errBody.substring(0, 500)}`);
      throw new Error(`Ride search failed: ${res.status}`);
    }
    const data = await res.json() as any;
    return data.searchId;
  }

  async getEstimates(searchId: string): Promise<NYEstimate[]> {
    const res = await fetch(`${config.nyBaseUrl}/rideSearch/${searchId}/results`, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });
    if (!res.ok) {
      // 400 is common while search is still processing — return empty so polling continues
      if (res.status === 400) {
        console.log(`[estimates] searchId=${searchId} not ready yet (400)`);
        return [];
      }
      throw new Error(`Get estimates failed: ${res.status}`);
    }
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

  /**
   * Polls /rideBooking/select/{personId}/{estimateId}/result until bookingId is returned.
   * Returns the bookingId string, or null if not yet assigned.
   */
  async pollSelectResult(personId: string, estimateId: string): Promise<{ bookingId: string | null; raw: any }> {
    const url = `${config.nyBaseUrl}/rideBooking/select/${personId}/${estimateId}/result`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[booking] pollSelectResult ${res.status}: ${body.substring(0, 200)}`);
      return { bookingId: null, raw: null };
    }
    const data = await res.json() as any;
    console.log(`[booking] selectResult: ${JSON.stringify(data).substring(0, 400)}`);
    const bookingId = data.bookingId || data.id || null;
    return { bookingId, raw: data };
  }

  /**
   * Fetches full booking details including driver info, OTP etc.
   * Tries /rideBooking/{bookingId} first, then falls back to listv2.
   */
  async getBookingDetails(bookingId: string): Promise<any> {
    const url = `${config.nyBaseUrl}/rideBooking/${bookingId}`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });
    if (!res.ok) {
      console.warn(`[booking] getBookingDetails failed: ${res.status}, falling back to listv2`);
      const actives = await this.getActiveBookings().catch(() => []);
      return actives.find((b: any) => b.id === bookingId) || actives[0] || null;
    }
    const data = await res.json() as any;
    console.log(`[booking] bookingDetails: ${JSON.stringify(data).substring(0, 600)}`);
    return data.contents ?? data;
  }

  async cancelSearch(estimateId: string): Promise<void> {
    const res = await fetch(`${config.nyBaseUrl}/estimate/${estimateId}/cancelSearch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`Cancel search failed: ${res.status}`);
  }

  async triggerSOS(rideId: string, customerLat?: number, customerLon?: number): Promise<string> {
    const res = await fetch(`${config.nyBaseUrl}/sos/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({
        customerLocation: {
          lat: customerLat || 0,
          lon: customerLon || 0,
        },
        flow: { tag: 'Police' },
        isRideEnded: false,
        notifyAllContacts: true,
        rideId,
        sendPNOnPostRideSOS: true,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`[sos] triggerSOS failed ${res.status}: ${err.substring(0, 300)}`);
      throw new Error(`SOS failed: ${res.status}`);
    }
    const data = await res.json() as any;
    console.log(`[sos] SOS triggered for rideId=${rideId} sosId=${data.sosId}`);
    return data.sosId;
  }

  async markRideAsSafe(sosId: string): Promise<void> {
    const res = await fetch(`${config.nyBaseUrl}/sos/markRideAsSafe/${sosId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify({
        contacts: [],
        isEndLiveTracking: true,
        isMock: false,
        isRideEnded: false,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`[sos] markRideAsSafe failed ${res.status}: ${err.substring(0, 300)}`);
      throw new Error(`Mark safe failed: ${res.status}`);
    }
    console.log(`[sos] Ride marked as safe for sosId=${sosId}`);
  }

  async cancelRide(bookingId: string, bookingStatus?: string): Promise<void> {
    // reasonStage: OnSearch → not yet assigned, OnAssign → driver assigned
    const reasonStage = (bookingStatus === 'TRIP_ASSIGNED' || bookingStatus === 'CONFIRMED') ? 'OnAssign' : 'OnSearch';
    const body = {
      additionalInfo: '',
      reasonCode: 'CHANGE_OF_MIND',
      reasonStage,
      source: 'ByUser',
    };
    console.log(`[cancel] cancelRide bookingId=${bookingId} status=${bookingStatus} body=${JSON.stringify(body)}`);
    const res = await fetch(`${config.nyBaseUrl}/rideBooking/${bookingId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token: this.token },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`[cancel] cancelRide failed ${res.status}: ${err.substring(0, 300)}`);
      throw new Error(`Cancel ride failed: ${res.status} ${err.substring(0, 100)}`);
    }
  }

  async getActiveBookings(createdAfter?: Date): Promise<any[]> {
    const activeStatuses = ['NEW', 'CONFIRMED', 'TRIP_ASSIGNED', 'AWAITING_REASSIGNMENT', 'REALLOCATED'];
    // API expects JSON-encoded string values: rideStatus=%22NEW%22&rideStatus=%22CONFIRMED%22
    const statusQuery = activeStatuses.map((s) => `rideStatus=${encodeURIComponent(JSON.stringify(s))}`).join('&');
    const params = `limit=10&${statusQuery}`;

    const url = `${config.nyBaseUrl}/rideBooking/listV2?${params}`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[booking] getActiveBookings failed: ${res.status} ${body.substring(0, 200)}`);
      throw new Error(`Get bookings failed: ${res.status}`);
    }
    const data = await res.json() as any;
    const rawList = data.list || [];

    let rides = rawList
      .filter((item: any) => item.tag === 'Ride')
      .map((item: any) => item.contents ?? item);

    // If caller provides a reference time, only accept bookings created after it
    if (createdAfter) {
      const threshold = createdAfter.getTime();
      rides = rides.filter((r: any) => {
        if (!r.createdAt) return false;
        return new Date(r.createdAt).getTime() >= threshold;
      });
      console.log(`[booking] getActiveBookings: ${rawList.length} raw → ${rides.length} after createdAfter=${createdAfter.toISOString()}`);
    } else {
      console.log(`[booking] getActiveBookings: ${rawList.length} raw → ${rides.length} rides`);
    }

    if (rides.length > 0) {
      console.log(`[booking] match: id=${rides[0].id} status=${rides[0].status} createdAt=${rides[0].createdAt}`);
    }
    return rides;
  }

  async getRideHistory(limit = 10): Promise<NYRideHistoryItem[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      onlyActive: 'false',
      clientId: 'ACP_SERVER',
    });
    const url = `${config.nyBaseUrl}/rideBooking/listV2?${params}`;
    console.log(`[history] GET ${url}`);
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', token: this.token },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Get ride history failed: ${res.status} ${body}`);
    }
    const data = await res.json() as any;
    const list = data.list || [];
    console.log(`[history] raw list length: ${list.length}`);
    if (list.length > 0) {
      const c = list[0]?.contents || list[0];
      console.log(`[history] contents keys: ${Object.keys(c).join(', ')}`);
    }
    return list.map((item: any) => {
      const c = item.contents ?? item;
      return {
        id: c.id,
        status: c.status,
        createdAt: c.createdAt,
        vehicleVariant: c.vehicleServiceTierType ?? c.vehicleVariant,
        serviceTierName: c.serviceTierName,
        estimatedFare: c.estimatedFare,
        fromLocation: c.fromLocation,
        toLocation: c.bookingDetails?.contents?.toLocation ?? c.toLocation,
      };
    });
  }
}
