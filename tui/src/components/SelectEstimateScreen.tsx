import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import type { SelectEstimateScreenProps, RideEstimate } from '../types/index.js';
import { useRide } from '../hooks/useRide.js';
import { loadToken } from '../utils/token.js';

interface EstimateItem {
  label: string;
  value: string;
  estimate: RideEstimate;
}

export function SelectEstimateScreen({
  estimates: initialEstimates,
  origin,
  destination,
  onSelect,
  onCancel,
}: SelectEstimateScreenProps): JSX.Element {
  const [token, setToken] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<RideEstimate[]>(initialEstimates);
  const { isSearching, error, search, select, clearError } = useRide();

  // Load token and search if no estimates provided
  useEffect(() => {
    async function init() {
      const stored = await loadToken();
      if (stored?.token) {
        setToken(stored.token);

        if (initialEstimates.length === 0) {
          const results = await search(stored.token, origin, destination);
          setEstimates(results);
        }
      }
    }
    init();
  }, [initialEstimates.length, origin, destination, search]);

  const handleSelect = useCallback(async (item: EstimateItem) => {
    if (!token) return;

    try {
      await select(token, item.estimate);
      onSelect(item.estimate);
    } catch {
      // Error is handled by the hook
    }
  }, [token, select, onSelect]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  const items: EstimateItem[] = estimates.map(estimate => {
    const fare = estimate.estimatedTotalFareWithCurrency || estimate.estimatedFareWithCurrency;
    const fareText = fare
      ? `₹${fare.amount}`
      : `₹${estimate.estimatedTotalFare || estimate.estimatedFare}`;

    const pickupTime = estimate.estimatedPickupDuration
      ? `~${Math.round(estimate.estimatedPickupDuration / 60)} min`
      : '';

    const label = `${estimate.serviceTierName} - ${fareText} ${pickupTime}`.trim();

    return {
      label,
      value: estimate.id,
      estimate,
    };
  });

  const originTitle = origin.address.title || origin.address.area || `${origin.lat.toFixed(4)}, ${origin.lon.toFixed(4)}`;
  const destTitle = destination.address.title || destination.address.area || `${destination.lat.toFixed(4)}, ${destination.lon.toFixed(4)}`;

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="green">Select Ride</Text>

      <Box flexDirection="column">
        <Text dimColor>From: {originTitle}</Text>
        <Text dimColor>To: {destTitle}</Text>
      </Box>

      {isSearching && (
        <Text color="yellow">Searching for rides...</Text>
      )}

      {error && (
        <Text color="red">Error: {error}</Text>
      )}

      {items.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Available rides:</Text>
          <SelectInput items={items} onSelect={handleSelect} />
        </Box>
      )}

      {!isSearching && items.length === 0 && !error && (
        <Text dimColor>No rides available for this route.</Text>
      )}

      <Text dimColor marginTop={1}>
        Press Esc to cancel
      </Text>
    </Box>
  );
}
