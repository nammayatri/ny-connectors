/**
 * Unit tests for useStateMachine hook
 * Tests state transitions and context updates for the wizard flow
 */

import { renderHook, act } from '@testing-library/react';
import { useStateMachine, StateMachineConfig } from './useStateMachine.js';

// Test types matching the app
 type TestAuthState =
  | 'AUTH_PHONE'
  | 'AUTH_CODE'
  | 'AUTH_LOADING'
  | 'AUTHENTICATED'
  | 'MAIN_MENU';

interface TestAuthContext {
  phone: string;
  accessCode: string;
  token: string | null;
  user: { id: string; name: string } | null;
  error: string | null;
}

// Location flow types
 type TestLocationState =
  | 'SEARCH_ORIGIN'
  | 'SEARCH_DESTINATION'
  | 'SELECT_ESTIMATE'
  | 'CONFIRMED';

interface TestLocationContext {
  origin: { placeId: string; address: string } | null;
  destination: { placeId: string; address: string } | null;
  searchQuery: string;
  searchResults: Array<{ placeId: string; description: string }>;
  selectedEstimateId: string | null;
}

describe('useStateMachine', () => {
  describe('basic functionality', () => {
    it('should initialize with provided initial state and context', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTH_PHONE',
        initialContext: {
          phone: '',
          accessCode: '',
          token: null,
          user: null,
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      expect(result.current.state).toBe('AUTH_PHONE');
      expect(result.current.context).toEqual({
        phone: '',
        accessCode: '',
        token: null,
        user: null,
        error: null,
      });
    });

    it('should transition to a new state with string transition', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTH_PHONE',
        initialContext: {
          phone: '',
          accessCode: '',
          token: null,
          user: null,
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      act(() => {
        result.current.transition('AUTH_CODE');
      });

      expect(result.current.state).toBe('AUTH_CODE');
    });

    it('should transition with context update using object transition', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTH_PHONE',
        initialContext: {
          phone: '',
          accessCode: '',
          token: null,
          user: null,
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      act(() => {
        result.current.transition({
          state: 'AUTH_CODE',
          context: { phone: '+919876543210' },
        });
      });

      expect(result.current.state).toBe('AUTH_CODE');
      expect(result.current.context.phone).toBe('+919876543210');
    });

    it('should preserve existing context during transition', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTH_PHONE',
        initialContext: {
          phone: '+919876543210',
          accessCode: '',
          token: null,
          user: null,
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      act(() => {
        result.current.transition({
          state: 'AUTH_CODE',
          context: { accessCode: 'test-code' },
        });
      });

      expect(result.current.state).toBe('AUTH_CODE');
      expect(result.current.context.phone).toBe('+919876543210');
      expect(result.current.context.accessCode).toBe('test-code');
    });
  });

  describe('updateContext', () => {
    it('should update context partially without changing state', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTH_PHONE',
        initialContext: {
          phone: '',
          accessCode: '',
          token: null,
          user: null,
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      act(() => {
        result.current.updateContext({ phone: '+919876543210' });
      });

      expect(result.current.state).toBe('AUTH_PHONE');
      expect(result.current.context.phone).toBe('+919876543210');
      expect(result.current.context.accessCode).toBe('');
    });

    it('should merge multiple context updates', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTH_PHONE',
        initialContext: {
          phone: '',
          accessCode: '',
          token: null,
          user: null,
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      act(() => {
        result.current.updateContext({ phone: '+919876543210' });
      });

      act(() => {
        result.current.updateContext({ accessCode: 'secret-code' });
      });

      expect(result.current.context.phone).toBe('+919876543210');
      expect(result.current.context.accessCode).toBe('secret-code');
    });
  });

  describe('setContext', () => {
    it('should replace entire context', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTH_PHONE',
        initialContext: {
          phone: '+919876543210',
          accessCode: 'old-code',
          token: null,
          user: null,
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      const newContext: TestAuthContext = {
        phone: '+919876543211',
        accessCode: 'new-code',
        token: 'new-token',
        user: { id: 'user-1', name: 'Test User' },
        error: null,
      };

      act(() => {
        result.current.setContext(newContext);
      });

      expect(result.current.context).toEqual(newContext);
    });

    it('should not change state when setting context', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTH_PHONE',
        initialContext: {
          phone: '',
          accessCode: '',
          token: null,
          user: null,
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      act(() => {
        result.current.setContext({
          phone: '+919876543210',
          accessCode: '',
          token: null,
          user: null,
          error: null,
        });
      });

      expect(result.current.state).toBe('AUTH_PHONE');
    });
  });

  describe('authentication flow: AUTH_PHONE -> AUTH_CODE -> AUTHENTICATED', () => {
    it('should complete full authentication flow', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTH_PHONE',
        initialContext: {
          phone: '',
          accessCode: '',
          token: null,
          user: null,
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      // Step 1: Enter phone number
      act(() => {
        result.current.updateContext({ phone: '+919876543210' });
      });

      expect(result.current.context.phone).toBe('+919876543210');
      expect(result.current.state).toBe('AUTH_PHONE');

      // Step 2: Transition to AUTH_CODE with phone
      act(() => {
        result.current.transition({
          state: 'AUTH_CODE',
          context: { phone: '+919876543210' },
        });
      });

      expect(result.current.state).toBe('AUTH_CODE');
      expect(result.current.context.phone).toBe('+919876543210');

      // Step 3: Enter access code
      act(() => {
        result.current.updateContext({ accessCode: 'my-secret-code' });
      });

      expect(result.current.context.accessCode).toBe('my-secret-code');

      // Step 4: Transition to loading state
      act(() => {
        result.current.transition('AUTH_LOADING');
      });

      expect(result.current.state).toBe('AUTH_LOADING');

      // Step 5: Transition to authenticated with token and user
      act(() => {
        result.current.transition({
          state: 'AUTHENTICATED',
          context: {
            token: 'auth-token-123',
            user: { id: 'user-123', name: 'John Doe' },
          },
        });
      });

      expect(result.current.state).toBe('AUTHENTICATED');
      expect(result.current.context.token).toBe('auth-token-123');
      expect(result.current.context.user).toEqual({ id: 'user-123', name: 'John Doe' });
      expect(result.current.context.phone).toBe('+919876543210');
      expect(result.current.context.accessCode).toBe('my-secret-code');
    });

    it('should handle authentication error and reset', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTH_LOADING',
        initialContext: {
          phone: '+919876543210',
          accessCode: 'wrong-code',
          token: null,
          user: null,
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      // Simulate auth error
      act(() => {
        result.current.transition({
          state: 'AUTH_CODE',
          context: { error: 'Invalid access code' },
        });
      });

      expect(result.current.state).toBe('AUTH_CODE');
      expect(result.current.context.error).toBe('Invalid access code');
      expect(result.current.context.phone).toBe('+919876543210');
    });

    it('should transition from authenticated to main menu', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTHENTICATED',
        initialContext: {
          phone: '+919876543210',
          accessCode: 'code',
          token: 'token-123',
          user: { id: 'user-1', name: 'Test' },
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      act(() => {
        result.current.transition('MAIN_MENU');
      });

      expect(result.current.state).toBe('MAIN_MENU');
      expect(result.current.context.token).toBe('token-123');
    });
  });

  describe('location selection flow', () => {
    it('should update context when selecting origin', () => {
      const config: StateMachineConfig<TestLocationState, TestLocationContext> = {
        initialState: 'SEARCH_ORIGIN',
        initialContext: {
          origin: null,
          destination: null,
          searchQuery: '',
          searchResults: [],
          selectedEstimateId: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      // Type search query
      act(() => {
        result.current.updateContext({ searchQuery: 'koramangala' });
      });

      expect(result.current.context.searchQuery).toBe('koramangala');

      // Update search results
      const mockResults = [
        { placeId: 'place-1', description: 'Koramangala, Bangalore' },
        { placeId: 'place-2', description: 'Koramangala 5th Block' },
      ];

      act(() => {
        result.current.updateContext({ searchResults: mockResults });
      });

      expect(result.current.context.searchResults).toHaveLength(2);

      // Select origin
      act(() => {
        result.current.transition({
          state: 'SEARCH_DESTINATION',
          context: {
            origin: { placeId: 'place-1', address: 'Koramangala, Bangalore' },
            searchQuery: '',
            searchResults: [],
          },
        });
      });

      expect(result.current.state).toBe('SEARCH_DESTINATION');
      expect(result.current.context.origin).toEqual({
        placeId: 'place-1',
        address: 'Koramangala, Bangalore',
      });
      expect(result.current.context.searchQuery).toBe('');
      expect(result.current.context.searchResults).toEqual([]);
    });

    it('should complete full location selection flow', () => {
      const config: StateMachineConfig<TestLocationState, TestLocationContext> = {
        initialState: 'SEARCH_ORIGIN',
        initialContext: {
          origin: null,
          destination: null,
          searchQuery: '',
          searchResults: [],
          selectedEstimateId: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      // Step 1: Select origin
      act(() => {
        result.current.transition({
          state: 'SEARCH_DESTINATION',
          context: {
            origin: { placeId: 'origin-1', address: 'MG Road' },
          },
        });
      });

      expect(result.current.state).toBe('SEARCH_DESTINATION');
      expect(result.current.context.origin).toEqual({ placeId: 'origin-1', address: 'MG Road' });

      // Step 2: Select destination
      act(() => {
        result.current.transition({
          state: 'SELECT_ESTIMATE',
          context: {
            destination: { placeId: 'dest-1', address: 'Koramangala' },
          },
        });
      });

      expect(result.current.state).toBe('SELECT_ESTIMATE');
      expect(result.current.context.destination).toEqual({ placeId: 'dest-1', address: 'Koramangala' });

      // Step 3: Select estimate
      act(() => {
        result.current.transition({
          state: 'CONFIRMED',
          context: {
            selectedEstimateId: 'est-123',
          },
        });
      });

      expect(result.current.state).toBe('CONFIRMED');
      expect(result.current.context.selectedEstimateId).toBe('est-123');
      expect(result.current.context.origin).toEqual({ placeId: 'origin-1', address: 'MG Road' });
      expect(result.current.context.destination).toEqual({ placeId: 'dest-1', address: 'Koramangala' });
    });

    it('should allow going back to change origin', () => {
      const config: StateMachineConfig<TestLocationState, TestLocationContext> = {
        initialState: 'SEARCH_DESTINATION',
        initialContext: {
          origin: { placeId: 'old-origin', address: 'Old Location' },
          destination: null,
          searchQuery: '',
          searchResults: [],
          selectedEstimateId: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      // Go back to change origin
      act(() => {
        result.current.transition({
          state: 'SEARCH_ORIGIN',
          context: {
            origin: null,
            searchQuery: '',
          },
        });
      });

      expect(result.current.state).toBe('SEARCH_ORIGIN');
      expect(result.current.context.origin).toBeNull();
      expect(result.current.context.searchQuery).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should handle transition without context update', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTH_PHONE',
        initialContext: {
          phone: '+919876543210',
          accessCode: 'code',
          token: null,
          user: null,
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      act(() => {
        result.current.transition({ state: 'AUTH_CODE' });
      });

      expect(result.current.state).toBe('AUTH_CODE');
      expect(result.current.context.phone).toBe('+919876543210');
    });

    it('should handle empty context update', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTH_PHONE',
        initialContext: {
          phone: '+919876543210',
          accessCode: 'code',
          token: null,
          user: null,
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      act(() => {
        result.current.updateContext({});
      });

      expect(result.current.context.phone).toBe('+919876543210');
    });

    it('should handle multiple rapid transitions', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTH_PHONE',
        initialContext: {
          phone: '',
          accessCode: '',
          token: null,
          user: null,
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      act(() => {
        result.current.transition('AUTH_CODE');
        result.current.transition('AUTH_LOADING');
        result.current.transition('AUTHENTICATED');
      });

      expect(result.current.state).toBe('AUTHENTICATED');
    });

    it('should maintain context through multiple transitions', () => {
      const config: StateMachineConfig<TestAuthState, TestAuthContext> = {
        initialState: 'AUTH_PHONE',
        initialContext: {
          phone: '',
          accessCode: '',
          token: null,
          user: null,
          error: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      act(() => {
        result.current.updateContext({ phone: '+919876543210' });
      });

      act(() => {
        result.current.transition('AUTH_CODE');
      });

      act(() => {
        result.current.updateContext({ accessCode: 'secret' });
      });

      act(() => {
        result.current.transition('AUTH_LOADING');
      });

      act(() => {
        result.current.transition({
          state: 'AUTHENTICATED',
          context: { token: 'token-123' },
        });
      });

      expect(result.current.context).toEqual({
        phone: '+919876543210',
        accessCode: 'secret',
        token: 'token-123',
        user: null,
        error: null,
      });
    });
  });

  describe('saved locations integration', () => {
    interface SavedLocationContext {
      savedLocations: Array<{ tag: string; lat: number; lon: number }>;
      selectedLocation: { tag: string; lat: number; lon: number } | null;
    }

    type SavedLocationState = 'SAVED_LOCATIONS' | 'CONFIRMED';

    it('should update context with saved locations', () => {
      const config: StateMachineConfig<SavedLocationState, SavedLocationContext> = {
        initialState: 'SAVED_LOCATIONS',
        initialContext: {
          savedLocations: [],
          selectedLocation: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      const mockSavedLocations = [
        { tag: 'home', lat: 12.9716, lon: 77.5946 },
        { tag: 'work', lat: 12.9352, lon: 77.6245 },
      ];

      act(() => {
        result.current.updateContext({ savedLocations: mockSavedLocations });
      });

      expect(result.current.context.savedLocations).toHaveLength(2);
      expect(result.current.context.savedLocations[0].tag).toBe('home');
    });

    it('should select a saved location and transition', () => {
      const config: StateMachineConfig<SavedLocationState, SavedLocationContext> = {
        initialState: 'SAVED_LOCATIONS',
        initialContext: {
          savedLocations: [
            { tag: 'home', lat: 12.9716, lon: 77.5946 },
            { tag: 'work', lat: 12.9352, lon: 77.6245 },
          ],
          selectedLocation: null,
        },
      };

      const { result } = renderHook(() => useStateMachine(config));

      act(() => {
        result.current.transition({
          state: 'CONFIRMED',
          context: {
            selectedLocation: { tag: 'home', lat: 12.9716, lon: 77.5946 },
          },
        });
      });

      expect(result.current.state).toBe('CONFIRMED');
      expect(result.current.context.selectedLocation).toEqual({
        tag: 'home',
        lat: 12.9716,
        lon: 77.5946,
      });
    });
  });
});
