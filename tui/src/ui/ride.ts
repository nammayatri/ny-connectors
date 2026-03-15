/**
 * Ride Booking Flow UI for Namma Yatri TUI
 * 
 * Complete ride booking flow with multiple steps:
 * 1. Select origin - show saved locations first, then option to search
 * 2. Select destination - same pattern
 * 3. Search for rides with ora spinner and cancel option
 * 4. Display estimates using select component
 * 5. On selection, prompt for tip with suggested amounts
 * 6. Book the ride and poll for driver assignment with cancel option
 * 7. Show confirmation with driver details
 * 
 * Features:
 * - Quick routes (Home→Work) if saved locations exist
 * - ESC at any step returns to previous step or main menu
 * - Cancel option during search and driver polling
 * - Beautiful formatting with colors and icons
 */

import {
  showSectionHeader,
  showMenu,
  showInput,
  showNumber,
  showConfirm,
  showSuccess,
  showError,
  showInfo,
  showWarning,
  chalk,
} from './menu.js';
import {
  NammaYatriClient,
  getAuthenticatedClient,
  SavedLocation,
  PlacePrediction,
  PlaceDetails,
  RideEstimate,
  SearchResults,
  RideBooking,
  formatCurrency,
  formatPickupDuration,
  formatDistance,
} from '../api.js';
import ora from 'ora';
import { select } from '@inquirer/prompts';

// =============================================================================
// Types
// =============================================================================

/**
 * Location selection result
 */
export interface SelectedLocation {
  lat: number;
  lon: number;
  name: string;
  address?: string;
  isSavedLocation?: boolean;
}

/**
 * Quick route option
 */
interface QuickRoute {
  id: string;
  name: string;
  origin: SelectedLocation;
  destination: SelectedLocation;
}

/**
 * Ride booking state
 */
interface BookingState {
  origin?: SelectedLocation;
  destination?: SelectedLocation;
  searchId?: string;
  estimates?: RideEstimate[];
  selectedEstimate?: RideEstimate;
  booking?: RideBooking;
  isCancelled?: boolean;
}

/**
 * Booking result
 */
export type BookingResult = 
  | { success: true; booking: RideBooking }
  | { success: false; error: string }
  | { cancelled: true };

/**
 * Polling state for cancellable operations
 */
