import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { colors, icons, componentStyles } from '../../theme.js';

/**
 * Validation result for phone number
 */
interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Props for PhoneInput component
 */
export interface PhoneInputProps {
  /** Current phone number value */
  value: string;
  /** Callback when phone number changes */
  onChange: (value: string) => void;
  /** Callback when phone number is submitted (Enter key) */
  onSubmit?: (value: string) => void;
  /** Label text displayed above input */
  label?: string;
  /** Placeholder text when input is empty */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether to show validation errors */
  showValidation?: boolean;
  /** Focus the input (for use with Ink's focus management) */
  isFocused?: boolean;
}

/**
 * Validates an Indian phone number
 * Rules:
 * - Must be exactly 10 digits
 * - Must start with 6, 7, 8, or 9
 * 
 * @param phone - The phone number to validate
 * @returns ValidationResult with isValid flag and optional error message
 */
export function validateIndianPhone(phone: string): ValidationResult {
  // Remove any non-digit characters for validation
  const digits = phone.replace(/\D/g, '');
  
  // Empty input
  if (digits.length === 0) {
    return { isValid: false, error: 'Enter your mobile number' };
  }
  
  // Check for non-digit characters in original input
  if (phone !== digits) {
    return { isValid: false, error: 'Phone number should contain only digits' };
  }
  
  // Check length
  if (digits.length < 10) {
    return { isValid: false, error: `Need ${10 - digits.length} more digit${digits.length === 9 ? '' : 's'}` };
  }
  
  if (digits.length > 10) {
    return { isValid: false, error: 'Phone number should be 10 digits' };
  }
  
  // Check first digit (must be 6-9 for Indian mobile numbers)
  const firstDigit = digits[0];
  if (!['6', '7', '8', '9'].includes(firstDigit)) {
    return { isValid: false, error: 'Indian mobile numbers start with 6, 7, 8, or 9' };
  }
  
  return { isValid: true };
}

/**
 * Formats a phone number for display
 * Adds visual grouping: XXX XXX XXXX
 * 
 * @param phone - The phone number to format
 * @returns Formatted phone number string
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
}

/**
 * PhoneInput Component
 * 
 * A styled phone number input with Indian mobile number validation.
 * Shows inline validation errors and visual feedback.
 * 
 * Features:
 * - Real-time validation as user types
 * - Visual feedback for valid/invalid states
 * - Inline error messages
 * - Supports submission via Enter key
 * 
 * @example
 * ```tsx
 * <PhoneInput
 *   value={phone}
 *   onChange={setPhone}
 *   onSubmit={(validPhone) => handleSubmit(validPhone)}
 *   label="Mobile Number"
 *   showValidation={true}
 * />
 * ```
 */
