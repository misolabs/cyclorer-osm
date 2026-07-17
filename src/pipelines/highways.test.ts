import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHighwaysFeatureCollection } from './highways';
import { annotateBicycleRouteMembership, dropRelationElements } from '../transforms/overpass';
import type { OverpassResponse } from '../services/overpass';

const tileBbox = {
  west: 5.999,
  south: 48.999,
  east: 6.002,
  north: 49.001,
};

test('annotates member ways with bicycle route names and preserves them into GeoJSON', () => {
  const payload: OverpassResponse = {
    version: 0.6,
    generator: 'test',
    elements: [
      { type: 'way', id: 1, nodes: [10, 11], tags: { highway: 'residential' } },
      { type: 'node', id: 10, lat: 49.0, lon: 6.0 },
      { type: 'node', id: 11, lat: 49.0, lon: 6.001 },
      {
        type: 'relation',
        id: 100,
        members: [{ type: 'way', ref: 1, role: '' }],
        tags: { route: 'bicycle', name: 'Route A' },
      },
    ],
  };

  const annotated = annotateBicycleRouteMembership(payload);
  const stripped = dropRelationElements(annotated);
  assert.equal(stripped.elements.some((element) => element.type === 'relation'), false);

  const way = annotated.elements.find((element) => element.type === 'way' && element.id === 1);

  assert.ok(way);
  assert.deepEqual((way as typeof payload.elements[number] & { tags?: Record<string, unknown> }).tags?.['facycle:routes'], ['Route A']);

  const geojson = buildHighwaysFeatureCollection(annotated, tileBbox, tileBbox);

  assert.equal(geojson.features.length, 1);
  assert.deepEqual(geojson.features[0].properties?.['facycle:routes'], ['Route A']);
});

test('deduplicates route names and falls back to PC unknown', () => {
  const payload: OverpassResponse = {
    version: 0.6,
    generator: 'test',
    elements: [
      { type: 'way', id: 1, nodes: [10, 11], tags: { highway: 'residential' } },
      { type: 'node', id: 10, lat: 49.0, lon: 6.0 },
      { type: 'node', id: 11, lat: 49.0, lon: 6.001 },
      {
        type: 'relation',
        id: 100,
        members: [{ type: 'way', ref: 1, role: '' }],
        tags: { route: 'bicycle', name: 'Route A' },
      },
      {
        type: 'relation',
        id: 101,
        members: [{ type: 'way', ref: 1, role: '' }],
        tags: { route: 'bicycle', ref: 'Route A' },
      },
      {
        type: 'relation',
        id: 102,
        members: [{ type: 'way', ref: 1, role: '' }],
        tags: { route: 'bicycle' },
      },
      {
        type: 'relation',
        id: 103,
        members: [{ type: 'way', ref: 999, role: '' }],
        tags: { route: 'bicycle', name: 'Other route' },
      },
    ],
  };

  const annotated = annotateBicycleRouteMembership(payload);
  const way = annotated.elements.find((element) => element.type === 'way' && element.id === 1);

  assert.ok(way);
  assert.deepEqual((way as typeof payload.elements[number] & { tags?: Record<string, unknown> }).tags?.['facycle:routes'], ['Route A', 'PC unknown']);
});

test('adds facycle classification to the output feature', () => {
  const payload: OverpassResponse = {
    version: 0.6,
    generator: 'test',
    elements: [
      {
        type: 'way',
        id: 1,
        nodes: [10, 11],
        tags: {
          highway: 'residential',
          maxspeed: '30',
        },
      },
      { type: 'node', id: 10, lat: 49.0, lon: 6.0 },
      { type: 'node', id: 11, lat: 49.0, lon: 6.001 },
    ],
  };

  const geojson = buildHighwaysFeatureCollection(payload, tileBbox, tileBbox);
  assert.equal(geojson.features.length, 1);
  assert.equal(geojson.features[0].properties?.['facycle:classification'], 'low_risk');
});

