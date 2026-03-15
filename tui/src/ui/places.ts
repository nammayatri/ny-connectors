/**
 * Places Search UI for Namma Yatri TUI
 * 
 * A beautiful, interactive place search component with:
 * - Input for search text
 * - Arrow key navigation through results
 * - Place details view with coordinates and address
 * - Option to use selected place for ride booking
 * - ESC to return to previous menu
 */

import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import {
  searchPlaces,
  getPlaceDetails,
  PlacePrediction,
  PlaceDetails,
  formatDistance,
} from '../api.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of place selection
 */
export interface PlaceSelectionResult {
  type: 'selected';
  place: PlaceDetails;
  prediction: PlacePrediction;
}

/**
 * Result when user wants to use place for booking
 */
export interface PlaceBookingResult {
  type: 'use-for-origin' | 'use-for-destination';
  place: PlaceDetails;
  prediction: PlacePrediction;
}

/**
 * Navigation result type
 */
export type PlaceSearchResult = PlaceSelectionResult | PlaceBookingResult | 'back' | 'exit';

/**
 * Options for place search
 */
export interface PlaceSearchOptions {
  /** Title for the search screen */
  title?: string;
  /** Subtitle/hint text */
  subtitle?: string;
  /** Show "Use for booking" options */
  showBookingOptions?: boolean;
  /** Source location for proximity search */
  sourceLocation?: { lat: number; lon: number };
  /** Placeholder text for input */
  placeholder?: string;
}

// =============================================================================
// Place Search UI Component
// =============================================================================

/**
 * Main place search flow
 * 
 * 1. Prompts user for search text
 * 2. Shows autocomplete results with arrow navigation
 * 3. Displays place details on selection
 * 4. Offers options to use place for booking
 * 
 * @param options Configuration options
 * @returns PlaceSelectionResult, booking result, or navigation command
 */
export async function placeSearchUI(
  options: PlaceSearchOptions = {}
): Promise<PlaceSearchResult> {
  const {
    title = '🔍 Search Places',
    subtitle = 'Find locations by name or address',
    showBookingOptions = true,
    sourceLocation,
    placeholder = 'Enter place name or address',
  } = options;

  // Step 1: Get search text from user
  const searchText = await promptSearchText(title, subtitle, placeholder);

  if (searchText === null) {
    return 'back';
  }

  // Step 2: Search for places
  const places = await searchPlacesWithSpinner(searchText, sourceLocation);

  if (places.length === 0) {
    showNoResults(searchText);
    // Recursively call to try again
    return placeSearchUI(options);
  }

  // Step 3: Show results and let user select
  const selectedPlace = await showPlacesResults(places, title);

  if (selectedPlace === 'back' || selectedPlace === 'exit') {
    return selectedPlace;
  }

  // Step 4: Show place details and get next action
  return showPlaceDetailsWithActions(selectedPlace, showBookingOptions);
}

// =============================================================================
// Search Input
// =============================================================================

/**
 * Prompts user for search text with beautiful styling
 */
async function promptSearchText(
  title: string,
  subtitle: string,
  placeholder: string
): Promise<string | null> {
  showSectionHeader(title, subtitle);

  try {
    const result = await input({
      message: placeholder,
      validate: (value) => {
        const trimmed = value?.trim();
        if (!trimmed) {
          return 'Please enter a place name or address to search';
        }
        if (trimmed.length < 2) {
          return 'Please enter at least 2 characters';
        }
        return true;
      },
    });

    return result.trim();
  } catch (error) {
    // ESC pressed
    return null;
  }
}

// =============================================================================
// Search Results Display
// =============================================================================

/**
 * Shows search results with arrow navigation
 */
