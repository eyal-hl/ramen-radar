import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatScore } from '../domain/ratings';
import { markerClassForStatus, type MapPlace } from '../domain/map';

export interface MapController {
  sync(visibleIds: string[]): void;
  resize(): void;
  destroy(): void;
}

const statusLabels: Record<MapPlace['status'], string> = {
  visited: 'Visited',
  'want-to-visit': 'Want to visit',
  unavailable: 'Unavailable',
};

function popupContent(place: MapPlace): HTMLElement {
  const content = document.createElement('div');
  content.className = 'map-popup';
  const heading = document.createElement('strong');
  heading.textContent = place.name;
  const meta = document.createElement('span');
  meta.textContent = `${place.city} · ${statusLabels[place.status]} · ${place.priceRange}`;
  const score = document.createElement('span');
  score.textContent = formatScore(place.score);
  const link = document.createElement('a');
  link.href = place.detailUrl;
  link.textContent = `View ${place.name}`;
  content.append(heading, meta, score, link);
  return content;
}

export function initializeDirectoryMap(initialPlaces?: MapPlace[], target?: HTMLElement): MapController {
  const element = target ?? document.querySelector<HTMLElement>('[data-directory-map]');
  const data = document.querySelector<HTMLScriptElement>('[data-map-data]');
  const status = document.querySelector<HTMLElement>('[data-map-status]');
  if (!element || (!initialPlaces && !data)) throw new Error('Map elements are unavailable.');

  const places = initialPlaces ?? JSON.parse(data?.textContent ?? '[]') as MapPlace[];
  const map = L.map(element, { scrollWheelZoom: false }).setView([32.075, 34.795], 12);
  const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  tiles.on('tileerror', () => {
    if (status) status.textContent = 'Map tiles are unavailable. Place markers and the list still work.';
  });

  const markers = new Map<string, L.Marker>();
  for (const place of places) {
    const marker = L.marker([place.latitude, place.longitude], {
      icon: L.divIcon({
        className: `map-marker ${markerClassForStatus(place.status)}`,
        html: '<span aria-hidden="true"></span>',
        iconSize: [28, 36],
        iconAnchor: [14, 34],
        popupAnchor: [0, -32],
      }),
      title: place.name,
      alt: `${place.name}, ${statusLabels[place.status]}`,
    }).bindPopup(popupContent(place));
    markers.set(place.id, marker);
  }

  const sync = (visibleIds: string[]) => {
    const visible = new Set(visibleIds);
    const coordinates: L.LatLngExpression[] = [];
    for (const place of places) {
      const marker = markers.get(place.id)!;
      if (visible.has(place.id)) {
        if (!map.hasLayer(marker)) marker.addTo(map);
        marker.getElement()?.setAttribute('data-map-marker', place.id);
        coordinates.push([place.latitude, place.longitude]);
      } else if (map.hasLayer(marker)) {
        marker.removeFrom(map);
      }
    }
    if (coordinates.length === 1) map.setView(coordinates[0], 14);
    else if (coordinates.length > 1) map.fitBounds(L.latLngBounds(coordinates), { padding: [40, 40], maxZoom: 14 });
    else map.setView([32.075, 34.795], 12);
  };

  return { sync, resize: () => map.invalidateSize(), destroy: () => map.remove() };
}

