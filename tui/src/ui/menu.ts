/**
 * Menu System for Namma Yatri TUI
 * 
 * Provides a menu stack pattern for navigation with ESC support.
 * Each menu can push/pop from the stack, enabling proper back navigation.
 */

import { select, confirm, input, password, number } from '@inquirer/prompts';
import chalk from 'chalk';

// =============================================================================
// Types
// =============================================================================

export interface MenuContext {
  /** Stack of menu names for navigation */
  menuStack: string[];
  /** Shared data between menus */
  data: Record<string, unknown>;
  /** Flag to stop the menu loop */
  shouldExit: boolean;
}

export type MenuHandler = (ctx: MenuContext) => Promise<void>;

export interface MenuOption<T = string> {
  name: string;
  value: T;
  description?: string;
  disabled?: boolean;
}

export interface MenuConfig {
  title: string;
  subtitle?: string;
  showBackOption?: boolean;
  backOptionText?: string;
}

// =============================================================================
// Menu Stack Manager
// =============================================================================

class MenuStackManager {
  private menus: Map<string, MenuHandler> = new Map();
  private context: MenuContext;

  constructor() {
    this.context = {
      menuStack: [],
      data: {},
      shouldExit: false,
    };
  }

  /**
   * Registers a menu handler
   */
  register(name: string, handler: MenuHandler): void {
    this.menus.set(name, handler);
  }

  /**
   * Pushes a new menu onto the stack and navigates to it
   */
  async push(name: string): Promise<void> {
    const handler = this.menus.get(name);
    if (!handler) {
      throw new Error(`Menu '${name}' not found`);
    }

    this.context.menuStack.push(name);
    
    try {
      await handler(this.context);
    } catch (error) {
      // Pop the menu from stack on error
      this.context.menuStack.pop();
      throw error;
    }
  }

  /**
   * Pops the current menu and returns to the previous one
   */
  async pop(): Promise<void> {
    this.context.menuStack.pop();
    const previousMenu = this.context.menuStack[this.context.menuStack.length - 1];
    
    if (previousMenu) {
      await this.push(previousMenu);
    }
  }

  /**
   * Gets the current menu name
   */
  getCurrentMenu(): string | undefined {
    return this.context.menuStack[this.context.menuStack.length - 1];
  }

  /**
   * Gets the menu stack depth
   */
  getDepth(): number {
    return this.context.menuStack.length;
  }

  /**
   * Signals the menu loop to exit
   */
  exit(): void {
    this.context.shouldExit = true;
  }

  /**
   * Checks if we should exit
   */
  shouldExit(): boolean {
    return this.context.shouldExit;
  }

  /**
   * Gets the shared context data
   */
  getContext(): MenuContext {
    return this.context;
  }
}

// Singleton instance
let menuManager: MenuStackManager | null = null;

/**
 * Gets the global menu manager instance
 */
export function getMenuManager(): MenuStackManager {
  if (!menuManager) {
    menuManager = new MenuStackManager();
  }
  return menuManager;
}

// =============================================================================
// Header Component
// =============================================================================

const BRAND_ART = `
   ╔═══════════════════════════════════════╗
   ║                                       ║
   ║    🚕  NAMMA YATRI CLI               ║
   ║    ─────────────────────────         ║
   ║    Your Ride, Your Way!              ║
   ║                                       ║
   ╚═══════════════════════════════════════╝
`;

/**
 * Displays the application header with branding
 */
export function showHeader(clear = true): void {
  if (clear) {
    console.clear();
  }
  
  console.log(chalk.cyan(BRAND_ART));
}

/**
 * Displays a section header
 */
export function showSectionHeader(title: string, subtitle?: string): void {
  console.log();
  console.log(chalk.bold.cyan(`  ${title}`));
  
  if (subtitle) {
    console.log(chalk.dim(`  ${subtitle}`));
  }
  
  console.log(chalk.dim('  ' + '─'.repeat(40)));
  console.log();
}

/**
 * Displays a success message
 */
export function showSuccess(message: string): void {
  console.log(chalk.green(`\n  ✓ ${message}\n`));
}

/**
 * Displays an error message
 */
export function showError(message: string): void {
  console.log(chalk.red(`\n  ✖ ${message}\n`));
}

/**
 * Displays an info message
 */
export function showInfo(message: string): void {
  console.log(chalk.dim(`\n  ℹ ${message}\n`));
}

