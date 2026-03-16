#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { App } from './components/App.js';

/**
 * Main entry point for Namma Yatri TUI
 * Renders the App component with Ink
 */
function main(): void {
  render(<App />);
}

main();
