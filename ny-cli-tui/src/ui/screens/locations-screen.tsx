import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Header, Divider, InfoRow } from '../components/index.js';
import type { SavedLocation } from '../../auth/token-store.js';

interface LocationsScreenProps {
  locations: SavedLocation[];
  onRefresh: () => Promise<SavedLocation[]>;
}

export function LocationsScreen({ locations, onRefresh }: LocationsScreenProps): JSX.Element {
  const [locs, setLocs] = useState(locations);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewingDetails, setViewingDetails] = useState<SavedLocation | null>(null);

  useInput((input, key) => {
    if (viewingDetails) {
      if (key.escape || input === 'q') {
        setViewingDetails(null);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(locs.length - 1, prev + 1));
    } else if (key.return && locs[selectedIndex]) {
      setViewingDetails(locs[selectedIndex]);
    } else if (input === 'r' && !refreshing) {
      setRefreshing(true);
      onRefresh()
        .then(setLocs)
        .finally(() => setRefreshing(false));
    } else if (input === 'q' || key.escape) {
      process.exit(0);
    }
  });

  if (locs.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header title="Saved Locations" />
        <Text dimColor>No saved locations found.</Text>
        <Text dimColor>Press 'r' to refresh or 'q' to quit.</Text>
      </Box>
    );
  }

  if (viewingDetails) {
    return (
      <Box flexDirection="column" padding={1}>
        <Header title={viewingDetails.tag} subtitle="Location Details" />
        <Divider />
        <Box flexDirection="column" marginLeft={2}>
          {viewingDetails.locationName && (
            <InfoRow label="Name" value={viewingDetails.locationName} />
          )}
          <InfoRow label="Coordinates" value={`${viewingDetails.lat}, ${viewingDetails.lon}`} dim />
          {viewingDetails.area && <InfoRow label="Area" value={viewingDetails.area} />}
          {viewingDetails.city && <InfoRow label="City" value={viewingDetails.city} />}
          {viewingDetails.address?.street && (
            <InfoRow label="Street" value={viewingDetails.address.street} />
          )}
          {viewingDetails.address?.building && (
            <InfoRow label="Building" value={viewingDetails.address.building} />
          )}
        </Box>
        <Divider />
        <Text dimColor>Press ESC or 'q' to go back</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header title="Saved Locations" subtitle={`${locs.length} location(s)`} />
      <Divider />

      <Box flexDirection="column" marginTop={1}>
        {locs.map((loc, index) => (
          <Box key={`${loc.tag}-${index}`}>
            <Text
              color={index === selectedIndex ? 'cyan' : undefined}
              bold={index === selectedIndex}
            >
              {index === selectedIndex ? '▶ ' : '  '}
              {loc.tag}
            </Text>
            {loc.locationName && (
              <Text dimColor> — {loc.locationName}</Text>
            )}
          </Box>
        ))}
      </Box>

      <Divider />
      
      <Box flexDirection="column">
        <Text dimColor>
          ↑/↓ Navigate | Enter View details | r Refresh | q Quit
        </Text>
        {refreshing && <Text color="yellow">Refreshing...</Text>}
      </Box>
    </Box>
  );
}