/**
 * Tests for Token Storage
 * 
 * Tests cover:
 * - Token save/load operations
 * - Token obfuscation/deobfuscation
 * - Checksum validation
 * - Expiry checking
 * - Saved locations management
 * - Error handling
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  TokenStorage,
  tokenStorage,
  isAuthenticated,
  getToken,
  saveToken,
  deleteToken,
  validateToken,
  type TokenData,
  type SavedLocation,
} from '../utils/token-storage.js';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
  unlink: jest.fn().mockResolvedValue(undefined),
  access: jest.fn(),
}));

// Mock os module
jest.mock('os', () => ({
  hostname: jest.fn().mockReturnValue('test-host'),
  platform: jest.fn().mockReturnValue('linux'),
  homedir: jest.fn().mockReturnValue('/home/test'),
}));

describe('TokenStorage', () => {
  let storage: TokenStorage;
  const testToken = 'test-token-12345';
  const mockTokenDir = '/home/test/.config/ny-cli';
  const mockTokenFile = path.join(mockTokenDir, 'auth.json');

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new TokenStorage();
    storage.clearCache();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================

  describe('static methods', () => {
    it('should return token path', () => {
      expect(TokenStorage.getTokenPath()).toBe(mockTokenFile);
    });

    it('should return token directory', () => {
      expect(TokenStorage.getTokenDir()).toBe(mockTokenDir);
    });
  });

  // ===========================================================================
  // Save Token Tests
  // ===========================================================================

  describe('save', () => {
    it('should save token successfully', async () => {
      await storage.save(testToken);

      expect(fs.mkdir).toHaveBeenCalledWith(mockTokenDir, { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        mockTokenFile,
        expect.any(String),
        { mode: 0o600 }
      );
    });

    it('should save token with saved locations', async () => {
      const savedLocations: SavedLocation[] = [
        { tag: 'Home', lat: 12.97, lon: 77.59, locationName: 'My Home' },
        { tag: 'Work', lat: 12.93, lon: 77.62, locationName: 'Office' },
      ];

      await storage.save(testToken, { savedLocations });

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      expect(writtenData.savedLocations).toHaveLength(2);
      expect(writtenData.savedLocations[0].tag).toBe('Home');
    });

    it('should save token with expiry date', async () => {
      const expiresAt = new Date('2024-12-31T23:59:59Z');

      await storage.save(testToken, { expiresAt });

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      expect(writtenData.expiresAt).toBe('2024-12-31T23:59:59.000Z');
    });

    it('should save token with user info', async () => {
      const user = { id: 'user-123', name: 'John Doe', phone: '+919876543210' };

      await storage.save(testToken, { user });

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      expect(writtenData.user).toEqual(user);
    });

    it('should generate valid checksum', async () => {
      await storage.save(testToken);

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      expect(writtenData.checksum).toBeDefined();
      expect(writtenData.checksum).toHaveLength(16);
    });

    it('should set default expiry of 30 days', async () => {
      const beforeSave = new Date();
      await storage.save(testToken);

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      const expiresAt = new Date(writtenData.expiresAt);
      const expectedExpiry = new Date(beforeSave.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Allow 1 minute tolerance
      const diff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
      expect(diff).toBeLessThan(60000);
    });
  });

  // ===========================================================================
  // Load Token Tests
  // ===========================================================================

  describe('load', () => {
    it('should load token data successfully', async () => {
      const mockData: TokenData = {
        token: 'obfuscated-token',
        savedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-12-31T23:59:59Z',
        savedLocations: [],
        savedLocationsUpdatedAt: '2024-01-01T00:00:00Z',
        checksum: 'valid-checksum',
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

      const result = await storage.load();

      expect(result).not.toBeNull();
      expect(result?.savedAt).toBe('2024-01-01T00:00:00Z');
    });

    it('should return null when file does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const result = await storage.load();

      expect(result).toBeNull();
    });

    it('should return null on invalid JSON', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('invalid json');

      const result = await storage.load();

      expect(result).toBeNull();
    });

    it('should use cached data after first load', async () => {
      const mockData: TokenData = {
        token: 'obfuscated-token',
        savedAt: '2024-01-01T00:00:00Z',
        savedLocations: [],
        savedLocationsUpdatedAt: '2024-01-01T00:00:00Z',
        checksum: 'valid-checksum',
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

      await storage.load();
      await storage.load();

      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // Get Token Tests
  // ===========================================================================

  describe('getToken', () => {
    it('should return null when no token exists', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const result = await storage.getToken();

      expect(result).toBeNull();
    });

    it('should return deobfuscated token', async () => {
      // First save a token to get the obfuscated version
      await storage.save(testToken);

      // Get the obfuscated token that was written
      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      // Mock reading that data back
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(writtenData));

      // Clear cache to force reload
      storage.clearCache();

      const result = await storage.getToken();

      expect(result).toBe(testToken);
    });
  });

  // ===========================================================================
  // Validation Tests
  // ===========================================================================

  describe('validate', () => {
    it('should return invalid when no token exists', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const result = await storage.validate();

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('No token found');
    });

    it('should return valid for non-expired token', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      await storage.save(testToken, { expiresAt: futureDate });

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(writtenData));
      storage.clearCache();

      const result = await storage.validate();

      expect(result.isValid).toBe(true);
      expect(result.isExpired).toBe(false);
    });

    it('should return expired for past expiry date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await storage.save(testToken, { expiresAt: pastDate });

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(writtenData));
      storage.clearCache();

      const result = await storage.validate();

      expect(result.isValid).toBe(false);
      expect(result.isExpired).toBe(true);
    });
  });

  describe('isValid', () => {
    it('should return true for valid non-expired token', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      await storage.save(testToken, { expiresAt: futureDate });

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(writtenData));
      storage.clearCache();

      const result = await storage.isValid();

      expect(result).toBe(true);
    });

    it('should return false for expired token', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await storage.save(testToken, { expiresAt: pastDate });

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(writtenData));
      storage.clearCache();

      const result = await storage.isValid();

      expect(result).toBe(false);
    });
  });

  describe('isExpired', () => {
    it('should return false for non-expired token', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      await storage.save(testToken, { expiresAt: futureDate });

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(writtenData));
      storage.clearCache();

      const result = await storage.isExpired();

      expect(result).toBe(false);
    });

    it('should return true for expired token', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await storage.save(testToken, { expiresAt: pastDate });

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(writtenData));
      storage.clearCache();

      const result = await storage.isExpired();

      expect(result).toBe(true);
    });
  });

  // ===========================================================================
  // Time Until Expiry Tests
  // ===========================================================================

  describe('getTimeUntilExpiry', () => {
    it('should return null when no token exists', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const result = await storage.getTimeUntilExpiry();

      expect(result).toBeNull();
    });

    it('should return time until expiry', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 24);

      await storage.save(testToken, { expiresAt: futureDate });

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(writtenData));
      storage.clearCache();

      const result = await storage.getTimeUntilExpiry();

      // Should be approximately 24 hours (allow 1 minute tolerance)
      expect(result).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(result).toBeLessThan(25 * 60 * 60 * 1000);
    });
  });

  // ===========================================================================
  // Saved Locations Tests
  // ===========================================================================

  describe('updateSavedLocations', () => {
    it('should update saved locations', async () => {
      await storage.save(testToken);

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(writtenData));

      const newLocations: SavedLocation[] = [
        { tag: 'Home', lat: 12.97, lon: 77.59 },
        { tag: 'Work', lat: 12.93, lon: 77.62 },
      ];

      await storage.updateSavedLocations(newLocations);

      const updateCall = (fs.writeFile as jest.Mock).mock.calls[1];
      const updatedData = JSON.parse(updateCall[1]);

      expect(updatedData.savedLocations).toHaveLength(2);
      expect(updatedData.savedLocations[0].tag).toBe('Home');
    });

    it('should throw error when no token exists', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      await expect(
        storage.updateSavedLocations([])
      ).rejects.toThrow('No token found');
    });
  });

  describe('getSavedLocations', () => {
    it('should return saved locations', async () => {
      const savedLocations: SavedLocation[] = [
        { tag: 'Home', lat: 12.97, lon: 77.59 },
      ];

      await storage.save(testToken, { savedLocations });

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(writtenData));
      storage.clearCache();

      const result = await storage.getSavedLocations();

      expect(result).toHaveLength(1);
      expect(result[0].tag).toBe('Home');
    });

    it('should return empty array when no locations', async () => {
      await storage.save(testToken);

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(writtenData));
      storage.clearCache();

      const result = await storage.getSavedLocations();

      expect(result).toEqual([]);
    });
  });

  describe('needsLocationRefresh', () => {
    it('should return true when no locations exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const result = await storage.needsLocationRefresh();

      expect(result).toBe(true);
    });

    it('should return true when locations are old', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 2);

      const mockData: TokenData = {
        token: 'obfuscated',
        savedAt: '2024-01-01T00:00:00Z',
        savedLocations: [],
        savedLocationsUpdatedAt: oldDate.toISOString(),
        checksum: 'checksum',
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

      const result = await storage.needsLocationRefresh();

      expect(result).toBe(true);
    });

    it('should return false when locations are fresh', async () => {
      const freshDate = new Date();
      freshDate.setHours(freshDate.getHours() - 1);

      const mockData: TokenData = {
        token: 'obfuscated',
        savedAt: '2024-01-01T00:00:00Z',
        savedLocations: [],
        savedLocationsUpdatedAt: freshDate.toISOString(),
        checksum: 'checksum',
      };

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

      const result = await storage.needsLocationRefresh();

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // Delete Tests
  // ===========================================================================

  describe('delete', () => {
    it('should delete token file', async () => {
      await storage.delete();

      expect(fs.unlink).toHaveBeenCalledWith(mockTokenFile);
    });

    it('should clear cache after delete', async () => {
      await storage.save(testToken);
      await storage.delete();

      // Cache should be cleared
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const result = await storage.load();
      expect(result).toBeNull();
    });

    it('should not throw when file does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.unlink as jest.Mock).mockRejectedValue(error);

      await expect(storage.delete()).resolves.not.toThrow();
    });
  });

  // ===========================================================================
  // Exists Tests
  // ===========================================================================

  describe('exists', () => {
    it('should return true when file exists', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await storage.exists();

      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));

      const result = await storage.exists();

      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // Cache Tests
  // ===========================================================================

  describe('clearCache', () => {
    it('should clear cached data', async () => {
      await storage.save(testToken);

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(writtenData));

      // First load should use file
      await storage.load();
      expect(fs.readFile).toHaveBeenCalledTimes(1);

      // Second load should use cache
      await storage.load();
      expect(fs.readFile).toHaveBeenCalledTimes(1);

      // Clear cache
      storage.clearCache();

      // Next load should read file again
      await storage.load();
      expect(fs.readFile).toHaveBeenCalledTimes(2);
    });
  });
});

// ===========================================================================
// Convenience Functions Tests
// ===========================================================================

describe('Convenience functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenStorage.clearCache();
  });

  describe('isAuthenticated', () => {
    it('should return false when no token', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const result = await isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('getToken', () => {
    it('should return token from storage', async () => {
      const testToken = 'convenience-token';
      await tokenStorage.save(testToken);

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1]);

      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(writtenData));
      tokenStorage.clearCache();

      const result = await getToken();

      expect(result).toBe(testToken);
    });
  });

  describe('saveToken', () => {
    it('should save token via convenience function', async () => {
      await saveToken('new-token', { savedLocations: [] });

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('deleteToken', () => {
    it('should delete token via convenience function', async () => {
      await deleteToken();

      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('should validate token via convenience function', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const result = await validateToken();

      expect(result.isValid).toBe(false);
    });
  });
});