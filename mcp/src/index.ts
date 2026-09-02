#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createServer } from "http";
import { URL } from "url";

// ============================================================================
// Configuration
// ============================================================================

const NAMMA_YATRI_API_BASE = process.env.NAMMA_YATRI_API_BASE || "https://api.sandbox.moving.tech/dev/app/v2";
const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_DURATION_MS = 10000;

// A journey's legs come back unpriced and fill in over a second or two. The
// app re-calls /initiate every second until every bookable leg has a
// pricingId, and only then allows booking.
const JOURNEY_PRICING_INTERVAL_MS = 1000;
const JOURNEY_PRICING_TIMEOUT_MS = 20000;

// HTTP Server configuration
const HTTP_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HTTP_HOST = process.env.HOST || "0.0.0.0";
const SSE_ENDPOINT = "/sse";
const MESSAGE_ENDPOINT = "/message";

// Local installs (Claude Desktop / Claude Code) spawn this process and speak
// JSON-RPC over stdin/stdout. Remote/Docker deployments keep the HTTP+SSE
// server, which stays the default so existing deployments are unaffected.
const USE_STDIO =
  process.argv.includes("--stdio") || process.env.MCP_TRANSPORT === "stdio";

// Token storage configuration
const TOKEN_STORAGE_DIR = join(homedir(), ".namma-yatri-mcp");
const TOKEN_STORAGE_FILE = join(TOKEN_STORAGE_DIR, "token.json");
// User-accessible obfuscated token file (for LLM to read/write)
const USER_TOKEN_FILE = join(TOKEN_STORAGE_DIR, "user-token.json");

// ============================================================================
// Type Definitions
// ============================================================================

interface Currency {
  amount: number;
  currency: string;
}

interface Location {
  lat: number;
  lon: number;
}

interface Address {
  area?: string;
  areaCode?: string;
  building?: string;
  city?: string;
  country?: string;
  door?: string;
  extras?: string;
  instructions?: string;
  placeId?: string;
  state?: string;
  street?: string;
  title?: string;
  ward?: string;
}

interface LocationWithAddress {
  gps: Location;
  address: Address;
}

// Auth API Types
interface GetTokenArgs {
  country: string;
  mobileNumber: string;
  accessCode: string;
}

interface GetTokenRequest {
  appSecretCode: string;
  userMobileNo: string;
}

interface PersonAPIEntity {
  id: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  maskedMobileNumber?: string;
}

interface GetTokenResponse {
  authId: string;
  attempts: number;
  authType: string;
  token?: string;
  person?: PersonAPIEntity;
  isPersonBlocked: boolean;
}

// Places API Types
interface GetPlacesArgs {
  token: string; // Obfuscated token from get_token response
  searchText: string;
  sourceLat?: number;
  sourceLon?: number;
}

interface AutoCompleteRequest {
  autoCompleteType: string;
  input: string;
  language: string;
  location?: string;
  origin?: Location;
  radius: number;
  radiusWithUnit: {
    unit: string;
    value: number;
  };
  sessionToken?: string;
  strictbounds: boolean;
  types_?: string;
}

interface Prediction {
  description: string;
  distance?: number;
  distanceWithUnit?: {
    unit: string;
    value: number;
  };
  placeId: string;
  types?: string[];
}

interface AutoCompleteResponse {
  predictions: Prediction[];
}

// Place Details API Types
interface GetPlaceDetailsArgs {
  token: string; // Obfuscated token from get_token response
  placeId?: string; // For place ID lookup
  lat?: number; // For lat/lon lookup
  lon?: number; // For lat/lon lookup
}

interface GetPlaceDetailsRequestByPlaceId {
  getBy: {
    contents: string;
    tag: "ByPlaceId";
  };
  language: string;
  sessionToken: string;
}

interface GetPlaceDetailsRequestByLatLong {
  getBy: {
    contents: {
      lat: number;
      lon: number;
    };
    tag: "ByLatLong";
  };
  language: string;
  sessionToken: string;
}

type GetPlaceDetailsRequest = GetPlaceDetailsRequestByPlaceId | GetPlaceDetailsRequestByLatLong;

interface GetPlaceDetailsResponse {
  lat: number;
  lon: number;
  placeId: string;
  address: Address;
}

// Search Ride API Types
interface SearchRideArgs {
  token: string; // Obfuscated token from get_token response
  originLat: number | string; // Can be number or string like "12.9352,77.6245"
  originLon?: number; // Optional if originLat is "lat,lon" string
  originAddress?: Address; // Optional - will be auto-generated if not provided
  destinationLat: number | string; // Can be number or string like "12.9716,77.5946"
  destinationLon?: number; // Optional if destinationLat is "lat,lon" string
  destinationAddress?: Address; // Optional - will be auto-generated if not provided
}

interface SearchRideRequest {
  contents: {
    origin: LocationWithAddress;
    destination: LocationWithAddress;
    placeNameSource: string;
    platformType: string;
    driverIdentifier?: {
      type: string;
      value: string;
    };
  };
  fareProductType: string;
}

interface SearchRideResponse {
  searchId: string;
}

interface FareBreakup {
  price: number;
  priceWithCurrency: Currency;
  title: string;
}

interface NightShiftInfo {
  nightShiftCharge: number;
  nightShiftChargeWithCurrency: Currency;
  nightShiftEnd: string;
  nightShiftStart: string;
  oldNightShiftCharge: number;
}

interface TollChargesInfo {
  tollChargesWithCurrency: Currency;
  tollNames: string[];
}

interface WaitingCharges {
  waitingChargePerMin: number;
  waitingChargePerMinWithCurrency: Currency;
}

interface FareRange {
  maxFare: number;
  maxFareWithCurrency: Currency;
  minFare: number;
  minFareWithCurrency: Currency;
}

interface RideEstimate {
  id: string;
  estimatedFare: number;
  estimatedFareWithCurrency: Currency;
  estimatedTotalFare: number;
  estimatedTotalFareWithCurrency: Currency;
  estimatedPickupDuration: number;
  vehicleVariant: string;
  serviceTierType: string;
  serviceTierName: string;
  serviceTierShortDesc?: string;
  providerName: string;
  providerId: string;
  providerLogoUrl?: string;
  validTill: string;
  estimateFareBreakup?: FareBreakup[];
  nightShiftInfo?: NightShiftInfo;
  tollChargesInfo?: TollChargesInfo;
  waitingCharges?: WaitingCharges;
  totalFareRange?: FareRange;
  tipOptions?: number[];
  smartTipSuggestion?: number;
  smartTipReason?: string;
  isAirConditioned?: boolean;
  vehicleServiceTierSeatingCapacity?: number;
  tripTerms?: string[];
  specialLocationTag?: string;
  isBlockedRoute?: boolean;
  isCustomerPrefferedSearchRoute?: boolean;
  isInsured?: boolean;
  insuredAmount?: string;
  isReferredRide?: boolean;
  agencyName?: string;
  agencyNumber?: string;
  agencyCompletedRidesCount?: number;
}

interface SearchResultsResponse {
  estimates: RideEstimate[];
  fromLocation: Address & { id?: string; lat: number; lon: number };
  toLocation: Address & { id?: string; lat: number; lon: number };
  allJourneysLoaded: boolean;
}

// Add Tip API Types
interface AddTipArgs {
  token: string; // Obfuscated token from get_token response
  estimateId: string;
  tipAmount: number;
  tipCurrency: string;
}

interface SelectEstimateRequest {
  autoAssignEnabled: boolean;
  autoAssignEnabledV2: boolean;
  paymentMethodId: string;
  customerExtraFeeWithCurrency?: Currency;
  customerExtraFee?: number;
  otherSelectedEstimates: string[];
  disabilityDisable: boolean;
  isPetRide: boolean;
  deliveryDetails?: unknown;
  isAdvancedBookingEnabled?: boolean;
}

// Select Estimate Types
interface SelectEstimateArgs {
  token: string; // Obfuscated token from get_token response
  primaryEstimateId: string;
  additionalEstimateIds?: string[]; // Optional - for multiple variants
  specialAssistance?: boolean;
  isPetRide?: boolean;
}

// Cancel Search Types
interface CancelSearchArgs {
  token: string; // Obfuscated token from get_token response
  estimateId: string;
}

// Fetch Status Types
interface FetchStatusArgs {
  token: string; // Obfuscated token from get_token response
  limit?: number;
  offset?: number;
  onlyActive?: boolean;
  status?: string[];
}

interface RideBooking {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  fromLocation: Address & Location;
  toLocation?: Address & Location;
  estimatedFare: number;
  driverName?: string;
  vehicleNumber?: string;
  vehicleVariant?: string;
}

interface FetchStatusResponse {
  list: RideBooking[];
}

// Cancel Booking Types
interface CancelBookingArgs {
  token: string; // Obfuscated token from get_token response
  bookingId: string;
  reasonCode: string;
  reasonStage: "OnSearch" | "OnInit" | "OnConfirm" | "OnAssign";
  additionalInfo?: string;
  reallocate?: boolean;
}

interface CancelBookingRequest {
  reasonCode: string;
  reasonStage: string;
  additionalInfo?: string;
  reallocate?: boolean;
}

// Get Booking Details Types
interface GetBookingDetailsArgs {
  token: string; // Obfuscated token from get_token response
  bookingId: string;
}

interface BookingStatusAPIEntity {
  id: string;
  bookingStatus: string;
  isBookingUpdated: boolean;
  rideStatus?: string;
  talkedWithDriver: boolean;
  stopInfo: unknown[];
  isSafetyPlus: boolean;
  driverArrivalTime?: string;
  destinationReachedAt?: string;
  estimatedEndTimeRange?: unknown;
  driversPreviousRideDropLocLat?: number;
  driversPreviousRideDropLocLon?: number;
  sosStatus?: string;
  batchConfig?: unknown;
}

// Get Ride Status Types
interface GetRideStatusArgs {
  token: string; // Obfuscated token from get_token response
  rideId: string;
}

interface RideAPIEntity {
  id: string;
  status: string;
  rideOtp: string;
  shortRideId: string;
  driverName: string;
  driverNumber?: string;
  driverImage?: string;
  driverRatings?: number;
  vehicleNumber: string;
  vehicleVariant: string;
  vehicleModel: string;
  vehicleColor: string;
  createdAt: string;
  updatedAt: string;
  rideStartTime?: string;
  rideEndTime?: string;
  computedPrice?: number;
  computedPriceWithCurrency?: Currency;
  chargeableRideDistance?: number;
  chargeableRideDistanceWithUnit?: { unit: string; value: number };
  traveledRideDistance?: { unit: string; value: number };
  tipAmount?: { amount: number; currency: string };
  onlinePayment: boolean;
  feedbackSkipped: boolean;
  isPetRide: boolean;
  isSafetyPlus: boolean;
  paymentStatus: string;
  endOtp?: string;
  talkedWithDriver: boolean;
  stopsInfo: unknown[];
  billingCategory: string;
}

interface GetRideStatusResponse {
  ride: RideAPIEntity;
  fromLocation: Address & { lat: number; lon: number };
  toLocation?: Address & { lat: number; lon: number };
  driverPosition?: { lat: number; lon: number };
  customer: PersonAPIEntity;
}

// Post-Ride Tip Types
interface PostRideTipArgs {
  token: string; // Obfuscated token from get_token response
  rideId: string;
  tipAmount: number;
  tipCurrency?: string;
}

interface AddTipRequest {
  amount: {
    amount: number;
    currency: string;
  };
}

// Get Cancellation Reasons Types
interface GetCancellationReasonsArgs {
  token: string; // Obfuscated token from get_token response
  cancellationStage: "OnSearch" | "OnInit" | "OnConfirm" | "OnAssign";
}

interface CancellationReasonAPIEntity {
  reasonCode: string;
  description: string;
}

// Get Price Breakdown Types
interface GetPriceBreakdownArgs {
  token: string; // Obfuscated token from get_token response
  bookingId: string;
}

interface QuoteBreakupAPIEntity {
  title: string;
  priceWithCurrency: {
    amount: number;
    currency: string;
  };
}

interface QuoteBreakupRes {
  quoteBreakup: QuoteBreakupAPIEntity[];
}

// Saved Locations Types
interface GetSavedLocationsArgs {
  token: string; // Obfuscated token from get_token response
}

interface SavedReqLocationAPIEntity {
  lat: number;
  lon: number;
  tag: string;
  area?: string;
  areaCode?: string;
  building?: string;
  city?: string;
  country?: string;
  door?: string;
  locationName?: string;
  placeId?: string;
  state?: string;
  street?: string;
  ward?: string;
}

interface SavedReqLocationsListRes {
  list: SavedReqLocationAPIEntity[];
}

// ============================================================================
// FRFS (metro / bus / suburban rail) + Multimodal Journey Types
// ============================================================================

type FrfsVehicleType = "METRO" | "BUS" | "SUBWAY";

interface FrfsStationAPI {
  code: string;
  name?: string;
  address?: string;
  lat?: number;
  lon?: number;
  routeCodes?: string[];
}

interface FrfsQuoteAPI {
  quoteId: string;
  price: number;
  quantity: number;
  validTill?: string;
  serviceTierName?: string;
  vehicleType?: string;
  routeCode?: string;
  stations?: FrfsStationAPI[];
}

interface FrfsSearchResponse {
  searchId: string;
  quotes?: FrfsQuoteAPI[];
}

interface FrfsTicketAPI {
  ticketNumber: string;
  qrData: string;
  status: string;
  validTill?: string;
  description?: string;
}

interface FrfsBookingAPI {
  bookingId: string;
  status: string;
  price: number;
  quantity: number;
  city?: string;
  vehicleType?: string;
  validTill?: string;
  createdAt?: string;
  stations?: FrfsStationAPI[];
  tickets?: FrfsTicketAPI[];
  payment?: {
    status?: string;
    transactionId?: string;
    paymentOrder?: {
      order_id?: string;
      payment_links?: { web?: string; mobile?: string; deep_link?: string; iframe?: string };
    };
  };
}

