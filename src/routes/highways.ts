import type { FastifyInstance } from 'fastify';
import config from '../config';
import { FileCache } from '../services/file-cache';
import { overpassToGeoJson } from '../services/geojson';
import { fetchHighwayWays } from '../services/overpass';
import { buildCacheKey } from '../utils/cache-key';
import { tileIndexToBbox } from '../utils/mercator';

type TileParams = {
  x: string;
  y: string;
  res: string;
};

const ENDPOINT_ID = 'highways-v1';

const cache = new FileCache({
  cacheDir: config.cacheDir,
  ttlSeconds: config.cacheTtlSeconds,
});

function parseFiniteNumber(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function parsePositiveNumber(value: string): number | null {
  const parsed = parseFiniteNumber(value);
  if (parsed === null || parsed <= 0) {
    return null;
  }
  return parsed;
}

export default async function highwaysRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: TileParams }>('/tiles/highways/:x/:y/:res', async (req, reply) => {
    const x = parseFiniteNumber(req.params.x);
    const y = parseFiniteNumber(req.params.y);
    const res = parsePositiveNumber(req.params.res);

    if (x === null || y === null || res === null) {
      return reply.badRequest('x and y must be finite numbers, and res must be > 0');
    }

    const cacheKey = buildCacheKey({ endpoint: ENDPOINT_ID, x, y, res });
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) {
      return reply.send({ source: 'cache', data: cached });
    }

    const tileBbox = tileIndexToBbox(x, y, res);

    try {
      const { osmData, queryBbox } = await fetchHighwayWays(tileBbox);
      const geojson = overpassToGeoJson(osmData);
      await cache.set(cacheKey, geojson);

      return reply.send({
        source: 'overpass',
        cacheKey,
        tileBbox,
        queryBbox,
        data: geojson,
      });
    } catch (error) {
      req.log.error({ err: error }, 'Overpass request failed');
      return reply.badGateway('Failed to fetch OSM data from Overpass');
    }
  });
}



