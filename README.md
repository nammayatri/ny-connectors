# Namma Yatri MCP Server

A fully type-safe Model Context Protocol (MCP) server for booking rides using Namma Yatri APIs. Built with TypeScript for maximum type safety and developer experience.

## Overview

This MCP server enables AI assistants like Claude to interact with Namma Yatri's ride-booking platform, allowing users to search for rides, compare prices, select vehicles, and manage bookings through natural language.

## Features

- **Full Type Safety**: Comprehensive TypeScript interfaces for all API requests/responses
- **State Management**: Secure token storage with persistent disk storage (never exposed to LLM)
- **Automatic Polling**: Waits for ride estimates to be available
- **8 Powerful Tools**: Complete ride booking workflow

## Tools

### 1. `get_token`
Authenticates the user and stores the auth token securely. The token is persisted to disk and will be automatically loaded on future server restarts, so you typically only need to authenticate once.

**Parameters:**
- `country` (string): Country code (e.g., "IN")
- `mobileNumber` (string): User's mobile number
- `accessCode` (string): App secret access code

**Returns:**
- Authentication status
- User information
- Auth ID for tracking

**Security:** The actual token is stored internally and never exposed to the LLM. It is saved to `~/.namma-yatri-mcp/token.json` for persistence across server restarts.

**Note:** After authenticating once, the token persists. You only need to call this again if the token expires or is cleared.

### 2. `get_places`
Autocomplete search for locations.

**Parameters:**
- `searchText` (string): Location name or address
- `sourceLat` (optional number): Source latitude for proximity search
- `sourceLon` (optional number): Source longitude for proximity search

**Returns:**
- Array of predictions with descriptions, place IDs, distances

**Example:**
```typescript
{
  searchText: "Koramangala",
  sourceLat: 12.9352,
  sourceLon: 77.6245
}
```

### 3. `get_place_details`
Gets detailed location information including coordinates.

**Parameters:**
- `placeId` (string): Place ID from get_places results

**Returns:**
- Latitude and longitude
- Full address details

### 4. `search_ride`
Searches for available rides between two locations. Automatically polls for results. **Supports direct latitude/longitude coordinates** - you can pass coordinates as strings or numbers.

**Parameters:**
- `originLat` (number | string): Pickup latitude as number OR coordinates as "lat,lon" string (e.g., "12.9352,77.6245")
- `originLon` (number, optional): Pickup longitude (required only if originLat is a number, not needed if originLat is "lat,lon" string)
- `originAddress` (object, optional): Pickup address details (will be auto-generated from coordinates if not provided)
- `destinationLat` (number | string): Drop-off latitude as number OR coordinates as "lat,lon" string (e.g., "12.9716,77.5946")
- `destinationLon` (number, optional): Drop-off longitude (required only if destinationLat is a number, not needed if destinationLat is "lat,lon" string)
- `destinationAddress` (object, optional): Drop-off address details (will be auto-generated from coordinates if not provided)

**Usage Examples:**
```json
// Direct coordinates as strings (easiest)
{
  "originLat": "12.9352,77.6245",
  "destinationLat": "12.9716,77.5946"
}

// Or separate lat/lon numbers
{
  "originLat": 12.9352,
  "originLon": 77.6245,
  "destinationLat": 12.9716,
  "destinationLon": 77.5946
}

// With full address objects (traditional way)
{
  "originLat": 12.9352,
  "originLon": 77.6245,
  "originAddress": {...},
  "destinationLat": 12.9716,
  "destinationLon": 77.5946,
  "destinationAddress": {...}
}
```

**Returns:**
- Search ID
- Array of ride estimates with:
  - Estimated fare and fare range
  - Vehicle variant and service tier
  - Estimated pickup duration
  - Provider information
  - Tip options
  - Night shift charges (if applicable)
  - Toll charges (if applicable)

**Polling Behavior:**
- Polls every 2 seconds
- Maximum 10 seconds wait time
- Returns as soon as estimates are available

### 5. `add_tip`
Adds a tip to a ride estimate and selects it for booking.

**Parameters:**
- `estimateId` (string): The estimate ID to add tip to
- `tipAmount` (number): Tip amount
- `tipCurrency` (string, optional): Currency code (default: "INR")

