# Namma Yatri Connectors

A toolkit for booking and managing rides on the Namma Yatri platform. Provides three interfaces:

| Interface | Location | Use Case |
|-----------|----------|----------|
| **MCP Server** | `mcp/` | AI assistants (Claude Desktop, Cursor, etc.) |
| **CLI** | `cli/` | Terminal-based ride booking |
| **Skill** | `skill.md` | LLM tools without MCP support (openClaw, etc.) |

## Quick Start

### CLI (recommended for terminal users)

```bash
curl -sSL https://raw.githubusercontent.com/nammayatri/ny-connectors/main/install.sh | sh
```

Then:

```bash
ny-cli auth --mobile 9876543210 --code YOUR_ACCESS_CODE
ny-cli places "Koramangala"
ny-cli search --from-lat 12.935 --from-lon 77.624 --to-lat 12.971 --to-lon 77.594
ny-cli status
```

Run `ny-cli help` for all commands.

### Skill (for LLM tools)

Copy `skill.md` into your LLM tool's skill/instruction configuration. It contains curl-based API calls for all ride-booking operations.

### MCP Server (for AI assistants)

```bash
cd mcp
npm install
npm run build
npm start
```

## Repository Structure

```
ny-connectors/
├── mcp/                          # MCP server (TypeScript)
│   ├── src/
│   │   └── index.ts              # Server implementation (~2000 lines)
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── cli/
│   └── ny-cli.sh                 # Bash CLI tool
├── skill.md                      # LLM skill file (curl-based)
├── install.sh                    # CLI installer
├── CLAUDE.md                     # Claude Code instructions
├── .github/
│   └── workflows/
│       └── docker-build-simple.yml
└── README.md
```

---

## CLI Reference

### Installation

```bash
curl -sSL https://raw.githubusercontent.com/nammayatri/ny-connectors/main/install.sh | sh
```

Installs `ny-cli` to `~/.local/bin/`. Requires `curl` and `bash`. Install [`jq`](https://jqlang.github.io/jq/) for formatted output.

### Commands

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

### Examples

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

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NY_API_BASE` | `https://api.moving.tech/app/pilot/v2` | API base URL |

### Token Storage

The CLI stores authentication tokens at `~/.namma-yatri/token.json`. This file is created with `600` permissions (owner-only read/write).

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

## Docker (MCP)

```bash
docker build -t ny-mcp ./mcp
docker run -p 3000:3000 ny-mcp
```

The CI pipeline builds and pushes the MCP image to `ghcr.io/nammayatri/ny-mcp` on pushes to `main` and version tags.

---

## Example Flow

```
1. Authenticate:    ny-cli auth
2. Search place:    ny-cli places "Koramangala"
3. Get details:     ny-cli place-details --place-id "ChIJ..."
4. Search rides:    ny-cli search --from-lat 12.93 --from-lon 77.62 --to-lat 12.97 --to-lon 77.59
5. Book a ride:     ny-cli select --estimate-id "abc-123"
6. Check status:    ny-cli status
7. Cancel if needed: ny-cli cancel --estimate-id "abc-123"
```

## License

ISC
