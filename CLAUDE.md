# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ny-mcp is a TypeScript MCP (Model Context Protocol) server for booking rides via Namma Yatri APIs. It exposes 9 tools (get_token, get_places, get_place_details, search_ride, add_tip, select_estimate, cancel_search, fetch_status, get_saved_locations) that allow AI assistants to interact with the Namma Yatri ride-booking platform.

## Build & Run Commands

- **Build**: `npm run build` (runs `tsc`, outputs to `dist/`)
- **Dev**: `npm run dev` (runs `tsx src/index.ts` directly)
- **Start**: `npm start` (runs compiled `node dist/index.js`)
- **Watch**: `npm run watch` (continuous TypeScript compilation)

No test or lint commands are configured.

## Architecture

All code lives in a single file: `src/index.ts` (~1900 lines). It is organized into these layers:

1. **Configuration** (top) — API base URL (sandbox by default), polling intervals, HTTP server config, token storage paths (`~/.namma-yatri-mcp/`)
2. **Type definitions** — Comprehensive TypeScript interfaces for all Namma Yatri API request/response shapes; discriminated unions for enums like `AutoCompleteType` and `ServiceTierType`
3. **`NammaYatriMCPServer` class** — The core server:
   - **Session management** via `sessions: Map` and `activeConnections: Map` — maps obfuscated tokens to real tokens in memory so real tokens are never exposed to the LLM
   - **MCP request handlers** — `ListToolsRequestSchema` returns tool definitions; `CallToolRequestSchema` routes to individual tool handlers
   - **Tool handlers** — Each of the 8 tools has a dedicated handler method (e.g., `handleSearchRide()`, `handleSelectEstimate()`)
   - **Helpers** — `makeApiCall<T>()` generic API client with auth headers, `pollSearchResults()` / `pollForRideAssignment()` for automatic polling, coordinate parsing utilities
4. **HTTP server** (bottom) — Express-less raw HTTP with SSE transport (`/sse`, `/message`, `/health`), keep-alive heartbeats (25s), CORS, graceful shutdown

## Key Design Patterns

- **Token obfuscation**: Real API tokens are stored server-side in a session map. Only obfuscated tokens are returned to the LLM client. See `obfuscateToken()` / `deobfuscateTokenSimple()` / `createSession()` / `ensureAuthenticated()`.
- **Automatic polling**: `search_ride` and `select_estimate` poll the Namma Yatri API at 2-second intervals (10s max for estimates, 30s max for driver assignment) rather than requiring the client to poll.
- **Generic API wrapper**: All Namma Yatri API calls go through `makeApiCall<T>()` which handles auth headers, error responses, and typing.
- **Dual transport**: Supports both stdio (default, for Claude Desktop) and HTTP/SSE transport modes.
- **Saved locations with smart caching**: On authentication, `handleGetToken` fetches saved locations from `/savedLocation/list` and bundles them into the token file (`~/.namma-yatri-mcp/user-token.json`) alongside a `savedLocationsUpdatedAt` timestamp. The LLM is instructed to: (1) use cached saved locations to skip place lookups when origin/destination matches a tag, (2) silently refresh via `get_saved_locations` if the cache is older than 24 hours, (3) silently refresh if a user mentions a personal-sounding location (home, work, etc.) not in the cache — before falling back to `get_places`.

## API Target

All API calls go to `https://api.sandbox.moving.tech/dev/app/v2`. Key endpoints: `/auth/get-token`, `/maps/autoComplete`, `/maps/getPlaceName`, `/rideSearch`, `/rideSearch/{id}/results`, `/estimate/{id}/select2`, `/estimate/{id}/cancelSearch`, `/rideBooking/list`, `/savedLocation/list`.

## Deployment

- **Docker**: Multi-stage build (`node:20-alpine`), builds for `linux/amd64` and `linux/arm64`, runs as non-root user, exposes port 3000
- **CI**: GitHub Actions workflow (`.github/workflows/docker-build-simple.yml`) builds and pushes to GHCR on pushes to main and version tags
- **Environment variables**: `PORT` (default 3000), `HOST` (default 0.0.0.0), `NODE_EXTRA_CA_CERTS` (set in Docker for custom CA)
