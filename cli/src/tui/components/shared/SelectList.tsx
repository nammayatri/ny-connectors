/**
 * SelectList Component
 * Wrapper around ink-select-input with consistent styling
 */

import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

export interface SelectItem {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SelectListProps {
  items: SelectItem[];
  onSelect: (item: SelectItem) => void;
  title?: string;
  emptyMessage?: string;
}

export function SelectList({
  items,
  onSelect,
  title,
  emptyMessage = 'No options available',
}: SelectListProps): React.ReactElement {
  if (items.length === 0) {
    return (
      <Box>
        <Text dimColor>{emptyMessage}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text bold>{title}</Text>
        </Box>
      )}
      <SelectInput
        items={items}
        onSelect={onSelect}
      />
    </Box>
  );
}