import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput, { type Item as SelectItem } from 'ink-select-input';
import type { NYEstimate, NYPlaceDetails } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export interface EstimatesListProps {
  estimates: NYEstimate[];
  origin: NYPlaceDetails;
  destination: NYPlaceDetails;
  isLoading?: boolean;
  onSelect: (primaryEstimateId: string, additionalIds: string[], tipAmount?: number) => void;
  onCancel: () => void;
}

interface EstimateItem extends SelectItem {
  estimate: NYEstimate;
}

interface TipOption {
  label: string;
  value: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(amount: number, currency: string = 'INR'): string {
  if (currency === 'INR') {
    return `₹${amount.toFixed(0)}`;
  }
  return `${currency} ${amount.toFixed(2)}`;
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remainingMinutes} min`;
}

function getFareDisplay(estimate: NYEstimate): string {
  // Prefer total fare with currency object
  if (estimate.estimatedTotalFareWithCurrency) {
    return formatCurrency(
      estimate.estimatedTotalFareWithCurrency.amount,
      estimate.estimatedTotalFareWithCurrency.currency
    );
  }
  
  // Fallback to total fare number
  if (estimate.estimatedTotalFare !== undefined) {
    return formatCurrency(estimate.estimatedTotalFare);
  }
  
  // Fallback to estimated fare with currency
  if (estimate.estimatedFareWithCurrency) {
    return formatCurrency(
      estimate.estimatedFareWithCurrency.amount,
      estimate.estimatedFareWithCurrency.currency
    );
  }
  
  // Final fallback
  return formatCurrency(estimate.estimatedFare || 0);
}

function getFareRangeDisplay(estimate: NYEstimate): string | null {
  if (!estimate.totalFareRange) return null;
  
  const { minFare, maxFare, minFareWithCurrency, maxFareWithCurrency } = estimate.totalFareRange;
  
  if (minFareWithCurrency && maxFareWithCurrency) {
    return `${formatCurrency(minFareWithCurrency.amount, minFareWithCurrency.currency)} - ${formatCurrency(maxFareWithCurrency.amount, maxFareWithCurrency.currency)}`;
  }
  
  if (minFare !== undefined && maxFare !== undefined) {
    return `${formatCurrency(minFare)} - ${formatCurrency(maxFare)}`;
  }
  
  return null;
}

function getVehicleDisplay(estimate: NYEstimate): string {
  const parts: string[] = [];
  
  if (estimate.vehicleVariant) {
    parts.push(estimate.vehicleVariant);
  }
  
  if (estimate.vehicleServiceTierSeatingCapacity) {
    parts.push(`(${estimate.vehicleServiceTierSeatingCapacity} seater)`);
  }
  
  return parts.join(' ');
}

function getProviderDisplay(estimate: NYEstimate): string {
  if (estimate.providerName) {
    return estimate.providerName;
  }
  if (estimate.agencyName) {
    return estimate.agencyName;
  }
  return '';
}

// ============================================================================
// Component
// ============================================================================

export function EstimatesList({
  estimates,
  origin,
  destination,
  isLoading = false,
  onSelect,
  onCancel,
}: EstimatesListProps): JSX.Element {
  const { exit } = useApp();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [showTipMenu, setShowTipMenu] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Prepare tip options
  const tipOptions: TipOption[] = useMemo(() => {
    const options: TipOption[] = [
      { label: 'No Tip', value: 0 },
      { label: '₹10', value: 10 },
      { label: '₹20', value: 20 },
      { label: '₹30', value: 30 },
      { label: '₹50', value: 50 },
    ];
    
    // Add smart tip suggestion if available
    if (estimates[0]?.smartTipSuggestion && estimates[0].smartTipSuggestion > 0) {
      const smartTip = estimates[0].smartTipSuggestion;
      // Only add if not already in list
      if (!options.some(o => o.value === smartTip)) {
        options.push({
          label: `₹${smartTip} (Suggested)`,
          value: smartTip,
        });
      }
    }
    
    return options;
  }, [estimates]);

  // Prepare select items from estimates
  const items: EstimateItem[] = useMemo(() => {
    return estimates.map((estimate) => {
      const fare = getFareDisplay(estimate);
      const fareRange = getFareRangeDisplay(estimate);
      const pickupEta = formatDuration(estimate.estimatedPickupDuration);
      const vehicle = getVehicleDisplay(estimate);
      const provider = getProviderDisplay(estimate);
      
      // Build label parts
      const labelParts: string[] = [estimate.serviceTierName];
      
      if (vehicle) {
        labelParts.push(`• ${vehicle}`);
      }
      
      labelParts.push(`• ${fare}`);
      
      if (fareRange) {
        labelParts.push(`(${fareRange})`);
      }
      
      if (pickupEta) {
        labelParts.push(`• ${pickupEta} away`);
      }
      
      if (provider) {
        labelParts.push(`• ${provider}`);
      }

      return {
        label: labelParts.join(' '),
        value: estimate.id,
        estimate,
      };
    });
  }, [estimates]);

  // Handle primary selection
  const handleSelect = useCallback((item: EstimateItem) => {
    const primaryId = item.value;
    const additionalIds = Array.from(selectedIds).filter(id => id !== primaryId);
    onSelect(primaryId, additionalIds, tipAmount > 0 ? tipAmount : undefined);
  }, [selectedIds, tipAmount, onSelect]);

  // Toggle backup selection
  const toggleBackupSelection = useCallback((estimateId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(estimateId)) {
        newSet.delete(estimateId);
      } else {
        newSet.add(estimateId);
      }
      return newSet;
    });
  }, []);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape) {
      if (showTipMenu) {
        setShowTipMenu(false);
      } else {
        onCancel();
      }
      return;
    }

    if (key.return && !showTipMenu) {
      // Enter key selects the currently focused item
      const focusedItem = items[focusedIndex];
      if (focusedItem) {
        handleSelect(focusedItem);
      }
      return;
    }

    // Space key toggles backup selection
    if (input === ' ' && !showTipMenu) {
      const focusedItem = items[focusedIndex];
      if (focusedItem) {
        toggleBackupSelection(focusedItem.value);
      }
      return;
    }

    // 't' key opens tip menu
    if ((input === 't' || input === 'T') && !showTipMenu) {
      setShowTipMenu(true);
      return;
    }

    // Number keys for quick tip selection
    if (showTipMenu && /^[0-9]$/.test(input)) {
      const index = parseInt(input, 10);
      if (index < tipOptions.length) {
        setTipAmount(tipOptions[index].value);
        setShowTipMenu(false);
      }
    }
  });

  // Handle tip selection
  const handleTipSelect = useCallback((item: TipOption & SelectItem) => {
    setTipAmount(item.value);
    setShowTipMenu(false);
  }, []);

  // Get location display names
  const originName = origin.address.title || origin.address.area || `${origin.lat.toFixed(4)}, ${origin.lon.toFixed(4)}`;
  const destName = destination.address.title || destination.address.area || `${destination.lat.toFixed(4)}, ${destination.lon.toFixed(4)}`;

  // Loading state
  if (isLoading) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold color="cyan">Finding Rides</Text>
        <Box flexDirection="column">
          <Text dimColor>From: {originName}</Text>
          <Text dimColor>To: {destName}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="yellow">
            <Text color="green">⠋</Text> Searching for available rides...
          </Text>
        </Box>
        <Text dimColor marginTop={1}>Press Esc to cancel</Text>
      </Box>
    );
  }

  // Tip menu state
  if (showTipMenu) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold color="cyan">Add Tip</Text>
        <Text dimColor>Select a tip amount to increase your chances of getting a ride</Text>
        
        {estimates[0]?.smartTipReason && (
          <Text color="yellow" wrap="wrap">
            💡 {estimates[0].smartTipReason}
          </Text>
        )}
        
        <Box marginTop={1} flexDirection="column">
          <SelectInput
            items={tipOptions.map((opt, idx) => ({ ...opt, key: String(idx) }))}
            onSelect={handleTipSelect}
          />
        </Box>
        
        <Text dimColor marginTop={1}>
          Press Esc to go back • Enter to select
        </Text>
      </Box>
    );
  }

  // Empty state
  if (items.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text bold color="cyan">Select Ride</Text>
        <Box flexDirection="column">
          <Text dimColor>From: {originName}</Text>
          <Text dimColor>To: {destName}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="red">No rides available for this route.</Text>
        </Box>
        <Text dimColor marginTop={1}>Press Esc to go back</Text>
      </Box>
    );
  }

  // Main estimates list
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="cyan">Select Ride</Text>
      
      <Box flexDirection="column">
        <Text dimColor>From: {originName}</Text>
        <Text dimColor>To: {destName}</Text>
      </Box>

      {/* Tip indicator */}
      {tipAmount > 0 && (
        <Box>
          <Text color="green">Tip added: ₹{tipAmount}</Text>
          <Text dimColor> (Press T to change)</Text>
        </Box>
      )}

      {/* Selected backups indicator */}
      {selectedIds.size > 0 && (
        <Box>
          <Text color="blue">
            {selectedIds.size} backup{selectedIds.size > 1 ? 's' : ''} selected
          </Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        <Text bold>Available rides:</Text>
        <Text dimColor>(Use ↑↓ to navigate, Space to add backup, Enter to select)</Text>
        
        <Box flexDirection="column" marginTop={1}>
          {items.map((item, index) => {
            const isSelected = selectedIds.has(item.value);
            const isFocused = index === focusedIndex;
            
            return (
              <Box key={item.value}>
                <Text
                  color={isFocused ? 'cyan' : undefined}
                  bold={isFocused}
                >
                  {isFocused ? '› ' : '  '}
                  {isSelected ? '☑ ' : '☐ '}
                  {item.label}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Help text */}
      <Box flexDirection="column" marginTop={1}>
        <Text dimColor>
          Press <Text bold>T</Text> to add tip • <Text bold>Space</Text> to toggle backup • <Text bold>Enter</Text> to book
        </Text>
        <Text dimColor>
          Press <Text bold>Esc</Text> to cancel
        </Text>
      </Box>
    </Box>
  );
}
