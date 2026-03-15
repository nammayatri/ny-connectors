import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { Screen } from '../app.js';

/**
 * Menu item definition for the main menu
 */
interface MenuItem {
  /** Display label with optional emoji prefix */
  label: string;
  /** Screen to navigate to when selected */
  value: Screen;
  /** Whether this item is disabled */
  disabled?: boolean;
  /** Description shown when item is disabled */
  disabledReason?: string;
  /** Keyboard shortcut key */
  shortcut?: string;
}

/**
 * Props for the MainMenu component
 */
interface MainMenuProps {
  /** Whether the user is authenticated */
  hasToken: boolean;
  /** Callback when user selects a screen to navigate to */
  onNavigate: (screen: Screen) => void;
  /** Callback when user wants to exit the application */
  onExit: () => void;
}

/**
 * MainMenu Component
 * 
 * A polished, interactive main menu with:
 * - Keyboard navigation (arrow keys + Enter)
 * - Fuzzy search filtering (/ to activate)
 * - Keyboard shortcuts for quick access
 * - Visual status indicators
 * - Disabled state handling with explanations
 * 
 * @example
 * ```tsx
 * <MainMenu
 *   hasToken={true}
 *   onNavigate={(screen) => setCurrentScreen(screen)}
 *   onExit={() => process.exit(0)}
 * />
 * ```
 */
export function MainMenu({ hasToken, onNavigate, onExit }: MainMenuProps) {
  // Filter state
  const [filter, setFilter] = useState('');
  const [isFilterActive, setIsFilterActive] = useState(false);

  /**
   * Menu items with authentication-based enablement
   */
  const menuItems: MenuItem[] = useMemo(() => [
    {
      label: '🚕  Book Ride',
      value: 'search' as Screen,
      disabled: !hasToken,
      disabledReason: 'requires authentication',
      shortcut: 'b',
    },
    {
      label: '📋  Check Status',
      value: 'status' as Screen,
      disabled: !hasToken,
      disabledReason: 'requires authentication',
      shortcut: 's',
    },
    {
      label: '❌  Cancel Ride',
      value: 'cancel' as Screen,
      disabled: !hasToken,
      disabledReason: 'requires authentication',
      shortcut: 'c',
    },
    {
      label: '⚙️  Settings',
      value: 'settings' as Screen,
      disabled: false,
      shortcut: 't',
    },
    {
      label: '🚪  Exit',
      value: 'main' as Screen,
      disabled: false,
      shortcut: 'q',
    },
  ], [hasToken]);

  /**
   * Filter menu items based on search query
   */
  const filteredItems = useMemo(() => {
    if (!filter) return menuItems;
    const query = filter.toLowerCase();
    return menuItems.filter(item => 
      item.label.toLowerCase().includes(query) ||
      item.value.toLowerCase().includes(query)
    );
  }, [menuItems, filter]);

  /**
   * Global keyboard handler
   */
  useInput((input, key) => {
    // Activate filter mode
    if (input === '/' && !isFilterActive) {
      setIsFilterActive(true);
      return;
    }

    // Exit filter mode
    if (key.escape && isFilterActive) {
      setIsFilterActive(false);
      setFilter('');
      return;
    }

    // Quick exit from main menu
    if (input === 'q' && !isFilterActive) {
      onExit();
      return;
    }

    // Keyboard shortcuts (only when not filtering)
    if (!isFilterActive && hasToken) {
      if (input === 'b') {
        onNavigate('search');
        return;
      }
      if (input === 's') {
        onNavigate('status');
        return;
      }
      if (input === 'c') {
        onNavigate('cancel');
        return;
      }
      if (input === 't') {
        onNavigate('settings');
        return;
      }
    }
  }, { isActive: true });

  /**
   * Handle menu item selection
   */
  const handleSelect = (item: { value: Screen }) => {
    if (item.value === 'main') {
      onExit();
    } else {
      onNavigate(item.value);
    }
  };

  /**
   * Format menu item label with disabled state
   */
  const formatItemLabel = (item: MenuItem): string => {
    if (item.disabled) {
      return `${item.label} (${item.disabledReason})`;
    }
    return item.label;
  };

  return (
    <Box flexDirection="column">
      {/* Authentication Status Banner */}
      <Box 
        marginBottom={1} 
        paddingX={1}
        borderStyle="round"
        borderColor={hasToken ? 'green' : 'yellow'}
      >
        <Text>
          {hasToken ? (
            <>
              <Text color="green">✓</Text>
              <Text> Authenticated</Text>
            </>
          ) : (
            <>
              <Text color="yellow">⚠</Text>
              <Text> Not authenticated - </Text>
              <Text dimColor>Run 'ny-cli auth' first</Text>
            </>
          )}
        </Text>
      </Box>

      {/* Filter Input (when active) */}
      {isFilterActive && (
        <Box marginBottom={1}>
          <Text dimColor>Search: </Text>
          <TextInput 
            value={filter} 
            onChange={setFilter}
            placeholder="Type to filter menu..."
            showCursor={true}
          />
          <Text dimColor> </Text>
          <Text dimColor color="gray">(ESC to clear)</Text>
        </Box>
      )}

      {/* Menu Title */}
      <Box marginBottom={1}>
        <Text bold>What would you like to do?</Text>
      </Box>

      {/* Menu Options */}
      <Box flexDirection="column">
        <SelectInput
          items={filteredItems.map(item => ({
            label: formatItemLabel(item),
            value: item.value,
            disabled: item.disabled,
          }))}
          onSelect={handleSelect}
          isShowShortcut={true}
        />
      </Box>

      {/* No Results Message */}
      {filteredItems.length === 0 && (
        <Box marginTop={1}>
          <Text dimColor>No matching options found</Text>
        </Box>
      )}

      {/* Help Footer */}
      <Box marginTop={2} flexDirection="column">
        <Box>
          <Text dimColor bold>Keyboard Shortcuts:</Text>
        </Box>
        <Box>
          <Text dimColor>  ↑↓     Navigate menu</Text>
        </Box>
        <Box>
          <Text dimColor>  Enter  Select option</Text>
        </Box>
        <Box>
          <Text dimColor>  /      Filter menu</Text>
        </Box>
        <Box>
          <Text dimColor>  q      Quit</Text>
        </Box>
        {hasToken && (
          <Box marginTop={1}>
            <Text dimColor>Quick access: </Text>
            <Text dimColor color="cyan">b</Text>
            <Text dimColor>=Book </Text>
            <Text dimColor color="cyan">s</Text>
            <Text dimColor>=Status </Text>
            <Text dimColor color="cyan">c</Text>
            <Text dimColor>=Cancel </Text>
            <Text dimColor color="cyan">t</Text>
            <Text dimColor>=Settings</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default MainMenu;