// ============================================================================
// Ride Type Screen Component
// Select ride variant with fare estimates
// ============================================================================

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import type { RideEstimate } from '../types.js';

interface RideTypeScreenProps {
  estimates: RideEstimate[];
  isLoading: boolean;
  error: string | null;
  onSelectEstimate: (estimateId: string, tipAmount?: number) => void;
  onBack: () => void;
}

export function RideTypeScreen({
  estimates,
  isLoading,
  error,
  onSelectEstimate,
  onBack,
}: RideTypeScreenProps) {
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState<number>(0);

  const handleSelect = useCallback(
    (item: { value: string; label: string }) => {
      setSelectedEstimateId(item.value);
    },
    []
  );

  const handleConfirm = useCallback(() => {
    if (selectedEstimateId) {
      onSelectEstimate(selectedEstimateId, tipAmount > 0 ? tipAmount : undefined);
    }
  }, [selectedEstimateId, tipAmount, onSelectEstimate]);

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.return && selectedEstimateId) {
      handleConfirm();
      return;
    }

    // Quick tip selection with number keys
    if (selectedEstimateId && /^[0-9]$/.test(input)) {
      const estimate = estimates.find((e) => e.id === selectedEstimateId);
      if (estimate?.tipOptions) {
        const index = parseInt(input, 10) - 1;
        if (index >= 0 && index < estimate.tipOptions.length) {
          setTipAmount(estimate.tipOptions[index]);
        }
      }
    }
  });

  const estimateItems = estimates.map((estimate) => ({
    label: formatEstimateLabel(estimate),
    value: estimate.id,
  }));

  const selectedEstimate = estimates.find((e) => e.id === selectedEstimateId);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🚗 Select Ride Type
        </Text>
      </Box>

      {isLoading && estimates.length === 0 && (
        <Box marginBottom={1}>
          <Text color="yellow">
            <Spinner type="dots" /> Finding available rides...
          </Text>
        </Box>
      )}

      {error && (
        <Box marginBottom={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}

      {!isLoading && estimates.length === 0 && !error && (
        <Box marginBottom={1}>
          <Text dimColor>No rides available for this route.</Text>
        </Box>
      )}

      {estimates.length > 0 && (
        <>
          <Box marginBottom={1}>
            <Text dimColor>Choose a ride option:</Text>
          </Box>

          <Box marginBottom={1}>
            <SelectInput items={estimateItems} onSelect={handleSelect} />
          </Box>

          {selectedEstimate && (
            <Box flexDirection="column" marginTop={1} borderStyle="single" paddingX={1}>
              <Box marginBottom={1}>
                <Text bold color="green">
                  Selected: {selectedEstimate.serviceTierName}
                </Text>
              </Box>

              <Box>
                <Text dimColor>Fare: </Text>
                <Text bold>
                  {selectedEstimate.estimatedTotalFareWithCurrency.currency}{' '}
                  {selectedEstimate.estimatedTotalFareWithCurrency.amount}
                </Text>
              </Box>

              {selectedEstimate.totalFareRange && (
                <Box>
                  <Text dimColor>Range: </Text>
                  <Text>
                    ₹{selectedEstimate.totalFareRange.minFare} - ₹{selectedEstimate.totalFareRange.maxFare}
                  </Text>
                </Box>
              )}

              {selectedEstimate.estimatedPickupDuration && (
                <Box>
                  <Text dimColor>Pickup: </Text>
                  <Text>{selectedEstimate.estimatedPickupDuration}s</Text>
                </Box>
              )}

              {selectedEstimate.tipOptions && selectedEstimate.tipOptions.length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                  <Text dimColor>Add tip (optional):</Text>
                  <Box>
                    {selectedEstimate.tipOptions.map((tip, index) => (
                      <Box key={tip} marginRight={2}>
                        <Text color={tipAmount === tip ? 'green' : 'gray'}>
                          [{tipAmount === tip ? '✓' : index + 1}] +₹{tip}
                        </Text>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              <Box marginTop={1}>
                <Text dimColor>Press Enter to book this ride</Text>
              </Box>
            </Box>
          )}
        </>
      )}

      <Box marginTop={2}>
        <Text dimColor>
          ↑↓ Navigate • Enter: Select • 1-9: Add tip • Esc: Back
        </Text>
      </Box>
    </Box>
  );
}

function formatEstimateLabel(estimate: RideEstimate): string {
  const fare = `₹${estimate.estimatedTotalFareWithCurrency.amount}`;
  const name = estimate.serviceTierName;
  const variant = estimate.vehicleVariant;
  const pickup = estimate.estimatedPickupDuration
    ? `(${estimate.estimatedPickupDuration}s)`
    : '';

  return `${name} ${variant} — ${fare} ${pickup}`;
}

export default RideTypeScreen;
