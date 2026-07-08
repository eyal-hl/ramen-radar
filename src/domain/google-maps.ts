export interface ParsedGoogleMapsUrl {
  mapUrl: string;
  name?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

function cleanText(value: string): string {
  return value
    .replace(/\+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeDecode(value: string): string {
  try {
    return cleanText(decodeURIComponent(value));
  } catch {
    return cleanText(value);
  }
}

function firstSearchValue(url: URL, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value) return safeDecode(value);
  }
  return undefined;
}

function splitPlaceText(value: string | undefined): Pick<ParsedGoogleMapsUrl, 'name' | 'address' | 'city'> {
  if (!value) return {};
  const parts = value.split(',').map(cleanText).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { name: parts[0] };
  return {
    name: parts[0],
    address: parts.slice(1, -1).join(', ') || parts[1],
    city: parts.at(-1),
  };
}

function coordinatesFromText(value: string): Pick<ParsedGoogleMapsUrl, 'latitude' | 'longitude'> {
  const match = value.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return {};
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return {};
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return {};
  return { latitude, longitude };
}

export function parseGoogleMapsUrl(input: string): ParsedGoogleMapsUrl | null {
  const mapUrl = input.trim();
  if (!mapUrl) return null;
  let url: URL;
  try {
    url = new URL(mapUrl);
  } catch {
    return null;
  }

  const textFromQuery = firstSearchValue(url, ['query', 'q', 'daddr', 'destination']);
  const placePathMatch = url.pathname.match(/\/place\/([^/]+)/);
  const textFromPath = placePathMatch ? safeDecode(placePathMatch[1]) : undefined;
  const text = textFromQuery ?? textFromPath;
  const coordinates = {
    ...coordinatesFromText(url.pathname),
    ...coordinatesFromText(url.search),
  };

  return {
    mapUrl,
    ...splitPlaceText(text),
    ...coordinates,
  };
}
