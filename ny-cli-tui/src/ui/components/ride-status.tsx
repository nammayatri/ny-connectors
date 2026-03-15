import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { colors, icons, componentStyles, styleUtils } from '../../theme.js';

// =============================================================================
// TYPES
// =============================================================================

export type RideStatusType = 
  | 'SEARCHING'
  | 'CONFIRMED'
  | 'DRIVER_ASSIGNED'
  | 'ARRIVING'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface DriverInfo {
  name: string;
  phoneNumber?: string;
  rating?: number;
  totalRides?: number;
}

export interface VehicleInfo {
  number: string;
  model?: string;
  variant: string;
  color?: string;
}

export interface RideStatusData {
  id: string;
  status: RideStatusType;
  otp?: string;
  driver?: DriverInfo;
  vehicle?: VehicleInfo;
  estimatedArrival?: number; // seconds until arrival
  estimatedTripDuration?: number; // seconds
  estimatedDistance?: number; // meters
  estimatedFare?: number;
  fromAddress?: string;
  toAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RideStatusProps {
  ride: RideStatusData;
  isPolling?: boolean;
  pollInterval?: number;
  onStatusChange?: (newStatus: RideStatusType) => void;
  onCancel?: () => void;
  showFullDetails?: boolean;
}

// =============================================================================
// STATUS PROGRESSION
// =============================================================================

const STATUS_ORDER: RideStatusType[] = [
  'SEARCHING',
  'CONFIRMED',
  'DRIVER_ASSIGNED',
  'ARRIVING',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
];

const STATUS_CONFIG: Record<RideStatusType, {
  label: string;
  icon: string;
  color: string;
  description: string;
}> = {
  SEARCHING: {
    label: 'Searching',
    icon: '🔍',
    color: colors.accent.info,
    description: 'Looking for nearby drivers...',
  },
  CONFIRMED: {
    label: 'Confirmed',
    icon: '✓',
    color: colors.accent.success,
    description: 'Ride confirmed, assigning driver...',
  },
  DRIVER_ASSIGNED: {
    label: 'Driver Assigned',
    icon: '👤',
    color: colors.accent.success,
    description: 'Driver has been assigned',
  },
  ARRIVING: {
    label: 'Arriving',
    icon: '🚕',
    color: colors.accent.warning,
    description: 'Driver is on the way',
  },
  ARRIVED: {
    label: 'Arrived',
    icon: '📍',
    color: colors.primary,
    description: 'Driver has arrived at pickup',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    icon: '🚗',
    color: colors.primary,
    description: 'Enjoy your ride!',
  },
  COMPLETED: {
    label: 'Completed',
    icon: '✓',
    color: colors.accent.success,
    description: 'Ride completed successfully',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: '✗',
    color: colors.accent.error,
    description: 'Ride was cancelled',
  },
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface StatusProgressProps {
  currentStatus: RideStatusType;
}

function StatusProgress({ currentStatus }: StatusProgressProps): JSX.Element {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const isCancelled = currentStatus === 'CANCELLED';
  const isCompleted = currentStatus === 'COMPLETED';

  // For cancelled/completed, show simplified status
  if (isCancelled || isCompleted) {
    const config = STATUS_CONFIG[currentStatus];
    return (
      <Box flexDirection="column">
        <Box>
          <Text color={config.color} bold>
            {config.icon} {config.label}
          </Text>
        </Box>
        <Text dimColor>{config.description}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Progress bar */}
      <Box marginBottom={1}>
        {STATUS_ORDER.map((status, index) => {
          const config = STATUS_CONFIG[status];
          const isPast = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;

          // Skip some intermediate states for cleaner display
          if (status === 'CONFIRMED' || status === 'ARRIVED') {
            return null;
          }

          return (
            <Box key={status} marginRight={1}>
              {index > 0 && status !== 'ARRIVING' && (
                <Text dimColor={isFuture}>─</Text>
              )}
              <Text
                color={isPast || isCurrent ? config.color : colors.gray[500]}
                bold={isCurrent}
              >
                {isCurrent ? config.icon : isPast ? '●' : '○'}
              </Text>
              {isCurrent && (
                <Text color={config.color} bold>
                  {' '}{config.label}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Current status description */}
      <Text dimColor>{STATUS_CONFIG[currentStatus]?.description}</Text>
    </Box>
  );
}

interface OtpDisplayProps {
  otp: string;
}

function OtpDisplay({ otp }: OtpDisplayProps): JSX.Element {
  // Format OTP with spacing for readability
  const formattedOtp = otp.split('').join(' ');

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.primary}
      paddingX={2}
      paddingY={1}
    >
      <Text dimColor bold>SHARE OTP WITH DRIVER</Text>
      <Box marginTop={1}>
        <Text
          color={colors.primary}
          bold
        >
          {formattedOtp}
        </Text>
      </Box>
    </Box>
  );
}

interface DriverCardProps {
  driver: DriverInfo;
  vehicle: VehicleInfo;
}

function DriverCard({ driver, vehicle }: DriverCardProps): JSX.Element {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="single" borderColor={colors.gray[700]} paddingX={1}>
        <Box flexDirection="column">
          {/* Driver name and rating */}
          <Box>
            <Text bold color={colors.gray[100]}>
              {icons.user} {driver.name}
            </Text>
            {driver.rating !== undefined && (
              <Box marginLeft={2}>
                <Text color={colors.accent.highlight}>
                  {icons.star} {driver.rating.toFixed(1)}
                </Text>
                {driver.totalRides !== undefined && (
                  <Text dimColor> ({driver.totalRides} rides)</Text>
                )}
              </Box>
            )}
          </Box>

          {/* Vehicle info */}
          <Box marginTop={1}>
            <Text color={colors.semantic.money} bold>
              {vehicle.number}
            </Text>
            {vehicle.color && (
              <Text dimColor> • {vehicle.color}</Text>
            )}
            {vehicle.model && (
              <Text dimColor> • {vehicle.model}</Text>
            )}
          </Box>

          {/* Vehicle variant */}
          <Box>
            <Text dimColor>{vehicle.variant}</Text>
          </Box>

          {/* Phone number */}
          {driver.phoneNumber && (
            <Box marginTop={1}>
              <Text color={colors.semantic.link}>
                {icons.phone} {driver.phoneNumber}
              </Text>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

interface EtaDisplayProps {
  eta?: number; // seconds
  distance?: number; // meters
  tripDuration?: number; // seconds
  status: RideStatusType;
}

function EtaDisplay({ eta, distance, tripDuration, status }: EtaDisplayProps): JSX.Element {
  const showArrivalEta = (status === 'ARRIVING' || status === 'DRIVER_ASSIGNED') && eta;
  const showTripEta = status === 'IN_PROGRESS' && tripDuration;

  if (!showArrivalEta && !showTripEta) {
    return <></>;
  }

  return (
    <Box marginTop={1}>
      {showArrivalEta && (
        <Box>
          <Text color={colors.semantic.time} bold>
            {icons.clock} {styleUtils.formatDuration(eta)}
          </Text>
          {distance && (
            <Text dimColor> away ({styleUtils.formatDistance(distance)})</Text>
          )}
        </Box>
      )}
      {showTripEta && (
        <Box>
          <Text color={colors.semantic.time} bold>
            {icons.clock} {styleUtils.formatDuration(tripDuration)} remaining
          </Text>
        </Box>
      )}
    </Box>
  );
}

interface FareDisplayProps {
  fare: number;
  currency?: string;
}

function FareDisplay({ fare, currency = '₹' }: FareDisplayProps): JSX.Element {
  return (
    <Box>
      <Text color={colors.semantic.money} bold>
        {styleUtils.formatCurrency(fare, currency)}
      </Text>
    </Box>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function RideStatus({
  ride,
  isPolling = false,
  pollInterval = 2000,
  onStatusChange,
  onCancel,
  showFullDetails = true,
}: RideStatusProps): JSX.Element {
  const [currentEta, setCurrentEta] = useState(ride.estimatedArrival);
  const [prevStatus, setPrevStatus] = useState(ride.status);

  // Update ETA countdown
  useEffect(() => {
    if (!isPolling || currentEta === undefined) return;

    const interval = setInterval(() => {
      setCurrentEta((prev) => (prev && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [isPolling, currentEta]);

  // Detect status changes
  useEffect(() => {
    if (ride.status !== prevStatus) {
      setPrevStatus(ride.status);
      onStatusChange?.(ride.status);
    }
  }, [ride.status, prevStatus, onStatusChange]);

  const statusConfig = STATUS_CONFIG[ride.status];
  const showOtp = ride.otp && ['DRIVER_ASSIGNED', 'ARRIVING', 'ARRIVED'].includes(ride.status);
  const showDriver = ride.driver && ride.vehicle && 
    ['DRIVER_ASSIGNED', 'ARRIVING', 'ARRIVED', 'IN_PROGRESS'].includes(ride.status);
  const isActive = !['COMPLETED', 'CANCELLED'].includes(ride.status);

  return (
    <Box flexDirection="column">
      {/* Status Progress */}
      <StatusProgress currentStatus={ride.status} />

      {/* OTP Display - Prominent */}
      {showOtp && ride.otp && (
        <Box marginTop={1}>
          <OtpDisplay otp={ride.otp} />
        </Box>
      )}

      {/* Driver Card */}
      {showDriver && ride.driver && ride.vehicle && (
        <DriverCard driver={ride.driver} vehicle={ride.vehicle} />
      )}

      {/* ETA Display */}
      <EtaDisplay
        eta={currentEta}
        distance={ride.estimatedDistance}
        tripDuration={ride.estimatedTripDuration}
        status={ride.status}
      />

      {/* Full Details */}
      {showFullDetails && (
        <Box flexDirection="column" marginTop={1}>
          {/* Route */}
          {ride.fromAddress && (
            <Box>
              <Text dimColor>From: </Text>
              <Text>{ride.fromAddress}</Text>
            </Box>
          )}
          {ride.toAddress && (
            <Box>
              <Text dimColor>To: </Text>
              <Text>{ride.toAddress}</Text>
            </Box>
          )}

          {/* Fare */}
          {ride.estimatedFare && (
            <Box marginTop={1}>
              <Text dimColor>Estimated Fare: </Text>
              <FareDisplay fare={ride.estimatedFare} />
            </Box>
          )}
        </Box>
      )}

      {/* Polling indicator */}
      {isPolling && isActive && (
        <Box marginTop={1}>
          <Text dimColor>
            <Spinner type="dots" /> Live updates
          </Text>
        </Box>
      )}

      {/* Cancel option */}
      {isActive && onCancel && (
        <Box marginTop={1}>
          <Text dimColor>Press 'c' to cancel ride</Text>
        </Box>
      )}
    </Box>
  );
}

// =============================================================================
// COMPACT VARIANT
// =============================================================================

export interface RideStatusCompactProps {
  ride: RideStatusData;
}

export function RideStatusCompact({ ride }: RideStatusCompactProps): JSX.Element {
  const statusConfig = STATUS_CONFIG[ride.status];

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={statusConfig.color} bold>
          {statusConfig.icon} {statusConfig.label}
        </Text>
        {ride.driver?.name && (
          <Text dimColor> — {ride.driver.name}</Text>
        )}
        {ride.vehicle?.number && (
          <Text dimColor> ({ride.vehicle.number})</Text>
        )}
      </Box>
      {ride.otp && (
        <Box>
          <Text color={colors.primary} bold>OTP: {ride.otp}</Text>
        </Box>
      )}
    </Box>
  );
}

// =============================================================================
// STATUS LIST COMPONENT
// =============================================================================

export interface RideStatusListProps {
  rides: RideStatusData[];
  selectedIndex: number;
  onSelect?: (index: number) => void;
}

export function RideStatusList({ rides, selectedIndex, onSelect }: RideStatusListProps): JSX.Element {
  return (
    <Box flexDirection="column">
      {rides.map((ride, index) => {
        const isSelected = index === selectedIndex;
        const statusConfig = STATUS_CONFIG[ride.status];

        return (
          <Box
            key={ride.id}
            marginBottom={1}
            onClick={() => onSelect?.(index)}
          >
            <Text
              color={isSelected ? colors.primary : undefined}
              bold={isSelected}
            >
              {isSelected ? `${icons.pointer} ` : '  '}
            </Text>
            <Text color={statusConfig.color} bold>
              {statusConfig.icon} {statusConfig.label}
            </Text>
            {ride.driver?.name && (
              <Text dimColor> — {ride.driver.name}</Text>
            )}
            {ride.vehicle?.number && (
              <Text dimColor> ({ride.vehicle.number})</Text>
            )}
            {ride.otp && ['ARRIVING', 'DRIVER_ASSIGNED', 'ARRIVED'].includes(ride.status) && (
              <Text color={colors.primary}> OTP: {ride.otp}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the status configuration for a given status
 */
export function getStatusConfig(status: RideStatusType) {
  return STATUS_CONFIG[status];
}

/**
 * Check if a ride status is active (not completed or cancelled)
 */
export function isRideActive(status: RideStatusType): boolean {
  return !['COMPLETED', 'CANCELLED'].includes(status);
}

/**
 * Check if a ride status shows driver info
 */
export function shouldShowDriver(status: RideStatusType): boolean {
  return ['DRIVER_ASSIGNED', 'ARRIVING', 'ARRIVED', 'IN_PROGRESS'].includes(status);
}

/**
 * Check if a ride status should show OTP
 */
export function shouldShowOtp(status: RideStatusType): boolean {
  return ['DRIVER_ASSIGNED', 'ARRIVING', 'ARRIVED'].includes(status);
}

/**
 * Map API status string to our RideStatusType
 */
export function mapApiStatus(apiStatus: string): RideStatusType {
  const statusMap: Record<string, RideStatusType> = {
    'NEW': 'SEARCHING',
    'SEARCHING': 'SEARCHING',
    'CONFIRMED': 'CONFIRMED',
    'DRIVER_ASSIGNED': 'DRIVER_ASSIGNED',
    'ARRIVING': 'ARRIVING',
    'ARRIVED': 'ARRIVED',
    'IN_PROGRESS': 'IN_PROGRESS',
    'INPROGRESS': 'IN_PROGRESS',
    'ONGOING': 'IN_PROGRESS',
    'COMPLETED': 'COMPLETED',
    'CANCELLED': 'CANCELLED',
    'CANCELLED_BY_DRIVER': 'CANCELLED',
    'CANCELLED_BY_USER': 'CANCELLED',
  };

  return statusMap[apiStatus.toUpperCase()] ?? 'SEARCHING';
}