import 'dotenv/config';

const overpassUrls = (process.env.OVERPASS_URLS ?? process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter')
  .split(',')
  .map((url) => url.trim())
  .filter((url) => url.length > 0);

const config = {
  port:                     parseInt(process.env.PORT                         ?? '3000',  10),
  host:                              process.env.HOST                         ?? '0.0.0.0',
  nodeEnv:                           process.env.NODE_ENV                     ?? 'development',
  overpassUrls,
  overpassBboxPaddingMeters: parseInt(process.env.OVERPASS_BBOX_PADDING_METERS ?? '1000',    10),
  cacheTtlSeconds:           parseInt(process.env.CACHE_TTL_SECONDS           ?? '3600',  10),
  cacheDir:                           process.env.CACHE_DIR                   ?? './cache',
  corsOrigin:                         process.env.CORS_ORIGIN                 ?? '*',
} as const;

export type Config = typeof config;
export default config;

