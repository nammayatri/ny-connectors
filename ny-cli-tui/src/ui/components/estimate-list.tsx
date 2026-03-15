import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { colors, componentStyles, icons, styleUtils } from '../../theme.js';

// =============================================================================
// TYPES
// =============================================================================

export interface EstimateItem {
  id: string;
  vehicleVariant: string;
  serviceTierName: string;
  providerName: string;
  estimatedTotalFare: number;
  currency?: string;
  estimatedPickupDuration?: number;
  estimatedDistance?: number;
  totalFareRange?: {
    minFare: number;
    maxFare: number;
  };
  isAirConditioned?: boolean;
}

export interface EstimateListProps {
  estimates: EstimateItem[];
  loading?: boolean;
  error?: string | null;
  onSelect?: (estimate: EstimateItem) => void;
  onCancel?: () => void;
  onRetry?: () => void;
  showProvider?: boolean;
  title?: string;
}

interface SkeletonRowProps {
  width: number;
}

interface EstimateRowProps {
  estimate: EstimateItem;
  isSelected: boolean;
  showProvider: boolean;
  columnWidths: ColumnWidths;
  index: number;
}

interface ColumnWidths {
  selector: number;
  vehicle: number;
  price: number;
  eta: number;
  distance: number;
  provider: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const COLUMN_WIDTHS: ColumnWidths = {
  selector: 3,
  vehicle: 16,
  price: 12,
  eta: 8,
  distance: 10,
  provider: 14,
};

const SKELETON_CHARS = ['░', '▒', '▓', '▒'];
const SKELETON_INTERVAL = 100;

// =============================================================================
// VEHICLE ICONS
// =============================================================================

function getVehicleIcon(variant: string): string {
  const v = variant.toLowerCase();
  if (v.includes('auto')) return icons.auto;
  if (v.includes('bike') || v.includes('bike')) return icons.bike;
  return icons.car;
}

function getVehicleDisplayName(variant: string, serviceName?: string): string {
  // Use service tier name if it's more descriptive
  if (serviceName && serviceName.length > 0 && !serviceName.toLowerCase().includes('default')) {
    return styleUtils.truncate(serviceName, 14);
  }
  
  const v = variant.toLowerCase();
  if (v.includes('auto')) return 'Auto';
  if (v.includes('bike')) return 'Bike';
  if (v.includes('suv')) return 'SUV';
  if (v.includes('sedan')) return 'Sedan';
  if (v.includes('hatchback')) return 'Hatchback';
  if (v.includes('premium')) return 'Premium';
  if (v.includes('luxury')) return 'Luxury';
  
  return styleUtils.truncate(variant, 14);
}

// =============================================================================
// SKELETON COMPONENT
// =============================================================================

function SkeletonRow({ width }: SkeletonRowProps): JSX.Element {
  const [frame, setFrame] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % SKELETON_CHARS.length);
    }, SKELETON_INTERVAL);
    
    return () => clearInterval(timer);
  }, []);
  
  const char = SKELETON_CHARS[frame];
  
  return (
    <Box>
      <Text dimColor color={colors.gray[500]}>
        {char.repeat(width)}
      </Text>
    </Box>
  );
}

function LoadingSkeleton({ rows = 5 }: { rows?: number }): JSX.Element {
  const totalWidth = Object.values(COLUMN_WIDTHS).reduce((a, b) => a + b, 0);
  
  return (
    <Box flexDirection="column">
      {Array.from({ length: rows }).map((_, i) => (
        <Box key={i} marginBottom={1}>
          <SkeletonRow width={totalWidth} />
        </Box>
      ))}
    </Box>
  );
}

// =============================================================================
// ESTIMATE ROW COMPONENT
// =============================================================================

