import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import FuzzySearch from 'fuzzy-search';
import { NyApiClient, Estimate, Place, PlaceDetails, SavedLocation, Address } from '../hooks/useApi.js';
import { EstimateSelect } from '../components/EstimateSelect.js';

type SearchStep = 
  | 'select-origin' 
  | 'origin-input' 
  | 'origin-results' 
  | 'select-destination' 
  | 'destination-input' 
  | 'destination-results' 
  | 'searching'
  | 'select-estimate'
  | 'booking'
  | 'result';

interface SearchScreenProps {
  client: NyApiClient;
  savedLocations: SavedLocation[];
  onRefreshLocations: () => Promise<SavedLocation[]>;
  onBack: () => void;
  onError: (error: string) => void;
}

export function SearchScreen({ 
  client, 
  savedLocations: initialSavedLocations,
  onRefreshLocations,
  onBack, 
  onError 
}: SearchScreenProps) {
  const [step, setStep] = useState<SearchStep>('select-origin');
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>(initialSavedLocations);
  
  // Origin state
  const [originInput, setOriginInput] = useState('');
  const [originResults, setOriginResults] = useState<Place[]>([]);
  const [origin, setOrigin] = useState<PlaceDetails | null>(null);
  const [originLabel, setOriginLabel] = useState('');
  
  // Destination state
  const [destInput, setDestInput] = useState('');
  const [destResults, setDestResults] = useState<Place[]>([]);
  const [destination, setDestination] = useState<PlaceDetails | null>(null);
  const [destLabel, setDestLabel] = useState('');
  
  // Search results
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchId, setSearchId] = useState<string | null>(null);
  
  // Booking result
  const [bookingResult, setBookingResult] = useState<{ success: boolean; message: string } | null>(null);

  // Update saved locations when props change
  useEffect(() => {
    setSavedLocations(initialSavedLocations);
  }, [initialSavedLocations]);

  // Fuzzy search for saved locations
  const searchSavedLocations = useCallback((query: string): (SavedLocation & { isSaved: true })[] => {
    if (!query || savedLocations.length === 0) return [];
    const searcher = new FuzzySearch(savedLocations, ['tag', 'locationName', 'area', 'city'], {
      caseSensitive: false,
    });
    return searcher.search(query).map(loc => ({ ...loc, isSaved: true }));
  }, [savedLocations]);

  // Handle origin selection
  const handleOriginSelect = useCallback(async (item: { value: string }) => {
    if (item.value === 'manual') {
      setStep('origin-input');
    } else {
      // It's a saved location
      const saved = savedLocations.find(s => s.tag === item.value);
      if (saved) {
        setOrigin({
          lat: saved.lat,
          lon: saved.lon,
          placeId: saved.placeId || '',
          address: {
            area: saved.area,
            city: saved.city,
          },
        });
        setOriginLabel(`${saved.tag} - ${saved.locationName || saved.area || ''}`);
        setStep('select-destination');
      }
    }
  }, [savedLocations]);

  // Handle destination selection
  const handleDestSelect = useCallback(async (item: { value: string }) => {
    if (item.value === 'manual') {
      setStep('destination-input');
    } else {
      // It's a saved location
      const saved = savedLocations.find(s => s.tag === item.value);
      if (saved) {
        setDestination({
          lat: saved.lat,
          lon: saved.lon,
          placeId: saved.placeId || '',
          address: {
            area: saved.area,
            city: saved.city,
          },
        });
        setDestLabel(`${saved.tag} - ${saved.locationName || saved.area || ''}`);
        startSearch(
          origin!,
          {
            lat: saved.lat,
            lon: saved.lon,
            address: { area: saved.area, city: saved.city },
          }
        );
      }
    }
  }, [savedLocations, origin]);

  // Search for places
  const searchPlaces = useCallback(async (query: string, isOrigin: boolean) => {
    if (query.length < 2) {
      if (isOrigin) setOriginResults([]);
      else setDestResults([]);
      return;
    }

    try {
      const results = await client.searchPlaces({
        searchText: query,
      });
      if (isOrigin) {
        setOriginResults(results);
      } else {
        setDestResults(results);
      }
    } catch (error: any) {
      onError(`Failed to search places: ${error.message}`);
    }
  }, [client, onError]);

  // Handle place selection from results
  const handlePlaceSelect = useCallback(async (item: { value: string }, isOrigin: boolean) => {
    try {
      const details = await client.getPlaceDetails(item.value);
      if (isOrigin) {
        setOrigin(details);
        setOriginLabel(originResults.find(p => p.placeId === item.value)?.description || '');
        setStep('select-destination');
      } else {
        setDestination(details);
        setDestLabel(destResults.find(p => p.placeId === item.value)?.description || '');
        startSearch(origin!, details);
      }
    } catch (error: any) {
      onError(`Failed to get place details: ${error.message}`);
    }
  }, [client, originResults, destResults, origin, onError]);

  // Start ride search
  const startSearch = useCallback(async (originData: PlaceDetails, destData: PlaceDetails) => {
    setStep('searching');
    setIsSearching(true);
    try {
      const result = await client.searchRides({
        originLat: originData.lat,
        originLon: originData.lon,
        destinationLat: destData.lat,
        destinationLon: destData.lon,
        originAddress: originData.address as Address,
        destinationAddress: destData.address as Address,
      });
      
      setSearchId(result.searchId);
      
      if (!result.estimates || result.estimates.length === 0) {
        onError('No rides found. Try different locations or try again later.');
        setStep('select-origin');
        return;
      }
      
      setEstimates(result.estimates);
      setStep('select-estimate');
    } catch (error: any) {
      onError(`Search failed: ${error.message}`);
      setStep('select-origin');
    } finally {
      setIsSearching(false);
    }
  }, [client, onError]);

  // Refresh search results
  const refreshSearch = useCallback(async () => {
    if (!origin || !destination) return;
    await startSearch(origin, destination);
  }, [origin, destination, startSearch]);

  // Handle estimate selection from EstimateSelect component
  const handleEstimateSelect = useCallback(async (estimateIds: string[]) => {
    setStep('booking');
    
    try {
      const primaryId = estimateIds[0];
      const additionalIds = estimateIds.slice(1);
      
      await client.selectEstimate({
        estimateId: primaryId,
        additionalEstimateIds: additionalIds.length > 0 ? additionalIds : undefined,
      });
      
      // Poll for driver assignment
      const ride = await client.pollForDriverAssignment();
      
      if (ride) {
        setBookingResult({
          success: true,
          message: `Driver assigned: ${ride.driverName || 'Unknown'} (${ride.vehicleNumber || 'N/A'})`,
        });
      } else {
        setBookingResult({
          success: true,
          message: 'Ride booked! You will be notified when a driver is assigned.',
        });
      }
      setStep('result');
    } catch (error: any) {
      onError(`Booking failed: ${error.message}`);
      setStep('select-estimate');
    }
  }, [client, onError]);

  // Handle cancel from estimate selection
  const handleEstimateCancel = useCallback(() => {
    setStep('select-origin');
    setEstimates([]);
    setSearchId(null);
  }, []);

  // Handle back navigation
  useInput((input, key) => {
    // Don't handle global navigation during estimate selection (component handles its own input)
    if (step === 'select-estimate') return;
    
    if (key.escape) {
      switch (step) {
        case 'origin-input':
        case 'select-origin':
          onBack();
          break;
        case 'destination-input':
        case 'select-destination':
          setStep('select-origin');
          break;
        case 'origin-results':
          setStep('origin-input');
          break;
        case 'destination-results':
          setStep('destination-input');
          break;
        case 'result':
          setStep('select-origin');
          setBookingResult(null);
          setEstimates([]);
          break;
      }
    }
  });

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 'select-origin': {
        const items = [
          ...savedLocations.map(s => ({
            label: `📍 ${s.tag} - ${s.locationName || s.area || ''}`,
            value: s.tag,
          })),
          { label: '🔍 Search for a place', value: 'manual' },
        ];
        return (
          <Box flexDirection="column">
            <Text bold>Select Origin:</Text>
            <Box marginTop={1}>
              <SelectInput items={items} onSelect={handleOriginSelect} />
            </Box>
          </Box>
        );
      }

      case 'origin-input':
        return (
          <Box flexDirection="column">
            <Text bold>Enter origin location:</Text>
            <Box marginTop={1}>
              <TextInput
                value={originInput}
                onChange={(v) => {
                  setOriginInput(v);
                  searchPlaces(v, true);
                }}
                onSubmit={() => {
                  if (originResults.length > 0) {
                    setStep('origin-results');
                  }
                }}
                placeholder="Type to search..."
                showCursor
              />
            </Box>
            {originResults.length > 0 && (
              <Box marginTop={1} flexDirection="column">
                <Text dimColor>Results (press Enter to select):</Text>
                {originResults.slice(0, 5).map((r, i) => (
                  <Text key={r.placeId}>  {i + 1}. {r.description}</Text>
                ))}
              </Box>
            )}
          </Box>
        );

      case 'origin-results': {
        const items = originResults.slice(0, 10).map(r => ({
          label: r.description,
          value: r.placeId,
        }));
        return (
          <Box flexDirection="column">
            <Text bold>Select origin:</Text>
            <Box marginTop={1}>
              <SelectInput 
                items={items} 
                onSelect={(item) => handlePlaceSelect(item, true)} 
              />
            </Box>
          </Box>
        );
      }

      case 'select-destination': {
        const items = [
          ...savedLocations
            .filter(s => !origin || s.lat !== origin.lat || s.lon !== origin.lon)
            .map(s => ({
              label: `📍 ${s.tag} - ${s.locationName || s.area || ''}`,
              value: s.tag,
            })),
          { label: '🔍 Search for a place', value: 'manual' },
        ];
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text>Origin: </Text>
              <Text color="green">{originLabel}</Text>
            </Box>
            <Text bold>Select Destination:</Text>
            <Box marginTop={1}>
              <SelectInput items={items} onSelect={handleDestSelect} />
            </Box>
          </Box>
        );
      }

      case 'destination-input':
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text>Origin: </Text>
              <Text color="green">{originLabel}</Text>
            </Box>
            <Text bold>Enter destination:</Text>
            <Box marginTop={1}>
              <TextInput
                value={destInput}
                onChange={(v) => {
                  setDestInput(v);
                  searchPlaces(v, false);
                }}
                onSubmit={() => {
                  if (destResults.length > 0) {
                    setStep('destination-results');
                  }
                }}
                placeholder="Type to search..."
                showCursor
              />
            </Box>
            {destResults.length > 0 && (
              <Box marginTop={1} flexDirection="column">
                <Text dimColor>Results:</Text>
                {destResults.slice(0, 5).map((r, i) => (
                  <Text key={r.placeId}>  {i + 1}. {r.description}</Text>
                ))}
              </Box>
            )}
          </Box>
        );

      case 'destination-results': {
        const items = destResults.slice(0, 10).map(r => ({
          label: r.description,
          value: r.placeId,
        }));
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text>Origin: </Text>
              <Text color="green">{originLabel}</Text>
            </Box>
            <Text bold>Select destination:</Text>
            <Box marginTop={1}>
              <SelectInput 
                items={items} 
                onSelect={(item) => handlePlaceSelect(item, false)} 
              />
            </Box>
          </Box>
        );
      }

      case 'searching':
        return (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text>Origin: </Text>
              <Text color="green">{originLabel}</Text>
            </Box>
            <Box marginBottom={1}>
              <Text>Destination: </Text>
              <Text color="green">{destLabel}</Text>
            </Box>
            <Box>
              <Text color="cyan">
                <Spinner type="dots" />
              </Text>
              <Text> Searching for rides...</Text>
            </Box>
          </Box>
        );

      case 'select-estimate':
        return (
          <EstimateSelect
            estimates={estimates}
            onSelect={handleEstimateSelect}
            onRefresh={refreshSearch}
            onCancel={handleEstimateCancel}
            isLoading={isSearching}
            originLabel={originLabel}
            destLabel={destLabel}
            allowMultiSelect={true}
            showTips={true}
          />
        );

      case 'booking':
        return (
          <Box flexDirection="column">
            <Box>
              <Text color="cyan">
                <Spinner type="dots" />
              </Text>
              <Text> Booking your ride...</Text>
            </Box>
          </Box>
        );

      case 'result':
        return (
          <Box flexDirection="column">
            <Text bold color={bookingResult?.success ? 'green' : 'red'}>
              {bookingResult?.success ? '✓ Success!' : '✗ Failed'}
            </Text>
            <Box marginTop={1}>
              <Text>{bookingResult?.message}</Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Press ESC to start a new search</Text>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box flexDirection="column">
      {renderStep()}
    </Box>
  );
}