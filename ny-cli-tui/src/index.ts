#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';
import { TokenStore } from './store/token-store.js';

async function main() {
  const args = process.argv.slice(2);
  
  // Handle --version and --help flags
  if (args[0] === '--version' || args[0] === '-v') {
    console.log('ny-cli-tui v1.0.0');
    process.exit(0);
  }
  
  if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
ny-cli-tui - Interactive Terminal User Interface for Namma Yatri

USAGE:
  ny-cli              Start interactive TUI
  ny-cli --version    Show version
  ny-cli --help       Show this help

FEATURES:
  • Interactive menus with fuzzy search
  • Location autocomplete
  • Estimate selection with multiple options
  • Token persistence
  • Ride cancellation support

The old bash CLI is available as 'ny-cli-legacy'.
`);
    process.exit(0);
  }
  
  // Check if token exists
  const tokenStore = new TokenStore();
  const hasToken = await tokenStore.hasToken();
  
  // Render the app
  const { waitUntilExit } = render(
    React.createElement(App, { hasToken })
  );
  
  await waitUntilExit();
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});