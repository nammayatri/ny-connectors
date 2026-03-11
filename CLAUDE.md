# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ny-connectors is a multi-interface toolkit for booking rides via Namma Yatri APIs. It provides three ways to interact with the platform:

1. **MCP Server** (`mcp/`) — TypeScript MCP server exposing 9 tools for AI assistants
2. **CLI** (`cli/`) — Bash CLI tool (`ny-cli`) for terminal-based ride booking
3. **Skill** (`skill.md`) — Curl-based skill file for LLM tools that don't support MCP (e.g., openClaw)

## Repository Structure

```
ny-connectors/
├── mcp/                    # MCP server (TypeScript)
│   ├── src/index.ts        # All server code (~2000 lines)
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── cli/
│   └── ny-cli.sh           # Bash CLI tool
├── skill.md                # LLM skill file (curl-based)
├── install.sh              # CLI installer (curl | sh)
├── .github/workflows/      # CI/CD
└── README.md
```

## Build & Run Commands (MCP)

All commands run from the `mcp/` directory:

- **Build**: `cd mcp && npm run build` (runs `tsc`, outputs to `mcp/dist/`)
- **Dev**: `cd mcp && npm run dev` (runs `tsx src/index.ts` directly)
- **Start**: `cd mcp && npm start` (runs compiled `node dist/index.js`)
- **Watch**: `cd mcp && npm run watch` (continuous TypeScript compilation)

## CLI

Install: `curl -sSL https://raw.githubusercontent.com/nammayatri/ny-connectors/main/install.sh | sh`

Run: `ny-cli help` for all subcommands.

No test or lint commands are configured.

## Architecture (MCP)

All MCP code lives in `mcp/src/index.ts`. Organized into:

1. **Configuration** (top) — API base URL, polling intervals, HTTP server config, token storage paths (`~/.namma-yatri-mcp/`)
2. **Type definitions** — TypeScript interfaces for all API request/response shapes
3. **`NammaYatriMCPServer` class** — The core server with session management, tool handlers, and API helpers
4. **HTTP server** (bottom) — Raw HTTP with SSE transport (`/sse`, `/message`, `/health`), keep-alive heartbeats (25s), CORS, graceful shutdown

## Key Design Patterns

- **Token obfuscation**: Real API tokens are stored server-side in a session map. Only obfuscated tokens are returned to the LLM client.
- **Automatic polling**: `search_ride` and `select_estimate` poll at 2-second intervals (10s max for estimates, 30s max for driver assignment).
- **Generic API wrapper**: All API calls go through `makeApiCall<T>()` with auth headers, error handling, and typing.
- **Dual transport**: Supports both stdio (Claude Desktop) and HTTP/SSE transport modes.
- **Saved locations with smart caching**: Cached in `~/.namma-yatri-mcp/user-token.json` with silent 24-hour refresh.

## API Target

MCP server: `https://api.sandbox.moving.tech/dev/app/v2` (configurable via `NAMMA_YATRI_API_BASE` env var)
CLI/Skill: `https://api.moving.tech/app/pilot/v2` (configurable via `NY_API_BASE` env var)

## Deployment

- **Docker (MCP)**: Multi-stage build (`node:20-alpine`), Dockerfile in `mcp/`, image name `nammayatri/ny-mcp`
- **CI**: GitHub Actions builds from `./mcp` context, pushes to GHCR
- **CLI install**: `curl -sSL https://raw.githubusercontent.com/nammayatri/ny-connectors/main/install.sh | sh`
