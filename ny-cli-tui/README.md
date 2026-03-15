# ny-cli-tui

Interactive Terminal User Interface for Namma Yatri CLI built with [Ink](https://github.com/vadimdemedes/ink) (React for CLI).

## Features

- 🎨 **Interactive Menus** - Navigate with arrow keys, fuzzy search with `/`
- 🔍 **Location Autocomplete** - Search for places with real-time suggestions
- 📍 **Saved Locations** - Quick access to Home, Work, and other saved places
- 🚕 **Ride Search & Booking** - Search for rides and select estimates
- 📋 **Status Tracking** - View active and past rides
- 💾 **Token Persistence** - Secure token storage in `~/.namma-yatri/token.json`
- ❌ **Cancellation Support** - Cancel active searches

## Installation

```bash
# From the repo root
cd ny-cli-tui
npm install
npm run build

# Link globally (optional)
npm link
```

## Usage

```bash
# Start the interactive TUI
ny-cli

# Or run directly
node dist/index.js
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑/↓` | Navigate menu |
| `Enter` | Select option |
| `/` | Filter menu (fuzzy search) |
| `ESC` | Go back / Cancel |
| `q` | Quit (from main menu) |
| `r` | Refresh (in status/saved locations) |
| `a` | Toggle all/active rides (in status) |
| `Ctrl+C` | Force exit |

## Project Structure

```
ny-cli-tui/
├── src/
│   ├── index.ts          # Entry point
│   ├── app.tsx           # Main app component
│   ├── api/
│   │   └── client.ts     # Namma Yatri API client
│   ├── components/
│   │   └── main-menu.tsx # Main menu component
│   ├── screens/
│   │   ├── auth-screen.tsx
│   │   ├── search-screen.tsx
│   │   ├── status-screen.tsx
│   │   └── saved-locations-screen.tsx
│   └── store/
│       └── token-store.ts # Token persistence
├── package.json
├── tsconfig.json
└── README.md
```

## Legacy CLI

The original bash CLI is available as `ny-cli-legacy`:

```bash
ny-cli-legacy --help
```

## Development

```bash
# Development mode with hot reload
npm run dev

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## Dependencies

- **ink** - React for interactive CLI apps
- **ink-text-input** - Text input component
- **ink-select-input** - Select/autocomplete component
- **ink-spinner** - Loading spinner
- **react** - UI framework
- **fuzzy-search** - Fuzzy filtering for saved locations
- **axios** - HTTP client
- **chalk** - Terminal colors
- **conf** - Configuration storage

## License

ISC