export interface PropertySearchResult {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
}

export interface PropertySearchOptions {
  limit?: number;
  locationBias?: {
    latitude: number;
    longitude: number;
    radiusMeters?: number;
  };
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
}

export class GoogleMapsPropertySearchService {
  private readonly apiKey: string;

  constructor(apiKey = process.env.GOOGLE_MAPS_API_KEY ?? '') {
    this.apiKey = apiKey;
  }

  async searchProperties(
    query: string,
    options: PropertySearchOptions = {}
  ): Promise<PropertySearchResult[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      throw new Error('A property search query is required');
    }

    if (!this.apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY is not configured');
    }

    const limit = Math.min(Math.max(options.limit ?? 10, 1), 20);
    const requestBody: Record<string, unknown> = {
      textQuery: normalizedQuery,
      pageSize: limit,
    };

    if (options.locationBias) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: options.locationBias.latitude,
            longitude: options.locationBias.longitude,
          },
          radius: options.locationBias.radiusMeters ?? 5_000,
        },
      };
    }

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Google Places search failed with status ${response.status}`);
    }

    const data = (await response.json()) as { places?: GooglePlace[] };
    return (data.places ?? []).flatMap((place): PropertySearchResult[] => {
      if (!place.id || !place.displayName?.text || !place.formattedAddress) {
        return [];
      }

      return [{
        id: place.id,
        name: place.displayName.text,
        address: place.formattedAddress,
        latitude: place.location?.latitude ?? null,
        longitude: place.location?.longitude ?? null,
        mapsUrl: place.googleMapsUri ?? null,
      }];
    });
  }
}

export default new GoogleMapsPropertySearchService();
