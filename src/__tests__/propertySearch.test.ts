import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleMapsPropertySearchService } from '../services/propertySearch';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GoogleMapsPropertySearchService', () => {
  it('searches Places and maps results to property records', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      places: [{
        id: 'place-123',
        displayName: { text: 'NightScope Villa' },
        formattedAddress: '1 Main Road, Cape Town',
        location: { latitude: -33.9249, longitude: 18.4241 },
        googleMapsUri: 'https://maps.google.com/?cid=123',
      }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const results = await new GoogleMapsPropertySearchService('test-key').searchProperties('villa in Cape Town');

    expect(results).toEqual([{
      id: 'place-123',
      name: 'NightScope Villa',
      address: '1 Main Road, Cape Town',
      latitude: -33.9249,
      longitude: 18.4241,
      mapsUrl: 'https://maps.google.com/?cid=123',
    }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://places.googleapis.com/v1/places:searchText',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-Goog-Api-Key': 'test-key' }),
      })
    );
  });

  it('fails clearly when the API key is missing', async () => {
    await expect(
      new GoogleMapsPropertySearchService('').searchProperties('villa')
    ).rejects.toThrow('GOOGLE_MAPS_API_KEY is not configured');
  });

  it('rejects empty searches before calling Google', async () => {
    await expect(
      new GoogleMapsPropertySearchService('test-key').searchProperties('  ')
    ).rejects.toThrow('A property search query is required');
  });
});
