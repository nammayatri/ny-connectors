/**
 * Saved Locations UI Components for Namma Yatri TUI
 * 
 * Reusable components for displaying and selecting saved locations.
 * Used by menus/saved-locations.ts for rendering location information.
 */

import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import type { SavedLocation } from '../api.js';

// =============================================================================
// Types
// =============================================================================

export interface LocationDisplayOptions {
  showCoordinates?: boolean;
  showAddress?: boolean;
  showTag?: boolean;
  compact?: boolean;
}

export interface LocationSelection {
  location: SavedLocation;
  action: 'select' | 'use' | 'edit' | 'delete';
}

// =============================================================================
// Constants
// =============================================================================

// Location tag icons
const TAG_ICONS: Record<string, string> = {
  home: '🏠',
  work: '🏢',
  office: '🏢',
  gym: '💪',
  school: '🎓',
  college: '🎓',
  hospital: '🏥',
  mall: '🛒',
  shopping: '🛒',
  airport: '✈️',
  station: '🚉',
  railway: '🚉',
  park: '🌳',
  restaurant: '🍽️',
  cafe: '☕',
  hotel: '🏨',
  bank: '🏦',
  church: '⛪',
  temple: '🛕',
  mosque: '🕌',
  library: '📚',
  pharmacy: '💊',
  default: '📍',
};

// Tag colors (using chalk methods directly)
const TAG_COLORS: Record<string, chalk.Chalk> = {
  home: chalk.magenta,
  work: chalk.blue,
  office: chalk.blue,
  gym: chalk.green,
  school: chalk.yellow,
  college: chalk.yellow,
  hospital: chalk.red,
  mall: chalk.cyan,
  shopping: chalk.cyan,
  airport: chalk.cyan,
  station: chalk.cyan,
  railway: chalk.cyan,
  default: chalk.white,
};

// =============================================================================
// Icon and Color Functions
// =============================================================================

/**
 * Gets the icon for a location tag
 */
export function getLocationIcon(tag: string): string {
  const lowerTag = tag.toLowerCase();
  return TAG_ICONS[lowerTag] || TAG_ICONS.default;
}

/**
 * Gets the chalk instance for a location tag
 */
export function getLocationColor(tag: string): chalk.Chalk {
  const lowerTag = tag.toLowerCase();
  return TAG_COLORS[lowerTag] || TAG_COLORS.default;
}

/**
 * Gets a descriptive label for a location type
 */
