#!/usr/bin/env node

import { mainMenu } from './menus/main.js';
import chalk from 'chalk';

const VERSION = '1.0.0';

async function main(): Promise<void> {
  console.log(chalk.bold.cyan('\n🚕 Namma Yatri TUI'));
  console.log(chalk.dim(`   Version ${VERSION}\n`));

  try {
    await mainMenu();
  } catch (error) {
    if (error instanceof Error && error.message === 'User cancelled') {
      console.log(chalk.yellow('\n👋 Goodbye!'));
      process.exit(0);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(chalk.red('\n❌ Fatal error:'), error.message);
  process.exit(1);
});