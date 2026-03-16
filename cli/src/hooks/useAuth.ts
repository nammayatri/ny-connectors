// ============================================================================
// Authentication Hook
// Manages auth state and token persistence
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { NammaYatriClient } from '../api/client.js';
import { TokenStorage } from '../utils/storage.js';
import type { AuthCredentials, SavedLocation } from '../types.js';

interface AuthState {
  token: string | null;
  personId: string | null;
  personName: string | null;
  savedLocations: SavedLocation[];
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

interface UseAuthReturn {
  auth: AuthState;
  login: (credentials: AuthCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshSavedLocations: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [auth, setAuth] = useState<AuthState>({
    token: null,
    personId: null,
    personName: null,
    savedLocations: [],
    isLoading: true,
    error: null,
    isAuthenticated: false,
  });

  // Load token on mount
  useEffect(() => {
    const loadToken = async () => {
      try {
        const stored = await TokenStorage.loadToken();
        if (stored && stored.token) {
          setAuth({
            token: stored.token,
            personId: stored.personId || null,
            personName: stored.personName || null,
            savedLocations: stored.savedLocations || [],
            isLoading: false,
            error: null,
            isAuthenticated: true,
          });
        } else {
          setAuth((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        setAuth((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load token',
        }));
      }
    };

    loadToken();
  }, []);

  const login = useCallback(async (credentials: AuthCredentials) => {
    setAuth((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await NammaYatriClient.authenticate(credentials);

      // Fetch saved locations after auth
      const client = new NammaYatriClient(response.token);
      let savedLocations: SavedLocation[] = [];
      try {
        savedLocations = await client.getSavedLocations();
      } catch (e) {
        // Non-critical error, continue without saved locations
      }

      const personName = response.person
        ? [response.person.firstName, response.person.lastName]
            .filter(Boolean)
            .join(' ')
        : null;

      // Save to storage
      await TokenStorage.saveToken({
        token: response.token,
        savedAt: new Date().toISOString(),
        personId: response.personId,
        personName: personName || undefined,
        savedLocations,
        savedLocationsUpdatedAt: new Date().toISOString(),
      });

      setAuth({
        token: response.token,
        personId: response.personId,
        personName,
        savedLocations,
        isLoading: false,
        error: null,
        isAuthenticated: true,
      });
    } catch (error) {
      setAuth((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
        isAuthenticated: false,
      }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await TokenStorage.clearToken();
    setAuth({
      token: null,
      personId: null,
      personName: null,
      savedLocations: [],
      isLoading: false,
      error: null,
      isAuthenticated: false,
    });
  }, []);

  const refreshSavedLocations = useCallback(async () => {
    if (!auth.token) return;

    try {
      const client = new NammaYatriClient(auth.token);
      const savedLocations = await client.getSavedLocations();

      await TokenStorage.updateSavedLocations(savedLocations);

      setAuth((prev) => ({ ...prev, savedLocations }));
    } catch (error) {
      // Non-critical error
    }
  }, [auth.token]);

  return {
    auth,
    login,
    logout,
    refreshSavedLocations,
  };
}

export default useAuth;
