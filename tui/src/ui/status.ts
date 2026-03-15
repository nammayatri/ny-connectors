/**
 * Status UI Components for Namma Yatri TUI
 * 
 * Reusable components for displaying ride status and booking history.
 * Used by menus/status.ts for rendering ride information.
 */

import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import type { RideBooking } from '../api.js';

// =============================================================================
// Types
// =============================================================================

export interface StatusFilter {
  label: string;
  value: 'active' | 'all';
  icon: string;
  description: string;
}

export interface RideDisplayOptions {
  showDate?: boolean;
  showFare?: boolean;
  showDriver?: boolean;
  compact?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

export const STATUS_FILTERS: StatusFilter[] = [
  {
    label: 'Active rides',
    value: 'active',
    icon: '🚕',
    description: 'Rides currently in progress or searching for driver',
  },
  {
    label: 'All rides',
    value: 'all',
    icon: '📜',
    description: 'Show all rides including completed and cancelled',
  },
];

// Status color mapping
const STATUS_COLORS: Record<string, (text: string) => string> = {
  // Active states
  NEW: chalk.yellow.bold,
  CONFIRMED: chalk.yellow,
  DRIVER_ASSIGNED: chalk.cyan,
  TRIP_STARTED: chalk.green,
  WAITING_FOR_DRIVER: chalk.yellow,
  IN_PROGRESS: chalk.green.bold,
  
  // Completed states
  COMPLETED: chalk.green.dim,
  RIDE_COMPLETED: chalk.green.dim,
  
  // Cancelled states
  CANCELLED: chalk.red.dim,
  RIDE_CANCELLED: chalk.red.dim,
};

// Status icons
const STATUS_ICONS: Record<string, string> = {
  NEW: '🔍',
  CONFIRMED: '✓',
  DRIVER_ASSIGNED: '🚗',
  TRIP_STARTED: '🚕',
  WAITING_FOR_DRIVER: '⏳',
  IN_PROGRESS: '🚕',
  COMPLETED: '✅',
  RIDE_COMPLETED: '✅',
  CANCELLED: '❌',
  RIDE_CANCELLED: '❌',
};

// =============================================================================
// Status Color Functions
// =============================================================================

/**
 * Gets the color function for a ride status
 */
export function getStatusColor(status: string): (text: string) => string {
  const upperStatus = status.toUpperCase().replace(/ /g, '_');
  return STATUS_COLORS[upperStatus] || chalk.dim;
}

/**
 * Gets the icon for a ride status
 */
export function getStatusIcon(status: string): string {
  const upperStatus = status.toUpperCase().replace(/ /g, '_');
  return STATUS_ICONS[upperStatus] || '📋';
}

/**
 * Checks if a ride is currently active
 */
export function isActiveRide(status: string): boolean {
  const upperStatus = status.toUpperCase().replace(/ /g, '_');
  return [
    'NEW',
    'CONFIRMED',
    'DRIVER_ASSIGNED',
    'TRIP_STARTED',
    'WAITING_FOR_DRIVER',
    'IN_PROGRESS',
  ].includes(upperStatus);
}

/**
 * Checks if a ride is completed
 */
export function isCompletedRide(status: string): boolean {
  const upperStatus = status.toUpperCase().replace(/ /g, '_');
  return ['COMPLETED', 'RIDE_COMPLETED'].includes(upperStatus);
}

/**
 * Checks if a ride is cancelled
 */
export function isCancelledRide(status: string): boolean {
  const upperStatus = status.toUpperCase().replace(/ /g, '_');
  return ['CANCELLED', 'RIDE_CANCELLED'].includes(upperStatus);
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Formats a ride for display in a list
 */
export function formatRideListItem(
  ride: RideBooking,
  options: RideDisplayOptions = {}
): string {
  const { showDate = true, showFare = true, showDriver = true } = options;
  
  const icon = getStatusIcon(ride.status);
  const statusColor = getStatusColor(ride.status);
  
  let name = `${icon} ${statusColor(ride.status)}`;
  
  // Add driver name if available
  if (showDriver && ride.driverName) {
    name += ` - ${chalk.cyan(ride.driverName)}`;
  }
  
  // Add vehicle number if available
  if (ride.vehicleNumber) {
    name += chalk.dim(` (${ride.vehicleNumber})`);
  }
  
  // Add fare if available
  if (showFare && ride.estimatedFare) {
    name += chalk.green(` ₹${ride.estimatedFare}`);
  }
  
  // Add date for non-active rides
  if (showDate && !isActiveRide(ride.status) && ride.createdAt) {
    const date = formatDate(ride.createdAt);
    name += chalk.dim(` | ${date}`);
  }
  
  return name;
}

/**
 * Formats a timestamp for display
 */
export function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    // Today - show time
    return `Today ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays === 1) {
    return `Yesterday ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

/**
 * Formats a full date and time
 */
export function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats distance in km
 */
export function formatDistance(meters: number | undefined): string {
  if (!meters) return 'N/A';
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Formats duration in minutes
 */
export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return 'N/A';
  const mins = Math.round(seconds / 60);
  if (mins < 60) {
    return `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

// =============================================================================
// Display Components
// =============================================================================

/**
 * Displays a ride status badge
 */
export function displayStatusBadge(status: string): string {
  const icon = getStatusIcon(status);
  const color = getStatusColor(status);
  return `  ${icon} ${color(status)}`;
}

/**
 * Displays a ride details card
 */
export function displayRideDetailsCard(ride: RideBooking): string {
  const lines: string[] = [];
  
  // Header with status
  const statusBadge = displayStatusBadge(ride.status);
  lines.push(chalk.dim('  ┌─────────────────────────────────────────┐'));
  lines.push(`  │ ${chalk.bold('RIDE DETAILS')}${' '.repeat(27)}│`);
  lines.push(chalk.dim('  ├─────────────────────────────────────────┤'));
  
  // Booking ID
  lines.push(`  │ ${chalk.dim('Booking ID:')} ${ride.id.slice(0, 24)}... │`);
  
  // Status
  lines.push(`  │ ${chalk.dim('Status:')}     ${statusBadge}${' '.repeat(Math.max(0, 20 - ride.status.length))}│`);
  
  // Timestamps
  if (ride.createdAt) {
    lines.push(`  │ ${chalk.dim('Created:')}    ${formatDateTime(ride.createdAt).slice(0, 20)}${' '.repeat(Math.max(0, 20 - formatDateTime(ride.createdAt).length))}│`);
  }
  
  if (ride.rideStartTime) {
    lines.push(`  │ ${chalk.dim('Started:')}    ${formatDateTime(ride.rideStartTime).slice(0, 20)}${' '.repeat(Math.max(0, 20 - formatDateTime(ride.rideStartTime).length))}│`);
  }
  
  if (ride.rideEndTime) {
    lines.push(`  │ ${chalk.dim('Ended:')}      ${formatDateTime(ride.rideEndTime).slice(0, 20)}${' '.repeat(Math.max(0, 20 - formatDateTime(ride.rideEndTime).length))}│`);
  }
  
  lines.push(chalk.dim('  ├─────────────────────────────────────────┤'));
  
  // Fare
  if (ride.estimatedFare) {
    lines.push(`  │ ${chalk.dim('Fare:')}       ${chalk.green.bold(`₹${ride.estimatedFare}`)}${' '.repeat(32 - String(ride.estimatedFare).length)}│`);
  }
  
  // Distance
  if (ride.tripDistance) {
    lines.push(`  │ ${chalk.dim('Distance:')}   ${formatDistance(ride.tripDistance)}${' '.repeat(31 - formatDistance(ride.tripDistance).length)}│`);
  }
  
  lines.push(chalk.dim('  ├─────────────────────────────────────────┤'));
  
  // Driver info
  if (ride.driverName) {
    lines.push(`  │ ${chalk.dim('Driver:')}     ${chalk.cyan(ride.driverName)}${' '.repeat(30 - ride.driverName.length)}│`);
  }
  
  if (ride.driverNumber) {
    lines.push(`  │ ${chalk.dim('Contact:')}    ${ride.driverNumber}${' '.repeat(30 - ride.driverNumber.length)}│`);
  }
  
  if (ride.vehicleNumber) {
    lines.push(`  │ ${chalk.dim('Vehicle:')}    ${chalk.cyan(ride.vehicleNumber)}${' '.repeat(30 - ride.vehicleNumber.length)}│`);
  }
  
  if (ride.vehicleVariant) {
    lines.push(`  │ ${chalk.dim('Type:')}       ${ride.vehicleVariant}${' '.repeat(31 - ride.vehicleVariant.length)}│`);
  }
  
  lines.push(chalk.dim('  ├─────────────────────────────────────────┤'));
  
  // Locations
  if (ride.fromLocation) {
    const fromArea = ride.fromLocation.area || ride.fromLocation.city || 'Unknown';
    lines.push(`  │ ${chalk.dim('From:')}       ${fromArea.slice(0, 30)}${' '.repeat(Math.max(0, 30 - fromArea.length))}│`);
  }
  
  if (ride.toLocation) {
    const toArea = ride.toLocation.area || ride.toLocation.city || 'Unknown';
    lines.push(`  │ ${chalk.dim('To:')}         ${toArea.slice(0, 30)}${' '.repeat(Math.max(0, 30 - toArea.length))}│`);
  }
  
  lines.push(chalk.dim('  └─────────────────────────────────────────┘'));
  
  return lines.join('\n');
}

/**
 * Displays a compact ride summary
 */
export function displayRideSummary(ride: RideBooking): string {
  const icon = getStatusIcon(ride.status);
  const statusColor = getStatusColor(ride.status);
  
  const parts: string[] = [
    `${icon} ${statusColor(ride.status)}`,
  ];
  
  if (ride.driverName) {
    parts.push(chalk.cyan(ride.driverName));
  }
  
  if (ride.vehicleNumber) {
    parts.push(chalk.dim(`(${ride.vehicleNumber})`));
  }
  
  if (ride.estimatedFare) {
    parts.push(chalk.green(`₹${ride.estimatedFare}`));
  }
  
  return parts.join(' ');
}

/**
 * Displays a list of rides in a table format
 */
export function displayRidesTable(rides: RideBooking[], title: string): string {
  const lines: string[] = [];
  
  lines.push(chalk.bold.cyan(`  ${title}`));
  lines.push(chalk.dim('  ' + '─'.repeat(50)));
  
  if (rides.length === 0) {
    lines.push(chalk.dim('  No rides found.'));
    return lines.join('\n');
  }
  
  rides.forEach((ride, index) => {
    const num = chalk.dim(`${index + 1}.`.padStart(4));
    const summary = displayRideSummary(ride);
    lines.push(`  ${num} ${summary}`);
    
    if (ride.fromLocation && ride.toLocation) {
      const from = ride.fromLocation.area || ride.fromLocation.city || '?';
      const to = ride.toLocation.area || ride.toLocation.city || '?';
      lines.push(chalk.dim(`       ${from} → ${to}`));
    }
  });
  
  return lines.join('\n');
}

// =============================================================================
// Interactive Components
// =============================================================================

/**
 * Shows a filter selection for ride status
 */
export async function selectStatusFilter(): Promise<'active' | 'all' | 'back'> {
  const choices = STATUS_FILTERS.map((filter) => ({
    name: `${filter.icon} ${filter.label}`,
    value: filter.value,
    description: filter.description,
  }));

  try {
    const result = await select<'active' | 'all' | 'back'>({
      message: 'Select rides to view',
      choices: [
        ...choices,
        { name: '↩️  Back', value: 'back', description: 'Return to previous menu' },
      ],
    });
    return result;
  } catch {
    return 'back';
  }
}

/**
 * Shows a ride selection list
 */
export async function selectRide(
  rides: RideBooking[],
  message = 'Select a ride'
): Promise<RideBooking | null> {
  if (rides.length === 0) {
    return null;
  }

  const choices = rides.map((ride) => ({
    name: formatRideListItem(ride),
    value: ride,
    description: `Booking ID: ${ride.id}`,
  }));

  try {
    const result = await select<RideBooking | null>({
      message,
      choices: [
        ...choices,
        { name: '↩️  Back', value: null, description: 'Return to previous menu' },
      ],
    });
    return result;
  } catch {
    return null;
  }
}

// =============================================================================
// Export All
// =============================================================================

export { chalk };