async function showPlacesResults(
  places: PlacePrediction[],
  title: string
): Promise<PlacePrediction | 'back' | 'exit'> {
  const resultsTitle = '📍 Search Results';
  const resultsSubtitle = `Found ${places.length} place${places.length !== 1 ? 's' : ''}`;

  showSectionHeader(resultsTitle, resultsSubtitle);

  // Build choices with formatted names and distance info
  const choices = places.map((place, index) => ({
    name: formatPlaceChoice(place, index),
    value: place,
    description: formatPlaceDescription(place),
  }));

  try {
    const result = await select<PlacePrediction | 'back' | 'exit'>({
      message: 'Select a place to view details',
      choices: [
        ...choices,
        {
          name: '↩️  Back to search',
          value: 'back',
          description: 'Search for a different place (or press ESC)',
        },
        {
          name: '❌ Exit',
          value: 'exit',
          description: 'Return to main menu',
        },
      ],
    });

    return result;
  } catch (error) {
    // ESC pressed - treat as back
    if (error instanceof Error && error.message === 'User cancelled') {
      return 'back';
    }
    throw error;
  }
}

/**
 * Formats a place choice for the select menu
 */
function formatPlaceChoice(place: PlacePrediction, index: number): string {
  // Truncate long descriptions
  const maxLen = 50;
  let description = place.description;
  
  if (description.length > maxLen) {
    description = description.substring(0, maxLen - 3) + '...';
  }

  // Add distance if available
  let distanceStr = '';
  if (place.distanceWithUnit) {
    const { value, unit } = place.distanceWithUnit;
    distanceStr = chalk.dim(` (${formatDistance(value, unit)})`);
  } else if (place.distance) {
    distanceStr = chalk.dim(` (${formatDistance(place.distance)})`);
  }

  return `${description}${distanceStr}`;
}

/**
 * Formats place description for the select menu
 */
function formatPlaceDescription(place: PlacePrediction): string {
  const parts: string[] = [];
  
  if (place.types && place.types.length > 0) {
    // Convert types to readable format
    const readableTypes = place.types
      .map(t => t.replace(/_/g, ' ').toLowerCase())
      .slice(0, 2);
    parts.push(readableTypes.join(', '));
  }
  
  parts.push(`ID: ${place.placeId.substring(0, 20)}...`);
  
  return parts.join(' | ');
}

// =============================================================================
// Place Details View
// =============================================================================

/**
 * Shows detailed information about a selected place
 */
async function showPlaceDetailsWithActions(
  prediction: PlacePrediction,
  showBookingOptions: boolean
): Promise<PlaceSearchResult> {
  // Fetch full details
  let details: PlaceDetails;
  
  try {
    details = await fetchPlaceDetailsWithSpinner(prediction.placeId);
  } catch (error) {
    showPlaceDetailsError(error as Error);
    return 'back';
  }

  // Display the details
  displayPlaceDetails(prediction, details);

  // Show action menu
  return showPlaceActionsMenu(prediction, details, showBookingOptions);
}

/**
 * Fetches place details with a loading spinner
 */
async function fetchPlaceDetailsWithSpinner(placeId: string): Promise<PlaceDetails> {
  const ora = (await import('ora')).default;
  const spinner = ora('Fetching place details...').start();

  try {
    const details = await getPlaceDetails(placeId);
    spinner.succeed('Place details loaded');
    return details;
  } catch (error) {
    spinner.fail('Failed to fetch place details');
    throw error;
  }
}

/**
 * Displays place details in a beautiful format
 */
