#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { App } from './components/App.js';

/**
 * CLI argument parsing and entry point for Namma Yatri TUI
 * 
 * Supported flags:
 * --version, -v    Show version
 * --help, -h       Show help
 */

const VERSION = '1.0.0';
const HELP_TEXT = `
Namma Yatri TUI - Book rides from your terminal

Usage: ny-tui [options]

Options:
  -v, --version    Show version number
  -h, --help       Show help

Description:
  A Terminal User Interface for booking Namma Yatri rides.
  
  The TUI will:
  - Check for existing authentication on startup
  - If not authenticated, show the login screen
  - If authenticated, start at the ride booking flow
  
  Use Ctrl+C to exit at any time.

Examples:
  ny-tui           Start the TUI
  ny-tui --version Show version
  ny-tui --help    Show this help message
`;

function parseArgs(args: string[]): { showVersion: boolean; showHelp: boolean } {
  return {
    showVersion: args.includes('--version') || args.includes('-v'),
    showHelp: args.includes('--help') || args.includes('-h'),
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const { showVersion, showHelp } = parseArgs(args);

  if (showVersion) {
    console.log(VERSION);
    process.exit(0);
  }

  if (showHelp) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\nGoodbye! 👋');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\nGoodbye! 👋');
    process.exit(0);
  });

  // Render the TUI
  render(<App />);
}

main();