function EstimateRow({ 
  estimate, 
  isSelected, 
  showProvider, 
  columnWidths,
  index 
}: EstimateRowProps): JSX.Element {
  const vehicleIcon = getVehicleIcon(estimate.vehicleVariant);
  const vehicleName = getVehicleDisplayName(estimate.vehicleVariant, estimate.serviceTierName);
  const priceDisplay = styleUtils.formatCurrency(estimate.estimatedTotalFare, estimate.currency);
  const etaDisplay = estimate.estimatedPickupDuration 
    ? styleUtils.formatDuration(estimate.estimatedPickupDuration)
    : '--';
  const distanceDisplay = estimate.estimatedDistance
    ? styleUtils.formatDistance(estimate.estimatedDistance)
    : '--';
  
  const selectorColor = isSelected ? colors.primary : colors.gray[600];
  const selectorChar = isSelected ? componentStyles.listItem.indicator.selected : componentStyles.listItem.indicator.unselected;
  
  return (
    <Box>
      {/* Selector column */}
      <Box width={columnWidths.selector}>
        <Text color={selectorColor} bold={isSelected}>
          {selectorChar}
        </Text>
      </Box>
      
      {/* Vehicle column */}
      <Box width={columnWidths.vehicle}>
        <Text color={isSelected ? colors.primary : colors.gray[700]} bold={isSelected}>
          {vehicleIcon} {vehicleName}
        </Text>
      </Box>
      
      {/* Price column */}
      <Box width={columnWidths.price}>
        <Text color={colors.semantic.money} bold>
          {priceDisplay}
        </Text>
        {estimate.totalFareRange && (
          <Text dimColor color={colors.gray[500]}>
            {' '}
            (₹{estimate.totalFareRange.minFare}-₹{estimate.totalFareRange.maxFare})
          </Text>
        )}
      </Box>
      
      {/* ETA column */}
      <Box width={columnWidths.eta}>
        <Text color={colors.semantic.time}>
          {icons.clock} {etaDisplay}
        </Text>
      </Box>
      
      {/* Distance column */}
      <Box width={columnWidths.distance}>
        <Text color={colors.semantic.distance}>
          {distanceDisplay}
        </Text>
      </Box>
      
      {/* Provider column */}
      {showProvider && (
        <Box width={columnWidths.provider}>
          <Text dimColor color={colors.gray[500]}>
            {styleUtils.truncate(estimate.providerName, 12)}
          </Text>
        </Box>
      )}
    </Box>
  );
}

// =============================================================================
// HEADER COMPONENT
// =============================================================================

