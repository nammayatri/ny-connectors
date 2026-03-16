# ny-cli

**Terminal UI for booking rides via Namma Yatri**

A modern TypeScript CLI with an interactive Ink-based TUI wizard for booking rides. Features phone + access code authentication, location search with autocomplete, favorite locations, ride variant selection, booking confirmation, and live status tracking.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage Modes](#usage-modes)
  - [TUI Mode (Interactive)](#tui-mode-interactive)
  - [CLI Mode (Scripting)](#cli-mode-scripting)
- [TUI Reference](#tui-reference)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
  - [Booking Wizard Flow](#booking-wizard-flow)
- [CLI Commands Reference](#cli-commands-reference)
- [Favorites Management](#favorites-management)
- [Comparison: TUI vs CLI vs Bash](#comparison-tui-vs-cli-vs-bash)
- [Configuration](#configuration)
- [Examples](#examples)
- [Development](#development)

---

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn

### Install from Source

```bash
cd cli
npm install
npm run build
npm link  # Makes `ny-cli` available globally
```

### Run Directly

```bash
# Development mode
npm run dev

# Or after build
npm start
```

---

## Quick Start

```bash
# Launch the interactive TUI (default)
ny-cli

# Authenticate with your Namma Yatri account
ny-cli login --mobile 9876543210 --code YOUR_ACCESS_CODE

# Book a ride interactively
ny-cli tui

# Check ride status
ny-cli status
```

> **Finding your access code:** Open the Namma Yatri mobile app, go to **About Us**, and copy your access code.

---

## Usage Modes

ny-cli supports two modes of operation:

### TUI Mode (Interactive)

The default mode launches a beautiful terminal UI wizard:

```bash
ny-cli          # Launch TUI (default)
ny-cli tui      # Explicit TUI command
```

**Features:**
- 🎨 Full-screen interactive wizard
- 🔐 Phone + access code authentication
- 🔍 Location search with autocomplete
- ⭐ Quick access to saved locations (Home, Work, etc.)
- 💛 User-defined favorites
- 🚗 Ride variant selection with fare comparison
- 💰 Tip options for faster pickup
- 📊 Live ride status tracking
- 🎯 Keyboard-driven navigation

### CLI Mode (Scripting)

For automation, scripting, and CI/CD integration:

```bash
ny-cli login --mobile 9876543210 --code YOUR_CODE
ny-cli search-place "Koramangala"
ny-cli search-rides --from-lat 12.935 --from-lon 77.624 --to-lat 12.971 --to-lon 77.594
ny-cli select-estimate --estimate-id "abc-123"
ny-cli status --active
```

**Features:**
- 🤖 Scriptable commands
- 📋 JSON output support
- 🔧 Programmatic access
- 📝 Logging and automation friendly

---

## TUI Reference

### Keyboard Shortcuts

#### Global Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+C` | Exit application |
| `Esc` | Go back / Cancel |

#### Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate through lists |
| `Enter` | Select / Confirm |
| `Esc` | Go back / Cancel |

#### Location Search

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate results |
| `Enter` | Select location |
| `s` | Save selected location to favorites |
| `Esc` | Go back |

#### Ride Selection

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate ride variants |
| `Enter` | Select variant |
| `Esc` | Cancel search |

#### Booking Confirmation

| Key | Action |
|-----|--------|
| `Enter` | Confirm booking |
| `t` | Add tip |
| `Esc` | Go back to variant selection |

#### Error States

| Key | Action |
|-----|--------|
| `r` | Retry |
| `b` | Go back |

### Booking Wizard Flow

The TUI wizard guides you through 5 steps:

```
┌─────────────────────────────────────────┐
│  Step 1: Pickup Location                │
│  ├── Search by name/address             │
│  ├── Select from saved locations        │
│  └── Select from user favorites         │
├─────────────────────────────────────────┤
│  Step 2: Drop Location                  │
│  ├── Search by name/address             │
│  ├── Select from saved locations        │
│  └── Select from user favorites         │
├─────────────────────────────────────────┤
│  Step 3: Select Ride Variant            │
│  ├── Compare fares                      │
│  ├── View pickup ETA                    │
│  └── See vehicle details                │
├─────────────────────────────────────────┤
│  Step 4: Confirm Booking                │
│  ├── Review route & fare                │
│  ├── Add optional tip                   │
│  └── Confirm or cancel                  │
├─────────────────────────────────────────┤
│  Step 5: Booking Complete               │
│  ├── View driver details                │
│  ├── Get OTP for ride                   │
│  └── Return to main menu                │
└─────────────────────────────────────────┘
```

---

## CLI Commands Reference

### Authentication

```bash
# Login with mobile and access code
ny-cli login --mobile 9876543210 --code YOUR_CODE
ny-cli auth --mobile 9876543210 --code YOUR_CODE  # alias

# Check current authentication
ny-cli whoami

# Logout (clear stored token)
ny-cli logout
```

### Places

```bash
# Search for places
ny-cli search-place "Koramangala"
ny-cli places "MG Road Bangalore"  # alias

# Get place details by ID
ny-cli place-details --place-id "ChIJx9..."

# Get place details by coordinates
ny-cli place-details --lat 12.935 --lon 77.624
```

### Ride Search & Booking

```bash
# Search for rides between coordinates
ny-cli search-rides \
  --from-lat 12.935 --from-lon 77.624 \
  --to-lat 12.971 --to-lon 77.594
ny-cli search ...  # alias

# Select an estimate to book
ny-cli select-estimate --estimate-id "abc-123"
ny-cli select --estimate-id "abc-123"  # alias

# Select with multiple estimates (increases chances)
ny-cli select-estimate --estimate-id "abc-123" --also "def-456,ghi-789"

# Pet ride
ny-cli select-estimate --estimate-id "abc-123" --pet

# Special assistance
ny-cli select-estimate --estimate-id "abc-123" --special-assistance

# Add tip to get ride faster
ny-cli add-tip --estimate-id "abc-123" --amount 20
ny-cli tip --estimate-id "abc-123" --amount 50 --currency INR  # alias

# Cancel an active search
ny-cli cancel-search --estimate-id "abc-123"
ny-cli cancel --estimate-id "abc-123"  # alias
```

### Status

```bash
# Check active rides (default)
ny-cli status

# Check all rides (including completed/cancelled)
ny-cli status --all

# Limit results
ny-cli status --active --limit 5
```

### Saved Locations

```bash
# List saved locations from Namma Yatri app
ny-cli saved-locations
ny-cli saved  # alias
```

### Help & Version

```bash
ny-cli help
ny-cli --help
ny-cli -h

ny-cli version
ny-cli --version
ny-cli -v
```

---

## Favorites Management

User-defined favorites are stored locally and can be used for quick location selection.

### Storage Location

```
~/.config/ny-cli/favorites.json
```

### Adding Favorites

**In TUI Mode:**
1. Navigate to location search
2. Use `s` key on any location to save it
3. Enter a name (e.g., "Office", "Gym", "Mom's place")

**Programmatically:**

```javascript
import { favoritesManager } from 'ny-cli/utils';

// Add a favorite
favoritesManager.addFavorite({
  name: 'Office',
  address: 'Tech Park, Outer Ring Road, Bangalore',
  lat: 12.9352,
  lon: 77.6245,
  placeId: 'ChIJx9...'  // optional
});

// List all favorites
const favorites = favoritesManager.listFavorites();

// Search favorites
const results = favoritesManager.searchFavorites('office');

// Remove a favorite
favoritesManager.removeFavorite('fav_1234567890_abc123');
```

### Favorite vs Saved Location

| Type | Source | Storage |
|------|--------|---------|
| **Saved Locations** | Namma Yatri app (Home, Work, etc.) | API + cached locally |
| **User Favorites** | Created in ny-cli | Local file only |

Both appear in the TUI location selector with different icons:
- ⭐ Saved locations (from app)
- 💛 User favorites (local)

---

## Comparison: TUI vs CLI vs Bash

| Feature | TUI Mode | CLI Mode | Bash Script |
|---------|----------|----------|-------------|
| **Interactive** | ✅ Full wizard | ❌ Command-based | ❌ Command-based |
| **Scriptable** | ❌ | ✅ | ✅ |
| **Location Search** | ✅ Autocomplete | ✅ API call | ✅ API call |
| **Favorites** | ✅ Save & use | ✅ Programmatic | ❌ Manual |
| **Visual Feedback** | ✅ Rich UI | ⚠️ Text output | ⚠️ Text output |
| **Error Handling** | ✅ Inline retry | ⚠️ Exit codes | ⚠️ Exit codes |
| **Dependencies** | Node.js | Node.js | bash, curl, jq |
| **Installation Size** | ~10MB | ~10MB | ~5KB |

### When to Use Each

**Use TUI Mode when:**
- Booking rides interactively
- Exploring available options
- First-time users
- Visual preference

**Use CLI Mode when:**
- Automating ride booking
- CI/CD integration
- Scripting workflows
- Quick one-off commands

**Use Bash Script when:**
- Minimal dependencies required
- Embedded systems
- Quick prototyping
- Already have bash environment

---

## Configuration

### Token Storage

Authentication tokens are stored at:

```
~/.namma-yatri/token.json
```

**File contents:**
```json
{
  "token": "obfuscated-token-string",
  "savedAt": "2024-01-15T10:30:00Z",
  "savedLocations": [...],
  "savedLocationsUpdatedAt": "2024-01-15T10:30:00Z"
}
```

### Favorites Storage

User favorites are stored at:

```
~/.config/ny-cli/favorites.json
```

**File contents:**
```json
{
  "version": 1,
  "favorites": [
    {
      "id": "fav_1234567890_abc123",
      "name": "Office",
      "address": "Tech Park, Bangalore",
      "lat": 12.9352,
      "lon": 77.6245,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NY_API_BASE` | API base URL | `https://api.moving.tech/pilot/app/v2` |

---

## Examples

### TUI Mode Examples

**Basic ride booking:**
```bash
ny-cli
# → Select "Book a Ride"
# → Enter pickup location or select from saved
# → Enter drop location
# → Select ride variant
# → Confirm booking
```

**Using saved locations:**
```bash
ny-cli
# → Select "Book a Ride"
# → Select "Home" from saved locations (⭐)
# → Select "Work" from saved locations (⭐)
# → Select variant and confirm
```

**Adding a tip for faster pickup:**
```bash
ny-cli
# → Book ride as usual
# → On confirmation screen, press 't'
# → Select tip amount
# → Confirm booking
```

### CLI Mode Examples

**Complete booking workflow:**
```bash
# 1. Authenticate
ny-cli login --mobile 9876543210 --code secret123

# 2. Search for pickup location
ny-cli search-place "Koramangala 4th Block"
# Output: Place ID: ChIJx9...

# 3. Get coordinates
ny-cli place-details --place-id "ChIJx9..."
# Output: lat: 12.935, lon: 77.624

# 4. Search for drop location
ny-cli search-place "Indiranagar"
ny-cli place-details --place-id "ChIJya..."
# Output: lat: 12.971, lon: 77.594

# 5. Search for rides
ny-cli search-rides \
  --from-lat 12.935 --from-lon 77.624 \
  --to-lat 12.971 --to-lon 77.594
# Output: Estimate IDs with fares

# 6. Select and book
ny-cli select-estimate --estimate-id "estimate-abc-123"

# 7. Check status
ny-cli status
```

**Automated booking script:**
```bash
#!/bin/bash
# book-ride.sh - Automated ride booking

PICKUP_LAT="12.935"
PICKUP_LON="77.624"
DROP_LAT="12.971"
DROP_LON="77.594"

# Search for rides
ESTIMATES=$(ny-cli search-rides \
  --from-lat "$PICKUP_LAT" --from-lon "$PICKUP_LON" \
  --to-lat "$DROP_LAT" --to-lon "$DROP_LON" 2>&1)

# Extract first estimate ID (requires jq)
ESTIMATE_ID=$(echo "$ESTIMATES" | grep "Estimate ID:" | head -1 | cut -d: -f2 | tr -d ' ')

if [ -n "$ESTIMATE_ID" ]; then
  echo "Booking estimate: $ESTIMATE_ID"
  ny-cli select-estimate --estimate-id "$ESTIMATE_ID"
else
  echo "No estimates found"
  exit 1
fi
```

**Check ride status periodically:**
```bash
# Watch mode - check every 30 seconds
watch -n 30 'ny-cli status --active'
```

---

## Development

### Project Structure

```
cli/
├── src/
│   ├── index.ts           # Entry point
│   ├── api/
│   │   ├── client.ts      # API client
│   │   ├── token.ts       # Token management
│   │   └── types.ts       # TypeScript types
│   ├── cli/
│   │   ├── args.ts        # Argument parser
│   │   └── commands.ts    # CLI command handlers
│   ├── tui/
│   │   ├── app.tsx        # TUI entry point
│   │   ├── components/    # React/Ink components
│   │   │   ├── App.tsx
│   │   │   ├── AuthScreen.tsx
│   │   │   ├── BookingWizard.tsx
│   │   │   ├── ConfirmStep.tsx
│   │   │   ├── LocationStep.tsx
│   │   │   ├── MainScreen.tsx
│   │   │   ├── SavedLocationsScreen.tsx
│   │   │   ├── StatusScreen.tsx
│   │   │   └── VariantStep.tsx
│   │   └── states.ts      # State management
│   └── utils/
│       ├── favorites.ts   # Favorites manager
│       └── format.ts      # Formatting utilities
├── package.json
├── tsconfig.json
└── README.md
```

### Scripts

```bash
# Development
npm run dev          # Run with tsx (no build)
npm run watch        # TypeScript watch mode

# Build
npm run build        # Compile TypeScript
npm run clean        # Remove dist/

# Quality
npm run typecheck    # Type check without emit
```

### Dependencies

**Runtime:**
- `ink` - React for interactive CLI apps
- `react` - UI framework
- `chalk` - Terminal colors
- `ink-text-input` - Text input component
- `ink-select-input` - Selection component
- `ink-spinner` - Loading spinner
- `ink-gradient` - Gradient text
- `ink-big-text` - Large ASCII text

**Development:**
- `typescript` - TypeScript compiler
- `tsx` - TypeScript execution
- `@types/*` - Type definitions

---

## License

ISC

---

## Related

- [Namma Yatri](https://nammayatri.in/) - Open-source ride-hailing platform
- [ny-cli.sh](./ny-cli.sh) - Original Bash implementation (lightweight fallback)
- [Ink](https://github.com/vadimdemedes/ink) - React for interactive CLI apps