import { input, password } from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TOKEN_DIR = path.join(os.homedir(), '.namma-yatri');
const TOKEN_FILE = path.join(TOKEN_DIR, 'token.json');

/**
 * Person entity from auth response
 */
export interface PersonEntity {
  id: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  maskedMobileNumber?: string;
}

export interface TokenData {
  token: string;
  savedAt: string;
  person?: PersonEntity;
  savedLocations: SavedLocation[];
  savedLocationsUpdatedAt: string;
}

export interface SavedLocation {
  tag: string;
  lat: number;
  lon: number;
  locationName?: string;
  area?: string;
  city?: string;
}

export function readToken(): TokenData | null {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = fs.readFileSync(TOKEN_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Token file doesn't exist or is invalid
  }
  return null;
}

export function saveToken(token: string, savedLocations: SavedLocation[] = [], person?: PersonEntity): void {
  const now = new Date().toISOString();
  const data: TokenData = {
    token,
    savedAt: now,
    person,
    savedLocations,
    savedLocationsUpdatedAt: now,
  };
  
  if (!fs.existsSync(TOKEN_DIR)) {
    fs.mkdirSync(TOKEN_DIR, { recursive: true });
  }
  
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function updateSavedLocations(locations: SavedLocation[]): void {
  const existing = readToken();
  if (existing) {
    const now = new Date().toISOString();
    existing.savedLocations = locations;
    existing.savedLocationsUpdatedAt = now;
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(existing, null, 2), { mode: 0o600 });
  }
}

export async function checkAuth(): Promise<void> {
  const tokenData = readToken();
  
  if (!tokenData?.token) {
    console.log(chalk.yellow('⚠️  Not authenticated.'));
    console.log(chalk.dim('   Please authenticate first.\n'));
    await doAuth();
  }
}

export async function doAuth(): Promise<string> {
  console.log(chalk.bold('\n🔐 Authentication'));
  console.log(chalk.dim('   You can find your access code in the Namma Yatri app under About Us section.\n'));

  const mobile = await input({
    message: 'Mobile number',
    validate: (value) => {
      if (!value.trim()) return 'Mobile number is required';
      if (!/^\d{10}$/.test(value.trim())) return 'Please enter a valid 10-digit mobile number';
      return true;
    },
  });

  const accessCode = await password({
    message: 'Access code',
    validate: (value) => {
      if (!value.trim()) return 'Access code is required';
      return true;
    },
  });

  console.log(chalk.dim('\n   Authenticating...'));

  // TODO: Call actual API
  // For now, simulate successful auth
  const token = `simulated-token-${Date.now()}`;
  const person: PersonEntity = {
    id: 'simulated-user',
    firstName: 'User',
    maskedMobileNumber: `******${mobile.slice(-4)}`,
  };
  saveToken(token, [], person);

  console.log(chalk.green('   ✓ Authenticated successfully!'));
  console.log(chalk.dim(`   Token saved to ${TOKEN_FILE}\n`));

  return token;
}

export function getToken(): string | null {
  const data = readToken();
  return data?.token ?? null;
}

export function getSavedLocations(): SavedLocation[] {
  const data = readToken();
  return data?.savedLocations ?? [];
}