function displayPlaceDetails(
  prediction: PlacePrediction,
  details: PlaceDetails
): void {
  showSectionHeader('📍 Place Details', prediction.description);

  // Coordinates section
  console.log(chalk.bold.cyan('  Coordinates'));
  console.log(chalk.dim('  ─────────────────────────────────────'));
  console.log(`  ${chalk.dim('Latitude:')}  ${chalk.white(details.lat.toFixed(6))}`);
  console.log(`  ${chalk.dim('Longitude:')} ${chalk.white(details.lon.toFixed(6))}`);
  console.log();

  // Address section
  console.log(chalk.bold.cyan('  Address'));
  console.log(chalk.dim('  ─────────────────────────────────────'));

  const address = details.address;
  
  if (address.title) {
    console.log(`  ${chalk.dim('Title:')}    ${chalk.white(address.title)}`);
  }
  
  if (address.building) {
    console.log(`  ${chalk.dim('Building:')}  ${chalk.white(address.building)}`);
  }
  
  if (address.street) {
    console.log(`  ${chalk.dim('Street:')}    ${chalk.white(address.street)}`);
  }
  
  if (address.area) {
    console.log(`  ${chalk.dim('Area:')}      ${chalk.white(address.area)}`);
  }
  
  if (address.ward) {
    console.log(`  ${chalk.dim('Ward:')}      ${chalk.white(address.ward)}`);
  }
  
  if (address.city) {
    console.log(`  ${chalk.dim('City:')}      ${chalk.white(address.city)}`);
  }
  
  if (address.state) {
    console.log(`  ${chalk.dim('State:')}     ${chalk.white(address.state)}`);
  }
  
  if (address.country) {
    console.log(`  ${chalk.dim('Country:')}   ${chalk.white(address.country)}`);
  }
  
  if (address.areaCode) {
    console.log(`  ${chalk.dim('PIN Code:')}  ${chalk.white(address.areaCode)}`);
  }

  // Full address
  const fullAddress = buildFullAddress(address);
  if (fullAddress) {
    console.log();
    console.log(`  ${chalk.dim('Full Address:')}`);
    console.log(`  ${chalk.white(fullAddress)}`);
  }

  // Place ID
  console.log();
  console.log(chalk.dim('  ─────────────────────────────────────'));
  console.log(`  ${chalk.dim('Place ID:')} ${chalk.dim.italic(details.placeId)}`);
  console.log();
}

/**
 * Builds a full address string from address components
 */
function buildFullAddress(address: Address): string {
  const parts: string[] = [];
  
  if (address.building) parts.push(address.building);
  if (address.street) parts.push(address.street);
  if (address.area) parts.push(address.area);
  if (address.ward) parts.push(address.ward);
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.areaCode) parts.push(address.areaCode);
  
  return parts.join(', ');
}

/**
 * Shows the action menu after viewing place details
 */
