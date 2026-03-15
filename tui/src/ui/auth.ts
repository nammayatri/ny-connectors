/**
 * Authentication Flow UI for Namma Yatri TUI
 * 
 * Beautiful authentication flow with:
 * - Phone number and access code input
 * - Helpful instructions for finding access code
 * - Loading spinner during authentication
 * - Welcome message on success
 * - Graceful error handling with retry option
 * - ESC support to return to main menu
 */

import { input, password } from '@inquirer/prompts';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import {
  showHeader,
  showSectionHeader,
  showSuccess,
  showError,
  showInfo,
  showWarning,
  showConfirm,
  getMenuManager,
} from './menu.js';
import {
  NammaYatriClient,
  AuthResponse,
  PersonEntity,
  readTokenData,
  saveTokenData,
  isAuthenticated,
} from '../api/client.js';

// =============================================================================
// Types
// =============================================================================

export interface AuthFlowResult {
  success: boolean;
  person?: PersonEntity;
  cancelled?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const INSTRUCTIONS_BOX = `
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │   📱 How to find your Access Code:                              │
  │                                                                 │
  │   1. Open the Namma Yatri app on your phone                     │
  │   2. Tap on your profile icon (top left)                        │
  │   3. Go to "About Us" section                                   │
  │   4. Find your Access Code there                                │
  │                                                                 │
  │   The access code is a secret key that allows CLI access        │
  │   to your Namma Yatri account.                                  │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
`;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validates a mobile number (10 digits for India)
 */
function validateMobileNumber(value: string): boolean | string {
  const trimmed = value.trim();
  
  if (!trimmed) {
    return 'Mobile number is required';
  }
  
  // Remove any spaces or dashes
  const cleaned = trimmed.replace(/[\s-]/g, '');
  
  // Check for valid Indian mobile number (10 digits, optionally with +91)
  const indianMobileRegex = /^(\+91)?[6-9]\d{9}$/;
  if (!indianMobileRegex.test(cleaned)) {
    return 'Please enter a valid 10-digit Indian mobile number';
  }
  
  return true;
}

/**
 * Validates an access code
 */
function validateAccessCode(value: string): boolean | string {
  const trimmed = value.trim();
  
  if (!trimmed) {
    return 'Access code is required';
  }
  
  if (trimmed.length < 4) {
    return 'Access code seems too short. Please check and try again.';
  }
  
  return true;
}

/**
 * Normalizes a mobile number to 10 digits
 */
function normalizeMobileNumber(value: string): string {
  const cleaned = value.trim().replace(/[\s-]/g, '');
  // Remove +91 prefix if present
  if (cleaned.startsWith('+91')) {
    return cleaned.slice(3);
  }
  return cleaned;
}

// =============================================================================
// UI Components
// =============================================================================

/**
 * Displays the authentication instructions
 */
function showAuthInstructions(): void {
  console.log(chalk.dim(INSTRUCTIONS_BOX));
  console.log();
}

/**
 * Displays a welcome message after successful authentication
 */
function showWelcomeMessage(person?: PersonEntity): void {
  console.log();
  
  const welcomeBox = person?.firstName
    ? `
  ╔═══════════════════════════════════════════════════════════════╗
  ║                                                               ║
  ║   🎉 Welcome, ${person.firstName.padEnd(20)}          ║
  ║                                                               ║
  ║   You are now authenticated and ready to book rides!          ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝
`
    : `
  ╔═══════════════════════════════════════════════════════════════╗
  ║                                                               ║
  ║   🎉 Welcome!                                                 ║
  ║                                                               ║
  ║   You are now authenticated and ready to book rides!          ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝
`;

  console.log(chalk.green(welcomeBox));
  
  if (person?.maskedMobileNumber) {
    console.log(chalk.dim(`  📱 Phone: ${person.maskedMobileNumber}`));
  }
  if (person?.email) {
    console.log(chalk.dim(`  📧 Email: ${person.email}`));
  }
  console.log();
}

/**
 * Displays an authentication error with retry option
 */
async function showAuthError(error: string): Promise<boolean> {
  console.log();
  
  const errorBox = `
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │   ❌ Authentication Failed                                      │
  │                                                                 │
  │   ${error.padEnd(59)}│
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
`;
  
  console.log(chalk.red(errorBox));
  console.log();
  
  // Offer retry
  return showConfirm('Would you like to try again?', true);
}

// =============================================================================
// Authentication Flow
// =============================================================================

/**
 * Prompts for mobile number
 * Returns null if ESC was pressed
 */
async function promptMobileNumber(): Promise<string | null> {
  try {
    const result = await input({
      message: 'Enter your mobile number',
      validate: validateMobileNumber,
      default: '',
    });
    
    return normalizeMobileNumber(result);
  } catch (error) {
    // ESC was pressed
    return null;
  }
}

/**
 * Prompts for access code
 * Returns null if ESC was pressed
 */
async function promptAccessCode(): Promise<string | null> {
  try {
    const result = await password({
      message: 'Enter your access code',
      validate: validateAccessCode,
      mask: '•',
    });
    
    return result.trim();
  } catch (error) {
    // ESC was pressed
    return null;
  }
}

/**
 * Performs the authentication API call with a spinner
 */
async function performAuthentication(
  mobileNumber: string,
  accessCode: string
): Promise<AuthResponse> {
  const spinner = ora({
    text: 'Authenticating with Namma Yatri...',
    spinner: 'dots12',
    color: 'cyan',
  }).start();
  
  try {
    const response = await NammaYatriClient.authenticate({
      mobileNumber,
      accessCode,
      country: 'IN',
    });
    
    if (response.success) {
      spinner.succeed(chalk.green('Authentication successful!'));
    } else {
      spinner.fail(chalk.red('Authentication failed'));
    }
    
    return response;
  } catch (error) {
    spinner.fail(chalk.red('Network error'));
    throw error;
  }
}

/**
 * Main authentication flow
 * 
 * @returns AuthFlowResult indicating success/failure/cancellation
 */
export async function runAuthFlow(): Promise<AuthFlowResult> {
  // Show header and instructions
  showHeader(true);
  showSectionHeader('🔐 Authentication', 'Sign in to your Namma Yatri account');
  showAuthInstructions();
  
  // Prompt for mobile number
  const mobileNumber = await promptMobileNumber();
  
  if (mobileNumber === null) {
    // ESC was pressed
    console.log();
    showInfo('Authentication cancelled. Returning to main menu...');
    return { success: false, cancelled: true };
  }
  
  // Prompt for access code
  const accessCode = await promptAccessCode();
  
  if (accessCode === null) {
    // ESC was pressed
    console.log();
    showInfo('Authentication cancelled. Returning to main menu...');
    return { success: false, cancelled: true };
  }
  
  // Perform authentication
  console.log();
  const response = await performAuthentication(mobileNumber, accessCode);
  
  if (response.success && response.token) {
    // Show welcome message
    showWelcomeMessage(response.person);
    
    return {
      success: true,
      person: response.person,
    };
  }
  
  // Authentication failed
  const shouldRetry = await showAuthError(response.error || 'Unknown error occurred');
  
  if (shouldRetry) {
    // Recursive call to retry
    return runAuthFlow();
  }
  
  return { success: false, cancelled: false };
}

/**
 * Quick authentication check and flow
 * 
 * If already authenticated, shows status.
 * If not authenticated, starts the auth flow.
 */
export async function ensureAuthenticated(): Promise<boolean> {
  if (isAuthenticated()) {
    const tokenData = readTokenData();
    
    showSectionHeader('🔐 Authentication Status', 'You are already signed in');
    
    if (tokenData?.person?.firstName) {
      console.log(chalk.green(`  ✓ Signed in as ${tokenData.person.firstName}`));
      if (tokenData.person.maskedMobileNumber) {
        console.log(chalk.dim(`    Phone: ${tokenData.person.maskedMobileNumber}`));
      }
    } else {
      console.log(chalk.green('  ✓ You are authenticated'));
    }
    
    console.log();
    
    const reauth = await showConfirm('Would you like to sign in with a different account?', false);
    
    if (reauth) {
      return runAuthFlow().then(result => result.success);
    }
    
    return true;
  }
  
  // Not authenticated, start flow
  const result = await runAuthFlow();
  return result.success;
}

/**
 * Logout flow
 */
export async function logoutFlow(): Promise<void> {
  showSectionHeader('🔐 Sign Out', 'Sign out of your Namma Yatri account');
  
  const tokenData = readTokenData();
  
  if (!tokenData?.token) {
    showInfo('You are not currently signed in.');
    return;
  }
  
  if (tokenData.person?.firstName) {
    console.log(chalk.dim(`  Currently signed in as: ${tokenData.person.firstName}`));
  }
  console.log();
  
  const confirm = await showConfirm('Are you sure you want to sign out?', false);
  
  if (confirm) {
    // Clear token
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    
    const tokenFile = path.join(os.homedir(), '.namma-yatri', 'token.json');
    
    try {
      if (fs.existsSync(tokenFile)) {
        fs.unlinkSync(tokenFile);
      }
      showSuccess('You have been signed out successfully.');
    } catch (error) {
      showError('Failed to sign out. Please try again.');
    }
  } else {
    showInfo('Sign out cancelled.');
  }
}

// =============================================================================
// Export for menu integration
// =============================================================================

/**
 * Authentication menu entry point
 * Compatible with the menu system pattern
 */
export async function authMenu(): Promise<void> {
  await ensureAuthenticated();
}