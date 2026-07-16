import { describe, expect, it } from 'vitest';
import { joinBase, placeDetailUrl } from './urls';

describe('GitHub Pages base paths', () => {
  it('joins a repository base without requiring a trailing slash', () => {
    expect(joinBase('/ramen-radar', 'places/moon-bowl/')).toBe('/ramen-radar/places/moon-bowl/');
  });

  it('does not duplicate slashes at the site root', () => {
    expect(joinBase('/', '/places/moon-bowl/')).toBe('/places/moon-bowl/');
  });

  it('builds a place detail URL when the repository base has no trailing slash', () => {
    expect(placeDetailUrl('/ramen-radar', 'moon-bowl-ramen'))
      .toBe('/ramen-radar/place/?id=moon-bowl-ramen');
  });
});