async function showPlaceActionsMenu(
  prediction: PlacePrediction,
  details: PlaceDetails,
  showBookingOptions: boolean
): Promise<PlaceSearchResult> {
  const choices: Array<{
    name: string;
    value: PlaceSearchResult;
    description: string;
  }> = [];

  // Booking options
  if (showBookingOptions) {
    choices.push({
      name: '🟢 Use as Pickup Location',
      value: { type: 'use-for-origin', place: details, prediction },
      description: 'Set this place as the origin for ride booking',
    });

    choices.push({
      name: '🔴 Use as Drop Location',
      value: { type: 'use-for-destination', place: details, prediction },
      description: 'Set this place as the destination for ride booking',
    });
  }

  // Navigation options
  choices.push({
    name: '🔍 Search Again',
    value: 'back',
    description: 'Search for a different place',
  });

  choices.push({
    name: '↩️  Back to Menu',
    value: 'exit',
    description: 'Return to the main menu',
  });

  try {
    const result = await select<PlaceSearchResult>({
      message: 'What would you like to do?',
      choices,
    });

    return result;
  } catch (error) {
    // ESC pressed
    if (error instanceof Error && error.message === 'User cancelled') {
      return 'back';
    }
    throw error;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Shows a section header with consistent styling
 */
function showSectionHeader(title: string, subtitle?: string): void {
  console.log();
  console.log(chalk.bold.cyan(`  ${title}`));
  
  if (subtitle) {
    console.log(chalk.dim(`  ${subtitle}`));
  }
  
  console.log(chalk.dim('  ' + '─'.repeat(45)));
  console.log();
}

/**
 * Searches for places with a loading spinner
 */
async function searchPlacesWithSpinner(
  searchText: string,
  sourceLocation?: { lat: number; lon: number }
): Promise<PlacePrediction[]> {
  const ora = (await import('ora')).default;
  const spinner = ora('Searching for places...').start();

  try {
    const places = await searchPlaces(searchText);
    spinner.succeed(`Found ${places.length} place${places.length !== 1 ? 's' : ''}`);
    return places;
  } catch (error) {
    spinner.fail('Search failed');
    throw error;
  }
}

/**
 * Shows no results message
 */
function showNoResults(searchText: string): void {
  console.log();
  console.log(chalk.yellow('  No places found'));
  console.log(chalk.dim(`  No results for "${searchText}"`));
  console.log(chalk.dim('  Try a different search term.'));
  console.log();
}

/**
 * Shows error message for place details fetch
 */
function showPlaceDetailsError(error: Error): void {
  console.log();
  console.log(chalk.red('  Failed to fetch place details'));
  console.log(chalk.dim(`  ${error.message}`));
  console.log();
}

// =============================================================================
// Standalone Place Search Menu
// =============================================================================

/**
 * Standalone place search menu that loops until user exits
 * This is the entry point for the "Search Places" main menu option
 */
export async function placesSearchMenu(): Promise<void> {
  while (true) {
    const result = await placeSearchUI({
      title: '🔍 Search Places',
      subtitle: 'Find locations by name or address',
      showBookingOptions: true,
    });

    if (result === 'back') {
      // Continue the loop - search again
      continue;
    }

    if (result === 'exit') {
      return;
    }

    // Handle booking options
    if (result.type === 'use-for-origin') {
      console.log();
      console.log(chalk.green('  ✓ Pickup location set!'));
      console.log(chalk.dim(`  ${result.prediction.description}`));
      console.log();
      console.log(chalk.dim('  To book a ride, go to "Book a Ride" from the main menu.'));
      console.log();
      
      // Wait for user acknowledgment
      await waitForEnter();
      return;
    }

    if (result.type === 'use-for-destination') {
      console.log();
      console.log(chalk.green('  ✓ Drop location set!'));
      console.log(chalk.dim(`  ${result.prediction.description}`));
      console.log();
      console.log(chalk.dim('  To book a ride, go to "Book a Ride" from the main menu.'));
      console.log();
      
      // Wait for user acknowledgment
      await waitForEnter();
      return;
    }
  }
}

/**
 * Waits for user to press Enter
 */
async function waitForEnter(): Promise<void> {
  await input({
    message: 'Press Enter to continue...',
  });
}

// =============================================================================
// Export for Integration with Ride Booking
// =============================================================================

/**
 * Place selector for ride booking flow
 * 
 * Use this when you need to select a place as part of the booking process.
 * Returns the selected place details or null if cancelled.
 */
export async function selectPlaceForBooking(
  type: 'pickup' | 'drop',
  sourceLocation?: { lat: number; lon: number }
): Promise<PlaceDetails | null> {
  const icon = type === 'pickup' ? '🟢' : '🔴';
  const label = type === 'pickup' ? 'Pickup' : 'Drop';

  const result = await placeSearchUI({
    title: `${icon} Select ${label} Location`,
    subtitle: 'Search for a place by name or address',
    showBookingOptions: false,
    sourceLocation,
    placeholder: `Enter ${label.toLowerCase()} location`,
  });

  if (result === 'back' || result === 'exit') {
    return null;
  }

  return result.place;
}

// =============================================================================
// Address Type (re-export for convenience)
// =============================================================================

export interface Address {
  area?: string;
  areaCode?: string;
  building?: string;
  city?: string;
  country?: string;
  door?: string;
  extras?: string;
  instructions?: string;
  placeId?: string;
  state?: string;
  street?: string;
  title?: string;
  ward?: string;
}