**Returns:**
- Success confirmation
- Selected estimate ID

### 6. `select_multiple_variants`
Selects multiple vehicle variants to increase chances of getting a ride.

**Parameters:**
- `primaryEstimateId` (string): Primary vehicle estimate
- `additionalEstimateIds` (array of strings): Other vehicle estimates
- `specialAssistance` (boolean, optional): Require special assistance
- `isPetRide` (boolean, optional): Is this a pet-friendly ride

**Returns:**
- Success confirmation
- All selected estimate IDs

**Use Case:** Select both "Auto" and "Mini" to increase ride availability.

### 7. `cancel_search`
Cancels an active ride search.

**Parameters:**
- `estimateId` (string): Estimate ID to cancel

**Returns:**
- Success confirmation

### 8. `fetch_status`
Fetches the status of ride bookings.

**Parameters:**
- `limit` (number, optional): Max number of results
- `offset` (number, optional): Pagination offset
- `onlyActive` (boolean, optional): Only active rides (default: true)
- `status` (array of strings, optional): Filter by status

**Returns:**
- List of ride bookings with:
  - Booking ID and status
  - Locations
  - Driver and vehicle information
  - Timestamps

## Installation

```bash
npm install
```

## Development

### Build the project
```bash
npm run build
```

### Run in development mode
```bash
npm run dev
```

### Watch mode (auto-rebuild)
```bash
npm run watch
```

## Configuration

The server connects to Namma Yatri's API at `https://api.nammayatri.in`.

You can modify these constants in `src/index.ts`:
```typescript
const NAMMA_YATRI_API_BASE = "https://api.nammayatri.in";
const POLLING_INTERVAL_MS = 2000;  // Poll every 2 seconds
const MAX_POLLING_DURATION_MS = 10000;  // Max 10 seconds
```

## Running as HTTP Server (MCP Remote)

This MCP server can run as an HTTP server for remote access. This is useful for deploying the server separately and connecting to it remotely.

### Start the HTTP Server

```bash
npm run build
npm start
```

Or set custom port and host:

```bash
PORT=3000 HOST=0.0.0.0 npm start
```

The server will start on `http://0.0.0.0:3000` (or your configured port) with the following endpoints:
- **SSE Endpoint**: `http://localhost:3000/sse` - For establishing SSE connection
- **Message Endpoint**: `http://localhost:3000/message` - For sending MCP messages
- **Health Check**: `http://localhost:3000/health` - For health monitoring

### Configure MCP Client for Remote Server

#### For Cursor:

```json
{
  "mcp.servers": {
    "namma-yatri": {
      "type": "http",
      "url": "http://localhost:3000/sse",
      "requestInit": {
        "headers": {}
      }
    }
  }
}
```

#### For Claude Desktop:

```json
{
  "mcpServers": {
    "namma-yatri": {
      "type": "http",
      "url": "http://localhost:3000/sse",
      "requestInit": {
        "headers": {}
      }
    }
  }
}
```

**For production/remote deployment:**
- Replace `localhost:3000` with your actual server URL
- Add authentication headers if needed:
  ```json
  "requestInit": {
    "headers": {
      "Authorization": "Bearer YOUR_TOKEN"
    }
  }
  ```

### Environment Variables

- `PORT` - HTTP server port (default: 3000)
- `HOST` - HTTP server host (default: 0.0.0.0)

## Using with Claude Desktop (Stdio)

Add to your Claude Desktop configuration:

