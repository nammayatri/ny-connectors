import { useState, useCallback } from 'react';
import type { AuthCredentials, PersonAPIEntity, SavedLocation } from '../types/index.js';
import { authenticate } from '../utils/api.js';
import { saveToken } from '../utils/token.js';

interface UseAuthReturn {
  isLoading: boolean;
  error: string | null;
  login: (credentials: AuthCredentials) => Promise<{ token: string; user: PersonAPIEntity | undefined; savedLocations: SavedLocation[] } | null>;
  clearError: () => void;
}

export function useAuth(): UseAuthReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (
    credentials: AuthCredentials
  ): Promise<{ token: string; user: PersonAPIEntity | undefined; savedLocations: SavedLocation[] } | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authenticate(credentials);

      // Save token to disk
      await saveToken({
        token: result.token,
        savedAt: new Date().toISOString(),
        person: result.auth.person,
        savedLocations: result.savedLocations,
        savedLocationsUpdatedAt: new Date().toISOString(),
      });

      return {
        token: result.token,
        user: result.auth.person,
        savedLocations: result.savedLocations,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { isLoading, error, login, clearError };
}
