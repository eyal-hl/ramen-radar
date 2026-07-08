import { describe, expect, it } from 'vitest';
import { parseGoogleMapsUrl } from './google-maps';

describe('parseGoogleMapsUrl', () => {
  it('derives name, address, city, and coordinates from a search URL', () => {
    expect(parseGoogleMapsUrl('https://www.google.com/maps/search/?api=1&query=Men%20Tenten%20Ramen%20Bar%2C%20Nahalat%20Binyamin%2057%2C%20Tel%20Aviv-Yafo&center=32.064139,34.771453')).toMatchObject({
      name: 'Men Tenten Ramen Bar',
      address: 'Nahalat Binyamin 57',
      city: 'Tel Aviv-Yafo',
      latitude: 32.064139,
      longitude: 34.771453,
    });
  });

  it('derives coordinates from modern place URLs', () => {
    expect(parseGoogleMapsUrl('https://www.google.com/maps/place/Koko+Neko/@32.056312,34.7674514,17z')).toMatchObject({
      name: 'Koko Neko',
      latitude: 32.056312,
      longitude: 34.7674514,
    });
  });

  it('returns null for invalid URLs', () => {
    expect(parseGoogleMapsUrl('not a url')).toBeNull();
  });
});