### macOS
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "namma-yatri": {
      "command": "node",
      "args": ["/absolute/path/to/ny-mcp/dist/index.js"]
    }
  }
}
```

### Windows
Edit `%APPDATA%\Claude\claude_desktop_config.json` with the same format.

**Important:**
1. Replace `/absolute/path/to/ny-mcp` with the actual absolute path
2. Build the project first: `npm run build`
3. Restart Claude Desktop after updating the config

## Using with Cursor

Cursor IDE supports MCP servers through its settings configuration. Here's how to integrate this MCP server:

### Step 1: Build the Project

Ensure the project is built:

```bash
npm run build
```

This creates the `dist/index.js` file that Cursor will execute.

### Step 2: Configure Cursor Settings

1. Open Cursor Settings:
   - Press `Cmd+,` (macOS) or `Ctrl+,` (Windows/Linux)
   - Or go to **Cursor → Settings** (macOS) or **File → Preferences → Settings** (Windows/Linux)

2. Search for "MCP" in the settings search bar

3. Click on **"Edit in settings.json"** or manually edit the settings file:

   **macOS**: `~/Library/Application Support/Cursor/User/settings.json`
   
   **Windows**: `%APPDATA%\Cursor\User\settings.json`
   
   **Linux**: `~/.config/Cursor/User/settings.json`

4. Add the MCP server configuration:

```json
{
  "mcp.servers": {
    "namma-yatri": {
      "command": "node",
      "args": ["/Users/piyush/Projects/ny-mcp/dist/index.js"]
    }
  }
}
```

**Important:**
- Replace `/Users/piyush/Projects/ny-mcp/dist/index.js` with the **absolute path** to your `dist/index.js` file
- You can find the absolute path by running: `pwd` in your terminal while in the project directory, then append `/dist/index.js`
- On macOS, you can also right-click the file in Finder and hold Option to copy the path

### Alternative: Using npx (if published to npm)

If the package is published to npm, you can use npx:

```json
{
  "mcp.servers": {
    "namma-yatri": {
      "command": "npx",
      "args": ["ny-mcp"]
    }
  }
}
```

**Note:** This requires the package to be published to npm. For local development, use the direct path method above.

### Step 3: Restart Cursor

After saving the configuration file, restart Cursor completely for the changes to take effect.

### Step 4: Verify Integration

1. Open Cursor's chat panel (Cmd+L or Ctrl+L)
2. The MCP tools should now be available to the AI assistant
3. You can verify by asking the AI to list available tools or trying a command like "Book me a ride"

### Troubleshooting Cursor Integration

**Tools not appearing:**
- Make sure you've restarted Cursor after adding the configuration
- Verify the path in `settings.json` is correct and uses absolute path
- Check that `dist/index.js` exists (run `npm run build` if needed)
- Ensure Node.js is available in your PATH (test with `which node` or `where node`)

**MCP server errors:**
- Check Cursor's Developer Tools (Help → Toggle Developer Tools) for error messages
- Verify Node.js version compatibility (Node.js 18+ recommended)
- Make sure all dependencies are installed: `npm install`

**Path issues on Windows:**
- Use forward slashes or escaped backslashes: `"C:\\Users\\YourName\\Projects\\ny-mcp\\dist\\index.js"`
- Or use forward slashes: `"C:/Users/YourName/Projects/ny-mcp/dist/index.js"`

## Example Usage Flow

Here's a typical conversation flow with Claude:

```
User: "Book me a ride from Koramangala to MG Road"

Claude will:
1. Use get_places to find "Koramangala" and "MG Road"
2. Use get_place_details to get exact coordinates
3. Use search_ride to find available rides
4. Present options (Auto: ₹80, Mini: ₹120, etc.)

User: "Book the Auto and add a ₹10 tip"

Claude will:
5. Use add_tip with the Auto estimate ID and ₹10

User: "What's the status?"

Claude will:
6. Use fetch_status to check booking status
```

**Direct Coordinate Booking:**

You can also book directly using coordinates without looking up places:

```
User: "I want to go from 12.9352,77.6245 to 12.9716,77.5946"

Claude will:
1. Parse the coordinate strings directly
2. Use search_ride with originLat="12.9352,77.6245" and destinationLat="12.9716,77.5946"
3. Address objects are auto-generated from the coordinates
4. Present ride options
```

## Architecture

### Type-Safe Design

All API interactions are fully typed:

```typescript
interface GetTokenArgs {
  country: string;
  mobileNumber: string;
  accessCode: string;
}