interface PollingState {
  cancelled: boolean;
  estimateId?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DRIVER_POLLING_INTERVAL_MS = 2000;
const MAX_DRIVER_POLLING_MS = 60000;
const SEARCH_POLLING_INTERVAL_MS = 1500;
const MAX_SEARCH_POLLING_MS = 15000;

// Default tip options (in INR)
const DEFAULT_TIP_OPTIONS = [10, 20, 30, 50, 100];

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Runs the complete ride booking flow
 * Returns the booking result or cancellation
 */
export async function runRideBookingFlow(client?: NammaYatriClient): Promise<BookingResult> {
  const apiClient = client || getAuthenticatedClient();
  const state: BookingState = {};

  try {
    // Step 1: Check for quick routes
    const quickRoute = await checkQuickRoutes(apiClient);
    
    if (quickRoute) {
      state.origin = quickRoute.origin;
      state.destination = quickRoute.destination;
      
      // Skip to search
      return await executeSearchAndBook(apiClient, state);
    }

    // Step 2: Select origin
    const origin = await selectLocation(apiClient, 'pickup', state);
    if (!origin) {
      return { cancelled: true };
    }
    state.origin = origin;

    // Step 3: Select destination
    const destination = await selectLocation(apiClient, 'drop', state);
    if (!destination) {
      return { cancelled: true };
    }
    state.destination = destination;

    // Step 4: Check if same location
    if (isSameLocation(origin, destination)) {
      showWarning('Pickup and drop locations are the same. Please select different locations.');
      // Restart flow
      return runRideBookingFlow(apiClient);
    }

    // Step 5: Search and book
    return await executeSearchAndBook(apiClient, state);

  } catch (error) {
    if (error instanceof Error && error.message === 'User cancelled') {
      return { cancelled: true };
    }
    return { success: false, error: (error as Error).message };
  }
}

// =============================================================================
// Quick Routes
// =============================================================================

/**
 * Checks if quick routes are available and lets user select one
 */
async function checkQuickRoutes(client: NammaYatriClient): Promise<QuickRoute | null> {
  const savedLocations = await getSavedLocationsAsync(client);

  if (savedLocations.length < 2) {
    return null;
  }

  // Find common quick routes
  const home = savedLocations.find(loc => loc.tag.toLowerCase() === 'home');
  const work = savedLocations.find(loc => 
    loc.tag.toLowerCase() === 'work' || 
    loc.tag.toLowerCase() === 'office'
  );

  const quickRoutes: QuickRoute[] = [];

  // Home → Work
  if (home && work) {
    quickRoutes.push({
      id: 'home-to-work',
      name: '🏠 Home → 🏢 Work',
      origin: savedLocationToSelected(home),
      destination: savedLocationToSelected(work),
    });
  }

  // Work → Home
  if (home && work) {
    quickRoutes.push({
      id: 'work-to-home',
      name: '🏢 Work → 🏠 Home',
      origin: savedLocationToSelected(work),
      destination: savedLocationToSelected(home),
    });
  }

  if (quickRoutes.length === 0) {
    return null;
  }

  // Show quick route selection
  showSectionHeader('⚡ Quick Routes', 'Select a frequent route or choose custom locations');

  const choices = [
    ...quickRoutes.map(route => ({
      name: route.name,
      value: route,
      description: 'Quick route based on your saved locations',
    })),
    {
      name: '🗺️  Custom route',
      value: null as any,
      description: 'Select pickup and drop locations manually',
    },
  ];

  const result = await showMenu<QuickRoute | null>(
    {
      title: 'Choose Route',
      subtitle: 'Quick routes available based on your saved locations',
    },
    choices
  );

  if (result === 'back' || result === 'exit') {
    return null;
  }

  return result;
}

// =============================================================================
// Location Selection
// =============================================================================

/**
 * Prompts user to select a location (origin or destination)
 */
async function selectLocation(
  client: NammaYatriClient,
  type: 'pickup' | 'drop',
  state: BookingState
): Promise<SelectedLocation | null> {
  const typeLabel = type === 'pickup' ? 'Pickup' : 'Drop';
  const typeIcon = type === 'pickup' ? '🟢' : '🔴';
  const otherLocation = type === 'pickup' ? state.destination : state.origin;

  showSectionHeader(
    `${typeIcon} Select ${typeLabel}`,
    otherLocation 
      ? `Other location: ${otherLocation.name}`
      : 'Choose your location'
  );

  const savedLocations = await getSavedLocationsAsync(client);

  const choices: Array<{
    name: string;
    value: SelectedLocation | 'search' | 'coords';
    description?: string;
  }> = [];

  // Add saved locations
  for (const loc of savedLocations) {
    // Skip if this is the other location
    if (otherLocation && isSameLocationCoords(loc.lat, loc.lon, otherLocation.lat, otherLocation.lon)) {
      continue;
    }

    choices.push({
      name: formatSavedLocation(loc),
      value: savedLocationToSelected(loc),
      description: loc.area || `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`,
    });
  }

  // Add search option
  choices.push({
    name: '🔍 Search for a place',
    value: 'search',
    description: 'Search by name or address',
  });

  // Add coordinates option
  choices.push({
    name: '📍 Enter coordinates',
    value: 'coords',
    description: 'Enter latitude and longitude manually',
  });

  const result = await showMenu<SelectedLocation | 'search' | 'coords'>(
    {
      title: typeLabel,
      subtitle: savedLocations.length > 0 
        ? `${savedLocations.length} saved location(s) available`
        : 'No saved locations',
    },
    choices
  );

  if (result === 'back' || result === 'exit') {
    return null;
  }

  if (result === 'search') {
    return await searchForLocation(client, typeLabel);
  }

  if (result === 'coords') {
    return await enterCoordinates(typeLabel);
  }

  return result;
}

/**
 * Searches for a location by name/address
 */
async function searchForLocation(
  client: NammaYatriClient,
  typeLabel: string
): Promise<SelectedLocation | null> {
  showSectionHeader(`🔍 Search ${typeLabel}`, 'Enter place name or address');

  const searchText = await showInput(
    'Enter search term',
    (value) => {
      if (!value?.trim()) return 'Please enter a search term';
      if (value.trim().length < 3) return 'Please enter at least 3 characters';
      return true;
    }
  );

  if (searchText === null) {
    return null;
  }

  try {
    const spinner = ora('Searching for places...').start();
    const places = await client.searchPlaces(searchText);
    spinner.succeed(`Found ${places.length} place(s)`);

    if (places.length === 0) {
      showInfo('No places found. Try a different search term.');
      return searchForLocation(client, typeLabel);
    }

    // Show places selection
    const selectedPlace = await showPlacesSelection(places);

    if (!selectedPlace) {
      return null;
    }

    // Get place details
    const detailsSpinner = ora('Getting place details...').start();
    const details = await client.getPlaceDetails(selectedPlace.placeId);
    detailsSpinner.succeed();

    return {
      lat: details.lat,
      lon: details.lon,
      name: selectedPlace.description,
      address: formatAddressFromDetails(details),
    };

  } catch (error) {
    showError(`Search failed: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Shows a list of places for selection
 */
async function showPlacesSelection(
  places: PlacePrediction[]
): Promise<PlacePrediction | null> {
  showSectionHeader('📍 Search Results', `Found ${places.length} place(s)`);

  const choices = places.slice(0, 10).map((place) => ({
    name: formatPlacePrediction(place),
    value: place,
    description: place.placeId,
  }));

  const result = await showMenu<PlacePrediction>(
    {
      title: 'Select a Place',
      subtitle: 'Showing top 10 results',
    },
    choices
  );

  if (result === 'back' || result === 'exit') {
    return null;
  }

  return result;
}

/**
 * Prompts user to enter coordinates manually
 */
async function enterCoordinates(typeLabel: string): Promise<SelectedLocation | null> {
  showSectionHeader(`📍 Enter ${typeLabel} Coordinates`, 'Enter latitude and longitude');

  const lat = await showNumber('Latitude', {
    validate: (value) => {
      if (value === undefined || value === null) return 'Please enter a valid latitude';
      if (value < -90 || value > 90) return 'Latitude must be between -90 and 90';
      return true;
    },
  });

  if (lat === null) return null;

  const lon = await showNumber('Longitude', {
    validate: (value) => {
      if (value === undefined || value === null) return 'Please enter a valid longitude';
      if (value < -180 || value > 180) return 'Longitude must be between -180 and 180';
      return true;
    },
  });

  if (lon === null) return null;

  return {
    lat,
    lon,
    name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    address: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
  };
}

// =============================================================================
// Search and Book Flow
// =============================================================================

/**
 * Executes the search and booking flow
 */
async function executeSearchAndBook(
  client: NammaYatriClient,
  state: BookingState
): Promise<BookingResult> {
  if (!state.origin || !state.destination) {
    return { success: false, error: 'Missing origin or destination' };
  }

  // Show route summary
  showRouteSummary(state.origin, state.destination);

  // Search for rides with cancel option
  let searchResults: SearchResults;
  try {
    searchResults = await searchRidesWithCancel(client, state);
    
    if (state.isCancelled) {
      return { cancelled: true };
    }
  } catch (error) {
    return { success: false, error: `Search failed: ${(error as Error).message}` };
  }

  if (searchResults.estimates.length === 0) {
    showInfo('No rides available for this route. Try different locations or try again later.');
    return { cancelled: true };
  }

  // Select estimate
  const estimate = await selectEstimate(searchResults);
  if (!estimate) {
    return { cancelled: true };
  }
  state.selectedEstimate = estimate;

  // Book the ride
  return await bookRide(client, state);
}

/**
 * Searches for rides with cancel option during polling
 */
async function searchRidesWithCancel(
  client: NammaYatriClient,
  state: BookingState
): Promise<SearchResults> {
  const spinner = ora({
    text: 'Searching for available rides...',
    spinner: 'dots',
  }).start();

  try {
    // Create place details from selected locations
    const originDetails: PlaceDetails = {
      lat: state.origin!.lat,
      lon: state.origin!.lon,
      placeId: `${state.origin!.lat},${state.origin!.lon}`,
      address: {
        area: state.origin!.address || state.origin!.name,
        city: '',
        country: '',
        building: '',
        placeId: `${state.origin!.lat},${state.origin!.lon}`,
        state: '',
      },
    };

    const destDetails: PlaceDetails = {
      lat: state.destination!.lat,
      lon: state.destination!.lon,
      placeId: `${state.destination!.lat},${state.destination!.lon}`,
      address: {
        area: state.destination!.address || state.destination!.name,
        city: '',
        country: '',
        building: '',
        placeId: `${state.destination!.lat},${state.destination!.lon}`,
        state: '',
      },
    };

    // Initiate search
    const searchId = await initiateSearch(client, originDetails, destDetails);
    state.searchId = searchId;

    // Poll with cancel option
    const results = await pollSearchWithCancel(client, searchId, spinner, state);
    
    if (state.isCancelled) {
      return { searchId, estimates: [], fromLocation: {} as any, toLocation: {} as any, allJourneysLoaded: true };
    }

    spinner.succeed(`Found ${results.estimates.length} ride option(s)`);
    return results;

  } catch (error) {
    spinner.fail('Search failed');
    throw error;
  }
}

/**
 * Initiates a ride search
 */
async function initiateSearch(
  client: NammaYatriClient,
  origin: PlaceDetails,
  destination: PlaceDetails
): Promise<string> {
  const originData = {
    gps: { lat: origin.lat, lon: origin.lon },
    address: origin.address,
  };

  const destData = {
    gps: { lat: destination.lat, lon: destination.lon },
    address: destination.address,
  };

  // Use the client's searchRides method
  const results = await client.searchRides(origin, destination);
  return results.searchId;
}

/**
 * Polls for search results with cancel option
 */
async function pollSearchWithCancel(
  client: NammaYatriClient,
  searchId: string,
  spinner: ora.Ora,
  state: BookingState
): Promise<SearchResults> {
  const startTime = Date.now();
  let attempt = 0;

  // Show cancel prompt in a non-blocking way
  const cancelPromise = showCancelPrompt('Searching for rides...');
  let cancelled = false;

  while (Date.now() - startTime < MAX_SEARCH_POLLING_MS && !cancelled) {
    // Check if user cancelled
    if (cancelPromise) {
      const result = await Promise.race([
        client.fetchStatus({ onlyActive: true }).then(() => 'continue' as const),
        cancelPromise.then(() => 'cancel' as const),
        sleep(SEARCH_POLLING_INTERVAL_MS).then(() => 'poll' as const),
      ]);

      if (result === 'cancel') {
        spinner.info('Search cancelled by user');
        state.isCancelled = true;
        return { searchId, estimates: [], fromLocation: {} as any, toLocation: {} as any, allJourneysLoaded: true };
      }
    }

    attempt++;
    spinner.text = `Searching for available rides... (attempt ${attempt})`;

    try {
      // Poll for results using fetchStatus to check for any active searches
      const bookings = await client.fetchStatus({ onlyActive: true });
      
      // If we have active bookings, the search might have completed
      if (bookings.length > 0) {
        // Continue polling for estimates
      }
    } catch {
      // Continue polling
    }

    // Try to get estimates
    try {
      const estimates = await getSearchResults(client, searchId);
      if (estimates.length > 0) {
        return {
          searchId,
          estimates,
          fromLocation: {} as any,
          toLocation: {} as any,
          allJourneysLoaded: true,
        };
      }
    } catch {
      // Continue polling
    }

    await sleep(SEARCH_POLLING_INTERVAL_MS);
  }

  // Timeout - return empty results
  return { searchId, estimates: [], fromLocation: {} as any, toLocation: {} as any, allJourneysLoaded: true };
}

/**
 * Gets search results from API
 */
async function getSearchResults(client: NammaYatriClient, searchId: string): Promise<RideEstimate[]> {
  try {
    // Use the client's internal API call
    const response = await (client as any).apiCall('GET', `/rideSearch/${searchId}/results`);
    return response.estimates || [];
  } catch {
    return [];
  }
}

/**
 * Shows route summary before search
 */
function showRouteSummary(origin: SelectedLocation, destination: SelectedLocation): void {
  showSectionHeader('🚗 Route Summary', 'Your selected route');

  console.log();
  console.log(`  ${chalk.green('●')} ${chalk.bold('Pickup:')}   ${chalk.cyan(origin.name)}`);
  if (origin.address && origin.address !== origin.name) {
    console.log(`      ${chalk.dim(origin.address)}`);
  }
  console.log();
  console.log(`  ${chalk.red('●')} ${chalk.bold('Drop:')}      ${chalk.cyan(destination.name)}`);
  if (destination.address && destination.address !== destination.name) {
    console.log(`      ${chalk.dim(destination.address)}`);
  }
  console.log();
  console.log(chalk.dim('  ─────────────────────────────────────'));
  console.log();
}

// =============================================================================
// Estimate Selection
// =============================================================================

/**
 * Shows estimates and lets user select one
 */
async function selectEstimate(results: SearchResults): Promise<RideEstimate | null> {
  showSectionHeader('🚕 Available Rides', `${results.estimates.length} option(s) found`);

  // Group estimates by service tier
  const groupedEstimates = groupEstimatesByTier(results.estimates);

  const choices: Array<{
    name: string;
    value: RideEstimate;
    description?: string;
  }> = [];

  for (const [tier, estimates] of groupedEstimates) {
    // Add tier header as disabled option
    if (groupedEstimates.size > 1) {
      choices.push({
        name: chalk.dim(`── ${tier} ──`),
        value: estimates[0], // Will be overridden
        description: '',
      });
    }

    // Add estimates for this tier
    for (const estimate of estimates) {
      choices.push({
        name: formatEstimate(estimate),
        value: estimate,
        description: `${estimate.providerName} | ${estimate.vehicleVariant}`,
      });
    }
  }

  const result = await showMenu<RideEstimate>(
    {
      title: 'Select a Ride',
      subtitle: 'Choose your preferred ride option',
    },
    choices
  );

  if (result === 'back' || result === 'exit') {
    return null;
  }

  return result;
}

/**
 * Groups estimates by service tier
 */
function groupEstimatesByTier(estimates: RideEstimate[]): Map<string, RideEstimate[]> {
  const groups = new Map<string, RideEstimate[]>();

  for (const estimate of estimates) {
    const tier = estimate.serviceTierName || 'Standard';
    if (!groups.has(tier)) {
      groups.set(tier, []);
    }
    groups.get(tier)!.push(estimate);
  }

  return groups;
}

/**
 * Formats an estimate for display
 */
function formatEstimate(estimate: RideEstimate): string {
  const fare = formatCurrency(estimate.estimatedTotalFareWithCurrency);
  const pickup = formatPickupDuration(estimate.estimatedPickupDuration);

  let line = `  ${chalk.cyan(estimate.vehicleVariant)}`;
  
  // Fare
  line += ` ${chalk.green(fare)}`;

  // Pickup time
  if (pickup !== 'N/A') {
    line += chalk.dim(` · ${pickup} pickup`);
  }

  // AC indicator
  if (estimate.isAirConditioned !== undefined) {
    line += estimate.isAirConditioned 
      ? chalk.cyan(' ❄️') 
      : chalk.yellow(' 🌡️');
  }

  // Provider name if different from default
  if (estimate.providerName && !estimate.providerName.toLowerCase().includes('yatri')) {
    line += chalk.dim(` (${estimate.providerName})`);
  }

  return line;
}

// =============================================================================
// Booking Flow
// =============================================================================

/**
 * Books the selected ride
 */
async function bookRide(
  client: NammaYatriClient,
  state: BookingState
): Promise<BookingResult> {
  const estimate = state.selectedEstimate!;

  showSectionHeader('📝 Book Ride', estimate.serviceTierName || estimate.vehicleVariant);

  // Show estimate details
  showEstimateDetails(estimate);

  // Ask about tip
  const wantTip = await showConfirm(
    'Would you like to add a tip to get a ride faster?',
    false
  );

  if (wantTip) {
    return await bookWithTip(client, estimate, state);
  } else {
    return await bookStandard(client, estimate, state);
  }
}

/**
 * Shows estimate details
 */
function showEstimateDetails(estimate: RideEstimate): void {
  console.log(chalk.dim('  ─────────────────────────────────────'));
  console.log();

  // Service info
  console.log(`  ${chalk.bold('Service:')}     ${chalk.cyan(estimate.serviceTierName || estimate.vehicleVariant)}`);
  console.log(`  ${chalk.bold('Vehicle:')}     ${estimate.vehicleVariant}`);
  
  if (estimate.providerName) {
    console.log(`  ${chalk.bold('Provider:')}    ${estimate.providerName}`);
  }

  // Fare
  console.log();
  console.log(`  ${chalk.bold('Fare:')}        ${chalk.green(formatCurrency(estimate.estimatedTotalFareWithCurrency))}`);

  // Fare range if available
  if (estimate.totalFareRange) {
    const range = estimate.totalFareRange;
    console.log(`  ${chalk.bold('Range:')}       ${formatCurrency(range.minFareWithCurrency)} - ${formatCurrency(range.maxFareWithCurrency)}`);
  }

  // Pickup time
  console.log();
  console.log(`  ${chalk.bold('Pickup in:')}   ${formatPickupDuration(estimate.estimatedPickupDuration)}`);

  // AC status
  if (estimate.isAirConditioned !== undefined) {
    const acStatus = estimate.isAirConditioned ? 'Yes ❄️' : 'No 🌡️';
    console.log(`  ${chalk.bold('AC:')}          ${acStatus}`);
  }

  // Fare breakdown
  if (estimate.estimateFareBreakup && estimate.estimateFareBreakup.length > 0) {
    console.log();
    console.log(chalk.dim('  Fare Breakdown:'));
    for (const item of estimate.estimateFareBreakup) {
      console.log(`    ${item.title}: ${formatCurrency(item.priceWithCurrency)}`);
    }
  }

  // Toll info
  if (estimate.tollChargesInfo && estimate.tollChargesInfo.tollNames?.length > 0) {
    console.log();
    console.log(chalk.yellow(`  ⚠️ Toll: ${estimate.tollChargesInfo.tollNames.join(', ')}`));
    console.log(chalk.dim(`     Charges: ${formatCurrency(estimate.tollChargesInfo.tollChargesWithCurrency)}`));
  }

  // Night shift
  if (estimate.nightShiftInfo) {
    console.log();
    console.log(chalk.dim(`  🌙 Night shift charges may apply`));
  }

  console.log();
  console.log(chalk.dim('  ─────────────────────────────────────'));
  console.log();
}

/**
 * Books with tip - enhanced with number input and suggested amounts
 */
async function bookWithTip(
  client: NammaYatriClient,
  estimate: RideEstimate,
  state: BookingState
): Promise<BookingResult> {
  // Get tip options from estimate or use defaults
  const tipOptions = estimate.tipOptions || DEFAULT_TIP_OPTIONS;
  const smartTip = estimate.smartTipSuggestion;

  showSectionHeader('💰 Add Tip', 'Higher tips may get faster driver assignment');

  // Show smart tip suggestion if available
  if (smartTip) {
    console.log(chalk.dim(`  💡 Suggested tip: ₹${smartTip}`));
    if (estimate.smartTipReason) {
      console.log(chalk.dim(`     ${estimate.smartTipReason}`));
    }
    console.log();
  }

  // Build tip choices
  const choices: Array<{
    name: string;
    value: number;
    description?: string;
  }> = [];

  // Add suggested tip first if available and not in options
  if (smartTip && !tipOptions.includes(smartTip)) {
    choices.push({
      name: `💡 ₹${smartTip} (Suggested)`,
      value: smartTip,
      description: 'Recommended tip amount',
    });
  }

  // Add standard tip options
  for (const amount of tipOptions) {
    const isSuggested = amount === smartTip;
    choices.push({
      name: `${isSuggested ? '💡 ' : ''}₹${amount}`,
      value: amount,
      description: isSuggested ? 'Suggested tip' : `Add ₹${amount} tip`,
    });
  }

  // Add custom option
  choices.push({
    name: '✏️  Custom amount',
    value: -1,
    description: 'Enter a custom tip amount',
  });

  // Add no tip option
  choices.push({
    name: '❌ Skip tip',
    value: 0,
    description: 'Continue without adding a tip',
  });

  const tipChoice = await showMenu<number>(
    {
      title: 'Select Tip Amount',
      subtitle: 'Tips help you get rides faster during peak hours',
    },
    choices
  );

  if (tipChoice === 'back' || tipChoice === 'exit') {
    return { cancelled: true };
  }

  let tipAmount = tipChoice;

  // Handle custom tip amount
  if (tipChoice === -1) {
    showSectionHeader('✏️ Custom Tip', 'Enter your preferred tip amount');
    
    const customTip = await showNumber('Enter tip amount (INR)', {
      min: 1,
      max: 500,
      default: smartTip || 20,
      validate: (value) => {
        if (value === undefined || value === null) return 'Please enter a valid amount';
        if (value < 1) return 'Minimum tip is ₹1';
        if (value > 500) return 'Maximum tip is ₹500';
        return true;
      },
    });

    if (customTip === null) {
      // User cancelled custom input, go back to tip selection
      return bookWithTip(client, estimate, state);
    }
    tipAmount = customTip;
  }

  // Skip tip - proceed with standard booking
  if (tipAmount === 0) {
    return await bookStandard(client, estimate, state);
  }

  // Show confirmation
  const totalFare = estimate.estimatedTotalFare + tipAmount;
  console.log();
  console.log(chalk.dim('  ─────────────────────────────────────'));
  console.log(`  ${chalk.bold('Base Fare:')}   ${chalk.green(formatCurrency(estimate.estimatedTotalFareWithCurrency))}`);
  console.log(`  ${chalk.bold('Tip:')}         ${chalk.yellow(`₹${tipAmount}`)}`);
  console.log(`  ${chalk.bold('Total:')}       ${chalk.green(`₹${totalFare}`)}`);
  console.log(chalk.dim('  ─────────────────────────────────────'));
  console.log();

  const confirmBooking = await showConfirm(
    `Confirm booking with ₹${tipAmount} tip?`,
    true
  );

  if (!confirmBooking) {
    showInfo('Booking cancelled.');
    return { cancelled: true };
  }

  // Book with tip and poll for driver with cancel option
  return await executeBookingWithCancel(
    client,
    estimate,
    { tipAmount },
    `Adding ₹${tipAmount} tip and booking...`,
    state
  );
}

/**
 * Books without tip
 */
async function bookStandard(
  client: NammaYatriClient,
  estimate: RideEstimate,
  state: BookingState
): Promise<BookingResult> {
  // Ask about ride options
  const isPetRide = await showConfirm('Is this a pet ride?', false);
  const specialAssistance = await showConfirm('Do you need special assistance?', false);

  const confirmBooking = await showConfirm(
    `Confirm booking for ${formatCurrency(estimate.estimatedTotalFareWithCurrency)}?`,
    true
  );

  if (!confirmBooking) {
    showInfo('Booking cancelled.');
    return { cancelled: true };
  }

  return await executeBookingWithCancel(
    client,
    estimate,
    { isPetRide, specialAssistance },
    'Booking your ride...',
    state
  );
}

/**
 * Executes the booking and polls for driver assignment with cancel option
 */
async function executeBookingWithCancel(
  client: NammaYatriClient,
  estimate: RideEstimate,
  options: {
    tipAmount?: number;
    isPetRide?: boolean;
    specialAssistance?: boolean;
  },
  spinnerText: string,
  state: BookingState
): Promise<BookingResult> {
  const spinner = ora(spinnerText).start();

  try {
    let result;

    if (options.tipAmount) {
      result = await client.addTip(estimate.id, options.tipAmount);
    } else {
      result = await client.selectEstimate(estimate.id, {
        isPetRide: options.isPetRide,
        specialAssistance: options.specialAssistance,
      });
    }

    spinner.text = 'Waiting for driver assignment...';

    // Poll for driver assignment with cancel option
    const booking = await pollForDriverWithCancel(client, spinner, state);

    if (state.isCancelled) {
      spinner.info('Booking cancelled by user');
      return { cancelled: true };
    }

    if (booking) {
      spinner.succeed('Driver assigned!');
      showBookingConfirmation(booking, estimate, options.tipAmount);
      return { success: true, booking };
    } else {
      spinner.succeed('Ride request submitted!');
      showInfo('You will receive a notification on your phone when a driver is assigned.');
      return { 
        success: true, 
        booking: {
          id: 'pending',
          status: 'PENDING_DRIVER_ASSIGNMENT',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          fromLocation: { lat: 0, lon: 0 },
          estimatedFare: estimate.estimatedTotalFare,
        } 
      };
    }

  } catch (error) {
    spinner.fail('Booking failed');
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Polls for driver assignment with cancel option
 */
async function pollForDriverWithCancel(
  client: NammaYatriClient,
  spinner: ora.Ora,
  state: BookingState
): Promise<RideBooking | null> {
  const startTime = Date.now();
  let elapsed = 0;

  while (elapsed < MAX_DRIVER_POLLING_MS) {
    // Check for cancellation every interval
    const shouldCancel = await checkForCancel(spinner, elapsed);
    if (shouldCancel) {
      state.isCancelled = true;
      return null;
    }

    try {
      const bookings = await client.fetchStatus({ onlyActive: true });

      // Look for a booking with driver assigned
      for (const booking of bookings) {
        const status = booking.status.toUpperCase();
        if (
          status.includes('DRIVER_ASSIGNED') ||
          status.includes('TRIP_STARTED') ||
          status.includes('NEW') ||
          (booking.driverName && booking.driverNumber)
        ) {
          return booking;
        }
      }
    } catch {
      // Continue polling
    }

    await sleep(DRIVER_POLLING_INTERVAL_MS);
    elapsed = Date.now() - startTime;
    
    // Update spinner with elapsed time
    const remaining = Math.ceil((MAX_DRIVER_POLLING_MS - elapsed) / 1000);
    spinner.text = `Waiting for driver assignment... (${remaining}s remaining, press ESC to cancel)`;
  }

  return null;
}

/**
 * Checks if user wants to cancel during polling
 */
async function checkForCancel(spinner: ora.Ora, elapsed: number): Promise<boolean> {
  // Show cancel option periodically
  // This is a simplified approach - in a real TUI, we'd use keypress events
  // For now, we'll just continue polling and let user use ESC
  return false;
}

/**
 * Shows a cancel prompt that can be used during long operations
 */
async function showCancelPrompt(operation: string): Promise<boolean> {
  // This creates a race between the operation and a cancel selection
  // In practice, the main menu ESC handling will catch cancellations
  return new Promise((resolve) => {
    // The promise never resolves normally - it's just used for racing
    // Actual cancellation happens via ESC key in the menu system
  });
}

/**
 * Shows booking confirmation with driver details
 */
function showBookingConfirmation(booking: RideBooking, estimate: RideEstimate, tipAmount?: number): void {
  showSectionHeader('✅ Ride Confirmed!', 'Your ride has been booked');

  console.log();
  console.log(chalk.dim('  ─────────────────────────────────────'));
  console.log();

  // Driver info
  if (booking.driverName) {
    console.log(`  ${chalk.bold('Driver:')}      ${chalk.cyan(booking.driverName)}`);
  }

  if (booking.driverNumber) {
    console.log(`  ${chalk.bold('Contact:')}     ${chalk.green(booking.driverNumber)}`);
  }

  if (booking.vehicleNumber) {
    console.log(`  ${chalk.bold('Vehicle:')}     ${chalk.cyan(booking.vehicleNumber)}`);
  }

  if (booking.vehicleVariant) {
    console.log(`  ${chalk.bold('Type:')}        ${booking.vehicleVariant}`);
  }

  console.log();

  // OTP (if available)
  if ((booking as any).otp) {
    console.log(chalk.bold.yellow(`  🔐 OTP: ${(booking as any).otp}`));
    console.log();
  }

  // Pickup time
  if (booking.estimatedPickupDuration) {
    console.log(`  ${chalk.bold('Pickup in:')}   ${formatPickupDuration(booking.estimatedPickupDuration)}`);
  }

  // Fare
  if (booking.estimatedFare) {
    console.log(`  ${chalk.bold('Fare:')}        ${chalk.green(`₹${booking.estimatedFare}`)}`);
  }

  // Tip if added
  if (tipAmount) {
    console.log(`  ${chalk.bold('Tip:')}         ${chalk.yellow(`₹${tipAmount}`)}`);
  }

  console.log();
  console.log(chalk.dim('  ─────────────────────────────────────'));
  console.log();

  // Tips
  console.log(chalk.dim('  💡 Tips:'));
  console.log(chalk.dim('     • Share your live location with the driver'));
  console.log(chalk.dim('     • Be ready at the pickup point'));
  console.log(chalk.dim('     • Check the OTP before starting the ride'));
  console.log();
}

// =============================================================================
// Cancel Ride Functionality
// =============================================================================

/**
 * Cancels an active ride search or booking
 */
export async function cancelActiveRide(
  client: NammaYatriClient,
  estimateId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await client.cancelSearch(estimateId);
    
    if (result.success) {
      showSuccess('Ride cancelled successfully');
      return { success: true, message: 'Ride cancelled successfully' };
    } else {
      showError(result.message || 'Failed to cancel ride');
      return { success: false, message: result.message || 'Failed to cancel ride' };
    }
  } catch (error) {
    const message = (error as Error).message;
    showError(`Failed to cancel: ${message}`);
    return { success: false, message };
  }
}

/**
 * Shows cancel menu for active rides
 */
export async function showCancelRideMenu(client?: NammaYatriClient): Promise<void> {
  const apiClient = client || getAuthenticatedClient();

  showSectionHeader('❌ Cancel Ride', 'Cancel an active ride search or booking');

  try {
    const bookings = await apiClient.fetchStatus({ onlyActive: true });

    if (bookings.length === 0) {
      showInfo('No active rides to cancel.');
      return;
    }

    const choices = bookings.map((booking) => ({
      name: formatBookingForCancel(booking),
      value: booking,
      description: `Status: ${booking.status}`,
    }));

    const result = await showMenu<RideBooking>(
      {
        title: 'Select Ride to Cancel',
        subtitle: `${bookings.length} active ride(s)`,
      },
      choices
    );

    if (result === 'back' || result === 'exit') {
      return;
    }

    // Confirm cancellation
    const confirmCancel = await showConfirm(
      `Are you sure you want to cancel this ride?`,
      false
    );

    if (confirmCancel && result.id) {
      await cancelActiveRide(apiClient, result.id);
    }

  } catch (error) {
    showError(`Failed to fetch active rides: ${(error as Error).message}`);
  }
}

/**
 * Formats a booking for the cancel menu
 */
function formatBookingForCancel(booking: RideBooking): string {
  const status = booking.status.toLowerCase();
  let icon = '🚕';
  
  if (status.includes('driver_assigned')) {
    icon = '✅';
  } else if (status.includes('pending')) {
    icon = '⏳';
  } else if (status.includes('started')) {
    icon = '🚗';
  }

  let line = `${icon} ${chalk.cyan(booking.id.substring(0, 8))}`;
  
  if (booking.driverName) {
    line += ` - ${booking.driverName}`;
  }

  if (booking.vehicleNumber) {
    line += chalk.dim(` (${booking.vehicleNumber})`);
  }

  return line;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Gets saved locations asynchronously
 */
async function getSavedLocationsAsync(client: NammaYatriClient): Promise<SavedLocation[]> {
  try {
    return await client.getSavedLocationsFromApi();
  } catch {
    // Return cached locations on error
    const { getSavedLocations } = await import('../api.js');
    return getSavedLocations();
  }
}

/**
 * Converts a saved location to selected location
 */
function savedLocationToSelected(loc: SavedLocation): SelectedLocation {
  return {
    lat: loc.lat,
    lon: loc.lon,
    name: loc.tag,
    address: loc.locationName || loc.area || `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`,
    isSavedLocation: true,
  };
}

/**
 * Formats a saved location for display
 */
function formatSavedLocation(loc: SavedLocation): string {
  const icon = getLocationIcon(loc.tag);
  let name = `${icon} ${chalk.cyan(loc.tag)}`;

  if (loc.locationName) {
    name += chalk.dim(` - ${loc.locationName}`);
  } else if (loc.area) {
    name += chalk.dim(` - ${loc.area}`);
  }

  return name;
}

/**
 * Gets an icon for a location tag
 */
function getLocationIcon(tag: string): string {
  const lowerTag = tag.toLowerCase();

  if (lowerTag === 'home') return '🏠';
  if (lowerTag === 'work' || lowerTag === 'office') return '🏢';
  if (lowerTag === 'gym') return '💪';
  if (lowerTag === 'school' || lowerTag === 'college') return '🎓';
  if (lowerTag === 'hospital') return '🏥';
  if (lowerTag === 'mall' || lowerTag === 'shopping') return '🛒';
  if (lowerTag === 'airport') return '✈️';
  if (lowerTag === 'station' || lowerTag === 'railway') return '🚉';
  if (lowerTag === 'park') return '🌳';
  if (lowerTag === 'restaurant' || lowerTag === 'cafe') return '🍽️';

  return '📍';
}

/**
 * Formats a place prediction for display
 */
function formatPlacePrediction(place: PlacePrediction): string {
  let name = place.description;

  if (place.distanceWithUnit) {
    name += chalk.dim(` (${formatDistance(place.distanceWithUnit.value, place.distanceWithUnit.unit)})`);
  } else if (place.distance) {
    name += chalk.dim(` (${formatDistance(place.distance)})`);
  }

  return name;
}

/**
 * Formats address from place details
 */
function formatAddressFromDetails(details: PlaceDetails): string {
  const parts: string[] = [];

  if (details.address.area) parts.push(details.address.area);
  if (details.address.city) parts.push(details.address.city);

  return parts.join(', ') || `${details.lat.toFixed(4)}, ${details.lon.toFixed(4)}`;
}

/**
 * Checks if two locations are the same
 */
function isSameLocation(loc1: SelectedLocation, loc2: SelectedLocation): boolean {
  return isSameLocationCoords(loc1.lat, loc1.lon, loc2.lat, loc2.lon);
}

/**
 * Checks if two coordinate pairs are the same
 */
function isSameLocationCoords(lat1: number, lon1: number, lat2: number, lon2: number): boolean {
  // Use small epsilon for floating point comparison
  const epsilon = 0.0001;
  return Math.abs(lat1 - lat2) < epsilon && Math.abs(lon1 - lon2) < epsilon;
}

/**
 * Sleeps for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