test('classifies cycleway track infrastructure as designated', () => {
  const payload: OverpassResponse = {
    version: 0.6,
    generator: 'test',
    elements: [
      {
        type: 'way',
        id: 1,
        nodes: [10, 11],
        tags: {
          highway: 'residential',
          cycleway: 'track',
        },
      },
      { type: 'node', id: 10, lat: 49.0, lon: 6.0 },
      { type: 'node', id: 11, lat: 49.0, lon: 6.001 },
    ],
  };

  const geojson = buildHighwaysFeatureCollection(payload, tileBbox, tileBbox);
  assert.equal(geojson.features.length, 1);
  assert.equal(geojson.features[0].properties?.['facycle:classification'], 'designated');
});

test('classifies forbidden or high-speed roads as not suitable', () => {
  const payload: OverpassResponse = {
    version: 0.6,
    generator: 'test',
    elements: [
      {
        type: 'way',
        id: 1,
        nodes: [10, 11],
        tags: {
          highway: 'motorway',
        },
      },
      { type: 'node', id: 10, lat: 49.0, lon: 6.0 },
      { type: 'node', id: 11, lat: 49.0, lon: 6.001 },
    ],
  };

  const geojson = buildHighwaysFeatureCollection(payload, tileBbox, tileBbox);
  assert.equal(geojson.features.length, 1);
  assert.equal(geojson.features[0].properties?.['facycle:classification'], 'not_suitable');
});

test('classifies well surfaced tracks as low risk', () => {
  const payload: OverpassResponse = {
    version: 0.6,
    generator: 'test',
    elements: [
      {
        type: 'way',
        id: 1,
        nodes: [10, 11],
        tags: {
          highway: 'track',
          tracktype: 'grade1',
          surface: 'asphalt',
          smoothness: 'good',
          'mtb:scale': '0',
        },
      },
      { type: 'node', id: 10, lat: 49.0, lon: 6.0 },
      { type: 'node', id: 11, lat: 49.0, lon: 6.001 },
    ],
  };

  const geojson = buildHighwaysFeatureCollection(payload, tileBbox, tileBbox);
  assert.equal(geojson.features.length, 1);
  assert.equal(geojson.features[0].properties?.['facycle:classification'], 'low_risk');
});

test('classifies rough tracks as adult only or not suitable', () => {
  const payload: OverpassResponse = {
    version: 0.6,
    generator: 'test',
    elements: [
      {
        type: 'way',
        id: 1,
        nodes: [10, 11],
        tags: {
          highway: 'track',
          tracktype: 'grade3',
          surface: 'gravel',
          smoothness: 'intermediate',
        },
      },
      { type: 'node', id: 10, lat: 49.0, lon: 6.0 },
      { type: 'node', id: 11, lat: 49.0, lon: 6.001 },
    ],
  };

  const geojson = buildHighwaysFeatureCollection(payload, tileBbox, tileBbox);
  assert.equal(geojson.features.length, 1);
  assert.equal(geojson.features[0].properties?.['facycle:classification'], 'adult_only');
});

test('classifies bicycle-permitted footways as acceptable only when they are very good', () => {
  const payload: OverpassResponse = {
    version: 0.6,
    generator: 'test',
    elements: [
      {
        type: 'way',
        id: 1,
        nodes: [10, 11],
        tags: {
          highway: 'footway',
          bicycle: 'yes',
          surface: 'asphalt',
          smoothness: 'good',
        },
      },
      { type: 'node', id: 10, lat: 49.0, lon: 6.0 },
      { type: 'node', id: 11, lat: 49.0, lon: 6.001 },
    ],
  };

  const geojson = buildHighwaysFeatureCollection(payload, tileBbox, tileBbox);
  assert.equal(geojson.features.length, 1);
  assert.equal(geojson.features[0].properties?.['facycle:classification'], 'acceptable');
});
