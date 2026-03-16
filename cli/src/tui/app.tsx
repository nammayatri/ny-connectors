/**
 * Main TUI Application
 * Entry point for the Ink-based terminal UI
 */

import React from 'react';
import { render } from 'ink';
import { App } from './components/App.js';

export async function runCLI(): Promise<void> {
  const { waitUntilExit } = render(<App />);
  await waitUntilExit();
}