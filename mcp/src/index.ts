#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
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

// HTTP Server configuration
const HTTP_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HTTP_HOST = process.env.HOST || "0.0.0.0";
const SSE_ENDPOINT = "/sse";
const MESSAGE_ENDPOINT = "/message";

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
      location: "12.97413032560963,77.58534937018615", // Hardcoded location
      origin:
        args.sourceLat && args.sourceLon
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

  // ============================================================================
  // Token Storage Methods
  // ============================================================================

  /**
   * Loads saved token from disk if it exists
   * Only loads if token is not already in memory
   */
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
    obfuscatedToken?: string
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

    return (await response.json()) as T;
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
      console.log("Real token:", realToken);
      console.log("Obfuscated token:", obfuscatedToken);
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
