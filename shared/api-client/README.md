# @namma-yatri/api-client

A shared API client for Namma Yatri ride-hailing services. This package provides a clean, type-safe interface to interact with the Namma Yatri API.

## Installation

```bash
npm install @namma-yatri/api-client
```

## Usage

### Authentication

```typescript
import { NyApiClient } from '@namma-yatri/api-client';

// Authenticate with access code
const authResult = await NyApiClient.authenticate({
  country: 'IN',
  mobileNumber: '9876543210',
  accessCode: 'your-access-code', // Found in Namma Yatri app > About Us
});

console.log('Token:', authResult.token);
console.log('Saved locations:', authResult.savedLocations);
```

### Creating a Client

```typescript
// Create client with token
const client = new NyApiClient(authResult.token);

// Or create client and set token later
const client = new NyApiClient();
client.setToken(authResult.token);
```

### Place Search

```typescript
// Search for places
const places = await client.searchPlaces({ searchText: 'Koramangala' });

// Get place details by place ID
const details = await client.getPlaceDetails(places[0].placeId);

// Get place details by coordinates
const details = await client.getPlaceDetails(12.9352, 77.6245);
```

### Ride Search

```typescript
// Search for rides (automatically polls for results)
const result = await client.searchRides({
  originLat: origin.lat,
  originLon: origin.lon,
  originAddress: origin.address,
  destinationLat: dest.lat,
  destinationLon: dest.lon,
  destinationAddress: dest.address,
});

console.log('Estimates:', result.estimates);
```

### Manual Polling

```typescript
// Start search and get search ID
const searchId = await client.startRideSearch({ ... });

// Poll for estimates manually
const estimates = await client.pollForEstimates(searchId, 10, 2000);

// Or get results directly
const result = await client.getSearchResults(searchId);
```

### Select Estimate

```typescript
// Select an estimate for booking
await client.selectEstimate({
  estimateId: result.estimates[0].id,
  additionalEstimateIds: [result.estimates[1].id], // Optional: select multiple
  specialAssistance: false,
  isPetRide: false,
});

// Select and wait for driver assignment
const rideStatus = await client.selectEstimateAndWait({
  estimateId: result.estimates[0].id,
}, 30000); // Wait up to 30 seconds

if (rideStatus) {
  console.log('Driver assigned:', rideStatus.driverName);
}
```

### Add Tip

```typescript
await client.addTip({
  estimateId: estimateId,
  tipAmount: 20,
  tipCurrency: 'INR',
});
```

### Cancel Search

```typescript
const result = await client.cancelSearch({ estimateId: estimateId });
console.log('Cancelled:', result.success);
```

### Check Ride Status

```typescript
// Get active rides
const activeRides = await client.getRideStatus({ onlyActive: true });

// Get ride history
const history = await client.getRideStatus({
  onlyActive: false,
  limit: 10,
  offset: 0,
});

// Poll for driver assignment
const ride = await client.pollForDriverAssignment(30000);
```

### Saved Locations

```typescript
const locations = await client.getSavedLocations();
console.log('Home:', locations.find(l => l.tag.toLowerCase() === 'home'));
```

## Configuration

```typescript
const client = new NyApiClient(token, {
  baseUrl: 'https://api.moving.tech/pilot/app/v2', // Custom API base URL
  timeout: 30000, // Request timeout in ms
  clientId: 'MY_APP', // Custom client ID
});
```

Or via environment variables:

```bash
export NY_API_BASE=https://api.moving.tech/pilot/app/v2
```

## Error Handling

```typescript
import { NyApiClient, NammaYatriApiError } from '@namma-yatri/api-client';

try {
  await client.searchRides({ ... });
} catch (error) {
  if (error instanceof NammaYatriApiError) {
    console.log('Status:', error.statusCode);
    console.log('Message:', error.message);
    console.log('Is auth error:', error.isAuthError);
    console.log('Details:', error.details);
  }
}
```

## API Reference

### `NyApiClient`

#### Static Methods

| Method | Description |
|--------|-------------|
| `authenticate(config)` | Authenticate with access code |

#### Instance Methods

| Method | Description |
|--------|-------------|
| `setToken(token)` | Set authentication token |
| `getToken()` | Get current token |
| `searchPlaces(config)` | Search for places |
| `getPlaceDetails(placeId)` | Get place details by ID |
| `getPlaceDetails(lat, lon)` | Get place details by coordinates |
| `searchRides(params)` | Search for rides (with polling) |
| `startRideSearch(params)` | Start ride search (returns search ID) |
| `pollForEstimates(searchId, maxAttempts, interval)` | Poll for estimates |
| `getSearchResults(searchId)` | Get search results directly |
| `selectEstimate(params)` | Select estimate for booking |
| `selectEstimateAndWait(params, maxWaitMs)` | Select and wait for driver |
| `addTip(params)` | Add tip to estimate |
| `cancelSearch(params)` | Cancel active search |
| `getRideStatus(params)` | Get ride booking status |
| `pollForDriverAssignment(maxWaitMs)` | Poll for driver assignment |
| `getSavedLocations()` | Get user's saved locations |

## Types

All types are exported from the package:

```typescript
import type {
  Place,
  PlaceDetails,
  Estimate,
  RideStatus,
  SavedLocation,
  // ... and more
} from '@namma-yatri/api-client';
```

## License

MIT