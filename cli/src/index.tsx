#!/usr/bin/env node
// ============================================================================
// Namma Yatri CLI TUI - Entry Point
// ============================================================================
// Ink-based React TUI for booking rides via Namma Yatri API

import React from 'react';
import { render } from 'ink';
import App from './app.js';
import { readTokenData } from './utils/storage.js';

// ============================================================================
// Version and Metadata
// ============================================================================

const VERSION = '1.0.0';
const PACKAGE_NAME = 'ny-cli-tui';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CliOptions {
  help: boolean;
  version: boolean;
  fallback: boolean;
  token?: string;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    help: false,
    version: false,
    fallback: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      case '-f':
      case '--fallback':
        options.fallback = true;
        break;
      case '-t':
      case '--token':
        if (i + 1 < args.length) {
          options.token = args[++i];
        }
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          console.error('Use --help for usage information');
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

// ============================================================================
// Help Text
// ============================================================================

function showHelp(): void {
  console.log(`
${PACKAGE_NAME} v${VERSION}

Usage: ny-tui [options]

Options:
  -h, --help       Show this help message and exit
  -v, --version    Show version information and exit
  -f, --fallback   Use the original Bash script instead of the TUI
  -t, --token      Provide authentication token directly (for testing)

Environment Variables:
  NAMMA_YATRI_API_BASE    Override the API base URL
                          Default: https://api.moving.tech/pilot/app/v2

Examples:
  ny-tui                    Start the TUI
  ny-tui --help             Show help
  ny-tui --fallback         Use the Bash script fallback

Navigation:
  ↑/↓ or k/j         Navigate up/down in lists
  Enter              Select/confirm
  Esc                Go back / cancel
  Ctrl+C             Exit the application

For more information, visit: https://github.com/juspay/namma-yatri
`);
}

// ============================================================================
// Version Info
// ============================================================================

function showVersion(): void {
  console.log(`${PACKAGE_NAME} v${VERSION}`);
}

// ============================================================================
// Fallback to Bash Script
// ============================================================================

async function runFallback(): Promise<void> {
  const { spawn } = await import('child_process');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Look for the bash script in various locations
  const possiblePaths = [
    join(__dirname, '..', '..', 'ny-cli.sh'),
    join(__dirname, '..', 'ny-cli.sh'),
    join(process.cwd(), 'ny-cli.sh'),
    '/usr/local/bin/ny-cli.sh',
    '/usr/bin/ny-cli.sh',
  ];

  const fs = await import('fs');
  let scriptPath: string | null = null;

  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      scriptPath = path;
      break;
    }
  }

  if (!scriptPath) {
    console.error('Error: Could not find the fallback Bash script (ny-cli.sh)');
    console.error('Please ensure the Bash script is installed and accessible.');
    process.exit(1);
  }

  console.log(`Using fallback Bash script: ${scriptPath}`);

  const child = spawn('bash', [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // Handle help flag
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Handle version flag
  if (options.version) {
    showVersion();
    process.exit(0);
  }

  // Handle fallback flag
  if (options.fallback) {
    await runFallback();
    return;
  }

  // Check terminal capabilities
  if (!process.stdout.isTTY) {
    console.error('Error: This application requires an interactive terminal (TTY)');
    console.error('Use --fallback to run the non-interactive Bash script instead');
    process.exit(1);
  }

  // Check terminal size
  const { columns, rows } = process.stdout;
  if (columns < 40 || rows < 10) {
    console.error('Error: Terminal is too small');
    console.error(`Minimum size: 40x10, Current: ${columns}x${rows}`);
    console.error('Please resize your terminal or use --fallback');
    process.exit(1);
  }

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('\n❌ Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('\n❌ Unhandled Rejection:', reason);
    process.exit(1);
  });

  // Handle SIGINT gracefully
  process.on('SIGINT', () => {
    console.log('\n\n👋 Goodbye!');
    process.exit(0);
  });

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    process.exit(0);
  });

  // Load saved token if available
  let initialToken: string | null = null;
  if (!options.token) {
    try {
      const tokenData = await readTokenData();
      if (tokenData?.token) {
        initialToken = tokenData.token;
      }
    } catch {
      // No saved token, will show auth screen
    }
  } else {
    initialToken = options.token;
  }

  // Render the Ink app
  render(<App initialToken={initialToken} />);
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
