import { config, MerchantConfig } from '../config';
import { DEFAULT_CITY, findNearestCity } from './cities';
import { loggedFetch } from './http';
import { NYPlaceDetails } from './client';

// ---------------------------------------------------------------------------
// FRFS (Fixed Route Fixed Schedule) + Multimodal journey client
// ---------------------------------------------------------------------------
// FRFS covers metro / bus / subway ticketing: pick two stations, get a quote,
// confirm it (which creates a payment order), pay, then receive QR tickets.
//
// Multimodal covers whole-journey planning: one search returns several
// journeys, each a sequence of legs (walk → metro → walk, bus → taxi, …).
// A journey is initiated, then confirmed, which books every bookable leg.
//
// Both live on the same base URL and use the same `token:` user JWT as the
// taxi APIs in client.ts, so no extra auth is needed.
// ---------------------------------------------------------------------------

export type FrfsVehicleType = 'METRO' | 'BUS' | 'SUBWAY';

export const FRFS_VEHICLE_TYPES: FrfsVehicleType[] = ['METRO', 'BUS', 'SUBWAY'];

export function isFrfsVehicleType(value: string): value is FrfsVehicleType {
  return (FRFS_VEHICLE_TYPES as string[]).includes(value);
}

export interface FrfsStation {
  code: string;
  name: string;
  address?: string;
  lat?: number;
  lon?: number;
  distance?: number;
}

export interface FrfsQuote {
  quoteId: string;
  price: number;
  quantity: number;
  validTill?: string;
  serviceTierName?: string;
  vehicleType?: string;
  stations: FrfsStation[];
  routeCode?: string;
}

export interface FrfsTicket {
  ticketNumber: string;
  qrData: string;
  status: string;
  validTill?: string;
  description?: string;
}

export interface FrfsBooking {
  bookingId: string;
  status: string;              // NEW | APPROVED | PAYMENT_PENDING | CONFIRMING | CONFIRMED | FAILED | CANCELLED …
  price: number;
  quantity: number;
  validTill?: string;
  vehicleType?: string;
  city?: string;
  stations: FrfsStation[];
  tickets: FrfsTicket[];
  paymentStatus?: string;      // NEW | PENDING | SUCCESS | FAILURE | REFUND_PENDING | REFUNDED
  paymentLink?: string;        // hosted checkout URL from the Juspay order
  createdAt?: string;
}

export type MultimodalTravelMode = 'Metro' | 'Bus' | 'Walk' | 'Taxi' | 'Subway';

export interface JourneyLegSummary {
  mode: MultimodalTravelMode;
  durationSeconds?: number;
  distanceMeters?: number;
  fromName?: string;
  toName?: string;
}

export interface Journey {
  journeyId: string;
  modes: MultimodalTravelMode[];
  legs: JourneyLegSummary[];
  totalMinFare: number;
  totalMaxFare: number;
  durationSeconds?: number;
  distanceMeters?: number;
}

export interface JourneyLegInfo {
  journeyLegId: string;
  order: number;
  /** Absent until the leg's fare resolves; booking before it lands confirms
   *  an unpriced leg. */
  pricingId?: string;
  mode: MultimodalTravelMode;
  bookingAllowed: boolean;
  /** Flattened from the API's {tag, contents} union, e.g. "TaxiBooking: CONFIRMED". */
  bookingStatus?: string;
  durationSeconds?: number;
  distanceMeters?: number;
  minFare?: number;
  maxFare?: number;
  fromName?: string;
  toName?: string;
  ticketNumbers?: string[];
}

export interface JourneyInfo {
  journeyId: string;
  journeyStatus: string;       // NEW | INITIATED | CONFIRMED | INPROGRESS | COMPLETED | CANCELLED | FAILED …
  legs: JourneyLegInfo[];
  minFare: number;
  maxFare: number;
  durationSeconds?: number;
  distanceMeters?: number;
  unifiedQR?: string;
  paymentOrderShortId?: string;
}

// Booking statuses that mean the ticket is issued and nothing more is pending.
export const FRFS_TERMINAL_OK = new Set(['CONFIRMED']);
// Booking statuses that mean the attempt is over and failed.
export const FRFS_TERMINAL_FAIL = new Set([
  'FAILED',
  'CANCELLED',
  'COUNTER_CANCELLED',
  'TECHNICAL_CANCEL_REJECTED',
]);

/** The FRFS `city` query param is a plain city name (e.g. "Chennai"), unlike
 *  the dashboard APIs which use a city code such as "std:080". Resolve it from
 *  the user's coordinates when we have them, else fall back to config. */
