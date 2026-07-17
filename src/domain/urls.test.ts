import { describe, expect, it } from 'vitest';
import { directoryViewUrl, joinBase, manageActionUrl, placeDetailUrl, readManageIntent } from './urls';

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

  it('builds and encodes a place detail URL at the site root', () => {
    expect(placeDetailUrl('/', 'bowl & broth')).toBe('/place/?id=bowl%20%26%20broth');
  });

  it('builds shareable Map and Journal views under a repository base', () => {
    expect(directoryViewUrl('/ramen-radar', 'map')).toBe('/ramen-radar/?view=map');
    expect(directoryViewUrl('/ramen-radar', 'journal')).toBe('/ramen-radar/?view=journal');
    expect(directoryViewUrl('/ramen-radar', 'list')).toBe('/ramen-radar/');
  });

  it('builds editor intents with an optional encoded place', () => {
    expect(manageActionUrl('/ramen-radar', 'add-place')).toBe('/ramen-radar/manage/?action=add-place');
    expect(manageActionUrl('/ramen-radar', 'log-visit', 'bowl & broth'))
      .toBe('/ramen-radar/manage/?action=log-visit&place=bowl%20%26%20broth');
  });

  it('reads only supported editor intents', () => {
    expect(readManageIntent('?action=add-review&place=moon-bowl')).toEqual({ action: 'add-review', placeId: 'moon-bowl' });
    expect(readManageIntent('?action=delete-everything&place=moon-bowl')).toEqual({ action: null, placeId: 'moon-bowl' });
  });
});
