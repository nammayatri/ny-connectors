import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { Estimate } from '../api/client.js';

// =============================================================================
// Types
// =============================================================================

export interface EstimateSelectProps {
  /** Array of ride estimates to display */
  estimates: Estimate[];
  /** Called when user selects an estimate (or multiple) */
  onSelect: (estimateIds: string[]) => void;
  /** Called when user requests a refresh */
  onRefresh: () => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Origin label for display */
  originLabel?: string;
  /** Destination label for display */
  destLabel?: string;
  /** Allow multi-select mode */
  allowMultiSelect?: boolean;
  /** Show tip options */
  showTips?: boolean;
  /** Available tip amounts */
  availableTips?: number[];
}

interface EstimateItem extends Estimate {
  index: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format seconds to human-readable duration
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format meters to human-readable distance
 */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  const km = meters / 1000;
  return `${km.toFixed(1)}km`;
}

/**
 * Get vehicle icon based on variant
 */
function getVehicleIcon(variant: string): string {
  const v = variant.toUpperCase();
  if (v.includes('AUTO')) return '🛺';
  if (v.includes('BIKE') || v.includes('BIK')) return '🏍️';
  if (v.includes('SEDAN')) return '🚗';
  if (v.includes('SUV')) return '🚙';
  if (v.includes('HATCH')) return '🚗';
  if (v.includes('PREMIUM')) return '✨';
  return '🚕';
}

/**
 * Get color for provider name
 */
function getProviderColor(provider: string): string {
  const p = provider.toLowerCase();
  if (p.includes('namma')) return 'yellow';
  if (p.includes('yatri')) return 'cyan';
  if (p.includes('uber')) return 'white';
  if (p.includes('ola')) return 'green';
  return 'white';
}

// =============================================================================
// Component
// =============================================================================

