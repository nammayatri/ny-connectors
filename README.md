# Namma Yatri Connectors

A toolkit for booking and managing rides on the Namma Yatri platform. Provides three interfaces:

| Interface | Location | Use Case |
|-----------|----------|----------|
| **CLI (TUI)** | `ny-cli-tui/` | Interactive terminal interface (Node.js) |
| **CLI (Legacy)** | `cli/` | Bash-based terminal interface |
| **MCP Server** | `mcp/` | AI assistants (Claude Desktop, Cursor, etc.) |
| **Skill** | `skill.md` | LLM tools without MCP support (openClaw, etc.) |

## Quick Start

### CLI (recommended for terminal users)

```bash
curl -sSL https://raw.githubusercontent.com/nammayatri/ny-connectors/main/install.sh | sh
```

**With Node.js 18+**: Installs the interactive TUI with menus, fuzzy search, and autocomplete.

**Without Node.js**: Installs the legacy bash script.

Then:

```bash
ny-cli                    # Launch interactive TUI (or legacy if no Node.js)
ny-cli --legacy           # Force use legacy bash script
ny-cli-legacy             # Direct access to legacy script
```

---

## CLI Reference

### Installation

```bash
curl -sSL https://raw.githubusercontent.com/nammayatri/ny-connectors/main/install.sh | sh
```

**Requirements for TUI**:
- Node.js 18 or higher
- npm

