import React from 'react';
import { render } from 'ink';
import { loadToken, updateSavedLocations, needsLocationRefresh } from '../auth/token-store.js';
import { fetchSavedLocations } from '../api/client.js';
import { LocationsScreen } from '../ui/screens/locations-screen.js';

export async function runLocationsFlow(): Promise<void> {
  const token = loadToken();
  
  if (!token) {
    console.log('Not authenticated. Run `ny-cli auth` first.');
    return;
  }
  
  // Refresh locations if needed
  let locations = token.savedLocations;
  
  if (needsLocationRefresh(token)) {
    try {
      const fetched = await fetchSavedLocations();
      locations = fetched as typeof locations;
      updateSavedLocations(locations);
    } catch {
      // Use cached locations
    }
  }
  
  const { waitUntilExit } = render(
    <LocationsScreen 
      locations={locations}
      onRefresh={async () => {
        const fetched = await fetchSavedLocations();
        const newLocations = fetched as typeof locations;
        updateSavedLocations(newLocations);
        return newLocations;
      }}
    />
  );
  
  await waitUntilExit();
}