interface GetTokenResponse {
  authId: string;
  attempts: number;
  authType: string;
  token?: string;
  person?: PersonAPIEntity;
  isPersonBlocked: boolean;
}
```

### State Management

The server maintains state for:
- **authToken**: Stored securely in memory and persisted to disk, never exposed to LLM
  - Token is saved to `~/.namma-yatri-mcp/token.json` after successful authentication
  - Token is automatically loaded on server startup if available
  - Token is automatically cleared if authentication fails (401/403 errors)
  - This allows you to authenticate once and reuse the token across server restarts
- **currentSearchId**: Tracks the active search
- **currentEstimateId**: Tracks the selected estimate

### Error Handling

All API calls are wrapped in try-catch blocks with informative error messages:

```typescript
try {
  return await this.handleSearchRide(args);
} catch (error) {
  return {
    content: [{
      type: "text",
      text: `Error: ${error.message}`
    }]
  };
}
```

## Project Structure

```
ny-mcp/
├── src/
│   └── index.ts              # Main server implementation
│       ├── Configuration     # API base URL, polling config
│       ├── Type Definitions  # All TypeScript interfaces
│       ├── Server Class      # NammaYatriMCPServer
│       ├── Tool Handlers     # 8 tool implementations
│       └── Helper Methods    # API calls, polling, auth
├── dist/                     # Compiled JavaScript
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── README.md                # This file
```

## TypeScript Features

### 1. Strict Type Checking
```typescript
// tsconfig.json has strict: true
interface SearchRideArgs {
  originLat: number;        // Must be number
  originLon: number;        // Must be number
  originAddress: Address;   // Must match Address interface
  // ... etc
}
```

### 2. Optional Parameters with Defaults
```typescript
private async makeApiCall<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET",  // Default to GET
  body?: unknown,                   // Optional
  requireAuth: boolean = true       // Default to true
): Promise<T>
```

### 3. Discriminated Unions
```typescript
type AutoCompleteType = "DROP" | "PICKUP";
type ServiceTierType = "COMFY" | "SEDAN" | "SUV" | "AUTO";
```

### 4. Generic API Calls
```typescript
const response = await this.makeApiCall<GetTokenResponse>(
  "/v2/auth/get-token",
  "POST",
  request
);
// response is automatically typed as GetTokenResponse
```

## Security Considerations

1. **Token Storage**: 
   - Auth tokens are stored in private class variables and never returned to the LLM
   - Tokens are persisted to `~/.namma-yatri-mcp/token.json` on disk for convenience
   - The token file should have appropriate file permissions (automatically created with user-only access)
   - Tokens are automatically cleared if authentication fails or expires
2. **API Credentials**: Access codes should be kept secure
3. **Error Messages**: API errors are caught and formatted without exposing sensitive data
4. **Token Persistence**: The saved token allows you to avoid re-authentication, but if the token file is compromised, an attacker could potentially use it. Store it securely or delete `~/.namma-yatri-mcp/token.json` if needed.

## API Documentation

This server implements the Namma Yatri v2 API:

- Auth: `/v2/auth/get-token`
- Maps: `/v2/maps/autoComplete`, `/v2/maps/getPlaceName`
- Ride Search: `/v2/rideSearch`, `/v2/rideSearch/{id}/results`
- Estimate Selection: `/v2/estimate/{id}/select2`, `/v2/estimate/{id}/cancelSearch`
- Booking Status: `/v2/rideBooking/list`

## Troubleshooting

### "Not authenticated" Error
- If you see this error, call `get_token` first to authenticate
- **Note**: After authenticating once, the token is saved to `~/.namma-yatri-mcp/token.json` and will be automatically loaded on future server restarts
- If authentication keeps failing, the token may have expired - delete `~/.namma-yatri-mcp/token.json` and re-authenticate

### Token Persistence Issues
- **Token expired**: If API calls start failing with 401/403 errors, the token has likely expired. The server will automatically clear it, but you'll need to call `get_token` again
- **Clear saved token**: Delete the file `~/.namma-yatri-mcp/token.json` to force re-authentication
- **Token location**: Saved tokens are stored at `~/.namma-yatri-mcp/token.json` (in your home directory)

### Polling Timeout
If no rides are found after 10 seconds, try:
- Different locations
- Different time of day
- Checking if service is available in the area

### Build Errors
```bash
rm -rf dist node_modules
npm install
npm run build
```

## Contributing

When adding new tools:

1. Define TypeScript interfaces for args and response
2. Add tool definition to `setupHandlers()`
3. Implement handler method
4. Add case to switch statement
5. Update this README

## License

ISC

## Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Code](https://docs.claude.com/claude-code)
- [Namma Yatri](https://nammayatri.in/)
