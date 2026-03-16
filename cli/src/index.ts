#!/usr/bin/env node
/**
 * ny-cli — Namma Yatri CLI
 * Terminal UI for booking rides via Namma Yatri
 * 
 * Built with Ink (React for CLI)
 * 
 * Usage:
 *   ny-cli                    Launch interactive TUI (default)
 *   ny-cli tui                Launch interactive TUI
 *   ny-cli login --mobile <number> --code <code>   Authenticate
 *   ny-cli search-place <text>                     Search places
 *   ny-cli status                                  Check ride status
 *   ny-cli --help                                  Show help
 *   ny-cli --version                               Show version
 */

import { parseArgs, getCommandHelp, Command } from './cli/index.js';
import {
  cmdAuth,
  cmdLogout,
  cmdWhoami,
  cmdPlaces,
  cmdPlaceDetails,
  cmdSearch,
  cmdSelect,
  cmdTip,
  cmdCancel,
  cmdStatus,
  cmdSavedLocations,
  type AuthOptions,
  type PlacesOptions,
  type PlaceDetailsOptions,
  type SearchOptions,
  type SelectOptions,
  type TipOptions,
  type CancelOptions,
  type StatusOptions,
} from './cli/index.js';
import { runCLI } from './tui/app.js';

const VERSION = '2.0.0';

// =============================================================================
// Help Text
// =============================================================================

function showGlobalHelp(): void {
  console.log(`
${bold('ny-cli')} v${VERSION} — Namma Yatri CLI

${bold('USAGE')}
    ny-cli [command] [options]

${bold('COMMANDS')}
    ${cyan('tui')}                    Launch interactive TUI (default)
    ${cyan('login')}                  Authenticate with Namma Yatri
    ${cyan('logout')}                 Clear stored authentication
    ${cyan('whoami')}                 Show current auth status
    ${cyan('search-place')}           Search for places (autocomplete)
    ${cyan('place-details')}          Get place coordinates and address
    ${cyan('search-rides')}           Search for available rides
    ${cyan('select-estimate')}        Select an estimate to book
    ${cyan('add-tip')}                Add a tip and select estimate
    ${cyan('cancel-search')}          Cancel an active search
    ${cyan('status')}                 Check ride booking status
    ${cyan('saved-locations')}        List saved locations

${bold('FLAGS')}
    -h, --help        Show help
    -v, --version     Show version

${bold('EXAMPLES')}
    ${dim('# Launch interactive TUI')}
    ny-cli

    ${dim('# Authenticate')}
    ny-cli login --mobile 9876543210 --code YOUR_ACCESS_CODE

    ${dim('# Search for a place')}
    ny-cli search-place "Koramangala"

    ${dim('# Search for rides')}
    ny-cli search-rides --from-lat 12.935 --from-lon 77.624 --to-lat 12.971 --to-lon 77.594

    ${dim('# Select an estimate')}
    ny-cli select-estimate --estimate-id "abc-123"

    ${dim('# Check active rides')}
    ny-cli status

${bold('ENVIRONMENT')}
    NY_API_BASE    Override API base URL
                   (default: https://api.moving.tech/pilot/app/v2)

${bold('TOKEN')}
    Stored at: ~/.namma-yatri/token.json

${bold('MORE INFO')}
    ny-cli help <command>    Show detailed help for a command

The Bash fallback script is available as ny-cli.sh
`);
}

// =============================================================================
// Output Helpers
// =============================================================================

function bold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`;
}

function cyan(text: string): string {
  return `\x1b[36m${text}\x1b[0m`;
}

function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`;
}

function error(text: string): void {
  console.error(`\x1b[31m[error]\x1b[0m ${text}`);
}

// =============================================================================
// Command Dispatcher
// =============================================================================

async function dispatchCommand(command: Command, options: Record<string, unknown>, positional: string[]): Promise<number> {
  switch (command) {
    case 'tui':
      // Launch the interactive TUI
      return await runTUI();

    case 'login':
      return await cmdAuth({
        mobile: options.mobile as string | undefined,
        code: options.code as string | undefined,
        country: options.country as string | undefined,
      });

    case 'logout':
      return await cmdLogout();

    case 'whoami':
      return await cmdWhoami();

    case 'search-place':
      return await cmdPlaces({
        searchText: positional[0] || options.text as string || '',
      });

    case 'place-details':
      return await cmdPlaceDetails({
        placeId: options['place-id'] as string | undefined,
        lat: options.lat as number | undefined,
        lon: options.lon as number | undefined,
      });

    case 'search-rides':
      return await cmdSearch({
        fromLat: options['from-lat'] as number,
        fromLon: options['from-lon'] as number,
        toLat: options['to-lat'] as number,
        toLon: options['to-lon'] as number,
      });

    case 'select-estimate':
      return await cmdSelect({
        estimateId: options['estimate-id'] as string,
        also: typeof options.also === 'string' 
          ? (options.also as string).split(',').map(s => s.trim())
          : options.also as string[] | undefined,
        pet: options.pet as boolean | undefined,
        specialAssistance: options['special-assistance'] as boolean | undefined,
      });

    case 'add-tip':
      return await cmdTip({
        estimateId: options['estimate-id'] as string,
        amount: options.amount as number,
        currency: options.currency as string | undefined,
      });

    case 'cancel-search':
      return await cmdCancel({
        estimateId: options['estimate-id'] as string,
      });

    case 'status':
      return await cmdStatus({
        active: options.active as boolean | undefined,
        all: options.all as boolean | undefined,
        limit: options.limit as number | undefined,
      });

    case 'saved-locations':
      return await cmdSavedLocations();

    case 'help':
      // Show help for specific command or global help
      const helpCommand = positional[0] as Command | undefined;
      if (helpCommand) {
        console.log(getCommandHelp(helpCommand));
      } else {
        showGlobalHelp();
      }
      return 0;

    case 'version':
      console.log(`ny-cli v${VERSION}`);
      return 0;

    default:
      error(`Unknown command: ${command}`);
      console.log('');
      showGlobalHelp();
      return 1;
  }
}

// =============================================================================
// TUI Launcher
// =============================================================================

async function runTUI(): Promise<number> {
  try {
    await runCLI();
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TUI failed to start';
    error(message);
    
    // Provide fallback message
    console.log('');
    console.log('The interactive TUI could not start.');
    console.log('You can use CLI commands directly:');
    console.log('  ny-cli login --mobile <number> --code <code>');
    console.log('  ny-cli search-place "location"');
    console.log('  ny-cli status');
    console.log('');
    console.log('The Bash fallback script is also available: ./ny-cli.sh');
    
    return 1;
  }
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main(): Promise<void> {
  const { command, showHelp, showVersion, options, positional } = parseArgs();

  // Handle --help flag for any command
  if (showHelp || options.help) {
    if (command && command !== 'help') {
      console.log(getCommandHelp(command));
    } else {
      showGlobalHelp();
    }
    process.exit(0);
  }

  // Handle --version flag
  if (showVersion || options.version) {
    console.log(`ny-cli v${VERSION}`);
    process.exit(0);
  }

  // Handle unknown flag
  if (options.unknownFlag) {
    error(`Unknown option: ${options.unknownFlag}`);
    console.log('');
    console.log('Run `ny-cli --help` for usage information.');
    process.exit(1);
  }

  // Dispatch to command handler
  const exitCode = await dispatchCommand(command, options, positional);
  process.exit(exitCode);
}

// Run main with error handling
main().catch((err) => {
  error(err instanceof Error ? err.message : 'An unexpected error occurred');
  process.exit(1);
});