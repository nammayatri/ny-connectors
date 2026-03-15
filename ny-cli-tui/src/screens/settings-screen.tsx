import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';

interface SettingsScreenProps {
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Callback to logout the user */
  onLogout: () => Promise<void>;
  /** Callback to navigate back */
  onBack: () => void;
  /** Callback when authentication is required */
  onAuthRequired: () => void;
  /** Callback for error handling */
  onError: (error: string) => void;
}

interface SettingsItem {
  label: string;
  value: string;
  disabled?: boolean;
  danger?: boolean;
}

/**
 * SettingsScreen Component
 * 
 * Provides access to app settings including:
 * - Authentication status and logout
 * - Token management
 * - About information
 */
export function SettingsScreen({
  isAuthenticated,
  onLogout,
  onBack,
  onAuthRequired,
  onError,
}: SettingsScreenProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showConfirmLogout, setShowConfirmLogout] = useState(false);
  const [logoutComplete, setLogoutComplete] = useState(false);

  /**
   * Menu items based on authentication state
   */
  const menuItems: SettingsItem[] = [
    {
      label: isAuthenticated ? '🔓 Logout' : '🔐 Authenticate',
      value: 'auth',
      danger: isAuthenticated,
    },
    {
      label: 'ℹ️  About Namma Yatri CLI',
      value: 'about',
    },
    {
      label: '⬅️  Back to Main Menu',
      value: 'back',
    },
  ];

  /**
   * Handle menu selection
   */
  const handleSelect = useCallback(async (item: { value: string }) => {
    switch (item.value) {
      case 'auth':
        if (isAuthenticated) {
          setShowConfirmLogout(true);
        } else {
          onAuthRequired();
        }
        break;
      case 'about':
        // About is shown inline, no navigation needed
        break;
      case 'back':
        onBack();
        break;
    }
  }, [isAuthenticated, onAuthRequired, onBack]);

  /**
   * Handle logout confirmation
   */
  const handleLogoutConfirm = useCallback(async (confirm: boolean) => {
    if (!confirm) {
      setShowConfirmLogout(false);
      return;
    }

    setIsLoggingOut(true);
    try {
      await onLogout();
      setLogoutComplete(true);
      setShowConfirmLogout(false);
    } catch (error: any) {
      onError(error.message || 'Logout failed');
    } finally {
      setIsLoggingOut(false);
    }
  }, [onLogout, onError]);

  /**
   * Keyboard handler
   */
  useInput((input, key) => {
    if (key.escape) {
      if (showConfirmLogout) {
        setShowConfirmLogout(false);
      } else if (logoutComplete) {
        setLogoutComplete(false);
      } else {
        onBack();
      }
    }
  });

  // Loading state during logout
  if (isLoggingOut) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
          <Text> Logging out...</Text>
        </Box>
      </Box>
    );
  }

  // Logout confirmation dialog
  if (showConfirmLogout) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="red">⚠ Confirm Logout</Text>
        </Box>
        <Box marginBottom={1}>
          <Text>Are you sure you want to logout? This will remove your authentication token.</Text>
        </Box>
        <SelectInput
          items={[
            { label: 'Yes, logout', value: 'yes' },
            { label: 'No, cancel', value: 'no' },
          ]}
          onSelect={(item) => handleLogoutConfirm(item.value === 'yes')}
        />
        <Box marginTop={1}>
          <Text dimColor>Press ESC to cancel</Text>
        </Box>
      </Box>
    );
  }

  // Logout complete message
  if (logoutComplete) {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="green">✓ Logged out successfully</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>Your authentication token has been removed.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold>⚙️ Settings</Text>
      </Box>

      {/* Authentication Status */}
      <Box 
        marginBottom={1} 
        paddingX={1}
        borderStyle="round"
        borderColor={isAuthenticated ? 'green' : 'yellow'}
      >
        <Text>
          {isAuthenticated ? (
            <>
              <Text color="green">✓ Authenticated</Text>
              <Text dimColor> - Token is stored locally</Text>
            </>
          ) : (
            <>
              <Text color="yellow">⚠ Not authenticated</Text>
              <Text dimColor> - Login required for ride booking</Text>
            </>
          )}
        </Text>
      </Box>

      {/* Menu Options */}
      <Box marginBottom={1}>
        <SelectInput
          items={menuItems.map(item => ({
            label: item.label,
            value: item.value,
          }))}
          onSelect={handleSelect}
        />
      </Box>

      {/* About Section */}
      <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        <Text bold>About Namma Yatri CLI</Text>
        <Box marginTop={1}>
          <Text dimColor>Version: 1.0.0</Text>
        </Box>
        <Box>
          <Text dimColor>A terminal-based interface for booking rides with Namma Yatri.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Built with Ink (React for CLI) and TypeScript.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor color="cyan">
            https://github.com/nammayatri/namma-yatri-cli
          </Text>
        </Box>
      </Box>

      {/* Footer */}
      <Box marginTop={2}>
        <Text dimColor>Press ESC to go back</Text>
      </Box>
    </Box>
  );
}

export default SettingsScreen;