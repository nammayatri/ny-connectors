import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps): JSX.Element {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">
          {title}
        </Text>
      </Box>
      {subtitle && (
        <Text dimColor>{subtitle}</Text>
      )}
    </Box>
  );
}

interface SpinnerRowProps {
  text: string;
}

export function SpinnerRow({ text }: SpinnerRowProps): JSX.Element {
  return (
    <Box>
      <Text color="yellow">⏳</Text>
      <Text> {text}</Text>
    </Box>
  );
}

interface SuccessRowProps {
  text: string;
}

export function SuccessRow({ text }: SuccessRowProps): JSX.Element {
  return (
    <Box>
      <Text color="green">✓</Text>
      <Text> {text}</Text>
    </Box>
  );
}

interface ErrorRowProps {
  text: string;
}

export function ErrorRow({ text }: ErrorRowProps): JSX.Element {
  return (
    <Box>
      <Text color="red">✗</Text>
      <Text> {text}</Text>
    </Box>
  );
}

interface InfoRowProps {
  label: string;
  value: string | number;
  dim?: boolean;
}

export function InfoRow({ label, value, dim }: InfoRowProps): JSX.Element {
  return (
    <Box>
      <Text bold>{label}:</Text>
      <Text dimColor={dim}> {value}</Text>
    </Box>
  );
}

interface DividerProps {
  char?: string;
}

export function Divider({ char = '─' }: DividerProps): JSX.Element {
  return (
    <Box>
      <Text dimColor>{char.repeat(40)}</Text>
    </Box>
  );
}

// Re-export RideStatus components
export {
  RideStatus,
  RideStatusCompact,
  RideStatusList,
  getStatusConfig,
  isRideActive,
  shouldShowDriver,
  shouldShowOtp,
  mapApiStatus,
  type RideStatusType,
  type RideStatusData,
  type DriverInfo,
  type VehicleInfo,
  type RideStatusProps,
  type RideStatusCompactProps,
  type RideStatusListProps,
} from './ride-status.js';