#!/usr/bin/env node

// ============================================================================
// Namma Yatri CLI TUI Entry Point
// Interactive terminal UI for booking rides using Ink + React
// ============================================================================

import React from 'react';
import { render } from 'ink';
import { App } from './app.js';

// Check Node.js version
const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0], 10);

if (majorVersion < 18) {
  console.error('Error: Namma Yatri CLI requires Node.js 18 or higher.');
  console.error(`Current version: ${nodeVersion}`);
  process.exit(1);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Render the app
render(<App />);
