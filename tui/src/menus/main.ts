/**
 * Main Menu for Namma Yatri TUI
 * 
 * The primary navigation hub with arrow-key navigation.
 * Uses the menu stack pattern for ESC-based back navigation.
 */

import {
  showHeader,
  showSectionHeader,
  showMenu,
  showConfirm,
  showSuccess,
  getMenuManager,
  handleMenuResult,
  chalk,
} from '../ui/menu.js';
import { runAuthFlow, ensureAuthenticated, logoutFlow, authMenu } from '../ui/auth.js';
import { placesMenu } from './places.js';
import { searchMenu } from './search.js';
import { statusMenu } from './status.js';
import { savedLocationsMenu } from './saved-locations.js';
import { getToken, readTokenData, isAuthenticated } from '../api/client.js';

// Menu identifiers
const MENU_MAIN = 'main';
const MENU_AUTH = 'auth';
const MENU_PLACES = 'places';
const MENU_SEARCH = 'search';
const MENU_STATUS = 'status';
const MENU_SAVED = 'saved';

// Version constant
const VERSION = '1.0.0';

/**
 * Main menu options
 */
interface MainMenuItem {
  id: string;
  icon: string;
  label: string;
  description: string;
  requiresAuth: boolean;
  handler?: () => Promise<void>;
}

const MAIN_MENU_ITEMS: MainMenuItem[] = [
  {
    id: 'auth',
    icon: '🔐',
    label: 'Authenticate',
    description: 'Sign in with your Namma Yatri account',
    requiresAuth: false,
  },
  {
    id: 'logout',
    icon: '🚪',
    label: 'Sign Out',
    description: 'Sign out of your account',
    requiresAuth: true,
  },
  {
    id: 'places',
    icon: '🔍',
    label: 'Search Places',
    description: 'Find locations by name or address',
    requiresAuth: true,
  },
  {
    id: 'search',
    icon: '🚗',
    label: 'Book a Ride',
    description: 'Search and book rides between locations',
    requiresAuth: true,
  },
  {
    id: 'status',
    icon: '📋',
    label: 'Ride Status',
    description: 'Check your active and past rides',
    requiresAuth: true,
  },
  {
    id: 'saved',
    icon: '⭐',
    label: 'Saved Locations',
    description: 'View your saved places (Home, Work, etc.)',
    requiresAuth: true,
  },
];

/**
 * Registers all menus with the menu manager
 */
function registerMenus(): void {
  const manager = getMenuManager();

  // Main menu
  manager.register(MENU_MAIN, async (ctx) => {
    await runMainMenu();
  });

  // Auth menu
  manager.register(MENU_AUTH, async (ctx) => {
    await authMenu();
  });

  // Places menu
  manager.register(MENU_PLACES, async (ctx) => {
    await placesMenu();
  });

  // Search menu
  manager.register(MENU_SEARCH, async (ctx) => {
    await searchMenu();
  });

  // Status menu
  manager.register(MENU_STATUS, async (ctx) => {
    await statusMenu();
  });

  // Saved locations menu
  manager.register(MENU_SAVED, async (ctx) => {
    await savedLocationsMenu();
  });
}

/**
 * Displays the main menu and handles selection
 */
async function runMainMenu(): Promise<void> {
  const manager = getMenuManager();

  while (!manager.shouldExit()) {
    // Show header
    showHeader(false);
    
    // Show auth status
    const tokenData = readTokenData();
    const authenticated = isAuthenticated();
    
    if (authenticated) {
      console.log(chalk.dim(`  Status: ${chalk.green('✓ Authenticated')}`));
      if (tokenData?.person?.firstName) {
        console.log(chalk.dim(`  User:   ${tokenData.person.firstName}`));
      }
    } else {
      console.log(chalk.dim(`  Status: ${chalk.yellow('⚠ Not authenticated')}`));
    }
    
    console.log();
    console.log(chalk.dim(`  Version ${VERSION}`));
    console.log();

    // Build menu choices - filter based on auth status
    const choices = MAIN_MENU_ITEMS
      .filter((item) => {
        // Show auth option only when not authenticated
        if (item.id === 'auth') {
          return !authenticated;
        }
        // Show logout option only when authenticated
        if (item.id === 'logout') {
          return authenticated;
        }
        // Other options require auth
        if (item.requiresAuth) {
          return authenticated;
        }
        return true;
      })
      .map((item) => ({
        name: `${item.icon}  ${item.label}`,
        value: item.id,
        description: item.description,
      }));

    const result = await showMenu<string>(
      {
        title: 'Main Menu',
        subtitle: 'Use ↑↓ arrows to navigate, Enter to select, ESC to go back',
        showBackOption: false, // No back option on main menu
      },
      choices
    );

    // Handle navigation
    if (result === 'back') {
      // At main menu, back means exit
      const confirmExit = await showConfirm('Are you sure you want to exit?', true);
      if (confirmExit) {
        manager.exit();
        showGoodbye();
        return;
      }
      continue;
    }

    if (result === 'exit') {
      const confirmExit = await showConfirm('Are you sure you want to exit?', true);
      if (confirmExit) {
        manager.exit();
        showGoodbye();
        return;
      }
      continue;
    }

    // Handle menu selection
    await handleMenuSelection(result);
  }
}

/**
 * Handles main menu selection
 */
async function handleMenuSelection(menuId: string): Promise<void> {
  const manager = getMenuManager();

  switch (menuId) {
    case 'auth':
      await authMenu();
      break;

    case 'logout':
      await logoutFlow();
      break;

    case 'places':
      await placesMenu();
      break;

    case 'search':
      await searchMenu();
      break;

    case 'status':
      await statusMenu();
      break;

    case 'saved':
      await savedLocationsMenu();
      break;
  }
}

/**
 * Displays goodbye message
 */
function showGoodbye(): void {
  console.log();
  console.log(chalk.bold.cyan('  👋 Goodbye! Have a safe journey!'));
  console.log(chalk.dim('  Thank you for using Namma Yatri CLI'));
  console.log();
}

/**
 * Entry point for the main menu
 */
export async function mainMenu(): Promise<void> {
  // Register all menus
  registerMenus();

  // Get the menu manager
  const manager = getMenuManager();

  // Start the main menu
  await manager.push(MENU_MAIN);
}