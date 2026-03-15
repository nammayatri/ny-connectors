/**
 * Search Menu for Namma Yatri TUI
 * 
 * Search and book rides between locations.
 * Uses the comprehensive ride booking flow from ui/ride.ts
 */

import {
  showSectionHeader,
  showMenu,
  showSuccess,
  showError,
  showInfo,
  chalk,
} from '../ui/menu.js';
import { runRideBookingFlow, BookingResult } from '../ui/ride.js';
import { getAuthenticatedClient, isAuthenticated } from '../api.js';

/**
 * Search menu entry point
 */
export async function searchMenu(): Promise<void> {
  // Check authentication
  if (!isAuthenticated()) {
    showSectionHeader('🚗 Book a Ride', 'Authentication required');
    console.log(chalk.yellow('  ⚠ You need to authenticate first to book rides.\n'));
    
    const { showConfirm } = await import('../ui/menu.js');
    const shouldAuth = await showConfirm('Would you like to authenticate now?', true);
    
    if (shouldAuth) {
      const { doAuth } = await import('../auth.js');
      await doAuth();
      
      if (!isAuthenticated()) {
        return;
      }
    } else {
      return;
    }
  }

  // Run the booking flow
  while (true) {
    try {
      const result = await runRideBookingFlow();

      if ('cancelled' in result && result.cancelled) {
        // User cancelled - return to main menu
        return;
      }

      if ('success' in result) {
        if (result.success) {
          // Booking successful - ask if they want to book another
          showSuccess('Ride booking completed!');
          
          const { showConfirm } = await import('../ui/menu.js');
          const bookAnother = await showConfirm('Would you like to book another ride?', false);
          
          if (!bookAnother) {
            return;
          }
          // Continue loop for another booking
        } else {
          // Booking failed
          showError(`Booking failed: ${result.error}`);
          
          const { showConfirm } = await import('../ui/menu.js');
          const retry = await showConfirm('Would you like to try again?', true);
          
          if (!retry) {
            return;
          }
          // Continue loop to retry
        }
      }

    } catch (error) {
      if (error instanceof Error && error.message === 'User cancelled') {
        return;
      }
      
      showError(`An error occurred: ${(error as Error).message}`);
      
      const { showConfirm } = await import('../ui/menu.js');
      const retry = await showConfirm('Would you like to try again?', true);
      
      if (!retry) {
        return;
      }
    }
  }
}

/**
 * Quick ride booking - skips menu and goes directly to booking flow
 */
export async function quickBook(): Promise<void> {
  await searchMenu();
}