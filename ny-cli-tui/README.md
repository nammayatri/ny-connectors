# ny-cli-tui

Interactive terminal UI for booking Namma Yatri rides with fuzzy search and an elegant interface.

## Features

- **Interactive Ride Booking** — Full booking flow from authentication to ride confirmation
- **Fuzzy Location Search** — Search saved locations (Home, Work) and places with fuzzy matching
- **Estimate Selection** — Browse and select ride estimates with keyboard navigation
- **Saved Locations** — Quick access to Home, Work, and other saved places
- **Session Persistence** — Remembers recent locations and preferences
- **Ride Status Tracking** — Monitor active and recent rides
- **Token Management** — Secure token storage with logout support

## Installation

```bash
# From npm (when published)
npm install -g ny-cli-tui

# From source
git clone https://github.com/nammayatri/ny-connectors.git
cd ny-connectors/ny-cli-tui
npm install
npm run build
npm link
```

**Requirements**: Node.js 18+

## Usage

### Quick Start

```bash
# Start interactive ride booking
ny-cli

# Or explicitly
ny-cli book
```

### Authentication

```bash
# Interactive authentication
ny-cli auth

# Non-interactive
ny-cli auth --mobile 9876543210 --code YOUR_ACCESS_CODE
```

You can find your access code in the Namma Yatri app under **About Us**.

### Ride Booking

```bash
# Start booking with pre-filled locations
ny-cli book --from "home" --to "Koramangala"

# Just start booking
ny-cli
```

### Check Status

```bash
# Active rides
ny-cli status

# All rides including completed
ny-cli status --all
```

### Manage Locations

```bash
ny-cli locations
```

### Logout

```bash
ny-cli logout
```

## Commands

| Command | Description |
|---------|-------------|
| `ny-cli` | Start interactive ride booking (default) |
| `ny-cli book` | Same as above (explicit) |
| `ny-cli auth` | Authenticate with Namma Yatri |
| `ny-cli status` | Check active and recent rides |
| `ny-cli locations` | Manage saved locations |
| `ny-cli logout` | Clear stored token and session data |
| `ny-cli token-info` | Show token storage information |
| `ny-cli session-info` | Show session status and preferences |

## Keyboard Shortcuts

### Location Search
| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate results |
| `Enter` | Select location |
| `Esc` / `q` | Go back / Cancel |
| Type | Fuzzy search through saved locations and places |

### Estimate Selection
| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate estimates |
| `Enter` | Select and book ride |
| `Esc` / `q` | Cancel search |

### Authentication (OTP Input)
| Key | Action |
|-----|--------|
| `0-9` | Enter OTP digits |
| `Backspace` | Delete last digit |
| `Enter` | Submit (when complete) |
| `Esc` | Cancel |

## Options

### `ny-cli book`
```
--from <location>    Pre-fill origin (address or saved location name)
--to <location>      Pre-fill destination
```

### `ny-cli auth`
```
--mobile <number>    Mobile number (skip prompt)
--code <code>        Access code from Namma Yatri app > About Us
--country <code>     Country code (default: IN)
```

### `ny-cli status`
```
--all                Show all rides including completed
--limit <number>     Maximum rides to display (default: 10)
```

### `ny-cli session-info`
```
--json               Output as JSON
```

## Data Storage

### Token
Stored at `~/.namma-yatri-mcp/user-token.json`:
```json
{
  "token": "...",
  "savedAt": "2024-01-15T10:30:00Z",
  "savedLocations": [...],
  "savedLocationsUpdatedAt": "2024-01-15T10:30:00Z"
}
```

### Session
Stored at `~/.namma-yatri-mcp/session.json`:
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

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Type check
npm run typecheck

# Run compiled version
npm start
```

## Architecture

```
ny-cli-tui/
├── src/
│   ├── cli.ts              # CLI entry point (commander)
│   ├── config.ts           # Configuration constants
│   ├── theme.ts            # Design system (colors, spacing, icons)
│   ├── session.ts          # Session management
│   ├── app/
│   │   └── index.ts        # Main application flow
│   ├── auth/
│   │   ├── flow.ts         # Authentication flow
│   │   └── token-store.ts  # Token persistence
│   ├── locations/
│   │   ├── flow.ts         # Location management flow
│   │   └── search.ts       # Fuzzy search logic
│   ├── rides/
│   │   └── status-flow.ts  # Ride status display
│   └── ui/
│       └── components/     # Reusable Ink components
│           ├── estimate-list.tsx
│           ├── location-search.tsx
│           ├── otp-input.tsx
│           ├── phone-input.tsx
│           ├── ride-status.tsx
│           └── ...
└── package.json
```

## Dependencies

- **ink** — React for interactive CLI apps
- **commander** — CLI argument parsing
- **fuse.js** — Fuzzy search
- **@inquirer/prompts** — Additional prompts
- **ink-spinner** — Loading spinners
- **ink-text-input** — Text input component

## Related

- **ny-cli-legacy** — Bash CLI for systems without Node.js
- **mcp** — MCP server for AI assistants
- **common** — Shared API client

## License

ISC