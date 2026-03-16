/**
 * Input Component
 * Wrapper around ink-text-input with consistent styling
 */

import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface InputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  prefix?: string;
  mask?: string;
  focus?: boolean;
  showCursor?: boolean;
  disabled?: boolean;
  error?: string | null;
}

export function Input({
  label,
  value,
  onChange,
  onSubmit,
  placeholder = '',
  prefix,
  mask,
  focus = true,
  showCursor = true,
  disabled = false,
  error,
}: InputProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {label && (
        <Box marginBottom={1}>
          <Text dimColor>{label}</Text>
        </Box>
      )}
      <Box>
        {prefix && (
          <Text color="cyan">{prefix} </Text>
        )}
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder={placeholder}
          mask={mask}
          focus={focus}
          showCursor={showCursor}
        />
      </Box>
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
}