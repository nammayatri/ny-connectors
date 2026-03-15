import React from 'react';
import { Box, Text } from 'ink';
import { colors, componentStyles } from '../../theme.js';

// =============================================================================
// HEADER COMPONENT
// =============================================================================

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

// =============================================================================
// SPINNER COMPONENTS
// =============================================================================

export {
  SpinnerComponent,
  SearchSpinner,
  LoadingSpinner,
  BookingSpinner,
  WaitingSpinner,
  spinnerPresets,
  type SpinnerProps,
} from './Spinner.js';

// =============================================================================
// LOADING STATE COMPONENTS
// =============================================================================

export {
  LoadingState,
  SearchingPlacesState,
  SearchingRidesState,
  ConfirmingBookingState,
  CancellingRideState,
  FetchingStatusState,
  AuthenticatingState,
  LoadingSavedLocationsState,
  InlineLoading,
  LoadingOverlay,
  LoadingWithProgress,
  type LoadingStateType,
  type LoadingStateProps,
  type InlineLoadingProps,
  type LoadingOverlayProps,
  type LoadingWithProgressProps,
} from './LoadingState.js';

// =============================================================================
// LOCATION SEARCH COMPONENT
// =============================================================================

export {
  LocationSearch,
  default as LocationSearchDefault,
  type LocationResult,
  type LocationSearchProps,
} from './LocationSearch.js';

// =============================================================================
// STATUS ROW COMPONENTS
// =============================================================================

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

interface WarningRowProps {
  text: string;
}

export function WarningRow({ text }: WarningRowProps): JSX.Element {
  return (
    <Box>
      <Text color="yellow">⚠</Text>
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

// =============================================================================
// DIVIDER COMPONENT
// =============================================================================

interface DividerProps {
  char?: string;
  width?: number;
}

export function Divider({ char = '─', width = 40 }: DividerProps): JSX.Element {
  return (
    <Box>
      <Text dimColor>{char.repeat(width)}</Text>
    </Box>
  );
}

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export function EmptyState({ icon = '○', title, description }: EmptyStateProps): JSX.Element {
  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      <Text dimColor>{icon}</Text>
      <Text bold>{title}</Text>
      {description && (
        <Text dimColor>{description}</Text>
      )}
    </Box>
  );
}

// =============================================================================
// BADGE COMPONENT
// =============================================================================

interface BadgeProps {
  text: string;
  color?: string;
}

export function Badge({ text, color = colors.primary }: BadgeProps): JSX.Element {
  return (
    <Box>
      <Text color={color} bold>
        {'['}{text}{']'}
      </Text>
    </Box>
  );
}