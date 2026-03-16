/**
 * CLI Command Handlers
 * Direct CLI functions for scripting use (non-interactive)
 */

import chalk from 'chalk';
import { apiClient, PlacePrediction, RideEstimate, RideBooking, SavedLocation } from '../api/index.js';
import { formatCurrency, formatDuration, formatDate, formatDistance } from '../utils/format.js';

// =============================================================================
// Output Helpers
// =============================================================================

const info = (msg: string) => console.log(`${chalk.blue('[info]')} ${msg}`);
const ok = (msg: string) => console.log(`${chalk.green('  ok  ')} ${msg}`);
const warn = (msg: string) => console.log(`${chalk.yellow('[warn]')} ${msg}`);
const error = (msg: string) => console.error(`${chalk.red('[error]')} ${msg}`);
const header = (msg: string) => console.log(`\n${chalk.bold(msg)}\n`);

// =============================================================================
// Authentication Commands
// =============================================================================

export interface AuthOptions {
  mobile?: string;
  code?: string;
  country?: string;
}

export async function cmdAuth(options: AuthOptions = {}): Promise<number> {
  let { mobile, code, country = 'IN' } = options;

  // Prompt for missing values (basic readline for non-interactive)
  if (!mobile) {
    error('Mobile number required. Use: ny-cli login --mobile <number> --code <code>');
    return 1;
  }

  if (!code) {
    error('Access code required. Use: ny-cli login --mobile <number> --code <code>');
    return 1;
  }

  info('Authenticating...');

  try {
    const response = await apiClient.authenticate(mobile, code);

    if (!response.token) {
      error('Authentication failed — no token in response.');
      return 1;
    }

    const personName = response.person?.firstName;
    const savedLocations = apiClient.getSavedLocationsFromCache();

    ok(`Authenticated${personName ? ` as ${personName}` : ''}`);
    ok(`Token saved to ~/.namma-yatri/token.json`);
    ok(`${savedLocations.length} saved location(s) cached`);

    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Authentication failed';
    error(message);
    return 1;
  }
}

// =============================================================================
// Places Commands
// =============================================================================

export interface PlacesOptions {
  searchText: string;
}

export async function cmdPlaces(options: PlacesOptions): Promise<number> {
  const { searchText } = options;

  if (!searchText) {
    error('Search text required. Use: ny-cli search-place <text>');
    return 1;
  }

  if (!apiClient.isAuthenticated()) {
    error('Not authenticated. Run: ny-cli login');
    return 1;
  }

  info(`Searching for "${searchText}"...`);

  try {
    const predictions = await apiClient.searchPlaces(searchText);

    if (predictions.length === 0) {
      warn(`No places found matching "${searchText}"`);
      return 0;
    }

    header(`Found ${predictions.length} place(s):`);

    predictions.forEach((p, i) => {
      console.log(`  ${chalk.bold(`${i + 1}.`)} ${p.description}`);
      console.log(`     ${chalk.dim(`Place ID: ${p.placeId}`)}`);
      if (p.distanceWithUnit) {
        console.log(`     ${chalk.dim(`Distance: ${formatDistance(p.distanceWithUnit.value, p.distanceWithUnit.unit)}`)}`);
      }
      console.log('');
    });

    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    error(message);
    return 1;
  }
}

export interface PlaceDetailsOptions {
  placeId?: string;
  lat?: number;
  lon?: number;
}

export async function cmdPlaceDetails(options: PlaceDetailsOptions): Promise<number> {
  const { placeId, lat, lon } = options;

  if (!apiClient.isAuthenticated()) {
    error('Not authenticated. Run: ny-cli login');
    return 1;
  }

  if (!placeId && (lat === undefined || lon === undefined)) {
    error('Place ID or coordinates required. Use: ny-cli place-details --place-id <id> OR --lat <lat> --lon <lon>');
    return 1;
  }

  info('Fetching place details...');

  try {
    const details = placeId
      ? await apiClient.getPlaceDetails(placeId)
      : await apiClient.getPlaceDetails(lat!, lon!);

    header('Place Details');

    console.log(`  ${chalk.bold('Coordinates:')} ${details.lat}, ${details.lon}`);
    console.log(`  ${chalk.bold('Place ID:')}    ${details.placeId}`);

    const addrParts = [
      details.address.area,
      details.address.city,
      details.address.state,
    ].filter(Boolean).join(', ');

    if (addrParts) {
      console.log(`  ${chalk.bold('Address:')}     ${addrParts}`);
    }

    console.log('');
    console.log(`  ${chalk.dim('Full response:')}`);
    console.log(JSON.stringify(details, null, 2).split('\n').map(l => `  ${l}`).join('\n'));

    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch place details';
    error(message);
    return 1;
  }
}

