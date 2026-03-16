/**
 * VariantStep Component
 * Ride variant selection screen with estimates from API
 * Features: loading state, error handling, keyboard navigation,
 * fare display, ETA, and multi-select support
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { apiClient, RideEstimate } from '../../api/index.js';
import { formatCurrency, formatDuration } from '../../utils/format.js';

// =============================================================================
// Types
// =============================================================================

export interface VariantStepProps {
  /** Origin location */
  origin: {
    lat: number;
    lon: number;
    name: string;
    address?: string;
  };
  /** Destination location */
  destination: {
    lat: number;
    lon: number;
    name: string;
    address?: string;
  };
  /** Callback when estimate is selected */
  onSelect: (estimate: RideEstimate) => void;
  /** Callback to go back */
  onBack: () => void;
  /** Whether this step is focused */
  isFocused?: boolean;
}

export interface VariantInfo {
  id: string;
  vehicleVariant: string;
  serviceName: string;
  providerName: string;
  fare: number;
  currency: string;
  minFare?: number;
  maxFare?: number;
  etaSeconds?: number;
  isAirConditioned?: boolean;
  seatingCapacity?: number;
  tipOptions?: number[];
  isBlocked?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const SEARCH_TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 1500;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert API estimate to display-friendly format
 */
function estimateToVariant(estimate: RideEstimate): VariantInfo {
  return {
    id: estimate.id,
    vehicleVariant: estimate.vehicleVariant,
    serviceName: estimate.serviceTierName,
    providerName: estimate.providerName,
    fare: estimate.estimatedTotalFareWithCurrency?.amount ?? estimate.estimatedFare,
    currency: estimate.estimatedTotalFareWithCurrency?.currency ?? 'INR',
    minFare: estimate.totalFareRange?.minFare,
    maxFare: estimate.totalFareRange?.maxFare,
    etaSeconds: estimate.estimatedPickupDuration,
    isAirConditioned: estimate.isAirConditioned,
    seatingCapacity: estimate.vehicleServiceTierSeatingCapacity,
    tipOptions: estimate.tipOptions,
    isBlocked: estimate.isBlockedRoute,
  };
}

/**
 * Format ETA for display
 */
function formatETA(seconds?: number): string {
  if (!seconds) return '--';
  return formatDuration(seconds);
}

/**
 * Get vehicle icon based on variant
 */
function getVehicleIcon(variant: string): string {
  const v = variant.toLowerCase();
  if (v.includes('auto')) return '🛺';
  if (v.includes('bike') || v.includes('bike')) return '🏍️';
  if (v.includes('suv')) return '🚙';
  if (v.includes('premium') || v.includes('luxury')) return '✨';
  if (v.includes('sedan')) return '🚗';
  if (v.includes('hatchback')) return '🚗';
  return '🚕';
}

// =============================================================================
// Component
// =============================================================================

export function VariantStep({
  origin,
  destination,
  onSelect,
  onBack,
  isFocused = true,
}: VariantStepProps): React.ReactElement {
  // State
  const [estimates, setEstimates] = useState<RideEstimate[]>([]);
  const [variants, setVariants] = useState<VariantInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<'searching' | 'polling' | 'done'>('searching');
  const [retryCount, setRetryCount] = useState(0);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  // Start ride search
  const startSearch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSearchStatus('searching');
    setEstimates([]);
    setVariants([]);

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      // Initiate search
      const searchId = await apiClient.searchRides(
        origin.lat,
        origin.lon,
        destination.lat,
        destination.lon
      );

      setSearchStatus('polling');

      // Poll for results with timeout
      const startTime = Date.now();
      let foundEstimates: RideEstimate[] = [];

      while (Date.now() - startTime < SEARCH_TIMEOUT_MS) {
        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        try {
          const results = await apiClient.pollSearchResults(searchId, POLL_INTERVAL_MS);
          
          if (results.length > 0) {
            foundEstimates = results;
            break;
          }
        } catch (pollErr) {
          // Continue polling on transient errors
          if (pollErr instanceof Error && pollErr.message.includes('401')) {
            throw pollErr; // Re-throw auth errors
          }
        }

        // Wait before next poll
        await new Promise((resolve) => {
          pollTimeoutRef.current = setTimeout(resolve, POLL_INTERVAL_MS);
        });
      }

      if (foundEstimates.length === 0) {
        setError('No rides available for this route. Try different locations or try again later.');
      } else {
        // Sort estimates by fare (lowest first)
        const sorted = [...foundEstimates].sort(
          (a, b) =>
            (a.estimatedTotalFareWithCurrency?.amount ?? a.estimatedFare) -
            (b.estimatedTotalFareWithCurrency?.amount ?? b.estimatedFare)
        );
        setEstimates(sorted);
        setVariants(sorted.map(estimateToVariant));
        setSelectedIndex(0);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Ignore abort errors
      }
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
    } finally {
      setIsLoading(false);
      setSearchStatus('done');
    }
  }, [origin, destination]);

  // Start search on mount
  useEffect(() => {
    startSearch();
  }, [startSearch, retryCount]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
  }, []);

  // Handle selection
  const handleSelect = useCallback(
    (index: number) => {
      if (estimates.length > index) {
        onSelect(estimates[index]);
      }
    },
    [estimates, onSelect]
  );

  // Keyboard navigation
  useInput(
    (input, key) => {
      if (!isFocused || isLoading) return;

      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(variants.length - 1, prev + 1));
      } else if (key.return && variants.length > 0) {
        handleSelect(selectedIndex);
      } else if (key.escape) {
        onBack();
      } else if (input === 'r' && error) {
        handleRetry();
      }
    },
    { isActive: isFocused }
  );

  // Render loading state
  if (isLoading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            🚗 Select Ride Variant
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text dimColor>
            From: {origin.name} → To: {destination.name}
          </Text>
        </Box>

        <Box>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Box marginLeft={1}>
            <Text>
              {searchStatus === 'searching'
                ? 'Searching for rides...'
                : 'Finding available drivers...'}
            </Text>
          </Box>
        </Box>

        <Box marginTop={2}>
          <Text dimColor>[Esc] Cancel</Text>
        </Box>
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            🚗 Select Ride Variant
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text dimColor>
            From: {origin.name} → To: {destination.name}
          </Text>
        </Box>

        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="red"
          padding={1}
          marginTop={1}
        >
          <Text color="red" bold>
            ✗ Unable to find rides
          </Text>
          <Box marginTop={1}>
            <Text dimColor>{error}</Text>
          </Box>
        </Box>

        <Box marginTop={2}>
          <Text dimColor>[r] Retry | [Esc] Back</Text>
        </Box>
      </Box>
    );
  }

  // Render empty state
  if (variants.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            🚗 Select Ride Variant
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text dimColor>
            From: {origin.name} → To: {destination.name}
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text dimColor>No ride variants available for this route.</Text>
        </Box>

        <Box marginTop={2}>
          <Text dimColor>[r] Retry | [Esc] Back</Text>
        </Box>
      </Box>
    );
  }

  // Render variants list
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🚗 Select Ride Variant
        </Text>
      </Box>

      {/* Route summary */}
      <Box marginBottom={1}>
        <Text dimColor>
          From: {origin.name} → To: {destination.name}
        </Text>
      </Box>

      {/* Variants count */}
      <Box marginBottom={1}>
        <Text dimColor>{variants.length} ride(s) available</Text>
      </Box>

      {/* Variants list */}
      <Box flexDirection="column" marginTop={1}>
        {variants.map((variant, index) => {
          const isSelected = index === selectedIndex;
          const icon = getVehicleIcon(variant.vehicleVariant);

          return (
            <Box
              key={variant.id}
              flexDirection="column"
              borderStyle={isSelected ? 'round' : undefined}
              borderColor={isSelected ? 'cyan' : undefined}
              paddingX={isSelected ? 1 : 0}
              marginY={isSelected ? 1 : 0}
            >
              {/* Main row */}
              <Box>
                <Text
                  color={isSelected ? 'cyan' : undefined}
                  bold={isSelected}
                  inverse={isSelected}
                >
                  {isSelected ? '❯ ' : '  '}
                  {icon} {variant.serviceName}
                </Text>

                {/* Provider name */}
                {variant.providerName && (
                  <Box marginLeft={1}>
                    <Text dimColor={!isSelected}>({variant.providerName})</Text>
                  </Box>
                )}
              </Box>

              {/* Details row */}
              <Box marginLeft={3}>
                {/* Fare */}
                <Text color="green" bold>
                  {formatCurrency(variant.fare, variant.currency)}
                </Text>

                {/* Fare range if available */}
                {variant.minFare !== undefined && variant.maxFare !== undefined && (
                  <Box marginLeft={1}>
                    <Text dimColor>
                      ({formatCurrency(variant.minFare, variant.currency)} -{' '}
                      {formatCurrency(variant.maxFare, variant.currency)})
                    </Text>
                  </Box>
                )}

                {/* ETA */}
                {variant.etaSeconds && (
                  <Box marginLeft={2}>
                    <Text dimColor={!isSelected}>⏱ {formatETA(variant.etaSeconds)}</Text>
                  </Box>
                )}

                {/* AC indicator */}
                {variant.isAirConditioned && (
                  <Box marginLeft={2}>
                    <Text dimColor={!isSelected}>❄️ AC</Text>
                  </Box>
                )}

                {/* Seating capacity */}
                {variant.seatingCapacity && (
                  <Box marginLeft={2}>
                    <Text dimColor={!isSelected}>👥 {variant.seatingCapacity}</Text>
                  </Box>
                )}
              </Box>

              {/* Blocked route warning */}
              {variant.isBlocked && (
                <Box marginLeft={3}>
                  <Text color="yellow">⚠️ Route may have restrictions</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Selected variant details */}
      {variants.length > 0 && variants[selectedIndex] && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="gray"
          padding={1}
          marginTop={2}
        >
          <Text bold>Selected: {variants[selectedIndex].serviceName}</Text>
          <Box marginTop={1}>
            <Text>
              Fare: {formatCurrency(variants[selectedIndex].fare, variants[selectedIndex].currency)}
            </Text>
          </Box>
          {variants[selectedIndex].etaSeconds && (
            <Box>
              <Text>ETA: {formatETA(variants[selectedIndex].etaSeconds)}</Text>
            </Box>
          )}
          {variants[selectedIndex].tipOptions && variants[selectedIndex].tipOptions!.length > 0 && (
            <Box>
              <Text dimColor>
                Tip options: {variants[selectedIndex].tipOptions!.join(', ')}
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Footer hints */}
      <Box marginTop={2}>
        <Text dimColor>↑↓ Navigate | Enter Select | Esc Back</Text>
      </Box>
    </Box>
  );
}

// =============================================================================
// Hook for managing variant selection with multi-select support
// =============================================================================

export function useVariantSelection(): {
  selectedEstimates: RideEstimate[];
  primaryEstimate: RideEstimate | null;
  selectEstimate: (estimate: RideEstimate, isMulti?: boolean) => void;
  deselectEstimate: (estimateId: string) => void;
  clearSelection: () => void;
  isSelected: (estimateId: string) => boolean;
} {
  const [selectedEstimates, setSelectedEstimates] = useState<RideEstimate[]>([]);

  const selectEstimate = useCallback((estimate: RideEstimate, isMulti = false) => {
    setSelectedEstimates((prev) => {
      if (isMulti) {
        // Add to selection if not already selected
        if (prev.some((e) => e.id === estimate.id)) {
          return prev;
        }
        return [...prev, estimate];
      }
      // Replace selection
      return [estimate];
    });
  }, []);

  const deselectEstimate = useCallback((estimateId: string) => {
    setSelectedEstimates((prev) => prev.filter((e) => e.id !== estimateId));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedEstimates([]);
  }, []);

  const isSelected = useCallback(
    (estimateId: string) => {
      return selectedEstimates.some((e) => e.id === estimateId);
    },
    [selectedEstimates]
  );

  return {
    selectedEstimates,
    primaryEstimate: selectedEstimates[0] || null,
    selectEstimate,
    deselectEstimate,
    clearSelection,
    isSelected,
  };
}