function EstimateListHeader({ showProvider, columnWidths }: { showProvider: boolean; columnWidths: ColumnWidths }): JSX.Element {
  return (
    <Box marginBottom={1}>
      <Box width={columnWidths.selector}>
        <Text dimColor bold>#</Text>
      </Box>
      <Box width={columnWidths.vehicle}>
        <Text dimColor bold>Vehicle</Text>
      </Box>
      <Box width={columnWidths.price}>
        <Text dimColor bold>Fare</Text>
      </Box>
      <Box width={columnWidths.eta}>
        <Text dimColor bold>ETA</Text>
      </Box>
      <Box width={columnWidths.distance}>
        <Text dimColor bold>Distance</Text>
      </Box>
      {showProvider && (
        <Box width={columnWidths.provider}>
          <Text dimColor bold>Provider</Text>
        </Box>
      )}
    </Box>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function EstimateList({
  estimates,
  loading = false,
  error = null,
  onSelect,
  onCancel,
  onRetry,
  showProvider = true,
  title = 'Available Rides',
}: EstimateListProps): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [columnWidths] = useState(COLUMN_WIDTHS);
  
  // Reset selection when estimates change
  useEffect(() => {
    setSelectedIndex(0);
  }, [estimates.length]);
  
  // Keyboard navigation
  useInput(useCallback((input, key) => {
    // Don't handle input while loading
    if (loading) {
      if (input === 'q' || key.escape) {
        onCancel?.();
      }
      return;
    }
    
    // Error state
    if (error) {
      if (input === 'r') {
        onRetry?.();
      } else if (input === 'q' || key.escape) {
        onCancel?.();
      }
      return;
    }
    
    // Navigation
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(estimates.length - 1, prev + 1));
    } else if (key.return && estimates[selectedIndex]) {
      onSelect?.(estimates[selectedIndex]);
    } else if (input === 'q' || key.escape) {
      onCancel?.();
    }
  }, [loading, error, estimates, selectedIndex, onSelect, onCancel, onRetry]));
  
  // Memoize sorted estimates (by price ascending)
  const sortedEstimates = useMemo(() => {
    return [...estimates].sort((a, b) => a.estimatedTotalFare - b.estimatedTotalFare);
  }, [estimates]);
  
  // Loading state
  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color={colors.primary}>
            {title}
          </Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text color={colors.accent.warning}>
            <Spinner type="dots" />
          </Text>
          <Text dimColor> Searching for rides...</Text>
        </Box>
        
        <LoadingSkeleton rows={5} />
        
        <Box marginTop={1}>
          <Text dimColor>Press ESC or 'q' to cancel</Text>
        </Box>
      </Box>
    );
  }
  
  // Error state
  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color={colors.primary}>
            {title}
          </Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text color={colors.accent.error}>
            {icons.error} Failed to load estimates
          </Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text dimColor>{error}</Text>
        </Box>
        
        <Box marginTop={1}>
          <Text dimColor>Press 'r' to retry or 'q' to cancel</Text>
        </Box>
      </Box>
    );
  }
  
  // Empty state
  if (sortedEstimates.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color={colors.primary}>
            {title}
          </Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text dimColor>No rides available for this route.</Text>
        </Box>
        
        <Box marginTop={1}>
          <Text dimColor>Press 'q' to go back</Text>
        </Box>
      </Box>
    );
  }
  
  // Normal state with estimates
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={colors.primary}>
          {title}
        </Text>
        <Text dimColor> ({sortedEstimates.length} option{sortedEstimates.length !== 1 ? 's' : ''})</Text>
      </Box>
      
      {/* Column headers */}
      <EstimateListHeader showProvider={showProvider} columnWidths={columnWidths} />
      
      {/* Divider */}
      <Box marginBottom={1}>
        <Text dimColor>{componentStyles.divider.char.repeat(50)}</Text>
      </Box>
      
      {/* Estimate rows */}
      <Box flexDirection="column">
        {sortedEstimates.map((estimate, index) => (
          <Box key={estimate.id} marginBottom={1}>
            <EstimateRow
              estimate={estimate}
              isSelected={index === selectedIndex}
              showProvider={showProvider}
              columnWidths={columnWidths}
              index={index}
            />
          </Box>
        ))}
      </Box>
      
      {/* Divider */}
      <Box marginBottom={1}>
        <Text dimColor>{componentStyles.divider.char.repeat(50)}</Text>
      </Box>
      
      {/* Selected estimate details */}
      {sortedEstimates[selectedIndex] && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={colors.gray[700]}>
            Selected: {getVehicleDisplayName(sortedEstimates[selectedIndex].vehicleVariant, sortedEstimates[selectedIndex].serviceTierName)}
          </Text>
          <Text dimColor>
            Fare: {styleUtils.formatCurrency(sortedEstimates[selectedIndex].estimatedTotalFare, sortedEstimates[selectedIndex].currency)}
            {sortedEstimates[selectedIndex].estimatedPickupDuration && 
              ` • Pickup: ${styleUtils.formatDuration(sortedEstimates[selectedIndex].estimatedPickupDuration!)}`
            }
          </Text>
        </Box>
      )}
      
      {/* Help text */}
      <Box>
        <Text dimColor>
          ↑/↓ Navigate | Enter Select | ESC/q Cancel
        </Text>
      </Box>
    </Box>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default EstimateList;