// =============================================================================
// Ride Search Commands
// =============================================================================

export interface SearchOptions {
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
}

export async function cmdSearch(options: SearchOptions): Promise<number> {
  const { fromLat, fromLon, toLat, toLon } = options;

  if (!apiClient.isAuthenticated()) {
    error('Not authenticated. Run: ny-cli login');
    return 1;
  }

  if (!fromLat || !fromLon || !toLat || !toLon) {
    error('All coordinates required. Use: ny-cli search-rides --from-lat <lat> --from-lon <lon> --to-lat <lat> --to-lon <lon>');
    return 1;
  }

  info('Searching for rides...');

  try {
    const searchId = await apiClient.searchRides(fromLat, fromLon, toLat, toLon);
    ok(`Search ID: ${searchId}`);

    info('Polling for estimates...');
    const estimates = await apiClient.pollSearchResults(searchId);

    if (estimates.length === 0) {
      warn('No estimates returned. Try different locations or try again later.');
      return 1;
    }

    header(`Found ${estimates.length} estimate(s):`);

    estimates.forEach((e, i) => {
      const fare = formatCurrency(e.estimatedTotalFareWithCurrency.amount, e.estimatedTotalFareWithCurrency.currency);
      const range = e.totalFareRange
        ? ` (range: ${e.totalFareRange.minFare}-${e.totalFareRange.maxFare})`
        : '';

      console.log(`  ${chalk.bold(`${i + 1}.`)} ${chalk.cyan(e.serviceTierName)} (${e.vehicleVariant})`);
      console.log(`     Fare: ${chalk.green(fare)}${range}`);
      if (e.estimatedPickupDuration) {
        console.log(`     Pickup ETA: ${formatDuration(e.estimatedPickupDuration)}`);
      }
      console.log(`     Provider: ${e.providerName}`);
      console.log(`     ${chalk.dim(`Estimate ID: ${e.id}`)}`);
      console.log('');
    });

    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    error(message);
    return 1;
  }
}

// =============================================================================
// Booking Commands
// =============================================================================

export interface SelectOptions {
  estimateId: string;
  also?: string[];
  pet?: boolean;
  specialAssistance?: boolean;
}

export async function cmdSelect(options: SelectOptions): Promise<number> {
  const { estimateId, also = [], pet = false, specialAssistance = false } = options;

  if (!apiClient.isAuthenticated()) {
    error('Not authenticated. Run: ny-cli login');
    return 1;
  }

  if (!estimateId) {
    error('Estimate ID required. Use: ny-cli select-estimate --estimate-id <id>');
    return 1;
  }

  info(`Selecting estimate ${estimateId}...`);

  try {
    await apiClient.selectEstimate(estimateId, {
      additionalEstimateIds: also,
      isPetRide: pet,
      specialAssistance,
    });

    ok('Estimate selected.');

    info('Polling for driver assignment...');

    const booking = await apiClient.pollForDriverAssignment();

    if (booking) {
      header('Driver Assigned!');
      console.log(`  ${chalk.bold('Booking ID:')} ${booking.id}`);
      console.log(`  ${chalk.bold('Status:')}     ${booking.status}`);
      if (booking.driverName) {
        console.log(`  ${chalk.bold('Driver:')}     ${booking.driverName}`);
      }
      if (booking.vehicleNumber) {
        console.log(`  ${chalk.bold('Vehicle:')}    ${booking.vehicleNumber}`);
      }
      if (booking.estimatedFare) {
        console.log(`  ${chalk.bold('Fare:')}       ${booking.estimatedFare}`);
      }
      console.log('');
    } else {
      warn('No driver assigned after 30s.');
      info('You\'ll receive a notification on your phone when a driver is assigned.');
    }

    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Selection failed';
    error(message);
    return 1;
  }
}

export interface TipOptions {
  estimateId: string;
  amount: number;
  currency?: string;
}

export async function cmdTip(options: TipOptions): Promise<number> {
  const { estimateId, amount, currency = 'INR' } = options;

  if (!apiClient.isAuthenticated()) {
    error('Not authenticated. Run: ny-cli login');
    return 1;
  }

  if (!estimateId || !amount) {
    error('Estimate ID and amount required. Use: ny-cli add-tip --estimate-id <id> --amount <number>');
    return 1;
  }

  info(`Adding tip of ${currency} ${amount} to estimate ${estimateId}...`);

  try {
    await apiClient.addTip(estimateId, amount, currency);
    ok('Tip added and estimate selected.');
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add tip';
    error(message);
    return 1;
  }
}

