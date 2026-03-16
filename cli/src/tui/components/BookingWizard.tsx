/**
 * Booking Wizard
 * Multi-step wizard for ride booking using modular step components
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { apiClient, RideEstimate, RideBooking, SavedLocation } from '../../api/index.js';
import { LocationStep, LocationType } from './LocationStep.js';
import { VariantStep } from './VariantStep.js';
import { ConfirmStep } from './ConfirmStep.js';

// =============================================================================
// Types
// =============================================================================

interface BookingWizardProps {
  onBack: () => void;
}

type Step = 'pickup' | 'drop' | 'variant' | 'confirm' | 'complete';

interface Location {
  lat: number;
  lon: number;
  name: string;
  address?: string;
}

interface SelectItem {
  label: string;
  value: string;
}

// =============================================================================
// Component
// =============================================================================

export function BookingWizard({ onBack }: BookingWizardProps): React.ReactElement {
  // State
  const [step, setStep] = useState<Step>('pickup');
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<Location | null>(null);
  const [selectedDest, setSelectedDest] = useState<Location | null>(null);
  const [selectedEstimate, setSelectedEstimate] = useState<RideEstimate | null>(null);
  const [bookingResult, setBookingResult] = useState<RideBooking | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load saved locations on mount
  useEffect(() => {
    const loadSavedLocations = async (): Promise<void> => {
      const cached = apiClient.getSavedLocationsFromCache();
      if (cached.length > 0) {
        setSavedLocations(cached);
      }
      // Refresh in background
      try {
        const fresh = await apiClient.getSavedLocations();
        setSavedLocations(fresh);
      } catch {
        // Use cached version
      }
    };
    loadSavedLocations();
  }, []);

  // Handle pickup selection
  const handlePickupSelect = useCallback((location: Location) => {
    setSelectedOrigin(location);
    setStep('drop');
    setError(null);
  }, []);

  // Handle drop selection
  const handleDropSelect = useCallback((location: Location) => {
    setSelectedDest(location);
    setStep('variant');
    setError(null);
  }, []);

  // Handle variant selection
  const handleVariantSelect = useCallback((estimate: RideEstimate) => {
    setSelectedEstimate(estimate);
    setStep('confirm');
    setError(null);
  }, []);

  // Handle booking confirmation
  const handleConfirm = useCallback((booking: RideBooking | null) => {
    setBookingResult(booking);
    setStep('complete');
  }, []);

  // Handle back navigation
  const handleBack = useCallback(() => {
    switch (step) {
      case 'pickup':
        onBack();
        break;
      case 'drop':
        setStep('pickup');
        break;
      case 'variant':
        setStep('drop');
        break;
      case 'confirm':
        setStep('variant');
        break;
      case 'complete':
        setStep('confirm');
        break;
      default:
        onBack();
    }
  }, [step, onBack]);

  // Get step number for progress
  const getStepNumber = (): string => {
    switch (step) {
      case 'pickup':
        return '1/5';
      case 'drop':
        return '2/5';
      case 'variant':
        return '3/5';
      case 'confirm':
        return '4/5';
      case 'complete':
        return '5/5';
      default:
        return '';
    }
  };

  // Render step content
  const renderStep = () => {
    switch (step) {
      case 'pickup':
        return (
          <LocationStep
            type="pickup"
            onSelect={handlePickupSelect}
            onBack={handleBack}
            savedLocations={savedLocations}
            isFocused={true}
          />
        );

      case 'drop':
        return (
          <LocationStep
            type="drop"
            previousLocation={selectedOrigin}
            onSelect={handleDropSelect}
            onBack={handleBack}
            savedLocations={savedLocations}
            isFocused={true}
          />
        );

      case 'variant':
        return (
          <VariantStep
            origin={selectedOrigin!}
            destination={selectedDest!}
            onSelect={handleVariantSelect}
            onBack={handleBack}
            isFocused={true}
          />
        );

      case 'confirm':
        return (
          <ConfirmStep
            origin={selectedOrigin!}
            destination={selectedDest!}
            estimate={selectedEstimate!}
            onConfirm={handleConfirm}
            onBack={handleBack}
            isFocused={true}
          />
        );

      case 'complete':
        return (
          <Box flexDirection="column" padding={1}>
            <Box marginBottom={1}>
              <Text bold color="green">
                ✓ Ride Booked!
              </Text>
            </Box>

            {/* Booking details */}
            {bookingResult ? (
              <Box flexDirection="column">
                {bookingResult.driverName && (
                  <Box flexDirection="column">
                    <Text>👤 Driver: {bookingResult.driverName}</Text>
                    {bookingResult.driverNumber && (
                      <Text>📞 Phone: {bookingResult.driverNumber}</Text>
                    )}
                    {bookingResult.vehicleNumber && (
                      <Text>🚗 Vehicle: {bookingResult.vehicleNumber}</Text>
                    )}
                    {bookingResult.otp && (
                      <Box marginTop={1}>
                        <Text bold color="yellow">
                          🔐 OTP: {bookingResult.otp}
                        </Text>
                      </Box>
                    )}
                  </Box>
                )}

                {!bookingResult.driverName && (
                  <Text dimColor>
                    Driver assignment in progress. You'll receive a notification shortly.
                  </Text>
                )}
              </Box>
            ) : (
              <Text dimColor>
                Your ride has been booked. You will receive a notification when a driver is assigned.
              </Text>
            )}

            <Box marginTop={2}>
              <SelectInput
                items={[{ label: 'Back to Main Menu', value: 'main' }]}
                onSelect={() => onBack()}
              />
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🚗 Book a Ride
        </Text>
      </Box>

      {/* Progress indicator */}
      <Box marginBottom={1}>
        <Text dimColor>Step: {getStepNumber()}</Text>
      </Box>

      {/* Step content */}
      {renderStep()}

      {/* Error */}
      {error && step !== 'complete' && (
        <Box marginTop={1}>
          <Text color="red">✗ {error}</Text>
        </Box>
      )}

      {/* Footer */}
      {step !== 'pickup' &&
        step !== 'drop' &&
        step !== 'variant' &&
        step !== 'confirm' &&
        step !== 'complete' && (
          <Box marginTop={2}>
            <Text dimColor>[Esc] Back | [Ctrl+C] Exit</Text>
          </Box>
        )}
    </Box>
  );
}