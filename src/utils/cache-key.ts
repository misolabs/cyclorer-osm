import { createHash } from 'node:crypto';

type CacheKeyInput = {
  endpoint: string;
  x: number;
  y: number;
  res: number;
  variant?: string;
};

export function buildCacheKey(input: CacheKeyInput): string {
  const normalized = [
    input.endpoint,
    input.x,
    input.y,
    input.res,
    input.variant ?? '',
  ].join(':');
  return createHash('sha1').update(normalized).digest('hex');
}