interface JourneyLegAPI {
  journeyLegId?: string;
  order?: number;
  /** Absent until the leg's fare has been resolved; booking before it lands
   *  confirms an unpriced leg. */
  pricingId?: string;
  travelMode?: string;
  mode?: string;
  bookingAllowed?: boolean;
  bookingStatus?: string;
  estimatedDuration?: number;
  duration?: number;
  estimatedMinFare?: { amount?: number };
  estimatedMaxFare?: { amount?: number };
  legExtraInfo?: { contents?: Record<string, unknown> } & Record<string, unknown>;
}

interface JourneyDataAPI {
  journeyId: string;
  modes?: string[];
  journeyLegs?: JourneyLegAPI[];
  totalMinFare?: number;
  totalMaxFare?: number;
  duration?: number;
  distance?: { value?: number };
}

interface MultimodalSearchResponse {
  searchId: string;
  journeys?: JourneyDataAPI[];
}

interface JourneyInfoResponse {
  journeyId: string;
  journeyStatus: string;
  legs?: JourneyLegAPI[];
  estimatedMinFare?: { amount?: number };
  estimatedMaxFare?: { amount?: number };
  estimatedDuration?: number;
  unifiedQRV2?: string;
  paymentOrderShortId?: string;
}

// --- Tool argument shapes ---

interface SearchTransitStationsArgs {
  token: string;
  vehicleType: FrfsVehicleType;
  searchText: string;
  city?: string;
  lat?: number;
  lon?: number;
}

interface SearchTransitTicketsArgs {
  token: string;
  vehicleType: FrfsVehicleType;
  fromStationCode: string;
  toStationCode: string;
  quantity?: number;
}

interface ConfirmTransitTicketArgs {
  token: string;
  quoteId: string;
}

interface GetTransitTicketArgs {
  token: string;
  bookingId: string;
}

interface ListTransitTicketsArgs {
  token: string;
}

interface CancelTransitTicketArgs {
  token: string;
  bookingId: string;
}

interface SearchJourneysArgs {
  token: string;
  originLat: number | string;
  originLon?: number;
  originAddress?: Address;
  destinationLat: number | string;
  destinationLon?: number;
  destinationAddress?: Address;
}

interface BookJourneyArgs {
  token: string;
  journeyId: string;
}

interface GetJourneyArgs {
  token: string;
  journeyId: string;
}

interface CancelJourneyArgs {
  token: string;
  journeyId: string;
  legOrder?: number;
}

// ============================================================================
// Namma Yatri MCP Server
// ============================================================================

interface StoredToken {
  token: string;
  savedAt: string; // ISO timestamp
  person?: PersonAPIEntity;
}

interface SessionData {
  realToken: string; // Deobfuscated real token
  currentSearchId: string | null;
  currentEstimateId: string | null;
}

class NammaYatriMCPServer {
  private server: Server;
  // Session management: keyed by obfuscated token (what user receives)
  private sessions: Map<string, SessionData> = new Map();
  // Active SSE connections: keyed by connection ID
  private activeConnections: Map<string, { transport: SSEServerTransport; res: any; keepAliveInterval: NodeJS.Timeout }> = new Map();
  private connectionCounter = 0;

