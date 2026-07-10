import osmtogeojson from 'osmtogeojson';
import type { Bbox } from '../utils/mercator';
import type { OverpassResponse } from './overpass';

type Position = [number, number, ...number[]];

type Geometry = {
  type: string;
  coordinates?: unknown;
};

type Feature = {
  type: 'Feature';
  id?: string | number;
  geometry: Geometry | null;
  properties?: Record<string, unknown>;
};

type FeatureCollection = {
  type: 'FeatureCollection';
  features: Feature[];
};

function isInsideBbox(lon: number, lat: number, bbox: Bbox): boolean {
  return lon >= bbox.west && lon <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

function asPosition(value: unknown): Position | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return [lon, lat];
}

function firstLastFromGeometry(geometry: Geometry | null): { start: Position; end: Position } | null {
  if (!geometry) return null;
  const coords = geometry.coordinates;

  if (geometry.type === 'Point') {
    const point = asPosition(coords);
    return point ? { start: point, end: point } : null;
  }

  if (geometry.type === 'LineString') {
    if (!Array.isArray(coords) || coords.length === 0) return null;
    const start = asPosition(coords[0]);
    const end = asPosition(coords[coords.length - 1]);
    return start && end ? { start, end } : null;
  }

  if (geometry.type === 'MultiLineString') {
    if (!Array.isArray(coords) || coords.length === 0) return null;
    const firstLine = coords[0];
    const lastLine = coords[coords.length - 1];
    if (!Array.isArray(firstLine) || firstLine.length === 0) return null;
    if (!Array.isArray(lastLine) || lastLine.length === 0) return null;
    const start = asPosition(firstLine[0]);
    const end = asPosition(lastLine[lastLine.length - 1]);
    return start && end ? { start, end } : null;
  }

  if (geometry.type === 'Polygon') {
    if (!Array.isArray(coords) || coords.length === 0) return null;
    const outer = coords[0];
    if (!Array.isArray(outer) || outer.length === 0) return null;
    const start = asPosition(outer[0]);
    const end = asPosition(outer[outer.length - 1]);
    return start && end ? { start, end } : null;
  }

  if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(coords) || coords.length === 0) return null;
    const firstPolygon = coords[0];
    const lastPolygon = coords[coords.length - 1];
    if (!Array.isArray(firstPolygon) || firstPolygon.length === 0) return null;
    if (!Array.isArray(lastPolygon) || lastPolygon.length === 0) return null;
    const firstOuter = firstPolygon[0];
    const lastOuter = lastPolygon[0];
    if (!Array.isArray(firstOuter) || firstOuter.length === 0) return null;
    if (!Array.isArray(lastOuter) || lastOuter.length === 0) return null;
    const start = asPosition(firstOuter[0]);
    const end = asPosition(lastOuter[lastOuter.length - 1]);
    return start && end ? { start, end } : null;
  }

  return null;
}

export function cropToCoreBbox(featureCollection: FeatureCollection, coreBbox: Bbox): FeatureCollection {
  const filtered = featureCollection.features.filter((feature) => {
    const endpoints = firstLastFromGeometry(feature.geometry);
    if (!endpoints) {
      return false;
    }
    const startInside = isInsideBbox(endpoints.start[0], endpoints.start[1], coreBbox);
    const endInside = isInsideBbox(endpoints.end[0], endpoints.end[1], coreBbox);
    return startInside || endInside;
  });

  return {
    ...featureCollection,
    features: filtered,
  };
}

function parseWayId(feature: Feature): number | null {
  const rawId = typeof feature.id === 'string'
    ? feature.id
    : typeof feature.properties?.id === 'string'
      ? feature.properties.id
      : null;

  if (!rawId) {
    return null;
  }

  const match = /^way\/(\d+)$/.exec(rawId);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function annotateDeadends(featureCollection: FeatureCollection, deadendWayIds: ReadonlySet<number>): FeatureCollection {
  if (deadendWayIds.size === 0) {
    return featureCollection;
  }

  return {
    ...featureCollection,
    features: featureCollection.features.map((feature) => {
      const wayId = parseWayId(feature);
      if (wayId === null || !deadendWayIds.has(wayId)) {
        return feature;
      }

      return {
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          deadend: true,
        },
      };
    }),
  };
}

export function overpassToGeoJson(payload: OverpassResponse, coreBbox: Bbox, deadendWayIds: ReadonlySet<number> = new Set()): FeatureCollection {
  const geojson = osmtogeojson(payload) as FeatureCollection;
  if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    return { type: 'FeatureCollection', features: [] };
  }

  return cropToCoreBbox(annotateDeadends(geojson, deadendWayIds), coreBbox);
}