/**
 * Displays a warning message
 */
export function showWarning(message: string): void {
  console.log(chalk.yellow(`\n  ⚠ ${message}\n`));
}

// =============================================================================
// Menu Components
// =============================================================================

/**
 * Creates a select menu with automatic back option and ESC handling
 */
export async function showMenu<T = string>(
  config: MenuConfig,
  choices: MenuOption<T>[]
): Promise<T | 'back' | 'exit'> {
  const { title, subtitle, showBackOption = true, backOptionText = '↩️  Back' } = config;

  showSectionHeader(title, subtitle);

  // Add back option if enabled and not at root menu
  const menuChoices = [...choices];
  
  if (showBackOption) {
    menuChoices.push({
      name: backOptionText,
      value: 'back' as T,
      description: 'Return to previous menu (or press ESC)',
    });
  }

  // Add exit option
  menuChoices.push({
    name: '❌ Exit',
    value: 'exit' as T,
    description: 'Exit the application',
  });

  try {
    const selection = await select<T | 'back' | 'exit'>({
      message: 'Select an option',
      choices: menuChoices.map(c => ({
        name: c.name,
        value: c.value,
        description: c.description,
        disabled: c.disabled,
      })),
    });

    return selection;
  } catch (error) {
    // ESC was pressed - treat as back
    if (error instanceof Error && error.message === 'User cancelled') {
      return 'back';
    }
    throw error;
  }
}

/**
 * Creates a confirmation dialog
 */
export async function showConfirm(
  message: string,
  defaultValue = false
): Promise<boolean> {
  try {
    return await confirm({
      message,
      default: defaultValue,
    });
  } catch {
    // ESC pressed - treat as no
    return false;
  }
}

/**
 * Creates an input prompt
 */
export async function showInput(
  message: string,
  validate?: (value: string) => boolean | string | Promise<boolean | string>
): Promise<string | null> {
  try {
    return await input({
      message,
      validate: validate || (() => true),
    });
  } catch {
    // ESC pressed
    return null;
  }
}

/**
 * Creates a password input prompt
 */
export async function showPassword(
  message: string,
  validate?: (value: string) => boolean | string | Promise<boolean | string>
): Promise<string | null> {
  try {
    return await password({
      message,
      validate: validate || (() => true),
    });
  } catch {
    // ESC pressed
    return null;
  }
}

/**
 * Creates a number input prompt
 */
export async function showNumber(
  message: string,
  options?: {
    min?: number;
    max?: number;
    default?: number;
    validate?: (value: number | undefined) => boolean | string | Promise<boolean | string>;
  }
): Promise<number | null> {
  try {
    const result = await number({
      message,
      min: options?.min,
      max: options?.max,
      default: options?.default,
      validate: options?.validate || (() => true),
    });
    return result ?? null;
  } catch {
    // ESC pressed
    return null;
  }
}

/**
 * Shows a loading spinner with message
 */
export async function withSpinner<T>(
  message: string,
  action: () => Promise<T>
): Promise<T> {
  const ora = (await import('ora')).default;
  const spinner = ora(message).start();
  
  try {
    const result = await action();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

// =============================================================================
// Navigation Helpers
// =============================================================================

/**
 * Handles the result of a menu selection
 * Returns true if the menu should continue, false if it should exit
 */
export function handleMenuResult(
  result: 'back' | 'exit' | unknown,
  ctx: MenuContext
): boolean {
  if (result === 'back') {
    ctx.menuStack.pop();
    return false; // Exit current menu loop
  }
  
  if (result === 'exit') {
    ctx.shouldExit = true;
    return false;
  }
  
  return true; // Continue in current menu
}

/**
 * Creates a menu loop that handles back/exit navigation
 */
export async function runMenuLoop(
  menuName: string,
  showMenuFn: () => Promise<'back' | 'exit' | void>
): Promise<void> {
  const manager = getMenuManager();
  
  while (!manager.shouldExit()) {
    try {
      const result = await showMenuFn();
      
      if (result === 'back' || result === 'exit') {
        if (result === 'exit') {
          manager.exit();
        }
        return;
      }
      
      // If we get here, an action was performed - show menu again
    } catch (error) {
      if (error instanceof Error && error.message === 'User cancelled') {
        // ESC pressed - go back
        return;
      }
      throw error;
    }
  }
}

// =============================================================================
// Export Types and Utilities
// =============================================================================

export { chalk };