export function EstimateSelect({
  estimates,
  onSelect,
  onRefresh,
  onCancel,
  isLoading = false,
  originLabel,
  destLabel,
  allowMultiSelect = true,
  showTips = true,
  availableTips = [10, 20, 30, 50],
}: EstimateSelectProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [showTipSelector, setShowTipSelector] = useState(false);
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [tipIndex, setTipIndex] = useState(0);

  // Sort estimates by price (cheapest first)
  const sortedEstimates = useMemo(() => {
    return [...estimates]
      .sort((a, b) => a.estimatedTotalFareWithCurrency.amount - b.estimatedTotalFareWithCurrency.amount)
      .map((e, i) => ({ ...e, index: i }));
  }, [estimates]);

  // Reset selection when estimates change
  useEffect(() => {
    setSelectedIndex(0);
    setSelectedIndices(new Set());
    setMultiSelectMode(false);
    setShowTipSelector(false);
    setSelectedTip(null);
  }, [estimates]);

  // Handle keyboard input
  useInput((input, key) => {
    if (isLoading) return;

    // Tip selector mode
    if (showTipSelector) {
      if (key.upArrow) {
        setTipIndex(prev => (prev > 0 ? prev - 1 : availableTips.length));
      } else if (key.downArrow) {
        setTipIndex(prev => (prev < availableTips.length ? prev + 1 : 0));
      } else if (key.return) {
        if (tipIndex === availableTips.length) {
          // No tip selected
          setSelectedTip(null);
        } else {
          setSelectedTip(availableTips[tipIndex]);
        }
        confirmSelection();
        setShowTipSelector(false);
      } else if (key.escape) {
        setShowTipSelector(false);
      }
      return;
    }

    // Navigation
    if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : sortedEstimates.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => (prev < sortedEstimates.length - 1 ? prev + 1 : 0));
    }

    // Multi-select toggle
    if (input === ' ' && allowMultiSelect && multiSelectMode) {
      setSelectedIndices(prev => {
        const newSet = new Set(prev);
        if (newSet.has(selectedIndex)) {
          newSet.delete(selectedIndex);
        } else {
          newSet.add(selectedIndex);
        }
        return newSet;
      });
    }

    // Toggle multi-select mode
    if (input === 'm' && allowMultiSelect) {
      setMultiSelectMode(prev => !prev);
      if (!multiSelectMode) {
        setSelectedIndices(new Set([selectedIndex]));
      }
    }

    // Refresh
    if (input === 'r') {
      onRefresh();
    }

    // Select/confirm
    if (key.return) {
      if (showTips && !showTipSelector) {
        setShowTipSelector(true);
        setTipIndex(availableTips.length); // Default to "No tip"
      } else {
        confirmSelection();
      }
    }

    // Cancel
    if (key.escape) {
      onCancel();
    }
  }, { isActive: true });

  // Confirm selection
  const confirmSelection = useCallback(() => {
    if (multiSelectMode && selectedIndices.size > 0) {
      const ids = Array.from(selectedIndices).map(i => sortedEstimates[i].id);
      onSelect(ids);
    } else if (sortedEstimates.length > 0) {
      onSelect([sortedEstimates[selectedIndex].id]);
    }
  }, [multiSelectMode, selectedIndices, selectedIndex, sortedEstimates, onSelect]);

  // Render tip selector
  if (showTipSelector) {
    const currentEstimate = sortedEstimates[selectedIndex];
    const tipOptions = [...availableTips, 0]; // 0 = No tip

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>Add a tip to your ride?</Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text dimColor>
            Selected: {getVehicleIcon(currentEstimate.vehicleVariant)} {currentEstimate.serviceTierName} - 
            ₹{currentEstimate.estimatedTotalFareWithCurrency.amount}
          </Text>
        </Box>

        <Box flexDirection="column" marginLeft={2}>
          {tipOptions.map((tip, i) => (
            <Box key={tip}>
              <Text
                color={tipIndex === i ? 'cyan' : undefined}
                bold={tipIndex === i}
              >
                {tipIndex === i ? '→ ' : '  '}
                {tip === 0 ? 'No tip' : `₹${tip} tip`}
              </Text>
            </Box>
          ))}
        </Box>

        <Box marginTop={2}>
          <Text dimColor>↑↓ Navigate | Enter to confirm | ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text> Searching for rides...</Text>
        </Box>
      </Box>
    );
  }

  // No estimates
  if (sortedEstimates.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow" bold>No rides found</Text>
        <Box marginTop={1}>
          <Text dimColor>Try different locations or search again.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press 'r' to refresh | ESC to cancel</Text>
        </Box>
      </Box>
    );
  }

  // Main render
  return (
    <Box flexDirection="column">
      {/* Route info */}
      {(originLabel || destLabel) && (
        <Box flexDirection="column" marginBottom={1}>
          {originLabel && (
            <Box>
              <Text bold>From: </Text>
              <Text color="green">{originLabel}</Text>
            </Box>
          )}
          {destLabel && (
            <Box>
              <Text bold>To: </Text>
              <Text color="green">{destLabel}</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="yellow">
          🚕 Found {sortedEstimates.length} ride{sortedEstimates.length !== 1 ? 's' : ''}
        </Text>
        {multiSelectMode && (
          <Box marginLeft={2}>
            <Text color="magenta" bold>[Multi-select: {selectedIndices.size} selected]</Text>
          </Box>
        )}
      </Box>

      {/* Estimates list */}
      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
        {sortedEstimates.map((estimate, index) => {
          const isSelected = index === selectedIndex;
          const isMultiSelected = selectedIndices.has(index);
          const fare = estimate.estimatedTotalFareWithCurrency;
          const pickupTime = estimate.estimatedPickupDuration
            ? formatDuration(estimate.estimatedPickupDuration)
            : 'N/A';
          const distance = estimate.estimatedDistance
            ? formatDistance(estimate.estimatedDistance)
            : null;
          const tripDuration = estimate.estimatedDuration
            ? formatDuration(estimate.estimatedDuration)
            : null;

          return (
            <Box
              key={estimate.id}
              flexDirection="column"
              paddingY={index === selectedIndex ? 1 : 0}
              borderStyle={isSelected ? 'round' : undefined}
              borderColor={isSelected ? 'cyan' : undefined}
            >
              {/* Main row */}
              <Box>
                {/* Selection indicator */}
                <Box width={3}>
                  {multiSelectMode ? (
                    <Text color={isMultiSelected ? 'green' : 'gray'}>
                      {isMultiSelected ? '☑' : '☐'}
                    </Text>
                  ) : (
                    <Text color={isSelected ? 'cyan' : undefined}>
                      {isSelected ? '▶' : ' '}
                    </Text>
                  )}
                </Box>

                {/* Vehicle icon and name */}
                <Box width={25}>
                  <Text>
                    {getVehicleIcon(estimate.vehicleVariant)}{' '}
                    <Text bold={isSelected} color={isSelected ? 'white' : undefined}>
                      {estimate.serviceTierName}
                    </Text>
                  </Text>
                </Box>

                {/* Fare */}
                <Box width={12}>
                  <Text bold color="green">
                    ₹{fare.amount}
                  </Text>
                  {estimate.totalFareRange && (
                    <Text dimColor>
                      {' '}(₹{estimate.totalFareRange.minFare}-₹{estimate.totalFareRange.maxFare})
                    </Text>
                  )}
                </Box>

                {/* ETA */}
                <Box width={10}>
                  <Text color="yellow">⏱ {pickupTime}</Text>
                </Box>
              </Box>

              {/* Details row (only for selected) */}
              {isSelected && (
                <Box marginLeft={3} marginTop={0}>
                  <Text dimColor>
                    {estimate.providerName && (
                      <Text color={getProviderColor(estimate.providerName)}>
                        {estimate.providerName}
                      </Text>
                    )}
                    {estimate.vehicleVariant && (
                      <Text> • {estimate.vehicleVariant.replace(/_/g, ' ').toLowerCase()}</Text>
                    )}
                    {distance && <Text> • {distance}</Text>}
                    {tripDuration && <Text> • {tripDuration} trip</Text>}
                  </Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Help text */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          ↑↓ Navigate | Enter Select{showTips ? ' + Add Tip' : ''} | 
          {allowMultiSelect ? ' m Multi-select |' : ''} r Refresh | ESC Cancel
        </Text>
        {multiSelectMode && (
          <Text dimColor>Space Toggle selection | Enter Confirm all selected</Text>
        )}
      </Box>
    </Box>
  );
}

// =============================================================================
// Default Export
// =============================================================================

export default EstimateSelect;