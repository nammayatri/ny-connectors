# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ny-connectors is a multi-interface toolkit for booking rides via Namma Yatri APIs. It provides multiple ways to interact with the platform:

1. **CLI TUI** (`ny-cli-tui/`) — Interactive Node.js terminal UI with fuzzy search and ride booking
2. **MCP Server** (`mcp/`) — TypeScript MCP server exposing 9 tools for AI assistants
3. **Legacy CLI** (`cli/`) — Bash CLI tool (`ny-cli-legacy`) for systems without Node.js
4. **Skill** (`skill.md`) — Curl-based skill file for LLM tools that don't support MCP (e.g., openClaw)

## Repository Structure

```
ny-connectors/
├── common/                     # Shared API client and types
│   ├── src/
│   │   ├── index.ts            # Main exports
│   │   ├── api/index.ts        # NammaYatriClient class
│   │   └── types/index.ts      # TypeScript interfaces
│   └── package.json
├── ny-cli-tui/                 # Interactive CLI TUI (Node.js + Ink)
│   ├── src/
│   │   ├── cli.ts              # CLI entry point (commander)
│   │   ├── app/                # Main application flow
│   │   ├── auth/               # Authentication flow
│   │   ├── locations/          # Location search (fuzzy)
│   │   ├── rides/              # Ride booking flow
│   │   ├── ui/                 # Reusable UI components
│   │   ├── theme.ts            # Design system constants
│   │   ├── session.ts          # Session management
│   │   └── config.ts           # Configuration
│   └── package.json
├── mcp/                        # MCP server (TypeScript)
│   ├── src/index.ts            # All server code (~2000 lines)
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── cli/
│   └── ny-cli.sh               # Legacy bash CLI
├── skill.md                    # LLM skill file (curl-based)
├── install.sh                  # Legacy CLI installer
├── .github/workflows/          # CI/CD
└── README.md
```

## Build & Run Commands

### Common Package (shared API client)

```bash
cd common
npm install
npm run build      # Outputs to common/dist/
```

### CLI TUI

```bash
cd ny-cli-tui
npm install
npm run build      # Outputs to ny-cli-tui/dist/
npm run dev        # Run with tsx (development)
npm start          # Run compiled version
npm link           # Install globally as 'ny-cli'
```

### MCP Server

```bash
cd mcp
npm install
npm run build      # Outputs to mcp/dist/
npm run dev        # Run with tsx (development)
npm start          # Run compiled version
npm run watch      # Continuous TypeScript compilation
```

## Architecture

### Shared API Client (`common/`)

The `common/` package contains a shared `NammaYatriClient` class used by both the MCP server and CLI TUI. This ensures consistent API behavior and reduces code duplication.

**Key exports:**
- `NammaYatriClient` — Main API client class
- `createProductionClient()` — Factory for production API
- `createSandboxClient()` — Factory for sandbox API
- Type definitions for all API requests/responses

### CLI TUI (`ny-cli-tui/`)

Built with:
- **Ink** — React for interactive CLI apps
- **Commander** — CLI argument parsing
- **Fuse.js** — Fuzzy search for locations
- **@inquirer/prompts** — Additional prompts

**Design system (`theme.ts`):**
- Color palette with primary teal accent
- Consistent spacing scale (4px base)
- Typography and text styles
- Component style presets
- Unicode icons for cross-platform compatibility

**Session management (`session.ts`):**
- Recent locations cache
- User preferences (default country, preferred vehicles, tip percent)
- Persisted to `~/.namma-yatri-mcp/session.json`

### MCP Server (`mcp/`)

All MCP code lives in `mcp/src/index.ts`. Organized into:

1. **Configuration** (top) — API base URL, polling intervals, HTTP server config, token storage paths (`~/.namma-yatri-mcp/`)
2. **Type definitions** — TypeScript interfaces for all API request/response shapes
3. **`NammaYatriMCPServer` class** — The core server with session management, tool handlers, and API helpers
4. **HTTP server** (bottom) — Raw HTTP with SSE transport (`/sse`, `/message`, `/health`), keep-alive heartbeats (25s), CORS, graceful shutdown

## Key Design Patterns

- **Shared API client**: Both MCP and CLI TUI use `NammaYatriClient` from `common/`
- **Token obfuscation (MCP)**: Real API tokens are stored server-side in a session map. Only obfuscated tokens are returned to the LLM client.
- **Automatic polling**: `search_ride` and `select_estimate` poll at 2-second intervals (10s max for estimates, 30s max for driver assignment).
- **Generic API wrapper**: All API calls go through `makeApiCall<T>()` with auth headers, error handling, and typing.
- **Dual transport (MCP)**: Supports both stdio (Claude Desktop) and HTTP/SSE transport modes.
- **Saved locations with smart caching**: Cached in `~/.namma-yatri-mcp/user-token.json` with silent 24-hour refresh.
- **Fuzzy search (CLI TUI)**: Uses Fuse.js for searching saved locations and places with weighted scoring.

## API Target

- **MCP server**: `https://api.sandbox.moving.tech/dev/app/v2` (configurable via `NAMMA_YATRI_API_BASE`)
- **CLI TUI**: `https://api.moving.tech/pilot/app/v2` (configurable via `NY_API_BASE`)
- **Legacy CLI**: `https://api.moving.tech/pilot/app/v2` (configurable via `NY_API_BASE`)

## Token Storage

All interfaces store tokens at `~/.namma-yatri-mcp/user-token.json`:

```json
{
  "token": "...",
  "savedAt": "2024-01-15T10:30:00Z",
  "savedLocations": [...],
  "savedLocationsUpdatedAt": "2024-01-15T10:30:00Z"
}
```

CLI TUI also stores session data at `~/.namma-yatri-mcp/session.json`:

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

## Deployment

- **Docker (MCP)**: Multi-stage build (`node:20-alpine`), Dockerfile in `mcp/`, image name `nammayatri/ny-mcp`
- **CI**: GitHub Actions builds from `./mcp` context, pushes to GHCR
- **Legacy CLI install**: `curl -sSL https://raw.githubusercontent.com/nammayatri/ny-connectors/main/install.sh | sh`

## Development Workflow

1. Make changes to `common/` first if API client changes are needed
2. Build `common/` before building dependent packages
3. Test CLI TUI with `npm run dev` in `ny-cli-tui/`
4. Test MCP server with `npm run dev` in `mcp/`

No automated tests are currently configured. Use type checking (`npm run typecheck`) to catch errors.