export interface CancelOptions {
  estimateId: string;
}

export async function cmdCancel(options: CancelOptions): Promise<number> {
  const { estimateId } = options;

  if (!apiClient.isAuthenticated()) {
    error('Not authenticated. Run: ny-cli login');
    return 1;
  }

  if (!estimateId) {
    error('Estimate ID required. Use: ny-cli cancel-search --estimate-id <id>');
    return 1;
  }

  info(`Cancelling estimate ${estimateId}...`);

  try {
    await apiClient.cancelSearch(estimateId);
    ok('Search cancelled.');
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cancel failed';
    error(message);
    return 1;
  }
}

// =============================================================================
// Status Commands
// =============================================================================

export interface StatusOptions {
  active?: boolean;
  all?: boolean;
  limit?: number;
}

export async function cmdStatus(options: StatusOptions = {}): Promise<number> {
  const { active = true, all = false, limit } = options;

  if (!apiClient.isAuthenticated()) {
    error('Not authenticated. Run: ny-cli login');
    return 1;
  }

  info('Fetching ride status...');

  try {
    const rides = await apiClient.getRideStatus(!all, limit);

    if (rides.length === 0) {
      info('No rides found.');
      return 0;
    }

    header(`${rides.length} ride(s):`);

    rides.forEach((r, i) => {
      let statusColor = chalk.reset;
      if (r.status.includes('COMPLETED')) statusColor = chalk.green;
      else if (r.status.includes('CANCELLED')) statusColor = chalk.red;
      else if (r.status.includes('ACTIVE') || r.status.includes('NEW') || r.status.includes('CONFIRMED')) {
        statusColor = chalk.yellow;
      }

      console.log(`  ${chalk.bold(`${i + 1}.`)} ${statusColor(r.status)}`);
      console.log(`     Created: ${formatDate(r.createdAt)}`);
      if (r.estimatedFare) {
        console.log(`     Fare: ${r.estimatedFare}`);
      }
      if (r.driverName) {
        console.log(`     Driver: ${r.driverName}`);
      }
      if (r.vehicleNumber) {
        console.log(`     Vehicle: ${r.vehicleNumber} (${r.vehicleVariant || 'N/A'})`);
      }
      console.log(`     ${chalk.dim(`Booking ID: ${r.id}`)}`);
      console.log('');
    });

    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch status';
    error(message);
    return 1;
  }
}

// =============================================================================
// Saved Locations Commands
// =============================================================================

export async function cmdSavedLocations(): Promise<number> {
  if (!apiClient.isAuthenticated()) {
    error('Not authenticated. Run: ny-cli login');
    return 1;
  }

  info('Fetching saved locations...');

  try {
    const locations = await apiClient.getSavedLocations();

    if (locations.length === 0) {
      info('No saved locations found.');
      return 0;
    }

    header(`${locations.length} saved location(s):`);

    locations.forEach((loc, i) => {
      console.log(`  ${chalk.bold(`${i + 1}.`)} ${chalk.cyan(loc.tag)}`);
      if (loc.locationName) {
        console.log(`     Name: ${loc.locationName}`);
      }
      const addrParts = [loc.area, loc.city].filter(Boolean).join(', ');
      if (addrParts) {
        console.log(`     Address: ${addrParts}`);
      }
      console.log(`     Coordinates: ${loc.lat}, ${loc.lon}`);
      console.log('');
    });

    ok('Saved locations cache updated.');
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch saved locations';
    error(message);
    return 1;
  }
}

// =============================================================================
// Logout Command
// =============================================================================

export async function cmdLogout(): Promise<number> {
  apiClient.clearAuth();
  ok('Logged out. Token cleared.');
  info('Run `ny-cli login` to authenticate again.');
  return 0;
}

// =============================================================================
// Whoami Command
// =============================================================================

export async function cmdWhoami(): Promise<number> {
  if (!apiClient.isAuthenticated()) {
    console.log('Not authenticated.');
    return 1;
  }

  const person = apiClient.getPerson();
  const tokenInfo = apiClient.getObfuscatedToken();

  if (person) {
    console.log(`Logged in as: ${person.firstName || 'Unknown'}`);
    if (person.maskedMobileNumber) {
      console.log(`Mobile: ${person.maskedMobileNumber}`);
    }
  } else {
    console.log('Authenticated (no person info available)');
  }

  if (tokenInfo) {
    console.log(`Token: ${tokenInfo.substring(0, 20)}...`);
  }

  return 0;
}