import osmtogeojson from 'osmtogeojson';
import type { OverpassResponse } from './overpass';

export function overpassToGeoJson(payload: OverpassResponse): unknown {
  return osmtogeojson(payload);
}

