# Namma Yatri Connectors

A toolkit for booking and managing rides on the Namma Yatri platform. Provides three interfaces:

| Interface | Location | Use Case |
|-----------|----------|----------|
| **CLI TUI** | `ny-cli-tui/` | Interactive terminal UI with fuzzy search and ride booking |
| **MCP Server** | `mcp/` | AI assistants (Claude Desktop, Cursor, etc.) |
| **Skill** | `skill.md` | LLM tools without MCP support (openClaw, etc.) |

## Quick Start

### CLI TUI (recommended)

```bash
# Install from source
cd ny-cli-tui
npm install
npm run build
npm link

# Or run directly
npm run dev
```

Then:

```bash
ny-cli                    # Start interactive ride booking
ny-cli auth               # Authenticate with Namma Yatri
ny-cli status             # Check active rides
ny-cli locations          # Manage saved locations
ny-cli logout             # Clear stored credentials
```

### Legacy CLI (bash script)

For systems without Node.js:

```bash
curl -sSL https://raw.githubusercontent.com/nammayatri/ny-connectors/main/install.sh | sh
ny-cli-legacy help
```

---

## ny-cli-tui Reference

An interactive terminal UI for booking Namma Yatri rides with a premium, elegant design.

### Features

- **Interactive Ride Booking** — Full booking flow from authentication to ride confirmation
- **Fuzzy Location Search** — Search saved locations (Home, Work) and places with fuzzy matching
- **Estimate Selection** — Browse and select ride estimates with keyboard navigation
- **Saved Locations** — Quick access to Home, Work, and other saved places
- **Session Persistence** — Remembers recent locations and preferences
- **Ride Status Tracking** — Monitor active and recent rides
- **Token Management** — Secure token storage with logout support

### Installation

```bash
# From source
cd ny-cli-tui
npm install
npm run build

# Link globally
npm link

# Or run directly in development
npm run dev
```

**Requirements**: Node.js 18+

### Commands

| Command | Description |
|---------|-------------|
| `ny-cli` | Start interactive ride booking (default) |
| `ny-cli book` | Same as above (explicit) |
| `ny-cli book --from "home" --to "work"` | Start with pre-filled locations |
| `ny-cli auth` | Authenticate with Namma Yatri |
| `ny-cli auth --mobile 9876543210 --code XXXX` | Non-interactive auth |
| `ny-cli status` | Check active and recent rides |
| `ny-cli status --all` | Show all rides including completed |
| `ny-cli locations` | Manage saved locations |
| `ny-cli logout` | Clear stored token and session data |
| `ny-cli token-info` | Show token storage information |
| `ny-cli session-info` | Show session status and preferences |

### Keyboard Shortcuts

#### Location Search
| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate results |
| `Enter` | Select location |
| `Esc` / `q` | Go back / Cancel |
| Type | Fuzzy search through saved locations and places |

#### Estimate Selection
| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate estimates |
| `Enter` | Select and book ride |
| `Esc` / `q` | Cancel search |

#### Ride Status
| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate rides |
| `Enter` | View ride details |
| `Esc` / `q` | Exit |

#### Authentication
| Key | Action |
|-----|--------|
| `0-9` | Enter OTP digits |
| `Backspace` | Delete last digit |
| `Enter` | Submit (when complete) |
| `Esc` | Cancel |

### Options

#### `ny-cli book`
```
--from <location>    Pre-fill origin (address or saved location name)
--to <location>      Pre-fill destination
```

#### `ny-cli auth`
```
--mobile <number>    Mobile number (skip prompt)
--code <code>        Access code from Namma Yatri app > About Us
--country <code>     Country code (default: IN)
```

#### `ny-cli status`
```
--all                Show all rides including completed
--limit <number>     Maximum rides to display (default: 10)
```

#### `ny-cli session-info`
```
--json               Output as JSON
```

### Logout

To clear all stored credentials and session data:

```bash
ny-cli logout
```

This removes:
- Authentication token (`~/.namma-yatri-mcp/user-token.json`)
- Session data including recent locations and preferences

### Token Storage

Tokens are stored at `~/.namma-yatri-mcp/user-token.json` with the following structure:

