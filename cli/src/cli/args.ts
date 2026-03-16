/**
 * CLI Argument Parser
 * Parses command-line arguments for ny-cli
 */

// Command definitions
export type Command =
  | 'tui'
  | 'login'
  | 'logout'
  | 'whoami'
  | 'search-place'
  | 'place-details'
  | 'search-rides'
  | 'select-estimate'
  | 'add-tip'
  | 'cancel-search'
  | 'status'
  | 'saved-locations'
  | 'help'
  | 'version';

export interface ParsedArgs {
  command: Command;
  showHelp: boolean;
  showVersion: boolean;
  options: Record<string, unknown>;
  positional: string[];
}

// All valid commands
const COMMANDS: Command[] = [
  'tui',
  'login',
  'logout',
  'whoami',
  'search-place',
  'place-details',
  'search-rides',
  'select-estimate',
  'add-tip',
  'cancel-search',
  'status',
  'saved-locations',
  'help',
  'version',
];

// Command aliases
const ALIASES: Record<string, Command> = {
  'auth': 'login',
  'authenticate': 'login',
  'places': 'search-place',
  'search': 'search-rides',
  'select': 'select-estimate',
  'tip': 'add-tip',
  'cancel': 'cancel-search',
  'saved': 'saved-locations',
  'book': 'tui',
  '--help': 'help',
  '-h': 'help',
  '--version': 'version',
  '-v': 'version',
};

/**
 * Parse command-line arguments
 */
export function parseArgs(argv: string[] = process.argv.slice(2)): ParsedArgs {
  const result: ParsedArgs = {
    command: 'tui', // Default to TUI
    showHelp: false,
    showVersion: false,
    options: {},
    positional: [],
  };

  // Handle empty args - default to TUI
  if (argv.length === 0) {
    return result;
  }

  // Check for global flags first
  if (argv[0] === '--help' || argv[0] === '-h') {
    return { ...result, command: 'help', showHelp: true };
  }

  if (argv[0] === '--version' || argv[0] === '-v') {
    return { ...result, command: 'version', showVersion: true };
  }

  // Parse command
  const firstArg = argv[0];

  // Check if it's a known command or alias
  if (COMMANDS.includes(firstArg as Command)) {
    result.command = firstArg as Command;
    argv = argv.slice(1);
  } else if (ALIASES[firstArg]) {
    result.command = ALIASES[firstArg];
    argv = argv.slice(1);
  } else if (firstArg.startsWith('-')) {
    // Unknown flag - show help
    result.options['unknownFlag'] = firstArg;
    return result;
  } else {
    // Unknown command - treat as positional for error handling
    result.positional.push(firstArg);
    argv = argv.slice(1);
  }

  // Parse remaining arguments
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      // Long option
      const key = arg.slice(2);
      const nextArg = argv[i + 1];

      // Handle --flag (boolean) vs --flag value
      if (nextArg && !nextArg.startsWith('-')) {
        // Check if it's a number
        const numValue = Number(nextArg);
        if (!isNaN(numValue) && nextArg !== '') {
          result.options[key] = numValue;
        } else if (nextArg.toLowerCase() === 'true') {
          result.options[key] = true;
        } else if (nextArg.toLowerCase() === 'false') {
          result.options[key] = false;
        } else {
          result.options[key] = nextArg;
        }
        i += 2;
      } else {
        result.options[key] = true;
        i += 1;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      // Short option
      const key = arg.slice(1);
      const nextArg = argv[i + 1];

      if (nextArg && !nextArg.startsWith('-')) {
        const numValue = Number(nextArg);
        if (!isNaN(numValue) && nextArg !== '') {
          result.options[key] = numValue;
        } else {
          result.options[key] = nextArg;
        }
        i += 2;
      } else {
        result.options[key] = true;
        i += 1;
      }
    } else {
      // Positional argument
      result.positional.push(arg);
      i += 1;
    }
  }

  return result;
}

/**
 * Get help text for a specific command
 */
