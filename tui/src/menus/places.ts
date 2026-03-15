/**
 * Places Menu for Namma Yatri TUI
 * 
 * Entry point for place search functionality.
 * Delegates to the beautiful places UI component.
 */

import {
  showSectionHeader,
  showError,
  chalk,
} from '../ui/menu.js';
import { placesSearchMenu, selectPlaceForBooking } from '../ui/places.js';
import { isAuthenticated } from '../api.js';

/**
 * Places menu entry point
 * 
 * Provides a beautiful place search experience with:
 * - Input for search text
 * - Arrow key navigation through results
 * - Place details view with coordinates and address
 * - Option to use selected place for ride booking
 * - ESC to return to main menu
 */
export async function placesMenu(): Promise<void> {
  // Check authentication
  if (!isAuthenticated()) {
    showSectionHeader('🔍 Search Places', 'Authentication required');
    console.log(chalk.yellow('  ⚠ You need to authenticate first to search places.\n'));
    console.log(chalk.dim('  Please select "Authenticate" from the main menu.\n'));
    await waitForEnter();
    return;
  }

  try {
    await placesSearchMenu();
  } catch (error) {
    // Handle API errors
    if ((error as any).statusCode === 401) {
      showError('Authentication expired. Please authenticate again.');
      return;
    }
    
    showError(`Search failed: ${(error as Error).message}`);
  }
}

/**
 * Select a place for ride booking
 * 
 * Use this when integrating place search into the booking flow.
 * Returns null if user cancels.
 */
export async function selectPlace(
  type: 'pickup' | 'drop',
  sourceLocation?: { lat: number; lon: number }
): Promise<{ lat: number; lon: number; name: string } | null> {
  const place = await selectPlaceForBooking(type, sourceLocation);
  
  if (!place) {
    return null;
  }

  return {
    lat: place.lat,
    lon: place.lon,
    name: place.address.title || place.address.area || `${place.lat}, ${place.lon}`,
  };
}

/**
 * Waits for user to press Enter
 */
async function waitForEnter(): Promise<void> {
  const { input } = await import('@inquirer/prompts');
  await input({
    message: 'Press Enter to continue...',
  });
}

// Re-export the UI component for direct access
export { selectPlaceForBooking, placeSearchUI } from '../ui/places.js';