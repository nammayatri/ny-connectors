import React from 'react';
import { render } from 'ink';
import { loadToken } from '../auth/token-store.js';
import { fetchRideStatus } from '../api/client.js';
import { StatusScreen } from '../ui/screens/status-screen.js';

export interface StatusFlowOptions {
  showAll?: boolean;
  limit?: number;
}

export async function runStatusFlow(options: StatusFlowOptions): Promise<void> {
  const token = loadToken();
  
  if (!token) {
    console.log('Not authenticated. Run `ny-cli auth` first.');
    return;
  }
  
  const { waitUntilExit } = render(
    <StatusScreen
      showAll={options.showAll ?? false}
      limit={options.limit ?? 10}
    />
  );
  
  await waitUntilExit();
}