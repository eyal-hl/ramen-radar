# Ramen Radar Map View Design

## Purpose

Add an interactive map to the home-page directory without weakening the existing JSON-first, static-site architecture. Visitors can switch between the current ranked list and a geographic view of the same filtered places.

## Interaction Design

A two-option segmented control labeled **List** and **Map** appears beside the directory result count. List remains the default. Selecting Map hides the card grid and displays a touch-friendly interactive map; selecting List restores the cards without resetting search, filters, or sorting.

The selected view is represented by `view=map` in the URL. List view omits the parameter. Opening or reloading a shared map URL restores the map. Browser back and forward navigation must preserve the chosen view and filter state.

All existing directory filters apply to both views. Hidden cards have corresponding hidden markers, the result count remains shared, and the map refits to the currently visible markers after filters change. A single visible place uses a useful neighborhood zoom instead of zooming to an unusable point level. With no matches, the existing empty state appears and the map remains present at the default Givatayim/Tel Aviv extent.

## Map Content

Each place uses its existing validated latitude and longitude. Markers use distinct accessible colors for `visited`, `want-to-visit`, and `unavailable` states. A compact legend explains those colors.

Selecting a marker opens a popup containing:

- Place name and city.
- Status and price range.
- Overall score or "Not rated yet."
- A link to the generated place detail page.

Popup links must honor the GitHub Pages repository base path.

## Technical Architecture

Leaflet is installed as a pinned npm dependency and bundled by Astro. OpenStreetMap raster tiles provide street context at runtime, with visible OpenStreetMap attribution retained exactly as required by the tile provider. No API key, account, backend, or build-time network request is introduced.

The server-rendered page emits a small serializable map model for every place: stable ID, name, city, status, price range, score, coordinates, and detail URL. It contains no notes, reviewer data, or unnecessary content. A dedicated `DirectoryMap` browser module owns Leaflet initialization, marker creation, popup markup, visibility synchronization, bounds fitting, and cleanup. The existing directory controller remains responsible for filter state and emits a custom event carrying the IDs of visible places.

Leaflet and tile requests load only after the visitor first selects Map. Returning to List keeps the initialized map available so subsequent toggles are immediate. The implementation must not duplicate the directory filtering rules.

## Layout and Accessibility

The map uses the existing warm editorial visual system. It is at least 420 pixels tall on phones and 580 pixels tall on wider screens. Controls, popups, markers, and the segmented toggle have visible keyboard focus states. The toggle exposes pressed state through semantic buttons and `aria-pressed`. The map region has an accessible label and concise instructions for keyboard users.

Marker color is not the only status signal: popup text and the legend name each state. Users who do not run JavaScript, block external tiles, or use a browser that cannot initialize Leaflet retain the complete list view and place links.

## Error Handling

Map initialization is progressive enhancement. Before JavaScript runs, only List is active. If Leaflet cannot initialize, Map selection returns to List and exposes a short non-blocking status message. Tile failures preserve markers, popups, controls, and the list; they do not affect the build or other pages.

Invalid or missing coordinates continue to fail the existing content schema, so the map never silently drops malformed places. Popup text is created with DOM APIs rather than interpolated as trusted HTML.

## Testing and Verification

- Unit tests cover conversion from place cards to minimal map models, status classes, and base-path-safe detail URLs.
- Browser tests cover List/Map toggling, `view=map` restoration, filter-to-marker synchronization, empty results, popup content, detail navigation, and keyboard-visible controls.
- Accessibility tests include the map state and ensure the toggle exposes correct pressed state.
- A production build with `BASE_PATH=/ramen-radar` verifies bundled Leaflet assets and popup links.
- Desktop and 390-pixel phone browser passes verify map dimensions, controls, popups, and lack of horizontal overflow.

## Documentation

The README explains the List/Map toggle, runtime OpenStreetMap tile dependency, attribution, coordinate requirements, and that map failures never prevent use of the list.

## Scope Exclusions

The first map version does not include geolocation, directions, travel times, marker clustering, custom tile hosting, drawing tools, distance sorting, or address geocoding. Coordinates remain explicit JSON fields maintained by the repository owner or OpenClaw.