  constructor() {
    this.server = new Server(
      {
        name: "ny-connectors",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    console.error("[STARTUP] Initializing MCP server with session-based token management...");
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: "get_token",
          description:
            "Authenticates user with Namma Yatri and stores auth token for subsequent requests. If the user does not know their access code, tell them: 'You can find your access code in the Namma Yatri app under the About Us section.'",
          inputSchema: {
            type: "object",
            properties: {
              country: {
                type: "string",
                description: "User's country code (e.g., 'IN')",
              },
              mobileNumber: {
                type: "string",
                description: "User's mobile number",
              },
              accessCode: {
                type: "string",
                description: "App secret access code. Found in the Namma Yatri app under About Us section.",
              },
            },
            required: ["country", "mobileNumber", "accessCode"],
          },
        },
        {
          name: "get_places",
          description:
            "Searches for places using autocomplete. Returns list of matching addresses. CRITICAL: You MUST present ALL results to the user as a numbered list (1, 2, 3, etc.) and ask them to choose which place they want. DO NOT automatically select the first result or any result without explicit user confirmation. Wait for the user to tell you which number/option they want before proceeding. Only after the user selects a specific option should you call get_place_details with the chosen placeId. TOKEN REQUIREMENT: Before calling this tool, check if ~/.namma-yatri-mcp/user-token.json exists on the USER'S LOCAL MACHINE. If it exists, read the 'token' field from that file and use it as the 'token' parameter. If the file doesn't exist, call get_token first to authenticate. The token file is stored locally by the user, not on the remote server.",
          inputSchema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "Obfuscated token from get_token response",
              },
              searchText: {
                type: "string",
                description: "Location name or address to search for",
              },
              sourceLat: {
                type: "number",
                description: "Optional source latitude for proximity search",
              },
              sourceLon: {
                type: "number",
                description: "Optional source longitude for proximity search",
              },
            },
            required: ["token", "searchText"],
          },
        },
        {
          name: "get_place_details",
          description:
            "Gets detailed location information including lat/lon. Can be called with either a placeId (from get_places) or lat/lon coordinates directly. For lat/lon: pass lat and lon numbers. For place ID: pass placeId string. TOKEN REQUIREMENT: Before calling this tool, check if ~/.namma-yatri-mcp/user-token.json exists on the USER'S LOCAL MACHINE. If it exists, read the 'token' field from that file and use it as the 'token' parameter. If the file doesn't exist, call get_token first to authenticate. The token file is stored locally by the user, not on the remote server.",
          inputSchema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "Obfuscated token from get_token response",
              },
              placeId: {
                type: "string",
                description: "The place ID to get details for (from get_places response)",
              },
              lat: {
                type: "number",
                description: "Latitude for direct coordinate lookup",
              },
              lon: {
                type: "number",
                description: "Longitude for direct coordinate lookup",
              },
            },
            required: ["token"],
            // Either placeId OR (lat AND lon) must be provided
          },
        },
        {
          name: "search_ride",
          description:
            "Searches for available rides between origin and destination. Polls for results until estimates are available. IMPORTANT: Always show the list of available estimates (with fare, vehicle type, etc.) to the user and ask them to select which estimate(s) they want to book. Users can choose 1 or more estimates. Do NOT automatically choose an estimate unless the user explicitly instructs you to be strict/auto-select. SAVED LOCATIONS FLOW: Before looking up places, read ~/.namma-yatri-mcp/user-token.json and check 'savedLocations'. Step 1: If 'savedLocationsUpdatedAt' is older than 24 hours, silently call get_saved_locations first to refresh, update the file, then proceed. Step 2: For each location (origin/destination), check if it matches a saved location tag (case-insensitive). If found, use that entry's lat/lon/address directly — skip get_places/get_place_details. Step 3: If a location name sounds like a personal saved location (e.g., 'home', 'work', 'office', 'gym') but is NOT in savedLocations, silently call get_saved_locations to refresh and check again. If still not found after refresh, fall back to get_places. Step 4: For locations not in savedLocations and not personal-sounding, use get_places as normal. Parameters: originLat (number or 'lat,lon' string), originLon (number, optional if originLat is string), originAddress (object from get_place_details response or savedLocations entry), destinationLat (number or 'lat,lon' string), destinationLon (number, optional if destinationLat is string), destinationAddress (object from get_place_details response or savedLocations entry). TOKEN REQUIREMENT: Before calling this tool, check if ~/.namma-yatri-mcp/user-token.json exists on the USER'S LOCAL MACHINE. If it exists, read the 'token' field from that file and use it as the 'token' parameter. If the file doesn't exist, call get_token first to authenticate. The token file is stored locally by the user, not on the remote server.",
          inputSchema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "Obfuscated token from get_token response",
              },
              originLat: {
                oneOf: [
                  { type: "number", description: "Origin latitude as number" },
                  { type: "string", description: "Origin coordinates as 'lat,lon' string (e.g., '12.9352,77.6245')" },
                ],
                description: "Origin latitude (number) or 'lat,lon' string",
              },
              originLon: {
                type: "number",
                description: "Origin longitude (required only if originLat is a number, not needed if originLat is 'lat,lon' string)",
              },
              originAddress: {
                type: "object",
                description: "Origin address details. For normal searches: Use the complete address object from get_place_details response. For direct coordinate inputs: Optional - will be auto-generated from coordinates if not provided.",
                properties: {
                  area: { type: "string" },
                  areaCode: { type: "string" },
                  building: { type: "string" },
                  city: { type: "string" },
                  country: { type: "string" },
                  door: { type: "string" },
                  extras: { type: "string" },
                  instructions: { type: "string" },
                  placeId: { type: "string" },
                  state: { type: "string" },
                  street: { type: "string" },
                  title: { type: "string" },
                  ward: { type: "string" },
                },
              },
              destinationLat: {
                oneOf: [
                  { type: "number", description: "Destination latitude as number" },
                  { type: "string", description: "Destination coordinates as 'lat,lon' string (e.g., '12.9716,77.5946')" },
                ],
                description: "Destination latitude (number) or 'lat,lon' string",
              },
              destinationLon: {
                type: "number",
                description: "Destination longitude (required only if destinationLat is a number, not needed if destinationLat is 'lat,lon' string)",
              },
              destinationAddress: {
                type: "object",
                description: "Destination address details. For normal searches: Use the complete address object from get_place_details response. For direct coordinate inputs: Optional - will be auto-generated from coordinates if not provided.",
                properties: {
                  area: { type: "string" },
                  areaCode: { type: "string" },
                  building: { type: "string" },
                  city: { type: "string" },
                  country: { type: "string" },
                  door: { type: "string" },
                  extras: { type: "string" },
                  instructions: { type: "string" },
                  placeId: { type: "string" },
                  state: { type: "string" },
                  street: { type: "string" },
                  title: { type: "string" },
                  ward: { type: "string" },
                },
              },
            },
            required: ["token", "originLat", "destinationLat"],
          },
        },
        {
          name: "add_tip",
          description:
            "Adds a tip to a ride estimate and selects it for booking. IMPORTANT: Only call this after the user has explicitly selected which estimate(s) they want to book. Users can choose 1 or more estimates. Do NOT automatically select an estimate - always show the list from search_ride and ask the user to choose first. TOKEN REQUIREMENT: Before calling this tool, check if ~/.namma-yatri-mcp/user-token.json exists on the USER'S LOCAL MACHINE. If it exists, read the 'token' field from that file and use it as the 'token' parameter. If the file doesn't exist, call get_token first to authenticate. The token file is stored locally by the user, not on the remote server.",
          inputSchema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "Obfuscated token from get_token response",
              },
              estimateId: {
                type: "string",
                description: "The estimate ID to add tip to",
              },
              tipAmount: {
                type: "number",
                description: "Tip amount",
              },
              tipCurrency: {
                type: "string",
                description: "Currency code (e.g., 'INR')",
                default: "INR",
              },
            },
            required: ["token", "estimateId", "tipAmount"],
          },
        },
        {
          name: "select_estimate",
          description:
            "Selects one or multiple ride estimates for booking. Can be used to select a single estimate or multiple variants to increase chances of getting a ride. IMPORTANT: Only call this after the user has explicitly selected which estimate(s) they want to book. Do NOT automatically select estimates - always show the list from search_ride and ask the user to choose first. TOKEN REQUIREMENT: Before calling this tool, check if ~/.namma-yatri-mcp/user-token.json exists on the USER'S LOCAL MACHINE. If it exists, read the 'token' field from that file and use it as the 'token' parameter. If the file doesn't exist, call get_token first to authenticate. The token file is stored locally by the user, not on the remote server.",
          inputSchema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "Obfuscated token from get_token response",
              },
              primaryEstimateId: {
                type: "string",
                description: "Primary estimate ID to book (required)",
              },
              additionalEstimateIds: {
                type: "array",
                items: { type: "string" },
                description: "Additional estimate IDs to select (optional - for multiple variants)",
              },
              specialAssistance: {
                type: "boolean",
                description: "Whether special assistance is needed",
                default: false,
              },
              isPetRide: {
                type: "boolean",
                description: "Whether it's a pet ride",
                default: false,
              },
            },
            required: ["token", "primaryEstimateId"],
          },
        },
        {
          name: "cancel_search",
          description: "Cancels an active ride search. Can be called while polling for search results to stop the search early. TOKEN REQUIREMENT: Before calling this tool, check if ~/.namma-yatri-mcp/user-token.json exists on the USER'S LOCAL MACHINE. If it exists, read the 'token' field from that file and use it as the 'token' parameter. If the file doesn't exist, call get_token first to authenticate. The token file is stored locally by the user, not on the remote server.",
          inputSchema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "Obfuscated token from get_token response",
              },
              estimateId: {
                type: "string",
                description: "The estimate ID to cancel",
              },
            },
            required: ["token", "estimateId"],
          },
        },
        {
          name: "fetch_status",
          description:
            "Fetches the status of ride bookings (active or historical). TOKEN REQUIREMENT: Before calling this tool, check if ~/.namma-yatri-mcp/user-token.json exists on the USER'S LOCAL MACHINE. If it exists, read the 'token' field from that file and use it as the 'token' parameter. If the file doesn't exist, call get_token first to authenticate. The token file is stored locally by the user, not on the remote server.",
          inputSchema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "Obfuscated token from get_token response",
              },
              limit: {
                type: "number",
                description: "Maximum number of results",
              },
              offset: {
                type: "number",
                description: "Offset for pagination",
              },
              onlyActive: {
                type: "boolean",
                description: "Only return active rides",
                default: true,
              },
              status: {
                type: "array",
                items: { type: "string" },
                description: "Filter by status values",
              },
            },
          },
        },
        {
          name: "get_saved_locations",
          description:
            "Retrieves the user's saved locations (e.g., Home, Work) from the Namma Yatri API. These can be used directly as origin or destination in search_ride without needing get_places/get_place_details. Saved locations are fetched during authentication and cached in ~/.namma-yatri-mcp/user-token.json with a 'savedLocationsUpdatedAt' timestamp. WHEN TO CALL THIS TOOL: (1) DAILY REFRESH: If 'savedLocationsUpdatedAt' in the token file is older than 24 hours, call this tool silently at the start of the session to refresh — do NOT ask the user. (2) USER REQUEST: When the user explicitly asks to refresh or update saved locations. (3) SMART DETECT: When a user mentions a location name that sounds like it could be a saved location (e.g., 'home', 'work', 'office', 'gym', 'mom\'s place') but it is NOT in the local savedLocations list — silently call this tool to check if it was recently added, then update the local file. Do NOT ask the user before refreshing in this case. After calling, update BOTH the 'savedLocations' array AND the 'savedLocationsUpdatedAt' timestamp in ~/.namma-yatri-mcp/user-token.json. TOKEN REQUIREMENT: Before calling this tool, check if ~/.namma-yatri-mcp/user-token.json exists on the USER'S LOCAL MACHINE. If it exists, read the 'token' field from that file and use it as the 'token' parameter. If the file doesn't exist, call get_token first to authenticate.",
          inputSchema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "Obfuscated token from get_token response",
              },
            },
            required: ["token"],
          },
        },
        {
          name: "get_cancellation_reasons",
          description:
            "Fetches valid cancellation reasons for a given stage. This is a prerequisite for cancel_booking — call this first to get valid reason codes. Use 'OnConfirm' for cancelling before driver assignment, 'OnAssign' for cancelling after driver assignment. TOKEN REQUIREMENT: Before calling this tool, check if ~/.namma-yatri-mcp/user-token.json exists on the USER'S LOCAL MACHINE. If it exists, read the 'token' field from that file and use it as the 'token' parameter. If the file doesn't exist, call get_token first to authenticate.",
          inputSchema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "Obfuscated token from get_token response",
              },
              cancellationStage: {
                type: "string",
                enum: ["OnSearch", "OnInit", "OnConfirm", "OnAssign"],
                description: "The cancellation stage. Use 'OnConfirm' for confirmed bookings without a driver, 'OnAssign' for bookings with an assigned driver.",
              },
            },
            required: ["token", "cancellationStage"],
          },
        },
        {
          name: "cancel_booking",
          description:
            "Cancels a CONFIRMED ride booking. This is different from cancel_search which cancels a search/estimate — this cancels an actual confirmed booking. IMPORTANT: Call get_cancellation_reasons first to get valid reason codes. Use 'OnConfirm' stage if no driver assigned, 'OnAssign' if a driver is assigned. TOKEN REQUIREMENT: Before calling this tool, check if ~/.namma-yatri-mcp/user-token.json exists on the USER'S LOCAL MACHINE. If it exists, read the 'token' field from that file and use it as the 'token' parameter. If the file doesn't exist, call get_token first to authenticate.",
          inputSchema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "Obfuscated token from get_token response",
              },
              bookingId: {
                type: "string",
                description: "The booking ID to cancel (from fetch_status or select_estimate response)",
              },
              reasonCode: {
                type: "string",
                description: "Cancellation reason code (from get_cancellation_reasons)",
              },
              reasonStage: {
                type: "string",
                enum: ["OnSearch", "OnInit", "OnConfirm", "OnAssign"],
                description: "The cancellation stage matching the booking state",
              },
              additionalInfo: {
                type: "string",
                description: "Optional free-text additional cancellation reason",
              },
              reallocate: {
                type: "boolean",
                description: "Whether to try reallocating to another driver (only for OnAssign stage)",
              },
            },
            required: ["token", "bookingId", "reasonCode", "reasonStage"],
          },
        },
        {
          name: "get_booking_details",
          description:
            "Fetches full details of a specific booking by ID. Returns booking status, ride status, driver info, safety info, stop info, and more. Use this to check detailed status of a confirmed booking. TOKEN REQUIREMENT: Before calling this tool, check if ~/.namma-yatri-mcp/user-token.json exists on the USER'S LOCAL MACHINE. If it exists, read the 'token' field from that file and use it as the 'token' parameter. If the file doesn't exist, call get_token first to authenticate.",
          inputSchema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "Obfuscated token from get_token response",
              },
              bookingId: {
                type: "string",
                description: "The booking ID to get details for",
              },
            },
            required: ["token", "bookingId"],
          },
        },
        {
          name: "get_ride_status",
          description:
            "Gets real-time status of an active ride including driver position for live tracking. This is different from fetch_status which lists bookings — this provides live tracking info for a specific ride. The driverPosition field shows the driver's current lat/lon. TOKEN REQUIREMENT: Before calling this tool, check if ~/.namma-yatri-mcp/user-token.json exists on the USER'S LOCAL MACHINE. If it exists, read the 'token' field from that file and use it as the 'token' parameter. If the file doesn't exist, call get_token first to authenticate.",
          inputSchema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "Obfuscated token from get_token response",
              },
              rideId: {
                type: "string",
                description: "The ride ID to get status for (from booking details or fetch_status)",
              },
            },
            required: ["token", "rideId"],
          },
        },
        {
          name: "post_ride_tip",
          description:
            "Adds a tip AFTER a ride has been completed. This is different from add_tip which adds a pre-ride tip during estimate selection. Use this to tip the driver after the ride is finished. TOKEN REQUIREMENT: Before calling this tool, check if ~/.namma-yatri-mcp/user-token.json exists on the USER'S LOCAL MACHINE. If it exists, read the 'token' field from that file and use it as the 'token' parameter. If the file doesn't exist, call get_token first to authenticate.",
          inputSchema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "Obfuscated token from get_token response",
              },
              rideId: {
                type: "string",
                description: "The ride ID to add tip to (from booking details or ride status)",
              },
              tipAmount: {
                type: "number",
                description: "Tip amount",
              },
              tipCurrency: {
                type: "string",
                description: "Currency code (default: 'INR')",
                default: "INR",
              },
            },
            required: ["token", "rideId", "tipAmount"],
          },
        },
        {
          name: "get_price_breakdown",
          description:
            "Shows detailed fare breakdown for a specific booking — base fare, distance charge, time charge, surge, tolls, etc. TOKEN REQUIREMENT: Before calling this tool, check if ~/.namma-yatri-mcp/user-token.json exists on the USER'S LOCAL MACHINE. If it exists, read the 'token' field from that file and use it as the 'token' parameter. If the file doesn't exist, call get_token first to authenticate.",
          inputSchema: {
            type: "object",
            properties: {
              token: {
                type: "string",
                description: "Obfuscated token from get_token response",
              },
              bookingId: {
                type: "string",
                description: "The booking ID to get price breakdown for",
              },
            },
            required: ["token", "bookingId"],
          },
        },
        {
          name: "search_transit_stations",
          description:
            "Searches metro / bus / suburban-rail stations by name, for booking a public transport ticket. Returns station codes needed by search_transit_tickets. CRITICAL: present ALL results to the user as a numbered list and wait for them to choose — do not pick one automatically. TOKEN REQUIREMENT: pass the 'token' from get_token.",
          inputSchema: {
            type: "object",
            properties: {
              token: { type: "string", description: "Obfuscated token from get_token response" },
              vehicleType: {
                type: "string",
                enum: ["METRO", "BUS", "SUBWAY"],
                description: "Which transit network to search",
              },
              searchText: { type: "string", description: "Station name or part of it" },
              city: {
                type: "string",
                description: "City name such as 'Bangalore' or 'Chennai'. NOTE: this is a plain name, not a std: code. Defaults to Bangalore.",
              },
              lat: { type: "number", description: "Optional latitude to centre the search on" },
              lon: { type: "number", description: "Optional longitude to centre the search on" },
            },
            required: ["token", "vehicleType", "searchText"],
          },
        },
        {
          name: "search_transit_tickets",
          description:
            "Gets the fare quote for a public transport journey between two stations. Call search_transit_stations first to get the station codes. Returns a quoteId to pass to confirm_transit_ticket. TOKEN REQUIREMENT: pass the 'token' from get_token.",
          inputSchema: {
            type: "object",
            properties: {
              token: { type: "string", description: "Obfuscated token from get_token response" },
              vehicleType: {
                type: "string",
                enum: ["METRO", "BUS", "SUBWAY"],
                description: "Which transit network the journey is on",
              },
              fromStationCode: { type: "string", description: "Boarding station code from search_transit_stations" },
              toStationCode: { type: "string", description: "Destination station code from search_transit_stations" },
              quantity: { type: "number", description: "Number of tickets (default 1, max 6)" },
            },
            required: ["token", "vehicleType", "fromStationCode", "toStationCode"],
          },
        },
        {
          name: "confirm_transit_ticket",
          description:
            "Confirms a transit fare quote and creates the booking plus its payment order. Returns a payment link the user must open to pay, and a bookingId. IMPORTANT: this starts a real payment. Confirm the fare with the user before calling. After the user pays, call get_transit_ticket to collect the ticket. TOKEN REQUIREMENT: pass the 'token' from get_token.",
          inputSchema: {
            type: "object",
            properties: {
              token: { type: "string", description: "Obfuscated token from get_token response" },
              quoteId: { type: "string", description: "quoteId from search_transit_tickets" },
            },
            required: ["token", "quoteId"],
          },
        },
        {
          name: "get_transit_ticket",
          description:
            "Checks a transit booking and returns its tickets once payment has gone through. Poll this after confirm_transit_ticket until status is CONFIRMED. Each ticket carries a qrData string that the user shows at the gate — present it to them as text; it is the ticket. TOKEN REQUIREMENT: pass the 'token' from get_token.",
          inputSchema: {
            type: "object",
            properties: {
              token: { type: "string", description: "Obfuscated token from get_token response" },
              bookingId: { type: "string", description: "bookingId from confirm_transit_ticket" },
            },
            required: ["token", "bookingId"],
          },
        },
        {
          name: "list_transit_tickets",
          description:
            "Lists the user's transit ticket bookings, most recent first. Use this to find an existing ticket when the user asks about one they already bought. TOKEN REQUIREMENT: pass the 'token' from get_token.",
          inputSchema: {
            type: "object",
            properties: {
              token: { type: "string", description: "Obfuscated token from get_token response" },
            },
            required: ["token"],
          },
        },
        {
          name: "cancel_transit_ticket",
          description:
            "Cancels a transit ticket booking if the operator still allows it. Checks eligibility first and reports back if the ticket can no longer be cancelled. Confirm with the user before calling. TOKEN REQUIREMENT: pass the 'token' from get_token.",
          inputSchema: {
            type: "object",
            properties: {
              token: { type: "string", description: "Obfuscated token from get_token response" },
              bookingId: { type: "string", description: "bookingId of the ticket to cancel" },
            },
            required: ["token", "bookingId"],
          },
        },
        {
          name: "search_journeys",
          description:
            "Plans whole multimodal journeys between two points — sequences of walking, metro, bus and taxi legs — as an alternative to a single taxi ride. Takes the same coordinates as search_ride. CRITICAL: present ALL journey options to the user as a numbered list with their modes, fare and duration, and wait for them to choose. Returns a journeyId for book_journey. TOKEN REQUIREMENT: pass the 'token' from get_token.",
          inputSchema: {
            type: "object",
            properties: {
              token: { type: "string", description: "Obfuscated token from get_token response" },
              originLat: {
                type: ["number", "string"],
                description: "Origin latitude, or a 'lat,lon' string",
              },
              originLon: { type: "number", description: "Origin longitude (omit if originLat is a 'lat,lon' string)" },
              originAddress: { type: "object", description: "Full address object from get_place_details" },
              destinationLat: {
                type: ["number", "string"],
                description: "Destination latitude, or a 'lat,lon' string",
              },
              destinationLon: { type: "number", description: "Destination longitude (omit if destinationLat is a 'lat,lon' string)" },
              destinationAddress: { type: "object", description: "Full address object from get_place_details" },
            },
            required: ["token", "originLat", "destinationLat"],
          },
        },
        {
          name: "book_journey",
          description:
            "Books a multimodal journey: resolves its legs and confirms every leg the backend marks bookable. Returns a payment link when the journey needs paying for. IMPORTANT: this starts a real booking and payment. Confirm the journey and fare with the user before calling. Afterwards, poll get_journey. TOKEN REQUIREMENT: pass the 'token' from get_token.",
          inputSchema: {
            type: "object",
            properties: {
              token: { type: "string", description: "Obfuscated token from get_token response" },
              journeyId: { type: "string", description: "journeyId from search_journeys" },
            },
            required: ["token", "journeyId"],
          },
        },
        {
          name: "get_journey",
          description:
            "Checks a booked multimodal journey: its status, each leg, any ticket numbers, and the unified QR once issued. Poll this after book_journey until journeyStatus is CONFIRMED. TOKEN REQUIREMENT: pass the 'token' from get_token.",
          inputSchema: {
            type: "object",
            properties: {
              token: { type: "string", description: "Obfuscated token from get_token response" },
              journeyId: { type: "string", description: "journeyId from search_journeys" },
            },
            required: ["token", "journeyId"],
          },
        },
        {
          name: "cancel_journey",
          description:
            "Cancels a booked multimodal journey, leg by leg. Reports per leg whether it was cancelled and any refund. Pass legOrder to cancel a single leg (leg numbers come from get_journey); omit it to cancel every non-walking leg. Confirm with the user before calling. TOKEN REQUIREMENT: pass the 'token' from get_token.",
          inputSchema: {
            type: "object",
            properties: {
              token: { type: "string", description: "Obfuscated token from get_token response" },
              journeyId: { type: "string", description: "journeyId of the journey to cancel" },
              legOrder: { type: "number", description: "Optional: cancel only this leg (the number shown by get_journey)" },
            },
            required: ["token", "journeyId"],
          },
        },
      ];

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_token":
            return await this.handleGetToken(args as unknown as GetTokenArgs);

          case "get_places":
            return await this.handleGetPlaces(args as unknown as GetPlacesArgs);

          case "get_place_details":
            return await this.handleGetPlaceDetails(
              args as unknown as GetPlaceDetailsArgs
            );

          case "search_ride":
            return await this.handleSearchRide(
              args as unknown as SearchRideArgs
            );

          case "add_tip":
            return await this.handleAddTip(args as unknown as AddTipArgs);

            case "select_estimate":
            return await this.handleSelectEstimate(
              args as unknown as SelectEstimateArgs
            );

          case "cancel_search":
            return await this.handleCancelSearch(
              args as unknown as CancelSearchArgs
            );

          case "fetch_status":
            return await this.handleFetchStatus(
              args as unknown as FetchStatusArgs
            );

          case "get_saved_locations":
            return await this.handleGetSavedLocations(
              args as unknown as GetSavedLocationsArgs
            );

          case "get_cancellation_reasons":
            return await this.handleGetCancellationReasons(
              args as unknown as GetCancellationReasonsArgs
            );

          case "cancel_booking":
            return await this.handleCancelBooking(
              args as unknown as CancelBookingArgs
            );

          case "get_booking_details":
            return await this.handleGetBookingDetails(
              args as unknown as GetBookingDetailsArgs
            );

          case "get_ride_status":
            return await this.handleGetRideStatus(
              args as unknown as GetRideStatusArgs
            );

          case "post_ride_tip":
            return await this.handlePostRideTip(
              args as unknown as PostRideTipArgs
            );

          case "get_price_breakdown":
            return await this.handleGetPriceBreakdown(
              args as unknown as GetPriceBreakdownArgs
            );

          case "search_transit_stations":
            return await this.handleSearchTransitStations(
              args as unknown as SearchTransitStationsArgs
            );

          case "search_transit_tickets":
            return await this.handleSearchTransitTickets(
              args as unknown as SearchTransitTicketsArgs
            );

          case "confirm_transit_ticket":
            return await this.handleConfirmTransitTicket(
              args as unknown as ConfirmTransitTicketArgs
            );

          case "get_transit_ticket":
            return await this.handleGetTransitTicket(
              args as unknown as GetTransitTicketArgs
            );

          case "list_transit_tickets":
            return await this.handleListTransitTickets(
              args as unknown as ListTransitTicketsArgs
            );

          case "cancel_transit_ticket":
            return await this.handleCancelTransitTicket(
              args as unknown as CancelTransitTicketArgs
            );

          case "search_journeys":
            return await this.handleSearchJourneys(
              args as unknown as SearchJourneysArgs
            );

          case "book_journey":
            return await this.handleBookJourney(
              args as unknown as BookJourneyArgs
            );

          case "get_journey":
            return await this.handleGetJourney(
              args as unknown as GetJourneyArgs
            );

          case "cancel_journey":
            return await this.handleCancelJourney(
              args as unknown as CancelJourneyArgs
            );

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        let errorMessage =
          error instanceof Error ? error.message : String(error);
        
        // For authentication errors (401), enhance the error message with instructions
        if (error instanceof Error && (error as any).isAuthError) {
          const tokenFile = "~/.namma-yatri-mcp/user-token.json";
          errorMessage += `\n\nAUTHENTICATION ERROR: The token has expired or is invalid.`;
          errorMessage += `\nACTION REQUIRED: Use your file capabilities to delete the local token file at: ${tokenFile}`;
          errorMessage += `\nAfter clearing the token file, call get_token again to authenticate.`;
        }
        
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  // ============================================================================
  // Tool Handlers
  // ============================================================================

  private async handleGetToken(args: GetTokenArgs) {
    const request: GetTokenRequest = {
      appSecretCode: args.accessCode,
      userMobileNo: `${args.mobileNumber}`,
    };

    const response = await this.makeApiCall<GetTokenResponse>(
      "/auth/get-token",
      "POST",
      request,
      false
    );

    // Store token securely and create session
    console.error("[AUTH] Response: ", response);
    let obfuscatedToken: string | undefined;
    if (response.token) {
      const realToken = response.token;

      // Obfuscate token for user
      obfuscatedToken = this.obfuscateToken(realToken);

      // Create session with real token
      this.createSession(obfuscatedToken, realToken);

      console.error("[AUTH] Token obfuscated and session created");
      console.error(`[AUTH] Obfuscated token (use this in future calls): ${obfuscatedToken.substring(0, 20)}...`);
    }

    // Fetch saved locations immediately after authentication
    let savedLocations: SavedReqLocationAPIEntity[] = [];
    if (obfuscatedToken) {
      try {
        const savedLocationsResponse = await this.makeApiCall<SavedReqLocationsListRes>(
          "/savedLocation/list",
          "GET",
          undefined,
          true,
          obfuscatedToken
        );
        savedLocations = savedLocationsResponse.list || [];
        console.error(`[AUTH] Fetched ${savedLocations.length} saved location(s) for user`);
      } catch (error) {
        console.error(`[AUTH] Failed to fetch saved locations: ${(error as Error).message}`);
      }
    }

    // Return obfuscated token to user with clear instructions to save locally
    const localTokenPath = "~/.namma-yatri-mcp/user-token.json";
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              authenticated: !!response.token,
              obfuscatedToken: obfuscatedToken,
              authId: response.authId,
              attempts: response.attempts,
              authType: response.authType,
              person: response.person,
              isPersonBlocked: response.isPersonBlocked,
              savedLocations: savedLocations,
              instructions: [
                "IMPORTANT: You MUST save the tokenFileContent below to your local filesystem for future use.",
                `Save to: ${localTokenPath}`,
                "Use your file writing capabilities to create this file on the user's local machine.",
                "The file contains the token, the user's saved locations, and a 'savedLocationsUpdatedAt' timestamp.",
                "For all future tool calls, read the token from this local file first.",
                "If the file doesn't exist, call get_token again to authenticate.",
                "SAVED LOCATIONS USAGE: When the user asks to book a ride from A to B, check 'savedLocations' in this file. If A or B matches a tag (case-insensitive), use that location's lat/lon/address directly — skip get_places/get_place_details.",
                "DAILY REFRESH: At the start of each session, if 'savedLocationsUpdatedAt' is older than 24 hours, silently call get_saved_locations to refresh and update the file. Do NOT ask the user.",
                "SMART DETECT: If a location sounds like a personal saved location (home, work, office, etc.) but is NOT in savedLocations, silently call get_saved_locations to check for new entries before falling back to get_places.",
              ],
              tokenFileContent: obfuscatedToken ? {
                token: obfuscatedToken,
                savedAt: new Date().toISOString(),
                savedLocations: savedLocations,
                savedLocationsUpdatedAt: new Date().toISOString(),
              } : undefined,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleGetPlaces(args: GetPlacesArgs) {
    this.ensureAuthenticated(args.token);

    const request: AutoCompleteRequest = {
      autoCompleteType: "DROP",
      input: args.searchText,
      language: "ENGLISH",
      // Bias the search around the caller's coordinates when given, so a
      // lookup outside Bangalore returns local results. Falls back to the
      // Bangalore city centre when no coordinates are supplied.
      location:
        args.sourceLat !== undefined && args.sourceLon !== undefined
          ? `${args.sourceLat},${args.sourceLon}`
          : "12.97413032560963,77.58534937018615",
      origin:
        args.sourceLat !== undefined && args.sourceLon !== undefined
          ? { lat: args.sourceLat, lon: args.sourceLon }
          : undefined,
      radius: 50000,
      radiusWithUnit: {
        unit: "Meter",
        value: 50000.0,
      },
      sessionToken: undefined,
      strictbounds: false,
      types_: undefined,
    };

    const response = await this.makeApiCall<AutoCompleteResponse>(
      "/maps/autoComplete",
      "POST",
      request,
      true,
      args.token
    );

    // Format response to make it clear that user should choose
    const predictions = response.predictions || [];
    
    if (predictions.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No places found matching your search. Please try a different search term.",
          },
        ],
      };
    }

    // Format predictions as a numbered list with clear instructions
    let formattedText = `Found ${predictions.length} place(s) matching "${args.searchText}":\n\n`;
    formattedText += "**IMPORTANT: Please review the options below and tell me which number you'd like to select.**\n\n";
    
    predictions.forEach((prediction, index) => {
      const number = index + 1;
      formattedText += `${number}. ${prediction.description || prediction.placeId}\n`;
      if (prediction.placeId) {
        formattedText += `   Place ID: ${prediction.placeId}\n`;
      }
      if (prediction.distanceWithUnit) {
        formattedText += `   Distance: ${prediction.distanceWithUnit.value} ${prediction.distanceWithUnit.unit}\n`;
      } else if (prediction.distance !== undefined) {
        formattedText += `   Distance: ${prediction.distance} meters\n`;
      }
      formattedText += "\n";
    });

    formattedText += "\n**Please tell me which number (1-" + predictions.length + ") you want to select, or say 'none' if none of these match.**\n";
    formattedText += "\nDo NOT proceed automatically. Wait for the user's explicit choice before calling get_place_details.\n";

    // Also include raw JSON for reference
    formattedText += `\n\n---\nRaw response data (for reference):\n\`\`\`json\n${JSON.stringify(response, null, 2)}\n\`\`\``;

    return {
      content: [
        {
          type: "text" as const,
          text: formattedText,
        },
      ],
    };
  }

  private async handleGetPlaceDetails(args: GetPlaceDetailsArgs) {
    this.ensureAuthenticated(args.token);

    let request: GetPlaceDetailsRequest;

    // Check if lat/lon provided (for direct coordinate lookup)
    if (args.lat !== undefined && args.lon !== undefined) {
      request = {
        getBy: {
          contents: {
            lat: args.lat,
            lon: args.lon,
          },
          tag: "ByLatLong",
        },
        language: "ENGLISH",
        sessionToken: "default-token",
      };
    } else if (args.placeId) {
      // Use placeId lookup
      request = {
        getBy: {
          contents: args.placeId,
          tag: "ByPlaceId",
        },
        language: "ENGLISH",
        sessionToken: "default-token",
      };
    } else {
      throw new Error(
        "Either placeId or both lat and lon must be provided to get_place_details"
      );
    }

    const response = await this.makeApiCall<GetPlaceDetailsResponse>(
      "/maps/getPlaceName",
      "POST",
      request,
      true,
      args.token
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * Parses coordinate string like "12.9352,77.6245" or number and returns {lat, lon}
   */
  private parseCoordinates(
    latOrString: number | string,
    lon?: number
  ): { lat: number; lon: number } {
    // If lon is provided, treat latOrString as latitude (even if it's a string)
    if (lon !== undefined) {
      const lat = typeof latOrString === "string" ? parseFloat(latOrString) : latOrString;
      if (isNaN(lat) || isNaN(lon)) {
        throw new Error(
          `Invalid coordinate values. Could not parse lat/lon from: ${latOrString}, ${lon}`
        );
      }
      return { lat, lon };
    }
    
    // If lon is not provided, latOrString must be a "lat,lon" string
    if (typeof latOrString === "string") {
      // Parse "lat,lon" string format
      const parts = latOrString.split(",").map((s) => s.trim());
      if (parts.length !== 2) {
        throw new Error(
          `Invalid coordinate format. Expected "lat,lon" (e.g., "12.9352,77.6245") but got: ${latOrString}`
        );
      }
      const lat = parseFloat(parts[0]);
      const lon = parseFloat(parts[1]);
      if (isNaN(lat) || isNaN(lon)) {
        throw new Error(
          `Invalid coordinate values. Could not parse lat/lon from: ${latOrString}`
        );
      }
      return { lat, lon };
    } else {
      // Number format without lon - not allowed
      throw new Error(
        "originLon/destinationLon is required when originLat/destinationLat is a number"
      );
    }
  }

  /**
   * Creates a minimal address object from coordinates (fallback when no address provided)
   * Required fields: area, city, country, building, placeId, state
   */
  private createAddressFromCoordinates(lat: number, lon: number): Address {
    return {
      area: `${lat.toFixed(6)},${lon.toFixed(6)}`, // Required
      city: "", // Required but empty if unknown
      country: "", // Required but empty if unknown
      building: "", // Required but empty if unknown
      placeId: `${lat},${lon}`, // Required - use coordinates as placeId fallback
      state: "", // Required but empty if unknown
      // Optional fields not included
    };
  }

  private async handleSearchRide(args: SearchRideArgs) {
    this.ensureAuthenticated(args.token);
    const session = this.getSession(args.token);
    if (!session) {
      throw new Error("Session not found. Please authenticate again.");
    }

    // Parse origin coordinates
    const originCoords = this.parseCoordinates(args.originLat, args.originLon);
    
    // Parse destination coordinates
    const destCoords = this.parseCoordinates(
      args.destinationLat,
      args.destinationLon
    );

    // Use provided full address object (from get_place_details) or create minimal one as fallback
    // Required fields: area, city, country, building, placeId, state
    // Optional fields: areaCode, door, extras, instructions, street, title, ward (include if available)
    const originAddress: Address = args.originAddress
      ? {
          // Required fields (must be present)
          area: args.originAddress.area || "",
          city: args.originAddress.city || "",
          country: args.originAddress.country || "",
          building: args.originAddress.building || "",
          placeId: args.originAddress.placeId || "",
          state: args.originAddress.state || "",
          // Optional fields (include only if available)
          ...(args.originAddress.areaCode && { areaCode: args.originAddress.areaCode }),
          ...(args.originAddress.door && { door: args.originAddress.door }),
          ...(args.originAddress.extras && { extras: args.originAddress.extras }),
          ...(args.originAddress.instructions && { instructions: args.originAddress.instructions }),
          ...(args.originAddress.street && { street: args.originAddress.street }),
          ...(args.originAddress.title && { title: args.originAddress.title }),
          ...(args.originAddress.ward && { ward: args.originAddress.ward }),
        }
      : this.createAddressFromCoordinates(originCoords.lat, originCoords.lon);

    const destinationAddress: Address = args.destinationAddress
      ? {
          // Required fields (must be present)
          area: args.destinationAddress.area || "",
          city: args.destinationAddress.city || "",
          country: args.destinationAddress.country || "",
          building: args.destinationAddress.building || "",
          placeId: args.destinationAddress.placeId || "",
          state: args.destinationAddress.state || "",
          // Optional fields (include only if available)
          ...(args.destinationAddress.areaCode && { areaCode: args.destinationAddress.areaCode }),
          ...(args.destinationAddress.door && { door: args.destinationAddress.door }),
          ...(args.destinationAddress.extras && { extras: args.destinationAddress.extras }),
          ...(args.destinationAddress.instructions && { instructions: args.destinationAddress.instructions }),
          ...(args.destinationAddress.street && { street: args.destinationAddress.street }),
          ...(args.destinationAddress.title && { title: args.destinationAddress.title }),
          ...(args.destinationAddress.ward && { ward: args.destinationAddress.ward }),
        }
      : this.createAddressFromCoordinates(destCoords.lat, destCoords.lon);

    const request: SearchRideRequest = {
      contents: {
        origin: {
          gps: {
            lat: originCoords.lat,
            lon: originCoords.lon,
          },
          address: originAddress,
        },
        destination: {
          gps: {
            lat: destCoords.lat,
            lon: destCoords.lon,
          },
          address: destinationAddress,
        },
        placeNameSource: "API_MCP",
        platformType: "APPLICATION",
      },
      fareProductType: "ONE_WAY",
    };

    const searchResponse = await this.makeApiCall<SearchRideResponse>(
      "/rideSearch",
      "POST",
      request,
      true,
      args.token
    );

    // Store searchId in session
    session.currentSearchId = searchResponse.searchId;
    console.error(`[SESSION] Search initiated with ID: ${session.currentSearchId} for token ${args.token.substring(0, 10)}...`);

    // Poll for results
    const results = await this.pollSearchResults(searchResponse.searchId, args.token);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              searchId: searchResponse.searchId,
              ...results,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleAddTip(args: AddTipArgs) {
    this.ensureAuthenticated(args.token);
    const session = this.getSession(args.token);
    if (!session) {
      throw new Error("Session not found. Please authenticate again.");
    }

    const request: SelectEstimateRequest = {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: "",
      customerExtraFeeWithCurrency: {
        amount: args.tipAmount,
        currency: args.tipCurrency || "INR",
      },
      customerExtraFee: args.tipAmount,
      otherSelectedEstimates: [],
      disabilityDisable: true,
      isPetRide: false,
    };

    await this.makeApiCall(
      `/estimate/${args.estimateId}/select2`,
      "POST",
      request,
      true,
      args.token
    );

    // Store estimateId in session
    session.currentEstimateId = args.estimateId;

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              estimateId: args.estimateId,
              tipAdded: args.tipAmount,
              message: "Tip added and estimate selected successfully",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleSelectEstimate(
    args: SelectEstimateArgs
  ) {
    this.ensureAuthenticated(args.token);
    const session = this.getSession(args.token);
    if (!session) {
      throw new Error("Session not found. Please authenticate again.");
    }

    const request: SelectEstimateRequest = {
      autoAssignEnabled: true,
      autoAssignEnabledV2: true,
      paymentMethodId: "",
      otherSelectedEstimates: args.additionalEstimateIds || [],
      disabilityDisable: !(args.specialAssistance ?? false),
      isPetRide: args.isPetRide ?? false,
    };

    await this.makeApiCall(
      `/estimate/${args.primaryEstimateId}/select2`,
      "POST",
      request,
      true,
      args.token
    );

    // Store estimateId in session
    session.currentEstimateId = args.primaryEstimateId;

    console.error("[SELECT] Estimate selected, starting to poll for ride assignment...");

    // Automatically poll for ride assignment after selection
    try {
      const rideAssignment = await this.pollForRideAssignment(args.token);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                primaryEstimateId: args.primaryEstimateId,
                additionalEstimateIds: args.additionalEstimateIds,
                message: "Estimate selected successfully",
                rideAssignment: rideAssignment,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      // If polling fails or times out, still return success for selection
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                primaryEstimateId: args.primaryEstimateId,
                additionalEstimateIds: args.additionalEstimateIds,
                message: "Estimate selected successfully",
                rideAssignment: null,
                note: (error as Error).message,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  /**
   * Polls for ride assignment after estimate selection
   * Polls /rideBooking/list with onlyActive=true for up to 30 seconds
   */
  private async pollForRideAssignment(obfuscatedToken: string): Promise<RideBooking | null> {
    const startTime = Date.now();
    const MAX_POLLING_DURATION_MS = 30000; // 30 seconds
    const POLLING_INTERVAL_MS = 2000; // Poll every 2 seconds
    const maxEndTime = startTime + MAX_POLLING_DURATION_MS;

    console.error("[POLL] Starting to poll for ride assignment (max 30 seconds)...");

    while (Date.now() < maxEndTime) {
      try {
        const params = new URLSearchParams();
        params.append("onlyActive", "true");
        params.append("clientId", "ACP_SERVER");

        const endpoint = `/rideBooking/list?${params.toString()}`;
        const response = await this.makeApiCall<FetchStatusResponse>(
          endpoint,
          "GET",
          undefined,
          true,
          obfuscatedToken
        );

        // Check if we have any active rides
        if (response.list && response.list.length > 0) {
          const activeRide = response.list[0]; // Get the first active ride
          console.error(
            `[POLL] ✓ Ride assigned! Found after ${Date.now() - startTime}ms`
          );
          return activeRide;
        }

        const elapsed = Date.now() - startTime;
        console.error(
          `[POLL] No ride assigned yet, polling again... (${elapsed}ms elapsed)`
        );
        await this.sleep(POLLING_INTERVAL_MS);
      } catch (error) {
        console.error(`[POLL] Error while polling: ${(error as Error).message}`);
        // Continue polling despite errors
        await this.sleep(POLLING_INTERVAL_MS);
      }
    }

    // Timeout reached - no ride assigned
    console.error(
      `[POLL] Polling timeout after ${MAX_POLLING_DURATION_MS}ms - no ride assigned yet`
    );
    throw new Error(
      "No driver assigned yet. You will receive a notification on your phone when a driver is assigned."
    );
  }

  private async handleCancelSearch(args: CancelSearchArgs) {
    this.ensureAuthenticated(args.token);
    const session = this.getSession(args.token);
    if (!session) {
      throw new Error("Session not found. Please authenticate again.");
    }

    try {
      const response = await this.makeApiCall<{ success?: boolean; message?: string; error?: string }>(
        `/estimate/${args.estimateId}/cancelSearch`,
        "POST",
        {},
        true,
        args.token
      );

      // Check if the API response indicates failure
      if (response && typeof response === 'object' && 'success' in response && response.success === false) {
        const errorMessage = response.message || response.error || "Cancelling failed";
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: false,
                  estimateId: args.estimateId,
                  message: `Cancelling failed: ${errorMessage}`,
                  apiResponse: response,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Clear searchId from session if it matches
      if (session.currentSearchId === args.estimateId) {
        session.currentSearchId = null;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                estimateId: args.estimateId,
                message: "Search cancelled successfully",
                apiResponse: response,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      // Analyze error to provide meaningful message
      let errorMessage = "Cancelling failed";
      let errorCode: number | undefined;
      let errorDetails: string | undefined;
      let apiResponse: unknown = undefined;

      if (error instanceof Error) {
        errorDetails = error.message;
        
        // Extract status code from error object if available
        if ((error as any).statusCode) {
          errorCode = (error as any).statusCode;
        } else {
          // Try to extract HTTP status code from error message
          const statusMatch = error.message.match(/API call failed: (\d+)/);
          if (statusMatch) {
            errorCode = parseInt(statusMatch[1], 10);
          }
        }

        // Extract API response body from error if available
        if ((error as any).responseBody) {
          try {
            apiResponse = JSON.parse((error as any).responseBody);
          } catch {
            // If not JSON, use as string
            apiResponse = (error as any).responseBody;
          }
        } else {
          // Try to extract API response from error message if available
          try {
            const jsonMatch = error.message.match(/\{.*\}/s);
            if (jsonMatch) {
              apiResponse = JSON.parse(jsonMatch[0]);
            }
          } catch {
            // Ignore JSON parse errors
          }
        }
      }

      // Check if this is an authentication error
      if ((error as any).isAuthError || errorCode === 401) {
        const tokenFile = "~/.namma-yatri-mcp/user-token.json";
        errorMessage = `Cancelling failed: Authentication error (401). The token has expired or is invalid.`;
        errorMessage += `\nACTION REQUIRED: Use your file capabilities to delete the local token file at: ${tokenFile}`;
        errorMessage += `\nAfter clearing the token file, call get_token again to authenticate.`;
      } else if (errorCode) {
        // Provide specific error messages based on error code
        switch (errorCode) {
          case 404:
            errorMessage = "Cancelling failed: Estimate not found. It may have already been cancelled or expired.";
            break;
          case 400:
            errorMessage = "Cancelling failed: Invalid request. The estimate may not be in a cancellable state.";
            break;
          case 403:
            errorMessage = "Cancelling failed: Permission denied. You may not have permission to cancel this estimate.";
            break;
          case 409:
            errorMessage = "Cancelling failed: Conflict. The estimate may have already been processed or cancelled.";
            break;
          case 500:
          case 502:
          case 503:
            errorMessage = "Cancelling failed: Server error. Please try again later.";
            break;
          default:
            errorMessage = `Cancelling failed: HTTP ${errorCode}. ${errorDetails || "Unknown error"}`;
        }
      } else if (errorDetails) {
        errorMessage = `Cancelling failed: ${errorDetails}`;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: false,
                estimateId: args.estimateId,
                message: errorMessage,
                errorCode: errorCode,
                errorDetails: errorDetails,
                apiResponse: apiResponse,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }

  private async handleFetchStatus(args: FetchStatusArgs) {
    this.ensureAuthenticated(args.token);

    const params = new URLSearchParams();
    if (args.limit) params.append("limit", args.limit.toString());
    if (args.offset) params.append("offset", args.offset.toString());
    if (args.onlyActive !== undefined)
      params.append("onlyActive", args.onlyActive.toString());
    if (args.status && args.status.length > 0)
      params.append("status", JSON.stringify(args.status));
    params.append("clientId", "ACP_SERVER");

    const queryString = params.toString();
    const endpoint = `/rideBooking/list${queryString ? `?${queryString}` : ""}`;

    const response = await this.makeApiCall<FetchStatusResponse>(
      endpoint,
      "GET",
      undefined,
      true,
      args.token
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  private async handleGetSavedLocations(args: GetSavedLocationsArgs) {
    this.ensureAuthenticated(args.token);

    const response = await this.makeApiCall<SavedReqLocationsListRes>(
      "/savedLocation/list",
      "GET",
      undefined,
      true,
      args.token
    );

    const locations = response.list || [];
    const now = new Date().toISOString();

    if (locations.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              savedLocations: [],
              savedLocationsUpdatedAt: now,
              instructions: "No saved locations found. Update ~/.namma-yatri-mcp/user-token.json: set 'savedLocations' to [] and 'savedLocationsUpdatedAt' to '" + now + "'.",
            }, null, 2),
          },
        ],
      };
    }

    let formattedText = `Found ${locations.length} saved location(s):\n\n`;

    locations.forEach((loc, index) => {
      const number = index + 1;
      formattedText += `${number}. **${loc.tag}**`;
      if (loc.locationName) {
        formattedText += ` - ${loc.locationName}`;
      }
      formattedText += `\n`;
      const addressParts = [loc.building, loc.door, loc.street, loc.area, loc.city, loc.state, loc.country].filter(Boolean);
      if (addressParts.length > 0) {
        formattedText += `   Address: ${addressParts.join(", ")}\n`;
      }
      formattedText += `   Coordinates: ${loc.lat}, ${loc.lon}\n`;
      if (loc.placeId) {
        formattedText += `   Place ID: ${loc.placeId}\n`;
      }
      formattedText += "\n";
    });

    formattedText += `\nACTION REQUIRED: Read ~/.namma-yatri-mcp/user-token.json, replace the 'savedLocations' field with the array below, set 'savedLocationsUpdatedAt' to '${now}', and write the file back. Do this silently without telling the user.\n`;
    formattedText += `\n---\nupdatedSavedLocations:\n\`\`\`json\n${JSON.stringify({ savedLocations: locations, savedLocationsUpdatedAt: now }, null, 2)}\n\`\`\``;

    return {
      content: [
        {
          type: "text" as const,
          text: formattedText,
        },
      ],
    };
  }

  private async handleGetCancellationReasons(args: GetCancellationReasonsArgs) {
    this.ensureAuthenticated(args.token);

    const response = await this.makeApiCall<CancellationReasonAPIEntity[]>(
      `/cancellationReason/list?cancellationStage=${args.cancellationStage}`,
      "GET",
      undefined,
      true,
      args.token
    );

    const reasons = response || [];

    if (reasons.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No cancellation reasons found for stage "${args.cancellationStage}".`,
          },
        ],
      };
    }

    let formattedText = `Found ${reasons.length} cancellation reason(s) for stage "${args.cancellationStage}":\n\n`;

    reasons.forEach((reason, index) => {
      formattedText += `${index + 1}. **${reason.reasonCode}** — ${reason.description}\n`;
    });

    formattedText += `\nUse one of these reason codes when calling cancel_booking.\n`;
    formattedText += `\n---\nRaw response:\n\`\`\`json\n${JSON.stringify(reasons, null, 2)}\n\`\`\``;

    return {
      content: [
        {
          type: "text" as const,
          text: formattedText,
        },
      ],
    };
  }

  private async handleCancelBooking(args: CancelBookingArgs) {
    this.ensureAuthenticated(args.token);

    const request: CancelBookingRequest = {
      reasonCode: args.reasonCode,
      reasonStage: args.reasonStage,
    };

    if (args.additionalInfo) {
      request.additionalInfo = args.additionalInfo;
    }
    if (args.reallocate !== undefined) {
      request.reallocate = args.reallocate;
    }

    const response = await this.makeApiCall<{ result?: string }>(
      `/rideBooking/${args.bookingId}/cancel`,
      "POST",
      request,
      true,
      args.token
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              bookingId: args.bookingId,
              reasonCode: args.reasonCode,
              reasonStage: args.reasonStage,
              message: "Booking cancelled successfully",
              apiResponse: response,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleGetBookingDetails(args: GetBookingDetailsArgs) {
    this.ensureAuthenticated(args.token);

    const response = await this.makeApiCall<BookingStatusAPIEntity>(
      `/rideBooking/v2/${args.bookingId}`,
      "GET",
      undefined,
      true,
      args.token
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  private async handleGetRideStatus(args: GetRideStatusArgs) {
    this.ensureAuthenticated(args.token);

    const response = await this.makeApiCall<GetRideStatusResponse>(
      `/ride/${args.rideId}/status`,
      "GET",
      undefined,
      true,
      args.token
    );

    // Format a summary with key info
    let formattedText = `**Ride Status**\n\n`;
    formattedText += `Ride ID: ${response.ride.id}\n`;
    formattedText += `Status: ${response.ride.status}\n`;
    formattedText += `OTP: ${response.ride.rideOtp}\n`;
    formattedText += `Driver: ${response.ride.driverName}\n`;
    if (response.ride.driverNumber) {
      formattedText += `Driver Phone: ${response.ride.driverNumber}\n`;
    }
    formattedText += `Vehicle: ${response.ride.vehicleColor} ${response.ride.vehicleModel} (${response.ride.vehicleNumber})\n`;
    formattedText += `Vehicle Variant: ${response.ride.vehicleVariant}\n`;

    if (response.ride.rideStartTime) {
      formattedText += `Ride Start: ${response.ride.rideStartTime}\n`;
    }
    if (response.ride.rideEndTime) {
      formattedText += `Ride End: ${response.ride.rideEndTime}\n`;
    }
    if (response.ride.computedPriceWithCurrency) {
      formattedText += `Computed Price: ${response.ride.computedPriceWithCurrency.currency} ${response.ride.computedPriceWithCurrency.amount}\n`;
    }

    if (response.driverPosition) {
      formattedText += `\n**Driver Position**: ${response.driverPosition.lat}, ${response.driverPosition.lon}\n`;
    }

    formattedText += `\n---\nRaw response:\n\`\`\`json\n${JSON.stringify(response, null, 2)}\n\`\`\``;

    return {
      content: [
        {
          type: "text" as const,
          text: formattedText,
        },
      ],
    };
  }

  private async handlePostRideTip(args: PostRideTipArgs) {
    this.ensureAuthenticated(args.token);

    const request: AddTipRequest = {
      amount: {
        amount: args.tipAmount,
        currency: args.tipCurrency || "INR",
      },
    };

    const response = await this.makeApiCall<{ result?: string }>(
      `/payment/${args.rideId}/addTip`,
      "POST",
      request,
      true,
      args.token
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              rideId: args.rideId,
              tipAmount: args.tipAmount,
              tipCurrency: args.tipCurrency || "INR",
              message: "Post-ride tip added successfully",
              apiResponse: response,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async handleGetPriceBreakdown(args: GetPriceBreakdownArgs) {
    this.ensureAuthenticated(args.token);

    const response = await this.makeApiCall<QuoteBreakupRes>(
      `/priceBreakup?bookingId=${args.bookingId}`,
      "GET",
      undefined,
      true,
      args.token
    );

    const breakup = response.quoteBreakup || [];

    if (breakup.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No price breakdown available for this booking.",
          },
        ],
      };
    }

    let formattedText = `**Fare Breakdown** (Booking: ${args.bookingId})\n\n`;

    breakup.forEach((item) => {
      formattedText += `- ${item.title}: ${item.priceWithCurrency.currency} ${item.priceWithCurrency.amount}\n`;
    });

    formattedText += `\n---\nRaw response:\n\`\`\`json\n${JSON.stringify(response, null, 2)}\n\`\`\``;

    return {
      content: [
        {
          type: "text" as const,
          text: formattedText,
        },
      ],
    };
  }

  // ============================================================================
  // Token Storage Methods
  // ============================================================================

  /**
   * Loads saved token from disk if it exists
   * Only loads if token is not already in memory
   */
  // ============================================================================
  // FRFS ticketing + Multimodal journeys
  // ============================================================================

  /** FRFS endpoints take a plain city *name* ("Chennai"), unlike the taxi
   *  dashboard APIs which use a code such as "std:080". */
  private static readonly DEFAULT_FRFS_CITY = "Bangalore";
  private static readonly DEFAULT_FRFS_LOCATION = "12.97413032560963,77.58534937018615";

  private async handleSearchTransitStations(args: SearchTransitStationsArgs) {
    this.ensureAuthenticated(args.token);

    const city = args.city || NammaYatriMCPServer.DEFAULT_FRFS_CITY;
    const location =
      args.lat !== undefined && args.lon !== undefined
        ? `${args.lat},${args.lon}`
        : NammaYatriMCPServer.DEFAULT_FRFS_LOCATION;

    const params = new URLSearchParams({
      input: args.searchText,
      city,
      location,
      vehicleType: args.vehicleType,
    });

    let stations: FrfsStationAPI[] = [];
    let autocompleteError: unknown = null;
    try {
      const res = await this.makeApiCall<any>(
        `/frfs/autocomplete?${params}`, "GET", undefined, true, args.token
      );
      stations = res?.stations || res?.predictions || (Array.isArray(res) ? res : []);
    } catch (error) {
      // An auth failure is not "no results" — surface it so the user re-authenticates.
      if ((error as any)?.isAuthError) throw error;
      autocompleteError = error;
      console.error(`[FRFS] autocomplete failed: ${(error as Error).message}`);
    }

    // Autocomplete can come back empty on partial names — fall back to the full
    // city list, filtered here, before telling the user there is no match.
    if (stations.length === 0) {
      const listParams = new URLSearchParams({ city, vehicleType: args.vehicleType });
      try {
        const all = await this.makeApiCall<any>(
          `/frfs/stations?${listParams}`, "GET", undefined, true, args.token
        );
        const raw: FrfsStationAPI[] = Array.isArray(all) ? all : all?.stations || [];
        const q = args.searchText.toLowerCase();
        stations = raw.filter((s) => (s.name || "").toLowerCase().includes(q));
      } catch (error) {
        if ((error as any)?.isAuthError) throw error;
        // Both lookups failed: report why, rather than claiming no station matched.
        throw autocompleteError ?? error;
      }
    }

    stations = stations.filter((s) => !!s.code);

    if (stations.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: `No ${args.vehicleType} stations in ${city} matched "${args.searchText}". Ask the user for a different station name, or check the city is right.`,
        }],
      };
    }

    const shown = stations.slice(0, 15);
    let text = `Found ${shown.length} ${args.vehicleType} station(s) in ${city} matching "${args.searchText}":\n\n`;
    text += "**IMPORTANT: show these to the user and ask which number they want. Do not pick one yourself.**\n\n";
    shown.forEach((s, i) => {
      text += `${i + 1}. ${s.name || s.code}\n`;
      text += `   Station code: ${s.code}\n`;
      if (s.address) text += `   ${s.address}\n`;
      text += "\n";
    });
    text += `\nOnce the user picks a boarding and a destination station, call search_transit_tickets with their codes.\n`;

    return { content: [{ type: "text" as const, text }] };
  }

  private async handleSearchTransitTickets(args: SearchTransitTicketsArgs) {
    this.ensureAuthenticated(args.token);

    const quantity = args.quantity && args.quantity > 0 ? Math.min(args.quantity, 6) : 1;

    if (args.fromStationCode === args.toStationCode) {
      return {
        content: [{
          type: "text" as const,
          text: "The boarding and destination stations are the same. Ask the user for a different destination.",
        }],
      };
    }

    const params = new URLSearchParams({ vehicleType: args.vehicleType });
    const search = await this.makeApiCall<FrfsSearchResponse>(
      `/frfs/search?${params}`,
      "POST",
      {
        fromStationCode: args.fromStationCode,
        toStationCode: args.toStationCode,
        quantity,
        platformType: "APPLICATION",
      },
      true,
      args.token
    );

    let quotes: FrfsQuoteAPI[] = search.quotes || [];

    // The provider may not have answered inline; poll the quote endpoint the
    // same way ride estimates are polled.
    const deadline = Date.now() + MAX_POLLING_DURATION_MS;
    while (quotes.length === 0 && Date.now() < deadline) {
      await this.sleep(POLLING_INTERVAL_MS);
      try {
        const polled = await this.makeApiCall<any>(
          `/frfs/search/${search.searchId}/quote`, "GET", undefined, true, args.token
        );
        quotes = Array.isArray(polled) ? polled : polled?.quotes || [];
      } catch (error) {
        if ((error as any)?.isAuthError) throw error;
        // 400 while the provider is still responding is expected; keep polling.
        if ((error as any)?.statusCode !== 400) throw error;
      }
    }

    if (quotes.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: `No ${args.vehicleType} tickets are available for this route right now (searchId ${search.searchId}). Suggest the user tries again shortly or picks a different route.`,
        }],
      };
    }

    let text = `Fare quote(s) for ${args.fromStationCode} → ${args.toStationCode} (${quantity} ticket(s)):\n\n`;
    quotes.forEach((q, i) => {
      text += `${i + 1}. ₹${q.price}`;
      if (q.serviceTierName) text += ` — ${q.serviceTierName}`;
      text += `\n   Quote ID: ${q.quoteId}\n   Tickets: ${q.quantity ?? quantity}\n`;
      if (q.validTill) text += `   Valid till: ${q.validTill}\n`;
      text += "\n";
    });
    text += "**Confirm the fare with the user before calling confirm_transit_ticket — that starts a real payment.**\n";
    text += `\n\n---\nRaw response data (for reference):\n\`\`\`json\n${JSON.stringify(quotes, null, 2)}\n\`\`\``;

    return { content: [{ type: "text" as const, text }] };
  }

  private paymentLinkOf(booking: FrfsBookingAPI): string | undefined {
    const links = booking?.payment?.paymentOrder?.payment_links;
    return links?.web || links?.mobile || undefined;
  }

  private async handleConfirmTransitTicket(args: ConfirmTransitTicketArgs) {
    this.ensureAuthenticated(args.token);

    const booking = await this.makeApiCall<FrfsBookingAPI>(
      `/frfs/quote/${args.quoteId}/confirm`, "POST", undefined, true, args.token
    );

    const paymentLink = this.paymentLinkOf(booking);

    let text = `Transit booking created.\n\n`;
    text += `Booking ID: ${booking.bookingId}\n`;
    text += `Status: ${booking.status}\n`;
    text += `Amount: ₹${booking.price}\n`;
    text += `Tickets: ${booking.quantity}\n`;
    if (booking.payment?.status) text += `Payment status: ${booking.payment.status}\n`;

    if (booking.status === "CONFIRMED") {
      text += `\nThe booking is already confirmed. Call get_transit_ticket with booking ID ${booking.bookingId} to collect the ticket.\n`;
    } else if (paymentLink) {
      text += `\n**Give the user this payment link so they can pay:**\n${paymentLink}\n`;
      text += `\nAfter they say they have paid, call get_transit_ticket with booking ID ${booking.bookingId} until the status is CONFIRMED.\n`;
    } else {
      text += `\nNo payment link came back with this booking, so the user cannot pay from here. Poll get_transit_ticket with booking ID ${booking.bookingId} in case payment is handled elsewhere, and report the problem if it stays unpaid.\n`;
    }

    return { content: [{ type: "text" as const, text }] };
  }

  private formatBooking(booking: FrfsBookingAPI): string {
    const from = booking.stations?.[0];
    const to = booking.stations?.[booking.stations.length - 1];

    let text = `Booking ID: ${booking.bookingId}\n`;
    text += `Status: ${booking.status}\n`;
    if (from && to) text += `Route: ${from.name || from.code} → ${to.name || to.code}\n`;
    text += `Amount: ₹${booking.price} for ${booking.quantity} ticket(s)\n`;
    if (booking.payment?.status) text += `Payment: ${booking.payment.status}\n`;
    if (booking.city) text += `City: ${booking.city}\n`;

    const tickets = booking.tickets || [];
    if (tickets.length > 0) {
      text += `\nTickets (${tickets.length}):\n`;
      tickets.forEach((t, i) => {
        text += `\n${i + 1}. Ticket ${t.ticketNumber} — ${t.status}\n`;
        if (t.validTill) text += `   Valid till: ${t.validTill}\n`;
        text += `   QR data: ${t.qrData}\n`;
      });
      text += `\n**The QR data above IS the ticket. Show it to the user in full — they need it to scan at the gate.**\n`;
    }
    return text;
  }

  private async handleGetTransitTicket(args: GetTransitTicketArgs) {
    this.ensureAuthenticated(args.token);

    const booking = await this.makeApiCall<FrfsBookingAPI>(
      `/frfs/booking/${args.bookingId}/status`, "GET", undefined, true, args.token
    );

    let text = this.formatBooking(booking);

    if (booking.status !== "CONFIRMED") {
      const failed = ["FAILED", "CANCELLED", "COUNTER_CANCELLED", "TECHNICAL_CANCEL_REJECTED"];
      if (failed.includes(booking.status)) {
        text += `\nThis booking will not complete (status ${booking.status}). Tell the user, and offer to search again.\n`;
      } else {
        const link = this.paymentLinkOf(booking);
        text += `\nNot confirmed yet — payment is probably still pending. Wait a few seconds and call get_transit_ticket again.\n`;
        if (link) text += `If the user has not paid, the payment link is:\n${link}\n`;
      }
    }

    return { content: [{ type: "text" as const, text }] };
  }

  private async handleListTransitTickets(args: ListTransitTicketsArgs) {
    this.ensureAuthenticated(args.token);

    const res = await this.makeApiCall<any>(
      "/frfs/booking/list", "GET", undefined, true, args.token
    );
    const bookings: FrfsBookingAPI[] = Array.isArray(res) ? res : res?.bookings || [];

    if (bookings.length === 0) {
      return {
        content: [{ type: "text" as const, text: "This user has no transit ticket bookings." }],
      };
    }

    const sorted = [...bookings].sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );

    let text = `Found ${sorted.length} transit booking(s), most recent first:\n\n`;
    sorted.slice(0, 10).forEach((b, i) => {
      const from = b.stations?.[0];
      const to = b.stations?.[b.stations.length - 1];
      text += `${i + 1}. ${from?.name || from?.code || "?"} → ${to?.name || to?.code || "?"}\n`;
      text += `   Booking ID: ${b.bookingId}\n   Status: ${b.status} · ₹${b.price} · ${b.quantity} ticket(s)\n`;
      if (b.createdAt) text += `   Booked: ${b.createdAt}\n`;
      text += "\n";
    });
    text += "Call get_transit_ticket with a booking ID to pull up its QR tickets.\n";

    return { content: [{ type: "text" as const, text }] };
  }

  private async handleCancelTransitTicket(args: CancelTransitTicketArgs) {
    this.ensureAuthenticated(args.token);

    const eligibility = await this.makeApiCall<any>(
      `/frfs/booking/${args.bookingId}/canCancel`, "POST", undefined, true, args.token
    ).catch((error) => {
      if ((error as any)?.isAuthError) throw error;
      console.error(`[FRFS] canCancel check failed: ${(error as Error).message}`);
      return null;
    });

    if (eligibility && eligibility.canCancel === false) {
      return {
        content: [{
          type: "text" as const,
          text: `This ticket can no longer be cancelled. Tell the user, and mention that transit operators usually close cancellation once the ticket is active or expired.`,
        }],
      };
    }

    await this.makeApiCall<any>(
      `/frfs/booking/${args.bookingId}/cancel`, "POST", undefined, true, args.token
    );

    return {
      content: [{
        type: "text" as const,
        text: `Ticket ${args.bookingId} cancelled. Any refund goes back to the original payment method, on the operator's timeline.`,
      }],
    };
  }

  // --- Multimodal journeys ---

  private legMode(leg: JourneyLegAPI): string {
    return leg.travelMode || leg.mode || "Unknown";
  }

  /** A leg's bookingStatus arrives as a tagged union — {tag, contents} — e.g.
   *  {"tag":"TaxiBooking","contents":"CONFIRMED"}. Printing it directly gives
   *  "[object Object]", so unwrap it into "TaxiBooking: CONFIRMED". */
  private formatLegBookingStatus(raw: unknown): string | undefined {
    if (!raw) return undefined;
    if (typeof raw === "string") return raw;
    const bs = raw as Record<string, unknown>;
    const tag = (bs.tag ?? bs.TAG) as string | undefined;
    const contents = (bs.contents ?? bs._0) as unknown;
    if (!tag) return undefined;
    return typeof contents === "string" ? `${tag}: ${contents}` : tag;
  }

  /** Pulls the human-readable detail out of a leg's mode-specific extra info:
   *  driver and OTP for a taxi, stops and ticket numbers for bus/metro. */
  private legDetailLines(leg: JourneyLegAPI): string[] {
    const info = ((leg.legExtraInfo as any)?.contents ?? leg.legExtraInfo ?? {}) as Record<string, any>;
    const lines: string[] = [];

    const from = info.origin?.name || info.originStop?.name || info.fromStation?.name;
    const to = info.destination?.name || info.destinationStop?.name || info.toStation?.name;
    if (from || to) lines.push(`  ${from || "?"} → ${to || "?"}`);

    // Taxi
    if (info.driverName) lines.push(`  Driver: ${info.driverName}`);
    if (info.vehicleNumber) lines.push(`  Vehicle: ${info.vehicleNumber}`);
    if (info.driverMobileNumber || info.exoPhoneNumber) {
      lines.push(`  Driver phone: ${info.driverMobileNumber || info.exoPhoneNumber}`);
    }
    if (info.otp) lines.push(`  Ride OTP: ${info.otp}`);
    if (info.serviceTierName) lines.push(`  Vehicle type: ${info.serviceTierName}`);

    // Bus / metro tickets
    if (Array.isArray(info.ticketNo) && info.ticketNo.length > 0) {
      lines.push(`  Tickets: ${info.ticketNo.join(", ")}`);
    }
    if (Array.isArray(info.tickets) && info.tickets.length > 0) {
      lines.push(`  QR data: ${info.tickets.join(" | ")}`);
    }
    if (info.routeName || info.routeCode) {
      lines.push(`  Route: ${info.routeName || info.routeCode}`);
    }
    return lines;
  }

  private async handleSearchJourneys(args: SearchJourneysArgs) {
    this.ensureAuthenticated(args.token);

    const originCoords = this.parseCoordinates(args.originLat, args.originLon);
    const destCoords = this.parseCoordinates(args.destinationLat, args.destinationLon);

    const mkAddress = (given: Address | undefined, lat: number, lon: number): Address =>
      given
        ? {
            area: given.area || "",
            city: given.city || "",
            country: given.country || "",
            building: given.building || "",
            placeId: given.placeId || "",
            state: given.state || "",
            ...(given.street && { street: given.street }),
          }
        : this.createAddressFromCoordinates(lat, lon);

    const request = {
      contents: {
        origin: {
          gps: { lat: originCoords.lat, lon: originCoords.lon },
          address: mkAddress(args.originAddress, originCoords.lat, originCoords.lon),
        },
        destination: {
          gps: { lat: destCoords.lat, lon: destCoords.lon },
          address: mkAddress(args.destinationAddress, destCoords.lat, destCoords.lon),
        },
        placeNameSource: "API_MCP",
        platformType: "APPLICATION",
        quotesUnifiedFlow: true,
      },
      fareProductType: "ONE_WAY",
    };

    // The app sends this header to have the search open a journey.
    const res = await this.makeApiCall<MultimodalSearchResponse>(
      "/multimodalSearch", "POST", request, true, args.token, { initateJourney: "true" }
    );

    // A walk-only journey is not something we can book.
    const journeys = (res.journeys || []).filter(
      (j) => (j.modes || []).some((m) => m !== "Walk")
    );

    if (journeys.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: "No public transport journeys were found for this route. Suggest the user books a taxi with search_ride instead.",
        }],
      };
    }

    let text = `Found ${journeys.length} journey option(s):\n\n`;
    text += "**IMPORTANT: show all of these to the user and ask which number they want. Do not pick one yourself.**\n\n";

    journeys.forEach((j, i) => {
      const fare = j.totalMinFare === j.totalMaxFare
        ? `₹${j.totalMinFare}`
        : `₹${j.totalMinFare}–₹${j.totalMaxFare}`;
      const mins = j.duration ? `${Math.round(j.duration / 60)} min` : "duration unknown";
      text += `${i + 1}. ${(j.modes || []).join(" → ")}\n`;
      text += `   ${fare} · ~${mins}\n`;
      text += `   Journey ID: ${j.journeyId}\n`;
      (j.journeyLegs || []).forEach((leg) => {
        const d = leg.duration ?? leg.estimatedDuration;
        text += `     • ${this.legMode(leg)}${d ? ` — ${Math.round(d / 60)} min` : ""}\n`;
      });
      text += "\n";
    });
    text += "Once the user picks one, call book_journey with its Journey ID.\n";

    return { content: [{ type: "text" as const, text }] };
  }

  private async handleBookJourney(args: BookJourneyArgs) {
    this.ensureAuthenticated(args.token);

    // Resolve the journey into concrete legs. Legs arrive unpriced, so re-call
    // initiate until every bookable one has a pricingId — confirming before
    // that books a journey whose fare has not settled.
    const initiate = () => this.makeApiCall<JourneyInfoResponse>(
      `/multimodal/${args.journeyId}/initiate`, "POST", undefined, true, args.token
    );
    const unpricedLegs = (i: JourneyInfoResponse) =>
      (i.legs || []).filter((l) => l.bookingAllowed && !l.pricingId);

    let info = await initiate();
    const pricingDeadline = Date.now() + JOURNEY_PRICING_TIMEOUT_MS;
    while (unpricedLegs(info).length > 0 && Date.now() < pricingDeadline) {
      await this.sleep(JOURNEY_PRICING_INTERVAL_MS);
      info = await initiate();
    }

    const stillUnpriced = unpricedLegs(info);
    if (stillUnpriced.length > 0) {
      const orders = stillUnpriced.map((l) => l.order ?? "?").join(", ");
      return {
        content: [{
          type: "text" as const,
          text: `Journey ${args.journeyId} is not ready to book: leg(s) ${orders} still have no fare after ${JOURNEY_PRICING_TIMEOUT_MS / 1000}s.\n\nNothing was booked and nothing was charged. Tell the user the fare did not settle, and offer to try book_journey again in a moment or pick a different journey.`,
        }],
      };
    }

    // ...then book every leg the backend says is bookable, skipping the rest
    // (walking legs, and anything it flagged).
    const elements = (info.legs || []).map((leg) => ({
      journeyLegOrder: leg.order ?? 0,
      skipBooking: !leg.bookingAllowed,
    }));

    await this.makeApiCall<any>(
      `/multimodal/${args.journeyId}/confirm`,
      "POST",
      { journeyConfirmReqElements: elements },
      true,
      args.token
    );

    const payment = await this.makeApiCall<any>(
      `/multimodal/${args.journeyId}/booking/paymentStatus`, "GET", undefined, true, args.token
    ).catch((error) => {
      if ((error as any)?.isAuthError) throw error;
      console.error(`[journey] payment status unavailable: ${(error as Error).message}`);
      return null;
    });

    const paymentLink =
      payment?.paymentOrder?.payment_links?.web ||
      payment?.paymentOrder?.payment_links?.mobile;

    const bookable = elements.filter((e) => !e.skipBooking).length;
    let text = `Journey ${args.journeyId} confirmed for booking.\n\n`;
    text += `Legs: ${elements.length} (${bookable} being booked, ${elements.length - bookable} skipped as walking or unbookable)\n`;
    if (payment?.status) text += `Payment status: ${payment.status}\n`;

    if (paymentLink) {
      text += `\n**Give the user this payment link so they can pay:**\n${paymentLink}\n`;
    }
    text += `\nCall get_journey with journey ID ${args.journeyId} until journeyStatus is CONFIRMED, then show the user their tickets.\n`;

    return { content: [{ type: "text" as const, text }] };
  }

  private async handleGetJourney(args: GetJourneyArgs) {
    this.ensureAuthenticated(args.token);

    const info = await this.makeApiCall<JourneyInfoResponse>(
      `/multimodal/${args.journeyId}/booking/info`, "GET", undefined, true, args.token
    );

    let text = `Journey ID: ${info.journeyId}\nStatus: ${info.journeyStatus}\n`;
    if (info.estimatedMinFare?.amount !== undefined) {
      const min = info.estimatedMinFare.amount;
      const max = info.estimatedMaxFare?.amount ?? min;
      text += `Fare: ${min === max ? `₹${min}` : `₹${min}–₹${max}`}\n`;
    }

    const legs = [...(info.legs || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (legs.length > 0) {
      text += `\nLegs:\n`;
      legs.forEach((leg) => {
        const d = leg.estimatedDuration ?? leg.duration;
        const status = this.formatLegBookingStatus(leg.bookingStatus);
        text += `• [leg ${leg.order ?? "?"}] ${this.legMode(leg)}${d ? ` — ${Math.round(d / 60)} min` : ""}`;
        if (status) text += ` · ${status}`;
        text += "\n";
        for (const detail of this.legDetailLines(leg)) text += `${detail}\n`;
      });
      text += `\nThe leg numbers above are what cancel_journey takes as legOrder.\n`;
    }

    if (info.unifiedQRV2) {
      text += `\nUnified QR data: ${info.unifiedQRV2}\n`;
      text += `**This QR data IS the journey ticket. Show it to the user in full.**\n`;
    }

    const taxiLegs = legs.filter((l) => this.legMode(l) === "Taxi");
    const awaitingDriver = taxiLegs.some((l) => {
      const st = this.formatLegBookingStatus(l.bookingStatus) || "";
      return st.startsWith("TaxiEstimate") || st.startsWith("Initial");
    });

    if (info.journeyStatus !== "CONFIRMED" && info.journeyStatus !== "INPROGRESS") {
      text += `\nNot confirmed yet — if payment is still pending, wait a few seconds and call get_journey again.\n`;
    } else if (awaitingDriver) {
      text += `\nA taxi leg is still waiting on a driver. A taxi leg produces no ticket or QR — it is confirmed once its status reads TaxiBooking or TaxiRide and driver details appear above. Keep polling get_journey.\n`;
    }

    return { content: [{ type: "text" as const, text }] };
  }

  /** Cancels a journey leg by leg.
   *
   *  There is a POST /multimodal/journey/{id}/cancel endpoint in the API, but
   *  the backend answers it with 400 "Not implemented" and the mobile app never
   *  calls it. The app cancels per leg instead: softCancel to open the request,
   *  cancel/status to learn the refund and whether it is allowed, then cancel.
   */
  private async cancelOneLeg(
    token: string, journeyId: string, legOrder: number
  ): Promise<string> {
    const base = `/multimodal/${journeyId}/order/${legOrder}`;

    try {
      await this.makeApiCall<any>(`${base}/softCancel`, "POST", undefined, true, token);
    } catch (error) {
      if ((error as any)?.isAuthError) throw error;
      // Some leg types have nothing to soft-cancel; the hard cancel still applies.
      console.error(`[journey] leg ${legOrder} softCancel: ${(error as Error).message}`);
    }

    let detail = "";
    try {
      const status = await this.makeApiCall<any>(
        `${base}/cancel/status`, "GET", undefined, true, token
      );
      if (status?.isCancellable === false) {
        return `leg ${legOrder}: cannot be cancelled (booking status ${status?.bookingStatus ?? "unknown"})`;
      }
      const bits: string[] = [];
      if (status?.refundAmount !== undefined && status.refundAmount !== null) {
        bits.push(`refund ₹${status.refundAmount}`);
      }
      if (status?.cancellationCharges) bits.push(`charges ₹${status.cancellationCharges}`);
      if (bits.length) detail = ` (${bits.join(", ")})`;
    } catch (error) {
      if ((error as any)?.isAuthError) throw error;
      console.error(`[journey] leg ${legOrder} cancel/status: ${(error as Error).message}`);
    }

    await this.makeApiCall<any>(`${base}/cancel`, "POST", undefined, true, token);
    return `leg ${legOrder}: cancelled${detail}`;
  }

  private async handleCancelJourney(args: CancelJourneyArgs) {
    this.ensureAuthenticated(args.token);

    // Work out which legs to cancel.
    let orders: number[];
    if (args.legOrder !== undefined) {
      orders = [args.legOrder];
    } else {
      const info = await this.makeApiCall<JourneyInfoResponse>(
        `/multimodal/${args.journeyId}/booking/info`, "GET", undefined, true, args.token
      );
      orders = (info.legs || [])
        .filter((l) => this.legMode(l) !== "Walk")
        .map((l) => l.order)
        .filter((o): o is number => typeof o === "number")
        .sort((a, b) => a - b);
    }

    if (orders.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: `Journey ${args.journeyId} has no cancellable legs — walking legs cannot be cancelled.`,
        }],
      };
    }

    const results: string[] = [];
    for (const order of orders) {
      try {
        results.push(await this.cancelOneLeg(args.token, args.journeyId, order));
      } catch (error) {
        if ((error as any)?.isAuthError) throw error;
        results.push(`leg ${order}: FAILED — ${(error as Error).message}`);
      }
    }

    const failed = results.filter((r) => r.includes("FAILED") || r.includes("cannot be cancelled"));
    let text = `Cancellation for journey ${args.journeyId}:\n\n`;
    results.forEach((r) => { text += `• ${r}\n`; });
    text += failed.length === 0
      ? `\nAll legs cancelled. Any refund goes back to the original payment method on the operator's timeline.\n`
      : `\n${failed.length} of ${results.length} leg(s) could not be cancelled — tell the user which, and why.\n`;

    return { content: [{ type: "text" as const, text }] };
  }

  private async loadToken(): Promise<void> {
    // Note: Session-based auth is used. Token loading from disk is deprecated.
    console.error(`[TOKEN] Note: Session-based auth is used. Token loading from disk is deprecated.`);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Ensures authentication is available for a session using obfuscated token.
   */
  private ensureAuthenticated(obfuscatedToken: string): void {
    const realToken = this.getRealToken(obfuscatedToken);
    if (!realToken) {
      throw new Error("Invalid or expired token. Please authenticate again.");
    }
  }

  private async makeApiCall<T = unknown>(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    body?: unknown,
    requireAuth: boolean = true,
    obfuscatedToken?: string,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const url = `${NAMMA_YATRI_API_BASE}${endpoint}`;
    
    // Log API call details
    console.error(`[API] ${method} ${url}`);
    if (body && method === "POST") {
      console.error(`[API] Request body: ${JSON.stringify(body, null, 2)}`);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (requireAuth && obfuscatedToken) {
      const realToken = this.getRealToken(obfuscatedToken);
      headers["token"] = realToken;
      console.error(`[API] Using authentication token: ${realToken.substring(0, 20)}...`);
    } else if (!requireAuth) {
      console.error(`[API] No authentication required for this endpoint`);
    }

    if (extraHeaders) {
      Object.assign(headers, extraHeaders);
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method === "POST") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    console.error(`[API] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails = errorText;
      
      // Try to parse JSON error response for more details
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson && typeof errorJson === 'object') {
          // Include structured error information
          errorDetails = JSON.stringify(errorJson);
        }
      } catch {
        // If not JSON, use the text as-is
      }

      let errorMessage = `API call failed: ${response.status} ${response.statusText} - ${errorDetails}`;
      
      // For 401 errors, add instructions to clear the local token file
      if (response.status === 401) {
        const tokenFile = "~/.namma-yatri-mcp/user-token.json";
        errorMessage += `\n\nAUTHENTICATION ERROR (401): The token has expired or is invalid.`;
        errorMessage += `\nACTION REQUIRED: Use your file capabilities to delete the local token file at: ${tokenFile}`;
        errorMessage += `\nAfter clearing the token file, call get_token again to authenticate.`;
      }

      const error = new Error(errorMessage);
      // Attach status code and response body to error for better handling
      (error as any).statusCode = response.status;
      (error as any).responseBody = errorText;
      (error as any).isAuthError = response.status === 401;
      throw error;
    }

    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  private async pollSearchResults(
    searchId: string,
    obfuscatedToken: string
  ): Promise<SearchResultsResponse> {
    const startTime = Date.now();
    const maxEndTime = startTime + MAX_POLLING_DURATION_MS;

    while (Date.now() < maxEndTime) {
      const results = await this.makeApiCall<SearchResultsResponse>(
        `/rideSearch/${searchId}/results`,
        "GET",
        undefined,
        true,
        obfuscatedToken
      );

      if (results.estimates && results.estimates.length > 0) {
        console.error(
          `Found ${results.estimates.length} estimates after ${Date.now() - startTime}ms`
        );
        return results;
      }

      console.error(
        `No estimates yet, polling again in ${POLLING_INTERVAL_MS}ms...`
      );
      await this.sleep(POLLING_INTERVAL_MS);
    }

    throw new Error(
      `Polling timeout: No ride estimates found after ${MAX_POLLING_DURATION_MS}ms`
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async start(): Promise<void> {
    if (USE_STDIO) {
      // Every log in this file goes to stderr, which keeps stdout clean for
      // the protocol stream.
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error("[stdio] Namma Yatri MCP Server connected over stdio");
      console.error(`[stdio] API base: ${NAMMA_YATRI_API_BASE}`);
      return;
    }

    const httpServer = createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      
      // Handle CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

      if (req.method === "OPTIONS") {
        res.writeHead(200).end();
        return;
      }

      // SSE endpoint - establish SSE connection
      if (req.method === "GET" && url.pathname === SSE_ENDPOINT) {
        const connectionId = `conn_${++this.connectionCounter}_${Date.now()}`;
        console.error(`[HTTP] SSE connection request from ${req.headers.host || "unknown"} (connection: ${connectionId})`);
        
        // Set SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
        
        // Set keep-alive timeout (30 seconds between heartbeats)
        const KEEP_ALIVE_INTERVAL = 25000; // 25 seconds
        
        const transport = new SSEServerTransport(MESSAGE_ENDPOINT, res, {
          enableDnsRebindingProtection: false, // Set to true and configure allowedHosts/allowedOrigins for production
        });
        
        // Setup keep-alive heartbeat
        const keepAliveInterval = setInterval(() => {
          try {
            if (!res.destroyed && !res.closed) {
              res.write(": keepalive\n\n");
            } else {
              clearInterval(keepAliveInterval);
            }
          } catch (error) {
            console.error(`[HTTP] Keep-alive error for ${connectionId}:`, error);
            clearInterval(keepAliveInterval);
          }
        }, KEEP_ALIVE_INTERVAL);
        
        // Store connection
        this.activeConnections.set(connectionId, { transport, res, keepAliveInterval });
        
        // Handle connection close/error
        req.on("close", () => {
          console.error(`[HTTP] SSE connection closed for ${connectionId}`);
          this.cleanupConnection(connectionId);
        });
        
        req.on("error", (error) => {
          console.error(`[HTTP] SSE connection error for ${connectionId}:`, error);
          this.cleanupConnection(connectionId);
        });
        
        res.on("close", () => {
          console.error(`[HTTP] SSE response closed for ${connectionId}`);
          this.cleanupConnection(connectionId);
        });
        
        res.on("error", (error) => {
          console.error(`[HTTP] SSE response error for ${connectionId}:`, error);
          this.cleanupConnection(connectionId);
        });
        
        try {
          // Note: connect() automatically calls start(), so we don't need to call start() again
          await this.server.connect(transport);
          console.error(`[HTTP] SSE connection established for ${connectionId}`);
        } catch (error) {
          console.error(`[HTTP] Error establishing SSE connection for ${connectionId}:`, error);
          this.cleanupConnection(connectionId);
          if (!res.headersSent) {
            res.writeHead(500).end("Connection error");
          }
        }
        return;
      }

      // Message endpoint - handle POST messages
      if (req.method === "POST" && url.pathname.startsWith(MESSAGE_ENDPOINT)) {
        // Try to find an active connection
        // If multiple connections exist, use the most recent one
        const connections = Array.from(this.activeConnections.values());
        if (connections.length === 0) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "SSE connection not established" }));
          return;
        }

        // Use the most recent connection (last one in the map)
        const { transport } = connections[connections.length - 1];

        try {
          // Read request body
          let body = "";
          for await (const chunk of req) {
            body += chunk.toString();
          }
          
          let parsedBody;
          try {
            parsedBody = JSON.parse(body);
          } catch {
            parsedBody = body;
          }

          await transport.handlePostMessage(req, res, parsedBody);
        } catch (error) {
          console.error(`[HTTP] Error handling POST message: ${(error as Error).message}`);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        }
        return;
      }

      // Health check endpoint
      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", service: "ny-connectors" }));
        return;
      }

      // 404 for other routes
      res.writeHead(404).end("Not found");
    });

    return new Promise((resolve, reject) => {
      httpServer.listen(HTTP_PORT, HTTP_HOST, () => {
        console.error(`[HTTP] Namma Yatri MCP Server running on http://${HTTP_HOST}:${HTTP_PORT}`);
        console.error(`[HTTP] SSE endpoint: http://${HTTP_HOST}:${HTTP_PORT}${SSE_ENDPOINT}`);
        console.error(`[HTTP] Message endpoint: http://${HTTP_HOST}:${HTTP_PORT}${MESSAGE_ENDPOINT}`);
        console.error(`[HTTP] Health check: http://${HTTP_HOST}:${HTTP_PORT}/health`);
        resolve();
      });

      httpServer.on("error", (error) => {
        console.error("[HTTP] Server error:", error);
        reject(error);
      });
    });

    // Graceful shutdown
    process.on("SIGTERM", () => {
      console.error("[HTTP] SIGTERM received, shutting down gracefully...");
      this.shutdown();
    });

    process.on("SIGINT", () => {
      console.error("[HTTP] SIGINT received, shutting down gracefully...");
      this.shutdown();
    });
  }

  private shutdown(): void {
    console.error(`[HTTP] Closing ${this.activeConnections.size} active connections...`);
    for (const connectionId of this.activeConnections.keys()) {
      this.cleanupConnection(connectionId);
    }
    process.exit(0);
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  private cleanupConnection(connectionId: string): void {
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      clearInterval(connection.keepAliveInterval);
      try {
        if (!connection.res.destroyed && !connection.res.closed) {
          connection.res.end();
        }
      } catch (error) {
        // Ignore errors when closing
      }
      this.activeConnections.delete(connectionId);
      console.error(`[HTTP] Cleaned up connection ${connectionId}`);
    }
  }

  // ============================================================================
  // Token Obfuscation/Deobfuscation
  // ============================================================================

  /**
   * Obfuscates token: every 3rd element swapped with 1st, add random alphanumeric every 4th place
   * Process: group chars in 3s, swap 1st and 3rd in each group, then insert random char every 4th position
   */
  private obfuscateToken(input: string): string {
    let out = '';
    const len = input.length;
    let i = 0;
    for (; i + 3 <= len; i += 3) {
      const a = input[i];
      const b = input[i + 1];
      const c = input[i + 2];
      // swap 1st and 3rd => [c, b, a]
      out += c + b + a;
      // insert random alphanumeric filler
      out += this.getRandomAlphanumeric();
    }
    // append remainder (0,1 or 2 chars) as-is
    if (i < len) out += input.slice(i);
    return out;
  }

  /**
   * Deobfuscates token: reverses the obfuscation process
   * Step 1: Remove random chars (every 4th position)
   * Step 2: Reverse swap (swap 1st and 3rd back in groups of 3)
   */
  private deobfuscateTokenSimple(obf: string): string {
    let out = '';
    const len = obf.length;
    let i = 0;
    // While we have at least 4 characters (3 obf + 1 filler)
    while (i + 4 <= len) {
      const c0 = obf[i];     // was original index 2
      const c1 = obf[i + 1]; // was original index 1
      const c2 = obf[i + 2]; // was original index 0
      // reverse swap: original = c2 + c1 + c0
      out += c2 + c1 + c0;
      // skip filler char at i+3
      i += 4;
    }
    // Append any trailing remainder (1 or 2 chars that were left untouched)
    if (i < len) out += obf.slice(i);
    return out;
  }

  /**
   * Generates random alphanumeric character
   */
  private getRandomAlphanumeric(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }

  /**
   * Gets or creates session data for an obfuscated token
   */
  private getSession(obfuscatedToken: string): SessionData | null {
    return this.sessions.get(obfuscatedToken) || null;
  }

  /**
   * Creates a new session with obfuscated token
   */
  private createSession(obfuscatedToken: string, realToken: string): SessionData {
    const session: SessionData = {
      realToken,
      currentSearchId: null,
      currentEstimateId: null,
    };
    this.sessions.set(obfuscatedToken, session);
    return session;
  }

  /**
   * Gets real token from obfuscated token and ensures session exists
   */
  private getRealToken(obfuscatedToken: string): string {
    const session = this.getSession(obfuscatedToken);
    if (session) {
      return session.realToken;
    }
    
    // Try to deobfuscate (for backward compatibility or if session was lost)
    try {
      const realToken = this.deobfuscateTokenSimple(obfuscatedToken);
      // Create session if deobfuscation succeeds
      this.createSession(obfuscatedToken, realToken);
      console.error(`[TOKEN] Rebuilt session from obfuscated token (len=${obfuscatedToken.length})`);
      return realToken;
    } catch (error) {
      console.error("Error deobfuscating token:", error);
      throw new Error("Invalid or expired token. Please authenticate again." + error);
    }
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

const server = new NammaYatriMCPServer();
server.start().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
