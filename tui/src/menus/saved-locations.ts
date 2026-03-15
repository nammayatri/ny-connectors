/**
 * Saved Locations Menu for Namma Yatri TUI
 * 
 * View and manage saved locations (Home, Work, etc.) using the saved-locations UI components.
 */

import {
  showSectionHeader,
  showMenu,
  showSuccess,
  showError,
  showInfo,
  showConfirm,
  withSpinner,
  chalk,
} from '../ui/menu.js';
import {
  selectLocation,
  selectLocationAction,
  selectLocationForRide,
  displayLocationDetailsCard,
  displayLocationsTable,
  displayLocationSummary,
  formatAddressFull,
  formatCoordinates,
  getLocationIcon,
  getLocationColor,
  sortLocationsByName,
} from '../ui/saved-locations.js';
import { fetchSavedLocations, SavedLocation } from '../api.js';
import { updateSavedLocations } from '../auth.js';

/**
 * Saved locations menu entry point
 */
export async function savedLocationsMenu(): Promise<void> {
  while (true) {
    showSectionHeader('⭐ Saved Locations', 'Your saved places (Home, Work, etc.)');

    try {
      const locations = await withSpinner('Fetching saved locations...', () =>
        fetchSavedLocations()
      );

      // Update local cache
      updateSavedLocations(locations);

      if (locations.length === 0) {
        showInfo('No saved locations found.');
        console.log(chalk.dim('  Add locations in the Namma Yatri app to see them here.'));
        console.log();
        console.log(chalk.dim('  💡 Tip: You can save frequently visited places like'));
        console.log(chalk.dim('     Home, Work, Gym, etc. in the Namma Yatri app.'));
        console.log();

        // Wait for user to continue
        await showConfirm('Press Enter to continue...', true);
        return;
      }

      // Sort locations by name
      const sortedLocations = sortLocationsByName(locations);

      // Show count
      console.log();
      console.log(chalk.dim(`  Found ${sortedLocations.length} saved location(s)`));
      console.log();

      // Show location selection
      const selectedLocation = await selectLocation(
        sortedLocations,
        'Select a location to view details'
      );

      if (!selectedLocation) {
        return;
      }

      // Handle location selection
      await handleLocationSelection(selectedLocation, sortedLocations);

    } catch (error) {
      showError(`Failed to fetch saved locations: ${(error as Error).message}`);

      if ((error as any).statusCode === 401) {
        return;
      }

      // Wait for user to continue
      await showConfirm('Press Enter to continue...', true);
    }
  }
}

/**
 * Handles location selection
 */
async function handleLocationSelection(
  location: SavedLocation,
  allLocations: SavedLocation[]
): Promise<void> {
  while (true) {
    // Show location details
    showSectionHeader('📍 Location Details', location.tag);
    console.log(displayLocationDetailsCard(location));
    console.log();

    // Show action options
    const action = await selectLocationAction(location);

    if (action === 'back') {
      return;
    }

    if (action === 'view') {
      // Already showing details, just continue
      continue;
    }

    if (action === 'use') {
      // Show usage options
      const useAction = await showMenu<string>(
        {
          title: 'Use Location',
          subtitle: `${getLocationIcon(location.tag)} ${getLocationColor(location.tag)(location.tag)}`,
        },
        [
          {
            name: '🚶 Set as pickup location',
            value: 'pickup',
            description: 'Use this location as the starting point for your ride',
          },
          {
            name: '🏁 Set as drop location',
            value: 'drop',
            description: 'Use this location as the destination for your ride',
          },
        ]
      );

      if (useAction === 'back' || useAction === 'exit') {
        continue;
      }

      // Store the selected location for ride booking
      if (useAction === 'pickup' || useAction === 'drop') {
        showSuccess(`${location.tag} set as ${useAction} location!`);
        console.log();
        console.log(chalk.dim(`  Coordinates: ${formatCoordinates(location.lat, location.lon)}`));
        if (location.area || location.city) {
          console.log(chalk.dim(`  Address: ${formatAddressFull(location)}`));
        }
        console.log();
        console.log(chalk.dim('  💡 Go to "Book a Ride" to complete your booking.'));
        console.log();
        await showConfirm('Press Enter to continue...', true);
        return;
      }
    }
  }
}

/**
 * Shows a quick locations overview (for main menu display)
 */
export async function showQuickLocations(): Promise<void> {
  try {
    const { getSavedLocations } = await import('../auth.js');
    const locations = getSavedLocations();

    if (locations.length === 0) {
      console.log(chalk.dim('  No saved locations'));
      return;
    }

    console.log(chalk.bold('  Saved Locations:'));
    locations.slice(0, 3).forEach(loc => {
      const icon = getLocationIcon(loc.tag);
      const color = getLocationColor(loc.tag);
      console.log(`    ${icon} ${color(loc.tag)} - ${loc.area || loc.city || 'Unknown'}`);
    });

    if (locations.length > 3) {
      console.log(chalk.dim(`    ... and ${locations.length - 3} more`));
    }
  } catch {
    console.log(chalk.dim('  Unable to load saved locations'));
  }
}

/**
 * Gets a saved location by tag for ride booking
 */
export async function getSavedLocationForRide(
  tag: string
): Promise<SavedLocation | null> {
  const { getSavedLocations } = await import('../auth.js');
  const locations = getSavedLocations();
  
  const lowerTag = tag.toLowerCase();
  const location = locations.find(loc => loc.tag.toLowerCase() === lowerTag);
  
  return location || null;
}

/**
 * Shows a location picker for ride booking
 */
export async function pickLocationForRide(
  rideType: 'pickup' | 'drop'
): Promise<SavedLocation | null> {
  const { getSavedLocations } = await import('../auth.js');
  const locations = getSavedLocations();

  if (locations.length === 0) {
    return null;
  }

  return selectLocationForRide(locations, rideType);
}