export function getLocationTypeLabel(tag: string): string {
  const lowerTag = tag.toLowerCase();
  
  const labels: Record<string, string> = {
    home: 'Home',
    work: 'Workplace',
    office: 'Office',
    gym: 'Gym / Fitness',
    school: 'School',
    college: 'College / University',
    hospital: 'Hospital / Medical',
    mall: 'Shopping Mall',
    shopping: 'Shopping Area',
    airport: 'Airport',
    station: 'Railway Station',
    railway: 'Railway Station',
    park: 'Park / Recreation',
    restaurant: 'Restaurant',
    cafe: 'Cafe',
    hotel: 'Hotel',
    bank: 'Bank',
  };
  
  return labels[lowerTag] || tag;
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Formats a location for display in a list
 */
export function formatLocationListItem(
  location: SavedLocation,
  options: LocationDisplayOptions = {}
): string {
  const { showCoordinates = false, showAddress = true } = options;
  
  const icon = getLocationIcon(location.tag);
  const color = getLocationColor(location.tag);
  
  let name = `${icon} ${color(location.tag)}`;
  
  // Add location name if different from tag
  if (location.locationName && location.locationName !== location.tag) {
    name += chalk.dim(` - ${location.locationName}`);
  }
  
  // Add address
  if (showAddress) {
    const address = formatAddressShort(location);
    if (address) {
      name += chalk.dim(` (${address})`);
    }
  }
  
  // Add coordinates
  if (showCoordinates) {
    name += chalk.dim(` [${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}]`);
  }
  
  return name;
}

/**
 * Formats a short address from location
 */
export function formatAddressShort(location: SavedLocation): string {
  const parts: string[] = [];
  
  if (location.area) {
    parts.push(location.area);
  } else if (location.building) {
    parts.push(location.building);
  }
  
  if (location.city && !parts.includes(location.city)) {
    parts.push(location.city);
  }
  
  return parts.join(', ');
}

/**
 * Formats a full address from location
 */
export function formatAddressFull(location: SavedLocation): string {
  const parts: string[] = [];
  
  if (location.building) parts.push(location.building);
  if (location.street) parts.push(location.street);
  if (location.area) parts.push(location.area);
  if (location.ward) parts.push(location.ward);
  if (location.city) parts.push(location.city);
  if (location.state) parts.push(location.state);
  if (location.country) parts.push(location.country);
  
  return parts.join(', ');
}

/**
 * Formats coordinates for display
 */
export function formatCoordinates(lat: number, lon: number, precision = 6): string {
  return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
}

/**
 * Formats a Google Maps URL for the location
 */
export function formatMapsUrl(location: SavedLocation): string {
  return `https://www.google.com/maps?q=${location.lat},${location.lon}`;
}

// =============================================================================
// Display Components
// =============================================================================

/**
 * Displays a location tag badge
 */
export function displayTagBadge(tag: string): string {
  const icon = getLocationIcon(tag);
  const color = getLocationColor(tag);
  return `${icon} ${color(tag)}`;
}

/**
 * Displays a location details card
 */
export function displayLocationDetailsCard(location: SavedLocation): string {
  const lines: string[] = [];
  const icon = getLocationIcon(location.tag);
  const color = getLocationColor(location.tag);
  
  lines.push(chalk.dim('  ┌─────────────────────────────────────────┐'));
  lines.push(`  │ ${icon} ${color.bold(location.tag.padEnd(36))}│`);
  lines.push(chalk.dim('  ├─────────────────────────────────────────┤'));
  
  // Location name
  if (location.locationName && location.locationName !== location.tag) {
    lines.push(`  │ ${chalk.dim('Name:')}       ${location.locationName.slice(0, 30)}${' '.repeat(Math.max(0, 30 - location.locationName.length))}│`);
  }
  
  // Type
  const typeLabel = getLocationTypeLabel(location.tag);
  lines.push(`  │ ${chalk.dim('Type:')}       ${typeLabel}${' '.repeat(Math.max(0, 30 - typeLabel.length))}│`);
  
  lines.push(chalk.dim('  ├─────────────────────────────────────────┤'));
  
  // Address
  const fullAddress = formatAddressFull(location);
  if (fullAddress) {
    const addressLines = wrapText(fullAddress, 30);
    lines.push(`  │ ${chalk.dim('Address:')}    ${addressLines[0]}${' '.repeat(Math.max(0, 30 - addressLines[0].length))}│`);
    addressLines.slice(1).forEach(line => {
      lines.push(`  │             ${line}${' '.repeat(Math.max(0, 30 - line.length))}│`);
    });
  }
  
  // Building
  if (location.building) {
    lines.push(`  │ ${chalk.dim('Building:')}   ${location.building.slice(0, 30)}${' '.repeat(Math.max(0, 30 - location.building.length))}│`);
  }
  
  // Street
  if (location.street) {
    lines.push(`  │ ${chalk.dim('Street:')}     ${location.street.slice(0, 30)}${' '.repeat(Math.max(0, 30 - location.street.length))}│`);
  }
  
  // Area
  if (location.area) {
    lines.push(`  │ ${chalk.dim('Area:')}       ${location.area.slice(0, 30)}${' '.repeat(Math.max(0, 30 - location.area.length))}│`);
  }
  
  // City
  if (location.city) {
    lines.push(`  │ ${chalk.dim('City:')}       ${location.city}${' '.repeat(Math.max(0, 30 - location.city.length))}│`);
  }
  
  lines.push(chalk.dim('  ├─────────────────────────────────────────┤'));
  
  // Coordinates
  const coords = formatCoordinates(location.lat, location.lon);
  lines.push(`  │ ${chalk.dim('Coords:')}     ${coords}${' '.repeat(Math.max(0, 30 - coords.length))}│`);
  
  // Place ID
  if (location.placeId) {
    const placeIdShort = location.placeId.length > 28 
      ? location.placeId.slice(0, 25) + '...' 
      : location.placeId;
    lines.push(`  │ ${chalk.dim('Place ID:')}   ${chalk.dim(placeIdShort)}${' '.repeat(Math.max(0, 30 - placeIdShort.length))}│`);
  }
  
  lines.push(chalk.dim('  └─────────────────────────────────────────┘'));
  
  return lines.join('\n');
}

/**
 * Displays a compact location summary
 */
export function displayLocationSummary(location: SavedLocation): string {
  const icon = getLocationIcon(location.tag);
  const color = getLocationColor(location.tag);
  const address = formatAddressShort(location);
  
  return `${icon} ${color(location.tag)} ${chalk.dim('→')} ${address}`;
}

/**
 * Displays a list of locations in a table format
 */
export function displayLocationsTable(locations: SavedLocation[], title: string): string {
  const lines: string[] = [];
  
  lines.push(chalk.bold.cyan(`  ${title}`));
  lines.push(chalk.dim('  ' + '─'.repeat(50)));
  
  if (locations.length === 0) {
    lines.push(chalk.dim('  No saved locations found.'));
    lines.push(chalk.dim('  Add locations in the Namma Yatri app to see them here.'));
    return lines.join('\n');
  }
  
  locations.forEach((location, index) => {
    const num = chalk.dim(`${index + 1}.`.padStart(4));
    const summary = displayLocationSummary(location);
    lines.push(`  ${num} ${summary}`);
    
    // Show coordinates on next line
    const coords = formatCoordinates(location.lat, location.lon);
    lines.push(chalk.dim(`       📍 ${coords}`));
  });
  
  return lines.join('\n');
}

/**
 * Displays a location with action options
 */
export function displayLocationWithActions(location: SavedLocation): string {
  const lines: string[] = [];
  
  lines.push(displayLocationDetailsCard(location));
  lines.push('');
  lines.push(chalk.dim('  💡 Tip: You can use saved locations when booking rides!'));
  lines.push(chalk.dim('     Just type the tag name (e.g., "home" or "work")'));
  lines.push('');
  
  return lines.join('\n');
}

// =============================================================================
// Interactive Components
// =============================================================================

/**
 * Shows a location selection list
 */
export async function selectLocation(
  locations: SavedLocation[],
  message = 'Select a location'
): Promise<SavedLocation | null> {
  if (locations.length === 0) {
    return null;
  }

  const choices = locations.map((location) => ({
    name: formatLocationListItem(location),
    value: location,
    description: formatAddressFull(location) || `Coordinates: ${formatCoordinates(location.lat, location.lon)}`,
  }));

  try {
    const result = await select<SavedLocation | null>({
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

/**
 * Shows a location selection for use in ride booking
 */
export async function selectLocationForRide(
  locations: SavedLocation[],
  rideType: 'pickup' | 'drop'
): Promise<SavedLocation | null> {
  const icon = rideType === 'pickup' ? '🚶' : '🏁';
  const label = rideType === 'pickup' ? 'pickup location' : 'drop location';
  
  if (locations.length === 0) {
    return null;
  }

  const choices = locations.map((location) => ({
    name: formatLocationListItem(location, { showCoordinates: true }),
    value: location,
    description: formatAddressFull(location) || `Coordinates: ${formatCoordinates(location.lat, location.lon)}`,
  }));

  try {
    const result = await select<SavedLocation | null>({
      message: `${icon} Select ${label}`,
      choices: [
        { name: '🔍 Search for a different location', value: null, description: 'Search by name or address' },
        ...choices,
        { name: '↩️  Back', value: null, description: 'Return to previous menu' },
      ],
    });
    return result;
  } catch {
    return null;
  }
}

/**
 * Shows action options for a selected location
 */
export async function selectLocationAction(location: SavedLocation): Promise<'use' | 'view' | 'back'> {
  const icon = getLocationIcon(location.tag);
  const color = getLocationColor(location.tag);
  
  try {
    const result = await select<'use' | 'view' | 'back'>({
      message: `${icon} ${color(location.tag)} - What would you like to do?`,
      choices: [
        { 
          name: '🚗 Use for ride booking', 
          value: 'use', 
          description: 'Set this as pickup or drop location' 
        },
        { 
          name: '📋 View details', 
          value: 'view', 
          description: 'See full address and coordinates' 
        },
        { 
          name: '↩️  Back', 
          value: 'back', 
          description: 'Return to locations list' 
        },
      ],
    });
    return result;
  } catch {
    return 'back';
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Wraps text to a maximum width
 */
function wrapText(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) {
    return [text];
  }
  
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  
  if (currentLine) lines.push(currentLine);
  
  return lines;
}

/**
 * Groups locations by type
 */
export function groupLocationsByType(locations: SavedLocation[]): Map<string, SavedLocation[]> {
  const groups = new Map<string, SavedLocation[]>();
  
  for (const location of locations) {
    const type = getLocationTypeLabel(location.tag);
    const existing = groups.get(type) || [];
    existing.push(location);
    groups.set(type, existing);
  }
  
  return groups;
}

/**
 * Sorts locations by tag name
 */
export function sortLocationsByName(locations: SavedLocation[]): SavedLocation[] {
  return [...locations].sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * Finds a location by tag (case-insensitive)
 */
export function findLocationByTag(locations: SavedLocation[], tag: string): SavedLocation | undefined {
  const lowerTag = tag.toLowerCase();
  return locations.find(loc => loc.tag.toLowerCase() === lowerTag);
}

// =============================================================================
// Export All
// =============================================================================

export { chalk };