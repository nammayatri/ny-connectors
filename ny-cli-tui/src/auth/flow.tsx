import React from 'react';
import { render } from 'ink';
import { input, password } from '@inquirer/prompts';
import { saveToken, type SavedLocation } from './token-store.js';
import { apiCall } from '../api/client.js';
import { AuthScreen } from '../ui/screens/auth-screen.js';

export interface AuthOptions {
  mobile?: string;
  code?: string;
  country?: string;
}

export async function runAuthFlow(options: AuthOptions): Promise<void> {
  let mobile = options.mobile;
  let code = options.code;
  const country = options.country ?? 'IN';
  
  // Prompt for missing values
  if (!mobile) {
    mobile = await input({
      message: 'Mobile number',
      validate: (value) => {
        const cleaned = value.replace(/\D/g, '');
        return cleaned.length >= 10 ? true : 'Please enter a valid mobile number';
      },
    });
  }
  
  if (!code) {
    console.log('\n  You can find your access code in the Namma Yatri app under the About Us section.\n');
    code = await password({
      message: 'Access code',
      mask: '*',
    });
  }
  
  // Run auth UI
  const { waitUntilExit } = render(
    <AuthScreen 
      mobile={mobile} 
      code={code} 
      country={country}
      onComplete={(token, locations, firstName) => {
        saveToken(token, { savedLocations: locations, firstName });
      }}
    />
  );
  
  await waitUntilExit();
}

export async function authenticateWithApi(params: {
  mobile: string;
  code: string;
  country: string;
}): Promise<{ token: string; firstName?: string; lastName?: string }> {
  const response = await apiCall<{ token: string; firstName?: string; lastName?: string }>({
    method: 'POST',
    path: '/auth/get-token',
    body: {
      appSecretCode: params.code,
      userMobileNo: params.mobile,
    },
    requireAuth: false,
  });
  
  if (!response.token) {
    throw new Error('Authentication failed: no token received');
  }
  
  return response;
}

export async function fetchSavedLocations(token: string): Promise<SavedLocation[]> {
  try {
    const response = await apiCall<{ list: SavedLocation[] }>({
      method: 'GET',
      path: '/savedLocation/list',
      token,
    });
    
    return response.list ?? [];
  } catch {
    return [];
  }
}