export function getCommandHelp(command: Command): string {
  const helps: Record<Command, string> = {
    tui: `
ny-cli tui

Launch the interactive Terminal UI wizard for booking rides.

USAGE
    ny-cli tui
    ny-cli              (default when no command specified)

The TUI provides:
  • Phone + OTP authentication
  • Location search with autocomplete
  • Favorite/saved locations
  • Ride variant selection
  • Booking confirmation
  • Live status tracking
`,
    login: `
ny-cli login — Authenticate with Namma Yatri

USAGE
    ny-cli login --mobile <number> --code <code>
    ny-cli auth --mobile <number> --code <code>

OPTIONS
    --mobile     Mobile number (10 digits, without country code)
    --code       Access code from Namma Yatri app (About Us section)
    --country    Country code (default: IN)

EXAMPLES
    ny-cli login --mobile 9876543210 --code your-secret-code

The access code can be found in the Namma Yatri app under About Us.
`,
    logout: `
ny-cli logout — Clear stored authentication

USAGE
    ny-cli logout

Removes the stored token from ~/.namma-yatri/token.json
`,
    whoami: `
ny-cli whoami — Show current authentication status

USAGE
    ny-cli whoami

Displays information about the currently authenticated user.
`,
    'search-place': `
ny-cli search-place — Search for places using autocomplete

USAGE
    ny-cli search-place <search text>
    ny-cli places <search text>

EXAMPLES
    ny-cli search-place "Koramangala"
    ny-cli places "MG Road Bangalore"

Returns a list of matching places with their IDs and distances.
`,
    'place-details': `
ny-cli place-details — Get coordinates and address for a place

USAGE
    ny-cli place-details --place-id <id>
    ny-cli place-details --lat <lat> --lon <lon>

OPTIONS
    --place-id   Place ID from search-place results
    --lat        Latitude coordinate
    --lon        Longitude coordinate

EXAMPLES
    ny-cli place-details --place-id "ChIJx9..."
    ny-cli place-details --lat 12.935 --lon 77.624
`,
    'search-rides': `
ny-cli search-rides — Search for available rides

USAGE
    ny-cli search-rides --from-lat <lat> --from-lon <lon> --to-lat <lat> --to-lon <lon>
    ny-cli search --from-lat <lat> --from-lon <lon> --to-lat <lat> --to-lon <lon>

OPTIONS
    --from-lat   Pickup latitude
    --from-lon   Pickup longitude
    --to-lat     Drop latitude
    --to-lon     Drop longitude

EXAMPLES
    ny-cli search-rides --from-lat 12.935 --from-lon 77.624 --to-lat 12.971 --to-lon 77.594

Returns available ride estimates with fares and pickup times.
`,
    'select-estimate': `
ny-cli select-estimate — Select an estimate to book a ride

USAGE
    ny-cli select-estimate --estimate-id <id> [options]
    ny-cli select --estimate-id <id> [options]

OPTIONS
    --estimate-id         Estimate ID to select (required)
    --also <ids>          Additional estimate IDs (comma-separated)
    --pet                 Mark as pet ride
    --special-assistance  Request special assistance

EXAMPLES
    ny-cli select-estimate --estimate-id "abc-123"
    ny-cli select --estimate-id "abc-123" --also "def-456,ghi-789"
    ny-cli select --estimate-id "abc-123" --pet

After selection, polls for driver assignment.
`,
    'add-tip': `
ny-cli add-tip — Add a tip to an estimate and select it

USAGE
    ny-cli add-tip --estimate-id <id> --amount <number> [options]
    ny-cli tip --estimate-id <id> --amount <number> [options]

OPTIONS
    --estimate-id  Estimate ID to tip (required)
    --amount       Tip amount (required)
    --currency     Currency code (default: INR)

EXAMPLES
    ny-cli add-tip --estimate-id "abc-123" --amount 20
    ny-cli tip --estimate-id "abc-123" --amount 50 --currency INR
`,
    'cancel-search': `
ny-cli cancel-search — Cancel an active ride search

USAGE
    ny-cli cancel-search --estimate-id <id>
    ny-cli cancel --estimate-id <id>

OPTIONS
    --estimate-id   Estimate ID to cancel (required)

EXAMPLES
    ny-cli cancel-search --estimate-id "abc-123"
`,
    status: `
ny-cli status — Check ride booking status

USAGE
    ny-cli status [options]

OPTIONS
    --active    Show only active rides (default)
    --all       Show all rides including completed/cancelled
    --limit N   Limit number of results

EXAMPLES
    ny-cli status
    ny-cli status --all
    ny-cli status --active --limit 5
`,
    'saved-locations': `
ny-cli saved-locations — List saved locations (Home, Work, etc.)

USAGE
    ny-cli saved-locations
    ny-cli saved

Shows your saved locations from the Namma Yatri app.
`,
    help: `
ny-cli help — Show help

USAGE
    ny-cli help [command]
    ny-cli --help
    ny-cli -h

Show help for all commands or a specific command.
`,
    version: `
ny-cli version — Show version

USAGE
    ny-cli version
    ny-cli --version
    ny-cli -v
`,
  };

  return helps[command] || '';
}