export function frfsCityFor(
  near?: { lat: number; lon: number },
  merchant?: MerchantConfig,
): string {
  const configured = merchant?.nyFrfsCity || config.nyFrfsCity;
  if (configured) return configured;
  if (near && near.lat != null && near.lon != null) {
    return findNearestCity(near.lat, near.lon).name;
  }
  return DEFAULT_CITY.name;
}

function mapStation(s: any): FrfsStation {
  return {
    code: s?.code,
    name: s?.name || s?.code || '',
    address: s?.address || undefined,
    lat: s?.lat ?? undefined,
    lon: s?.lon ?? undefined,
    distance: s?.distance ?? undefined,
  };
}

function mapQuote(q: any): FrfsQuote {
  return {
    quoteId: q?.quoteId,
    price: q?.price ?? q?.priceWithCurrency?.amount ?? 0,
    quantity: q?.quantity ?? 1,
    validTill: q?.validTill,
    serviceTierName: q?.serviceTierName || undefined,
    vehicleType: q?.vehicleType || undefined,
    stations: (q?.stations || []).map(mapStation),
    routeCode: q?.routeCode || undefined,
  };
}

function mapBooking(b: any): FrfsBooking {
  return {
    bookingId: b?.bookingId,
    status: b?.status,
    price: b?.price ?? b?.priceWithCurrency?.amount ?? 0,
    quantity: b?.quantity ?? 1,
    validTill: b?.validTill,
    vehicleType: b?.vehicleType,
    city: b?.city,
    stations: (b?.stations || []).map(mapStation),
    tickets: (b?.tickets || []).map((t: any) => ({
      ticketNumber: t?.ticketNumber,
      qrData: t?.qrData,
      status: t?.status,
      validTill: t?.validTill,
      description: t?.description || undefined,
    })),
    paymentStatus: b?.payment?.status,
    // The RN app drives payment through the Juspay HyperSDK and ignores these
    // links; a chat bot has no SDK, so the hosted web checkout URL is what we
    // hand the user instead.
    paymentLink:
      b?.payment?.paymentOrder?.payment_links?.web ||
      b?.payment?.paymentOrder?.payment_links?.mobile ||
      undefined,
    createdAt: b?.createdAt,
  };
}

function legName(leg: any, which: 'from' | 'to'): string | undefined {
  const info = leg?.legExtraInfo?.contents || leg?.legExtraInfo || {};
  // Taxi and walk legs carry origin/destination; bus and metro carry
  // originStop/destinationStop.
  const loc = which === 'from'
    ? info.origin || info.originStop || info.fromStation || leg?.fromStation || leg?.origin
    : info.destination || info.destinationStop || info.toStation || leg?.toStation || leg?.destination;
  return loc?.name || loc?.address || loc?.fullAddress || undefined;
}

/** A leg's bookingStatus arrives as {tag, contents} — for example
 *  {"tag":"TaxiBooking","contents":"CONFIRMED"}. Flatten it to a printable
 *  string; interpolating the raw object yields "[object Object]". */
function flattenBookingStatus(raw: any): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw;
  const tag = raw.tag ?? raw.TAG;
  const contents = raw.contents ?? raw._0;
  if (!tag) return undefined;
  return typeof contents === 'string' ? `${tag}: ${contents}` : String(tag);
}

function mapJourneyLegSummary(leg: any): JourneyLegSummary {
  return {
    mode: leg?.mode || leg?.travelMode,
    durationSeconds: leg?.duration ?? leg?.estimatedDuration ?? undefined,
    distanceMeters: leg?.distance?.value ?? leg?.estimatedDistance?.value ?? undefined,
    fromName: legName(leg, 'from'),
    toName: legName(leg, 'to'),
  };
}

function mapJourney(j: any): Journey {
  return {
    journeyId: j?.journeyId,
    modes: j?.modes || [],
    legs: (j?.journeyLegs || []).map(mapJourneyLegSummary),
    totalMinFare: j?.totalMinFare ?? 0,
    totalMaxFare: j?.totalMaxFare ?? 0,
    durationSeconds: j?.duration ?? undefined,
    distanceMeters: j?.distance?.value ?? undefined,
  };
}

