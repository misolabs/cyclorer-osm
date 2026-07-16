import assert from 'node:assert/strict';
import test from 'node:test';
import type { OverpassResponse } from '../services/overpass';
import { detectDeadendWayIds } from './deadends';

const tileBbox = {
  west: 5.999,
  south: 48.999,
  east: 6.002,
  north: 49.002,
};

const queryBbox = {
  west: 5.998,
  south: 48.998,
  east: 6.003,
  north: 49.003,
};

test('uses all nodes of a way for dead-end pruning, including inner-node junctions', () => {
  const payload: OverpassResponse = {
    version: 0.6,
    generator: 'test',
    elements: [
      // Main way with two inner-node junctions; it should survive pruning.
      { type: 'way', id: 1, nodes: [10, 11, 12, 13], tags: { highway: 'residential' } },
      // These become dead-ends in the first iteration.
      { type: 'way', id: 2, nodes: [20, 11], tags: { highway: 'service' } },
      { type: 'way', id: 3, nodes: [30, 12], tags: { highway: 'service' } },
      // Bridge between both junction nodes keeps way 1 in the active core.
      { type: 'way', id: 4, nodes: [11, 12], tags: { highway: 'residential' } },
      { type: 'node', id: 10, lon: 6.0, lat: 49.0 },
      { type: 'node', id: 11, lon: 6.0003, lat: 49.0 },
      { type: 'node', id: 12, lon: 6.0006, lat: 49.0 },
      { type: 'node', id: 13, lon: 6.001, lat: 49.0 },
      { type: 'node', id: 20, lon: 6.0003, lat: 49.001 },
      { type: 'node', id: 30, lon: 6.0006, lat: 49.001 },
    ],
  };

  const deadends = detectDeadendWayIds(payload, tileBbox, queryBbox);
  assert.equal(deadends.has(2), true);
  assert.equal(deadends.has(3), true);
  assert.equal(deadends.has(1), false);
  assert.equal(deadends.has(4), false);
});

test('treats only non-forbidden ways as active connections during pruning', () => {
  const payload: OverpassResponse = {
    version: 0.6,
    generator: 'test',
    elements: [
      { type: 'way', id: 10, nodes: [100, 101], tags: { highway: 'service' } },
      { type: 'way', id: 11, nodes: [101, 102], tags: { highway: 'service', access: 'no' } },
      { type: 'node', id: 100, lon: 6.0, lat: 49.0 },
      { type: 'node', id: 101, lon: 6.0004, lat: 49.0 },
      { type: 'node', id: 102, lon: 6.0008, lat: 49.0 },
    ],
  };

  const deadends = detectDeadendWayIds(payload, tileBbox, queryBbox);
  assert.deepEqual(Array.from(deadends).sort((a, b) => a - b), [10]);
});

