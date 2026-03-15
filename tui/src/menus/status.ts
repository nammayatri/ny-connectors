/**
 * Status Menu for Namma Yatri TUI
 * 
 * Check active and past rides using the status UI components.
 */

import {
  showSectionHeader,
  showMenu,
  showConfirm,
  showSuccess,
  showError,
  showInfo,
  withSpinner,
  chalk,
} from '../ui/menu.js';
import {
  selectStatusFilter,
  selectRide,
  displayRideDetailsCard,
  displayRidesTable,
  formatRideListItem,
  isActiveRide,
  formatDateTime,
  formatDistance,
  getStatusIcon,
  getStatusColor,
} from '../ui/status.js';
import { fetchStatus, cancelSearch, RideBooking } from '../api.js';

/**
 * Status menu entry point
 */
export async function statusMenu(): Promise<void> {
  while (true) {
    showSectionHeader('📋 Ride Status', 'Check your active and past rides');

    // Let user select filter
    const filterChoice = await selectStatusFilter();

    if (filterChoice === 'back') {
      return;
    }

    try {
      const rides = await withSpinner('Fetching ride status...', () =>
        fetchStatus(filterChoice === 'active', 20)
      );

      if (rides.length === 0) {
        showInfo(filterChoice === 'active' 
          ? 'No active rides found.' 
          : 'No rides found.');
        
        // Wait for user to continue
        await showConfirm('Press Enter to continue...', true);
        continue;
      }

      // Show rides count
      console.log();
      console.log(chalk.dim(`  Found ${rides.length} ${filterChoice === 'active' ? 'active' : ''} ride(s)`));
      console.log();

      // Show rides list and let user select
      const selectedRide = await selectRide(
        rides,
        'Select a ride to view details'
      );

      if (!selectedRide) {
        return;
      }

      // Show ride details
      await showRideDetails(selectedRide);

    } catch (error) {
      showError(`Failed to fetch rides: ${(error as Error).message}`);
      
      if ((error as any).statusCode === 401) {
        return;
      }
      
      // Wait for user to continue
      await showConfirm('Press Enter to continue...', true);
    }
  }
}

/**
 * Shows details for a selected ride
 */
async function showRideDetails(ride: RideBooking): Promise<void> {
  showSectionHeader('📋 Ride Details', ride.id);

  // Display the details card
  console.log(displayRideDetailsCard(ride));
  console.log();

  // Offer cancel option for active rides
  if (isActiveRide(ride.status)) {
    const wantCancel = await showConfirm(
      'Would you like to cancel this ride search?',
      false
    );

    if (wantCancel) {
      try {
        await withSpinner('Cancelling ride...', () => cancelSearch(ride.id));
        showSuccess('Ride cancelled successfully.');
      } catch (error) {
        showError(`Failed to cancel ride: ${(error as Error).message}`);
      }
    }
  } else {
    // For completed/cancelled rides, just wait for user to continue
    await showConfirm('Press Enter to continue...', true);
  }
}

/**
 * Shows a quick status overview (for main menu display)
 */
export async function showQuickStatus(): Promise<void> {
  try {
    const rides = await fetchStatus(true, 5);
    
    if (rides.length === 0) {
      console.log(chalk.dim('  No active rides'));
      return;
    }
    
    console.log(chalk.bold('  Active Rides:'));
    rides.forEach(ride => {
      const icon = getStatusIcon(ride.status);
      const statusColor = getStatusColor(ride.status);
      console.log(`    ${icon} ${statusColor(ride.status)} - ${ride.driverName || 'Searching...'}`);
    });
  } catch {
    console.log(chalk.dim('  Unable to fetch ride status'));
  }
}