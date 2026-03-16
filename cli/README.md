# Namma Yatri CLI TUI

An interactive Terminal User Interface (TUI) for booking rides with Namma Yatri, built with [Ink](https://github.com/vadimdemedes/ink) and React.

## Features

- 🎨 **Beautiful TUI**: Interactive terminal interface with real-time updates
- 🔐 **Secure Auth**: Phone + Access Code authentication with token persistence
- 📍 **Smart Locations**: Saved locations (Home, Work, etc.) + place search
- 🚗 **Ride Selection**: Browse fare estimates with vehicle variants
- ✅ **Live Tracking**: Real-time driver assignment and ride status
- ⌨️ **Keyboard Driven**: Full keyboard navigation, no mouse needed

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Link for global usage
npm link
```

## Usage

```bash
# Start the TUI
ny
# or
ny-tui

# Or run directly
npm start
```

## Wizard Flow

The TUI follows a simple 5-step wizard:

1. **Auth** → Enter mobile number and access code
2. **Location** → Select origin and destination (saved locations or search)
3. **Ride Type** → Choose from available ride estimates
4. **Confirm** → Wait for driver assignment
5. **Track** → Live ride tracking with status updates

## Keyboard Shortcuts

### Global
- `Ctrl+C` - Exit application
- `Ctrl+L` - Logout
- `Ctrl+R` - Refresh saved locations

### Navigation
- `↑/↓` - Navigate lists
- `Tab` - Switch between modes
- `Enter` - Confirm selection
- `Esc` - Go back

### Tracking Screen
- `R` - Refresh ride status
- `C` - Cancel ride
- `N` - New ride
- `Q` / `Esc` - Exit

## Configuration

Environment variables:

```bash
# API endpoint (optional)
export NY_API_BASE=https://api.moving.tech/pilot/app/v2
```

Token storage: `~/.namma-yatri/token.json`

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build TypeScript
npm run build

# Watch mode
npm run watch
```

## Project Structure

```
cli/
├── src/
│   ├── components/     # React components for each screen
│   │   ├── AuthScreen.tsx
│   │   ├── LocationScreen.tsx
│   │   ├── RideTypeScreen.tsx
│   │   ├── ConfirmScreen.tsx
│   │   ├── TrackScreen.tsx
│   │   └── ...
│   ├── hooks/          # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useRide.ts
│   │   └── usePlaces.ts
│   ├── api/            # API client
│   │   └── client.ts
│   ├── types.ts        # TypeScript types
│   ├── storage.ts      # Token persistence
│   ├── app.tsx         # Main app component
│   └── index.tsx       # Entry point
├── package.json
├── tsconfig.json
└── README.md
```

## Fallback to Bash CLI

The original Bash CLI (`nycli.sh`) is still available for scripting and lightweight usage:

```bash
# Bash CLI commands
./cli/nycli.sh auth --mobile 9876543210 --code YOUR_CODE
./cli/nycli.sh places "Koramangala"
./cli/nycli.sh search --from-lat 12.935 --from-lon 77.624 --to-lat 12.971 --to-lon 77.594
```

## Requirements

- Node.js 18+
- Terminal with Unicode support

## License

ISC
