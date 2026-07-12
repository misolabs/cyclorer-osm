import { createHash } from 'node:crypto';
import config from '../config';
import { FileCache } from './file-cache';
import type { Bbox } from '../utils/mercator';
import { expandBbox } from '../utils/mercator';

export type OverpassResponse = {
  version: number;
  generator: string;
  elements: OverpassElement[];
};

export type OverpassNodeElement = {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
};

export type OverpassWayElement = {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
};

export type OverpassElement = OverpassNodeElement | OverpassWayElement | {
  type: string;
  [key: string]: unknown;
};

export type FetchHighwayWaysResult = {
  osmData: OverpassResponse;
  queryBbox: Bbox;
};

const RAW_OVERPASS_CACHE_TTL_SECONDS = 60 * 60 * 24 * 60;

const rawOverpassCache = new FileCache({
  cacheDir: config.cacheDir,
  ttlSeconds: RAW_OVERPASS_CACHE_TTL_SECONDS,
  subdir: 'overpass',
});

function toOverpassBbox(bbox: Bbox): string {
  return `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
}

export function buildHighwayWaysQuery(bbox: Bbox): string {
  const bboxString = toOverpassBbox(bbox);
  return `
[out:json][timeout:25];
(
  relation["route"="bicycle"](${bboxString});
  way["highway"](${bboxString});
);
out body;
>;
out skel qt;
`.trim();
}

function buildRawOverpassCacheKey(query: string): string {
  return createHash('sha1').update(`overpass:v1:${query}`).digest('hex');
}

async function fetchOverpassQuery(query: string): Promise<OverpassResponse> {
  const cacheKey = buildRawOverpassCacheKey(query);
  const cached = await rawOverpassCache.get<OverpassResponse>(cacheKey);
  if (cached) {
    return cached;
  }

  const failures: string[] = [];

  for (const endpoint of config.overpassUrls) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'user-agent': 'cyclorer-osm / 1.0',
      },
      body: new URLSearchParams({ data: query }),
    });

    if (response.ok) {
      const osmData = (await response.json()) as OverpassResponse;
      await rawOverpassCache.set(cacheKey, osmData);
      return osmData;
    }

    failures.push(`${endpoint} -> ${response.status}`);
  }

  throw new Error(`Overpass request failed for all endpoints: ${failures.join(', ')}`);
}

export async function fetchHighwayWays(tileBbox: Bbox, paddingMeters = config.overpassBboxPaddingMeters): Promise<FetchHighwayWaysResult> {
  const queryBbox = expandBbox(tileBbox, paddingMeters);
  const query = buildHighwayWaysQuery(queryBbox);
  const osmData = await fetchOverpassQuery(query);
  return { osmData, queryBbox };
}
