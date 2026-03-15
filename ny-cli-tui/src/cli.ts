#!/usr/bin/env node
import { program } from 'commander';
import { runInteractive } from './app/index.js';
import { loadToken, clearToken, getTokenPath } from './auth/token-store.js';
import { SessionManager, getSessionStatus } from './session.js';
import { VERSION } from './config.js';

program
  .name('ny-cli')
  .description('Interactive terminal UI for booking Namma Yatri rides')
  .version(VERSION);

program
  .command('book', { isDefault: true })
  .description('Start interactive ride booking (default)')
  .option('--from <location>', 'Origin location (address or saved location name)')
  .option('--to <location>', 'Destination location (address or saved location name)')
  .action(async (options) => {
    await runInteractive({
      initialOrigin: options.from,
      initialDestination: options.to,
    });
  });

program
  .command('auth')
  .description('Authenticate with Namma Yatri')
  .option('--mobile <number>', 'Mobile number')
  .option('--code <code>', 'Access code (found in Namma Yatri app > About Us)')
  .option('--country <code>', 'Country code (default: IN)', 'IN')
  .action(async (options) => {
    const { runAuthFlow } = await import('./auth/flow.js');
    await runAuthFlow({
      mobile: options.mobile,
      code: options.code,
      country: options.country,
    });
  });

program
  .command('logout')
  .description('Clear stored authentication token and session data')
  .action(() => {
    const sessionManager = new SessionManager();
    sessionManager.clear();
    console.log('Logged out successfully.');
    console.log('Session data cleared from:', SessionManager.getSessionFile());
    console.log('Token cleared from:', getTokenPath());
  });

program
  .command('status')
  .description('Check active and recent rides')
  .option('--all', 'Show all rides including completed')
  .option('--limit <number>', 'Maximum number of rides to show', '10')
  .action(async (options) => {
    const { runStatusFlow } = await import('./rides/status-flow.js');
    await runStatusFlow({
      showAll: options.all,
      limit: parseInt(options.limit, 10),
    });
  });

program
  .command('locations')
  .description('Manage saved locations (Home, Work, etc.)')
  .action(async () => {
    const { runLocationsFlow } = await import('./locations/flow.js');
    await runLocationsFlow();
  });

program
  .command('token-info')
  .description('Show token storage information')
  .action(() => {
    const tokenPath = getTokenPath();
    const token = loadToken();
    
    if (token) {
      console.log(`Token file: ${tokenPath}`);
      console.log(`Saved at: ${token.savedAt}`);
      console.log(`Saved locations: ${token.savedLocations?.length ?? 0}`);
    } else {
      console.log(`No token found at: ${tokenPath}`);
      console.log('Run `ny-cli auth` to authenticate.');
    }
  });

program
  .command('session-info')
  .description('Show session status and information')
  .option('--json', 'Output as JSON')
  .action((options) => {
    const status = getSessionStatus();
    
    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }
    
    const sessionManager = new SessionManager();
    console.log(sessionManager.getSummary());
    console.log('');
    console.log('Paths:');
    console.log(`  Session file: ${SessionManager.getSessionFile()}`);
    console.log(`  Token file: ${getTokenPath()}`);
    
    if (status.session?.preferences) {
      console.log('');
      console.log('Preferences:');
      const prefs = status.session.preferences;
      if (prefs.defaultCountry) console.log(`  Default country: ${prefs.defaultCountry}`);
      if (prefs.preferredVehicles?.length) console.log(`  Preferred vehicles: ${prefs.preferredVehicles.join(', ')}`);
      if (prefs.defaultTipPercent) console.log(`  Default tip: ${prefs.defaultTipPercent}%`);
      if (prefs.theme) console.log(`  Theme: ${prefs.theme}`);
    }
  });

program.parse();