function mapJourneyInfo(r: any): JourneyInfo {
  return {
    journeyId: r?.journeyId,
    journeyStatus: r?.journeyStatus,
    minFare: r?.estimatedMinFare?.amount ?? 0,
    maxFare: r?.estimatedMaxFare?.amount ?? 0,
    durationSeconds: r?.estimatedDuration ?? undefined,
    distanceMeters: r?.estimatedDistance?.value ?? undefined,
    unifiedQR: r?.unifiedQRV2 || undefined,
    paymentOrderShortId: r?.paymentOrderShortId || undefined,
    legs: (r?.legs || []).map((l: any) => {
      const info = l?.legExtraInfo?.contents || l?.legExtraInfo || {};
      return {
        journeyLegId: l?.journeyLegId,
        order: l?.order ?? 0,
        pricingId: l?.pricingId || undefined,
        mode: l?.travelMode,
        bookingAllowed: !!l?.bookingAllowed,
        bookingStatus: flattenBookingStatus(l?.bookingStatus),
        durationSeconds: l?.estimatedDuration ?? undefined,
        distanceMeters: l?.estimatedDistance?.value ?? undefined,
        minFare: l?.estimatedMinFare?.amount ?? undefined,
        maxFare: l?.estimatedMaxFare?.amount ?? undefined,
        fromName: legName(l, 'from'),
        toName: legName(l, 'to'),
        ticketNumbers: info?.ticketNo || undefined,
      };
    }),
  };
}

/** Bookable legs that still have no fare resolved. */
export function unpricedLegs(info: JourneyInfo): JourneyLegInfo[] {
  return info.legs.filter((l) => l.bookingAllowed && !l.pricingId);
}