**Requirements for Legacy**:
- `curl` and `bash`
- [`jq`](https://jqlang.github.io/jq/) recommended for formatted output

---

## TUI Features

The interactive Terminal User Interface provides a modern, user-friendly way to interact with Namma Yatri:

### Core Features

| Feature | Description |
|---------|-------------|
| **Interactive Menus** | Navigate with arrow keys, select with Enter |
| **Fuzzy Search** | Press `/` to filter menu options |
| **Location Autocomplete** | Real-time place suggestions as you type |
| **Saved Locations** | Quick access to Home, Work, and custom saved places |
| **Ride Search & Booking** | Search for rides between any two locations |
| **Estimate Selection** | Choose from available ride options with fare display |
| **Status Tracking** | View active and past rides |
| **Cancellation Support** | Cancel active searches |
| **Token Persistence** | Secure token storage in `~/.namma-yatri/token.json` |

### Keyboard Shortcuts

#### Global Shortcuts

| Key | Action |
|-----|--------|
| `↑/↓` | Navigate menu / list |
| `Enter` | Select option |
| `/` | Activate fuzzy search filter |
| `ESC` | Go back / Cancel / Clear filter |
| `Ctrl+C` | Force exit application |

#### Main Menu Quick Access

| Key | Action |
|-----|--------|
| `b` | Book a ride |
| `s` | Check status |
| `c` | Cancel ride |
| `t` | Settings |
| `q` | Quit |

#### Screen-Specific Shortcuts

| Screen | Key | Action |
|--------|-----|--------|
| Status | `r` | Refresh ride list |
| Status | `a` | Toggle all/active rides |
| Saved Locations | `r` | Refresh locations |
| Search | `Tab` | Switch between origin/destination |

### TUI Screens

#### Main Menu
The central hub for all operations. Shows authentication status and available actions.

#### Authentication Screen
- Enter mobile number and access code
- Access code can be found in Namma Yatri app → About Us section
- Token is securely stored for future sessions

#### Search Screen
- Search for origin and destination with autocomplete
- Use saved locations (Home, Work) for quick selection
- View available estimates with fare and vehicle type
- Select single or multiple estimates to increase booking chances

#### Status Screen
- View active rides
- View ride history
- See driver details and ride status

#### Cancel Screen
- List active searches
- Cancel pending ride requests

#### Settings Screen
- View authentication status
- Logout (clear stored token)
- View app configuration

---

## Migration from Legacy CLI

If you're upgrading from the legacy bash CLI, here's how the commands map to TUI actions:

| Legacy Command | TUI Equivalent |
|----------------|----------------|
| `ny-cli auth` | Launch TUI → Auth screen (auto-shown if not authenticated) |
| `ny-cli places "text"` | TUI → Book Ride → Search location |
| `ny-cli place-details --place-id X` | Integrated into search flow |
| `ny-cli search --from-lat X --from-lon Y --to-lat A --to-lon B` | TUI → Book Ride → Select locations |
| `ny-cli select --estimate-id X` | TUI → Book Ride → Select estimate |
| `ny-cli tip --estimate-id X --amount 20` | TUI → Book Ride → Add tip during selection |
| `ny-cli cancel --estimate-id X` | TUI → Cancel Ride → Select search |
| `ny-cli status --active` | TUI → Check Status |
| `ny-cli saved-locations` | TUI → Saved Locations |

### Key Differences

| Aspect | Legacy CLI | TUI |
|--------|-----------|-----|
| **Interaction** | Command-line arguments | Interactive menus |
| **Location Entry** | Coordinates required | Autocomplete search |
| **Estimate Selection** | Manual estimate ID | Visual list with fares |
| **Output Format** | JSON (with jq) | Formatted tables |
| **Error Handling** | Exit codes | In-app error messages |
| **Session Persistence** | Manual token management | Automatic |

### When to Use Legacy

The legacy CLI is still useful for:
- **Scripting**: Automation and CI/CD pipelines
- **No Node.js**: Systems without Node.js 18+
- **Quick commands**: Single operations without interaction
- **Piping output**: JSON output for further processing

Access legacy mode:
```bash
ny-cli --legacy auth --mobile 9876543210 --code YOUR_CODE
ny-cli-legacy status --active
```

---

## Legacy CLI Commands

| Command | Description |
|---------|-------------|
| `ny-cli auth` | Authenticate with Namma Yatri |
| `ny-cli places <text>` | Search for places (autocomplete) |
| `ny-cli place-details` | Get place coordinates and address |
| `ny-cli search` | Search for available rides |
| `ny-cli select` | Select an estimate to book a ride |
| `ny-cli tip` | Add a tip and select estimate |
| `ny-cli cancel` | Cancel an active search |
| `ny-cli status` | Check ride booking status |
| `ny-cli saved-locations` | List saved locations (Home, Work, etc.) |
| `ny-cli help` | Show help |

### Legacy Examples

```bash
# Authenticate
ny-cli auth --mobile 9876543210 --code YOUR_CODE

# Interactive auth (prompts for input)
ny-cli auth

# Search for a place
ny-cli places "Koramangala"

# Get coordinates for a place
ny-cli place-details --place-id "ChIJx9..."

# Get address from coordinates
ny-cli place-details --lat 12.935 --lon 77.624

# Search for rides
ny-cli search --from-lat 12.935 --from-lon 77.624 --to-lat 12.971 --to-lon 77.594

# Select an estimate
ny-cli select --estimate-id "abc-123"

# Select multiple estimates
ny-cli select --estimate-id "abc-123" --also "def-456,ghi-789"

# Add a tip
ny-cli tip --estimate-id "abc-123" --amount 20

# Cancel a search
ny-cli cancel --estimate-id "abc-123"

# Check active rides
ny-cli status --active

# Check all rides
ny-cli status --all

# List saved locations
ny-cli saved-locations
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NY_API_BASE` | `https://api.moving.tech/pilot/app/v2` | API base URL (Legacy CLI) |
| `NAMMA_YATRI_API_BASE` | `https://api.sandbox.moving.tech/dev/app/v2` | API base URL (MCP/TUI) |

---

## Token Storage

All interfaces store authentication tokens at `~/.namma-yatri/token.json`:

```json
{
  "token": "obfuscated-token-string",
  "savedLocations": [...],
  "savedLocationsUpdatedAt": "2024-01-15T10:30:00Z"
}
```

File permissions are set to `600` (owner-only read/write) for security.

---

## Development

### Workspace Structure

This repository uses npm workspaces for managing multiple packages:

```
ny-connectors/
├── package.json              # Root workspace config
├── ny-cli-tui/               # Interactive TUI package
├── shared/api-client/        # Shared API client library
├── mcp/                      # MCP server package
├── connectors/               # Webhook connectors
└── cli/                      # Legacy bash scripts
```

### Building from Source

```bash
# Clone the repository
git clone https://github.com/nammayatri/ny-connectors.git
cd ny-connectors

# Install all dependencies
npm install

# Build all packages
npm run build

# Build specific package
npm run build:tui
npm run build:mcp

# Development mode
npm run dev:tui
npm run dev:mcp
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build all packages |
| `npm run build:tui` | Build TUI only |
| `npm run build:mcp` | Build MCP server only |
| `npm run dev:tui` | Run TUI in dev mode |
| `npm run dev:mcp` | Run MCP in dev mode |
| `npm run lint` | Lint all packages |
| `npm run typecheck` | Type check all packages |
| `npm run clean` | Clean all build artifacts |

---

## Troubleshooting

### TUI Issues

**"Node.js 18+ required"**
- Install Node.js 18 or higher from https://nodejs.org/
- The installer will fall back to legacy CLI if Node.js is unavailable

**"Token not found" or authentication errors**
- Delete `~/.namma-yatri/token.json` and re-authenticate
- Ensure your access code is from Namma Yatri app → About Us

**"Cannot find module" errors**
- Run `npm install` in the repository root
- Rebuild with `npm run build`

**TUI appears broken or unresponsive**
- Try running with a fresh terminal
- Check terminal supports Unicode and 256 colors
- Use `ny-cli --legacy` as fallback

### Legacy CLI Issues

**"jq not found"**
- Install jq: `brew install jq` (macOS) or `apt install jq` (Ubuntu)
- Output will be raw JSON without jq

**"Permission denied"**
- Ensure script is executable: `chmod +x ~/.local/bin/ny-cli-legacy`

---

## Repository Structure

```
ny-connectors/
├── package.json              # Root workspace config
├── install.sh                # Unified installer
├── README.md                 # This file
├── CLAUDE.md                 # Claude Code instructions
├── skill.md                  # LLM skill file
├── ny-cli-tui/               # Interactive TUI (Node.js/Ink)
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── app.tsx           # Main TUI application
│   │   ├── api/              # API client
│   │   ├── components/       # Reusable components
│   │   ├── screens/          # Screen components
│   │   ├── hooks/            # React hooks
│   │   ├── store/            # State management
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # Utilities
│   ├── package.json
│   └── tsconfig.json
├── shared/
│   └── api-client/           # Shared API client library
│       ├── src/
│       │   ├── client.ts     # HTTP client
│       │   ├── types.ts      # Type definitions
│       │   └── index.ts      # Exports
│       └── package.json
├── mcp/                      # MCP server (TypeScript)
│   ├── src/
│   │   └── index.ts          # Server implementation
│   ├── package.json
│   └── Dockerfile
├── connectors/               # Webhook connectors
│   ├── src/
│   │   ├── app.ts
│   │   └── connectors/
│   └── package.json
└── cli/
    ├── ny-cli.sh             # Current bash CLI
    └── ny-cli-legacy.sh      # Legacy version backup
```

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

---

## Skill File

The `skill.md` file at the repo root contains curl-based instructions for all Namma Yatri API operations. It is designed for LLM tools that support skill/instruction files but not MCP (e.g., openClaw).

To use: copy `skill.md` into your LLM tool's skill configuration.

---

## Docker (MCP)

```bash
docker build -t ny-mcp ./mcp
docker run -p 3000:3000 ny-mcp
```

The CI pipeline builds and pushes the MCP image to `ghcr.io/nammayatri/ny-mcp` on pushes to `main` and version tags.

---

## Example Flow

### TUI Flow (Recommended)

```
1. Launch TUI:      ny-cli
2. Authenticate:    Auto-shown if not authenticated
3. Book ride:       Press 'b' or select "Book Ride"
4. Search origin:   Type location, select from suggestions
5. Search dest:     Type destination, select from suggestions
6. Select estimate: Choose from available rides with fares
7. Check status:    Press 's' or select "Check Status"
```

### Legacy Flow

```
1. Authenticate:    ny-cli auth
2. Search place:    ny-cli places "Koramangala"
3. Get details:     ny-cli place-details --place-id "ChIJ..."
4. Search rides:    ny-cli search --from-lat 12.93 --from-lon 77.62 --to-lat 12.97 --to-lon 77.59
5. Book a ride:     ny-cli select --estimate-id "abc-123"
6. Check status:    ny-cli status
7. Cancel if needed: ny-cli cancel --estimate-id "abc-123"
```

---

## License

ISC