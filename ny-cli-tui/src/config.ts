// Application configuration
export const VERSION = '1.0.0';

export const API_BASE = process.env.NY_API_BASE ?? 'https://api.moving.tech/pilot/app/v2';

export const CLIENT_ID = 'NY_CLI_TUI';

export const POLL_INTERVAL_MS = 2000;

export const SEARCH_POLL_MAX_MS = 30000;

export const DRIVER_POLL_MAX_MS = 60000;

export const TOKEN_DIR = process.env.NY_TOKEN_DIR ?? `${process.env.HOME}/.namma-yatri`;

export const TOKEN_FILE = `${TOKEN_DIR}/token.json`;

export const SAVED_LOCATIONS_REFRESH_MS = 24 * 60 * 60 * 1000; // 24 hours