export function PhoneInput({
  value,
  onChange,
  onSubmit,
  label = 'Mobile Number',
  placeholder = 'Enter 10-digit number',
  disabled = false,
  showValidation = true,
  isFocused = true,
}: PhoneInputProps): JSX.Element {
  const [internalValue, setInternalValue] = useState(value);
  const [touched, setTouched] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  
  // Sync external value changes
  useEffect(() => {
    setInternalValue(value);
  }, [value]);
  
  // Validate current value
  const validation = validateIndianPhone(internalValue);
  
  // Determine if we should show error
  const showError = showValidation && (touched || hasSubmitted) && !validation.isValid;
  const showSuccess = showValidation && touched && validation.isValid;
  
  // Handle value change
  const handleChange = useCallback((newValue: string) => {
    // Only allow digits
    const digits = newValue.replace(/\D/g, '');
    
    // Limit to 10 digits
    const limited = digits.slice(0, 10);
    
    setInternalValue(limited);
    onChange(limited);
    
    // Mark as touched on first change
    if (!touched) {
      setTouched(true);
    }
  }, [onChange, touched]);
  
  // Handle submission
  const handleSubmit = useCallback((submitValue: string) => {
    setHasSubmitted(true);
    
    if (validation.isValid && onSubmit) {
      onSubmit(submitValue);
    }
  }, [validation.isValid, onSubmit]);
  
  // Get input color based on state
  const getInputColor = (): string => {
    if (disabled) return colors.gray[400];
    if (showError) return colors.accent.error;
    if (showSuccess) return colors.accent.success;
    return colors.primary;
  };
  
  // Get status icon
  const getStatusIcon = (): string => {
    if (showError) return icons.cross;
    if (showSuccess) return icons.check;
    return icons.phone;
  };
  
  // Get status color
  const getStatusColor = (): string => {
    if (showError) return colors.accent.error;
    if (showSuccess) return colors.accent.success;
    return colors.gray[500];
  };

  return (
    <Box flexDirection="column">
      {/* Label */}
      <Box marginBottom={1}>
        <Text bold color={disabled ? colors.gray[400] : colors.gray[100]}>
          {label}
        </Text>
        {!disabled && (
          <Text dimColor color={colors.gray[500]}>
            {' '}(India)
          </Text>
        )}
      </Box>
      
      {/* Input row */}
      <Box>
        {/* Status icon */}
        <Box marginRight={1}>
          <Text color={getStatusColor()}>
            {getStatusIcon()}
          </Text>
        </Box>
        
        {/* Country code prefix */}
        <Box marginRight={1}>
          <Text bold color={disabled ? colors.gray[400] : colors.gray[500]}>
            +91
          </Text>
        </Box>
        
        {/* Text input */}
        <Box flexGrow={1}>
          <TextInput
            value={internalValue}
            onChange={handleChange}
            onSubmit={handleSubmit}
            placeholder={placeholder}
            showCursor={isFocused && !disabled}
            focus={isFocused && !disabled}
          />
        </Box>
        
        {/* Digit counter */}
        <Box marginLeft={1}>
          <Text dimColor color={colors.gray[500]}>
            {internalValue.length}/10
          </Text>
        </Box>
      </Box>
      
      {/* Error message */}
      {showError && validation.error && (
        <Box marginTop={1}>
          <Text color={colors.accent.error}>
            {icons.warning} {validation.error}
          </Text>
        </Box>
      )}
      
      {/* Success message */}
      {showSuccess && (
        <Box marginTop={1}>
          <Text color={colors.accent.success}>
            {icons.check} Valid mobile number
          </Text>
        </Box>
      )}
      
      {/* Hint when empty and not touched */}
      {!touched && !internalValue && showValidation && (
        <Box marginTop={1}>
          <Text dimColor color={colors.gray[400]}>
            Enter your 10-digit mobile number starting with 6, 7, 8, or 9
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Controlled PhoneInput with built-in state management
 * 
 * A convenience wrapper that manages its own state and provides
 * the current valid value via a ref or callback.
 * 
 * @example
 * ```tsx
 * <PhoneInputControlled
 *   onValidChange={(phone) => console.log('Valid phone:', phone)}
 *   onSubmit={(phone) => handleSubmit(phone)}
 * />
 * ```
 */
export interface PhoneInputControlledProps {
  /** Initial value */
  defaultValue?: string;
  /** Callback when a valid phone number is entered */
  onValidChange?: (value: string) => void;
  /** Callback when submitted with valid phone number */
  onSubmit?: (value: string) => void;
  /** Label text */
  label?: string;
  /** Whether to show validation */
  showValidation?: boolean;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Whether input is focused */
  isFocused?: boolean;
}

export function PhoneInputControlled({
  defaultValue = '',
  onValidChange,
  onSubmit,
  label,
  showValidation = true,
  disabled = false,
  isFocused = true,
}: PhoneInputControlledProps): JSX.Element {
  const [value, setValue] = useState(defaultValue);
  
  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    
    // Notify parent of valid changes
    const validation = validateIndianPhone(newValue);
    if (validation.isValid && onValidChange) {
      onValidChange(newValue);
    }
  }, [onValidChange]);
  
  return (
    <PhoneInput
      value={value}
      onChange={handleChange}
      onSubmit={onSubmit}
      label={label}
      showValidation={showValidation}
      disabled={disabled}
      isFocused={isFocused}
    />
  );
}

export default PhoneInput;