export class FrfsClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return { 'Content-Type': 'application/json', token: this.token, ...(extra || {}) };
  }

  private async fail(res: { status: number; json: <T>() => Promise<T> }, what: string): Promise<never> {
    const err = await res.json<any>().catch(() => ({}));
    const msg = err?.errorMessage || err?.errorCode || '';
    throw new Error(`${what} failed: ${res.status}${msg ? ` — ${msg}` : ''}`);
  }

  // --- Stations -----------------------------------------------------------

  /** GET /frfs/autocomplete — station search by free text. */
  async searchStations(
    input: string,
    vehicleType: FrfsVehicleType,
    near?: { lat: number; lon: number },
    merchant?: MerchantConfig,
  ): Promise<FrfsStation[]> {
    const city = frfsCityFor(near, merchant);
    const center = near ?? { lat: DEFAULT_CITY.lat, lon: DEFAULT_CITY.lon };
    const location = `${center.lat},${center.lon}`;
    const params = new URLSearchParams({ input, city, location, vehicleType });
    const res = await loggedFetch(`${config.nyBaseUrl}/frfs/autocomplete?${params}`, {
      headers: this.headers(),
    });
    if (!res.ok) return this.fail(res, 'Station search');
    const data = await res.json() as any;
    const raw = data?.stations || data?.predictions || (Array.isArray(data) ? data : []);
    return raw.map(mapStation).filter((s: FrfsStation) => !!s.code);
  }

  /** GET /frfs/stations — full station list for a city, used as a fallback
   *  when autocomplete returns nothing (e.g. a very short query). */
  async listStations(
    vehicleType: FrfsVehicleType,
    near?: { lat: number; lon: number },
    merchant?: MerchantConfig,
  ): Promise<FrfsStation[]> {
    const params = new URLSearchParams({ city: frfsCityFor(near, merchant), vehicleType });
    const res = await loggedFetch(`${config.nyBaseUrl}/frfs/stations?${params}`, {
      headers: this.headers(),
    });
    if (!res.ok) return this.fail(res, 'Station list');
    const data = await res.json() as any;
    const raw = Array.isArray(data) ? data : data?.stations || [];
    return raw.map(mapStation).filter((s: FrfsStation) => !!s.code);
  }

  // --- Ticket booking -----------------------------------------------------

  /** POST /frfs/search — returns a searchId plus any quotes already resolved. */
  async search(
    vehicleType: FrfsVehicleType,
    fromStationCode: string,
    toStationCode: string,
    quantity: number,
  ): Promise<{ searchId: string; quotes: FrfsQuote[] }> {
    const params = new URLSearchParams({ vehicleType });
    const res = await loggedFetch(`${config.nyBaseUrl}/frfs/search?${params}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        fromStationCode,
        toStationCode,
        quantity,
        platformType: 'APPLICATION',
      }),
    });
    if (!res.ok) return this.fail(res, 'Ticket search');
    const data = await res.json() as any;
    return {
      searchId: data?.searchId,
      quotes: (data?.quotes || []).map(mapQuote),
    };
  }

  /** GET /frfs/search/{searchId}/quote — poll target while the BPP responds. */
  async getQuotes(searchId: string): Promise<FrfsQuote[]> {
    const res = await loggedFetch(`${config.nyBaseUrl}/frfs/search/${searchId}/quote`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      // Same convention as taxi estimates: a 400 means "not ready yet".
      if (res.status === 400) return [];
      return this.fail(res, 'Get quotes');
    }
    const data = await res.json() as any;
    const raw = Array.isArray(data) ? data : data?.quotes || [];
    return raw.map(mapQuote);
  }

  /** POST /frfs/quote/{quoteId}/confirm — creates the booking and its payment
   *  order. `mockPayment` skips real checkout; only enabled in non-prod. */
  async confirmQuote(quoteId: string, mockPayment = false): Promise<FrfsBooking> {
    const qs = mockPayment ? '?isMockPayment=true' : '';
    const res = await loggedFetch(`${config.nyBaseUrl}/frfs/quote/${quoteId}/confirm${qs}`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!res.ok) return this.fail(res, 'Confirm ticket');
    return mapBooking(await res.json());
  }

  /** GET /frfs/booking/{bookingId}/status */
  async getBooking(bookingId: string): Promise<FrfsBooking> {
    const res = await loggedFetch(`${config.nyBaseUrl}/frfs/booking/${bookingId}/status`, {
      headers: this.headers(),
    });
    if (!res.ok) return this.fail(res, 'Booking status');
    return mapBooking(await res.json());
  }

  /** GET /frfs/booking/list — most recent first. */
  async listBookings(): Promise<FrfsBooking[]> {
    const res = await loggedFetch(`${config.nyBaseUrl}/frfs/booking/list`, {
      headers: this.headers(),
    });
    if (!res.ok) return this.fail(res, 'Booking list');
    const data = await res.json() as any;
    const raw = Array.isArray(data) ? data : data?.bookings || [];
    return raw.map(mapBooking).sort((a: FrfsBooking, b: FrfsBooking) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );
  }

  /** POST /frfs/booking/{bookingId}/canCancel — asks whether a refund is possible. */
  async canCancelBooking(bookingId: string): Promise<boolean> {
    const res = await loggedFetch(`${config.nyBaseUrl}/frfs/booking/${bookingId}/canCancel`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({})) as any;
    return data?.canCancel !== false;
  }

  /** POST /frfs/booking/{bookingId}/cancel */
  async cancelBooking(bookingId: string): Promise<void> {
    const res = await loggedFetch(`${config.nyBaseUrl}/frfs/booking/${bookingId}/cancel`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!res.ok) return this.fail(res, 'Cancel ticket');
  }

  // --- Multimodal journeys ------------------------------------------------

  /** POST /multimodalSearch — same body as /rideSearch, plus the journey
   *  header the app sends. Returns candidate journeys for the same OD pair. */
  async multimodalSearch(
    origin: NYPlaceDetails,
    destination: NYPlaceDetails,
  ): Promise<{ searchId: string; journeys: Journey[] }> {
    const mkLocation = (p: NYPlaceDetails) => ({
      gps: { lat: p.lat, lon: p.lon },
      address: {
        area: p.address.area || '',
        city: p.address.city || '',
        country: p.address.country || '',
        building: p.address.building || '',
        placeId: p.placeId,
        state: p.address.state || '',
      },
    });
    const res = await loggedFetch(`${config.nyBaseUrl}/multimodalSearch`, {
      method: 'POST',
      headers: this.headers({ initateJourney: 'true' }),
      body: JSON.stringify({
        contents: {
          origin: mkLocation(origin),
          destination: mkLocation(destination),
          placeNameSource: 'API_MCP',
          platformType: 'APPLICATION',
          quotesUnifiedFlow: true,
        },
        fareProductType: 'ONE_WAY',
      }),
    });
    if (!res.ok) return this.fail(res, 'Multimodal search');
    const data = await res.json() as any;
    return {
      searchId: data?.searchId,
      journeys: (data?.journeys || []).map(mapJourney),
    };
  }

  /** POST /multimodal/{journeyId}/initiate — resolves the journey into legs. */
  async initiateJourney(journeyId: string): Promise<JourneyInfo> {
    const res = await loggedFetch(`${config.nyBaseUrl}/multimodal/${journeyId}/initiate`, {
      method: 'POST',
      headers: this.headers(),
    });
    if (!res.ok) return this.fail(res, 'Journey initiate');
    return mapJourneyInfo(await res.json());
  }

  /** Legs come back unpriced and settle over a second or two. The app re-calls
   *  initiate every second until every bookable leg has a pricingId, and only
   *  then allows booking — confirming earlier books an unpriced journey.
   *  Returns the last response; check `unpricedLegs()` before confirming. */
  async initiateJourneyUntilPriced(
    journeyId: string,
    timeoutMs = 20000,
    intervalMs = 1000,
  ): Promise<JourneyInfo> {
    let info = await this.initiateJourney(journeyId);
    const deadline = Date.now() + timeoutMs;
    while (unpricedLegs(info).length > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, intervalMs));
      info = await this.initiateJourney(journeyId);
    }
    return info;
  }

  /** POST /multimodal/{journeyId}/confirm — books every leg we were told is
   *  bookable; the rest (walking, and anything the backend flagged) is skipped. */
  async confirmJourney(journeyId: string, legs: JourneyLegInfo[]): Promise<void> {
    const res = await loggedFetch(`${config.nyBaseUrl}/multimodal/${journeyId}/confirm`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        journeyConfirmReqElements: legs.map((l) => ({
          journeyLegOrder: l.order,
          skipBooking: !l.bookingAllowed,
        })),
      }),
    });
    if (!res.ok) return this.fail(res, 'Journey confirm');
  }

  /** GET /multimodal/journey/{journeyId}/status */
  async getJourneyStatus(journeyId: string): Promise<any> {
    const res = await loggedFetch(`${config.nyBaseUrl}/multimodal/journey/${journeyId}/status`, {
      headers: this.headers(),
    });
    if (!res.ok) return this.fail(res, 'Journey status');
    return res.json();
  }

  /** GET /multimodal/{journeyId}/booking/info — legs with their ticket data. */
  async getJourneyBookingInfo(journeyId: string): Promise<JourneyInfo> {
    const res = await loggedFetch(`${config.nyBaseUrl}/multimodal/${journeyId}/booking/info`, {
      headers: this.headers(),
    });
    if (!res.ok) return this.fail(res, 'Journey booking info');
    return mapJourneyInfo(await res.json());
  }

  /** GET /multimodal/{journeyId}/booking/paymentStatus */
  async getJourneyPaymentStatus(journeyId: string): Promise<{ status?: string; paymentLink?: string }> {
    const res = await loggedFetch(
      `${config.nyBaseUrl}/multimodal/${journeyId}/booking/paymentStatus`,
      { headers: this.headers() },
    );
    if (!res.ok) return this.fail(res, 'Journey payment status');
    const data = await res.json() as any;
    return {
      status: data?.status || data?.paymentStatus,
      paymentLink:
        data?.paymentOrder?.payment_links?.web ||
        data?.paymentOrder?.payment_links?.mobile ||
        undefined,
    };
  }

  /** Cancels a journey one leg at a time.
   *
   *  POST /multimodal/journey/{id}/cancel exists in the API but the backend
   *  answers 400 "Not implemented", and the mobile app never calls it. The app
   *  goes per leg: softCancel opens the request, cancel/status reports the
   *  refund and whether it is allowed, then cancel commits it.
   *
   *  Returns one result line per leg so the caller can tell the user exactly
   *  what happened rather than claiming a blanket success.
   */
  async cancelJourney(journeyId: string, legOrders?: number[]): Promise<string[]> {
    let orders = legOrders;
    if (!orders) {
      const info = await this.getJourneyBookingInfo(journeyId);
      orders = info.legs
        .filter((l) => l.mode !== 'Walk')
        .map((l) => l.order)
        .filter((o) => typeof o === 'number')
        .sort((a, b) => a - b);
    }

    if (orders.length === 0) return [];

    const results: string[] = [];
    for (const order of orders) {
      try {
        results.push(await this.cancelJourneyLeg(journeyId, order));
      } catch (err: any) {
        results.push(`leg ${order}: failed — ${err.message}`);
      }
    }
    return results;
  }

  private async cancelJourneyLeg(journeyId: string, legOrder: number): Promise<string> {
    const base = `${config.nyBaseUrl}/multimodal/${journeyId}/order/${legOrder}`;

    // Best-effort: some leg types have nothing to soft-cancel.
    const soft = await loggedFetch(`${base}/softCancel`, { method: 'POST', headers: this.headers() });
    if (!soft.ok) {
      console.warn(`[journey] leg ${legOrder} softCancel returned ${soft.status}`);
    }

    let detail = '';
    const statusRes = await loggedFetch(`${base}/cancel/status`, { headers: this.headers() });
    if (statusRes.ok) {
      const status = await statusRes.json().catch(() => ({})) as any;
      if (status?.isCancellable === false) {
        return `leg ${legOrder}: not cancellable (${status?.bookingStatus ?? 'unknown status'})`;
      }
      if (status?.refundAmount != null) detail = ` (refund ₹${status.refundAmount})`;
    }

    const res = await loggedFetch(`${base}/cancel`, { method: 'POST', headers: this.headers() });
    if (!res.ok) return this.fail(res, `Cancel leg ${legOrder}`);
    return `leg ${legOrder}: cancelled${detail}`;
  }
}