```json
{
  "token": "...",
  "savedAt": "2024-01-15T10:30:00Z",
  "savedLocations": [...],
  "savedLocationsUpdatedAt": "2024-01-15T10:30:00Z"
}
```

Session data is stored at `~/.namma-yatri-mcp/session.json`:

```json
{
  "recentLocations": [...],
  "preferences": {
    "defaultCountry": "IN",
    "preferredVehicles": ["AUTO_RICKSHAW"],
    "defaultTipPercent": 5
  }
}
```

---

## ny-cli-legacy Reference

The original bash-based CLI for systems without Node.js. Installed as `ny-cli-legacy` to avoid conflicts.

### Installation

```bash
curl -sSL https://raw.githubusercontent.com/nammayatri/ny-connectors/main/install.sh | sh
```

Installs `ny-cli-legacy` to `~/.local/bin/`. Requires `curl` and `bash`. Install [`jq`](https://jqlang.github.io/jq/) for formatted output.

### Commands

| Command | Description |
|---------|-------------|
| `ny-cli-legacy auth` | Authenticate with Namma Yatri |
| `ny-cli-legacy places <text>` | Search for places (autocomplete) |
| `ny-cli-legacy place-details` | Get place coordinates and address |
| `ny-cli-legacy search` | Search for available rides |
| `ny-cli-legacy select` | Select an estimate to book a ride |
| `ny-cli-legacy tip` | Add a tip and select estimate |
| `ny-cli-legacy cancel` | Cancel an active search |
| `ny-cli-legacy status` | Check ride booking status |
| `ny-cli-legacy saved-locations` | List saved locations (Home, Work, etc.) |
| `ny-cli-legacy help` | Show help |

### Examples

```bash
# Authenticate
ny-cli-legacy auth --mobile 9876543210 --code YOUR_CODE

# Search for a place
ny-cli-legacy places "Koramangala"

# Get coordinates for a place
ny-cli-legacy place-details --place-id "ChIJx9..."

# Get address from coordinates
ny-cli-legacy place-details --lat 12.935 --lon 77.624

# Search for rides
ny-cli-legacy search --from-lat 12.935 --from-lon 77.624 --to-lat 12.971 --to-lon 77.594

# Select an estimate
ny-cli-legacy select --estimate-id "abc-123"

# Select multiple estimates
ny-cli-legacy select --estimate-id "abc-123" --also "def-456,ghi-789"

# Add a tip
ny-cli-legacy tip --estimate-id "abc-123" --amount 20

# Cancel a search
ny-cli-legacy cancel --estimate-id "abc-123"

# Check active rides
ny-cli-legacy status --active

# Check all rides
ny-cli-legacy status --all

# List saved locations
ny-cli-legacy saved-locations
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NY_API_BASE` | `https://api.moving.tech/pilot/app/v2` | API base URL |

---

## MCP Server Reference

### Setup

```bash
cd mcp
npm install
npm run build
```

### Development

```bash
cd mcp
npm run dev     # Run with tsx (hot reload)
npm run watch   # Continuous TypeScript compilation
```

### Running as HTTP Server

```bash
cd mcp
npm start
# Or with custom port:
PORT=3000 HOST=0.0.0.0 npm start
```

Endpoints:
- **SSE**: `http://localhost:3000/sse`
- **Messages**: `http://localhost:3000/message`
- **Health**: `http://localhost:3000/health`

### MCP Client Configuration

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "namma-yatri": {
      "command": "node",
      "args": ["/path/to/ny-connectors/mcp/dist/index.js"]
    }
  }
}
```

#### Cursor

```json
{
  "mcp.servers": {
    "namma-yatri": {
      "command": "node",
      "args": ["/path/to/ny-connectors/mcp/dist/index.js"]
    }
  }
}
```

#### Remote (HTTP/SSE)

```json
{
  "mcpServers": {
    "namma-yatri": {
      "type": "http",
      "url": "http://localhost:3000/sse"
    }
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `get_token` | Authenticate with Namma Yatri |
| `get_places` | Autocomplete place search |
| `get_place_details` | Get place coordinates/address |
| `search_ride` | Search for rides (polls for estimates) |
| `select_estimate` | Select estimate(s) for booking |
| `add_tip` | Add tip and select estimate |
| `cancel_search` | Cancel active search |
| `fetch_status` | Check ride booking status |
| `get_saved_locations` | List saved locations |

### Environment Variables (MCP)

| Variable | Default | Description |
|----------|---------|-------------|
| `NAMMA_YATRI_API_BASE` | `https://api.sandbox.moving.tech/dev/app/v2` | API base URL |
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | HTTP server host |

---

## Skill File

The `skill.md` file at the repo root contains curl-based instructions for all Namma Yatri API operations. It is designed for LLM tools that support skill/instruction files but not MCP (e.g., openClaw).

To use: copy `skill.md` into your LLM tool's skill configuration.

---

## Architecture

### Shared API Client

The `common/` package contains a shared Namma Yatri API client used by both the MCP server and CLI TUI:

```
common/
├── src/
│   ├── index.ts          # Main exports
│   ├── api/
│   │   └── index.ts      # NammaYatriClient class
│   └── types/
│       └── index.ts      # TypeScript types
└── package.json
```

This ensures consistent API behavior across all interfaces and reduces code duplication.

**Usage:**

```typescript
import { NammaYatriClient, createProductionClient } from '@ny-connectors/common';

// Using factory
const client = createProductionClient();

// Or with custom config
const client = new NammaYatriClient({
  apiBase: 'https://api.moving.tech/pilot/app/v2',
  pollIntervalMs: 2000,
  searchPollMaxMs: 10000,
});

// Search for rides
const { searchId, estimates } = await client.searchRide({
  originLat: 12.935,
  destLat: 12.971,
  destLon: 77.594,
  token: 'your-token',
});
```

### Repository Structure

```
ny-connectors/
├── common/                      # Shared API client and types
│   ├── src/
│   │   ├── index.ts
│   │   ├── api/
│   │   │   └── index.ts         # NammaYatriClient
│   │   └── types/
│   │       └── index.ts         # TypeScript interfaces
│   └── package.json
├── ny-cli-tui/                  # Interactive CLI TUI (Node.js)
│   ├── src/
│   │   ├── cli.ts               # CLI entry point
│   │   ├── app/                 # Main application
│   │   ├── auth/                # Authentication flow
│   │   ├── locations/           # Location search
│   │   ├── rides/               # Ride booking
│   │   ├── ui/                  # UI components
│   │   └── theme.ts             # Design system
│   └── package.json
├── mcp/                         # MCP server (TypeScript)
│   ├── src/
│   │   └── index.ts             # Server implementation
│   ├── package.json
│   └── Dockerfile
├── cli/
│   └── ny-cli.sh                # Legacy bash CLI
├── skill.md                     # LLM skill file
├── install.sh                   # Legacy CLI installer
└── README.md
```

---

## Docker (MCP)

```bash
docker build -t ny-mcp ./mcp
docker run -p 3000:3000 ny-mcp
```

The CI pipeline builds and pushes the MCP image to `ghcr.io/nammayatri/ny-mcp` on pushes to `main` and version tags.

---

## Example Flow

### Using CLI TUI

```
1. Authenticate:    ny-cli auth
2. Book ride:       ny-cli
3. Search origin:   Type "home" or address
4. Search dest:     Type "work" or address
5. Select estimate: Use ↑/↓ and Enter
6. Check status:    ny-cli status
```

### Using Legacy CLI

```
1. Authenticate:    ny-cli-legacy auth
2. Search place:    ny-cli-legacy places "Koramangala"
3. Get details:     ny-cli-legacy place-details --place-id "ChIJ..."
4. Search rides:    ny-cli-legacy search --from-lat 12.93 --from-lon 77.62 --to-lat 12.97 --to-lon 77.59
5. Book a ride:     ny-cli-legacy select --estimate-id "abc-123"
6. Check status:    ny-cli-legacy status
7. Cancel if needed: ny-cli-legacy cancel --estimate-id "abc-123"
```

---

## Development

### Building All Packages

```bash
# Build common package first (dependency)
cd common && npm install && npm run build

# Build CLI TUI
cd ../ny-cli-tui && npm install && npm run build

# Build MCP server
cd ../mcp && npm install && npm run build
```

### Running Tests

```bash
npm test
```

### Type Checking

```bash
npm run typecheck
```

---

## License

ISC